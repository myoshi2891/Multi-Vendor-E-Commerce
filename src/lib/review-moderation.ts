import {
    ModerationMode,
    ReviewReportReason,
    ReviewStatus,
} from "@prisma/client";

/**
 * レビューのモデレーション状態機械とポリシーの解決（純粋関数）。
 * 設計: docs/design/review-governance/design.md §3。DB への読み書きは `src/queries/review.ts` が行う。
 */

export type ReviewPolicy = {
    mode: ModerationMode;
    requireVerifiedPurchase: boolean;
    flagThreshold: number;
};

export type ModerationAction = "approve" | "reject" | "remove" | "restore";

/** `ModerationPolicy` に REVIEW の行が無いときの既定値。現行（即公開）と同じ挙動になる。 */
export const DEFAULT_REVIEW_POLICY: ReviewPolicy = {
    mode: ModerationMode.POST,
    requireVerifiedPurchase: false,
    flagThreshold: 3,
};

/**
 * DB の行（無ければ null）から実効ポリシーを作る。運用者が SQL で値を変えるため、
 * 閾値は 1 未満を 1 に寄せる（0 だと通報が 1 件も無いのに FLAGGED 判定になりうる）。
 */
export const resolveReviewPolicy = (row: ReviewPolicy | null): ReviewPolicy => {
    if (!row) return DEFAULT_REVIEW_POLICY;
    return {
        mode: row.mode,
        requireVerifiedPurchase: row.requireVerifiedPurchase,
        flagThreshold: Math.max(1, row.flagThreshold),
    };
};

/** 投稿・再提出のときの初期状態。事前審査なら審査待ち、それ以外は即公開。 */
const initialStatus = (mode: ModerationMode): ReviewStatus =>
    mode === ModerationMode.PRE
        ? ReviewStatus.PENDING_REVIEW
        : ReviewStatus.PUBLISHED;

/**
 * 投稿者が書き込んだ（新規 / 編集）後の状態。null は「書き込みを拒否する」。
 *
 * - 新規・却下後の再提出 → ポリシーの初期状態
 * - 公開中の編集 → 事前審査なら審査に戻す（編集を事前審査の抜け道にしない）
 * - FLAGGED の編集 → FLAGGED のまま（審査中の状態を編集で解除させない）
 * - REMOVED → 拒否（運営が削除した終端。unique 制約のため新規投稿もできない）
 */
export const statusAfterAuthorWrite = (
    current: ReviewStatus | null,
    mode: ModerationMode
): ReviewStatus | null => {
    switch (current) {
        case null:
        case ReviewStatus.REJECTED:
            return initialStatus(mode);
        case ReviewStatus.PENDING_REVIEW:
            return ReviewStatus.PENDING_REVIEW;
        case ReviewStatus.PUBLISHED:
            return initialStatus(mode);
        case ReviewStatus.FLAGGED:
            return ReviewStatus.FLAGGED;
        case ReviewStatus.REMOVED:
            return null;
    }
};

/** 運営（ADMIN）の操作による遷移。遷移表に無い組み合わせは null（design §3.2）。 */
const MODERATION_TRANSITIONS: Readonly<
    Record<ReviewStatus, Partial<Record<ModerationAction, ReviewStatus>>>
> = {
    [ReviewStatus.PENDING_REVIEW]: {
        approve: ReviewStatus.PUBLISHED,
        reject: ReviewStatus.REJECTED,
    },
    [ReviewStatus.PUBLISHED]: { remove: ReviewStatus.REMOVED },
    [ReviewStatus.FLAGGED]: {
        remove: ReviewStatus.REMOVED,
        restore: ReviewStatus.PUBLISHED,
    },
    [ReviewStatus.REJECTED]: {},
    [ReviewStatus.REMOVED]: {},
};

export const moderationTransition = (
    current: ReviewStatus,
    action: ModerationAction
): ReviewStatus | null => MODERATION_TRANSITIONS[current][action] ?? null;

/**
 * 通報で PUBLISHED → FLAGGED に自動遷移させるか。事後審査（POST）のときだけ。
 * NONE は通報を記録するだけ、PRE は公開前に審査済みなので自動では動かさない。
 */
export const shouldFlag = (
    mode: ModerationMode,
    unresolvedReportCount: number,
    threshold: number
): boolean =>
    mode === ModerationMode.POST && unresolvedReportCount >= threshold;

