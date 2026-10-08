import OrderStatusTag from "@/components/shared/order-status";
import { OrderStatus, type OrderGroupWithItemsType } from "@/lib/types";
import Image from "next/image";
import ProductRow from "./product-row";
import styles from "../shared/commerce.module.css";
export default function OrderGroupTable({
    group,
    deliveryInfo,
}: {
    group: OrderGroupWithItemsType;
    deliveryInfo: {
        shippingService: string;
        deliveryMinDate: string;
        deliveryMaxDate: string;
    };
}) {
    const { coupon, couponId, subTotal, total, shippingFees } = group;
    const discountedAmount =
        couponId && coupon
            ? ((subTotal.toNumber() + shippingFees.toNumber()) *
                  coupon.discount) /
              100
            : 0;
    return (
        <article
            className={styles.panel}
            aria-label={`Order group ${group.id}`}
        >
            <div className={styles.groupHeader}>
                <div>
                    <h3>Order Id: #{group.id}</h3>
                    <div className={styles.store}>
                        <Image
                            src={
                                group.store.logo ||
                                "/assets/images/no_image.png"
                            }
                            alt=""
                            width={40}
                            height={40}
                        />
                        <span>{group.store.name}</span>
                    </div>
                </div>
                <OrderStatusTag variant="store" status={group.status as OrderStatus} />
            </div>
            <p className={styles.note}>
                {deliveryInfo.shippingService} · Expected Delivery Time:{" "}
                {deliveryInfo.deliveryMinDate} – {deliveryInfo.deliveryMaxDate}
            </p>
            {group.items.map((product) => (
                <ProductRow key={product.id} product={product} />
            ))}
            <dl>
                <div className={styles.row}>
                    <dt>Subtotal</dt>
                    <dd>${subTotal.toNumber().toFixed(2)}</dd>
                </div>
                <div className={styles.row}>
                    <dt>Shipping Fees</dt>
                    <dd>${shippingFees.toNumber().toFixed(2)}</dd>
                </div>
                {couponId && (
                    <div className={styles.row}>
                        <dt>
                            Coupon ({coupon?.code}) (-{coupon?.discount}%)
                        </dt>
                        <dd>-${discountedAmount.toFixed(2)}</dd>
                    </div>
                )}
                <div className={`${styles.row} ${styles.total}`}>
                    <dt>Total price</dt>
                    <dd>${total.toNumber().toFixed(2)}</dd>
                </div>
            </dl>
            <button
                className={styles.secondary}
                disabled
                aria-describedby={`cancel-${group.id}`}
            >
                Cancel Order
            </button>
            <p id={`cancel-${group.id}`} className={styles.note}>
                Cancellation is not available here.
            </p>
        </article>
    );
}
