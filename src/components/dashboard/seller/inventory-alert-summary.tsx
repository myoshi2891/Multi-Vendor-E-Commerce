import { getStockStatus } from "@/lib/utils";
import type { StoreInventoryRow } from "@/lib/types";

/**
 * src/components/dashboard/seller/inventory-alert-summary.tsx
 * 在庫アラートサマリー（F2）。在庫切れ / 過小在庫の件数を集計表示する。
 *
 * 行データを props で受け取り getStockStatus（@/lib/utils）で集計するだけの
 * 純粋表示コンポーネント（RSC で可）。バッジと同じ判定関数を共有するため
 * 一覧の各行バッジとサマリー件数は必ず一致する。
 */

type Props = {
    rows: StoreInventoryRow[];
    threshold: number;
};

export default function InventoryAlertSummary({ rows, threshold }: Props) {
    let outOfStock = 0;
    let lowStock = 0;
    for (const row of rows) {
        const status = getStockStatus(row.quantity, threshold);
        if (status === "out") outOfStock += 1;
        else if (status === "low") lowStock += 1;
    }

    return (
        <div className="flex flex-wrap gap-4">
            <div className="rounded-lg border bg-background px-4 py-3">
                <p className="text-sm text-muted-foreground">在庫切れ</p>
                <p className="text-2xl font-semibold text-destructive">
                    {outOfStock}
                </p>
            </div>
            <div className="rounded-lg border bg-background px-4 py-3">
                <p className="text-sm text-muted-foreground">過小在庫</p>
                <p className="text-2xl font-semibold text-warning">
                    {lowStock}
                </p>
            </div>
        </div>
    );
}
