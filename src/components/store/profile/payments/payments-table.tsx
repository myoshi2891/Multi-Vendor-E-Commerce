"use client";

import type { PaymentTableDateFilter, PaymentTableFilter } from "@/lib/types";
import { toNumberSafe } from "@/lib/utils";
import Link from "next/link";
import { useRef, useState } from "react";
import PaymentTableHeader from "./payment-table-header";
import PaymentsHeading from "./payments-heading";
import styles from "./payments.module.css";

export interface PaymentHistoryEntry {
    id: string;
    paymentIntentId: string;
    paymentMethod: string;
    amount: number | string;
    status: string;
    orderId: string;
    updatedAt: Date | string;
}
type Result = { payments: PaymentHistoryEntry[]; totalPages: number };
type Criteria = {
    filter: PaymentTableFilter;
    period: PaymentTableDateFilter;
    search: string;
    page: number;
};
export type FetchPaymentsAction = (
    filter: PaymentTableFilter,
    period: PaymentTableDateFilter,
    search: string,
    page: number
) => Promise<Result>;

export default function PaymentsTable({
    payments,
    totalPages,
    fetchPaymentsAction,
    initialError = false,
}: Result & {
    fetchPaymentsAction: FetchPaymentsAction;
    initialError?: boolean;
}) {
    const [data, setData] = useState<Result>({ payments, totalPages });
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
            const result = await fetchPaymentsAction(
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
            className={styles.payments}
            data-payments
            aria-label="Payment history"
        >
            <PaymentsHeading />
            <PaymentTableHeader
                {...criteria}
                pending={pending}
                onChange={(filter, period, search) =>
                    void load({ filter, period, search, page: 1 })
                }
            />
            <div aria-busy={pending}>
                {pending ? (
                    <div className={styles.message} role="status">
                        <p>Loading payments…</p>
                        <div className={styles.skeleton} aria-hidden="true" />
                    </div>
                ) : error ? (
                    <div className={styles.message} role="alert">
                        <h2>We couldn’t load your payments</h2>
                        <p>Please try again. Your filters are saved.</p>
                        <button
                            type="button"
                            className={styles.primary}
                            onClick={() => void load(criteria)}
                        >
                            Try again
                        </button>
                    </div>
                ) : data.payments.length === 0 ? (
                    <div className={styles.message}>
                        <span className={styles.emptySymbol} aria-hidden="true">
                            ◇
                        </span>
                        <h2>
                            {hasConditions
                                ? "No matching payments"
                                : "No payments yet"}
                        </h2>
                        <p>
                            {hasConditions
                                ? "Try a different search or remove your filters."
                                : "Your payment records will appear here after your next discovery."}
                        </p>
                        <Link href="/browse" className={styles.primary}>
                            Explore the collection
                        </Link>
                    </div>
                ) : (
                    <>
                        <p className={styles.summary} role="status">
                            {data.payments.length}{" "}
                            {data.payments.length === 1
                                ? "payment"
                                : "payments"}{" "}
                            on this page · Page {criteria.page} of{" "}
                            {Math.max(1, data.totalPages)}
                        </p>
                        <ol className={styles.list} aria-label="Your payments">
                            {data.payments.map((payment) => (
                                <li key={payment.id} className={styles.card}>
                                    <div className={styles.cardHeader}>
                                        <div className={styles.identity}>
                                            <p className={styles.eyebrow}>
                                                PAYMENT
                                            </p>
                                            <h2>#{payment.id}</h2>
                                            <p className={styles.date}>
                                                Last action:{" "}
                                                <time
                                                    dateTime={new Date(
                                                        payment.updatedAt
                                                    ).toISOString()}
                                                >
                                                    {new Date(
                                                        payment.updatedAt
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
                                            <span>Amount</span>
                                            <strong>
                                                $
                                                {toNumberSafe(
                                                    payment.amount
                                                ).toFixed(2)}
                                            </strong>
                                        </div>
                                    </div>
                                    <div className={styles.cardBody}>
                                        <dl className={styles.details}>
                                            <div>
                                                <dt>Intent ID</dt>
                                                <dd>
                                                    {payment.paymentIntentId}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt>Method</dt>
                                                <dd>{payment.paymentMethod}</dd>
                                            </div>
                                            <div>
                                                <dt>Status</dt>
                                                <dd className={styles.badge}>
                                                    {payment.status}
                                                </dd>
                                            </div>
                                        </dl>
                                        <Link
                                            href={`/order/${payment.orderId}`}
                                            aria-label={`View order for payment ${payment.id}`}
                                            className={styles.view}
                                        >
                                            View order →
                                        </Link>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </>
                )}
            </div>
            {!error && !pending && data.totalPages > 1 && (
                <nav
                    className={styles.pagination}
                    aria-label="Payments pagination"
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
