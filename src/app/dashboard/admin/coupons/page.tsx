// Queries
import DataTable from '@/components/ui/data-table'
import { columns } from './columns'
import { Plus } from 'lucide-react'
import { getAllCoupons } from '@/queries/coupon'
import AdminCouponDetails from '@/components/dashboard/forms/admin-coupon-details'

export const dynamic = 'force-dynamic'

/**
 * Renders the admin coupon management page.
 *
 * Displays all coupons in a searchable table with options to create and manage coupon details.
 *
 * @returns The coupon management interface.
 */
export default async function AdminCouponsPage() {
    const coupons = await getAllCoupons()

    return (
        <div>
            <DataTable
                actionButtonText={
                    <>
                        <Plus size={15} />
                        Create New Coupon
                    </>
                }
                modalChildren={<AdminCouponDetails />}
                newTabLink="/dashboard/admin/coupons/new"
                filterValue="code"
                data={coupons}
                columns={columns}
                searchPlaceholder="Search coupon code ..."
            />
        </div>
    )
}
