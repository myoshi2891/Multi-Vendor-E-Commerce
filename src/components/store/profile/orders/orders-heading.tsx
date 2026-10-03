import Link from "next/link";
import styles from "./orders.module.css";

export default function OrdersHeading() {
    return (
        <header className={styles.heading}>
            <div>
                <p className={styles.eyebrow}>YOUR COLLECTION, IN MOTION</p>
                <h1>My orders</h1>
                <p lang="ja" className={styles.description}>
                    これまでのお買い物と、お届けまでの歩みをここに。
                </p>
            </div>
            <Link href="/customer-service" className={styles.support}>
                Need a hand? →
            </Link>
        </header>
    );
}
