import { getHomeDataDynamic, getHomeFeaturedCategories } from "./home";

// ---- モック設定 ----
jest.mock("@/lib/db", () => ({
    db: {
        product: {
            findMany: jest.fn(),
        },
        category: {
            findMany: jest.fn(),
        },
    },
}));

const mockDb = require("@/lib/db").db;

beforeEach(() => {
    jest.clearAllMocks();
});

// テスト用商品データ（home固有のバリアント構造を含む）
type HomeProductMock = {
    id: string;
    slug: string;
    name: string;
    rating: number;
    sales: number;
    numReviews: number;
    variants: Array<{
        id: string;
        variantName: string;
        variantImage: string | null;
        slug: string;
        images: Array<{ url: string }>;
        sizes: Array<{
            size: string;
            price: number;
            discount: number;
            quantity: number;
        }>;
    }>;
};

const createMockProductWithVariants = (
    overrides: Partial<HomeProductMock> = {}
): HomeProductMock => ({
    id: "product-001",
    slug: "test-product",
    name: "Test Product",
    rating: 4.5,
    sales: 100,
    numReviews: 10,
    variants: [
        {
            id: "variant-001",
            variantName: "Black",
            variantImage: null,
            slug: "black",
            images: [{ url: "https://example.com/img1.jpg" }],
            sizes: [
                { size: "M", price: 100, discount: 10, quantity: 5 },
                { size: "L", price: 120, discount: 0, quantity: 3 },
            ],
        },
    ],
    ...overrides,
});

// ==================================================
// getHomeDataDynamic
// ==================================================
describe("getHomeDataDynamic", () => {
    describe("バリデーション", () => {
        it("空配列の場合エラーをスローする", async () => {
            await expect(getHomeDataDynamic([])).rejects.toThrow(
                "Invalid input: Params array is empty"
            );
        });

        it("不正なpropertyの場合エラーをスローする", async () => {
            await expect(
                getHomeDataDynamic([
                    { property: "invalid" as never, value: "test", type: "simple" },
                ])
            ).rejects.toThrow("Invalid input: Unknown property 'invalid'");
        });
    });

    describe("simpleフォーマット", () => {
        it("categoryフィルタでsimple形式の商品を返す", async () => {
            const product = createMockProductWithVariants();
            mockDb.product.findMany.mockResolvedValue([product]);

            const result = await getHomeDataDynamic([
                { property: "category", value: "electronics", type: "simple" },
            ]);

            expect(result.products_electronics).toBeDefined();
            expect(result.products_electronics).toEqual([
                {
                    name: "Test Product",
                    slug: "test-product",
                    variantName: "Black",
                    variantSlug: "black",
                    price: 90, // 100 * (1 - 10/100)
                    image: "https://example.com/img1.jpg",
                },
            ]);
        });

        it("最も安い割引後価格のサイズを選択する", async () => {
            const product = createMockProductWithVariants({
                variants: [
                    {
                        id: "v1",
                        variantName: "Red",
                        variantImage: null,
                        slug: "red",
                        images: [{ url: "img.jpg" }],
                        sizes: [
                            { size: "S", price: 200, discount: 50, quantity: 5 }, // 100
                            { size: "M", price: 100, discount: 0, quantity: 5 },  // 100
                            { size: "L", price: 80, discount: 0, quantity: 5 },   // 80 ← 最安
                        ],
                    },
                ],
            });
            mockDb.product.findMany.mockResolvedValue([product]);

            const result = await getHomeDataDynamic([
                { property: "category", value: "test", type: "simple" },
            ]);

            expect(
                (result.products_test as Array<Record<string, unknown>>)[0].price
            ).toBe(80);
        });
    });

    describe("fullフォーマット", () => {
        it("categoryフィルタでfull形式の商品を返す", async () => {
            const product = createMockProductWithVariants();
            mockDb.product.findMany.mockResolvedValue([product]);

            const result = await getHomeDataDynamic([
                { property: "category", value: "electronics", type: "full" },
            ]);

            const products = result.products_electronics as Array<
                Record<string, unknown>
            >;
            expect(products).toHaveLength(1);
            expect(products[0]).toEqual(
                expect.objectContaining({
                    id: "product-001",
                    slug: "test-product",
                    name: "Test Product",
                    rating: 4.5,
                    sales: 100,
                    numReviews: 10,
                })
            );
        });

        it("variantImageがnullの場合、最初の画像URLをvariantImageとして使用する", async () => {
            const product = createMockProductWithVariants();
            mockDb.product.findMany.mockResolvedValue([product]);

            const result = await getHomeDataDynamic([
                { property: "category", value: "test", type: "full" },
            ]);

            const products = result.products_test as Array<Record<string, unknown>>;
            const variantImages = products[0].variantImages as Array<
                Record<string, string>
            >;
            expect(variantImages[0].image).toBe(
                "https://example.com/img1.jpg"
            );
        });

        it("variantImageが設定されている場合そのURLを使用する", async () => {
            const product = createMockProductWithVariants({
                variants: [
                    {
                        id: "v1",
                        variantName: "Black",
                        variantImage: "https://example.com/variant.jpg",
                        slug: "black",
                        images: [{ url: "https://example.com/fallback.jpg" }],
                        sizes: [{ size: "M", price: 100, discount: 0, quantity: 5 }],
                    },
                ],
            });
            mockDb.product.findMany.mockResolvedValue([product]);

            const result = await getHomeDataDynamic([
                { property: "category", value: "test", type: "full" },
            ]);

            const products = result.products_test as Array<Record<string, unknown>>;
            const variantImages = products[0].variantImages as Array<
                Record<string, string>
            >;
            expect(variantImages[0].image).toBe(
                "https://example.com/variant.jpg"
            );
        });
    });

    describe("プロパティマッピング", () => {
        beforeEach(() => {
            mockDb.product.findMany.mockResolvedValue([]);
        });

        it("categoryプロパティでcategory.urlフィルタを使用する", async () => {
            await getHomeDataDynamic([
                { property: "category", value: "electronics", type: "simple" },
            ]);

            expect(mockDb.product.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { category: { url: "electronics" } },
                })
            );
        });

        it("subCategoryプロパティでsubCategory.urlフィルタを使用する", async () => {
            await getHomeDataDynamic([
                { property: "subCategory", value: "smartphones", type: "simple" },
            ]);

            expect(mockDb.product.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { subCategory: { url: "smartphones" } },
                })
            );
        });

        it("offerプロパティでofferTag.urlフィルタを使用する", async () => {
            await getHomeDataDynamic([
                { property: "offer", value: "summer-sale", type: "simple" },
            ]);

            expect(mockDb.product.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { offerTag: { url: "summer-sale" } },
                })
            );
        });
    });

    describe("出力キー生成", () => {
        it("ハイフンをアンダースコアに変換してキーを生成する", async () => {
            mockDb.product.findMany.mockResolvedValue([]);

            const result = await getHomeDataDynamic([
                { property: "category", value: "smart-phones", type: "simple" },
            ]);

            expect(result).toHaveProperty("products_smart_phones");
        });

        it("複数パラメータの結果をマージする", async () => {
            mockDb.product.findMany.mockResolvedValue([]);

            const result = await getHomeDataDynamic([
                { property: "category", value: "electronics", type: "simple" },
                { property: "offer", value: "sale", type: "simple" },
            ]);

            expect(result).toHaveProperty("products_electronics");
            expect(result).toHaveProperty("products_sale");
        });
    });
});

