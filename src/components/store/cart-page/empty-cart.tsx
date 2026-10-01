import Link from "next/link";
import { ShoppingBag, ArrowUpRight } from "lucide-react";
import styles from "./cart.module.css";

export default function EmptyCart() {
    return (
        <section className={styles.empty}>
            <ShoppingBag
                size={48}
                strokeWidth={1}
                aria-hidden="true"
                className={styles.emptyIcon}
            />
            <h2>Room for something exceptional.</h2>
            <p data-testid="cart-empty-message">
                No items yet? Continue shopping and add items to your cart.
            </p>
            <Link href="/browse" className={styles.primary}>
                Explore items <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
        </section>
    );
}
