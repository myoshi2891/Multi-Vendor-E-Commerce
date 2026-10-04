import { Prisma, ShippingFeeMethod } from "@prisma/client";
import { currentUser } from "@clerk/nextjs/server";
import {
    upsertProduct,
    getProductMainInfo,
    getAllStoreProducts,
    deleteProduct,
    getProducts,
    getProductFacets,
    retrieveProductDetails,
    getRatingStatistics,
    getShippingDetails,
    getProductFilteredReviews,
    getDeliveryDetailsForStoreByCountry,
    getProductShippingFee,
    getProductsByIds,
    getProductPageData,
} from "./product";
import type { ProductFilters } from "@/lib/types";
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
            update: jest.fn(),
            count: jest.fn(),
            findFirst: jest.fn(),
        },
        store: {
            findUnique: jest.fn(),
        },
        category: {
            findUnique: jest.fn(),
        },
        categorySlugAlias: {
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
        spec: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
        },
        question: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
        },
        freeShipping: {
            deleteMany: jest.fn(),
            create: jest.fn(),
        },
        productVariantImage: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
        },
        color: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
        },
        size: {
            deleteMany: jest.fn(),
            createMany: jest.fn(),
        },
        $transaction: jest.fn(),
        $queryRaw: jest.fn(),
        // recomputeProductDerivedColumns（searchKeywords の再計算・plan 074）が tx 内で呼ぶ
        $executeRaw: jest.fn(),
    },
}));

