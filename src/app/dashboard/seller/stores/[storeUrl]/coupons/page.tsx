// Queries
import DataTable from '@/components/ui/data-table'
import { columns } from './columns'
import { Plus } from 'lucide-react'
import { getStoreCoupons } from '@/queries/coupon'
import CouponDetails from '@/components/dashboard/forms/coupon-details'

export default async function SellerCouponsPage({ params }: { params: Promise<{ storeUrl: string }> }) {
    const { storeUrl } = await params;
    // Get all coupons for the store
    const coupons = await getStoreCoupons(storeUrl)

    return (
        <div>
            <DataTable
                actionButtonText={
                    <>
                        <Plus size={15} />
                        Create New Coupon
                    </>
                }
                modalChildren={<CouponDetails storeUrl={storeUrl} />}
                newTabLink={`/dashboard/seller/stores/${storeUrl}/coupons/new`}
                filterValue="name"
                data={coupons}
                columns={columns}
                searchPlaceholder="Search coupon ..."
            />
        </div>
    )
}
