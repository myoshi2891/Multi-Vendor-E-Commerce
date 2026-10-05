import SellerPage from "../design/seller-page";
import styles from "../design/seller.module.css";
import { StoreStatsCards } from "./store-stats-cards";
import { SalesChart } from "../admin/sales-chart";
import { StoreRecentOrders } from "./store-recent-orders";
import { StoreTopProducts } from "./store-top-products";
import type {
    getStoreDashboardStats,
    getStoreSalesOverTime,
    getStoreRecentOrders,
    getStoreTopProducts,
} from "@/queries/store-dashboard";
export default function StoreOverview({
    stats,
    salesData,
    recentOrders,
    topProducts,
}: {
    stats: Awaited<ReturnType<typeof getStoreDashboardStats>>;
    salesData: Awaited<ReturnType<typeof getStoreSalesOverTime>>;
    recentOrders: Awaited<ReturnType<typeof getStoreRecentOrders>>;
    topProducts: Awaited<ReturnType<typeof getStoreTopProducts>>;
}) {
    return (
        <SellerPage
            id="store-overview"
            title="店舗ダッシュボード"
            description="売上、注文、商品と在庫の状況を確認できます。"
        >
            <StoreStatsCards stats={stats} />
            <SalesChart data={salesData} period="monthly" design="seller" />
            <div className={styles.grid}>
                <StoreRecentOrders orders={recentOrders} />
                <StoreTopProducts products={topProducts} />
            </div>
        </SellerPage>
    );
}
