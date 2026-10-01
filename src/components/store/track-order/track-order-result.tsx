import OrderStatusTag from "@/components/shared/order-status";
import PaymentStatusTag from "@/components/shared/payment-status";
import ProductStatusTag from "@/components/shared/product-status";
import { OrderStatus, PaymentStatus, ProductStatus } from "@/lib/types";
import type { trackOrder } from "@/queries/order";
import Image from "next/image";
import styles from "./track-order.module.css";

// trackOrder の非 null 戻り値（user＝email は除去済み）を型として再利用し、any を避ける。
type TrackOrderResultData = NonNullable<Awaited<ReturnType<typeof trackOrder>>>;

/**
 * Renders the order tracking result, including order and payment status, shipping details for each store group, and per-item product status.
 *
 * @param order - The tracked order data to display.
 */
export default function TrackOrderResult({
    order,
}: {
    order: TrackOrderResultData;
}) {
    return (
        <section className={styles.result} aria-label="注文追跡の結果">
            <div className={styles.resultHeading}>
                <h2 className={styles.orderId}>注文 #{order.id}</h2>
                <OrderStatusTag status={order.orderStatus as OrderStatus} />
                <PaymentStatusTag
                    status={order.paymentStatus as PaymentStatus}
                />
            </div>

            <ul className="space-y-6">
                {order.groups.map((group) => (
                    <li key={group.id} className={styles.group}>
                        <div className={styles.groupHeading}>
                            <h3 className="font-medium">{group.store.name}</h3>
                            <p className={styles.shipping}>
                                {group.shippingService}（お届け予定:{" "}
                                {group.shippingDeliveryMin}〜
                                {group.shippingDeliveryMax}日）
                            </p>
                        </div>

                        <ul className="divide-y">
                            {group.items.map((item) => (
                                <li key={item.id} className={styles.item}>
                                    <Image
                                        src={item.image}
                                        alt={item.name}
                                        width={48}
                                        height={48}
                                        className="size-12 rounded object-cover"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className={styles.productName}>
                                            {item.name}
                                        </p>
                                        <p className={styles.shipping}>
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
