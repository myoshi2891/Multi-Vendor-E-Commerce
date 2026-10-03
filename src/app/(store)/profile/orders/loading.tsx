import OrdersHeading from "@/components/store/profile/orders/orders-heading";
import styles from "@/components/store/profile/orders/orders.module.css";

export default function OrdersLoading() {
    return (
        <section
            className={styles.orders}
            data-orders
            aria-label="Order history"
            aria-busy="true"
        >
            <OrdersHeading />
            <div className={styles.message} role="status">
                <p>Loading orders…</p>
                <div className={styles.skeleton} aria-hidden="true" />
            </div>
        </section>
    );
}
