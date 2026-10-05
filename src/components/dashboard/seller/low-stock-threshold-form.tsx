"use client";
import type { updateStoreLowStockThreshold } from "@/queries/inventory";
import StockNumberEditor from "./stock-number-editor";
export default function LowStockThresholdForm({
    storeUrl,
    initialThreshold,
    updateThresholdAction,
}: {
    storeUrl: string;
    initialThreshold: number;
    updateThresholdAction: typeof updateStoreLowStockThreshold;
}) {
    return (
        <StockNumberEditor
            initialValue={initialThreshold}
            label="過小在庫しきい値"
            saveAction={(value) => updateThresholdAction(storeUrl, value)}
            successText="しきい値を更新しました"
        />
    );
}