// 属性の検証・同期は product-attributes.test.ts（実装を通す）と統合テストで検証する。
// ここでは upsertProduct 本体の分岐とカテゴリのロックだけを見るため no-op にする。
jest.mock("@/lib/attribute-sync", () => ({
    parseAttributeInputs: jest.fn(() => []),
    precheckAttributeValues: jest.fn(),
    lockAttributeCategoryPath: jest.fn(),
    syncAttributeValues: jest.fn(),
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
interface ProductWithVariantInput {
    productId: string;
    variantId: string;
    name: string;
    description: string;
    variantName: string;
    variantDescription: string;
    images: { url: string }[];
    variantImage: string;
    categoryId: string;
    subCategoryId: string;
    offerTagId: string | undefined;
    isSale: boolean;
    saleEndDate: Date | null;
    brand: string;
    sku: string;
    weight: number;
    colors: { color: string }[];
    sizes: {
        size: string;
        quantity: number;
        price: number;
        discount: number;
    }[];
    product_specs: { name: string; value: string }[];
    variant_specs: { name: string; value: string }[];
    keywords: string[];
    questions: { question: string; answer: string }[];
    freeShippingForAllCountries: boolean;
    freeShippingCountriesIds: string[];
    shippingFeeMethod: "ITEM" | "WEIGHT" | "FIXED";
    createdAt: Date;
    updatedAt: Date;
}

const createMockProductWithVariantInput = (
    overrides: Partial<ProductWithVariantInput> = {}
): ProductWithVariantInput => ({
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
    shippingFeeMethod: "ITEM",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
});

// productVariant.findFirst の scoped lookup (id + productId + product.storeId) を完全一致で
// 検証するマッチャー。production の IDOR 防御 (src/queries/product.ts:89-97) は
// 3 フィールドすべてで絞り込むため、テストモックも同じ条件で「該当バリアントを返す」判定を
// 行わないと、where: { id } だけへの退行をテストが見逃してしまう。
const matchesScopedVariantLookup = (
    params: unknown,
    expected: { variantId: string; productId: string; storeId: string }
): boolean => {
    if (typeof params !== "object" || params === null || !("where" in params)) {
        return false;
    }
    const where = (
        params as {
            where?: {
                id?: string;
                productId?: string;
                product?: { storeId?: string };
            };
        }
    ).where;
    return (
        where?.id === expected.variantId &&
        where?.productId === expected.productId &&
        where?.product?.storeId === expected.storeId
    );
};

// ==================================================
// upsertProduct
// ==================================================
/**
 * `upsertProduct` のリーフ検証が引く `SELECT … FOR UPDATE` の戻り値を与える。
 *
 * 実装はこの行（Category ノード）の `childCount` / `depth` / `parentId` を見て
 * 可否を決める（`parentId` は商品が併せて書く root と一致していなければならない）。
 */
const mockLockedCategoryNode = (node: {
    id: string;
    parentId: string | null;
    path: string;
    depth: number;
    childCount: number;
}) => mockDb.$queryRaw.mockResolvedValue([node]);

/** 商品を紐づけられるリーフ（Phase B では depth 1 まで）。 */
const LEAF_NODE = {
    id: "subcategory-001",
    parentId: "category-001",
    path: "electronics/smartphones",
    depth: 1,
    childCount: 0,
};

/** 子を持つノード。商品は紐づけられない。 */
const NON_LEAF_NODE = {
    id: "subcategory-001",
    parentId: "category-001",
    path: "electronics/smartphones",
    depth: 1,
    childCount: 1,
};

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

        it("ストアが見つからない / 所有者でない場合 Forbidden をスロー (requireStoreOwner で url+userId 集約検証)", async () => {
            // 旧実装は url のみでも store を fetch していたが、現実装は
            // requireStoreOwner が where: { url, userId } で findUnique するため、
            // 「存在しない」「他人の店舗」を 1 メッセージに統合する (列挙耐性)。
            mockDb.store.findUnique.mockResolvedValue(null);

            await expect(
                upsertProduct(
                    createMockProductWithVariantInput() as never,
                    "other-store"
                )
            ).rejects.toThrow("Forbidden: store not owned by current user.");

            expect(mockDb.store.findUnique).toHaveBeenCalledWith({
                where: {
                    url: "other-store",
                    userId: TEST_CONFIG.DEFAULT_USER_ID,
                },
            });
        });

        it("IDOR失敗時に下流の商品ミューテーション (create/update/productVariant.*) が一切呼ばれない", async () => {
            // 副作用なし検証 (defense in depth): requireStoreOwner が throw した時点で
            // upsertProduct 内の create/update/findFirst (slug 解決) 等が
            // 早期リターンされ、後続の DB I/O が発生しないことを保証する。
            mockDb.store.findUnique.mockResolvedValue(null);

            await expect(
                upsertProduct(
                    createMockProductWithVariantInput() as never,
                    "other-store"
                )
            ).rejects.toThrow("Forbidden: store not owned by current user.");

            expect(mockDb.product.create).not.toHaveBeenCalled();
            expect(mockDb.product.update).not.toHaveBeenCalled();
            expect(mockDb.product.findFirst).not.toHaveBeenCalled();
            expect(mockDb.productVariant.create).not.toHaveBeenCalled();
            expect(mockDb.productVariant.update).not.toHaveBeenCalled();
            expect(mockDb.productVariant.findFirst).not.toHaveBeenCalled();
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
            // 作成もリーフ検証のロックを握ったままの $transaction 内で行う（V-5）
            mockDb.$transaction.mockImplementation(
                async (callback: (tx: typeof mockDb) => Promise<unknown>) =>
                    callback(mockDb)
            );
            mockLockedCategoryNode(LEAF_NODE);
        });

        it("新規作成の tx 内で searchKeywords を再計算する（plan 074）", async () => {
            // Arrange
            mockDb.product.findUnique.mockResolvedValue(null);
            mockDb.productVariant.findFirst.mockResolvedValue(null);
            mockDb.product.create.mockResolvedValue(
                createMockProduct({ id: "created-product-id" })
            );

            // Act
            await upsertProduct(
                createMockProductWithVariantInput() as never,
                TEST_CONFIG.TEST_STORE_URL
            );

            // Assert — 作成した商品の id を対象に、searchKeywords を書く UPDATE が 1 回発行される
            expect(mockDb.$executeRaw).toHaveBeenCalledTimes(1);
            const sql = mockDb.$executeRaw.mock.calls[0][0] as {
                strings: string[];
                values: unknown[];
            };
            expect(sql.strings.join("?")).toContain('"searchKeywords"');
            expect(sql.values).toContain("created-product-id");
        });

        it("商品もバリアントも存在しない場合、新規作成する", async () => {
            mockDb.product.findUnique.mockResolvedValue(null);
            mockDb.productVariant.findFirst.mockResolvedValue(null);
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
                        // dual-write（Phase B）: 読み取りが新 FK へ移った後も
                        // 旧 2 列を書き続けることで読み取りを巻き戻せる状態を保つ。
                        // categoryNodeId = subCategoryId は Phase A の id 共有による。
                        categoryNode: { connect: { id: "subcategory-001" } },
                    }),
                })
            );
        });

        it("バリアントのslugが正しく生成される", async () => {
            mockDb.product.findUnique.mockResolvedValue(null);
            mockDb.productVariant.findFirst.mockResolvedValue(null);
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
            // バリアント作成は属性の同期と同じ tx で行う（plan 069）
            mockDb.$transaction.mockImplementation(
                async (fn: (tx: typeof mockDb) => Promise<unknown>) =>
                    fn(mockDb)
            );
        });

        it("既存商品に新しいバリアントを追加する", async () => {
            mockDb.product.findUnique.mockResolvedValue(createMockProduct());
            mockDb.productVariant.findFirst.mockResolvedValue(null);
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

    // ==================================================
    // カテゴリのリーフ強制（design.md V-5 系 / plan 068 Step 3）
    // ==================================================
    describe("カテゴリのリーフ強制", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
            mockDb.product.findFirst.mockResolvedValue(null);
            mockDb.productVariant.findFirst.mockResolvedValue(null);
            mockDb.$transaction.mockImplementation(
                async (callback: (tx: typeof mockDb) => Promise<unknown>) =>
                    callback(mockDb)
            );
            mockDb.product.create.mockResolvedValue(createMockProduct());
            mockDb.product.update.mockResolvedValue(createMockProduct());
            mockDb.productVariant.update.mockResolvedValue(
                createMockProductVariant()
            );
            for (const model of [
                mockDb.spec,
                mockDb.question,
                mockDb.freeShipping,
                mockDb.productVariantImage,
                mockDb.color,
                mockDb.size,
            ]) {
                model.deleteMany?.mockResolvedValue({ count: 0 });
                model.createMany?.mockResolvedValue({ count: 0 });
            }
        });

        it("V-5: 子を持つノードへの新規紐づけを拒否する", async () => {
            // Arrange
            mockDb.product.findUnique.mockResolvedValue(null);
            mockLockedCategoryNode(NON_LEAF_NODE);

            // Act / Assert
            await expect(
                upsertProduct(
                    createMockProductWithVariantInput() as never,
                    TEST_CONFIG.TEST_STORE_URL
                )
            ).rejects.toThrow(/leaf/i);
            expect(mockDb.product.create).not.toHaveBeenCalled();
        });

        it("V-5: 既存商品のカテゴリを非リーフへ変更する更新を拒否する", async () => {
            // Arrange —— 別 root の非リーフへ付け替える
            mockDb.product.findUnique.mockResolvedValue(
                createMockProduct({
                    categoryId: "category-other",
                    subCategoryId: "subcategory-other",
                } as never)
            );
            mockDb.productVariant.findFirst.mockResolvedValue(
                createMockProductVariant()
            );
            mockLockedCategoryNode(NON_LEAF_NODE);

            // Act / Assert
            await expect(
                upsertProduct(
                    createMockProductWithVariantInput() as never,
                    TEST_CONFIG.TEST_STORE_URL
                )
            ).rejects.toThrow(/leaf/i);
            expect(mockDb.product.update).not.toHaveBeenCalled();
        });

        it("V-5b: カテゴリを変えない更新は、紐づけ先が非リーフでも成功する", async () => {
            // Arrange —— 移行時に強制付け替えをしていないため、既存の非リーフ紐づけは
            // 経過措置として残っている。無条件検証にするとそれらが一切編集できなくなる。
            mockDb.product.findUnique.mockResolvedValue(createMockProduct());
            mockDb.productVariant.findFirst.mockResolvedValue(
                createMockProductVariant()
            );
            mockLockedCategoryNode(NON_LEAF_NODE);

            // Act
            await upsertProduct(
                createMockProductWithVariantInput() as never,
                TEST_CONFIG.TEST_STORE_URL
            );

            // Assert —— 検証そのものを走らせない（Category のロックも引かない）。
            // $queryRaw 自体は導出列再計算の Product 行ロックで呼ばれるため、SQL で区別する
            expect(mockDb.product.update).toHaveBeenCalled();
            const queriedSql: string[] = mockDb.$queryRaw.mock.calls.map(
                ([strings]: [TemplateStringsArray]) => strings.join("?")
            );
            expect(queriedSql.some((sql) => sql.includes('"Category"'))).toBe(
                false
            );
        });

        it("V-5c: categoryId 据え置きでリーフ FK だけを非リーフへ差し替える更新を拒否する", async () => {
            // Arrange —— categoryId の一致だけをスキップ条件にすると通ってしまう経路
            mockDb.product.findUnique.mockResolvedValue(
                createMockProduct({
                    subCategoryId: "subcategory-previous",
                } as never)
            );
            mockDb.productVariant.findFirst.mockResolvedValue(
                createMockProductVariant()
            );
            mockLockedCategoryNode(NON_LEAF_NODE);

            // Act / Assert
            await expect(
                upsertProduct(
                    createMockProductWithVariantInput() as never,
                    TEST_CONFIG.TEST_STORE_URL
                )
            ).rejects.toThrow(/leaf/i);
            expect(mockDb.product.update).not.toHaveBeenCalled();
        });

        it("リーフノードへの紐づけは許可する", async () => {
            // Arrange
            mockDb.product.findUnique.mockResolvedValue(null);
            mockLockedCategoryNode(LEAF_NODE);

            // Act
            await upsertProduct(
                createMockProductWithVariantInput() as never,
                TEST_CONFIG.TEST_STORE_URL
            );

            // Assert
            expect(mockDb.product.create).toHaveBeenCalled();
        });

        it("対象ノードは SELECT … FOR SHARE でロックしてから読む", async () => {
            // Arrange —— upsertCategory が親を FOR UPDATE で掴む行と同じ行を共有ロックすることが、
            // 「商品を L に紐づける」と「L の子を作る」の直列化の条件になる
            // （商品保存どうしは共有ロック同士なので並行できる）。
            mockDb.product.findUnique.mockResolvedValue(null);
            mockLockedCategoryNode(LEAF_NODE);

            // Act
            await upsertProduct(
                createMockProductWithVariantInput() as never,
                TEST_CONFIG.TEST_STORE_URL
            );

            // Assert
            const sqlParts = mockDb.$queryRaw.mock.calls[0][0] as string[];
            expect(sqlParts.join("?")).toMatch(/FOR SHARE/);
            expect(sqlParts.join("?")).toMatch(/"Category"/);
        });

        it("Phase B では depth 2 以上のノードへの紐づけを拒否する", async () => {
            // Arrange —— depth 2 以上には legacy SubCategory 行が無く、
            // NOT NULL の Product.subCategoryId を満たせない（Phase C まで）。
            mockDb.product.findUnique.mockResolvedValue(null);
            mockLockedCategoryNode({
                id: "subcategory-001",
                parentId: "subcategory-camera",
                path: "electronics/camera/lens",
                depth: 2,
                childCount: 0,
            });

            // Act / Assert
            await expect(
                upsertProduct(
                    createMockProductWithVariantInput() as never,
                    TEST_CONFIG.TEST_STORE_URL
                )
            ).rejects.toThrow(/depth/i);
            expect(mockDb.product.create).not.toHaveBeenCalled();
        });

        it("Phase B では depth 0 のルートへの紐づけも拒否する", async () => {
            // Arrange —— 子を持たないルートは「リーフ」だが legacy SubCategory 行が
            // 無いため、NOT NULL の Product.subCategoryId を満たせない。
            mockDb.product.findUnique.mockResolvedValue(null);
            mockLockedCategoryNode({
                id: "subcategory-001",
                parentId: null,
                path: "electronics",
                depth: 0,
                childCount: 0,
            });

            // Act / Assert
            await expect(
                upsertProduct(
                    createMockProductWithVariantInput() as never,
                    TEST_CONFIG.TEST_STORE_URL
                )
            ).rejects.toThrow(/depth/i);
            expect(mockDb.product.create).not.toHaveBeenCalled();
        });

        it("リーフの親が categoryId と一致しない紐づけを拒否する", async () => {
            // Arrange —— Server Action は公開エンドポイントなので、フォームを
            // 経由しない呼び出しが「別 root のリーフ」を渡せる。二重 FK
            // （categoryId / subCategoryId）が食い違った行を書かせない。
            mockDb.product.findUnique.mockResolvedValue(null);
            mockLockedCategoryNode({
                ...LEAF_NODE,
                parentId: "category-other",
            });

            // Act / Assert
            await expect(
                upsertProduct(
                    createMockProductWithVariantInput() as never,
                    TEST_CONFIG.TEST_STORE_URL
                )
            ).rejects.toThrow(/does not belong/i);
            expect(mockDb.product.create).not.toHaveBeenCalled();
        });

        it("存在しないカテゴリノードへの紐づけを拒否する", async () => {
            // Arrange
            mockDb.product.findUnique.mockResolvedValue(null);
            mockDb.$queryRaw.mockResolvedValue([]);

            // Act / Assert
            await expect(
                upsertProduct(
                    createMockProductWithVariantInput() as never,
                    TEST_CONFIG.TEST_STORE_URL
                )
            ).rejects.toThrow("Category not found.");
            expect(mockDb.product.create).not.toHaveBeenCalled();
        });
    });

    describe("既存商品+バリアント更新", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
            // $transaction: コールバックを直接実行
            mockDb.$transaction.mockImplementation(
                async (callback: (tx: typeof mockDb) => Promise<unknown>) =>
                    callback(mockDb)
            );
            // 各 deleteMany/createMany のデフォルトモック
            mockDb.spec.deleteMany.mockResolvedValue({ count: 0 });
            mockDb.spec.createMany.mockResolvedValue({ count: 0 });
            mockDb.question.deleteMany.mockResolvedValue({ count: 0 });
            mockDb.question.createMany.mockResolvedValue({ count: 0 });
            mockDb.freeShipping.deleteMany.mockResolvedValue({ count: 0 });
            mockDb.productVariantImage.deleteMany.mockResolvedValue({
                count: 0,
            });
            mockDb.productVariantImage.createMany.mockResolvedValue({
                count: 0,
            });
            mockDb.color.deleteMany.mockResolvedValue({ count: 0 });
            mockDb.color.createMany.mockResolvedValue({ count: 0 });
            mockDb.size.deleteMany.mockResolvedValue({ count: 0 });
            mockDb.size.createMany.mockResolvedValue({ count: 0 });
            mockDb.product.update.mockResolvedValue(createMockProduct());
            mockDb.productVariant.update.mockResolvedValue(
                createMockProductVariant()
            );
            // generateUniqueSlug: 初回で一意
            mockDb.product.findFirst.mockResolvedValue(null);
            mockDb.productVariant.findFirst.mockResolvedValue(null);
        });

        it("既存の商品とバリアントを正常に更新する", async () => {
            mockDb.product.findUnique.mockResolvedValue(
                createMockProduct({ name: "Old Name", slug: "old-name" })
            );
            mockDb.productVariant.findFirst.mockImplementation(
                async (params: unknown) => {
                    if (
                        matchesScopedVariantLookup(params, {
                            variantId: "variant-001",
                            productId: "product-001",
                            storeId: TEST_CONFIG.DEFAULT_STORE_ID,
                        })
                    ) {
                        return createMockProductVariant({
                            variantName: "Old Variant",
                            slug: "old-variant",
                        });
                    }
                    return null;
                }
            );

            await upsertProduct(
                createMockProductWithVariantInput({
                    productId: "product-001",
                    variantId: "variant-001",
                    name: "Updated Product",
                    variantName: "Updated Variant",
                }) as never,
                TEST_CONFIG.TEST_STORE_URL
            );

            expect(mockDb.$transaction).toHaveBeenCalled();
            expect(mockDb.product.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "product-001" },
                    data: expect.objectContaining({
                        name: "Updated Product",
                        // dual-write（Phase B）: 更新経路でも旧 2 列と新 FK の
                        // 両方を書く。片方だけだと、カテゴリを付け替えた商品が
                        // 読み取り側（新 FK）から見て古い枝に残る。
                        category: { connect: { id: "category-001" } },
                        subCategory: { connect: { id: "subcategory-001" } },
                        categoryNode: { connect: { id: "subcategory-001" } },
                    }),
                })
            );
            expect(mockDb.productVariant.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "variant-001" },
                    data: expect.objectContaining({
                        variantName: "Updated Variant",
                    }),
                })
            );
        });

        it("商品名未変更時にslugが維持される", async () => {
            mockDb.product.findUnique.mockResolvedValue(
                createMockProduct({
                    name: "New Product",
                    slug: "existing-slug",
                })
            );
            mockDb.productVariant.findFirst.mockImplementation(
                async (params: unknown) => {
                    if (
                        matchesScopedVariantLookup(params, {
                            variantId: "variant-001",
                            productId: "product-001",
                            storeId: TEST_CONFIG.DEFAULT_STORE_ID,
                        })
                    ) {
                        return createMockProductVariant({
                            variantName: "Red Edition",
                            slug: "existing-variant-slug",
                        });
                    }
                    return null;
                }
            );

            await upsertProduct(
                createMockProductWithVariantInput({
                    productId: "product-001",
                    variantId: "variant-001",
                }) as never,
                TEST_CONFIG.TEST_STORE_URL
            );

            expect(mockDb.product.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        slug: "existing-slug",
                    }),
                })
            );
            expect(mockDb.productVariant.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        slug: "existing-variant-slug",
                    }),
                })
            );
        });

        it("商品名変更時に新しいslugが生成される", async () => {
            mockDb.product.findUnique.mockResolvedValue(
                createMockProduct({ name: "Old Name", slug: "old-name" })
            );
            mockDb.productVariant.findFirst.mockImplementation(
                async (params: unknown) => {
                    if (
                        matchesScopedVariantLookup(params, {
                            variantId: "variant-001",
                            productId: "product-001",
                            storeId: TEST_CONFIG.DEFAULT_STORE_ID,
                        })
                    ) {
                        return createMockProductVariant({
                            variantName: "Old Variant",
                            slug: "old-variant",
                        });
                    }
                    return null;
                }
            );

            await upsertProduct(
                createMockProductWithVariantInput({
                    productId: "product-001",
                    variantId: "variant-001",
                    name: "New Name",
                    variantName: "New Variant",
                }) as never,
                TEST_CONFIG.TEST_STORE_URL
            );

            // 名前が変わったので slug は slugify の結果になる
            expect(mockDb.product.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        slug: "new-name",
                    }),
                })
            );
            expect(mockDb.productVariant.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        slug: "new-variant",
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

            // 旧 message "Only sellers and administrators can perform this action."
            // は実コード (role !== "SELLER") と乖離があったため、auth-guards 統一形
            // に揃えた (auth-guards refactor)。ADMIN ロールも引き続き拒否される。
            await expect(deleteProduct("product-001")).rejects.toThrow(
                "Only sellers can perform this action."
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

    describe("IDOR防止", () => {
        // deleteProduct は requireSeller + インライン所有権チェック (product.store.userId !== user.id)
        // という二段構成。requireStoreOwner と異なり store URL 経由ではないため、
        // 検証ポイントは「(b) findUnique が store.userId を含む include 構造で呼ばれているか」
        // と「(c) ガード失敗時に db.product.delete が一切呼ばれないか」となる。
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
        });

        it("商品が存在しない場合 'Product not found.' をスローし db.product.delete が呼ばれない", async () => {
            mockDb.product.findUnique.mockResolvedValue(null);

            await expect(deleteProduct("nonexistent-id")).rejects.toThrow(
                "Product not found."
            );
            expect(mockDb.product.delete).not.toHaveBeenCalled();
        });

        it("他人のストアの商品の場合 'You can only delete your own products.' をスローし db.product.delete が呼ばれない", async () => {
            // 同一 productId は存在するが、関連 store の userId が現在のユーザーと一致しない
            // (= クロステナント) 状態。インライン比較 product.store.userId !== user.id で reject。
            mockDb.product.findUnique.mockResolvedValue({
                id: "product-001",
                store: { userId: "other-seller-id" },
            });

            await expect(deleteProduct("product-001")).rejects.toThrow(
                "You can only delete your own products."
            );
            expect(mockDb.product.delete).not.toHaveBeenCalled();
        });

        it("所有権検証用 findUnique が { id, include: { store: { select: { userId: true } } } } 構造で呼ばれる", async () => {
            // 将来「include を外す」「userId を取らない」変更が入った場合に検知するレグレッション。
            mockDb.product.findUnique.mockResolvedValue(null);

            await expect(deleteProduct("product-001")).rejects.toThrow(
                "Product not found."
            );
            expect(mockDb.product.findUnique).toHaveBeenCalledWith({
                where: { id: "product-001" },
                include: { store: { select: { userId: true } } },
            });
        });
    });

    describe("正常系", () => {
        it("商品を正常に削除する", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
            mockDb.product.findUnique.mockResolvedValue({
                id: "product-001",
                store: { userId: TEST_CONFIG.DEFAULT_USER_ID },
            });
            mockDb.product.delete.mockResolvedValue(createMockProduct());

            const result = await deleteProduct("product-001");

            expect(result).toEqual(createMockProduct());
            expect(mockDb.product.findUnique).toHaveBeenCalledWith({
                where: { id: "product-001" },
                include: { store: { select: { userId: true } } },
            });
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
    /**
     * getProducts は「絞り込み → 並び替え → ページング」を 1 本の生 SQL で行い（ID と件数の 2 クエリ）、
     * 表示用の列は ID で hydrate する（plan 075 / design.md §2-Q2）。ここでは発行した SQL の
     * 断片とパラメータを検証する。意味（実際にどの行が返るか）は統合テスト
     * tests/integration/product-browse.test.ts が実 PostgreSQL で検証する。
     */
    type RawSql = { strings: readonly string[]; values: unknown[] };

    /** $queryRaw に渡された SQL のうち、ID 取得クエリ（count 以外）を返す。 */
    const idQuery = (): RawSql => {
        const call = mockDb.$queryRaw.mock.calls
            .map((c: unknown[]) => c[0] as RawSql)
            .find((q: RawSql) => !q.strings.join("?").includes("count(*)"));
        if (!call) throw new Error("ID クエリが発行されていない");
        return call;
    };
    const sqlText = (q: RawSql): string => q.strings.join("?");

    /** ID クエリと件数クエリの応答を仕込む。 */
    const arrangeRows = (ids: string[], total = ids.length) => {
        mockDb.$queryRaw.mockImplementation(async (q: RawSql) =>
            sqlText(q).includes("count(*)")
                ? [{ count: BigInt(total) }]
                : ids.map((id) => ({ id }))
        );
    };

    /** hydrate 用: バリアント 1 件・サイズ 1 件を持つ商品 */
    const productWithPrice = (id: string, price: number) => ({
        ...createMockProduct({ id, slug: id }),
        variants: [
            {
                ...createMockProductVariant({ id: `v-${id}` }),
                images: [createMockVariantImage()],
                colors: [],
                sizes: [createMockSize({ price, discount: 0 })],
            },
        ],
    });

    beforeEach(() => {
        mockDb.product.findMany.mockResolvedValue([]);
        arrangeRows([]);
    });

    describe("検索", () => {
        it("検索語は searchVector と前方一致の tsquery で絞り込む（ILIKE は使わない）", async () => {
            // Act
            await getProducts({ search: "iphone" });

            // Assert
            const q = idQuery();
            expect(sqlText(q)).toContain(`"searchVector" @@ to_tsquery('simple',`);
            expect(q.values).toContain("iphone:*");
            expect(sqlText(q)).not.toMatch(/ILIKE|contains/i);
        });

        it("検索語があり sort 未指定なら関連度（ts_rank）→ id の順に並べる", async () => {
            // Act
            await getProducts({ search: "iphone" }, "");

            // Assert
            expect(sqlText(idQuery())).toMatch(/ORDER BY ts_rank\([\s\S]*\) DESC, p\.id ASC/);
        });

        it("検索語があっても sort 指定があればそのキーで並べる", async () => {
            await getProducts({ search: "iphone" }, "new-arrivals");

            expect(sqlText(idQuery())).toContain(`ORDER BY p."createdAt" DESC, p.id ASC`);
        });

        it("文字・数字を含まない検索語は DB を引かずに 0 件を返す", async () => {
            // Act
            const result = await getProducts({ search: "&|!" });

            // Assert
            expect(result.totalCount).toBe(0);
            expect(mockDb.$queryRaw).not.toHaveBeenCalled();
        });

        it("検索語なしなら searchVector の条件を付けない", async () => {
            await getProducts({});

            expect(sqlText(idQuery())).not.toContain("searchVector");
        });
    });

    describe("フィルタ適用", () => {
        it("ストアURLを id に解決して storeId で絞り込む", async () => {
            // Arrange
            mockDb.store.findUnique.mockResolvedValue({ id: "store-123" });

            // Act
            await getProducts({ store: "my-store" });

            // Assert
            expect(mockDb.store.findUnique).toHaveBeenCalledWith({
                where: { url: "my-store" },
                select: { id: true },
            });
            const q = idQuery();
            expect(sqlText(q)).toContain(`p."storeId" = `);
            expect(q.values).toContain("store-123");
        });

        it("カテゴリURLを path に解決し、starts_with のサブツリー条件で絞り込む", async () => {
            // Arrange
            mockDb.category.findUnique.mockResolvedValue({
                id: "cat-123",
                path: "electronics",
                url: "electronics",
            });

            // Act
            await getProducts({ category: "electronics" });

            // Assert —— slug は url 完全一致で解決する
            expect(mockDb.category.findUnique).toHaveBeenCalledWith({
                where: { url: "electronics" },
                select: { id: true, path: true, url: true },
            });
            // Assert —— 新 FK（categoryNodeId）のサブツリー。LIKE は slug の "_" を
            // ワイルドカードとして扱うので使わない（design.md §0-13）
            const q = idQuery();
            expect(sqlText(q)).toContain(`c.id = p."categoryNodeId"`);
            expect(sqlText(q)).toContain("starts_with(c.path,");
            expect(sqlText(q)).not.toContain("LIKE");
            expect(q.values).toEqual(
                expect.arrayContaining(["electronics", "electronics/"])
            );
        });

        it("サブカテゴリURLは別名表を先に引いて解決する（恒久受理）", async () => {
            // Arrange —— リネーム済み slug が別名表経由で正準ノードへ解決される
            mockDb.categorySlugAlias.findUnique.mockResolvedValue({
                category: {
                    id: "subcat-123",
                    path: "electronics/smartphones",
                    url: "electronics-smartphones",
                },
            });

            // Act
            await getProducts({ subCategory: "smartphones" });

            // Assert
            expect(mockDb.categorySlugAlias.findUnique).toHaveBeenCalledWith({
                where: {
                    entityType_oldSlug: {
                        entityType: "SUB_CATEGORY",
                        oldSlug: "smartphones",
                    },
                },
                select: {
                    category: { select: { id: true, path: true, url: true } },
                },
            });
            expect(idQuery().values).toEqual(
                expect.arrayContaining([
                    "electronics/smartphones",
                    "electronics/smartphones/",
                ])
            );
        });

        it("category と subCategory の同時指定は 2 つのサブツリーの積になる", async () => {
            // Arrange —— ?? で 1 本に畳むと片方が黙って捨てられ絞り込みが緩くなる
            mockDb.category.findUnique.mockResolvedValue({
                id: "cat-1",
                path: "electronics",
                url: "electronics",
            });
            mockDb.categorySlugAlias.findUnique.mockResolvedValue({
                category: {
                    id: "cat-2",
                    path: "electronics/smartphones",
                    url: "electronics-smartphones",
                },
            });

            // Act
            await getProducts({
                category: "electronics",
                subCategory: "smartphones",
            });

            // Assert
            const subtreeCount = sqlText(idQuery()).split(`FROM "Category" c`).length - 1;
            expect(subtreeCount).toBe(2);
        });

        it("オファータグURLを id に解決して offerTagId で絞り込む", async () => {
            mockDb.offerTag.findUnique.mockResolvedValue({ id: "offer-123" });

            await getProducts({ offer: "summer-sale" });

            expect(mockDb.offerTag.findUnique).toHaveBeenCalledWith({
                where: { url: "summer-sale" },
                select: { id: true },
            });
            expect(sqlText(idQuery())).toContain(`p."offerTagId" = `);
            expect(idQuery().values).toContain("offer-123");
        });

        it("store / category / offer の slug 解決を並列に行う", async () => {
            // Arrange —— store の解決を保留にしたまま、category と offer の解決が
            // 始まっていることを確かめる（逐次 await だと store の完了まで呼ばれない）
            let resolveStore: (value: { id: string }) => void = () => {};
            mockDb.store.findUnique.mockReturnValue(
                new Promise((resolve) => {
                    resolveStore = resolve;
                })
            );
            mockDb.category.findUnique.mockResolvedValue({
                id: "cat-1",
                path: "electronics",
                url: "electronics",
            });
            mockDb.offerTag.findUnique.mockResolvedValue({ id: "offer-1" });

            // Act
            const pending = getProducts({
                store: "my-store",
                category: "electronics",
                offer: "sale",
            });
            await Promise.resolve();
            await Promise.resolve();

            // Assert
            expect(mockDb.category.findUnique).toHaveBeenCalled();
            expect(mockDb.offerTag.findUnique).toHaveBeenCalled();
            resolveStore({ id: "store-1" });
            await pending;
        });

        // 見つからないフィルタを黙って捨てると「該当なし」が「全件表示」に化ける。
        // 実際に E2E のシード欠落時、/browse?category=<存在しない URL> が全カタログを描画した。
        describe("存在しない URL を指定した場合は 0 件を返す", () => {
            it.each([
                ["store", { store: "missing-store" }, "missing-store"],
                ["offerTag", { offer: "missing-offer" }, "missing-offer"],
            ] as const)(
                "%s が見つからないとき空の結果を返し、商品を取得しない",
                async (model, filters, expectedUrl) => {
                    // Arrange — 対象モデルの findUnique だけが null を返す
                    mockDb[model].findUnique.mockResolvedValue(null);

                    // Act
                    const result = await getProducts(filters);

                    // Assert — 対象モデルを URL で引いたうえで未マッチと判定している
                    expect(mockDb[model].findUnique).toHaveBeenCalledWith({
                        where: { url: expectedUrl },
                        select: { id: true },
                    });
                    // Assert — フィルタを捨てて全件を返してはならない
                    expect(result.products).toEqual([]);
                    expect(result.totalCount).toBe(0);
                    expect(result.totalPages).toBe(0);
                    expect(mockDb.$queryRaw).not.toHaveBeenCalled();
                    expect(mockDb.product.findMany).not.toHaveBeenCalled();
                }
            );

            // category / subCategory は url 完全一致と別名表の 2 段で解決するため、
            // **両方が外れて初めて**未マッチになる。
            it.each([
                ["category", { category: "missing-category" }, "CATEGORY"],
                [
                    "subCategory",
                    { subCategory: "missing-subcategory" },
                    "SUB_CATEGORY",
                ],
            ] as const)(
                "%s が url でも別名表でも解決できないとき空の結果を返し、商品を取得しない",
                async (_label, filters, entityType) => {
                    // Arrange —— 解決経路を両方とも外す
                    mockDb.category.findUnique.mockResolvedValue(null);
                    mockDb.categorySlugAlias.findUnique.mockResolvedValue(null);

                    // Act
                    const result = await getProducts(filters);

                    // Assert —— 別名表を entityType 付きで引いている
                    expect(
                        mockDb.categorySlugAlias.findUnique
                    ).toHaveBeenCalledWith(
                        expect.objectContaining({
                            where: {
                                entityType_oldSlug: expect.objectContaining({
                                    entityType,
                                }),
                            },
                        })
                    );
                    expect(result.products).toEqual([]);
                    expect(result.totalCount).toBe(0);
                    expect(result.totalPages).toBe(0);
                    expect(mockDb.$queryRaw).not.toHaveBeenCalled();
                }
            );

            it("currentPage / pageSize は要求値を保つ", async () => {
                // Arrange
                mockDb.category.findUnique.mockResolvedValue(null);
                mockDb.categorySlugAlias.findUnique.mockResolvedValue(null);

                // Act
                const result = await getProducts(
                    { category: "missing-category" },
                    "",
                    3,
                    20
                );

                // Assert
                expect(result.currentPage).toBe(3);
                expect(result.pageSize).toBe(20);
            });

            // getProducts は "use server" の Server Action なので、型に反する入力
            // （`?store=a&store=b` が string[] のまま届く等）も実行時に来うる。
            // 曖昧な指定は解決できない指定と同じ扱いにして fail-closed で 0 件に倒す。
            it.each([
                ["store", { store: ["a", "b"] }],
                ["offer", { offer: ["a", "b"] }],
                ["category", { category: ["a", "b"] }],
                ["search", { search: ["a", "b"] }],
            ] as const)(
                "%s に配列が届いたら DB を引かずに 0 件を返す",
                async (_label, filters) => {
                    // Act
                    const result = await getProducts(
                        filters as unknown as ProductFilters
                    );

                    // Assert
                    expect(mockDb.store.findUnique).not.toHaveBeenCalled();
                    expect(mockDb.offerTag.findUnique).not.toHaveBeenCalled();
                    expect(mockDb.category.findUnique).not.toHaveBeenCalled();
                    expect(result.products).toEqual([]);
                    expect(result.totalCount).toBe(0);
                    expect(mockDb.$queryRaw).not.toHaveBeenCalled();
                }
            );
        });

        it("価格範囲でフィルタする（Decimal のパラメータで比較）", async () => {
            await getProducts({ minPrice: 10, maxPrice: 100 });

            const q = idQuery();
            expect(sqlText(q)).toContain("s.price >= ");
            expect(sqlText(q)).toContain("s.price <= ");
            expect(q.values).toEqual(
                expect.arrayContaining([
                    new Prisma.Decimal(10),
                    new Prisma.Decimal(100),
                ])
            );
        });

        it("maxPrice: 0 を「上限未指定」に化けさせず上限 0 を載せる", async () => {
            // Arrange: minPrice 100 / maxPrice 0 は空レンジ。truthy 判定だと maxPrice が
            // 落ちて下限だけが残り、全件が通ってしまう（回帰の検知点）。
            await getProducts({ minPrice: 100, maxPrice: 0 });

            const q = idQuery();
            expect(sqlText(q)).toContain("s.price <= ");
            expect(q.values).toEqual(
                expect.arrayContaining([new Prisma.Decimal(0)])
            );
        });

        it("minPrice: 0 単独でも価格フィルタを適用し、上限は付けない", async () => {
            await getProducts({ minPrice: 0 });

            const q = idQuery();
            expect(sqlText(q)).toContain("s.price >= ");
            expect(sqlText(q)).not.toContain("s.price <= ");
        });

        it("サイズ配列でフィルタする", async () => {
            await getProducts({ size: ["S", "M"] });

            const q = idQuery();
            expect(sqlText(q)).toContain("s.size = ANY(");
            expect(q.values).toContainEqual(["S", "M"]);
        });

        it("サイズが単数指定（string）でも配列へ揃えて適用する", async () => {
            // Arrange —— `?size=M` が 1 つだけのとき string で届く（Server Action への直接入力）
            await getProducts({ size: "M" } as unknown as ProductFilters);

            // Assert —— 黙って捨てず、配列指定と同じ条件を組む
            expect(idQuery().values).toContainEqual(["M"]);
        });

        it("カラーでフィルタする", async () => {
            await getProducts({ color: ["Red", "Blue"] });

            const q = idQuery();
            expect(sqlText(q)).toContain(`JOIN "Color"`);
            expect(q.values).toContainEqual(["Red", "Blue"]);
        });
    });

    describe("属性フィルタ（plan 076）", () => {
        it("同じ key の値は 1 つの述語に OR でまとめ、PRODUCT / VARIANT 両スコープを見る", async () => {
            // Act
            await getProducts({ attributes: { material: ["wool", "cotton"] } });

            // Assert
            const q = idQuery();
            expect(sqlText(q)).toContain(`FROM "ProductAttributeValue" v`);
            expect(sqlText(q)).toContain(`FROM "VariantAttributeValue" v`);
            expect(q.values).toContainEqual("material");
            expect(q.values).toContainEqual(["wool", "cotton"]);
        });
    });

    describe("ソート（末尾は必ず id の tie-breaker）", () => {
        it.each([
            ["", `ORDER BY p.views DESC, p.id ASC`],
            ["most-popular", `ORDER BY p.views DESC, p.id ASC`],
            ["new-arrivals", `ORDER BY p."createdAt" DESC, p.id ASC`],
            ["top-rated", `ORDER BY p.rating DESC, p.id ASC`],
        ])("sort=%p は %s", async (sortBy, expected) => {
            await getProducts({}, sortBy);

            expect(sqlText(idQuery())).toContain(expected);
        });

        // 価格順は非正規化列 minPrice（割引後の最小価格）で DB が並べる（plan 076）。
        // 旧実装はページング後にメモリ上で並べ替えており、1 ページ内しか並ばなかった。
        it.each([
            ["price-low-to-high", `ORDER BY p."minPrice" ASC NULLS LAST, p.id ASC`],
            ["price-high-to-low", `ORDER BY p."minPrice" DESC NULLS LAST, p.id ASC`],
        ])("sort=%p は %s", async (sortBy, expected) => {
            await getProducts({}, sortBy);

            expect(sqlText(idQuery())).toContain(expected);
        });

        it("価格順でも hydrate 後に並べ替えない（ID クエリの順を保つ）", async () => {
            // Arrange — ID クエリは p1($50) → p2($20) の順。メモリ上で再ソートしたら p2 が先になる
            arrangeRows(["p1", "p2"]);
            mockDb.product.findMany.mockResolvedValue([
                productWithPrice("p1", 50),
                productWithPrice("p2", 20),
            ]);

            // Act
            const result = await getProducts({}, "price-low-to-high");

            // Assert
            expect(result.products.map((p) => p.id)).toEqual(["p1", "p2"]);
        });
    });

    describe("ページネーションと hydrate", () => {
        it("LIMIT / OFFSET をパラメータで渡す", async () => {
            await getProducts({}, "", 3, 20);

            const q = idQuery();
            expect(sqlText(q)).toMatch(/LIMIT \? OFFSET \?/);
            expect(q.values.slice(-2)).toEqual([20, 40]); // (3-1) * 20
        });

        it("totalPages を件数クエリから計算する", async () => {
            // Arrange
            arrangeRows(["p0", "p1"], 5);
            mockDb.product.findMany.mockResolvedValue([
                productWithPrice("p0", 10),
                productWithPrice("p1", 10),
            ]);

            // Act
            const result = await getProducts({}, "", 1, 2);

            // Assert
            expect(result.totalCount).toBe(5);
            expect(result.totalPages).toBe(3); // ceil(5/2)
            expect(result.currentPage).toBe(1);
            expect(result.pageSize).toBe(2);
        });

        it("hydrate した商品を ID クエリの順に並べ直す", async () => {
            // Arrange — findMany は順序を保証しないので、わざと逆順で返す
            arrangeRows(["p2", "p1"]);
            mockDb.product.findMany.mockResolvedValue([
                productWithPrice("p1", 10),
                productWithPrice("p2", 10),
            ]);

            // Act
            const result = await getProducts({});

            // Assert
            expect(result.products.map((p) => p.id)).toEqual(["p2", "p1"]);
            expect(mockDb.product.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: { in: ["p2", "p1"] } } })
            );
        });

        it("ID が 0 件なら hydrate しない", async () => {
            await getProducts({});

            expect(mockDb.product.findMany).not.toHaveBeenCalled();
        });
    });
});

