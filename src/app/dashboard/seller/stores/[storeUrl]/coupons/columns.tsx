'use client'

// React, Next.js imports
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

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
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Hooks and utilities
// import { useToast } from "@/components/ui/use-toast";
import { useModal } from '@/providers/modal-provider'

// Lucide icons
import { CopyPlus, FilePenLine, MoreHorizontal, Trash } from 'lucide-react'

// Queries
import { deleteProduct } from '@/queries/product'

// Tanstack React Table
import { ColumnDef } from '@tanstack/react-table'

// Prisma models

// Types
import { StoreProductType } from '@/lib/types'

// Toast
import { useToast } from '@/hooks/use-toast'

export const columns: ColumnDef<StoreProductType>[] = [
    {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
            <h1 className="truncate border-b pb-3 font-bold capitalize">
                {row.original.name}
            </h1>
        ),
    },
    {
        accessorKey: 'image',
        header: 'Images',
        cell: ({ row }) => {
            return (
                <div className="flex flex-col gap-y-3">
                    {/* Product name */}
                    {/* <h1 className="font-bold truncate pb-3 border-b capitalize">
						{row.original.name}
					</h1> */}
                    {/* Product variant */}
                    <div className="relative flex flex-wrap gap-2">
                        {row.original.variants.map((variant) => (
                            <div
                                key={variant.id}
                                className="group flex flex-col gap-y-2"
                            >
                                <div className="relative cursor-pointer p-2">
                                    <Image
                                        src={variant.images[0].url}
                                        alt={`${variant.variantName} image`}
                                        width={1000}
                                        height={1000}
                                        priority
                                        className="h-72 max-w-72 rounded-md object-cover shadow-sm"
                                    />
                                    <Link
                                        href={`/dashboard/seller/stores/${row.original.store.url}/products/${row.original.id}/variants/${variant.id}`}
                                    >
                                        <div className="absolute inset-0 z-0 hidden h-full w-[304px] rounded-sm bg-black/50 transition-all duration-150 group-hover:block">
                                            <FilePenLine className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white" />
                                        </div>
                                    </Link>
                                </div>
                                {/* Info */}
                                <div className="mt-2 flex gap-2 p-1">
                                    {/* Colors */}
                                    <div className="flex w-7 flex-col gap-2 rounded-md">
                                        {variant.colors.map((color) => (
                                            <span
                                                key={color.name}
                                                className="size-5 rounded-full shadow-2xl"
                                                style={{
                                                    backgroundColor: color.name,
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <div>
                                        {/* Name of variant */}
                                        <h1 className="max-w-40 text-sm capitalize">
                                            {variant.variantName}
                                        </h1>
                                        {/* Sizes */}
                                        <div className="mt-1 flex max-w-72 flex-wrap gap-2">
                                            {variant.sizes.map((size) => (
                                                <span
                                                    className="w-fit rounded-md border-2 bg-white/10 p-1 text-[11px] font-medium"
                                                    key={size.size}
                                                >
                                                    {size.size} - (
                                                    {size.quantity}) - $
                                                    {size.price}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )
        },
    },
    {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ row }) => {
            return <span>{row.original.category.name}</span>
        },
    },
    {
        accessorKey: 'subCategory',
        header: 'SubCategory',
        cell: ({ row }) => {
            return <span>{row.original.subCategory.name}</span>
        },
    },
    {
        accessorKey: 'offerTag',
        header: 'Offer',
        cell: ({ row }) => {
            const offerTag = row.original.offerTag
            return <span>{offerTag ? offerTag.name : '-'}</span>
        },
    },
    {
        accessorKey: 'brand',
        header: 'Brand',
        cell: ({ row }) => {
            return <span>{row.original.brand}</span>
        },
    },
    {
        accessorKey: 'new-variant',
        header: '',
        cell: ({ row }) => {
            return (
                <Link
                    href={`/dashboard/seller/stores/${row.original.store.url}/products/${row.original.id}/variants/new`}
                >
                    <CopyPlus className="hover:text-blue-200" />
                </Link>
            )
        },
    },
    {
        id: 'actions',
        cell: ({ row }) => {
            const rowData = row.original

            return <CellActions productId={rowData.id} />
        },
    },
]

// Define props interface for CellActions component
interface CellActionsProps {
    productId: string
}

// CellActions component definition
const CellActions: React.FC<CellActionsProps> = ({ productId }) => {
    // Hooks
    const { setClose } = useModal()
    const [loading, setLoading] = useState(false)
    const { toast } = useToast()
    const router = useRouter()

    // Return null if rowData or rowData.id don't exist
    if (!productId) return null

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
                    <AlertDialogTrigger asChild>
                        <DropdownMenuItem
                            className="flex gap-2"
                            onClick={() => {}}
                        >
                            <Trash size={15} /> Delete product
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
                        delete the product and variants that exist inside
                        product.
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
                            await deleteProduct(productId)
                            toast({
                                title: 'Deleted product',
                                description: 'The product has been deleted.',
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
