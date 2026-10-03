import Link from "next/link";
import styles from "./payments.module.css";

export default function PaymentsHeading() {
    return (
        <header className={styles.heading}>
            <div>
                <p className={styles.eyebrow}>
                    THE DETAILS BEHIND EVERY DISCOVERY
                </p>
                <h1>My payments</h1>
                <p lang="ja" className={styles.description}>
                    お買い物のお支払いと、その記録をひと目で。
                </p>
            </div>
            <Link href="/customer-service" className={styles.support}>
                Need a hand? →
            </Link>
        </header>
    );
}
