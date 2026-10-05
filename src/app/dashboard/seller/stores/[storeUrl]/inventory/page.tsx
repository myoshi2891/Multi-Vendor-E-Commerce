import {
    getStoreInventory,
    updateSizeStock,
    updateStoreLowStockThreshold,
} from "@/queries/inventory";
import { requireStoreOwner } from "@/lib/auth-guards";
import SellerInventory from "@/components/dashboard/seller/seller-inventory";
import SellerPage from "@/components/dashboard/design/seller-page";
import { LookupFailure } from "@/components/dashboard/design/seller-error";
export const dynamic = "force-dynamic";
export default async function SellerInventoryPage({
    params,
}: {
    params: Promise<{ storeUrl: string }>;
}) {
    const { storeUrl } = await params;
    const { store } = await requireStoreOwner(storeUrl);
    const rows = await getStoreInventory(storeUrl).catch((error: unknown) => {
        if (error instanceof Error) {
            console.error("[SellerInventoryPage] Failed to load inventory", {
                error: error.message,
                stack: error.stack,
            });
        } else {
            console.error("[SellerInventoryPage] Unknown error", { error });
        }
        return null;
    });
    if (!rows)
        return (
            <SellerPage id="store-inventory" title="Inventory">
                <LookupFailure />
            </SellerPage>
        );
    return (
        <SellerInventory
            rows={rows}
            threshold={store.lowStockThreshold}
            storeUrl={storeUrl}
            updateStockAction={updateSizeStock}
            updateThresholdAction={updateStoreLowStockThreshold}
        />
    );
}
