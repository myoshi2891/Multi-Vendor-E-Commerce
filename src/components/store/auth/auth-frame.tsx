import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import styles from "./auth.module.css";

const copy = {
    "sign-in": {
        eyebrow: "YOUR LITTLE LUXURIES AWAIT",
        heading: <>Welcome <em>back.</em></>,
        lead: "また、心ときめくひとつに出会うために。",
        description: "お気に入りのアイテムも、これからの出会いも。あなたのアカウントから、続きをお楽しみください。",
        formLabel: "WELCOME TO YOUR ACCOUNT",
    },
    "sign-up": {
        eyebrow: "A NEW CHAPTER OF HAPPINESS",
        heading: <>Begin something <em>special.</em></>,
        lead: "あなたの日常に、小さな贅沢を。",
        description: "気になるアイテムをお気に入りに。個性豊かなストアとの出会いを、あなたのアカウントではじめましょう。",
        formLabel: "YOUR JOURNEY STARTS HERE",
    },
};

export default function AuthFrame({ mode, children }: Readonly<{
    mode: keyof typeof copy;
    children: ReactNode;
}>) {
    const content = copy[mode];

    return (
        <div className={styles.auth}>
            <div className={styles.layout}>
                <section className={styles.story} aria-labelledby="auth-title">
                    <nav className={styles.breadcrumb} aria-label="Breadcrumb">
                        <Link href="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page">{mode === "sign-in" ? "Sign in" : "Sign up"}</span>
                    </nav>
                    <div className={styles.storyCopy}>
                        <p className={styles.eyebrow}>{content.eyebrow}</p>
                        <h2 id="auth-title">{content.heading}</h2>
                        <p lang="ja" className={styles.lead}>{content.lead}</p>
                        <p lang="ja" className={styles.description}>{content.description}</p>
                        <Link href="/browse" className={styles.collectionLink}>Explore the collection <ArrowUpRight size={16} aria-hidden="true" /></Link>
                    </div>
                    <div className={styles.artwork} aria-hidden="true">
                        <Image src="/assets/brand/gem.svg" alt="" fill sizes="(max-width: 800px) 0px, 260px" />
                    </div>
                    <p className={styles.storyFoot}>A LITTLE LUXURY. A LOT OF HAPPINESS.</p>
                </section>

                <div className={styles.formPanel}>
                    <p className={styles.formEyebrow}>{content.formLabel}</p>
                    <div className={styles.widget}>{children}</div>
                    <div className={styles.support}>
                        <p lang="ja">お困りの際は、お気軽にご相談ください。</p>
                        <Link href="/customer-service">Customer service <ArrowUpRight size={14} aria-hidden="true" /></Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
