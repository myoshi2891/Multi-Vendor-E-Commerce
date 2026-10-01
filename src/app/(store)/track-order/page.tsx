import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Package } from "lucide-react";
import TrackOrderForm from "@/components/store/track-order/track-order-form";
import { trackOrder } from "@/queries/order";
import styles from "@/components/store/track-order/track-order.module.css";

export const metadata: Metadata = {
    title: "Track your order | Luxuries for Happiness",
};

export default function TrackOrderPage() {
    return (
        <main className={styles.page}>
            <header className={styles.hero}>
                <div className={styles.heroInner}>
                    <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
                        <Link href="/">Home</Link>
                        <span aria-hidden="true">/</span>
                        <span aria-current="page">Track your order</span>
                    </nav>
                    <p className={styles.eyebrow}>ON ITS WAY TO YOU</p>
                    <h1>
                        Track your <em>order.</em>
                    </h1>
                    <p lang="ja">お届けまでの、楽しみなひととき。</p>
                    <span className={styles.star} aria-hidden="true">
                        ✦
                    </span>
                </div>
            </header>
            <div className={styles.content}>
                <aside className={styles.guide}>
                    <Package size={28} strokeWidth={1} aria-hidden="true" />
                    <p className={styles.eyebrow}>YOUR ORDER, AT A GLANCE</p>
                    <h2>
                        A little closer
                        <br />
                        to <em>happiness.</em>
                    </h2>
                    <p lang="ja">
                        注文番号とご注文時のメールアドレスを入力してください。
                        <br />
                        ご注文の状況と、店舗ごとの配送情報をご確認いただけます。
                    </p>
                    <p lang="ja">
                        注文番号は、ご注文確認メールに記載されています。
                    </p>
                    <Link href="/customer-service">
                        お困りですか？ サポート窓口へ{" "}
                        <ArrowUpRight size={16} aria-hidden="true" />
                    </Link>
                </aside>
                <section
                    className={styles.panel}
                    aria-labelledby="tracking-form-title"
                    lang="ja"
                >
                    <p className={styles.eyebrow}>ORDER LOOKUP</p>
                    <h2 id="tracking-form-title">配送状況を確認する</h2>
                    <TrackOrderForm lookupAction={trackOrder} />
                </section>
            </div>
        </main>
    );
}
