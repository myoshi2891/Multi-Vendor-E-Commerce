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

export default async function AdminDashboardPage() {
    const [stats, salesData, recentOrders, recentStores] = await Promise.all([
        getAdminDashboardStats(),
        getSalesOverTime("monthly"),
        getRecentOrders(5),
        getRecentStores(5),
    ]);

    return (
        <div className="flex flex-col gap-6 p-6">
            <h1 className="text-2xl font-bold">ダッシュボード</h1>

            <StatsCards stats={stats} />

            <SalesChart data={salesData} period="monthly" />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <RecentOrders orders={recentOrders} />
                <RecentStores stores={recentStores} />
            </div>
        </div>
    );
}
