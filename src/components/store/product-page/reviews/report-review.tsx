"use client";
import { useId, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
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

// 想定外の例外の文言は表示しない（本番の Server Action は文言を伏せる）
const FALLBACK_ERROR = "Could not send the report. Please try again.";

/**
 * レビューの通報（plan 092・DS-COMP-072）。理由は必須、メモは任意。
 * 送信中は入力とボタンをロックし、`useRef` で連打による二重送信を防ぐ。
 * 業務エラーは戻り値の `error` を表示し、想定外の例外は固定文言にする。
 * 失敗時は入力を残して再送できる。成功後は導線ごと閉じる（サーバー側でも同じ人の通報は冪等）。
 */
export default function ReportReview({
    reviewId,
    onReport,
}: Readonly<{ reviewId: string; onReport: ReportReviewAction }>) {
    const id = useId();
    const { isLoaded, isSignedIn } = useUser();
    const pending = useRef(false);
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [reason, setReason] = useState("");
    const [note, setNote] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    const submit = async () => {
        if (pending.current) return;
        // 未認証は送信前に判定する。本番の Server Action は例外の文言を伏せるため、
        // サーバーの "Unauthenticated." を照合しても一致しない
        if (isLoaded && !isSignedIn) {
            setError("Sign in to report reviews.");
            return;
        }
        if (!isReportReason(reason)) {
            setError("Choose a reason for your report.");
            return;
        }
        pending.current = true;
        setBusy(true);
        setError(null);
        try {
            const trimmed = note.trim();
            const result = await onReport({
                reviewId,
                reason,
                ...(trimmed ? { note: trimmed } : {}),
            });
            if (!result.ok) {
                setError(result.error);
                return;
            }
            setDone(true);
            setOpen(false);
        } catch (caught: unknown) {
            if (caught instanceof Error) {
                console.error("[ReportReview:submit] Failed to report review", {
                    error: caught.message,
                    stack: caught.stack,
                });
            }
            setError(FALLBACK_ERROR);
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
                        onChange={(event) => {
                            setReason(event.target.value);
                            setError(null);
                        }}
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
                        onChange={(event) => {
                            setNote(event.target.value);
                            setError(null);
                        }}
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
