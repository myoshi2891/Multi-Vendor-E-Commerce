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

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? "";

    if (!q.trim()) {
        return NextResponse.json([]);
    }

    // Prisma.sql + $queryRaw で型安全 & SQLインジェクション防止
    const rows = await db.$queryRaw<ProductSearchRow[]>(Prisma.sql`
    SELECT p.id, p.name, p.description, 
           MATCH(p.name, p.description) AGAINST(${q} IN NATURAL LANGUAGE MODE) AS relevance
    FROM products p
    WHERE MATCH(p.name, p.description) AGAINST(${q} IN NATURAL LANGUAGE MODE)
    ORDER BY relevance DESC
    LIMIT 50
  `);

    return NextResponse.json(rows);
}
