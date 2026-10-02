"use client";

import type { ReviewDateFilter, ReviewFilter } from "@/lib/types";
import { useState } from "react";
import styles from "./reviews.module.css";

export const reviewFilters: { title: string; value: ReviewFilter }[] = [
    { title: "View all", value: "" },
    { title: "5 stars", value: "5" },
    { title: "4 stars", value: "4" },
    { title: "3 stars", value: "3" },
    { title: "2 stars", value: "2" },
    { title: "1 star", value: "1" },
];

export default function ReviewsHeader({
    filter,
    period,
    search,
    pending,
    onChange,
}: {
    filter: ReviewFilter;
    period: ReviewDateFilter;
    search: string;
    pending: boolean;
    onChange: (
        filter: ReviewFilter,
        period: ReviewDateFilter,
        search: string
    ) => void;
}) {
    const [draft, setDraft] = useState(search);
    return (
        <fieldset disabled={pending} className={styles.controls}>
            <legend className="sr-only">Filter reviews</legend>
            <div className={styles.filterRow}>
                <div
                    className={styles.filters}
                    role="group"
                    aria-label="Review rating"
                >
                    {reviewFilters.map((item) => (
                        <button
                            type="button"
                            key={item.value}
                            aria-pressed={filter === item.value}
                            onClick={() => onChange(item.value, period, search)}
                        >
                            {item.title}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    className={styles.clear}
                    onClick={() => {
                        setDraft("");
                        onChange("", "", "");
                    }}
                >
                    Remove all filters
                </button>
            </div>
            <form
                role="search"
                className={styles.searchForm}
                onSubmit={(event) => {
                    event.preventDefault();
                    onChange(filter, period, draft.trim());
                }}
            >
                <div className={styles.searchField}>
                    <label htmlFor="review-search">Search reviews</label>
                    <div className={styles.searchInput}>
                        <input
                            id="review-search"
                            type="search"
                            value={draft}
                            placeholder="Words in your review"
                            onChange={(event) => setDraft(event.target.value)}
                        />
                        <button type="submit" className={styles.primary}>
                            Search
                        </button>
                    </div>
                </div>
                <div className={styles.period}>
                    <label htmlFor="review-period">Review period</label>
                    <select
                        id="review-period"
                        value={period}
                        onChange={(event) =>
                            onChange(
                                filter,
                                event.target.value as ReviewDateFilter,
                                search
                            )
                        }
                    >
                        <option value="">All time</option>
                        <option value="last-6-months">Last 6 months</option>
                        <option value="last-1-year">Last 1 year</option>
                        <option value="last-2-years">Last 2 years</option>
                    </select>
                </div>
            </form>
        </fieldset>
    );
}
