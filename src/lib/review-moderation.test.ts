import {
    ModerationMode,
    ReviewReportReason,
    ReviewStatus,
} from "@prisma/client";
import {
    DEFAULT_REVIEW_POLICY,
    resolveReviewPolicy,
    statusAfterAuthorWrite,
    moderationTransition,
    shouldFlag,
    availableModerationActions,
    requiresModerationReason,
    REVIEW_STATUS_LABELS,
    REVIEW_REPORT_REASON_LABELS,
} from "./review-moderation";
import {
    PUBLIC_REVIEW_STATUSES,
    isPublicReviewStatus,
    publicReviewWhere,
} from "./review-visibility";

// 設計: docs/design/review-governance/design.md §3（状態機械）/ §3.3（ポリシー）

describe("publicReviewWhere", () => {
    it("公開集合は PUBLISHED と FLAGGED", () => {
        expect([...PUBLIC_REVIEW_STATUSES]).toEqual([
            ReviewStatus.PUBLISHED,
            ReviewStatus.FLAGGED,
        ]);
    });

    it("既存の条件に status の公開集合を合成する", () => {
        expect(publicReviewWhere({ productId: "p1" })).toEqual({
            productId: "p1",
            status: { in: [ReviewStatus.PUBLISHED, ReviewStatus.FLAGGED] },
        });
    });

    it("呼び出し側が status を渡しても公開集合で上書きする（非公開を混ぜさせない）", () => {
        const where = publicReviewWhere({
            productId: "p1",
            status: ReviewStatus.REMOVED,
        });
        expect(where.status).toEqual({
            in: [ReviewStatus.PUBLISHED, ReviewStatus.FLAGGED],
        });
    });

    it.each([
        [ReviewStatus.PUBLISHED, true],
        [ReviewStatus.FLAGGED, true],
        [ReviewStatus.PENDING_REVIEW, false],
        [ReviewStatus.REJECTED, false],
        [ReviewStatus.REMOVED, false],
    ])("isPublicReviewStatus(%s) = %s", (status, expected) => {
        expect(isPublicReviewStatus(status)).toBe(expected);
    });
});

describe("resolveReviewPolicy", () => {
    it("行が無ければ既定値（事後審査・購入不要・閾値 3）", () => {
        expect(resolveReviewPolicy(null)).toEqual(DEFAULT_REVIEW_POLICY);
        expect(DEFAULT_REVIEW_POLICY).toEqual({
            mode: ModerationMode.POST,
            requireVerifiedPurchase: false,
            flagThreshold: 3,
        });
    });

    it("行があればその値を使う", () => {
        expect(
            resolveReviewPolicy({
                mode: ModerationMode.PRE,
                requireVerifiedPurchase: true,
                flagThreshold: 5,
            })
        ).toEqual({
            mode: ModerationMode.PRE,
            requireVerifiedPurchase: true,
            flagThreshold: 5,
        });
    });

    it("1 未満の閾値は 1 に寄せる（0 だと通報なしで FLAGGED になりうる）", () => {
        expect(
            resolveReviewPolicy({
                mode: ModerationMode.POST,
                requireVerifiedPurchase: false,
                flagThreshold: 0,
            }).flagThreshold
        ).toBe(1);
    });
});

describe("statusAfterAuthorWrite", () => {
    it.each([
        [null, ModerationMode.NONE, ReviewStatus.PUBLISHED],
        [null, ModerationMode.POST, ReviewStatus.PUBLISHED],
        [null, ModerationMode.PRE, ReviewStatus.PENDING_REVIEW],
        [
            ReviewStatus.PENDING_REVIEW,
            ModerationMode.POST,
            ReviewStatus.PENDING_REVIEW,
        ],
        [ReviewStatus.REJECTED, ModerationMode.POST, ReviewStatus.PUBLISHED],
        [
            ReviewStatus.REJECTED,
            ModerationMode.PRE,
            ReviewStatus.PENDING_REVIEW,
        ],
        [ReviewStatus.PUBLISHED, ModerationMode.POST, ReviewStatus.PUBLISHED],
        [
            ReviewStatus.PUBLISHED,
            ModerationMode.PRE,
            ReviewStatus.PENDING_REVIEW,
        ],
        [ReviewStatus.FLAGGED, ModerationMode.POST, ReviewStatus.FLAGGED],
        [ReviewStatus.FLAGGED, ModerationMode.PRE, ReviewStatus.FLAGGED],
    ])("現在 %s・mode %s → %s", (current, mode, expected) => {
        expect(statusAfterAuthorWrite(current, mode)).toBe(expected);
    });

    it("REMOVED は編集できない（終端）", () => {
        expect(
            statusAfterAuthorWrite(ReviewStatus.REMOVED, ModerationMode.POST)
        ).toBeNull();
    });
});