describe("getProductFacets", () => {
    /**
     * 集計 SQL の意味（実際の件数）は統合テストが実 PostgreSQL で検証する。ここでは
     * 早期リターン・disjunctive 集計のクエリ構成・行の組み立てと並び順を検証する。
     */
    type RawSql = { strings: readonly string[]; values: unknown[] };
    const sqlText = (q: RawSql): string => q.strings.join("?");
    const rawCalls = (): RawSql[] =>
        mockDb.$queryRaw.mock.calls.map((c: unknown[]) => c[0] as RawSql);

    /** 集計 1 行（FacetCountRow） */
    const row = (
        overrides: Partial<{
            key: string;
            name: string;
            unit: string | null;
            def_order: number;
            value: string;
            label: string;
            option_order: number | null;
            count: bigint;
        }> = {}
    ) => ({
        key: "material",
        name: "Material",
        unit: null,
        def_order: 0,
        value: "wool",
        label: "Wool",
        option_order: null,
        count: BigInt(1),
        ...overrides,
    });

    beforeEach(() => {
        mockDb.category.findUnique.mockResolvedValue({
            id: "cat-1",
            path: "fashion",
            url: "fashion",
        });
        mockDb.$queryRaw.mockResolvedValue([]);
    });

    describe("早期リターン（DB を集計しない）", () => {
        it.each([
            ["カテゴリ未指定", {}],
            ["不正なフィルタ", { category: "fashion", attributes: { "Bad Key": ["x"] } }],
            ["文字・数字を含まない検索語", { category: "fashion", search: "&|!" }],
        ])("%s なら空配列を返す", async (_label, filters) => {
            // Act
            const result = await getProductFacets(filters as ProductFilters);

            // Assert
            expect(result).toEqual([]);
            expect(mockDb.$queryRaw).not.toHaveBeenCalled();
        });

        it("存在しないカテゴリなら空配列を返す", async () => {
            // Arrange
            mockDb.category.findUnique.mockResolvedValue(null);

            // Act
            const result = await getProductFacets({ category: "missing" });

            // Assert
            expect(result).toEqual([]);
            expect(mockDb.$queryRaw).not.toHaveBeenCalled();
        });
    });

    describe("選択なし", () => {
        it("1 クエリで全 key を集計し、検索語の述語を母集合に課す", async () => {
            // Act
            await getProductFacets({ category: "fashion", search: "coat" });

            // Assert
            const calls = rawCalls();
            expect(calls).toHaveLength(1);
            expect(sqlText(calls[0])).toContain("WHERE TRUE");
            expect(sqlText(calls[0])).toContain(`"searchVector" @@ to_tsquery('simple',`);
            expect(calls[0].values).toContain("coat:*");
        });

        it("label は GROUP BY に含めず集約する（同じ key × value を 1 行にまとめる）", async () => {
            // Act
            await getProductFacets({ category: "fashion" });

            // Assert
            const text = sqlText(rawCalls()[0]);
            expect(text).toContain("min(COALESCE(o.label");
            const groupBy = text.slice(text.lastIndexOf("GROUP BY"));
            expect(groupBy).toContain("o.value");
            expect(groupBy).not.toContain("o.label");
        });

        it("定義順 → key 順、値は option 順 → 件数の多い順 → label 順に並べる", async () => {
            // Arrange
            mockDb.$queryRaw.mockResolvedValue([
                row({ key: "size_cm", name: "Size", unit: "cm", def_order: 1, value: "55", label: "55" }),
                row({ key: "color", name: "Color", def_order: 0, value: "red", label: "Red", option_order: 1 }),
                row({ key: "color", name: "Color", def_order: 0, value: "blue", label: "Blue", option_order: 0 }),
                row({ key: "brand", name: "Brand", def_order: 0, value: "b", label: "B", count: BigInt(2) }),
                row({ key: "brand", name: "Brand", def_order: 0, value: "a", label: "A", count: BigInt(2) }),
                row({ key: "brand", name: "Brand", def_order: 0, value: "c", label: "C", count: BigInt(5) }),
            ]);

            // Act
            const result = await getProductFacets({ category: "fashion" });

            // Assert
            expect(result.map((f) => f.key)).toEqual(["brand", "color", "size_cm"]);
            expect(result[0].values.map((v) => v.value)).toEqual(["c", "a", "b"]);
            expect(result[1].values.map((v) => v.value)).toEqual(["blue", "red"]);
            expect(result[2]).toEqual({
                key: "size_cm",
                name: "Size",
                unit: "cm",
                values: [{ value: "55", label: "55", count: 1, selected: false }],
            });
        });
    });

    describe("選択あり（disjunctive faceting）", () => {
        it("選択中の key ごとに、その key の選択だけを外した母集合で数える", async () => {
            // Act
            await getProductFacets({
                category: "fashion",
                attributes: { color: ["red"], material: ["wool"] },
            });

            // Assert —— 未選択分 1 + 選択中の key 2
            const [unselected, colorRun, materialRun] = rawCalls();
            expect(rawCalls()).toHaveLength(3);
            expect(sqlText(unselected)).toContain("d.key <> ALL(");
            expect(unselected.values).toContainEqual(["color", "material"]);

            expect(colorRun.values).not.toContainEqual(["red"]);
            expect(colorRun.values).toContainEqual(["wool"]);
            expect(materialRun.values).toContainEqual(["red"]);
            expect(materialRun.values).not.toContainEqual(["wool"]);
        });

        it("選択値に印を付け、母集合に無い選択値・key も件数 0 で残す", async () => {
            // Arrange
            mockDb.$queryRaw
                .mockResolvedValueOnce([
                    row({ key: "season", name: "Season", def_order: 2, value: "ss", label: "SS" }),
                ])
                .mockResolvedValueOnce([
                    row({ key: "color", name: "Color", value: "red", label: "Red", count: BigInt(3) }),
                ])
                .mockResolvedValueOnce([]);

            // Act
            const result = await getProductFacets({
                category: "fashion",
                attributes: { color: ["red", "green"], stale_key: ["x"] },
            });

            // Assert
            expect(result.map((f) => f.key)).toEqual(["color", "season", "stale_key"]);
            expect(result[0].values).toEqual([
                { value: "red", label: "Red", count: 3, selected: true },
                { value: "green", label: "green", count: 0, selected: true },
            ]);
            expect(result[1].values[0].selected).toBe(false);
            expect(result[2]).toEqual({
                key: "stale_key",
                name: "stale_key",
                unit: null,
                values: [{ value: "x", label: "x", count: 0, selected: true }],
            });
        });
    });

    describe("エラー", () => {
        it.each([
            ["Error", new Error("db down")],
            ["Error 以外", "boom"],
        ])("%s をログに残して再送出する", async (_label, thrown) => {
            // Arrange
            const spy = jest.spyOn(console, "error").mockImplementation(() => {});
            mockDb.$queryRaw.mockRejectedValue(thrown);

            // Act & Assert
            await expect(getProductFacets({ category: "fashion" })).rejects.toBe(thrown);
            expect(spy).toHaveBeenCalledWith(
                "[product:getProductFacets]",
                expect.anything(),
                ...(thrown instanceof Error ? [expect.objectContaining({ stack: expect.any(String) })] : [])
            );
            spy.mockRestore();
        });
    });
});

