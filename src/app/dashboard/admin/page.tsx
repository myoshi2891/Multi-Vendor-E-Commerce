import SellerPage from "@/components/dashboard/design/seller-page";
import LoadError from "@/components/dashboard/design/load-error";
import styles from "@/components/dashboard/design/seller.module.css";
import {
    getAdminDashboardStats,
    getSalesOverTime,
    getRecentOrders,
    getRecentStores,
} from "@/queries/dashboard";
import { StatsCards } from "@/components/dashboard/admin/stats-cards";
import { SalesChart } from "@/components/dashboard/admin/sales-chart";
import { RecentOrders } from "@/components/dashboard/admin/recent-orders";
import { RecentStores } from "@/components/dashboard/admin/recent-stores";

export const dynamic = "force-dynamic";

/**
 * Renders the admin dashboard with statistics, sales trends, and recent activity.
 *
 * @returns The admin dashboard layout containing statistics cards, sales chart, and recent orders and stores.
 */
export default async function AdminDashboardPage() {
    const data = await Promise.all([
        getAdminDashboardStats(),
        getSalesOverTime("monthly"),
        getRecentOrders(5),
        getRecentStores(5),
    ]).catch(() => null);
    if (!data)
        return (
            <SellerPage
                workspace="Administration"
                id="admin-overview"
                title="ダッシュボード"
            >
                <LoadError subject="dashboard information" />
            </SellerPage>
        );
    const [stats, salesData, recentOrders, recentStores] = data;

    return (
        <SellerPage
            workspace="Administration"
            id="admin-overview"
            title="ダッシュボード"
        >
            <StatsCards stats={stats} design="seller" />

            <SalesChart data={salesData} period="monthly" design="seller" />

            <div className={styles.grid}>
                <RecentOrders orders={recentOrders} design="seller" />
                <RecentStores stores={recentStores} design="seller" />
            </div>
        </SellerPage>
    );
}
