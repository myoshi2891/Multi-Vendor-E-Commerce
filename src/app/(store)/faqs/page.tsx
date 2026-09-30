import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { FAQ_SECTIONS } from "@/components/store/static/content/faqs";
import styles from "./faqs.module.css";

export const metadata: Metadata = {
    title: "FAQs | Luxuries for Happiness",
    description: "ご注文・配送・お支払い・返品に関するよくあるご質問。",
};

const supportLinks = [
    { title: "Contact us", label: "お問い合わせ", href: "/contact" },
    { title: "Track your order", label: "配送状況の確認", href: "/track-order" },
    { title: "Returns & Exchange", label: "返品・交換のご案内", href: "/returns-exchange" },
    { title: "Customer service", label: "サポート窓口", href: "/customer-service" },
];
const questions = FAQ_SECTIONS.map((section, index) => ({
    ...section,
    id: `faq-${index + 1}`,
    number: String(index + 1).padStart(2, "0"),
}));

/** 公開FAQ。既存の質問・回答定数をplain textで常時表示する。 */
export default function FaqsPage() {
    return (
        <main className={styles.faqs}>
            <header className={styles.hero}>
                <div className={styles.heroInner}>
                    <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
                        <Link href="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page">FAQs</span>
                    </nav>
                    <div className={styles.heroCopy}>
                        <p className={styles.eyebrow}>A LITTLE GUIDANCE</p>
                        <h1>FAQs</h1>
                        <p lang="ja" className={styles.subtitle}>よくあるご質問</p>
                        <p lang="ja" className={styles.description}>心地よいお買い物のために。<br />ご注文からお届けまでの疑問に、お答えします。</p>
                    </div>
                    <span className={styles.star} aria-hidden="true">✦</span>
                    <div className={styles.heroFoot}>
                        <a href="#questions">Explore the answers <ArrowDown size={14} aria-hidden="true" /></a>
                        <span>A LITTLE CARE. A LOT OF HAPPINESS.</span>
                    </div>
                </div>
            </header>
            <div className={styles.content}>
                <aside className={styles.guide}>
                    <p className={styles.eyebrow}>YOUR QUESTIONS, ANSWERED</p>
                    <h2>How can we <em>help?</em></h2>
                    <nav aria-label="質問一覧" className={styles.questionNav} lang="ja">
                        {questions.map((question) => (
                            <a key={question.id} href={`#${question.id}`}>
                                <span aria-hidden="true">{question.number}</span>
                                {question.heading}
                                <ArrowDown size={14} aria-hidden="true" />
                            </a>
                        ))}
                    </nav>
                </aside>
                <div id="questions" className={styles.questions} lang="ja">
                    {questions.map((question) => (
                        <section key={question.id} id={question.id} aria-labelledby={`${question.id}-title`} className={styles.question}>
                            <span className={styles.number} aria-hidden="true">{question.number}</span>
                            <div>
                                <h2 id={`${question.id}-title`}>{question.heading}</h2>
                                {question.body.split("\n\n").map((paragraph, index) => (
                                    <p key={`${question.id}-${index}`}>{paragraph}</p>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
            <section className={styles.support} aria-labelledby="faq-support-title">
                <div className={styles.supportCopy}>
                    <p className={styles.eyebrow}>HERE FOR YOU</p>
                    <h2 id="faq-support-title">Still have <em>questions?</em></h2>
                    <p lang="ja">解決しないときは、こちらからご相談ください。</p>
                </div>
                <nav aria-label="サポートページ" className={styles.supportLinks}>
                    {supportLinks.map((link) => (
                        <Link key={link.href} href={link.href}>
                            <span><span className={styles.linkTitle}>{link.title}</span><span lang="ja">{link.label}</span></span>
                            <ArrowUpRight size={18} aria-hidden="true" />
                        </Link>
                    ))}
                </nav>
            </section>
        </main>
    );
}
