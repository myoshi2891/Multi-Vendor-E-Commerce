import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import SupportForm from "@/components/store/support/support-form";
import { createSupportTicket } from "@/queries/support";
import styles from "./contact.module.css";

export const metadata: Metadata = {
    title: "Contact | Luxuries for Happiness",
    description: "Luxuries for Happiness へのお問い合わせ。サービスについてのご質問や、お買い物に関するご相談をお寄せください。",
};

/** お問い合わせフォーム。公開（ゲスト可）。DB 書込は server action 側のため force-dynamic 不要。 */
export default function ContactPage() {
    return (
        <main className={styles.contact}>
            <header className={styles.hero}>
                <div className={styles.heroInner}>
                    <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
                        <Link href="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page">Contact</span>
                    </nav>
                    <div className={styles.heroCopy}>
                        <p className={styles.eyebrow}>WE’RE HERE FOR YOU</p>
                        <h1>Contact <em>us</em></h1>
                        <p lang="ja" className={styles.japanese}>あなたの声を、お聞かせください。</p>
                        <p lang="ja" className={styles.description}>
                            お買い物のご相談から、サービスについてのご質問まで。<br />
                            小さなことでも、お気軽にお問い合わせください。
                        </p>
                    </div>
                    <span className={styles.heroStar} aria-hidden="true">✦</span>
                    <div className={styles.heroFoot}>
                        <a href="#contact-form">Get in touch <ArrowDown size={14} aria-hidden="true" /></a>
                        <span>A LITTLE CARE. A LOT OF HAPPINESS.</span>
                    </div>
                </div>
            </header>

            <div className={styles.content}>
                <aside className={styles.help} aria-labelledby="contact-help-title">
                    <p className={styles.eyebrow}>A THOUGHTFUL CONNECTION</p>
                    <h2 id="contact-help-title">Let’s start a<br />{" "}<em>conversation.</em></h2>
                    <p lang="ja" className={styles.helpDescription}>ご相談の内容をフォームにご記入ください。<br />担当よりメールでご連絡します。</p>
                    <nav aria-label="お問い合わせに役立つページ" className={styles.helpLinks}>
                        <Link href="/faqs"><span><span className={styles.linkTitle}>Frequently asked questions</span><span lang="ja">よくあるご質問</span></span><ArrowUpRight size={17} aria-hidden="true" /></Link>
                        <Link href="/track-order"><span><span className={styles.linkTitle}>Track your order</span><span lang="ja">ご注文の配送状況</span></span><ArrowUpRight size={17} aria-hidden="true" /></Link>
                        <Link href="/customer-service"><span><span className={styles.linkTitle}>Customer service</span><span lang="ja">その他のサポート窓口</span></span><ArrowUpRight size={17} aria-hidden="true" /></Link>
                    </nav>
                </aside>

                <section id="contact-form" className={styles.formPanel} aria-labelledby="contact-form-title">
                    <div className={styles.formHeading}>
                        <span className={styles.eyebrow}>YOUR MESSAGE</span>
                        <h2 id="contact-form-title">Send us a note.</h2>
                        <p lang="ja">すべての項目をご入力ください。</p>
                    </div>
                    <SupportForm submitAction={createSupportTicket} category="CONTACT" submitLabel="Send message ↗" />
                    <p className={styles.formNote} lang="ja">ご返信のため、受信可能なメールアドレスをご入力ください。</p>
                </section>
            </div>
        </main>
    );
}
