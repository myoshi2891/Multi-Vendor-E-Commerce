"use client";

import type { ReviewDateFilter, ReviewFilter } from "@/lib/types";
import Link from "next/link";
import { useRef, useState } from "react";
import ReviewsHeader from "./reviews-header";
import ReviewsHeading from "./reviews-heading";
import styles from "./reviews.module.css";
import ReviewHistoryCard from "./review-history-card";

export interface ReviewHistoryEntry {
    id: string;
    rating: number;
    review: string;
    variant: string;
    color: string;
    size: string;
    quantity: string;
    updatedAt: Date | string;
    user: { name: string; picture: string };
    images: { id: string; url: string; alt: string }[];
}
type Result = { reviews: ReviewHistoryEntry[]; totalPages: number };
type Criteria = {
    filter: ReviewFilter;
    period: ReviewDateFilter;
    search: string;
    page: number;
};
export type FetchReviewsAction = (
    filter: ReviewFilter,
    period: ReviewDateFilter,
    search: string,
    page: number
) => Promise<Result>;

export default function ReviewsContainer({
    reviews,
    totalPages,
    fetchReviewsAction,
    initialError = false,
}: Result & {
    fetchReviewsAction: FetchReviewsAction;
    initialError?: boolean;
}) {
    const [data, setData] = useState<Result>({ reviews, totalPages });
    const [criteria, setCriteria] = useState<Criteria>({
        filter: "",
        period: "",
        search: "",
        page: 1,
    });
    const [pending, setPending] = useState(false);
    const [error, setError] = useState(initialError);
    const inFlight = useRef(false);
    async function load(next: Criteria) {
        if (inFlight.current) return;
        inFlight.current = true;
        setCriteria(next);
        setPending(true);
        setError(false);
        try {
            const result = await fetchReviewsAction(
                next.filter,
                next.period,
                next.search,
                next.page
            );
            setData(result);
        } catch {
            setError(true);
        } finally {
            inFlight.current = false;
            setPending(false);
        }
    }
    const hasConditions = Boolean(
        criteria.filter || criteria.period || criteria.search
    );
    return (
        <section
            className={styles.reviews}
            data-reviews
            aria-label="Review history"
        >
            <ReviewsHeading />
            <ReviewsHeader
                {...criteria}
                pending={pending}
                onChange={(filter, period, search) =>
                    void load({ filter, period, search, page: 1 })
                }
            />
            <div aria-busy={pending}>
                {pending ? (
                    <div className={styles.message} role="status">
                        <p>Loading reviews…</p>
                        <div className={styles.skeleton} aria-hidden="true" />
                    </div>
                ) : error ? (
                    <div className={styles.message} role="alert">
                        <h2>We couldn’t load your reviews</h2>
                        <p>Please try again. Your filters are saved.</p>
                        <button
                            type="button"
                            className={styles.primary}
                            onClick={() => void load(criteria)}
                        >
                            Try again
                        </button>
                    </div>
                ) : data.reviews.length === 0 ? (
                    <div className={styles.message}>
                        <span className={styles.emptySymbol} aria-hidden="true">
                            ◇
                        </span>
                        <h2>
                            {hasConditions
                                ? "No matching reviews"
                                : "No reviews yet"}
                        </h2>
                        <p>
                            {hasConditions
                                ? "Try a different search or remove your filters."
                                : "Your words will appear here after you share a review."}
                        </p>
                        <Link href="/browse" className={styles.primary}>
                            Explore the collection
                        </Link>
                    </div>
                ) : (
                    <>
                        <p className={styles.summary} role="status">
                            {data.reviews.length}{" "}
                            {data.reviews.length === 1 ? "review" : "reviews"}{" "}
                            on this page · Page {criteria.page} of{" "}
                            {Math.max(1, data.totalPages)}
                        </p>
                        <ol className={styles.list} aria-label="Your reviews">
                            {data.reviews.map((review) => (
                                <ReviewHistoryCard
                                    key={review.id}
                                    review={review}
                                />
                            ))}
                        </ol>
                    </>
                )}
            </div>
            {!error && !pending && data.totalPages > 1 && (
                <nav
                    className={styles.pagination}
                    aria-label="Reviews pagination"
                >
                    <button
                        type="button"
                        aria-label="Previous page"
                        disabled={criteria.page <= 1}
                        onClick={() =>
                            void load({ ...criteria, page: criteria.page - 1 })
                        }
                    >
                        ← Previous page
                    </button>
                    <span>
                        Page {criteria.page} of {data.totalPages}
                    </span>
                    <button
                        type="button"
                        aria-label="Next page"
                        disabled={criteria.page >= data.totalPages}
                        onClick={() =>
                            void load({ ...criteria, page: criteria.page + 1 })
                        }
                    >
                        Next page →
                    </button>
                </nav>
            )}
        </section>
    );
}
