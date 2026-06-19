"use client";

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
 */
type Props = {
    rows: StoreInventoryRow[];
    threshold: number;
    storeUrl: string;
};

export default function InventoryTableClient({
    rows,
    threshold,
    storeUrl,
}: Props) {
    return (
        <DataTable
            filterValue="productName"
            data={rows}
            columns={getInventoryColumns(threshold, storeUrl)}
            searchPlaceholder="Search product ..."
        />
    );
}
