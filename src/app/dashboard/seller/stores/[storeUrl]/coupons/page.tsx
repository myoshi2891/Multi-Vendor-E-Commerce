import {
    getStoreCoupons,
    getCoupon,
    upsertCoupon,
    deleteCoupon,
} from "@/queries/coupon";
import SellerCoupons from "@/components/dashboard/seller/seller-coupons";
import SellerPage from "@/components/dashboard/design/seller-page";
import LoadError from "@/components/dashboard/design/load-error";
import { requireStoreOwner } from "@/lib/auth-guards";
export const dynamic = "force-dynamic";
export default async function SellerCouponsPage({
    params,
}: {
    params: Promise<{ storeUrl: string }>;
}) {
    const { storeUrl } = await params;
    // 所有権エラーは route の error.tsx へ伝播させ、取得失敗だけを LoadError で再試行可能にする
    await requireStoreOwner(storeUrl);
    const coupons = await getStoreCoupons(storeUrl).catch((error: unknown) => {
        if (error instanceof Error) {
            console.error("[SellerCouponsPage] Failed to load coupons", {
                error: error.message,
                stack: error.stack,
            });
        } else {
            console.error("[SellerCouponsPage] Unknown error", { error });
        }
        return null;
    });
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
