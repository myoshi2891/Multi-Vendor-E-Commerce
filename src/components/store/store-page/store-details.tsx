import { StoreDetailsType } from "@/lib/types";
import { ArrowDownRight, Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import styles from "./store-page.module.css";

export default function StoreDetails({ details }: { details: StoreDetailsType }) {
    const { averageRating, cover, description, logo, name, numReviews } = details;
    return (
        <header className={styles.hero}>
            <div className={styles.heroInner}>
                <nav className={styles.breadcrumb} aria-label="Breadcrumb">
                    <Link href="/">Home</Link><span aria-hidden="true">/</span>
                    <Link href="/browse">The collection</Link><span aria-hidden="true">/</span>
                    <span aria-current="page">{name}</span>
                </nav>
                <div className={styles.heroLayout}>
                    <div className={styles.identity}>
                        <p className={styles.eyebrow}>MEET THE STORE</p>
                        <h1>{name}<span>.</span></h1>
                        <div id="store-about" className={styles.storeProfile}>
                            <Image src={logo} alt={`${name} logo`} width={64} height={64} className={styles.logo} />
                            <div className={styles.profileCopy}>
                                <p className={styles.profileLabel}>ABOUT THE STORE</p>
                                {description && <p className={styles.description}>{description}</p>}
                            </div>
                        </div>
                        <div className={styles.rating}>
                            <Star size={15} aria-hidden="true" />
                            {numReviews > 0 ? (
                                <><span className={styles.ratingValue}>{averageRating.toFixed(1)} / 5</span><span>{new Intl.NumberFormat().format(numReviews)} {numReviews === 1 ? "review" : "reviews"}</span></>
                            ) : <span>No reviews yet</span>}
                        </div>
                        <a href="#collection" className={styles.collectionLink}>Explore the collection <ArrowDownRight size={18} aria-hidden="true" /></a>
                    </div>
                    <div className={styles.coverFrame}>
                        <Image src={cover} alt={`${name} cover`} fill sizes="(max-width: 850px) 88vw, 50vw" className={styles.cover} priority />
                        <span className={styles.coverCaption}>A LITTLE DISCOVERY, A LITTLE HAPPINESS.</span>
                    </div>
                </div>
                <div className={styles.heroFoot}><span>THE COLLECTION / {name}</span><span lang="ja">心ときめく出会いを、このお店から。</span></div>
            </div>
        </header>
    );
}
