"use client";

import type { updateSizeStock } from "@/queries/inventory";
import { ColumnDef } from "@tanstack/react-table";

import type { StoreInventoryRow } from "@/lib/types";
import InventoryQuantityCell from "@/components/dashboard/seller/inventory-quantity-cell";
import StockStatusBadge from "@/components/dashboard/seller/stock-status-badge";

/**
 * src/app/dashboard/seller/stores/[storeUrl]/inventory/columns.tsx
 * 在庫一覧 DataTable の列定義（F2）。
 *
 * 在庫数編集セルは storeUrl を必要とするため、storeUrl を引数に取るファクトリ関数として公開する
 * （純粋・テスト容易）。商品名（productName）で検索するため page 側の DataTable には
 * filterValue="productName" を渡す。
 *
 * 店舗の lowStockThreshold は引数ではなく行データ（InventoryTableRow）から読む。引数にすると
 * しきい値の保存で列定義が作り直され、在庫数エディターが remount されて成功表示が消えるため。
 */
export type InventoryTableRow = StoreInventoryRow & {
    lowStockThreshold: number;
};

export function getInventoryColumns(
    storeUrl: string,
    updateStockAction: typeof updateSizeStock
): ColumnDef<InventoryTableRow>[] {
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
                    key={row.original.sizeId}
                    updateStockAction={updateStockAction}
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
                    threshold={row.original.lowStockThreshold}
                />
            ),
        },
    ];
}
