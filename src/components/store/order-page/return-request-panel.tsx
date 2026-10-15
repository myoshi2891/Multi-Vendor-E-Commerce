"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReturnReasonCode } from "@prisma/client";
import {
    RETURN_REASON_LABELS,
    RETURN_STATUS_LABELS,
    type GroupReturnOptions,
    type ReturnRequestCustomerActions,
    type ReturnRequestView,
} from "@/lib/returns-view";
import styles from "../shared/commerce.module.css";

const REASONS = Object.keys(RETURN_REASON_LABELS) as ReturnReasonCode[];

const formatDate = (iso: string): string =>
    new Date(iso).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });

const errorMessage = (error: unknown, fallback: string): string =>
    error instanceof Error && error.message ? error.message : fallback;

const defaultIdempotencyKey = (): string => crypto.randomUUID();

/** 既存の RMA 1 件。取り下げ（REQUESTED / APPROVED）と追跡番号（APPROVED）を扱う */
function ReturnRequestCard({
    request,
    actions,
}: Readonly<{
    request: ReturnRequestView;
    actions: ReturnRequestCustomerActions;
}>) {
    const router = useRouter(),
        trackingId = useId(),
        pending = useRef(false);
    const [busy, setBusy] = useState(false),
        [tracking, setTracking] = useState(request.returnTrackingNumber ?? ""),
        [feedback, setFeedback] = useState<{
            kind: "ok" | "error";
            text: string;
        } | null>(null);

    const run = async (task: () => Promise<unknown>, success: string) => {
        if (pending.current) return;
        pending.current = true;
        setBusy(true);
        setFeedback(null);
        try {
            await task();
            setFeedback({ kind: "ok", text: success });
            router.refresh();
        } catch (error: unknown) {
            setFeedback({
                kind: "error",
                text: errorMessage(error, "The return could not be updated."),
            });
        } finally {
            pending.current = false;
            setBusy(false);
        }
    };

    const cancelable =
        request.status === "REQUESTED" || request.status === "APPROVED";
    return (
        <article
            className={styles.returnCard}
            aria-label={`Return request from ${formatDate(request.createdAt)}`}
        >
            <div className={styles.row}>
                <span>Requested {formatDate(request.createdAt)}</span>
                <strong>{RETURN_STATUS_LABELS[request.status]}</strong>
            </div>
            <ul>
                {request.items.map((item) => (
                    <li key={item.id} className={styles.note}>
                        {item.name} ({item.size}) × {item.quantity} ·{" "}
                        {RETURN_REASON_LABELS[item.reasonCode]}
                    </li>
                ))}
            </ul>
            {request.status === "REJECTED" && request.sellerNote && (
                <p className={styles.note}>
                    Reason from the store: {request.sellerNote}
                </p>
            )}
            {request.status === "RESOLVED" && request.refundAmount !== null && (
                <p className={styles.note}>
                    Refund estimate: ${request.refundAmount.toFixed(2)} (product
                    price only; shipping and coupons are not included).
                </p>
            )}
            {request.status === "APPROVED" && (
                <form
                    className={styles.field}
                    onSubmit={(event) => {
                        event.preventDefault();
                        void run(
                            () => actions.trackingAction(request.id, tracking),
                            "Tracking number saved."
                        );
                    }}
                >
                    <label htmlFor={trackingId}>Return tracking number</label>
                    <input
                        id={trackingId}
                        value={tracking}
                        disabled={busy}
                        maxLength={100}
                        onChange={(event) => setTracking(event.target.value)}
                    />
                    <div className={styles.actions}>
                        <button
                            type="submit"
                            className={styles.secondary}
                            disabled={busy || tracking.trim() === ""}
                        >
                            Save tracking number
                        </button>
                    </div>
                </form>
            )}
            {cancelable && (
                <div className={styles.actions}>
                    <button
                        type="button"
                        className={styles.secondary}
                        disabled={busy}
                        onClick={() =>
                            void run(
                                () => actions.cancelAction(request.id),
                                "Return canceled."
                            )
                        }
                    >
                        Cancel return
                    </button>
                </div>
            )}
            {feedback?.kind === "ok" && (
                <output className={`${styles.success} block`}>
                    {feedback.text}
                </output>
            )}
            {feedback?.kind === "error" && (
                <p role="alert" className={styles.error}>
                    {feedback.text}
                </p>
            )}
        </article>
    );
}

type Selection = Record<
    string,
    { quantity: number; reasonCode: ReturnReasonCode }
>;

/**
 * 店舗グループ単位の返品欄（plan 088 Step 5・DS-COMP-247）。
 * 冪等キーはフォームを開いた時点で作り、失敗後の再送でも同じ値を使う（design §2.3）。
 * 成功したらキーを捨て、次に開いたときに作り直す。
 */
