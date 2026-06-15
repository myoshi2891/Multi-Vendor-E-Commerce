import AdminCouponDetails from '@/components/dashboard/forms/admin-coupon-details'

/**
 * 管理者向けクーポン新規作成ページ。
 *
 * @returns AdminCouponDetails フォームを含む React 要素
 */
export default function AdminNewCouponPage() {
    return (
        <div className="w-full">
            <AdminCouponDetails />
        </div>
    )
}
