import { currentUser } from "@clerk/nextjs/server";
import {
    upsertProduct,
    getProductMainInfo,
    getAllStoreProducts,
    deleteProduct,
    getProducts,
    retrieveProductDetails,
    getRatingStatistics,
    getShippingDetails,
    getProductFilteredReviews,
    getDeliveryDetailsForStoreByCountry,
    getProductShippingFee,
    getProductsByIds,
} from "./product";
import { TEST_CONFIG } from "../config/test-config";
import {
    createMockStore,
    createMockProduct,
    createMockProductVariant,
    createMockSize,
    createMockVariantImage,
    createMockCategory,
    createMockSubCategory,
    createMockCountry,
} from "../config/test-fixtures";

// ---- モック設定 ----
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
    db: {
        product: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            delete: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
        },
        productVariant: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            count: jest.fn(),
            findFirst: jest.fn(),
        },
        store: {
            findUnique: jest.fn(),
        },
        category: {
            findUnique: jest.fn(),
        },
        subCategory: {
            findUnique: jest.fn(),
        },
        offerTag: {
            findUnique: jest.fn(),
        },
        country: {
            findUnique: jest.fn(),
        },
        shippingRate: {
            findFirst: jest.fn(),
        },
        review: {
            groupBy: jest.fn(),
            count: jest.fn(),
            findMany: jest.fn(),
        },
    },
}));

jest.mock("cookies-next", () => ({
    getCookie: jest.fn(),
}));

jest.mock("next/headers", () => ({
    cookies: jest.fn(),
}));

jest.mock("slugify", () =>
    jest.fn((str: string) => str.toLowerCase().replace(/\s+/g, "-"))
);

const mockDb = require("@/lib/db").db;

beforeEach(() => {
    jest.clearAllMocks();
});

// ---- テスト用ヘルパー ----
const createMockProductWithVariantInput = (
    overrides: Record<string, unknown> = {}
) => ({
    productId: "product-new",
    variantId: "variant-new",
    name: "New Product",
    description: "A test product description",
    variantName: "Red Edition",
    variantDescription: "Red variant",
    images: [{ url: "https://example.com/img1.jpg" }],
    variantImage: "https://example.com/variant.jpg",
    categoryId: "category-001",
    subCategoryId: "subcategory-001",
    offerTagId: undefined,
    isSale: false,
    saleEndDate: null,
    brand: "Test Brand",
    sku: "SKU-001",
    weight: 0.5,
    colors: [{ color: "Red" }],
    sizes: [{ size: "M", quantity: 10, price: 29.99, discount: 0 }],
    product_specs: [{ name: "Material", value: "Cotton" }],
    variant_specs: [{ name: "Color", value: "Red" }],
    keywords: ["test", "product"],
    questions: [{ question: "Size?", answer: "True to size" }],
    freeShippingForAllCountries: false,
    freeShippingCountriesIds: [],
    shippingFeeMethod: "ITEM" as const,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

// ==================================================
// upsertProduct
// ==================================================
describe("upsertProduct", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(
                upsertProduct(
                    createMockProductWithVariantInput() as never,
                    "test-store"
                )
            ).rejects.toThrow("Unauthenticated.");
        });

        it("SELLERロール以外の場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "USER" },
            });

            await expect(
                upsertProduct(
                    createMockProductWithVariantInput() as never,
                    "test-store"
                )
            ).rejects.toThrow("Only sellers can perform this action.");
        });
    });

    describe("バリデーション", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
        });

        it("商品データがnullの場合エラーをスローする", async () => {
            await expect(
                upsertProduct(null as never, "test-store")
            ).rejects.toThrow("Please provide product data.");
        });

        it("存在しないストアの場合エラーをスローする（IDOR防止: userId検証）", async () => {
            mockDb.store.findUnique.mockResolvedValue(null);

            await expect(
                upsertProduct(
                    createMockProductWithVariantInput() as never,
                    "other-store"
                )
            ).rejects.toThrow('Store with URL "other-store" not found.');

            expect(mockDb.store.findUnique).toHaveBeenCalledWith({
                where: {
                    url: "other-store",
                    userId: TEST_CONFIG.DEFAULT_USER_ID,
                },
            });
        });
    });

    describe("新規商品作成", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
            // generateUniqueSlug: 初回で一意なslugが見つかる
            mockDb.product.findFirst.mockResolvedValue(null);
            mockDb.productVariant.findFirst.mockResolvedValue(null);
        });

        it("商品もバリアントも存在しない場合、新規作成する", async () => {
            mockDb.product.findUnique.mockResolvedValue(null);
            mockDb.productVariant.findUnique.mockResolvedValue(null);
            mockDb.product.create.mockResolvedValue(createMockProduct());

            await upsertProduct(
                createMockProductWithVariantInput() as never,
                TEST_CONFIG.TEST_STORE_URL
            );

            expect(mockDb.product.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        name: "New Product",
                        store: {
                            connect: { id: TEST_CONFIG.DEFAULT_STORE_ID },
                        },
                        category: { connect: { id: "category-001" } },
                        subCategory: { connect: { id: "subcategory-001" } },
                    }),
                })
            );
        });

        it("バリアントのslugが正しく生成される", async () => {
            mockDb.product.findUnique.mockResolvedValue(null);
            mockDb.productVariant.findUnique.mockResolvedValue(null);
            mockDb.product.create.mockResolvedValue(createMockProduct());

            await upsertProduct(
                createMockProductWithVariantInput() as never,
                TEST_CONFIG.TEST_STORE_URL
            );

            // slugifyのモックが呼ばれ、結果がslugとして使われる
            const slugify = require("slugify");
            expect(slugify).toHaveBeenCalledWith("New Product", {
                replacement: "-",
                lower: true,
                trim: true,
            });
        });
    });

    describe("既存商品への新規バリアント追加", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
            mockDb.productVariant.findFirst.mockResolvedValue(null);
        });

        it("既存商品に新しいバリアントを追加する", async () => {
            mockDb.product.findUnique.mockResolvedValue(createMockProduct());
            mockDb.productVariant.findUnique.mockResolvedValue(null);
            mockDb.productVariant.create.mockResolvedValue(
                createMockProductVariant()
            );

            await upsertProduct(
                createMockProductWithVariantInput() as never,
                TEST_CONFIG.TEST_STORE_URL
            );

            expect(mockDb.productVariant.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        productId: "product-new",
                        variantName: "Red Edition",
                    }),
                })
            );
        });
    });
});

