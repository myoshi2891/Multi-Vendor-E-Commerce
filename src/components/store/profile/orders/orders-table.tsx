"use client";

import type { OrderTableDateFilter, OrderTableFilter } from "@/lib/types";
import { toNumberSafe } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import OrderTableHeader from "./order-table-header";
import OrdersHeading from "./orders-heading";
import styles from "./orders.module.css";

export interface OrderHistoryEntry {
    id: string;
    createdAt: Date | string;
    total: number | string;
    paymentStatus: string;
    orderStatus: string;
    groups: { _count: { items: number }; items: { image: string }[] }[];
}
type Result = { orders: OrderHistoryEntry[]; totalPages: number };
type Criteria = {
    filter: OrderTableFilter;
    period: OrderTableDateFilter;
    search: string;
    page: number;
};
export type FetchOrdersAction = (
    filter: OrderTableFilter,
    period: OrderTableDateFilter,
    search: string,
    page: number
) => Promise<Result>;
const statusLabel = (status: string) =>
    status.replace(/([a-z])([A-Z])/g, "$1 $2");

export default function OrdersTable({
    orders,
    totalPages,
    prev_filter = "",
    fetchOrdersAction,
    initialError = false,
}: Result & {
    prev_filter?: OrderTableFilter;
    fetchOrdersAction: FetchOrdersAction;
    initialError?: boolean;
}) {
    const [data, setData] = useState<Result>({ orders, totalPages });
    const [criteria, setCriteria] = useState<Criteria>({
        filter: prev_filter,
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
            const result = await fetchOrdersAction(
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
            className={styles.orders}
            data-orders
            aria-label="Order history"
        >
            <OrdersHeading />
            <OrderTableHeader
                {...criteria}
                pending={pending}
                onChange={(filter, period, search) =>
                    void load({ filter, period, search, page: 1 })
                }
            />
            <div aria-busy={pending}>
                {pending ? (
                    <div className={styles.message} role="status">
                        <p>Loading orders…</p>
                        <div className={styles.skeleton} aria-hidden="true" />
                    </div>
                ) : error ? (
                    <div className={styles.message} role="alert">
                        <h2>We couldn’t load your orders</h2>
                        <p>Please try again. Your filters are saved.</p>
                        <button
                            type="button"
                            className={styles.primary}
                            onClick={() => void load(criteria)}
                        >
                            Try again
                        </button>
                    </div>
                ) : data.orders.length === 0 ? (
                    <div className={styles.message}>
                        <span className={styles.emptySymbol} aria-hidden="true">
                            ◇
                        </span>
                        <h2>
                            {hasConditions
                                ? "No matching orders"
                                : "No orders yet"}
                        </h2>
                        <p>
                            {hasConditions
                                ? "Try a different search or remove your filters."
                                : "Your next discovery is waiting in the collection."}
                        </p>
                        <Link href="/browse" className={styles.primary}>
                            Explore the collection
                        </Link>
                    </div>
                ) : (
                    <>
                        <p className={styles.summary} role="status">
                            {data.orders.length}{" "}
                            {data.orders.length === 1 ? "order" : "orders"} on
                            this page · Page {criteria.page} of{" "}
                            {Math.max(1, data.totalPages)}
                        </p>
                        <ol className={styles.list} aria-label="Your orders">
                            {data.orders.map((order) => {
                                const images = order.groups
                                    .flatMap((group) =>
                                        group.items.map((item) => item.image)
                                    )
                                    .slice(0, 5);
                                const count = order.groups.reduce(
                                    (sum, group) => sum + group._count.items,
                                    0
                                );
                                return (
                                    <li key={order.id} className={styles.card}>
                                        <div className={styles.cardHeader}>
                                            <div className={styles.identity}>
                                                <p className={styles.eyebrow}>
                                                    ORDER
                                                </p>
                                                <h2>#{order.id}</h2>
                                                <p className={styles.date}>
                                                    Placed on:{" "}
                                                    <time
                                                        dateTime={new Date(
                                                            order.createdAt
                                                        ).toISOString()}
                                                    >
                                                        {new Date(
                                                            order.createdAt
                                                        ).toLocaleDateString(
                                                            "en-US",
                                                            {
                                                                year: "numeric",
                                                                month: "short",
                                                                day: "numeric",
                                                                timeZone: "UTC",
                                                            }
                                                        )}
                                                    </time>
                                                </p>
                                            </div>
                                            <div className={styles.total}>
                                                <span>Total</span>
                                                <strong>
                                                    $
                                                    {toNumberSafe(
                                                        order.total
                                                    ).toFixed(2)}
                                                </strong>
                                            </div>
                                        </div>
                                        <div className={styles.cardBody}>
                                            <div className={styles.products}>
                                                <div className={styles.images}>
                                                    {images.map((src, i) => (
                                                        <Image
                                                            key={`${src}-${i}`}
                                                            src={src}
                                                            alt=""
                                                            width={48}
                                                            height={56}
                                                        />
                                                    ))}
                                                </div>
                                                <span>{count} items</span>
                                            </div>
                                            <dl className={styles.statuses}>
                                                <div>
                                                    <dt>Payment</dt>
                                                    <dd
                                                        className={styles.badge}
                                                    >
                                                        {statusLabel(
                                                            order.paymentStatus
                                                        )}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt>Delivery</dt>
                                                    <dd
                                                        className={styles.badge}
                                                    >
                                                        {statusLabel(
                                                            order.orderStatus
                                                        )}
                                                    </dd>
                                                </div>
                                            </dl>
                                            <Link
                                                href={`/order/${order.id}`}
                                                aria-label={`View order ${order.id}`}
                                                className={styles.view}
                                            >
                                                View order →
                                            </Link>
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    </>
                )}
            </div>
            {!error && !pending && data.totalPages > 1 && (
                <nav
                    className={styles.pagination}
                    aria-label="Orders pagination"
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
