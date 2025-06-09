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
            return (
                <span className="text-lg font-extrabold capitalize">
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