// ==================================================
// getHomeFeaturedCategories
// ==================================================
describe("getHomeFeaturedCategories", () => {
    it("featured=trueのカテゴリを商品数降順で取得する", async () => {
        mockDb.category.findMany.mockResolvedValue([]);

        await getHomeFeaturedCategories();

        expect(mockDb.category.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { featured: true },
                orderBy: { products: { _count: "desc" } },
                take: 6,
            })
        );
    });

    it("カテゴリとサブカテゴリをフォーマットして返す", async () => {
        const categories = [
            {
                id: "cat-001",
                name: "Electronics",
                url: "electronics",
                image: "electronics.jpg",
                _count: { products: 50 },
                subCategories: [
                    {
                        id: "sub-001",
                        name: "Smartphones",
                        url: "smartphones",
                        image: "smartphones.jpg",
                        _count: { products: 30 },
                    },
                ],
            },
        ];
        mockDb.category.findMany.mockResolvedValue(categories);

        const result = await getHomeFeaturedCategories();

        expect(result).toEqual([
            {
                id: "cat-001",
                name: "Electronics",
                url: "electronics",
                image: "electronics.jpg",
                productCount: 50,
                subCategories: [
                    {
                        id: "sub-001",
                        name: "Smartphones",
                        url: "smartphones",
                        image: "smartphones.jpg",
                        productCount: 30,
                    },
                ],
            },
        ]);
    });

    it("featuredサブカテゴリを商品数降順で最大3件取得する", async () => {
        mockDb.category.findMany.mockResolvedValue([]);

        await getHomeFeaturedCategories();

        expect(mockDb.category.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                select: expect.objectContaining({
                    subCategories: expect.objectContaining({
                        where: { featured: true },
                        orderBy: { products: { _count: "desc" } },
                        take: 3,
                    }),
                }),
            })
        );
    });

    it("カテゴリが0件の場合空配列を返す", async () => {
        mockDb.category.findMany.mockResolvedValue([]);

        const result = await getHomeFeaturedCategories();

        expect(result).toEqual([]);
    });
});
