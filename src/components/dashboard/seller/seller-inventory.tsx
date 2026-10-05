"use client";
import type { StoreInventoryRow } from "@/lib/types";
import type {
    updateSizeStock,
    updateStoreLowStockThreshold,
} from "@/queries/inventory";
import SellerPage from "../design/seller-page";
import styles from "../design/seller.module.css";
import InventoryAlertSummary from "./inventory-alert-summary";
import LowStockThresholdForm from "./low-stock-threshold-form";
import InventoryTableClient from "@/app/dashboard/seller/stores/[storeUrl]/inventory/inventory-table-client";
export default function SellerInventory({
    rows,
    threshold,
    storeUrl,
    updateStockAction,
    updateThresholdAction,
}: {
    rows: StoreInventoryRow[];
    threshold: number;
    storeUrl: string;
    updateStockAction: typeof updateSizeStock;
    updateThresholdAction: typeof updateStoreLowStockThreshold;
}) {
    return (
        <SellerPage
            id="store-inventory"
            title="Inventory"
            description="Review stock levels and update your low-stock threshold."
        >
            <div className={styles.grid}>
                <InventoryAlertSummary rows={rows} threshold={threshold} />
                <div className={styles.panel}>
                    <LowStockThresholdForm
                        key={threshold}
                        storeUrl={storeUrl}
                        initialThreshold={threshold}
                        updateThresholdAction={updateThresholdAction}
                    />
                </div>
            </div>
            <InventoryTableClient
                rows={rows}
                threshold={threshold}
                storeUrl={storeUrl}
                updateStockAction={updateStockAction}
            />
        </SellerPage>
    );
}