// ==================================================
// getProductMainInfo
// ==================================================
describe("getProductMainInfo", () => {
    it("存在しない商品の場合nullを返す", async () => {
        mockDb.product.findUnique.mockResolvedValue(null);

        const result = await getProductMainInfo("nonexistent");

        expect(result).toBeNull();
    });

    it("商品の主要情報を正しい構造で返す", async () => {
        const product = {
            ...createMockProduct(),
            questions: [{ question: "Q?", answer: "A" }],
            specs: [{ name: "Material", value: "Metal" }],
        };
        mockDb.product.findUnique.mockResolvedValue(product);

        const result = await getProductMainInfo("product-001");

        expect(result).toEqual(
            expect.objectContaining({
                productId: "product-001",
                name: "Test Product",
                brand: "Test Brand",
                categoryId: "category-001",
                subCategoryId: "subcategory-001",
                shippingFeeMethod: "ITEM",
                questions: [{ question: "Q?", answer: "A" }],
                product_specs: [{ name: "Material", value: "Metal" }],
            })
        );
    });

    it("questions と specs をincludeしてクエリする", async () => {
        mockDb.product.findUnique.mockResolvedValue(null);

        await getProductMainInfo("product-001");

        expect(mockDb.product.findUnique).toHaveBeenCalledWith({
            where: { id: "product-001" },
            include: { questions: true, specs: true },
        });
    });
});

// ==================================================
// getAllStoreProducts
// ==================================================
describe("getAllStoreProducts", () => {
    it("存在しないストアの場合エラーをスローする", async () => {
        mockDb.store.findUnique.mockResolvedValue(null);

        await expect(getAllStoreProducts("nonexistent")).rejects.toThrow(
            'Store with URL "nonexistent" not found.'
        );
    });

    it("ストアに紐づく全商品を返す", async () => {
        mockDb.store.findUnique.mockResolvedValue(createMockStore());
        const products = [createMockProduct(), createMockProduct({ id: "p2" })];
        mockDb.product.findMany.mockResolvedValue(products);

        const result = await getAllStoreProducts(TEST_CONFIG.TEST_STORE_URL);

        expect(result).toHaveLength(2);
        expect(mockDb.product.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { storeId: TEST_CONFIG.DEFAULT_STORE_ID },
                include: expect.objectContaining({
                    category: true,
                    subCategory: true,
                    offerTag: true,
                    variants: expect.any(Object),
                }),
            })
        );
    });
});

