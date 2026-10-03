-- plan 076 / design.md §2-Q4: 割引後の最小価格を非正規化して、価格ソートを DB で行う。
--
-- 旧実装は findMany で skip/take した「後」にメモリ上で価格順に並べ替えていたため、
-- 表示中の 1 ページしか並ばなかった（カタログ全体では安い順にならない）。
--
-- discount は Float（double precision）なので、掛ける前に ::numeric へ寄せること。
-- price * (1 - discount / 100) と書くと numeric * double が double になり、丸め誤差が乗る。
-- 以後の同期は src/queries/product.ts の recomputeProductDerivedColumns が tx 内で行う。

ALTER TABLE "Product" ADD COLUMN "minPrice" DECIMAL(12,2);

UPDATE "Product" p SET "minPrice" = (
    SELECT round(min(s."price" * (1 - s."discount"::numeric / 100)), 2)
    FROM "ProductVariant" pv
    JOIN "Size" s ON s."productVariantId" = pv."id"
    WHERE pv."productId" = p."id"
);

CREATE INDEX "Product_minPrice_id_idx" ON "Product"("minPrice", "id");
