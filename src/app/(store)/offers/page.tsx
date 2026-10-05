import type { Metadata } from "next";
import Link from "next/link";
import { getAllOfferTags } from "@/queries/offer-tag";
import DesignPage from "@/components/store/shared/design-page/design-page";
import styles from "@/components/store/shared/design-page/design-page.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Discounts & Offers | Marketplace" };

export default async function OffersPage() {
    let offerTags;
    try {
        offerTags = await getAllOfferTags();
    } catch {
        return (
            <DesignPage
                title="Discounts & Offers"
                eyebrow="A LITTLE DISCOVERY"
                description="Explore the latest offers from our collection."
            >
                <section role="alert" className={styles.empty}>
                    <h2>Offers could not be loaded.</h2>
                    <p>Please try again.</p>
                    <a href="/offers">Try again</a>
                </section>
            </DesignPage>
        );
    }
    return (
        <DesignPage
            title="Discounts & Offers"
            eyebrow="A LITTLE DISCOVERY"
            description="Explore the latest offers from our collection."
        >
            {offerTags.length ? (
                <div className={styles.grid}>
                    {offerTags.map((tag) => (
                        <Link
                            key={tag.id}
                            href={`/browse?offer=${tag.url}`}
                            className={styles.card}
                        >
                            <h2>{tag.name}</h2>
                            <p>{tag.products.length} 商品</p>
                            <span>Explore this offer ↗</span>
                        </Link>
                    ))}
                </div>
            ) : (
                <section
                    className={styles.empty}
                    aria-labelledby="offers-empty-title"
                >
                    <h2 id="offers-empty-title">More discoveries await.</h2>
                    <p lang="ja">現在ご紹介できるオファーはありません。</p>
                    <Link href="/browse">Explore the collection</Link>
                </section>
            )}
        </DesignPage>
    );
}