// ==================================================
// deleteProduct
// ==================================================
describe("deleteProduct", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(deleteProduct("product-001")).rejects.toThrow(
                "Unauthenticated."
            );
        });

        it("SELLERロール以外の場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "USER" },
            });

            await expect(deleteProduct("product-001")).rejects.toThrow(
                "Only sellers and administrators can perform this action."
            );
        });
    });

    describe("バリデーション", () => {
        it("空のproductIdの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });

            await expect(deleteProduct("")).rejects.toThrow(
                "Please provide product ID."
            );
        });
    });

    describe("正常系", () => {
        it("商品を正常に削除する", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
            mockDb.product.delete.mockResolvedValue(createMockProduct());

            const result = await deleteProduct("product-001");

            expect(result).toEqual(createMockProduct());
            expect(mockDb.product.delete).toHaveBeenCalledWith({
                where: { id: "product-001" },
            });
        });
    });
});

// ==================================================
// getProducts
// ==================================================
describe("getProducts", () => {
    beforeEach(() => {
        mockDb.product.findMany.mockResolvedValue([]);
    });

    describe("検索フィルタ", () => {
        it("検索語にcase-insensitiveモードが含まれる", async () => {
            await getProducts({ search: "iphone" });

            expect(mockDb.product.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        AND: expect.arrayContaining([
                            expect.objectContaining({
                                OR: expect.arrayContaining([
                                    {
                                        name: {
                                            contains: "iphone",
                                            mode: "insensitive",
                                        },
                                    },
                                    {
                                        description: {
                                            contains: "iphone",
                                            mode: "insensitive",
                                        },
                                    },
                                ]),
                            }),
                        ]),
                    }),
                })
            );
        });

        it("バリアント名・説明もOR条件で検索する", async () => {
            await getProducts({ search: "Pro Max" });

            const callArgs = mockDb.product.findMany.mock.calls[0][0];
            const searchClause = callArgs.where.AND.find(
                (c: Record<string, unknown>) => "OR" in c
            );
            const variantClause = searchClause.OR.find(
                (c: Record<string, unknown>) => "variants" in c
            );

            // バリアント検索はsome.OR内にvariantNameとvariantDescriptionが分離されている
            expect(variantClause.variants.some.OR).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        variantName: {
                            contains: "Pro Max",
                            mode: "insensitive",
                        },
                    }),
                    expect.objectContaining({
                        variantDescription: {
                            contains: "Pro Max",
                            mode: "insensitive",
                        },
                    }),
                ])
            );
        });

        it("検索フィルタなしの場合はcontainsが呼ばれない", async () => {
            await getProducts({});

            const callArgs = mockDb.product.findMany.mock.calls[0][0];
            const whereAnd = callArgs.where.AND;
            const hasContains = whereAnd.some(
                (clause: Record<string, unknown>) =>
                    JSON.stringify(clause).includes("contains")
            );

            expect(hasContains).toBe(false);
        });
    });

    describe("フィルタ適用", () => {
        it("ストアURLでフィルタする", async () => {
            mockDb.store.findUnique.mockResolvedValue({
                id: "store-123",
            });

            await getProducts({ store: "my-store" });

            expect(mockDb.store.findUnique).toHaveBeenCalledWith({
                where: { url: "my-store" },
                select: { id: true },
            });
        });

        it("カテゴリURLでフィルタする", async () => {
            mockDb.category.findUnique.mockResolvedValue({
                id: "cat-123",
            });

            await getProducts({ category: "electronics" });

            expect(mockDb.category.findUnique).toHaveBeenCalledWith({
                where: { url: "electronics" },
                select: { id: true },
            });
        });

        it("サブカテゴリURLでフィルタする", async () => {
            mockDb.subCategory.findUnique.mockResolvedValue({
                id: "subcat-123",
            });

            await getProducts({ subCategory: "smartphones" });

            expect(mockDb.subCategory.findUnique).toHaveBeenCalledWith({
                where: { url: "smartphones" },
                select: { id: true },
            });
        });

        it("オファータグURLでフィルタする", async () => {
            mockDb.offerTag.findUnique.mockResolvedValue({
                id: "offer-123",
            });

            await getProducts({ offer: "summer-sale" });

            expect(mockDb.offerTag.findUnique).toHaveBeenCalledWith({
                where: { url: "summer-sale" },
                select: { id: true },
            });
        });

        it("価格範囲でフィルタする", async () => {
            await getProducts({ minPrice: 10, maxPrice: 100 });

            const callArgs = mockDb.product.findMany.mock.calls[0][0];
            const priceClause = callArgs.where.AND.find(
                (c: Record<string, unknown>) =>
                    JSON.stringify(c).includes("price")
            );

            expect(priceClause).toEqual({
                variants: {
                    some: {
                        sizes: {
                            some: {
                                price: { gte: 10, lte: 100 },
                            },
                        },
                    },
                },
            });
        });

        it("サイズ配列でフィルタする", async () => {
            await getProducts({ size: ["S", "M"] });

            const callArgs = mockDb.product.findMany.mock.calls[0][0];
            const sizeClause = callArgs.where.AND.find(
                (c: Record<string, unknown>) =>
                    JSON.stringify(c).includes("size")
            );

            expect(sizeClause).toEqual({
                variants: {
                    some: {
                        sizes: {
                            some: {
                                size: { in: ["S", "M"] },
                            },
                        },
                    },
                },
            });
        });

        it("カラーでフィルタする", async () => {
            await getProducts({ color: ["Red", "Blue"] });

            const callArgs = mockDb.product.findMany.mock.calls[0][0];
            const colorClause = callArgs.where.AND.find(
                (c: Record<string, unknown>) =>
                    JSON.stringify(c).includes("colors")
            );

            expect(colorClause).toEqual({
                variants: {
                    some: {
                        colors: {
                            some: {
                                name: { in: ["Red", "Blue"] },
                            },
                        },
                    },
                },
            });
        });
    });

    describe("ソート", () => {
        it("デフォルトはviews降順（most-popular）", async () => {
            await getProducts({}, "");

            expect(mockDb.product.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: { views: "desc" },
                })
            );
        });

        it("new-arrivals: createdAt降順", async () => {
            await getProducts({}, "new-arrivals");

            expect(mockDb.product.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: { createdAt: "desc" },
                })
            );
        });

        it("top-rated: rating降順", async () => {
            await getProducts({}, "top-rated");

            expect(mockDb.product.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: { rating: "desc" },
                })
            );
        });

        it("price-low-to-high: 割引後価格の昇順でソートされる", async () => {
            const products = [
                {
                    ...createMockProduct({ id: "p1", slug: "p1" }),
                    variants: [
                        {
                            ...createMockProductVariant(),
                            images: [createMockVariantImage()],
                            colors: [],
                            sizes: [
                                createMockSize({ price: 50, discount: 0 }),
                            ],
                        },
                    ],
                },
                {
                    ...createMockProduct({ id: "p2", slug: "p2" }),
                    variants: [
                        {
                            ...createMockProductVariant({ id: "v2" }),
                            images: [createMockVariantImage()],
                            colors: [],
                            sizes: [
                                createMockSize({ price: 20, discount: 0 }),
                            ],
                        },
                    ],
                },
            ];
            mockDb.product.findMany.mockResolvedValue(products);

            const result = await getProducts({}, "price-low-to-high");

            // p2 ($20) が p1 ($50) より前に来る
            expect(result.products[0].id).toBe("p2");
            expect(result.products[1].id).toBe("p1");
        });
    });

    describe("ページネーション", () => {
        it("skip/takeが正しく計算される", async () => {
            await getProducts({}, "", 3, 20);

            expect(mockDb.product.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    take: 20,
                    skip: 40, // (3-1) * 20
                })
            );
        });

        it("totalPagesが正しく計算される", async () => {
            const products = Array(5)
                .fill(null)
                .map((_, i) => ({
                    ...createMockProduct({ id: `p${i}`, slug: `p${i}` }),
                    variants: [
                        {
                            ...createMockProductVariant({ id: `v${i}` }),
                            images: [createMockVariantImage()],
                            colors: [],
                            sizes: [createMockSize()],
                        },
                    ],
                }));
            mockDb.product.findMany.mockResolvedValue(products);

            const result = await getProducts({}, "", 1, 2);

            expect(result.totalCount).toBe(5);
            expect(result.totalPages).toBe(3); // ceil(5/2)
            expect(result.currentPage).toBe(1);
            expect(result.pageSize).toBe(2);
        });
    });
});

