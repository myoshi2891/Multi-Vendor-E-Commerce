import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { AdminDashboardStats } from "@/queries/dashboard";

interface Props {
    stats: AdminDashboardStats;
}

export function StatsCards({ stats }: Props) {
    const items = [
        {
            label: "総売上",
            value: `$${stats.totalRevenue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })}`,
        },
        { label: "総注文数", value: stats.totalOrders.toLocaleString() },
        {
            label: "アクティブ店舗",
            value: stats.activeStores.toLocaleString(),
        },
        {
            label: "審査中店舗",
            value: stats.pendingStores.toLocaleString(),
        },
        {
            label: "総ユーザー数",
            value: stats.totalUsers.toLocaleString(),
        },
        {
            label: "総商品数",
            value: stats.totalProducts.toLocaleString(),
        },
        {
            label: "カテゴリ数",
            value: stats.totalCategories.toLocaleString(),
        },
        {
            label: "サブカテゴリ数",
            value: stats.totalSubCategories.toLocaleString(),
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
