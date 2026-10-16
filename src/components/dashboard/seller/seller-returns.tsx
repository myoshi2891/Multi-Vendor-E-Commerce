"use client";
import { useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReturnItemCondition, ReturnRequestStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
    RETURN_REASON_LABELS,
    RETURN_STATUS_LABELS,
    type ReturnRequestSellerActions,
    type ReturnRequestView,
    type ReturnStatusCounts,
} from "@/lib/returns-view";
import styles from "../design/seller.module.css";
import SellerPage from "../design/seller-page";

const STATUSES = Object.keys(RETURN_STATUS_LABELS) as ReturnRequestStatus[];

const formatDate = (iso: string): string =>
    new Date(iso).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });

const errorMessage = (error: unknown): string =>
    error instanceof Error && error.message
        ? error.message
        : "Could not update the return. Please try again.";

/** RMA 1 件。状態ごとに許された操作だけを出す（design §4.1） */
function ReturnCard({
    storeUrl,
    request,
    actions,
}: Readonly<{
    storeUrl: string;
    request: ReturnRequestView;
    actions: ReturnRequestSellerActions;
}>) {
    const router = useRouter(),
        id = useId(),
        pending = useRef(false);
    const [busy, setBusy] = useState(false),
        [rejecting, setRejecting] = useState(false),
        [reason, setReason] = useState(""),
        [conditions, setConditions] = useState<
            Record<string, ReturnItemCondition>
        >({}),
        [feedback, setFeedback] = useState<{
            kind: "ok" | "error";
            text: string;
        } | null>(null);

    const run = async (task: () => Promise<unknown>) => {
        if (pending.current) return;
        pending.current = true;
        setBusy(true);
        setFeedback(null);
        try {
            await task();
            setFeedback({ kind: "ok", text: "Return updated." });
            setRejecting(false);
            router.refresh();
        } catch (error: unknown) {
            setFeedback({ kind: "error", text: errorMessage(error) });
        } finally {
            pending.current = false;
            setBusy(false);
        }
    };

    const reject = () => {
        if (reason.trim() === "") {
            setFeedback({
                kind: "error",
                text: "Enter a reason to reject this return.",
            });
            return;
        }
        void run(() => actions.rejectAction(storeUrl, request.id, reason));
    };

    const receive = () => {
        const items = request.items.map((item) => ({
            returnRequestItemId: item.id,
            condition: conditions[item.id],
        }));
        if (items.some((item) => !item.condition)) {
            setFeedback({
                kind: "error",
                text: "Select a condition for every item.",
            });
            return;
        }
        void run(() =>
            actions.receiveAction(
                storeUrl,
                request.id,
                items as {
                    returnRequestItemId: string;
                    condition: ReturnItemCondition;
                }[]
            )
        );
    };

    return (
        <article
            className={`${styles.panel} ${styles.controls} space-y-3`}
            aria-label={`Return ${request.id}`}
            data-return-state={request.status}
        >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold">Return {request.id}</h2>
                <span className="text-sm font-semibold">
                    {RETURN_STATUS_LABELS[request.status]}
                </span>
            </div>
            <p className="text-sm text-muted-foreground">
                Order {request.orderId ?? "-"} · Requested{" "}
                {formatDate(request.createdAt)}
            </p>
            <ul className="space-y-3">
                {request.items.map((item) => (
                    <li
                        key={item.id}
                        className="flex flex-wrap items-end justify-between gap-3 text-sm"
                    >
                        <span className="min-w-0">
                            {item.name} ({item.size}) × {item.quantity} ·{" "}
                            {RETURN_REASON_LABELS[item.reasonCode]}
                            {item.condition &&
                                ` · ${item.condition === "RESELLABLE" ? "Resellable" : "Damaged"}`}
                        </span>
                        {request.status === "APPROVED" && (
                            <span className="grid gap-1">
                                <label htmlFor={`${id}-${item.id}`}>
                                    Condition: {item.name} ({item.size})
                                </label>
                                <select
                                    id={`${id}-${item.id}`}
                                    className="border bg-background p-2"
                                    value={conditions[item.id] ?? ""}
                                    disabled={busy}
                                    onChange={(event) =>
                                        setConditions((current) => ({
                                            ...current,
                                            [item.id]: event.target
                                                .value as ReturnItemCondition,
                                        }))
                                    }
                                >
                                    <option value="">Select condition</option>
                                    <option value="RESELLABLE">
                                        Resellable
                                    </option>
                                    <option value="DAMAGED">Damaged</option>
                                </select>
                            </span>
                        )}
                    </li>
                ))}
            </ul>
            {request.customerNote && (
                <p className="text-sm">Customer note: {request.customerNote}</p>
            )}
            {request.returnTrackingNumber && (
                <p className="text-sm">
                    Return tracking number: {request.returnTrackingNumber}
                </p>
            )}
            {request.status === "REJECTED" && request.sellerNote && (
                <p className="text-sm">
                    Rejection reason: {request.sellerNote}
                </p>
            )}
            {(request.status === "RECEIVED" ||
                request.status === "RESOLVED") && (
                <p className="text-sm">
                    Refund estimate: $
                    {(request.refundAmount ?? request.estimatedRefund).toFixed(
                        2
                    )}{" "}
                    (product price only).{" "}
                    {request.status === "RECEIVED"
                        ? "Issue the refund manually in the payment provider after resolving."
                        : "Issue the refund manually in the payment provider."}
                </p>
            )}

            {request.status === "REQUESTED" && (
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                            void run(() =>
                                actions.approveAction(storeUrl, request.id)
                            )
                        }
                    >
                        Approve
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        aria-expanded={rejecting}
                        onClick={() => setRejecting(!rejecting)}
                    >
                        Reject
                    </Button>
                </div>
            )}
            {request.status === "REQUESTED" && rejecting && (
                <div className="grid gap-2">
                    <label htmlFor={`${id}-reason`} className="text-sm">
                        Reason for rejection
                    </label>
                    <textarea
                        id={`${id}-reason`}
                        className="border bg-background p-2"
                        rows={3}
                        maxLength={2000}
                        value={reason}
                        disabled={busy}
                        onChange={(event) => setReason(event.target.value)}
                    />
                    <div>
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={busy}
                            onClick={reject}
                        >
                            Confirm rejection
                        </Button>
                    </div>
                </div>
            )}
            {request.status === "APPROVED" && (
                <Button type="button" disabled={busy} onClick={receive}>
                    Mark as received
                </Button>
            )}
            {request.status === "RECEIVED" && (
                <Button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                        void run(() =>
                            actions.resolveAction(storeUrl, request.id)
                        )
                    }
                >
                    Resolve return
                </Button>
            )}
            {busy && <output className="block text-sm">Saving…</output>}
            {!busy && feedback?.kind === "ok" && (
                <output className={`${styles.success} block text-sm`}>
                    {feedback.text}
                </output>
            )}
            {feedback?.kind === "error" && (
                <p role="alert" className={styles.alert}>
                    {feedback.text}
                </p>
            )}
        </article>
    );
}

