import {
    getStoreCoupons,
    getCoupon,
    upsertCoupon,
    deleteCoupon,
} from "@/queries/coupon";
import SellerCoupons from "@/components/dashboard/seller/seller-coupons";
import SellerPage from "@/components/dashboard/design/seller-page";
import LoadError from "@/components/dashboard/design/load-error";
export const dynamic = "force-dynamic";
export default async function SellerCouponsPage({
    params,
}: {
    params: Promise<{ storeUrl: string }>;
}) {
    const { storeUrl } = await params;
    const coupons = await getStoreCoupons(storeUrl).catch(() => null);
    if (!coupons)
        return (
            <SellerPage id="seller-coupons" title="Coupons">
                <LoadError subject="coupons" />
            </SellerPage>
        );
    return (
        <SellerCoupons
            coupons={coupons}
            storeUrl={storeUrl}
            actions={{
                loadAction: getCoupon,
                saveAction: upsertCoupon,
                deleteAction: deleteCoupon,
            }}
        />
    );
}
