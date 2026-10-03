import Link from "next/link";
import styles from "./messages.module.css";
export default function MessagesHeading() {
    return (
        <header className={styles.heading}>
            <div>
                <p className={styles.eyebrow}>A CONVERSATION, WITH CARE</p>
                <h1>My messages</h1>
                <p lang="ja" className={styles.description}>
                    お店とのやりとりを、ひとつの場所に。
                </p>
            </div>
            <Link href="/customer-service" className={styles.support}>
                Need a hand? →
            </Link>
        </header>
    );
}
