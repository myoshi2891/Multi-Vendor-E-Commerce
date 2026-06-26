import OrderStatusTag from "@/components/shared/order-status";
import PaymentStatusTag from "@/components/shared/payment-status";
import ProductStatusTag from "@/components/shared/product-status";
import { OrderStatus, PaymentStatus, ProductStatus } from "@/lib/types";
import { trackOrder } from "@/queries/order";
import Image from "next/image";

// trackOrder の非 null 戻り値（user＝email は除去済み）を型として再利用し、any を避ける。
type TrackOrderResultData = NonNullable<
    Awaited<ReturnType<typeof trackOrder>>
>;

/**
 * 注文追跡の結果表示。注文全体のステータス（orderStatus / paymentStatus）と、
 * 店舗グループ単位の配送サービス・配送予定日数、各アイテムの商品ステータスを描画する。
 *
 * DB enum（@prisma/client）は @/lib/types の enum と同値の文字列のため、共有タグへ
 * 渡す際に as でキャストする（order-page/header.tsx と同型）。
 */
export default function TrackOrderResult({
    order,
}: {
    order: TrackOrderResultData;
}) {
    return (
        <section className="mt-8 space-y-6" aria-label="注文追跡の結果">
            <div className="flex flex-wrap items-center gap-3 border-b pb-4">
                <h2 className="text-lg font-semibold">注文 #{order.id}</h2>
                <OrderStatusTag status={order.orderStatus as OrderStatus} />
                <PaymentStatusTag
                    status={order.paymentStatus as PaymentStatus}
                />
            </div>

            <ul className="space-y-6">
                {order.groups.map((group) => (
                    <li
                        key={group.id}
                        className="rounded-lg border p-4 shadow-sm"
                    >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-medium">{group.store.name}</h3>
                            <p className="text-sm text-muted-foreground">
                                {group.shippingService}（お届け予定:{" "}
                                {group.shippingDeliveryMin}〜
                                {group.shippingDeliveryMax}日）
                            </p>
                        </div>

                        <ul className="divide-y">
                            {group.items.map((item) => (
                                <li
                                    key={item.id}
                                    className="flex items-center gap-3 py-3"
                                >
                                    <Image
                                        src={item.image}
                                        alt={item.name}
                                        width={48}
                                        height={48}
                                        className="size-12 rounded object-cover"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium">
                                            {item.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            数量: {item.quantity}
                                        </p>
                                    </div>
                                    <ProductStatusTag
                                        status={item.status as ProductStatus}
                                    />
                                </li>
                            ))}
                        </ul>
                    </li>
                ))}
            </ul>
        </section>
    );
}
