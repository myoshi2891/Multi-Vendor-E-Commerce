import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);

    // 検索パラメータの取得
    const q = searchParams.get("search") || "";
    const categoryId = searchParams.get("categoryId");
    const subCategoryId = searchParams.get("subCategoryId");
    const storeId = searchParams.get("storeId");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const sortBy = searchParams.get("sortBy") || "relevance"; // relevance, price_asc, price_desc, rating, newest
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const inStock = searchParams.get("inStock") === "true";

    try {
        // 検索条件の構築
        const whereConditions: any = {};

        // テキスト検索
        if (q) {
            whereConditions.OR = [
                {
                    name: {
                        contains: q,
                        mode: "insensitive",
                    },
                },
                {
                    description: {
                        contains: q,
                        mode: "insensitive",
                    },
                },
                {
                    brand: {
                        contains: q,
                        mode: "insensitive",
                    },
                },
                {
                    variants: {
                        some: {
                            keywords: {
                                contains: q,
                                mode: "insensitive",
                            },
                        },
                    },
                },
            ];
        }

        // カテゴリフィルター
        if (categoryId) {
            whereConditions.categoryId = categoryId;
        }

        if (subCategoryId) {
            whereConditions.subCategoryId = subCategoryId;
        }

        // ストアフィルター
        if (storeId) {
            whereConditions.storeId = storeId;
        }

        // 価格フィルター
        if (minPrice || maxPrice) {
            whereConditions.variants = {
                some: {
                    sizes: {
                        some: {
                            price: {
                                ...(minPrice && { gte: parseFloat(minPrice) }),
                                ...(maxPrice && { lte: parseFloat(maxPrice) }),
                            },
                        },
                    },
                },
            };
        }

        // 在庫フィルター
        if (inStock) {
            whereConditions.variants = {
                some: {
                    sizes: {
                        some: {
                            quantity: {
                                gt: 0,
                            },
                        },
                    },
                },
            };
        }

        // ソート条件の構築
        let orderBy: any = [];
        switch (sortBy) {
            case "price_asc":
                orderBy = [{ variants: { _count: "desc" } }]; // 暫定的な並び順
                break;
            case "price_desc":
                orderBy = [{ variants: { _count: "desc" } }]; // 暫定的な並び順
                break;
            case "rating":
                orderBy = [{ rating: "desc" }, { numReviews: "desc" }];
                break;
            case "newest":
                orderBy = [{ createdAt: "desc" }];
                break;
            case "popular":
                orderBy = [{ sales: "desc" }, { views: "desc" }];
                break;
            default: // relevance
                orderBy = [
                    { sales: "desc" },
                    { rating: "desc" },
                    { createdAt: "desc" },
                ];
        }

        // 検索実行
        const [products, totalCount] = await Promise.all([
            prisma.product.findMany({
                where: whereConditions,
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
                                where: inStock
                                    ? {
                                          quantity: { gt: 0 },
                                      }
                                    : undefined,
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
                orderBy,
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.product.count({
                where: whereConditions,
            }),
        ]);

        // レスポンス用にデータを整形
        const formattedProducts = products.map((product) => {
            const firstVariant = product.variants[0];
            const firstImage = firstVariant?.images[0];
            const lowestPrice =
                firstVariant?.sizes.reduce(
                    (min, size) => (size.price < min ? size.price : min),
                    firstVariant.sizes[0]?.price || 0
                ) || 0;
            const highestPrice =
                firstVariant?.sizes.reduce(
                    (max, size) => (size.price > max ? size.price : max),
                    0
                ) || 0;
            const availableSizes =
                firstVariant?.sizes.filter((size) => size.quantity > 0) || [];

            return {
                id: product.id,
                name: product.name,
                description: product.description,
                slug: product.slug,
                brand: product.brand,
                rating: product.rating,
                sales: product.sales,
                numReviews: product.numReviews,
                views: product.views,
                store: product.store,
                category: product.category,
                subCategory: product.subCategory,
                variant: firstVariant
                    ? {
                          id: firstVariant.id,
                          name: firstVariant.variantName,
                          image: firstVariant.variantImage,
                          slug: firstVariant.slug,
                          isSale: firstVariant.isSale,
                          saleEndDate: firstVariant.saleEndDate,
                          sku: firstVariant.sku,
                          images: firstVariant.images,
                      }
                    : null,
                image: firstImage?.url || firstVariant?.variantImage || null,
                priceRange: {
                    min: lowestPrice,
                    max: highestPrice,
                    currency: "USD",
                },
                inStock: availableSizes.length > 0,
                availableQuantity: availableSizes.reduce(
                    (sum, size) => sum + size.quantity,
                    0
                ),
                recentReviews: product.reviews,
            };
        });

        // ページネーション情報
        const totalPages = Math.ceil(totalCount / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        return NextResponse.json({
            products: formattedProducts,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages,
                hasNextPage,
                hasPrevPage,
            },
            filters: {
                searchQuery: q,
                categoryId,
                subCategoryId,
                storeId,
                priceRange: { min: minPrice, max: maxPrice },
                sortBy,
                inStock,
            },
        });
    } catch (error: any) {
        console.error("Error fetching products:", error);

        return NextResponse.json(
            {
                message: "Failed to fetch products",
                error:
                    process.env.NODE_ENV === "development"
                        ? error.message
                        : undefined,
            },
            { status: 500 }
        );
    } finally {
        await prisma.$disconnect();
    }
}
