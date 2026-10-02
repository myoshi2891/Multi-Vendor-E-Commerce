import ReviewsHeading from "@/components/store/profile/reviews/reviews-heading";
import styles from "@/components/store/profile/reviews/reviews.module.css";
export default function ReviewsLoading() {
    return (
        <section
            className={styles.reviews}
            data-reviews
            aria-label="Review history"
            aria-busy="true"
        >
            <ReviewsHeading />
            <div className={styles.message} role="status">
                <p>Loading reviews…</p>
                <div className={styles.skeleton} aria-hidden="true" />
            </div>
        </section>
    );
}
