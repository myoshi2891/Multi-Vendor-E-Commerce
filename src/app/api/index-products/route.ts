import { db } from "@/lib/db";
import client from "@/lib/elastic-search";
import { NextResponse } from "next/server";

export async function POST() {
    try {
        // インデックスが存在するか確認
        const indexExists = await client.indices.exists({ index: "products" });

        // 存在する場合のみ削除
        if (indexExists) {
            await client.indices.delete({ index: "products" });
        }

        // 商品とバリアントを取得
        const products = await db.product.findMany({
            include: {
                variants: {
                    include: {
                        images: {
                            take: 1,
                        },
                    },
                },
            },
        });

        // Elasticsearch用のバルクリクエストボディを作成
        const body = products.flatMap((product) =>
            product.variants.flatMap((variant) => [
                {
                    index: { _index: "products", _id: variant.id },
                },
                {
                    name: `${product.name} ・ ${variant.variantName}`,
                    link: `/product/${product.slug}/${variant.slug}`,
                    image: variant.images[0]?.url ?? "",
                },
            ])
        );

        // バルクインデックス処理
        const bulkResponse = await client.bulk({ refresh: true, body });

        if (bulkResponse.errors) {
            return NextResponse.json(
                { error: "Failed to index products and variants" },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { message: "Products indexed successfully" },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("Elasticsearch indexing error:", error);
        return new NextResponse(JSON.stringify({ error: error.message }), {
            status: 500,
        });
    }
}
