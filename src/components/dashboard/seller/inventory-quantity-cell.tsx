"use client";
import type { updateSizeStock } from "@/queries/inventory";
import StockNumberEditor from "./stock-number-editor";
export default function InventoryQuantityCell({
    sizeId,
    initialQuantity,
    storeUrl,
    updateStockAction,
}: {
    sizeId: string;
    initialQuantity: number;
    storeUrl: string;
    updateStockAction: typeof updateSizeStock;
}) {
    return (
        <StockNumberEditor
            initialValue={initialQuantity}
            label="在庫数"
            saveAction={(value) => updateStockAction(sizeId, value, storeUrl)}
            successText="在庫数を更新しました"
        />
    );
}