/**
 * 店舗の返品キュー（plan 088 Step 5・DS-COMP-248）。
 * DataTable は使わない —— 行の remount で成功表示と focus 復帰先を失うため
 * （seller-orders.tsx の注記と同じ問題）。Server Action は初回の参照を固定する。
 * 絞り込みとページは URL（?status=&page=）で持ち、サーバーが 1 ページ分だけ渡す。
 * 件数はサーバーの状態別集計（counts）から出す。
 */
export default function SellerReturns({
    storeUrl,
    requests,
    counts,
    status,
    page,
    totalPages,
    actions,
}: Readonly<{
    storeUrl: string;
    /** 現在のページ・絞り込みに該当する分だけ */
    requests: ReturnRequestView[];
    counts: ReturnStatusCounts;
    status: ReturnRequestStatus | null;
    page: number;
    totalPages: number;
    actions: ReturnRequestSellerActions;
}>) {
    const filterId = useId(),
        router = useRouter(),
        pathname = usePathname(),
        searchParams = useSearchParams();
    const [stableActions] = useState(() => actions);
    const total = STATUSES.reduce((sum, s) => sum + counts[s], 0);

    /** 現在の URL を保ったまま status / page を差し替える。page 1 と ALL は URL から外す */
    const hrefFor = (next: {
        status: ReturnRequestStatus | null;
        page: number;
    }): string => {
        const query = new URLSearchParams(searchParams.toString());
        if (next.status) query.set("status", next.status);
        else query.delete("status");
        if (next.page > 1) query.set("page", String(next.page));
        else query.delete("page");
        const qs = query.toString();
        return qs ? `${pathname}?${qs}` : pathname;
    };

    return (
        <SellerPage
            id="store-returns"
            title="Returns"
            description="Review return requests, record received items, and resolve refunds."
        >
            {total === 0 ? (
                <p className={styles.panel}>No return requests yet.</p>
            ) : (
                <>
                    <div className={`${styles.controls} grid max-w-xs gap-1`}>
                        <label htmlFor={filterId} className="text-sm">
                            Filter by status
                        </label>
                        <select
                            id={filterId}
                            className="border bg-background p-2"
                            value={status ?? "ALL"}
                            onChange={(event) => {
                                const value = event.target.value;
                                router.push(
                                    hrefFor({
                                        status:
                                            value === "ALL"
                                                ? null
                                                : (value as ReturnRequestStatus),
                                        page: 1,
                                    })
                                );
                            }}
                        >
                            <option value="ALL">All ({total})</option>
                            {STATUSES.map((s) => (
                                <option key={s} value={s}>
                                    {RETURN_STATUS_LABELS[s]} ({counts[s]})
                                </option>
                            ))}
                        </select>
                    </div>
                    {requests.length === 0 ? (
                        <p className={styles.panel}>
                            No returns with this status.
                        </p>
                    ) : (
                        <div className="grid gap-4">
                            {requests.map((request) => (
                                <ReturnCard
                                    key={request.id}
                                    storeUrl={storeUrl}
                                    request={request}
                                    actions={stableActions}
                                />
                            ))}
                        </div>
                    )}
                    {totalPages > 1 && (
                        <nav
                            aria-label="Returns pages"
                            className="flex flex-wrap items-center gap-4 text-sm"
                        >
                            {page > 1 && (
                                <Link
                                    href={hrefFor({ status, page: page - 1 })}
                                    className="underline"
                                >
                                    Previous page
                                </Link>
                            )}
                            <span>
                                Page {page} of {totalPages}
                            </span>
                            {page < totalPages && (
                                <Link
                                    href={hrefFor({ status, page: page + 1 })}
                                    className="underline"
                                >
                                    Next page
                                </Link>
                            )}
                        </nav>
                    )}
                </>
            )}
        </SellerPage>
    );
}
