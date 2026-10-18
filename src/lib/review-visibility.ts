import { Prisma, ReviewStatus } from "@prisma/client";

/**
 * 公開集合 — 商品ページ・評価集計・検索 API に出してよいレビューの状態。
 * FLAGGED は通報が閾値を超えて審査待ちだが、運営が判断するまで公開のまま扱う
 * （通報だけで消せると通報が武器になる。design review-governance §3.1）。
 */
export const PUBLIC_REVIEW_STATUSES = [
    ReviewStatus.PUBLISHED,
    ReviewStatus.FLAGGED,
] as const;

export const isPublicReviewStatus = (status: ReviewStatus): boolean =>
    (PUBLIC_REVIEW_STATUSES as readonly ReviewStatus[]).includes(status);

/**
 * 公開経路でレビューを読むときは必ずこれで where を包む（plan 092 Step 6 の grep 検証の対象）。
 * 呼び出し側が渡した `status` は公開集合で上書きする — 公開経路に非公開の状態を混ぜさせない。
 */
export const publicReviewWhere = (
    where: Prisma.ReviewWhereInput = {}
): Prisma.ReviewWhereInput => ({
    ...where,
    status: { in: [...PUBLIC_REVIEW_STATUSES] },
});

/**
 * 公開経路で返すレビューの列。`moderationReason` / `moderatedAt` は投稿者本人にだけ見せる列なので含めない
 * （plan 092）。投稿者は表示列だけ（email / role を載せない・plan 091）。
 */
export const publicReviewSelect = {
    id: true,
    variant: true,
    review: true,
    rating: true,
    color: true,
    size: true,
    quantity: true,
    likes: true,
    status: true,
    isVerifiedPurchase: true,
    userId: true,
    productId: true,
    createdAt: true,
    updatedAt: true,
    images: true,
    user: { select: { name: true, picture: true } },
} satisfies Prisma.ReviewSelect;
