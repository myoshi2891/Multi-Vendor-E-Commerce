import WishlistHeading from "@/components/store/profile/wishlist/heading";
import styles from "@/components/store/profile/wishlist/wishlist.module.css";

export default function WishlistLoading() {
    return (
        <div className={styles.wishlist}>
            <WishlistHeading />
            <div className={styles.loading}>
                <p role="status">Loading your wishlist…</p>
                <div className={styles.skeletons} aria-busy="true" aria-hidden="true">
                    {Array.from({ length: 6 }, (_, index) => (
                        <span key={index} />
                    ))}
                </div>
            </div>
        </div>
    );
}
