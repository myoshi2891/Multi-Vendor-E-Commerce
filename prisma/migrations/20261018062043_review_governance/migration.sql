-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING_REVIEW', 'PUBLISHED', 'FLAGGED', 'REJECTED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ReviewReportReason" AS ENUM ('SPAM', 'OFFENSIVE', 'OFF_TOPIC', 'FAKE', 'OTHER');

-- CreateEnum
CREATE TYPE "ModerationSubject" AS ENUM ('REVIEW', 'LISTING');

-- CreateEnum
CREATE TYPE "ModerationMode" AS ENUM ('NONE', 'POST', 'PRE');

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "isVerifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED';

-- CreateTable
CREATE TABLE "ReviewReport" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" "ReviewReportReason" NOT NULL,
    "note" VARCHAR(500),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationPolicy" (
    "subject" "ModerationSubject" NOT NULL,
    "mode" "ModerationMode" NOT NULL DEFAULT 'POST',
    "requireVerifiedPurchase" BOOLEAN NOT NULL DEFAULT false,
    "flagThreshold" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationPolicy_pkey" PRIMARY KEY ("subject")
);

-- CreateIndex
CREATE INDEX "ReviewReport_reviewId_resolvedAt_idx" ON "ReviewReport"("reviewId", "resolvedAt");

-- CreateIndex
CREATE INDEX "ReviewReport_reporterId_idx" ON "ReviewReport"("reporterId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewReport_reviewId_reporterId_key" ON "ReviewReport"("reviewId", "reporterId");

-- CreateIndex
CREATE INDEX "Review_productId_status_idx" ON "Review"("productId", "status");

-- AddForeignKey
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewReport" ADD CONSTRAINT "ReviewReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- rating の許容範囲（1〜5 の 0.5 刻み）を DB でも強制する（design review-governance §6.2 (ii)）。
-- 適用前に違反行が 0 件であることを確認すること（plan 092 Step 0）。
ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range"
    CHECK ("rating" >= 1 AND "rating" <= 5 AND "rating" * 2 = trunc("rating" * 2));

-- 評価集計の backfill（design §5.4）。公開集合（PUBLISHED / FLAGGED）からの純粋な再計算なので、
-- 何度実行しても同じ結果になる（冪等）。Product はアプリ外（seed 等）で書かれたレビューとのずれも直す。
UPDATE "Product" p
SET "rating"     = COALESCE(agg.avg, 0),
    "numReviews" = COALESCE(agg.cnt, 0)
FROM (
    SELECT pr.id AS product_id, AVG(r."rating") AS avg, COUNT(r.id)::int AS cnt
    FROM "Product" pr
    LEFT JOIN "Review" r ON r."productId" = pr.id AND r."status" IN ('PUBLISHED', 'FLAGGED')
    GROUP BY pr.id
) agg
WHERE p.id = agg.product_id;

-- Store の平均はレビュー単位の平均（商品平均の平均ではない・design §5.2）。
UPDATE "Store" s
SET "averageRating" = COALESCE(agg.avg, 0),
    "numReviews"    = COALESCE(agg.cnt, 0)
FROM (
    SELECT st.id AS store_id, AVG(r."rating") AS avg, COUNT(r.id)::int AS cnt
    FROM "Store" st
    LEFT JOIN "Product" pr ON pr."storeId" = st.id
    LEFT JOIN "Review" r ON r."productId" = pr.id AND r."status" IN ('PUBLISHED', 'FLAGGED')
    GROUP BY st.id
) agg
WHERE s.id = agg.store_id;
