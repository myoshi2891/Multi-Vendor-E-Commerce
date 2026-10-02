import Link from "next/link";
import styles from "./addresses.module.css";

export default function AddressesHeading() {
    return (
        <header className={styles.heading}>
            <div>
                <p className={styles.eyebrow}>
                    A PLACE FOR YOUR NEXT DISCOVERY
                </p>
                <h1>My shipping addresses</h1>
                <p lang="ja" className={styles.description}>
                    お気に入りのお届け先を、ここに。
                </p>
            </div>
            <Link href="/customer-service" className={styles.support}>
                Need a hand? →
            </Link>
        </header>
    );
}
