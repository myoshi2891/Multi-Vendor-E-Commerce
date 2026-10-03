import { db } from "@/lib/db";
import { buildPrefixTsQuery } from "@/lib/search-query";
import type { SearchResult } from "@/lib/types";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

/** ヘッダー検索のドロップダウンに出す件数の上限。 */
const SUGGESTION_LIMIT = 8;

/**
 * サジェスト 1 件。UI（`header/search/suggestions.tsx`）が必須とする `SearchResult` に、
 * React の key や結合テストでの同定に使う `id` を足したもの。
 */
type ProductSuggestion = SearchResult & { id: string };

/** 順位付けクエリが返す行。表示用の列は hydrate で引くので id だけを持つ。 */
type RankedIdRow = { id: string };

/**
 * Handle GET requests for the header search suggestions.
 *
 * Runs a PostgreSQL full-text search over the weighted `searchVector` column (name, brand,
 * variant keywords and description — ADR-008), then hydrates the
 * top matches into `SearchResult` items (name, product page link, image) for the dropdown.
 *
 * - The query is read from `q`. `search` is also accepted for compatibility with older clients.
 * - The last word is matched as a prefix (`buildPrefixTsQuery`), so a partially typed word still
 *   produces suggestions. Input with no letters or digits returns an empty array.
 * - Products without a variant are excluded **inside the SQL**, before `LIMIT` — dropping them
 *   after `LIMIT` would return fewer than `SUGGESTION_LIMIT` items even when more matches exist.
 * - Ties in `ts_rank` are broken by `id` so the order is deterministic.
 *
 * @returns Up to `SUGGESTION_LIMIT` suggestions ordered by relevance; an empty array if the query is missing or blank.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? searchParams.get("search") ?? "";
    const tsQuery = buildPrefixTsQuery(q);

    if (tsQuery === null) {
        return NextResponse.json([]);
    }

    try {
        // Prisma.sql + $queryRaw でパラメータ化（SQL インジェクション防止）。
        // "searchVector" は name(A) / brand(B) / バリアント keywords(C) / description(D) の
        // 重み付き生成列で、GIN インデックス Product_searchVector_idx を持つ（ADR-008）。
        const ranked = await db.$queryRaw<RankedIdRow[]>(Prisma.sql`
        SELECT p.id
        FROM "Product" p
        WHERE p."searchVector" @@ to_tsquery('simple', ${tsQuery})
          AND EXISTS (SELECT 1 FROM "ProductVariant" pv WHERE pv."productId" = p.id)
        ORDER BY ts_rank(p."searchVector", to_tsquery('simple', ${tsQuery})) DESC,
                 p.id ASC
        LIMIT ${SUGGESTION_LIMIT}
      `);

        if (ranked.length === 0) {
            return NextResponse.json([]);
        }

        const ids = ranked.map((row) => row.id);
        const products = await db.product.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                name: true,
                slug: true,
                variants: {
                    select: { slug: true, variantImage: true },
                    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                    take: 1,
                },
            },
        });

        // findMany は順序を保証しないので、順位付けクエリの順に並べ直す。
        // 2 クエリの間にバリアントが消えた商品はリンク先が無いので飛ばす。
        const byId = new Map(products.map((product) => [product.id, product]));
        const suggestions: ProductSuggestion[] = ids.flatMap((id) => {
            const product = byId.get(id);
            const variant = product?.variants[0];
            if (!product || !variant) return [];
            return [
                {
                    id,
                    name: product.name,
                    link: `/product/${product.slug}/${variant.slug}`,
                    image: variant.variantImage,
                },
            ];
        });

        return NextResponse.json(suggestions);
    } catch (error) {
        console.error("search-products: query failed", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
