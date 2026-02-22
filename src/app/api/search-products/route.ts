import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

// DBから返す行の型を定義（必要に応じて型を追加）
type ProductSearchRow = {
    id: number;
    name: string;
    description: string;
    relevance: number;
};

/**
 * Handle GET requests to perform a full-text search over products.
 *
 * Performs a PostgreSQL full-text search against product name and description and returns matches ordered by relevance.
 *
 * @returns An array of `ProductSearchRow` containing up to 50 products matching the `q` query, ordered by relevance; an empty array if `q` is missing or empty.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? "";

    if (!q.trim()) {
        return NextResponse.json([]);
    }

    // Prisma.sql + $queryRaw で型安全 & SQLインジェクション防止
    // PostgreSQL: to_tsvector + plainto_tsquery で全文検索
    const rows = await db.$queryRaw<ProductSearchRow[]>(Prisma.sql`
    SELECT p.id, p.name, p.description,
           ts_rank(
               to_tsvector('simple', p.name || ' ' || p.description),
               plainto_tsquery('simple', ${q})
           ) AS relevance
    FROM "Product" p
    WHERE to_tsvector('simple', p.name || ' ' || p.description)
          @@ plainto_tsquery('simple', ${q})
    ORDER BY relevance DESC
    LIMIT 50
  `);

    return NextResponse.json(rows);
}