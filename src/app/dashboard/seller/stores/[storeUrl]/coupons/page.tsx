// Queries
import DataTable from '@/components/ui/data-table'
import { columns } from './columns'
import { Plus } from 'lucide-react'
import { getStoreCoupons } from '@/queries/coupon'
import CouponDetails from '@/components/dashboard/forms/coupon-details'

export default async function SellerCouponsPage({ params }: { params: { storeUrl: string } }) {
    // Get all coupons for the store
    const coupons = await getStoreCoupons(params.storeUrl)

    return (
        <div>
            <DataTable
                actionButtonText={
                    <>
                        <Plus size={15} />
                        Create New Coupon
                    </>
                }
                modalChildren={<CouponDetails storeUrl={params.storeUrl} />}
                newTabLink={`/dashboard/seller/stores/${params.storeUrl}/coupons/new`}
                filterValue="name"
                data={coupons}
                columns={columns}
                searchPlaceholder="Search coupon ..."
            />
        </div>
    )
}
