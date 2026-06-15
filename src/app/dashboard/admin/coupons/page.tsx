// Queries
import DataTable from '@/components/ui/data-table'
import { columns } from './columns'
import { Plus } from 'lucide-react'
import { getAllCoupons } from '@/queries/coupon'
import AdminCouponDetails from '@/components/dashboard/forms/admin-coupon-details'

export const dynamic = 'force-dynamic'

/**
 * 管理者向けクーポン横断管理ページ。
 * 全ストアのクーポンを一覧表示し、isActive トグル・削除・編集操作を提供する。
 *
 * @returns クーポン DataTable を含む React 要素
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
