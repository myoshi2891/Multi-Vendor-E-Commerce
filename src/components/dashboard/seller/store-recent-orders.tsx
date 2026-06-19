import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { toNumberSafe } from "@/lib/utils";
import type { getStoreRecentOrders } from "@/queries/store-dashboard";

type StoreRecentOrder = Awaited<
    ReturnType<typeof getStoreRecentOrders>
>[number];

interface Props {
    orders: StoreRecentOrder[];
}

/**
 * 店舗の直近の注文（OrderGroup 単位）を識別子・日付・合計とともに表示するカード（F1）。
 *
 * admin の RecentOrders（src/components/dashboard/admin/recent-orders.tsx）の派生だが、
 * 入力は Order ではなく店舗スコープの OrderGroup 行（getStoreRecentOrders の戻り値）である。
 * total は Decimal のため toNumberSafe で number 化してから整形する（NFR-3）。
 * 注文が無い場合はメッセージを表示する（AC-F1-5）。
 */
export function StoreRecentOrders({ orders }: Props) {
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
                                        {order.updatedAt.toLocaleDateString("ja-JP")}
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
