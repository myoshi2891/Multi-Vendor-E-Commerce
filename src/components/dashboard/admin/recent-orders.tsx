import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { toNumberSafe } from "@/lib/utils";
import type { getRecentOrders } from "@/queries/dashboard";

type RecentOrder = Awaited<ReturnType<typeof getRecentOrders>>[number];

interface Props {
    orders: RecentOrder[];
}

export function RecentOrders({ orders }: Props) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>最近の注文</CardTitle>
            </CardHeader>
            <CardContent>
                {orders.length === 0 ? (
                    <p className="text-sm text-muted-foreground">注文がありません。</p>
                ) : (
                    <ul className="space-y-3">
                        {orders.map((order) => (
                            <li
                                key={order.id}
                                className="flex items-center justify-between text-sm"
                            >
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-mono text-xs text-muted-foreground">
                                        #{order.id.slice(0, 8)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {order.createdAt.toLocaleDateString("ja-JP")}
                                    </span>
                                </div>
                                <span className="font-semibold">
                                    $
                                    {toNumberSafe(order.total).toLocaleString("en-US", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
