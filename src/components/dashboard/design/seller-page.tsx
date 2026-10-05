import type { ReactNode } from "react";
import styles from "./seller.module.css";
export default function SellerPage({
    id,
    title,
    description,
    children,
}: {
    id: string;
    title: string;
    description?: string;
    children: ReactNode;
}) {
    return (
        <section className={styles.page} aria-labelledby={id}>
            <header className={styles.heading}>
                <p className={styles.eyebrow}>Seller workspace</p>
                <h1 id={id}>{title}</h1>
                {description && (
                    <p className={styles.description}>{description}</p>
                )}
            </header>
            {children}
        </section>
    );
}
export function SellerLoading() {
    return (
        <div className={styles.panel} role="status" aria-live="polite">
            Loading store information…
        </div>
    );
}
