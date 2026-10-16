import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, RotateCcw } from "lucide-react";
import SupportForm from "@/components/store/support/support-form";
import { buildReturnsPolicySummary } from "@/components/store/static/content/returns";
import { resolveReturnWindowDays } from "@/lib/returns-policy";
import { createSupportTicket } from "@/queries/support";
import styles from "./returns-exchange.module.css";

// 返品日数は実行時の環境変数 RETURN_WINDOW_DAYS_DEFAULT から読むため、ビルド時の値で固定しない
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
    title: "Returns & Exchange | Luxuries for Happiness",
    description:
        "返品・交換のご案内。ログイン中の方は注文詳細から返品を申請でき、ご相談はフォームから承ります。",
};

/**
 * 返品ポリシーと申請の導線（plan 088 Step 5・design §3）。返品の申請は注文詳細から行い、
 * このページのフォームはゲスト・ポリシー外の「相談」として残す（category は RETURN_REQUEST のまま）。
 */
export default function ReturnsExchangePage() {
    const RETURNS_POLICY_SUMMARY = buildReturnsPolicySummary(
        resolveReturnWindowDays(null)
    );
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
                    <Link href="/profile/orders" className={styles.supportLink}>
                        ご注文履歴から返品を申請する{" "}
                        <ArrowUpRight size={16} aria-hidden="true" />
                    </Link>
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
                    <h2 id="returns-form-title">返品・交換のご相談</h2>
                    <p className={styles.formIntro}>
                        ご注文済みの商品について、ログインせずにお問い合わせの方、期限や対象についてご相談の方はこちらからお送りください。ご注文番号と内容をお知らせください。すべての項目をご入力ください。ご注文前のご質問は
                        <Link href="/contact">お問い合わせフォーム</Link>
                        へお寄せください。
                    </p>
                    <SupportForm
                        category="RETURN_REQUEST"
                        submitLabel="相談を送信する"
                        submitAction={createSupportTicket}
                        appearance="brand"
                    />
                </section>
            </div>
        </main>
    );
}