describe("getProductsByIds", () => {
    it("空のIDリストの場合エラーをスローする", async () => {
        await expect(getProductsByIds([])).rejects.toThrow("Ids are undefined");
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

        const result = await getProductsByIds(["v1"], 2, 5);

        expect(mockDb.productVariant.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: { in: ["v1"] } },
            })
        );
        expect(result.totalPages).toBe(0); // 0 records
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

// ==================================================
// getProductPageData
// ==================================================
describe("getProductPageData", () => {
    beforeEach(() => {
        (currentUser as jest.Mock).mockResolvedValue({ id: "user-123" });
        const mockProduct = {
            id: "product-123",
            slug: "lux-noir",
            shippingFeeMethod: "ITEM",
            freeShipping: null,
            storeId: "store-123",
            store: {
                id: "store-123",
                returnPolicy: "14 days",
                defaultShippingService: "Standard",
                defaultShippingFeePerItem: { toNumber: () => 5 },
                defaultShippingFeeForAdditionalItem: { toNumber: () => 2 },
                defaultShippingFeePerKg: { toNumber: () => 3 },
                defaultShippingFeeFixed: { toNumber: () => 10 },
            },
            category: { id: "cat-123" },
            subCategory: { id: "subcat-123" },
            offerTag: null,
            specs: [],
            questions: [],
            reviews: [],
            rating: 4.5,
            variants: [
                {
                    id: "variant-123",
                    slug: "black",
                    variantName: "Black",
                    isSale: false,
                    saleEndDate: null,
                    images: [{ url: "img1.jpg" }],
                    colors: [],
                    sizes: [{ price: { toNumber: () => 100 }, discount: 0 }],
                    specs: [],
                },
            ],
            variantsInfo: [],
        };
        mockDb.product.findUnique.mockResolvedValue(mockProduct);
        mockDb.productVariant.findMany.mockResolvedValue([]);
        mockDb.store.findUnique.mockImplementation(async (params: unknown) => {
            const select =
                typeof params === "object" && params !== null
                    ? (
                          params as {
                              select?: {
                                  _count?: unknown;
                                  followers?: unknown;
                              };
                          }
                      ).select
                    : undefined;
            if (select && select._count) {
                return { _count: { followers: 0 } };
            }
            if (select && select.followers) {
                return { followers: [] };
            }
            return null;
        });
    });

    it("cookies() が Promise を返す場合に cookieStore.get で正しく国を解決すること", async () => {
        const { cookies } = require("next/headers");
        mockDb.review.groupBy.mockResolvedValue([]);
        mockDb.review.count.mockResolvedValue(0);

        // cookies() が Promise を返すモック (Next.js 15+ 挙動)
        const cookieStore = {
            get: jest.fn().mockReturnValue({
                value: JSON.stringify({
                    name: "United States",
                    code: "US",
                    city: "New York",
                }),
            }),
        };
        const cookiesPromise = Promise.resolve(cookieStore);
        (cookies as jest.Mock).mockImplementation(() => cookiesPromise);

        const result = await getProductPageData("lux-noir", "black");
        expect(result).toBeDefined();
        expect(cookieStore.get).toHaveBeenCalledWith("userCountry");
        expect(result?.store).toEqual(expect.objectContaining({ returnPolicy: "14 days" }));
    });
});