describe("moderationTransition", () => {
    it.each([
        [ReviewStatus.PENDING_REVIEW, "approve", ReviewStatus.PUBLISHED],
        [ReviewStatus.PENDING_REVIEW, "reject", ReviewStatus.REJECTED],
        [ReviewStatus.PUBLISHED, "remove", ReviewStatus.REMOVED],
        [ReviewStatus.FLAGGED, "remove", ReviewStatus.REMOVED],
        [ReviewStatus.FLAGGED, "restore", ReviewStatus.PUBLISHED],
    ] as const)("%s に %s → %s", (current, action, expected) => {
        expect(moderationTransition(current, action)).toBe(expected);
    });

    it.each([
        [ReviewStatus.PUBLISHED, "approve"],
        [ReviewStatus.PUBLISHED, "reject"],
        [ReviewStatus.PUBLISHED, "restore"],
        [ReviewStatus.PENDING_REVIEW, "remove"],
        [ReviewStatus.PENDING_REVIEW, "restore"],
        [ReviewStatus.REJECTED, "approve"],
        [ReviewStatus.REJECTED, "remove"],
        [ReviewStatus.REMOVED, "restore"],
        [ReviewStatus.REMOVED, "approve"],
        [ReviewStatus.FLAGGED, "approve"],
    ] as const)("%s に %s は遷移表にない（null）", (current, action) => {
        expect(moderationTransition(current, action)).toBeNull();
    });
});

describe("shouldFlag", () => {
    it("事後審査で未解決の通報数が閾値に達したら FLAGGED にする", () => {
        expect(shouldFlag(ModerationMode.POST, 3, 3)).toBe(true);
        expect(shouldFlag(ModerationMode.POST, 2, 3)).toBe(false);
    });

    it("事後審査以外では自動遷移しない（NONE は記録のみ、PRE は公開前に審査済み）", () => {
        expect(shouldFlag(ModerationMode.NONE, 10, 3)).toBe(false);
        expect(shouldFlag(ModerationMode.PRE, 10, 3)).toBe(false);
    });
});

describe("availableModerationActions（UI に出す操作）", () => {
    it.each([
        [ReviewStatus.PENDING_REVIEW, ["approve", "reject"]],
        [ReviewStatus.PUBLISHED, ["remove"]],
        [ReviewStatus.FLAGGED, ["restore", "remove"]],
        [ReviewStatus.REJECTED, []],
        [ReviewStatus.REMOVED, []],
    ] as const)("%s → %j", (status, expected) => {
        expect(availableModerationActions(status)).toEqual(expected);
    });

    it("出す操作はすべて遷移表で許されている（UI と状態機械がずれない）", () => {
        for (const status of Object.values(ReviewStatus)) {
            for (const action of availableModerationActions(status)) {
                expect(moderationTransition(status, action)).not.toBeNull();
            }
        }
    });

    it("却下と削除だけが理由を必須にする", () => {
        expect(requiresModerationReason("reject")).toBe(true);
        expect(requiresModerationReason("remove")).toBe(true);
        expect(requiresModerationReason("approve")).toBe(false);
        expect(requiresModerationReason("restore")).toBe(false);
    });

    it("すべての状態と通報理由にラベルがある", () => {
        for (const status of Object.values(ReviewStatus)) {
            expect(REVIEW_STATUS_LABELS[status]).toEqual(expect.any(String));
        }
        for (const reason of Object.values(ReviewReportReason)) {
            expect(REVIEW_REPORT_REASON_LABELS[reason]).toEqual(
                expect.any(String)
            );
        }
    });
});
