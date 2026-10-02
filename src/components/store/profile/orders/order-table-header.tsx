"use client";

import type { OrderTableDateFilter, OrderTableFilter } from "@/lib/types";
import { useState } from "react";
import styles from "./orders.module.css";

export const orderFilters: { title: string; value: OrderTableFilter }[] = [
    { title: "View all", value: "" },
    { title: "To pay", value: "unpaid" },
    { title: "To ship", value: "toShip" },
    { title: "Shipped", value: "shipped" },
    { title: "Delivered", value: "delivered" },
];

export default function OrderTableHeader({
    filter,
    period,
    search,
    pending,
    onChange,
}: {
    filter: OrderTableFilter;
    period: OrderTableDateFilter;
    search: string;
    pending: boolean;
    onChange: (
        filter: OrderTableFilter,
        period: OrderTableDateFilter,
        search: string
    ) => void;
}) {
    const [draft, setDraft] = useState(search);
    return (
        <fieldset disabled={pending} className={styles.controls}>
            <legend className="sr-only">Filter orders</legend>
            <div className={styles.filterRow}>
                <div
                    className={styles.filters}
                    role="group"
                    aria-label="Order status"
                >
                    {orderFilters.map((item) => (
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
                    <label htmlFor="order-search">Search orders</label>
                    <div className={styles.searchInput}>
                        <input
                            id="order-search"
                            type="search"
                            value={draft}
                            placeholder="Order ID, product or store name"
                            onChange={(event) => setDraft(event.target.value)}
                        />
                        <button type="submit" className={styles.primary}>
                            Search
                        </button>
                    </div>
                </div>
                <div className={styles.period}>
                    <label htmlFor="order-period">Order period</label>
                    <select
                        id="order-period"
                        value={period}
                        onChange={(event) =>
                            onChange(
                                filter,
                                event.target.value as OrderTableDateFilter,
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