// ==================================================
// retrieveProductDetails
// ==================================================
describe("retrieveProductDetails", () => {
    it("存在しない商品の場合nullを返す", async () => {
        mockDb.product.findUnique.mockResolvedValue(null);

        const result = await retrieveProductDetails(
            "nonexistent",
            "variant-slug"
        );

        expect(result).toBeNull();
    });

    it("商品とバリアント情報を含めて返す", async () => {
        const product = {
            ...createMockProduct(),
            category: createMockCategory(),
            subCategory: createMockSubCategory(),
            offerTag: null,
            store: createMockStore(),
            specs: [],
            questions: [],
            reviews: [],
            freeShipping: null,
            variants: [
                {
                    ...createMockProductVariant(),
                    images: [createMockVariantImage()],
                    colors: [{ name: "Red" }],
                    sizes: [createMockSize()],
                    specs: [],
                },
            ],
        };
        mockDb.product.findUnique.mockResolvedValue(product);
        mockDb.productVariant.findMany.mockResolvedValue([
            {
                ...createMockProductVariant(),
                variantImage: "https://example.com/v1.jpg",
                images: [createMockVariantImage()],
                sizes: [createMockSize()],
                colors: [{ name: "Red" }],
                product: { slug: "test-product" },
            },
        ]);

        const result = await retrieveProductDetails(
            "test-product",
            "red-edition"
        );

        expect(result).toBeDefined();
        expect(result!.variantsInfo).toHaveLength(1);
        expect(result!.variantsInfo[0].variantUrl).toBe(
            "/product/test-product/red-edition"
        );
    });

    it("variantSlugでフィルタしてクエリする", async () => {
        mockDb.product.findUnique.mockResolvedValue(null);

        await retrieveProductDetails("prod-slug", "var-slug");

        expect(mockDb.product.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { slug: "prod-slug" },
                include: expect.objectContaining({
                    variants: expect.objectContaining({
                        where: { slug: "var-slug" },
                    }),
                }),
            })
        );
    });
});

