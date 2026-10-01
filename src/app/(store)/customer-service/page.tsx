import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SUPPORT_LINKS } from "@/components/store/static/content/customer-service";
import styles from "./customer-service.module.css";

export const metadata: Metadata = {
    title: "Customer service | Luxuries for Happiness",
    description:
        "サポート窓口のハブ。お問い合わせ・返品・配送状況・FAQ への入口。",
};

/** 公開サポートハブ。既存5導線を静的に表示する。 */
export default function CustomerServicePage() {
    return (
        <main className={styles.page}>
            <header className={styles.hero}>
                <div className={styles.heroInner}>
                    <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
                        <Link href="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page">Customer service</span>
                    </nav>
                    <p className={styles.eyebrow}>A LITTLE CARE, EVERY STEP</p>
                    <h1>
                        Customer <em>service.</em>
                    </h1>
                    <p className={styles.subtitle} lang="ja">
                        お買い物に、安心を添えて。
                    </p>
                    <span className={styles.star} aria-hidden="true">
                        ✦
                    </span>
                </div>
            </header>
            <div className={styles.content}>
                <aside className={styles.guide}>
                    <p className={styles.eyebrow}>HERE FOR YOU</p>
                    <h2>
                        How can we
                        <br />
                        <em>help you?</em>
                    </h2>
                    <p lang="ja">
                        ご注文からお届け、その先まで。
                        <br />
                        お困りのことに合わせて、サポート窓口をお選びください。
                    </p>
                    <p className={styles.note} lang="ja">
                        ご注文に関するお問い合わせには、注文番号をご用意いただくとスムーズです。
                    </p>
                </aside>
                <nav aria-label="サポートメニュー" className={styles.cards}>
                    {SUPPORT_LINKS.map((entry, index) => (
                        <Link
                            key={entry.href}
                            href={entry.href}
                            className={styles.card}
                        >
                            <span className={styles.number} aria-hidden="true">
                                {String(index + 1).padStart(2, "0")}
                            </span>
                            <div className={styles.cardCopy}>
                                <h2>{entry.title}</h2>
                                <p lang="ja">{entry.description}</p>
                            </div>
                            <ArrowUpRight
                                size={20}
                                strokeWidth={1.5}
                                aria-hidden="true"
                            />
                        </Link>
                    ))}
                </nav>
            </div>
        </main>
    );
}
