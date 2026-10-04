import styles from "../../shared/commerce.module.css";
export default function OrderTotalDetailsCard({
    details,
}: {
    details: { subTotal: number; shippingFees: number; total: number };
}) {
    return (
        <section
            className={styles.summary}
            data-testid="order-total"
            aria-labelledby="order-summary"
        >
            <h2 id="order-summary">Order summary</h2>
            <dl>
                <div className={styles.row}>
                    <dt>Subtotal</dt>
                    <dd>${details.subTotal.toFixed(2)}</dd>
                </div>
                <div className={styles.row}>
                    <dt>Shipping Fee</dt>
                    <dd>+${details.shippingFees.toFixed(2)}</dd>
                </div>
                <div className={styles.row}>
                    <dt>Taxes</dt>
                    <dd>+$0.00</dd>
                </div>
                <div className={`${styles.row} ${styles.total}`}>
                    <dt>Total</dt>
                    <dd>${details.total.toFixed(2)}</dd>
                </div>
            </dl>
        </section>
    );
}
