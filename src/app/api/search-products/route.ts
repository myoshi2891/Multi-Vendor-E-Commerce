import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

// DBから返す行の型を定義
// id は PostgreSQL では TEXT なので string
type ProductSearchRow = {
    id: string;
    name: string;
    description: string | null;
    relevance: number;
};

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? "";

    if (!q.trim()) {
        return NextResponse.json([]);
    }

    try {
        // Prisma.sql + $queryRaw で型安全 & SQLインジェクション防止
        // PostgreSQL: to_tsvector + plainto_tsquery で全文検索
        // COALESCE で description が NULL の場合も対応
        const rows = await db.$queryRaw<ProductSearchRow[]>(Prisma.sql`
        SELECT p.id, p.name, p.description,
               ts_rank(
                   to_tsvector('simple', p.name || ' ' || COALESCE(p.description, '')),
                   plainto_tsquery('simple', ${q})
               ) AS relevance
        FROM "Product" p
        WHERE to_tsvector('simple', p.name || ' ' || COALESCE(p.description, ''))
              @@ plainto_tsquery('simple', ${q})
        ORDER BY relevance DESC
        LIMIT 50
      `);

        return NextResponse.json(rows);
    } catch (error) {
        console.error("search-products: query failed", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
