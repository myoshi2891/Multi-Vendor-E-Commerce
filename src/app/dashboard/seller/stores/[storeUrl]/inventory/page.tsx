import DataTable from "@/components/ui/data-table";
import { getInventoryColumns } from "./columns";
import { getStoreInventory } from "@/queries/inventory";
import { requireStoreOwner } from "@/lib/auth-guards";
import InventoryAlertSummary from "@/components/dashboard/seller/inventory-alert-summary";
import LowStockThresholdForm from "@/components/dashboard/seller/low-stock-threshold-form";

export const dynamic = "force-dynamic";

/**
 * 販売者の在庫管理ページ（F2）。
 *
 * requireStoreOwner で店舗所有権を再検証しつつ lowStockThreshold を取得し（多層防御）、
 * getStoreInventory で在庫行を取得する。アラートサマリー・しきい値設定フォーム・
 * 在庫一覧 DataTable（商品名で検索・在庫数インライン編集・ステータスバッジ）を描画する。
 */
export default async function SellerInventoryPage({
    params,
}: {
    params: Promise<{ storeUrl: string }>;
}) {
    const { storeUrl } = await params;

    // 店舗所有権の再検証 + lowStockThreshold の取得（query 側でも再検証される）
    const { store } = await requireStoreOwner(storeUrl);
    const threshold = store.lowStockThreshold;

    const rows = await getStoreInventory(storeUrl);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <InventoryAlertSummary rows={rows} threshold={threshold} />
                <LowStockThresholdForm
                    storeUrl={storeUrl}
                    initialThreshold={threshold}
                />
            </div>
            <DataTable
                filterValue="productName"
                data={rows}
                columns={getInventoryColumns(threshold, storeUrl)}
                searchPlaceholder="Search product ..."
            />
        </div>
    );
}
