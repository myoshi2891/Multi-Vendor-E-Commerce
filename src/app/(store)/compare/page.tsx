import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import CompareGrid from "@/components/store/compare/compare-grid";
import { getProductsByIds } from "@/queries/product";
import styles from "@/components/store/compare/compare.module.css";

export const metadata: Metadata = { title: "Compare | Luxuries" };

export default function ComparePage() {
    return (
        <main className={styles.page}>
            <header className={styles.hero}>
                <div className={styles.heroInner}>
                    <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
                        <Link href="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        <span>Compare</span>
                    </nav>
                    <div className={styles.heroContent}>
                        <div>
                            <p className={styles.eyebrow}>
                                THE ART OF CHOOSING
                            </p>
                            <h1>Compare products</h1>
                        </div>
                        <p className={styles.intro}>
                            A closer look, side by side.
                            <br />
                            Bring together up to four pieces and find the one
                            that feels right.
                        </p>
                    </div>
                    <div className={styles.heroFoot}>
                        <span>YOUR SELECTION, IN PERSPECTIVE</span>
                        <Link href="/browse">
                            Continue exploring{" "}
                            <ArrowUpRight size={15} aria-hidden="true" />
                        </Link>
                    </div>
                </div>
            </header>
            <section
                className={styles.selection}
                aria-label="Product comparison"
            >
                <CompareGrid fetchProductsAction={getProductsByIds} />
            </section>
        </main>
    );
}
