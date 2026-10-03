import { Prisma } from "@prisma/client";

/**
 * 商品配下のバリアント・サイズから導出する非正規化列を再計算する UPDATE 文
 * （plans 074 / 075 / 076・ADR-008）。
 *
 * - `searchKeywords`: 全バリアントの `variantName` / `variantDescription` / `keywords`
 *   （カンマ区切り）をスペースで連結した値。生成列 `searchVector` は同じ行の列しか参照できない
 *   ため、別テーブルにあるバリアントのテキストはこの列を経由して検索対象（重み C）に入る。
 * - `minPrice`: 全バリアント・全サイズの割引後価格 `price * (1 - discount/100)` の最小値を
 *   小数 2 桁に丸めたもの。価格ソートに使う。サイズが 1 件も無ければ NULL。
 *   `discount` は Float なので、**掛ける前に `::numeric` へ寄せる**
 *   （`numeric * double` は double になり、丸め誤差が乗る）。
 *
 * **この SQL が導出式の唯一の定義**。アプリの書き込み経路（`recomputeProductDerivedColumns`・
 * 1 商品）と、`upsertProduct` を通さずに行を作る seed（全商品）の両方がここを使う。
 * seed が通さないと、seed した商品は検索の keywords に当たらず、価格ソートで末尾に並ぶ。
 * 連結順は `createdAt, id` に固定する（マイグレーションの backfill と同じ）。
 *
 * @param productId - 対象の商品。省略すると全商品を再計算する（seed 用）
 * @returns `$executeRaw` に渡す SQL
 */
export const productDerivedColumnsUpdateSql = (
    productId?: string
): Prisma.Sql =>
    Prisma.sql`
        UPDATE "Product" p SET "searchKeywords" = COALESCE((
            SELECT string_agg(
                concat_ws(' ', pv."variantName", pv."variantDescription", replace(pv."keywords", ',', ' ')),
                ' ' ORDER BY pv."createdAt", pv."id"
            )
            FROM "ProductVariant" pv
            WHERE pv."productId" = p."id"
        ), ''),
        "minPrice" = (
            SELECT round(min(s."price" * (1 - s."discount"::numeric / 100)), 2)
            FROM "ProductVariant" pv
            JOIN "Size" s ON s."productVariantId" = pv."id"
            WHERE pv."productId" = p."id"
        )
        ${productId !== undefined ? Prisma.sql`WHERE p."id" = ${productId}` : Prisma.empty}
    `;