// ==================================================
// getRatingStatistics
// ==================================================
describe("getRatingStatistics", () => {
    it("レビューがない場合、全て0を返す", async () => {
        mockDb.review.groupBy.mockResolvedValue([]);
        mockDb.review.count.mockResolvedValue(0);

        const result = await getRatingStatistics("product-001");

        expect(result.totalReviews).toBe(0);
        expect(result.ratingStatistics).toHaveLength(5);
        result.ratingStatistics.forEach((stat) => {
            expect(stat.numReviews).toBe(0);
            expect(stat.percentage).toBe(0);
        });
    });

    it("レーティング分布を正しく計算する", async () => {
        mockDb.review.groupBy.mockResolvedValue([
            { rating: 5, _count: { rating: 8 } },
            { rating: 4, _count: { rating: 5 } },
            { rating: 3, _count: { rating: 2 } },
            { rating: 1, _count: { rating: 5 } },
        ]);
        mockDb.review.count.mockResolvedValue(3);

        const result = await getRatingStatistics("product-001");

        expect(result.totalReviews).toBe(20);
        expect(result.ratingStatistics[4]).toEqual({
            rating: 5,
            numReviews: 8,
            percentage: 40, // 8/20*100
        });
        expect(result.ratingStatistics[3]).toEqual({
            rating: 4,
            numReviews: 5,
            percentage: 25,
        });
        // 星2はデータなし → 0
        expect(result.ratingStatistics[1]).toEqual({
            rating: 2,
            numReviews: 0,
            percentage: 0,
        });
    });

    it("画像付きレビュー数を返す", async () => {
        mockDb.review.groupBy.mockResolvedValue([
            { rating: 5, _count: { rating: 3 } },
        ]);
        mockDb.review.count.mockResolvedValue(2);

        const result = await getRatingStatistics("product-001");

        expect(result.reviewsWithImagesCount).toBe(2);
        expect(mockDb.review.count).toHaveBeenCalledWith({
            where: {
                productId: "product-001",
                images: { some: {} },
            },
        });
    });
});

