import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { PRODUCT_SUPPORT_SECTIONS } from "@/components/store/static/content/product-support";
import styles from "./product-support.module.css";

export const metadata: Metadata = {
    title: "Product support | Luxuries for Happiness",
    description: "購入後の技術サポートとトラブルシューティング。",
};

const sections = PRODUCT_SUPPORT_SECTIONS.map((section, index) => ({
    ...section,
    id: `support-${index + 1}`,
    number: String(index + 1).padStart(2, "0"),
}));
const supportLinks = [
    {
        title: "Customer service",
        description: "サポート窓口",
        href: "/customer-service",
    },
    { title: "Contact us", description: "お問い合わせ", href: "/contact" },
    {
        title: "Returns & Exchange",
        description: "返品・交換のご案内",
        href: "/returns-exchange",
    },
    {
        title: "Track your order",
        description: "配送状況の確認",
        href: "/track-order",
    },
];

/** 公開の製品サポート。既存本文をplain textで表示する。 */
export default function ProductSupportPage() {
    return (
        <main className={styles.page}>
            <header className={styles.hero}>
                <div className={styles.heroInner}>
                    <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
                        <Link href="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page">Product support</span>
                    </nav>
                    <p className={styles.eyebrow}>
                        A LITTLE CARE, BEYOND THE PURCHASE
                    </p>
                    <h1>
                        Product <em>support.</em>
                    </h1>
                    <p className={styles.subtitle} lang="ja">
                        お気に入りと、長く心地よく。
                    </p>
                    <span className={styles.star} aria-hidden="true">
                        ✦
                    </span>
                </div>
            </header>
            <div className={styles.content}>
                <aside className={styles.guide}>
                    <p className={styles.eyebrow}>HERE FOR YOUR EVERYDAY</p>
                    <h2>
                        A little guidance.
                        <br />
                        <em>Lasting happiness.</em>
                    </h2>
                    <p className={styles.description} lang="ja">
                        使い始めのこと、お困りのこと。
                        <br />
                        ご購入後のサポートをご案内します。
                    </p>
                    <nav
                        aria-label="サポート内容一覧"
                        className={styles.sectionNav}
                        lang="ja"
                    >
                        {sections.map((section) => (
                            <a key={section.id} href={`#${section.id}`}>
                                <span aria-hidden="true">{section.number}</span>
                                {section.heading}
                                <ArrowDown size={14} aria-hidden="true" />
                            </a>
                        ))}
                    </nav>
                </aside>
                <div className={styles.sections} lang="ja">
                    {sections.map((section) => (
                        <section
                            key={section.id}
                            id={section.id}
                            className={styles.section}
                            aria-labelledby={`${section.id}-title`}
                        >
                            <span className={styles.number} aria-hidden="true">
                                {section.number}
                            </span>
                            <div>
                                <h2 id={`${section.id}-title`}>
                                    {section.heading}
                                </h2>
                                {section.body.split("\n\n").map((paragraph) => (
                                    <p key={paragraph}>{paragraph}</p>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
            <section
                className={styles.support}
                aria-labelledby="product-support-contact-title"
            >
                <div className={styles.supportCopy}>
                    <p className={styles.eyebrow}>WE ARE HERE TO HELP</p>
                    <h2 id="product-support-contact-title">
                        Need a little
                        <br />
                        <em>more help?</em>
                    </h2>
                    <p className={styles.description} lang="ja">
                        解決しないときは、こちらからご相談ください。
                    </p>
                </div>
                <nav aria-label="サポート窓口" className={styles.supportLinks}>
                    {supportLinks.map((link) => (
                        <Link key={link.href} href={link.href}>
                            <span>
                                <span className={styles.linkTitle}>
                                    {link.title}
                                </span>
                                <span lang="ja">{link.description}</span>
                            </span>
                            <ArrowUpRight size={18} aria-hidden="true" />
                        </Link>
                    ))}
                </nav>
            </section>
        </main>
    );
}
