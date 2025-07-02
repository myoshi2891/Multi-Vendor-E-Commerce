import client from "@/lib/elastic-search";
import { NextResponse } from "next/server";

// Define product type
interface Product {
    name: string;
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("search");

    if (!q || typeof q !== "string") {
        return NextResponse.json(
            {
                message: "Invalid search query",
            },
            { status: 400 }
        );
    }

    try {
        const response = await client.search<{ _source: Product }>({
            index: "products",
            body: {
                query: {
                    match_phrase_prefix: {
                        name: q,
                    },
                },
            },
        });
        const results = response.hits.hits.map((hit: any) => hit._source);
        return NextResponse.json(results);
    } catch (error: any) {
        console.error("Error fetching products:", error);
        return NextResponse.json(
            {
                message: "Failed to fetch products",
            },
            { status: 500 }
        );
    }
}