// ==================================================
// getShippingDetails
// ==================================================
describe("getShippingDetails", () => {
    const userCountry = { name: "Japan", code: "JP", city: "Tokyo" };
    const store = createMockStore();

    it("国が見つからない場合falseを返す", async () => {
        mockDb.country.findUnique.mockResolvedValue(null);

        const result = await getShippingDetails(
            "ITEM",
            userCountry,
            store as never,
            null
        );

        expect(result).toBe(false);
    });

    describe("配送方式別計算", () => {
        beforeEach(() => {
            mockDb.country.findUnique.mockResolvedValue(
                createMockCountry()
            );
        });

        it("ITEM方式: 配送レートの値を使用する", async () => {
            mockDb.shippingRate.findFirst.mockResolvedValue({
                shippingFeePerItem: 8.0,
                shippingFeeForAdditionalItem: 3.0,
                shippingFeePerKg: 0,
                shippingFeeFixed: 0,
                deliveryTimeMin: 5,
                deliveryTimeMax: 10,
                shippingService: "Express",
                returnPolicy: "30 days",
            });

            const result = await getShippingDetails(
                "ITEM",
                userCountry,
                store as never,
                null
            );

            expect(result).toEqual(
                expect.objectContaining({
                    shippingFeeMethod: "ITEM",
                    shippingFee: 8.0,
                    extraShippingFee: 3.0,
                    shippingService: "Express",
                    deliveryTimeMin: 5,
                    deliveryTimeMax: 10,
                })
            );
        });

        it("WEIGHT方式: 重量ベースの料金を返す", async () => {
            mockDb.shippingRate.findFirst.mockResolvedValue({
                shippingFeePerItem: 0,
                shippingFeeForAdditionalItem: 0,
                shippingFeePerKg: 5.0,
                shippingFeeFixed: 0,
                deliveryTimeMin: 7,
                deliveryTimeMax: 14,
                shippingService: "Standard",
                returnPolicy: "14 days",
            });

            const result = await getShippingDetails(
                "WEIGHT",
                userCountry,
                store as never,
                null
            );

            expect(result).toEqual(
                expect.objectContaining({
                    shippingFeeMethod: "WEIGHT",
                    shippingFee: 5.0,
                })
            );
        });

        it("FIXED方式: 固定料金を返す", async () => {
            mockDb.shippingRate.findFirst.mockResolvedValue({
                shippingFeePerItem: 0,
                shippingFeeForAdditionalItem: 0,
                shippingFeePerKg: 0,
                shippingFeeFixed: 15.0,
                deliveryTimeMin: 3,
                deliveryTimeMax: 7,
                shippingService: "Economy",
                returnPolicy: "7 days",
            });

            const result = await getShippingDetails(
                "FIXED",
                userCountry,
                store as never,
                null
            );

            expect(result).toEqual(
                expect.objectContaining({
                    shippingFeeMethod: "FIXED",
                    shippingFee: 15.0,
                })
            );
        });

        it("配送レートがない場合、ストアデフォルトにフォールバックする", async () => {
            mockDb.shippingRate.findFirst.mockResolvedValue(null);

            const result = await getShippingDetails(
                "ITEM",
                userCountry,
                store as never,
                null
            );

            expect(result).toEqual(
                expect.objectContaining({
                    shippingFee: store.defaultShippingFeePerItem,
                    extraShippingFee:
                        store.defaultShippingFeeForAdditionalItem,
                    deliveryTimeMin: store.defaultDeliveryTimeMin,
                    deliveryTimeMax: store.defaultDeliveryTimeMax,
                })
            );
        });

        it("無料配送対象国の場合、料金が0になる", async () => {
            mockDb.shippingRate.findFirst.mockResolvedValue({
                shippingFeePerItem: 10.0,
                shippingFeeForAdditionalItem: 5.0,
                shippingFeePerKg: 0,
                shippingFeeFixed: 0,
                deliveryTimeMin: 3,
                deliveryTimeMax: 7,
                shippingService: "Standard",
                returnPolicy: "30 days",
            });

            const freeShipping = {
                id: "fs-001",
                productId: "product-001",
                eligibleCountries: [
                    { id: "fsc-001", countryId: "country-001", freeShippingId: "fs-001" },
                ],
            };

            const result = await getShippingDetails(
                "ITEM",
                userCountry,
                store as never,
                freeShipping as never
            );

            expect(result).toEqual(
                expect.objectContaining({
                    isFreeShipping: true,
                    shippingFee: 0,
                    extraShippingFee: 0,
                })
            );
        });

        it("ユーザーの国情報をレスポンスに含める", async () => {
            mockDb.shippingRate.findFirst.mockResolvedValue(null);

            const result = await getShippingDetails(
                "ITEM",
                userCountry,
                store as never,
                null
            );

            expect(result).toEqual(
                expect.objectContaining({
                    countryCode: "JP",
                    countryName: "Japan",
                    city: "Tokyo",
                })
            );
        });
    });
});

