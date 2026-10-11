"use client";

import { useMemo, useState } from "react";
import type { updateSizeStock } from "@/queries/inventory";
import DataTable from "@/components/ui/data-table";
import type { StoreInventoryRow } from "@/lib/types";
import { getInventoryColumns } from "./columns";

/**
 * src/app/dashboard/seller/stores/[storeUrl]/inventory/inventory-table-client.tsx
 * 在庫一覧 DataTable のクライアント境界ラッパー（F2）。
 *
 * getInventoryColumns は cell に関数（React 要素を返すレンダラ）を含む列定義を生成するため、
 * Server Component から直接呼ぶ / props で渡すと RSC のシリアライズ境界に違反する。
 * 列定義の生成と DataTable の描画をこのクライアントコンポーネントに閉じ込め、
 * page.tsx からはシリアライズ可能な props（rows / threshold / storeUrl）のみを受け取る。
 *
 * flexRender は cell 関数をコンポーネント型として createElement するため、列定義を毎 render
 * 作り直すと router.refresh() のたびに在庫セルが remount され、保存成功の表示が消える。
 * 列定義は useMemo で固定し、しきい値は依存に含めず行データへ載せる（しきい値保存後の refresh で
 * 在庫数エディターを remount させないため）。Server Action は refresh のたびに Flight デコードで別参照になるが、
 * 呼び出しは action ID で解決され同一の処理を指すため、初回の参照を useState で固定して使う。
 */
type Props = {
    rows: StoreInventoryRow[];
    threshold: number;
    storeUrl: string;
    updateStockAction: typeof updateSizeStock;
};

export default function InventoryTableClient({
    rows,
    threshold,
    storeUrl,
    updateStockAction,
}: Props) {
    const [stableAction] = useState(() => updateStockAction);
    const columns = useMemo(
        () => getInventoryColumns(storeUrl, stableAction),
        [storeUrl, stableAction]
    );
    const data = useMemo(
        () => rows.map((row) => ({ ...row, lowStockThreshold: threshold })),
        [rows, threshold]
    );
    return (
        <DataTable
            design="seller"
            filterValue="productName"
            data={data}
            columns={columns}
            searchPlaceholder="Search product ..."
        />
    );
}
