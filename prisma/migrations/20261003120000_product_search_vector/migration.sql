-- plan 074 / ADR-008: 重み付きの検索ベクトル列（brand・バリアント keywords を含む）
--
-- searchKeywords: 配下バリアントの keywords（カンマ区切り）をスペースで連結した非正規化列。
--   以後の同期は src/queries/product.ts の recomputeProductDerivedColumns が tx 内で行う。
-- searchVector: 生成列は同じ行の列しか参照できないため、別テーブルの keywords は
--   searchKeywords を経由して取り込む。

ALTER TABLE "Product" ADD COLUMN "searchKeywords" TEXT NOT NULL DEFAULT '';

-- backfill（既存の全商品）
UPDATE "Product" p SET "searchKeywords" = COALESCE((
    SELECT string_agg(replace(pv."keywords", ',', ' '), ' ' ORDER BY pv."createdAt", pv."id")
    FROM "ProductVariant" pv
    WHERE pv."productId" = p."id" AND pv."keywords" IS NOT NULL
), '');

ALTER TABLE "Product" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', "name"), 'A') ||
    setweight(to_tsvector('simple', "brand"), 'B') ||
    setweight(to_tsvector('simple', "searchKeywords"), 'C') ||
    setweight(to_tsvector('simple', COALESCE("description", '')), 'D')
) STORED;

CREATE INDEX "Product_searchVector_idx" ON "Product" USING GIN ("searchVector");
