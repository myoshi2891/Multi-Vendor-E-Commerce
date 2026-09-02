'use client'

// React, Next.js imports
import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

// Custom components
import CategoryDetails from '@/components/dashboard/forms/category-details'
import CustomModal from '@/components/dashboard/shared/custom-modal'

// UI components
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Hooks and utilities
// import { useToast } from "@/components/ui/use-toast";
import { useModal } from '@/providers/modal-provider'

// Lucide icons
import {
    BadgeCheck,
    BadgeMinus,
    Edit,
    MoreHorizontal,
    Trash,
} from 'lucide-react'

// Queries
import { deleteCategory, getCategory } from '@/queries/category'

// Tanstack React Table
import { ColumnDef } from '@tanstack/react-table'

// Prisma models
import { Category } from '@prisma/client'
import { useToast } from '@/hooks/use-toast'

/** 1 階層あたりの字下げ幅（px）。 */
const INDENT_PX = 16

/**
 * materialized path から親ノードの slug を取り出す。
 *
 * 親行を引き直さずに済むうえ、**`path` が正しく維持されていること自体の表示**にもなる
 * （再親子化で子孫の path が取り残されると、この列が旧親を指したままになる）。
 *
 * @param path - `Category.path`（区切りは `/`、末尾に区切りは付かない）
 * @returns 親の slug。ルートなら `null`
 */
const parentSlugOf = (path: string): string | null => {
    const segments = path.split('/')
    return segments.length < 2 ? null : segments[segments.length - 2]
}

export const columns: ColumnDef<Category>[] = [
    {
        accessorKey: 'image',
        header: '',
        cell: ({ row }) => {
            return (
                <div className="relative h-44 min-w-64 overflow-hidden rounded-xl">
                    <Image
                        priority
                        src={row.original.image}
                        alt={row.original.name}
                        width={1000}
                        height={1000}
                        className="size-40 rounded-full object-cover shadow-2xl"
                    />
                </div>
            )
        },
    },
    {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => {
            // 1 テーブルに全階層が並ぶ（plan 068 で SubCategory ルートを廃止）ため、
            // 深さは字下げでしか読めない。`buildCategoryTree` → `flattenCategoryTree`
            // の pre-order で並んでいるので、字下げがそのまま木の形になる。
            return (
                <span
                    className="text-lg font-extrabold capitalize"
                    style={{ paddingLeft: row.original.depth * INDENT_PX }}
                >
                    {row.original.name}
                </span>
            )
        },
    },

    {
        accessorKey: 'url',
        header: 'URL',
        cell: ({ row }) => {
            return <span>/{row.original.url}</span>
        },
    },
    {
        id: 'parent',
        header: 'Parent',
        cell: ({ row }) => {
            const parentSlug = parentSlugOf(row.original.path)
            return (
                <span className="text-muted-foreground">
                    {parentSlug === null ? '—' : `/${parentSlug}`}
                </span>
            )
        },
    },
    {
        accessorKey: 'sortOrder',
        header: 'Order',
        cell: ({ row }) => {
            return (
                <span className="text-muted-foreground">
                    {row.original.sortOrder}
                </span>
            )
        },
    },
    {
        accessorKey: 'featured',
        header: 'Featured',
        cell: ({ row }) => {
            return (
                <span className="flex justify-center text-muted-foreground">
                    {row.original.featured ? (
                        <BadgeCheck className="stroke-green-300" />
                    ) : (
                        <BadgeMinus />
                    )}
                </span>
            )
        },
    },
    {
        id: 'actions',
        cell: ({ row }) => {
            const rowData = row.original

            return <CellActions rowData={rowData} />
        },
    },
]

// Define props interface for CellActions component
interface CellActionsProps {
    rowData: Category
}

// CellActions component definition
const CellActions: React.FC<CellActionsProps> = ({ rowData }) => {
    // Hooks
    const { setOpen, setClose } = useModal()
    const [loading, setLoading] = useState(false)
    const { toast } = useToast()
    const router = useRouter()

    // Return null if rowData or rowData.id don't exist
    if (!rowData || !rowData.id) return null

    return (
        <AlertDialog>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="size-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem
                        className="flex gap-2"
                        onClick={() => {
                            setOpen(
                                // Custom modal component
                                <CustomModal>
                                    {/* Store details component */}
                                    <CategoryDetails data={{ ...rowData }} />
                                </CustomModal>,
                                async () => {
                                    return {
                                        rowData: await getCategory(rowData?.id),
                                    }
                                }
                            )
                        }}
                    >
                        <Edit size={15} />
                        Edit Details
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                            className="flex gap-2"
                            onClick={() => {}}
                        >
                            <Trash size={15} /> Delete category
                        </DropdownMenuItem>
                    </AlertDialogTrigger>
                </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialogContent className="max-w-lg">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-left">
                        Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-left">
                        This action cannot be undone. This will permanently
                        delete the category and related data.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex items-center">
                    <AlertDialogCancel className="mb-2">
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                        disabled={loading}
                        className="mb-2 bg-destructive text-white hover:bg-destructive"
                        onClick={async () => {
                            setLoading(true)
                            await deleteCategory(rowData.id)
                            toast({
                                title: 'Deleted category',
                                description: 'The category has been deleted.',
                            })
                            setLoading(false)
                            router.refresh()
                            setClose()
                        }}
                    >
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
