import Link from "next/link";
import styles from "./reviews.module.css";

export default function ReviewsHeading() {
    return (
        <header className={styles.heading}>
            <div>
                <p className={styles.eyebrow}>YOUR WORDS, SHARED WITH CARE</p>
                <h1>My reviews</h1>
                <p lang="ja" className={styles.description}>
                    お気に入りとの出会いを、あなたの言葉で。
                </p>
            </div>
            <Link href="/customer-service" className={styles.support}>
                Need a hand? →
            </Link>
        </header>
    );
}
