import { db } from "@/lib/db";
import { normalizePageParam, normalizePositiveIntParam } from "@/lib/utils";
import { NextResponse } from "next/server";

/**
 * Handle POST search requests and return matching product–variant suggestions.
 *
 * Attempts a FULLTEXT search and falls back to a case-insensitive contains search if FULLTEXT is unavailable or fails.
 *
 * @returns A NextResponse containing JSON:
 * - Success (200): `{ results: Array<{ name: string; link: string; image: string }> }` where each result represents a product variant suggestion.
 * - Invalid input (400): `{ error: "Invalid query" }`.
 * - Server error (500): `{ error: "Internal Server Error" }` (詳細はサーバーログにのみ出力).
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

            // 方法2: 通常のcontains検索（PostgreSQL: case-insensitive）
            products = await db.product.findMany({
                where: {
                    OR: [
                        { name: { contains: searchQuery, mode: "insensitive" } },
                        { brand: { contains: searchQuery, mode: "insensitive" } },
                        { description: { contains: searchQuery, mode: "insensitive" } },
                        {
                            variants: {
                                some: {
                                    OR: [
                                        {
                                            variantName: {
                                                contains: searchQuery,
                                                mode: "insensitive",
                                            },
                                        },
                                        { keywords: { contains: searchQuery, mode: "insensitive" } },
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
    } catch (error: unknown) {
        // 詳細はサーバー側にのみ残し、クライアントへは固定メッセージを返す
        // （内部例外文字列＝DB ドライバのメッセージ等の漏洩を防ぐ）
        console.error("Search error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}

/**
 * Searches products by the "search" query parameter and returns paginated results.
 *
 * Attempts a FULLTEXT search first and falls back to a case-insensitive contains search if FULLTEXT fails.
 *
 * @returns A JSON HTTP response:
 * - On success: { products, total, page, limit, totalPages } where `products` is an array of product records with related store, category, subCategory, variants (with first image and sizes) and recent reviews; `total` is the total match count and `totalPages` is Math.ceil(total / limit).
 * - If the search parameter is missing or empty: { products: [], total: 0 }.
 * - On server error: { error: "Internal Server Error" } with status 500 (詳細はサーバーログにのみ出力).
 */
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

        // ページネーション用パラメータ。NaN / 負値は既定値へフォールバックし、
        // 小数は切り捨て、過大値は上限へクランプする（いずれも拒否はしない）。
        const MAX_LIMIT = 50; // POST ハンドラの take:50 と一致させる
        const page = normalizePageParam(url.searchParams.get("page")); // 下限 1・上限 MAX_PAGE
        const limit = normalizePositiveIntParam(url.searchParams.get("limit"), {
            fallback: 20,
            max: MAX_LIMIT,
        });
        const skip = (page - 1) * limit; // page/limit 双方が有界なので skip も有界

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

            // 通常のcontains検索にフォールバック（PostgreSQL: case-insensitive）
            const whereCondition = {
                OR: [
                    { name: { contains: trimmedQuery, mode: "insensitive" as const } },
                    { brand: { contains: trimmedQuery, mode: "insensitive" as const } },
                    { description: { contains: trimmedQuery, mode: "insensitive" as const } },
                    {
                        variants: {
                            some: {
                                OR: [
                                    { variantName: { contains: trimmedQuery, mode: "insensitive" as const } },
                                    { keywords: { contains: trimmedQuery, mode: "insensitive" as const } },
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
    } catch (error: unknown) {
        // 詳細はサーバー側にのみ残し、クライアントへは固定メッセージを返す
        // （内部例外文字列＝DB ドライバのメッセージ等の漏洩を防ぐ）
        console.error("Search error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
