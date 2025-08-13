import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * MySQL FULLTEXT 検索対応版
 */
export async function POST(req: Request) {
    try {
        const { query } = await req.json();

        if (!query || typeof query !== "string") {
            return NextResponse.json(
                { error: "Invalid query" },
                { status: 400 }
            );
        }

        // FULLTEXT 検索（MATCH ... AGAINST）
        const products = await db.product.findMany({
            where: {
                OR: [
                    { name: { search: query } },
                    {
                        variants: {
                            some: {
                                OR: [
                                    { variantName: { search: query } },
                                    { keywords: { search: query } },
                                ],
                            },
                        },
                    },
                ],
            },
            select: {
                slug: true,
                name: true,
                variants: {
                    take: 3, // 各商品最大3バリアント
                    select: {
                        slug: true,
                        variantName: true,
                        images: {
                            take: 1,
                            select: { url: true },
                        },
                    },
                },
            },
            take: 50, // 最大50件
        });

        // フロント用に整形
        const results = products.flatMap((product) =>
            product.variants.map((variant) => ({
                name: `${product.name} ・ ${variant.variantName}`,
                link: `/product/${product.slug}/${variant.slug}`,
                image: variant.images[0]?.url ?? "",
            }))
        );

        return NextResponse.json({ results }, { status: 200 });
    } catch (error: any) {
        console.error("MySQL search error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
