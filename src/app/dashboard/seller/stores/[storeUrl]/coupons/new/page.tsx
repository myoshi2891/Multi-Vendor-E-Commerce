import { upsertCoupon } from "@/queries/coupon";
import SellerPage from "@/components/dashboard/design/seller-page";
import SellerCouponForm from "@/components/dashboard/seller/seller-coupon-form";
export default async function SellerNewCouponPage({
    params,
}: {
    params: Promise<{ storeUrl: string }>;
}) {
    const { storeUrl } = await params;
    return (
        <SellerPage
            id="seller-new-coupon"
            title="Create coupon"
            description="Create a discount code for your store."
        >
            <SellerCouponForm storeUrl={storeUrl} saveAction={upsertCoupon} />
        </SellerPage>
    );
}
