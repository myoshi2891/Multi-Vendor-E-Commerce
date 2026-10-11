"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Columns2, X } from "lucide-react";
import { useCompareStore } from "@/compare-store/useCompareStore";
import ProductPrice from "@/components/store/product-page/product-info/product-price";
import type { ProductType } from "@/lib/types";
import styles from "./compare.module.css";

type Props = {
    fetchProductsAction: (
        ids: string[]
    ) => Promise<{ products: ProductType[]; totalPages: number }>;
};

export default function CompareGrid({ fetchProductsAction }: Props) {
    const items = useCompareStore((s) => s.items);
    const removeFromCompare = useCompareStore((s) => s.removeFromCompare);
    const clearCompare = useCompareStore((s) => s.clearCompare);
    const [products, setProducts] = useState<ProductType[]>([]);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const selectionHeading = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        let cancelled = false;
        setFailed(false);
        if (items.length === 0) {
            setProducts([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        void (async () => {
            try {
                const result = await fetchProductsAction(items);
                if (!cancelled) setProducts(result.products);
            } catch (error: unknown) {
                if (error instanceof Error) {
                    console.error(
                        "[Compare:fetch] failed",
                        error.message,
                        error.stack
                    );
                } else {
                    console.error("[Compare:fetch] Unknown error", { error });
                }
                if (!cancelled) {
                    setProducts([]);
                    setFailed(true);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [items, attempt, fetchProductsAction]);

    const renderBody = () => {
        if (items.length === 0) {
            return (
                <div data-testid="compare-empty" className={styles.empty}>
                    <Columns2 size={40} strokeWidth={1} aria-hidden="true" />
                    <h3>A little perspective.</h3>
                    <p>
                        No products to compare yet. Add products from the store
                        to compare them here.
                    </p>
                    <Link href="/browse" className={styles.cta}>
                        Explore the collection{" "}
                        <ArrowUpRight size={17} aria-hidden="true" />
                    </Link>
                </div>
            );
        }
        if (loading) {
            return (
                <div>
                    <p role="status" className={styles.notice}>
                        Loading your selection…
                    </p>
                    <div className={styles.scroller} aria-hidden="true">
                        {items.map((id) => (
                            <div
                                key={id}
                                className={`${styles.skeleton} animate-pulse`}
                            />
                        ))}
                    </div>
                </div>
            );
        }
        if (failed) {
            return (
                <div className={styles.empty}>
                    <p role="alert">
                        We couldn’t load your selection. Please try again.
                    </p>
                    <button
                        type="button"
                        className={styles.cta}
                        onClick={() => setAttempt((value) => value + 1)}
                    >
                        Try again
                    </button>
                </div>
            );
        }
        if (products.length === 0) {
            return (
                <div className={styles.empty}>
                    <p role="status">
                        Your selected pieces are no longer available.
                    </p>
                    <Link href="/browse" className={styles.cta}>
                        Explore the collection{" "}
                        <ArrowUpRight size={17} aria-hidden="true" />
                    </Link>
                </div>
            );
        }
        return (
            <div
                className={styles.scroller}
                role="region"
                aria-label="Selected products"
                tabIndex={0}
            >
                {products.map((product) => {
                    const variant = product.variants[0];
                    if (!variant) return null;
                    const image = product.variantImages[0];
                    const href =
                        image?.url ??
                        `/product/${product.slug}/${variant.variantSlug}`;
                    return (
                        <article
                            key={variant.variantId}
                            className={styles.card}
                        >
                            <div className={styles.image}>
                                <Link
                                    href={href}
                                    aria-label={`View ${product.name}`}
                                >
                                    {image?.image ? (
                                        <Image
                                            src={image.image}
                                            alt={product.name}
                                            fill
                                            sizes="(max-width: 700px) 260px, 280px"
                                            className={styles.productImage}
                                        />
                                    ) : (
                                        <span className={styles.imageFallback}>
                                            Image unavailable
                                        </span>
                                    )}
                                </Link>
                                <button
                                    type="button"
                                    aria-label="Remove from compare"
                                    className={styles.remove}
                                    onClick={() => {
                                        removeFromCompare(variant.variantId);
                                        selectionHeading.current?.focus();
                                    }}
                                >
                                    <X size={17} aria-hidden="true" />
                                </button>
                            </div>
                            <div className={styles.cardBody}>
                                <p className={styles.variant}>
                                    {variant.variantName}
                                </p>
                                <h3>
                                    <Link href={href}>{product.name}</Link>
                                </h3>
                                <div className={styles.price}>
                                    <ProductPrice
                                        sizes={variant.sizes}
                                        isCard
                                        handleChange={() => {}}
                                    />
                                </div>
                                <dl className={styles.details}>
                                    <div>
                                        <dt>Rating</dt>
                                        <dd>
                                            {product.rating.toFixed(1)}{" "}
                                            <span>/ 5</span>
                                        </dd>
                                    </div>
                                    <div>
                                        <dt>Sold</dt>
                                        <dd>{product.sales}</dd>
                                    </div>
                                </dl>
                                <Link href={href} className={styles.detailLink}>
                                    View piece{" "}
                                    <ArrowUpRight
                                        size={15}
                                        aria-hidden="true"
                                    />
                                </Link>
                            </div>
                        </article>
                    );
                })}
            </div>
        );
    };

    return (
        <div>
            <div className={styles.toolbar}>
                <div>
                    <p className={styles.sectionLabel}>SIDE BY SIDE</p>
                    <h2 ref={selectionHeading} tabIndex={-1} className={styles.selectionHeading}>Your selection</h2>
                </div>
                <div className={styles.toolbarActions}>
                    <span className={styles.count} aria-live="polite">
                        {items.length} of 4 selected
                    </span>
                    {items.length > 0 && (
                        <button
                            type="button"
                            className={styles.textButton}
                            onClick={() => {
                                clearCompare();
                                selectionHeading.current?.focus();
                            }}
                        >
                            Clear all
                        </button>
                    )}
                </div>
            </div>
            {renderBody()}
        </div>
    );
}
