import { db } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * MySQL対応検索API（mode: "insensitive" を使用しない版）
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

        const searchQuery = query.trim();

        if (searchQuery.length === 0) {
            return NextResponse.json({ results: [] }, { status: 200 });
        }

        let products;

        try {
            // 方法1: FULLTEXT検索を使用
            products = await db.product.findMany({
                where: {
                    OR: [
                        { name: { search: searchQuery } },
                        { brand: { search: searchQuery } },
                        {
                            variants: {
                                some: {
                                    OR: [
                                        {
                                            variantName: {
                                                search: searchQuery,
                                            },
                                        },
                                        { keywords: { search: searchQuery } },
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
                        take: 3,
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
                take: 50,
            });
        } catch (searchError) {
            console.warn(
                "FULLTEXT search failed, falling back to contains search:",
                searchError
            );

            // 方法2: 通常のcontains検索（modeオプションなし）
            products = await db.product.findMany({
                where: {
                    OR: [
                        { name: { contains: searchQuery } },
                        { brand: { contains: searchQuery } },
                        { description: { contains: searchQuery } },
                        {
                            variants: {
                                some: {
                                    OR: [
                                        {
                                            variantName: {
                                                contains: searchQuery,
                                            },
                                        },
                                        { keywords: { contains: searchQuery } },
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
                        take: 3,
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
                take: 50,
            });
        }

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
        console.error("Search error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// GETメソッド（クエリパラメータでの検索用）
export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const searchQuery = url.searchParams.get("search");

        if (!searchQuery || typeof searchQuery !== "string") {
            return NextResponse.json(
                { products: [], total: 0 },
                { status: 200 }
            );
        }

        const trimmedQuery = searchQuery.trim();

        if (trimmedQuery.length === 0) {
            return NextResponse.json(
                { products: [], total: 0 },
                { status: 200 }
            );
        }

        // ページネーション用パラメータ
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const skip = (page - 1) * limit;

        let products, totalCount;

        try {
            // FULLTEXT検索を試行
            [products, totalCount] = await Promise.all([
                db.product.findMany({
                    where: {
                        OR: [
                            { name: { search: trimmedQuery } },
                            { brand: { search: trimmedQuery } },
                            {
                                variants: {
                                    some: {
                                        OR: [
                                            {
                                                variantName: {
                                                    search: trimmedQuery,
                                                },
                                            },
                                            {
                                                keywords: {
                                                    search: trimmedQuery,
                                                },
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                    },
                    include: {
                        store: {
                            select: {
                                id: true,
                                name: true,
                                logo: true,
                                averageRating: true,
                                url: true,
                            },
                        },
                        category: {
                            select: {
                                id: true,
                                name: true,
                                url: true,
                            },
                        },
                        subCategory: {
                            select: {
                                id: true,
                                name: true,
                                url: true,
                            },
                        },
                        variants: {
                            include: {
                                images: {
                                    take: 1,
                                    orderBy: {
                                        createdAt: "asc",
                                    },
                                },
                                sizes: {
                                    orderBy: {
                                        price: "asc",
                                    },
                                },
                            },
                            take: 1,
                        },
                        reviews: {
                            take: 5,
                            orderBy: {
                                createdAt: "desc",
                            },
                            select: {
                                rating: true,
                                review: true,
                                user: {
                                    select: {
                                        name: true,
                                    },
                                },
                            },
                        },
                    },
                    orderBy: [
                        { sales: "desc" },
                        { rating: "desc" },
                        { createdAt: "desc" },
                    ],
                    skip,
                    take: limit,
                }),
                db.product.count({
                    where: {
                        OR: [
                            { name: { search: trimmedQuery } },
                            { brand: { search: trimmedQuery } },
                            {
                                variants: {
                                    some: {
                                        OR: [
                                            {
                                                variantName: {
                                                    search: trimmedQuery,
                                                },
                                            },
                                            {
                                                keywords: {
                                                    search: trimmedQuery,
                                                },
                                            },
                                        ],
                                    },
                                },
                            },
                        ],
                    },
                }),
            ]);
        } catch (searchError) {
            console.warn(
                "FULLTEXT search failed, falling back to contains search:",
                searchError
            );

            // 通常のcontains検索にフォールバック
            const whereCondition = {
                OR: [
                    { name: { contains: trimmedQuery } },
                    { brand: { contains: trimmedQuery } },
                    { description: { contains: trimmedQuery } },
                    {
                        variants: {
                            some: {
                                OR: [
                                    { variantName: { contains: trimmedQuery } },
                                    { keywords: { contains: trimmedQuery } },
                                ],
                            },
                        },
                    },
                ],
            };

            [products, totalCount] = await Promise.all([
                db.product.findMany({
                    where: whereCondition,
                    include: {
                        store: {
                            select: {
                                id: true,
                                name: true,
                                logo: true,
                                averageRating: true,
                                url: true,
                            },
                        },
                        category: {
                            select: {
                                id: true,
                                name: true,
                                url: true,
                            },
                        },
                        subCategory: {
                            select: {
                                id: true,
                                name: true,
                                url: true,
                            },
                        },
                        variants: {
                            include: {
                                images: {
                                    take: 1,
                                    orderBy: {
                                        createdAt: "asc",
                                    },
                                },
                                sizes: {
                                    orderBy: {
                                        price: "asc",
                                    },
                                },
                            },
                            take: 1,
                        },
                        reviews: {
                            take: 5,
                            orderBy: {
                                createdAt: "desc",
                            },
                            select: {
                                rating: true,
                                review: true,
                                user: {
                                    select: {
                                        name: true,
                                    },
                                },
                            },
                        },
                    },
                    orderBy: [
                        { sales: "desc" },
                        { rating: "desc" },
                        { createdAt: "desc" },
                    ],
                    skip,
                    take: limit,
                }),
                db.product.count({ where: whereCondition }),
            ]);
        }

        return NextResponse.json(
            {
                products,
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
            },
            { status: 200 }
        );
    } catch (error: any) {
        console.error("Search error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
