import {
    getAllCoupons,
    getCouponAsAdmin,
    upsertCouponAsAdmin,
    deleteCouponAsAdmin,
    toggleCouponActive,
} from "@/queries/coupon";
import AdminCoupons from "@/components/dashboard/admin/admin-coupons";
import SellerPage from "@/components/dashboard/design/seller-page";
import LoadError from "@/components/dashboard/design/load-error";
export const dynamic = "force-dynamic";
export default async function AdminCouponsPage() {
    const coupons = await getAllCoupons().catch(() => null);
    if (!coupons)
        return (
            <SellerPage
                workspace="Administration"
                id="admin-coupons"
                title="Coupons"
            >
                <LoadError subject="coupons" />
            </SellerPage>
        );
    return (
        <AdminCoupons
            coupons={coupons.map(({ store, ...coupon }) => ({
                ...coupon,
                store: store ? { name: store.name } : null,
            }))}
            actions={{
                loadAction: getCouponAsAdmin,
                saveAction: upsertCouponAsAdmin,
                deleteAction: deleteCouponAsAdmin,
                toggleAction: toggleCouponActive,
            }}
        />
    );
}