// ==================================================
// getProductFilteredReviews
// ==================================================
describe("getProductFilteredReviews", () => {
    it("フィルタなしで全レビューを取得する", async () => {
        const reviews = [
            { id: "r1", rating: 5, images: [], user: {} },
            { id: "r2", rating: 3, images: [], user: {} },
        ];
        mockDb.review.findMany.mockResolvedValue(reviews);

        const result = await getProductFilteredReviews(
            "product-001",
            {},
            undefined
        );

        expect(result).toHaveLength(2);
        expect(mockDb.review.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { productId: "product-001" },
                orderBy: { rating: "desc" }, // デフォルト
            })
        );
    });

    it("レーティングでフィルタする（±0.5の範囲）", async () => {
        mockDb.review.findMany.mockResolvedValue([]);

        await getProductFilteredReviews(
            "product-001",
            { rating: 4 },
            undefined
        );

        expect(mockDb.review.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    rating: { in: [4, 4.5] },
                }),
            })
        );
    });

    it("画像付きレビューでフィルタする", async () => {
        mockDb.review.findMany.mockResolvedValue([]);

        await getProductFilteredReviews(
            "product-001",
            { hasImages: true },
            undefined
        );

        expect(mockDb.review.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    images: { some: {} },
                }),
            })
        );
    });

    it("latest: createdAt降順でソートする", async () => {
        mockDb.review.findMany.mockResolvedValue([]);

        await getProductFilteredReviews(
            "product-001",
            {},
            { orderBy: "latest" }
        );

        expect(mockDb.review.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: { createdAt: "desc" },
            })
        );
    });

    it("oldest: createdAt昇順でソートする", async () => {
        mockDb.review.findMany.mockResolvedValue([]);

        await getProductFilteredReviews(
            "product-001",
            {},
            { orderBy: "oldest" }
        );

        expect(mockDb.review.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                orderBy: { createdAt: "asc" },
            })
        );
    });

    it("ページネーションが正しく適用される", async () => {
        mockDb.review.findMany.mockResolvedValue([]);

        await getProductFilteredReviews(
            "product-001",
            {},
            undefined,
            3,
            10
        );

        expect(mockDb.review.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                skip: 20, // (3-1) * 10
                take: 10,
            })
        );
    });
});

// ==================================================
// getDeliveryDetailsForStoreByCountry
// ==================================================
describe("getDeliveryDetailsForStoreByCountry", () => {
    it("配送レートがある場合、そのレートの値を返す", async () => {
        mockDb.shippingRate.findFirst.mockResolvedValue({
            shippingService: "DHL Express",
            deliveryTimeMin: 2,
            deliveryTimeMax: 5,
        });

        const result = await getDeliveryDetailsForStoreByCountry(
            TEST_CONFIG.DEFAULT_STORE_ID,
            "country-001"
        );

        expect(result).toEqual({
            shippingService: "DHL Express",
            deliveryTimeMin: 2,
            deliveryTimeMax: 5,
        });
        // ストア詳細クエリは呼ばれない
        expect(mockDb.store.findUnique).not.toHaveBeenCalled();
    });

    it("配送レートがない場合、ストアデフォルトを返す", async () => {
        mockDb.shippingRate.findFirst.mockResolvedValue(null);
        mockDb.store.findUnique.mockResolvedValue({
            defaultShippingService: "Standard Post",
            defaultDeliveryTimeMin: 7,
            defaultDeliveryTimeMax: 21,
        });

        const result = await getDeliveryDetailsForStoreByCountry(
            TEST_CONFIG.DEFAULT_STORE_ID,
            "country-001"
        );

        expect(result).toEqual({
            shippingService: "Standard Post",
            deliveryTimeMin: 7,
            deliveryTimeMax: 21,
        });
    });

    it("正しいstoreIdとcountryIdでクエリする", async () => {
        mockDb.shippingRate.findFirst.mockResolvedValue({
            shippingService: "Test",
            deliveryTimeMin: 1,
            deliveryTimeMax: 3,
        });

        await getDeliveryDetailsForStoreByCountry("store-X", "country-Y");

        expect(mockDb.shippingRate.findFirst).toHaveBeenCalledWith({
            where: {
                storeId: "store-X",
                countryId: "country-Y",
            },
        });
    });
});

