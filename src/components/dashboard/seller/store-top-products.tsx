import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import type { getStoreTopProducts } from "@/queries/store-dashboard";

type StoreTopProduct = Awaited<
    ReturnType<typeof getStoreTopProducts>
>[number];

interface Props {
    products: StoreTopProduct[];
}

/**
 * 店舗の販売数（sales）上位商品を一覧表示するカード（F1）。
 *
 * admin の RecentStores（src/components/dashboard/admin/recent-stores.tsx）のリスト構造を派生し、
 * 商品名と販売数を表示する。商品が無い場合はメッセージを表示する（AC-F1-5）。
 */
export function StoreTopProducts({ products }: Props) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>販売上位商品</CardTitle>
            </CardHeader>
            <CardContent>
                {products.length === 0 ? (
                    <p className="text-sm text-muted-foreground">商品がありません。</p>
                ) : (
                    <ul className="space-y-3">
                        {products.map((product) => (
                            <li
                                key={product.id}
                                className="flex items-center justify-between text-sm"
                            >
                                <span className="truncate font-medium">
                                    {product.name}
                                </span>
                                <span className="shrink-0 text-xs text-muted-foreground">
                                    {product.sales.toLocaleString()} 件販売
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
}
