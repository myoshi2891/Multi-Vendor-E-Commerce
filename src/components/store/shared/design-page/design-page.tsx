import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./design-page.module.css";

/** Public editorial frame, scoped to opt-in pages. */
export default function DesignPage({ title, eyebrow, description, children }: {
    title: string; eyebrow: string; description: string; children: ReactNode;
}) {
    return <main className={styles.page}>
        <header className={styles.hero}>
            <div className={styles.inner}>
                <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
                    <Link href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">{title}</span>
                </nav>
                <p className={styles.eyebrow}>{eyebrow}</p>
                <h1>{title}</h1>
                <p className={styles.description}>{description}</p>
            </div>
        </header>
        <div className={styles.content}>{children}</div>
    </main>;
}
