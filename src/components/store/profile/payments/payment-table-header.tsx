"use client";

import type { PaymentTableDateFilter, PaymentTableFilter } from "@/lib/types";
import { useState } from "react";
import styles from "./payments.module.css";

export const paymentFilters: { title: string; value: PaymentTableFilter }[] = [
    { title: "View all", value: "" },
    { title: "PayPal", value: "paypal" },
    { title: "Credit card", value: "credit-card" },
];

export default function PaymentTableHeader({
    filter,
    period,
    search,
    pending,
    onChange,
}: {
    filter: PaymentTableFilter;
    period: PaymentTableDateFilter;
    search: string;
    pending: boolean;
    onChange: (
        filter: PaymentTableFilter,
        period: PaymentTableDateFilter,
        search: string
    ) => void;
}) {
    const [draft, setDraft] = useState(search);
    return (
        <fieldset disabled={pending} className={styles.controls}>
            <legend className="sr-only">Filter payments</legend>
            <div className={styles.filterRow}>
                <div
                    className={styles.filters}
                    role="group"
                    aria-label="Payment method"
                >
                    {paymentFilters.map((item) => (
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
                    <label htmlFor="payment-search">Search payments</label>
                    <div className={styles.searchInput}>
                        <input
                            id="payment-search"
                            type="search"
                            value={draft}
                            placeholder="Payment ID or intent ID"
                            onChange={(event) => setDraft(event.target.value)}
                        />
                        <button type="submit" className={styles.primary}>
                            Search
                        </button>
                    </div>
                </div>
                <div className={styles.period}>
                    <label htmlFor="payment-period">Payment period</label>
                    <select
                        id="payment-period"
                        value={period}
                        onChange={(event) =>
                            onChange(
                                filter,
                                event.target.value as PaymentTableDateFilter,
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