// ---- UI 向け（遷移表から導く。UI に遷移表を複製しない） ----

/** 画面に出す順序（承認系 → 破壊系）。 */
const ACTION_DISPLAY_ORDER: readonly ModerationAction[] = [
    "approve",
    "reject",
    "restore",
    "remove",
];

/** その状態のレビューに対して、運営が実行できる操作。 */
export const availableModerationActions = (
    status: ReviewStatus
): ModerationAction[] =>
    ACTION_DISPLAY_ORDER.filter(
        (action) => moderationTransition(status, action) !== null
    );

/** 却下と削除は理由を必須にする（投稿者本人に見せる・`ModerateReviewSchema` と同じ規則）。 */
export const requiresModerationReason = (action: ModerationAction): boolean =>
    action === "reject" || action === "remove";

export const REVIEW_STATUS_LABELS: Readonly<Record<ReviewStatus, string>> = {
    [ReviewStatus.PENDING_REVIEW]: "Pending review",
    [ReviewStatus.PUBLISHED]: "Published",
    [ReviewStatus.FLAGGED]: "Flagged",
    [ReviewStatus.REJECTED]: "Rejected",
    [ReviewStatus.REMOVED]: "Removed",
};

export const REVIEW_REPORT_REASON_LABELS: Readonly<
    Record<ReviewReportReason, string>
> = {
    [ReviewReportReason.SPAM]: "Spam or advertising",
    [ReviewReportReason.OFFENSIVE]: "Offensive or abusive",
    [ReviewReportReason.OFF_TOPIC]: "Not about this product",
    [ReviewReportReason.FAKE]: "Fake or misleading",
    [ReviewReportReason.OTHER]: "Something else",
};

export const MODERATION_ACTION_LABELS: Readonly<
    Record<ModerationAction, string>
> = {
    approve: "Approve",
    reject: "Reject",
    restore: "Keep published",
    remove: "Remove",
};

/**
 * `reportReview` の結果。業務エラーは throw せず `ok: false` で返す
 * （本番の Server Action は throw した文言をクライアントへ伏せるため）。
 */
export type ReportReviewResult =
    | { ok: true; status: ReviewStatus }
    | { ok: false; error: string };

/** 店頭のレビューカードから通報する Server Action（`reportReview`）の形。 */
export type ReportReviewAction = (input: {
    reviewId: string;
    reason: ReviewReportReason;
    note?: string;
}) => Promise<ReportReviewResult>;

/** admin の審査キューから呼ぶ Server Action（`moderateReview`）の形。 */
export type ModerateReviewAction = (input: {
    reviewId: string;
    action: ModerationAction;
    reason?: string;
}) => Promise<{ id: string; status: ReviewStatus }>;

/** 審査キューの 1 行（`getReviewModerationQueue` の戻り値を画面用に平らにしたもの）。 */
export type ReviewModerationQueueItem = {
    id: string;
    review: string;
    rating: number;
    status: ReviewStatus;
    isVerifiedPurchase: boolean;
    moderationReason: string | null;
    createdAt: string;
    productName: string;
    productSlug: string;
    authorName: string;
    authorEmail: string;
    unresolvedReports: number;
};

/** `getReviewModerationQueue` の 1 行（必要な列だけを構造で受ける）。 */
type ReviewModerationQueueRow = {
    id: string;
    review: string;
    rating: number;
    status: ReviewStatus;
    isVerifiedPurchase: boolean;
    moderationReason: string | null;
    createdAt: Date;
    product: { name: string; slug: string };
    user: { name: string; email: string };
    _count: { reports: number };
};

/** Server Component → Client の境界を越える形にする（Date は ISO 文字列・通報数は未解決のみ）。 */
export const toReviewModerationQueueItem = (
    row: ReviewModerationQueueRow
): ReviewModerationQueueItem => ({
    id: row.id,
    review: row.review,
    rating: row.rating,
    status: row.status,
    isVerifiedPurchase: row.isVerifiedPurchase,
    moderationReason: row.moderationReason,
    createdAt: row.createdAt.toISOString(),
    productName: row.product.name,
    productSlug: row.product.slug,
    authorName: row.user.name,
    authorEmail: row.user.email,
    unresolvedReports: row._count.reports,
});