export default function ReturnRequestPanel({
    options,
    actions,
    createIdempotencyKey = defaultIdempotencyKey,
}: Readonly<{
    options: GroupReturnOptions;
    actions: ReturnRequestCustomerActions;
    createIdempotencyKey?: () => string;
}>) {
    const router = useRouter(),
        formId = useId(),
        noteId = useId(),
        pending = useRef(false),
        key = useRef<string | null>(null),
        // 送信が失敗した後に明細を変えたら、別の申請なので新しいキーにする。メモは
        // requestHash に含めない（design §2.3）ので、メモだけの変更では同じキーのまま再送する
        failedAttempt = useRef(false);
    const [open, setOpen] = useState(false),
        [busy, setBusy] = useState(false),
        [note, setNote] = useState(""),
        [selection, setSelection] = useState<Selection>({}),
        [error, setError] = useState<string | null>(null),
        [submitted, setSubmitted] = useState(false);

    if (options.items.length === 0 && options.requests.length === 0)
        return null;

    const toggle = () => {
        if (!open && !key.current) key.current = createIdempotencyKey();
        setOpen(!open);
        setSubmitted(false);
        setError(null);
    };

    const choose = (
        itemId: string,
        patch: Partial<Selection[string]>
    ): void => {
        if (failedAttempt.current) {
            key.current = null;
            failedAttempt.current = false;
        }
        setSelection((current) => ({
            ...current,
            [itemId]: {
                ...(current[itemId] ?? { quantity: 0, reasonCode: "SIZE_FIT" }),
                ...patch,
            },
        }));
    };

    const submit = async () => {
        if (pending.current) return;
        const items = Object.entries(selection)
            .filter(([, value]) => value.quantity > 0)
            .map(([orderItemId, value]) => ({
                orderItemId,
                quantity: value.quantity,
                reasonCode: value.reasonCode,
            }));
        if (items.length === 0) {
            setError("Select at least one item to return.");
            return;
        }
        if (!key.current) key.current = createIdempotencyKey();
        pending.current = true;
        setBusy(true);
        setError(null);
        setSubmitted(false);
        try {
            await actions.createAction({
                orderGroupId: options.groupId,
                idempotencyKey: key.current,
                resolution: "REFUND",
                customerNote: note.trim() || undefined,
                items,
            });
            key.current = null;
            failedAttempt.current = false;
            setSelection({});
            setNote("");
            setOpen(false);
            setSubmitted(true);
            router.refresh();
        } catch (error_: unknown) {
            failedAttempt.current = true;
            setError(
                errorMessage(error_, "The return request could not be sent.")
            );
        } finally {
            pending.current = false;
            setBusy(false);
        }
    };

    return (
        <section className={styles.returns} aria-labelledby={`${formId}-title`}>
            <h4 id={`${formId}-title`}>Returns</h4>
            {options.items.length > 0 && options.deadline && (
                <p className={styles.note}>
                    Eligible items can be returned until{" "}
                    {formatDate(options.deadline)}.
                </p>
            )}
            {options.requests.map((request) => (
                <ReturnRequestCard
                    key={request.id}
                    request={request}
                    actions={actions}
                />
            ))}
            {submitted && (
                <output className={`${styles.success} block`}>
                    Return request submitted.
                </output>
            )}
            {options.items.length > 0 && (
                <>
                    <div className={styles.actions}>
                        <button
                            type="button"
                            className={styles.secondary}
                            aria-expanded={open}
                            aria-controls={formId}
                            onClick={toggle}
                        >
                            Request a return
                        </button>
                    </div>
                    {open && (
                        <form
                            id={formId}
                            className={styles.returnCard}
                            aria-busy={busy}
                            onSubmit={(event) => {
                                event.preventDefault();
                                void submit();
                            }}
                        >
                            {options.items.map((item) => {
                                const label = `${item.name} (${item.size})`;
                                const value = selection[item.id];
                                return (
                                    <fieldset
                                        key={item.id}
                                        className={styles.returnFields}
                                    >
                                        <legend className="sr-only">
                                            {label}
                                        </legend>
                                        <div className={styles.field}>
                                            <label
                                                htmlFor={`${formId}-${item.id}-qty`}
                                            >
                                                Quantity to return: {label}
                                            </label>
                                            <select
                                                id={`${formId}-${item.id}-qty`}
                                                value={value?.quantity ?? 0}
                                                disabled={busy}
                                                onChange={(event) =>
                                                    choose(item.id, {
                                                        quantity: Number(
                                                            event.target.value
                                                        ),
                                                    })
                                                }
                                            >
                                                {Array.from(
                                                    {
                                                        length:
                                                            item.maxQuantity +
                                                            1,
                                                    },
                                                    (_, n) => (
                                                        <option
                                                            key={n}
                                                            value={n}
                                                        >
                                                            {n}
                                                        </option>
                                                    )
                                                )}
                                            </select>
                                        </div>
                                        <div className={styles.field}>
                                            <label
                                                htmlFor={`${formId}-${item.id}-reason`}
                                            >
                                                Reason: {label}
                                            </label>
                                            <select
                                                id={`${formId}-${item.id}-reason`}
                                                value={
                                                    value?.reasonCode ??
                                                    "SIZE_FIT"
                                                }
                                                disabled={busy}
                                                onChange={(event) =>
                                                    choose(item.id, {
                                                        reasonCode: event.target
                                                            .value as ReturnReasonCode,
                                                    })
                                                }
                                            >
                                                {REASONS.map((reason) => (
                                                    <option
                                                        key={reason}
                                                        value={reason}
                                                    >
                                                        {
                                                            RETURN_REASON_LABELS[
                                                                reason
                                                            ]
                                                        }
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </fieldset>
                                );
                            })}
                            <div className={styles.field}>
                                <label htmlFor={noteId}>
                                    Note for the store (optional)
                                </label>
                                <textarea
                                    id={noteId}
                                    value={note}
                                    maxLength={2000}
                                    rows={3}
                                    disabled={busy}
                                    onChange={(event) =>
                                        setNote(event.target.value)
                                    }
                                />
                            </div>
                            <p className={styles.note}>
                                Refunds cover the product price. The store
                                reviews your request before you send the items
                                back.
                            </p>
                            {error && (
                                <p role="alert" className={styles.error}>
                                    {error}
                                </p>
                            )}
                            <div className={styles.actions}>
                                <button
                                    type="submit"
                                    className={styles.primary}
                                    disabled={busy}
                                >
                                    {busy
                                        ? "Submitting…"
                                        : "Submit return request"}
                                </button>
                            </div>
                        </form>
                    )}
                </>
            )}
        </section>
    );
}
