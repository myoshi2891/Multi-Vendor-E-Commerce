import CouponForm from "@/components/dashboard/admin/coupon-form";
import SellerPage from "@/components/dashboard/design/seller-page";
import { upsertCouponAsAdmin } from "@/queries/coupon";
export default function AdminNewCouponPage() {
    return (
        <SellerPage
            workspace="Administration"
            id="admin-new-coupon"
            title="Create coupon"
            description="Create a store or platform discount with a validity period."
        >
            <CouponForm saveAction={upsertCouponAsAdmin} />
        </SellerPage>
    );
}
