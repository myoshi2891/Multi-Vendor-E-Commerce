import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import styles from "./wishlist.module.css";

export default function WishlistHeading() {
    return (
        <header className={styles.heading}>
            <div>
                <p className={styles.eyebrow}>SAVED FOR A LITTLE LATER</p>
                <h1>Your Wishlist</h1>
                <p lang="ja" className={styles.description}>
                    心に留めたものを、いつでもここから。
                </p>
            </div>
            <Link href="/browse" className={styles.collection}>
                The collection <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
        </header>
    );
}
