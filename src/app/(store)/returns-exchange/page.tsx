import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, RotateCcw } from "lucide-react";
import SupportForm from "@/components/store/support/support-form";
import { RETURNS_POLICY_SUMMARY } from "@/components/store/static/content/returns";
import { createSupportTicket } from "@/queries/support";
import styles from "./returns-exchange.module.css";

export const metadata: Metadata = {
    title: "Returns & Exchange | Luxuries for Happiness",
    description:
        "返品・交換のご案内と申請フォーム。対象の注文番号を添えてお申し込みください。",
};

/** 既存ポリシーを静的表示し、公開申請actionをフォームへ渡す。 */
export default function ReturnsExchangePage() {
    return (
        <main className={styles.page}>
            <header className={styles.hero}>
                <div className={styles.heroInner}>
                    <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
                        <Link href="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page">Returns &amp; Exchange</span>
                    </nav>
                    <p className={styles.eyebrow}>
                        WITH YOUR HAPPINESS IN MIND
                    </p>
                    <h1>
                        Returns &amp;
                        <br />
                        <em>Exchange.</em>
                    </h1>
                    <p className={styles.subtitle} lang="ja">
                        心地よいお買い物の、その先も。
                    </p>
                    <span className={styles.star} aria-hidden="true">
                        ✦
                    </span>
                </div>
            </header>
            <div className={styles.content}>
                <section
                    className={styles.policy}
                    aria-labelledby="returns-policy-title"
                    lang="ja"
                >
                    <RotateCcw size={28} strokeWidth={1} aria-hidden="true" />
                    <p className={styles.eyebrow}>A LITTLE REASSURANCE</p>
                    <h2 id="returns-policy-title">
                        {RETURNS_POLICY_SUMMARY.title}
                    </h2>
                    <p className={styles.intro}>
                        {RETURNS_POLICY_SUMMARY.intro}
                    </p>
                    <ul className={styles.points}>
                        {RETURNS_POLICY_SUMMARY.points.map((point, index) => (
                            <li key={point}>
                                <span aria-hidden="true">
                                    {String(index + 1).padStart(2, "0")}
                                </span>
                                <p>{point}</p>
                            </li>
                        ))}
                    </ul>
                    <Link
                        href="/customer-service"
                        className={styles.supportLink}
                    >
                        お困りですか？ サポート窓口へ{" "}
                        <ArrowUpRight size={16} aria-hidden="true" />
                    </Link>
                </section>
                <section
                    className={styles.panel}
                    aria-labelledby="returns-form-title"
                    lang="ja"
                >
                    <p className={styles.eyebrow}>LET US HELP</p>
                    <h2 id="returns-form-title">返品・交換の申請</h2>
                    <p className={styles.formIntro}>
                        ご注文番号と申請内容をお知らせください。すべての項目をご入力ください。
                    </p>
                    <SupportForm
                        category="RETURN_REQUEST"
                        submitLabel="返品・交換を申請する"
                        submitAction={createSupportTicket}
                        appearance="brand"
                    />
                </section>
            </div>
        </main>
    );
}
