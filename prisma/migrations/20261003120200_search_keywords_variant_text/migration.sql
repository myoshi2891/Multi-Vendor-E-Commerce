-- plan 075 / ADR-008 D-1 の改訂: searchKeywords にバリアント名・バリアント説明も含める。
--
-- 旧 getProducts の検索（ILIKE）は Product.name / description に加えて
-- ProductVariant.variantName / variantDescription も見ていた。ブラウズ検索を "searchVector" へ
-- 移すとこれらが検索できなくなる（退行）ため、バリアント由来のテキストをまとめて
-- searchKeywords（重み C）へ入れる。生成列 "searchVector" は searchKeywords を参照しているので
-- 式の変更は不要で、この UPDATE だけで追随する。
--
-- 連結順と区切りは src/queries/product.ts の recomputeProductDerivedColumns と同一に保つこと。
UPDATE "Product" p SET "searchKeywords" = COALESCE((
    SELECT string_agg(
        concat_ws(' ', pv."variantName", pv."variantDescription", replace(pv."keywords", ',', ' ')),
        ' ' ORDER BY pv."createdAt", pv."id"
    )
    FROM "ProductVariant" pv
    WHERE pv."productId" = p."id"
), '');
