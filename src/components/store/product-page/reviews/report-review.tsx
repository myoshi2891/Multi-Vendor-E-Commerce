"use client";
import { useId, useRef, useState } from "react";
import { ReviewReportReason } from "@prisma/client";
import {
    REVIEW_REPORT_REASON_LABELS,
    type ReportReviewAction,
} from "@/lib/review-moderation";
import styles from "../product.module.css";

const REASONS = Object.keys(
    REVIEW_REPORT_REASON_LABELS
) as ReviewReportReason[];

const isReportReason = (value: string): value is ReviewReportReason =>
    (REASONS as string[]).includes(value);

/** 未認証はサーバーの文言をそのまま見せず、次に取るべき行動を示す */
const errorMessage = (error: unknown): string => {
    if (!(error instanceof Error) || !error.message) {
        return "Could not send the report. Please try again.";
    }
    if (error.message === "Unauthenticated.")
        return "Sign in to report reviews.";
    return error.message;
};

/**
 * レビューの通報（plan 092・DS-COMP-072）。理由は必須、メモは任意。
 * 送信中は入力とボタンをロックし、`useRef` で連打による二重送信を防ぐ。
 * 失敗時は入力を残して再送できる。成功後は導線ごと閉じる（サーバー側でも同じ人の通報は冪等）。
 */
export default function ReportReview({
    reviewId,
    onReport,
}: Readonly<{ reviewId: string; onReport: ReportReviewAction }>) {
    const id = useId();
    const pending = useRef(false);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [reason, setReason] = useState("");
    const [note, setNote] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    const submit = async () => {
        if (pending.current) return;
        if (!isReportReason(reason)) {
            setError("Choose a reason for your report.");
            return;
        }
        pending.current = true;
        setBusy(true);
        setError(null);
        try {
            const trimmed = note.trim();
            await onReport({
                reviewId,
                reason,
                ...(trimmed ? { note: trimmed } : {}),
            });
            setDone(true);
            setOpen(false);
        } catch (caught: unknown) {
            setError(errorMessage(caught));
        } finally {
            pending.current = false;
            setBusy(false);
        }
    };

    if (done) {
        return (
            <output className={`${styles.reportFeedback} block`}>
                Thanks for letting us know. Our team will take a look.
            </output>
        );
    }

    return (
        <div className={styles.reportReview}>
            <button
                type="button"
                className={styles.reportToggle}
                aria-expanded={open}
                aria-controls={`${id}-form`}
                onClick={() => {
                    setOpen(!open);
                    setError(null);
                }}
            >
                Report review
            </button>
            {open && (
                <div id={`${id}-form`} className={styles.reportForm}>
                    <label htmlFor={`${id}-reason`}>Reason</label>
                    <select
                        id={`${id}-reason`}
                        value={reason}
                        disabled={busy}
                        onChange={(event) => setReason(event.target.value)}
                    >
                        <option value="">Choose a reason</option>
                        {REASONS.map((value) => (
                            <option key={value} value={value}>
                                {REVIEW_REPORT_REASON_LABELS[value]}
                            </option>
                        ))}
                    </select>
                    <label htmlFor={`${id}-note`}>Details (optional)</label>
                    <textarea
                        id={`${id}-note`}
                        rows={3}
                        maxLength={500}
                        value={note}
                        disabled={busy}
                        onChange={(event) => setNote(event.target.value)}
                    />
                    <div>
                        <button
                            type="button"
                            className={styles.reportSubmit}
                            disabled={busy}
                            onClick={() => void submit()}
                        >
                            Submit report
                        </button>
                    </div>
                    {busy && <output className="block">Sending…</output>}
                </div>
            )}
            {error && (
                <p role="alert" className={styles.reportError}>
                    {error}
                </p>
            )}
        </div>
    );
}
