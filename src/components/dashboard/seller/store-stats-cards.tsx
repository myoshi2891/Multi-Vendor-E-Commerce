import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { StoreDashboardStats } from "@/queries/store-dashboard";

interface Props {
    stats: StoreDashboardStats;
}

/**
 * 店舗ダッシュボードの KPI を指標カードとしてレスポンシブグリッドで表示する（F1）。
 *
 * admin の StatsCards（src/components/dashboard/admin/stats-cards.tsx）の店舗スコープ版。
 * 総売上・総注文数・総閲覧数・販売数・総商品数・在庫アラート件数を表示する。
 * 金額（totalRevenue）は query 側で number 化済みのため、ここでは整形のみ行う（NFR-3）。
 */
export function StoreStatsCards({ stats }: Props) {
    const items = [
        {
            label: "総売上",
            value: `$${stats.totalRevenue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })}`,
        },
        { label: "総注文数", value: stats.totalOrders.toLocaleString() },
        { label: "総閲覧数", value: stats.totalViews.toLocaleString() },
        { label: "販売数", value: stats.totalSales.toLocaleString() },
        { label: "総商品数", value: stats.totalProducts.toLocaleString() },
        {
            label: "在庫アラート",
            value: stats.lowStockCount.toLocaleString(),
        },
    ] as const;

    return (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {items.map(({ label, value }) => (
                <Card key={label}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            {label}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{value}</p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
