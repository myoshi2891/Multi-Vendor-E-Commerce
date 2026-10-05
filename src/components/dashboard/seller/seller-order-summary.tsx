"use client";
import Image from "next/image";
import { OrderStatus, ProductStatus } from "@/lib/types";
import type { SellerOrderRow, SellerOrderActions } from "@/lib/seller-orders";
import StatusEditor from "./status-editor";
import styles from "../design/seller.module.css";
export default function SellerOrderSummary({
    order,
    actions,
}: {
    order: SellerOrderRow;
    actions: SellerOrderActions;
}) {
    return (
        <div className="space-y-6 text-left">
            <p>
                #{order.id} · {order.paymentStatus} · ${order.total.toFixed(2)}
            </p>
            <StatusEditor
                label={`Order status ${order.id}`}
                initialStatus={order.status}
                options={Object.values(OrderStatus)}
                saveAction={(value) =>
                    actions.updateGroupAction(
                        order.storeId,
                        order.id,
                        value as OrderStatus
                    )
                }
            />
            <dl className={styles.grid}>
                {[
                    ["Shipping service", order.shippingService],
                    ["Expected delivery date", order.deliveryRange],
                    ["Payment method", order.paymentMethod],
                    ["Payment reference", order.paymentReference],
                    ["Address", order.address],
                    ["Customer", order.customer],
                ].map(([label, value]) => (
                    <div key={label}>
                        <dt className="text-sm text-muted-foreground">
                            {label}
                        </dt>
                        <dd className="mt-1">{value}</dd>
                    </div>
                ))}
            </dl>
            <section aria-label="Order items" className="space-y-4">
                {order.items.map((item) => (
                    <article key={item.id} className={styles.panel}>
                        <div className="flex flex-wrap items-start gap-4">
                            {item.image ? (
                                <Image
                                    src={item.image}
                                    alt={item.name}
                                    width={96}
                                    height={96}
                                    className="h-24 w-24 object-cover"
                                />
                            ) : (
                                <span>No image</span>
                            )}
                            <div className="min-w-0 flex-1">
                                <h2 className="text-xl">{item.name}</h2>
                                <p>
                                    SKU: {item.sku} · Size: {item.size} ·
                                    Quantity: {item.quantity}
                                </p>
                                <p>
                                    Price: ${item.price.toFixed(2)} · Shipping
                                    fee: ${item.shippingFee.toFixed(2)}
                                </p>
                                <p>Total: ${item.totalPrice.toFixed(2)}</p>
                            </div>
                        </div>
                        <div className="mt-4">
                            <StatusEditor
                                label={`Item status ${item.id}`}
                                initialStatus={item.status}
                                options={Object.values(ProductStatus)}
                                saveAction={(value) =>
                                    actions.updateItemAction(
                                        order.storeId,
                                        item.id,
                                        value as ProductStatus
                                    )
                                }
                            />
                        </div>
                    </article>
                ))}
            </section>
        </div>
    );
}