// ==================================================
// getProductShippingFee
// ==================================================
describe("getProductShippingFee", () => {
    const userCountry = {
        name: "Japan",
        code: "JP",
        city: "Tokyo",
        region: "Kanto",
    };
    const store = createMockStore();

    it("国が見つからない場合0を返す", async () => {
        mockDb.country.findUnique.mockResolvedValue(null);

        const result = await getProductShippingFee(
            "ITEM",
            userCountry,
            store as never,
            null,
            0.5,
            1
        );

        expect(result).toBe(0);
    });

    it("無料配送対象国の場合0を返す", async () => {
        mockDb.country.findUnique.mockResolvedValue(createMockCountry());

        const freeShipping = {
            eligibleCountries: [
                { countryId: "country-001" },
            ],
        };

        const result = await getProductShippingFee(
            "ITEM",
            userCountry,
            store as never,
            freeShipping as never,
            0.5,
            1
        );

        expect(result).toBe(0);
    });

    describe("配送方式別計算", () => {
        beforeEach(() => {
            mockDb.country.findUnique.mockResolvedValue(
                createMockCountry()
            );
            mockDb.shippingRate.findFirst.mockResolvedValue({
                shippingFeePerItem: 5.0,
                shippingFeeForAdditionalItem: 2.0,
                shippingFeePerKg: 3.0,
                shippingFeeFixed: 15.0,
            });
        });

        it("ITEM方式: 初回+追加アイテム料金を計算する", async () => {
            const result = await getProductShippingFee(
                "ITEM",
                userCountry,
                store as never,
                null,
                0.5,
                3 // 数量3: 5.0 + 2.0 * 2 = 9.0
            );

            expect(result).toBe(9.0);
        });

        it("WEIGHT方式: 重量×数量×単価を計算する", async () => {
            const result = await getProductShippingFee(
                "WEIGHT",
                userCountry,
                store as never,
                null,
                2.0, // 2kg
                3 // 数量3: 3.0 * 2.0 * 3 = 18.0
            );

            expect(result).toBe(18.0);
        });

        it("FIXED方式: 固定料金を返す（数量に依存しない）", async () => {
            const result1 = await getProductShippingFee(
                "FIXED",
                userCountry,
                store as never,
                null,
                0.5,
                1
            );
            // clearMocksしないので、再度モックを設定
            mockDb.country.findUnique.mockResolvedValue(
                createMockCountry()
            );
            mockDb.shippingRate.findFirst.mockResolvedValue({
                shippingFeePerItem: 5.0,
                shippingFeeForAdditionalItem: 2.0,
                shippingFeePerKg: 3.0,
                shippingFeeFixed: 15.0,
            });

            const result5 = await getProductShippingFee(
                "FIXED",
                userCountry,
                store as never,
                null,
                0.5,
                5
            );

            expect(result1).toBe(15.0);
            expect(result5).toBe(15.0);
        });

        it("未知の配送方式の場合0を返す", async () => {
            const result = await getProductShippingFee(
                "UNKNOWN_METHOD",
                userCountry,
                store as never,
                null,
                0.5,
                1
            );

            expect(result).toBe(0);
        });

        it("配送レートがない場合、ストアデフォルト値を使用する", async () => {
            mockDb.shippingRate.findFirst.mockResolvedValue(null);

            const result = await getProductShippingFee(
                "ITEM",
                userCountry,
                store as never,
                null,
                0.5,
                2 // defaultShippingFeePerItem(5.0) + defaultShippingFeeForAdditionalItem(2.0) * 1 = 7.0
            );

            expect(result).toBe(7.0);
        });
    });
});

// ==================================================
// getProductsByIds
// ==================================================
describe("getProductsByIds", () => {
    it("空のIDリストの場合エラーをスローする", async () => {
        await expect(getProductsByIds([])).rejects.toThrow(
            "Ids are undefined"
        );
    });

    it("nullのIDリストの場合エラーをスローする", async () => {
        await expect(getProductsByIds(null as never)).rejects.toThrow(
            "Ids are undefined"
        );
    });

    it("有効なIDで商品を取得し、入力順にソートして返す", async () => {
        const variants = [
            {
                id: "v2",
                variantName: "Blue",
                slug: "blue",
                images: [{ url: "img2.jpg" }],
                sizes: [createMockSize()],
                product: {
                    id: "p1",
                    name: "Product 1",
                    slug: "product-1",
                    rating: 4.5,
                    sales: 100,
                },
            },
            {
                id: "v1",
                variantName: "Red",
                slug: "red",
                images: [{ url: "img1.jpg" }],
                sizes: [createMockSize()],
                product: {
                    id: "p2",
                    name: "Product 2",
                    slug: "product-2",
                    rating: 3.0,
                    sales: 50,
                },
            },
        ];
        mockDb.productVariant.findMany.mockResolvedValue(variants);
        mockDb.productVariant.count.mockResolvedValue(2);

        // v1, v2 の順で指定 → v1が先に来る
        const result = await getProductsByIds(["v1", "v2"]);

        expect(result.products[0].variants[0].variantId).toBe("v1");
        expect(result.products[1].variants[0].variantId).toBe("v2");
    });

    it("ページネーションが正しく適用される", async () => {
        mockDb.productVariant.findMany.mockResolvedValue([]);
        mockDb.productVariant.count.mockResolvedValue(10);

        const result = await getProductsByIds(["v1"], 2, 5);

        expect(mockDb.productVariant.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                take: 5,
                skip: 5, // (2-1) * 5
            })
        );
        expect(result.totalPages).toBe(2); // ceil(10/5)
    });

    it("DB障害時にラップしたエラーをスローする", async () => {
        mockDb.productVariant.findMany.mockRejectedValue(
            new Error("Connection failed")
        );

        await expect(getProductsByIds(["v1"])).rejects.toThrow(
            "Failed to retrieve products. Please try again."
        );
    });
});
