import {
    getStoreDashboardStats,
    getStoreSalesOverTime,
    getStoreRecentOrders,
    getStoreTopProducts,
} from "@/queries/store-dashboard";
import { StoreStatsCards } from "@/components/dashboard/seller/store-stats-cards";
import { SalesChart } from "@/components/dashboard/admin/sales-chart";
import { StoreRecentOrders } from "@/components/dashboard/seller/store-recent-orders";
import { StoreTopProducts } from "@/components/dashboard/seller/store-top-products";

export const dynamic = "force-dynamic";

/**
 * 販売者の店舗ダッシュボード（F1）。
 *
 * store-dashboard.ts の各 query を Promise.all で並列取得し、
 * KPI カード・売上推移チャート（admin の SalesChart を再利用）・最近の注文・
 * 販売上位商品を描画する。認可は各 query 冒頭の requireStoreOwner が担う（多層防御）。
 */
export default async function SellerStorePage({
    params,
}: {
    params: Promise<{ storeUrl: string }>;
}) {
    const { storeUrl } = await params;

    const [stats, salesData, recentOrders, topProducts] = await Promise.all([
        getStoreDashboardStats(storeUrl),
        getStoreSalesOverTime(storeUrl, "monthly"),
        getStoreRecentOrders(storeUrl, 5),
        getStoreTopProducts(storeUrl, 5),
    ]);

    return (
        <div className="flex flex-col gap-6 p-6">
            <h1 className="text-2xl font-bold">店舗ダッシュボード</h1>

            <StoreStatsCards stats={stats} />

            <SalesChart data={salesData} period="monthly" />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <StoreRecentOrders orders={recentOrders} />
                <StoreTopProducts products={topProducts} />
            </div>
        </div>
    );
}
