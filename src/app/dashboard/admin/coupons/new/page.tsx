import AdminCouponDetails from '@/components/dashboard/forms/admin-coupon-details'

/**
 * Page for administrators to create new coupons.
 *
 * @returns A React element containing the coupon creation form.
 */
export default function AdminNewCouponPage() {
    return (
        <div className="w-full">
            <AdminCouponDetails />
        </div>
    )
}
