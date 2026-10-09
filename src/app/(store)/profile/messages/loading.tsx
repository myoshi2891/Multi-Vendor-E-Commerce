import MessagesHeading from "@/components/store/profile/messages/messages-heading";
import styles from "@/components/store/profile/messages/messages.module.css";
export default function MessagesLoading() {
    return (
        <section
            className={`${styles.messages} ${styles.buyer}`}
            data-messages
            aria-label="Message management"
            aria-busy="true"
        >
            <MessagesHeading />
            <div className={styles.message} role="status">
                <p>Loading conversations…</p>
                <div className={styles.skeleton} aria-hidden="true" />
            </div>
        </section>
    );
}
