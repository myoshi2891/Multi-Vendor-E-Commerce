import PaymentsHeading from "@/components/store/profile/payments/payments-heading";
import styles from "@/components/store/profile/payments/payments.module.css";

export default function PaymentLoading() {
    return (
        <section
            className={styles.payments}
            data-payments
            aria-label="Payment history"
            aria-busy="true"
        >
            <PaymentsHeading />
            <div className={styles.message} role="status">
                <p>Loading payments…</p>
                <div className={styles.skeleton} aria-hidden="true" />
            </div>
        </section>
    );
}
