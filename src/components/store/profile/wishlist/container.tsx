import type { ProductWishListType } from "@/lib/types";
import ProductList from "../../shared/product-list";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Fragment } from "react";
import styles from "./wishlist.module.css";

/** URLを正本とするお気に入り一覧。ページングのローカル状態を持たない。 */
export default function WishlistContainer({
    products,
    page,
    totalPages,
}: {
    products: ProductWishListType[];
    page: number;
    totalPages: number;
}) {
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    const pages = [
        ...new Set([
            1,
            ...Array.from(
                { length: Math.min(5, totalPages) },
                (_, i) => start + i
            ),
            totalPages,
        ]),
    ].sort((a, b) => a - b);
    return (
        <div>
            <div className={styles.summary}>
                <span>
                    {products.length}{" "}
                    {products.length === 1 ? "piece" : "pieces"} on this page
                </span>
                <span>
                    Page {page} of {totalPages}
                </span>
            </div>
            <div className={styles.products}>
                <ProductList products={products} variant="editorial" />
            </div>
            {totalPages > 1 ? (
                <nav
                    aria-label="Wishlist pagination"
                    className={styles.pagination}
                >
                    {page > 1 ? (
                        <Link
                            href={`/profile/wishlist/${page - 1}`}
                            className={styles.direction}
                        >
                            <ArrowLeft size={14} aria-hidden="true" />
                            Previous
                        </Link>
                    ) : (
                        <span
                            className={`${styles.direction} ${styles.disabled}`}
                            aria-disabled="true"
                        >
                            <ArrowLeft size={14} aria-hidden="true" />
                            Previous
                        </span>
                    )}
                    <div className={styles.pageNumbers}>
                        {pages.map((number, index) => (
                            <Fragment key={number}>
                                {index > 0 && number - pages[index - 1] > 1 ? (
                                    <span aria-hidden="true">…</span>
                                ) : null}
                                <Link
                                    href={`/profile/wishlist/${number}`}
                                    aria-label={`Page ${number}`}
                                    aria-current={
                                        number === page ? "page" : undefined
                                    }
                                >
                                    {number}
                                </Link>
                            </Fragment>
                        ))}
                    </div>
                    {page < totalPages ? (
                        <Link
                            href={`/profile/wishlist/${page + 1}`}
                            className={styles.direction}
                        >
                            Next
                            <ArrowRight size={14} aria-hidden="true" />
                        </Link>
                    ) : (
                        <span
                            className={`${styles.direction} ${styles.disabled}`}
                            aria-disabled="true"
                        >
                            Next
                            <ArrowRight size={14} aria-hidden="true" />
                        </span>
                    )}
                </nav>
            ) : null}
        </div>
    );
}
