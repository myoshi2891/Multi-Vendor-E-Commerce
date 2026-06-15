'use client'

// React, Next.js
import { useRouter } from 'next/navigation'
import { useState } from 'react'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Hooks
import { useModal } from '@/providers/modal-provider'
import { useToast } from '@/hooks/use-toast'

// Icons
import { Edit, MoreHorizontal, Power, Trash } from 'lucide-react'

// Queries
import {
    deleteCouponAsAdmin,
    getCoupon,
    toggleCouponActive,
} from '@/queries/coupon'

// Tanstack React Table
import { ColumnDef } from '@tanstack/react-table'

// Prisma types
import { Prisma } from '@prisma/client'

// Utils
import { getTimeUntil } from '@/lib/utils'
import CustomModal from '@/components/dashboard/shared/custom-modal'
import AdminCouponDetails from '@/components/dashboard/forms/admin-coupon-details'

export type AdminCouponType = Prisma.CouponGetPayload<{ include: { store: true } }>

export const columns: ColumnDef<AdminCouponType>[] = [
    {
        accessorKey: 'store',
        header: 'Store',
        cell: ({ row }) => (
            <span className="font-medium">{row.original.store?.name ?? '—'}</span>
        ),
    },
    {
        accessorKey: 'code',
        header: 'Code',
        cell: ({ row }) => <span>{row.original.code}</span>,
    },
    {
        accessorKey: 'discount',
        header: 'Discount',
        cell: ({ row }) => <span>{row.original.discount}%</span>,
    },
    {
        accessorKey: 'startDate',
        header: 'Start Date',
        cell: ({ row }) => (
            <span>{new Date(row.original.startDate).toDateString()}</span>
        ),
    },
    {
        accessorKey: 'endDate',
        header: 'End Date',
        cell: ({ row }) => (
            <span>{new Date(row.original.endDate).toDateString()}</span>
        ),
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
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ row }) =>
            row.original.isActive ? (
                <Badge className="bg-emerald-500 text-white hover:bg-emerald-500">
                    Active
                </Badge>
            ) : (
                <Badge variant="secondary">Inactive</Badge>
            ),
    },
    {
        id: 'actions',
        cell: ({ row }) => <CellActions coupon={row.original} />,
    },
]

interface CellActionsProps {
    coupon: AdminCouponType
}

const CellActions: React.FC<CellActionsProps> = ({ coupon }) => {
    const { setOpen, setClose } = useModal()
    const [loading, setLoading] = useState(false)
    const { toast } = useToast()
    const router = useRouter()

    if (!coupon) return null

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
                                <CustomModal>
                                    <AdminCouponDetails data={coupon} />
                                </CustomModal>,
                                async () => ({
                                    rowData: await getCoupon(coupon.id),
                                })
                            )
                        }}
                    >
                        <Edit size={15} />
                        Edit Details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="flex gap-2"
                        onClick={async () => {
                            setLoading(true)
                            try {
                                await toggleCouponActive(coupon.id)
                                toast({
                                    title: coupon.isActive
                                        ? 'Coupon deactivated'
                                        : 'Coupon activated',
                                    description: `${coupon.code} has been ${coupon.isActive ? 'deactivated' : 'activated'}.`,
                                })
                                router.refresh()
                            } catch (error: unknown) {
                                const message =
                                    error instanceof Error
                                        ? error.message
                                        : 'An unknown error occurred'
                                toast({
                                    variant: 'destructive',
                                    title: 'Oops!',
                                    description: message,
                                })
                            } finally {
                                setLoading(false)
                            }
                        }}
                        disabled={loading}
                    >
                        <Power size={15} />
                        {coupon.isActive ? 'Deactivate' : 'Activate'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <AlertDialogTrigger asChild>
                        <DropdownMenuItem className="flex gap-2">
                            <Trash size={15} /> Delete coupon
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
                        delete the coupon.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex items-center">
                    <AlertDialogCancel className="mb-2">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        disabled={loading}
                        className="mb-2 bg-destructive text-white hover:bg-destructive"
                        onClick={async () => {
                            setLoading(true)
                            try {
                                await deleteCouponAsAdmin(coupon.id)
                                toast({
                                    title: 'Deleted coupon',
                                    description: 'The coupon has been deleted.',
                                })
                                router.refresh()
                                setClose()
                            } catch (error: unknown) {
                                const message =
                                    error instanceof Error
                                        ? error.message
                                        : 'An unknown error occurred'
                                toast({
                                    variant: 'destructive',
                                    title: 'Oops!',
                                    description: message,
                                })
                            } finally {
                                setLoading(false)
                            }
                        }}
                    >
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
