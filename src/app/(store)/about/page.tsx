import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { ABOUT_SECTIONS } from "@/components/store/static/content/about";
import styles from "./about.module.css";

export const metadata: Metadata = {
    title: "About | Luxuries for Happiness",
    description: "日常に、心ときめくひとつを。Luxuries for Happiness のマーケットプレイスと私たちの想いをご紹介します。",
};

/** 運営会社情報・プラットフォーム紹介の静的ページ。DB 非依存のため force-dynamic 不要。 */
export default function AboutPage() {
    return (
        <main className={styles.about}>
            <header className={styles.hero}>
                <div className={styles.heroInner}>
                    <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
                        <Link href="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page">About</span>
                    </nav>
                    <div className={styles.heroGrid}>
                        <div className={styles.heroCopy}>
                            <p className={styles.eyebrow}>THE STORY BEHIND LUXURIES</p>
                            <h1>About</h1>
                            <p className={styles.tagline}>A little luxury.<br /><em>A lot of happiness.</em></p>
                            <p lang="ja" className={styles.japanese}>贅沢は、幸せのきっかけ。</p>
                            <p lang="ja" className={styles.heroDescription}>
                                心ときめくものとの出会いが、いつもの日常を少し特別にする。<br />
                                私たちは、そんな買い物の楽しさを届けたいと考えています。
                            </p>
                        </div>
                        <div className={styles.artwork} aria-hidden="true">
                            <Image src="/assets/brand/gem.svg" alt="" fill priority sizes="(max-width: 700px) 88vw, 45vw" />
                            <span className={styles.artworkCaption}>LUXURY · FORTUNE · HAPPINESS</span>
                        </div>
                    </div>
                    <div className={styles.heroFoot}>
                        <a href="#our-story">Discover our story <ArrowDown size={14} aria-hidden="true" /></a>
                        <span>THOUGHTFUL CONNECTIONS, EVERY DAY</span>
                    </div>
                </div>
            </header>

            <div id="our-story" className={styles.story}>
                {ABOUT_SECTIONS.map((section, index) => (
                    <section key={section.heading} className={styles.section} aria-labelledby={`about-section-${index}`}>
                        <div className={styles.sectionHeading}>
                            <span className={styles.sectionNumber}>0{index + 1}</span>
                            <h2 id={`about-section-${index}`}>{section.heading}</h2>
                        </div>
                        <div className={styles.sectionBody}>
                            <p className={styles.sectionLead} lang="ja">
                                {index === 0 ? "出会いをつなぐ、マーケットプレイス。" : index === 1 ? "買い物に、心ときめく体験を。" : "いつでも、お気軽に。"}
                            </p>
                            {section.body.split("\n\n").map((paragraph, paragraphIndex) => (
                                <p key={paragraphIndex} lang="ja">{paragraph}</p>
                            ))}
                            {index === 2 && (
                                <Link href="/customer-service" className={styles.textLink}>Customer service <ArrowUpRight size={16} aria-hidden="true" /></Link>
                            )}
                        </div>
                    </section>
                ))}
            </div>

            <section className={styles.invitation} aria-labelledby="about-invitation-title">
                <span className={styles.star} aria-hidden="true">✦</span>
                <p className={styles.eyebrow}>YOUR NEXT DISCOVERY</p>
                <h2 id="about-invitation-title">Find your little <em>luxury.</em></h2>
                <p lang="ja">あなたの日常に、心ときめくひとつを。</p>
                <Link href="/browse" className={styles.cta}>Explore the collection <ArrowUpRight size={16} aria-hidden="true" /></Link>
            </section>
        </main>
    );
}
