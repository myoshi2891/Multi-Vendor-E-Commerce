"use client";

import { ColumnDef } from "@tanstack/react-table";

import type { StoreInventoryRow } from "@/lib/types";
import InventoryQuantityCell from "@/components/dashboard/seller/inventory-quantity-cell";
import StockStatusBadge from "@/components/dashboard/seller/stock-status-badge";

/**
 * src/app/dashboard/seller/stores/[storeUrl]/inventory/columns.tsx
 * 在庫一覧 DataTable の列定義（F2）。
 *
 * ステータスバッジは店舗ごとの lowStockThreshold、在庫数編集セルは storeUrl を必要とする。
 * 固定の columns 配列ではこれらを cell へ渡せないため、しきい値と storeUrl を引数に取る
 * ファクトリ関数として公開する（純粋・テスト容易）。商品名（productName）で検索するため
 * page 側の DataTable には filterValue="productName" を渡す。
 */
export function getInventoryColumns(
    threshold: number,
    storeUrl: string
): ColumnDef<StoreInventoryRow>[] {
    return [
        {
            accessorKey: "productName",
            header: "商品名",
            cell: ({ row }) => <span>{row.original.productName}</span>,
        },
        {
            accessorKey: "variantName",
            header: "バリアント",
            cell: ({ row }) => <span>{row.original.variantName}</span>,
        },
        {
            accessorKey: "size",
            header: "サイズ",
            cell: ({ row }) => <span>{row.original.size}</span>,
        },
        {
            accessorKey: "quantity",
            header: "在庫数",
            cell: ({ row }) => (
                <InventoryQuantityCell
                    sizeId={row.original.sizeId}
                    initialQuantity={row.original.quantity}
                    storeUrl={storeUrl}
                />
            ),
        },
        {
            accessorKey: "price",
            header: "価格",
            cell: ({ row }) => <span>${row.original.price.toFixed(2)}</span>,
        },
        {
            accessorKey: "status",
            header: "ステータス",
            cell: ({ row }) => (
                <StockStatusBadge
                    quantity={row.original.quantity}
                    threshold={threshold}
                />
            ),
        },
    ];
}
