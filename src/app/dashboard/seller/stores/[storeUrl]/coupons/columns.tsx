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
import { Coupon } from '@prisma/client'

// Types
import { StoreProductType } from '@/lib/types'

// Toast
import { useToast } from '@/hooks/use-toast'
import { getTimeUntil } from '@/lib/utils'

export const columns: ColumnDef<Coupon>[] = [
    {
        accessorKey: 'code',
        header: 'Code',
        cell: ({ row }) => {
            return <span>{row.original.code}</span>
        },
    },
    {
        accessorKey: 'discount',
        header: 'Discount',
        cell: ({ row }) => {
            return <span>{row.original.discount}</span>
        },
    },
    {
        accessorKey: 'startDate',
        header: 'Start Date',
        cell: ({ row }) => {
            return (
                <span>{new Date(row.original.startDate).toDateString()}</span>
            )
        },
    },
    {
        accessorKey: 'endDate',
        header: 'End Date',
        cell: ({ row }) => {
            return <span>{new Date(row.original.endDate).toDateString()}</span>
        },
    },
    {
        accessorKey: 'timeleft',
        header: 'Time Left',
        cell: ({ row }) => {
            const { days, hours } = getTimeUntil(row.original.endDate)
            return (
                <span>
                    {days} days and {hours} hours
                </span>
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
