"use client";
import { useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReviewStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
    MODERATION_ACTION_LABELS,
    REVIEW_STATUS_LABELS,
    availableModerationActions,
    requiresModerationReason,
    type ModerateReviewAction,
    type ModerationAction,
    type ReviewModerationQueueItem,
} from "@/lib/review-moderation";
import styles from "../design/seller.module.css";
import SellerPage from "../design/seller-page";

const STATUSES = Object.keys(REVIEW_STATUS_LABELS) as ReviewStatus[];
/** 絞り込みの既定（審査待ち + FLAGGED）。URL では status を付けない */
const NEEDS_REVIEW = "NEEDS_REVIEW";

const formatDate = (iso: string): string =>
    new Date(iso).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
    });

/** digest 付きは Next.js がサーバーの例外を伏せた汎用文言なので、そのまま見せない */
const errorMessage = (error: unknown): string => {
    const fallback = "Could not update the review. Please try again.";
    if (!(error instanceof Error) || !error.message) return fallback;
    if ("digest" in error && error.digest) return fallback;
    return error.message;
};

/** レビュー 1 件。状態ごとに遷移表で許された操作だけを出す（design review-governance §3.2） */
function ReviewQueueCard({
    review,
    moderateAction,
}: Readonly<{
    review: ReviewModerationQueueItem;
    moderateAction: ModerateReviewAction;
}>) {
    const router = useRouter(),
        id = useId(),
        pending = useRef(false);
    const [busy, setBusy] = useState(false),
        [confirming, setConfirming] = useState<ModerationAction | null>(null),
        [reason, setReason] = useState(""),
        [feedback, setFeedback] = useState<{
            kind: "ok" | "error";
            text: string;
        } | null>(null);
    const actions = availableModerationActions(review.status);

    const run = async (action: ModerationAction) => {
        if (pending.current) return;
        const trimmed = reason.trim();
        if (requiresModerationReason(action) && trimmed === "") {
            setFeedback({
                kind: "error",
                text: "Enter a reason before continuing.",
            });
            return;
        }
        pending.current = true;
        setBusy(true);
        setFeedback(null);
        try {
            await moderateAction({
                reviewId: review.id,
                action,
                ...(requiresModerationReason(action)
                    ? { reason: trimmed }
                    : {}),
            });
            setFeedback({ kind: "ok", text: "Review updated." });
            setConfirming(null);
            setReason("");
            router.refresh();
        } catch (error: unknown) {
            setFeedback({ kind: "error", text: errorMessage(error) });
        } finally {
            pending.current = false;
            setBusy(false);
        }
    };

    return (
        <article
            // 同じ商品へのレビューが並ぶので、商品名だけでなく投稿者でも区別する
            aria-label={`Review by ${review.authorName} for ${review.productName}`}
            className={`${styles.panel} ${styles.controls} space-y-3`}
        >
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                    <h2 className="text-base font-semibold">
                        <Link
                            href={`/product/${review.productSlug}`}
                            className="underline"
                        >
                            {review.productName}
                        </Link>
                    </h2>
                    <p className="text-sm">
                        {review.authorName} · {review.authorEmail} ·{" "}
                        <time dateTime={review.createdAt}>
                            {formatDate(review.createdAt)}
                        </time>
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                    <span
                        className={styles.paymentState}
                        data-review-state={review.status}
                    >
                        {REVIEW_STATUS_LABELS[review.status]}
                    </span>
                    {review.isVerifiedPurchase && (
                        <span className={styles.paymentState}>
                            Verified purchase
                        </span>
                    )}
                    {review.unresolvedReports > 0 && (
                        <span className={styles.paymentState}>
                            {review.unresolvedReports === 1
                                ? "1 open report"
                                : `${review.unresolvedReports} open reports`}
                        </span>
                    )}
                </div>
            </div>
            <p className="text-sm">{review.rating} out of 5 stars</p>
            <p className="whitespace-pre-line break-words text-sm">
                {review.review}
            </p>
            {review.moderationReason && (
                <p className="text-sm">
                    Moderation note: {review.moderationReason}
                </p>
            )}

            {actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {actions.map((action) =>
                        requiresModerationReason(action) ? (
                            <Button
                                key={action}
                                type="button"
                                variant="outline"
                                disabled={busy}
                                aria-expanded={confirming === action}
                                onClick={() => {
                                    setConfirming(
                                        confirming === action ? null : action
                                    );
                                    setFeedback(null);
                                }}
                            >
                                {MODERATION_ACTION_LABELS[action]}
                            </Button>
                        ) : (
                            <Button
                                key={action}
                                type="button"
                                disabled={busy}
                                onClick={() => void run(action)}
                            >
                                {MODERATION_ACTION_LABELS[action]}
                            </Button>
                        )
                    )}
                </div>
            )}
            {confirming && (
                <div className="grid gap-2">
                    <label htmlFor={`${id}-reason`} className="text-sm">
                        Reason (shown to the author)
                    </label>
                    <textarea
                        id={`${id}-reason`}
                        className="border bg-background p-2"
                        rows={3}
                        maxLength={500}
                        value={reason}
                        disabled={busy}
                        onChange={(event) => setReason(event.target.value)}
                    />
                    <div>
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={busy}
                            onClick={() => void run(confirming)}
                        >
                            Confirm{" "}
                            {MODERATION_ACTION_LABELS[confirming].toLowerCase()}
                        </Button>
                    </div>
                </div>
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
 * レビューの審査キュー（plan 092・DS-COMP-250）。
 * DataTable は使わない —— 行の remount で成功表示と focus 復帰先を失うため
 * （seller-returns.tsx と同じ理由）。Server Action は初回の参照を固定する。
 * 絞り込みとページは URL（?status=&page=）で持ち、サーバーが 1 ページ分だけ渡す。
 */
export default function AdminReviews({
    reviews,
    status,
    page,
    totalPages,
    moderateAction,
}: Readonly<{
    reviews: ReviewModerationQueueItem[];
    /** null は既定（審査待ち + FLAGGED） */
    status: ReviewStatus | null;
    page: number;
    totalPages: number;
    moderateAction: ModerateReviewAction;
}>) {
    const filterId = useId(),
        router = useRouter(),
        pathname = usePathname(),
        searchParams = useSearchParams();
    const [stableAction] = useState(() => moderateAction);

    /** 現在の URL を保ったまま status / page を差し替える。page 1 と既定の status は URL から外す */
    const hrefFor = (next: {
        status: ReviewStatus | null;
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
            workspace="Administration"
            id="admin-reviews"
            title="Reviews"
            description="Approve pending reviews and decide on reported ones."
        >
            <div className={`${styles.controls} grid max-w-xs gap-1`}>
                <label htmlFor={filterId} className="text-sm">
                    Filter by status
                </label>
                <select
                    id={filterId}
                    className="border bg-background p-2"
                    value={status ?? NEEDS_REVIEW}
                    onChange={(event) => {
                        const value = event.target.value;
                        router.push(
                            hrefFor({
                                status:
                                    value === NEEDS_REVIEW
                                        ? null
                                        : (value as ReviewStatus),
                                page: 1,
                            })
                        );
                    }}
                >
                    <option value={NEEDS_REVIEW}>Needs review</option>
                    {STATUSES.map((s) => (
                        <option key={s} value={s}>
                            {REVIEW_STATUS_LABELS[s]}
                        </option>
                    ))}
                </select>
            </div>
            {reviews.length === 0 ? (
                <p className={styles.panel}>
                    {status
                        ? `No ${REVIEW_STATUS_LABELS[status].toLowerCase()} reviews.`
                        : "No reviews need attention."}
                </p>
            ) : (
                <div className="grid gap-4">
                    {reviews.map((review) => (
                        <ReviewQueueCard
                            key={review.id}
                            review={review}
                            moderateAction={stableAction}
                        />
                    ))}
                </div>
            )}
            {totalPages > 1 && (
                <nav
                    aria-label="Review queue pages"
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
        </SellerPage>
    );
}
