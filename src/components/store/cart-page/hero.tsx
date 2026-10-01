import Link from "next/link";
import styles from "./cart.module.css";

export default function CartHero() {
    return (
        <header className={styles.hero}>
            <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
                <Link href="/">Home</Link>
                <span aria-hidden="true">/</span>
                <span aria-current="page">Shopping bag</span>
            </nav>
            <div className={styles.heroContent}>
                <div>
                    <div className={styles.eyebrow}>
                        YOUR CONSIDERED SELECTION
                    </div>
                    <h1>Your shopping bag</h1>
                </div>
                <p>
                    A few exceptional things, chosen by you. Review your pieces
                    before their next chapter.
                </p>
            </div>
        </header>
    );
}
