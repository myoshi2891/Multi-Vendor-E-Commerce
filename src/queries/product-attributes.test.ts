/**
 * upsertProduct の属性値保存（plan 069 Step 8）のユニットテスト。
 *
 * `@/lib/attribute-sync` は**モックせず実装を通す**。`$queryRaw` は SQL 文字列で
 * 応答を振り分けるルーターにし、ロック付き / なしの 2 回の検証（外側 + tx 内）を
 * 同じデータで再現する。実 DB の制約・並行性は tests/integration/ 側で検証する。
 */
import { currentUser } from "@clerk/nextjs/server";
import { upsertProduct } from "./product";
import { TEST_CONFIG } from "../config/test-config";
import { createMockStore } from "../config/test-fixtures";
import type { AttributeValueInput } from "@/lib/attribute-definitions";

jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

jest.mock("@/lib/db", () => {
    const model = (...methods: string[]) =>
        Object.fromEntries(methods.map((method) => [method, jest.fn()]));
    return {
        db: {
            $queryRaw: jest.fn(),
            $transaction: jest.fn(),
            store: model("findUnique"),
            product: model("findUnique", "findFirst", "create", "update"),
            productVariant: model("findFirst", "create", "update"),
            productAttributeValue: model(
                "findMany",
                "deleteMany",
                "createMany"
            ),
            variantAttributeValue: model(
                "findMany",
                "deleteMany",
                "createMany"
            ),
            spec: model("deleteMany", "createMany"),
            question: model("deleteMany", "createMany"),
            freeShipping: model("deleteMany", "create"),
            productVariantImage: model("deleteMany", "createMany"),
            color: model("deleteMany", "createMany"),
            size: model("deleteMany", "createMany"),
        },
    };
});

jest.mock("slugify", () =>
    jest.fn((str: string) => str.toLowerCase().replace(/\s+/g, "-"))
);

const mockDb = require("@/lib/db").db;

const STORE_ID = TEST_CONFIG.DEFAULT_STORE_ID;
const ROOT = {
    id: "cat-food",
    parentId: null,
    path: "food",
    depth: 0,
    childCount: 1,
};
const LEAF = {
    id: "cat-snacks",
    parentId: "cat-food",
    path: "food/snacks",
    depth: 1,
    childCount: 0,
};

interface DefinitionFixture {
    id: string;
    categoryId: string;
    key: string;
    name: string;
    type: "TEXT" | "NUMBER" | "BOOLEAN" | "ENUM";
    scope: "PRODUCT" | "VARIANT";
    required: boolean;
    multiValued: boolean;
    archivedAt: Date | null;
    path: string;
}

const definition = (
    overrides: Partial<DefinitionFixture> & { id: string }
): DefinitionFixture => ({
    categoryId: ROOT.id,
    key: overrides.id,
    name: overrides.id,
    type: "TEXT",
    scope: "PRODUCT",
    required: false,
    multiValued: false,
    archivedAt: null,
    path: ROOT.path,
    ...overrides,
});

interface World {
    product: { id: string; storeId: string } | null;
    variants: { id: string; productId: string }[];
    definitions: DefinitionFixture[];
    /** tx 内（行ロック付き）の読み取りだけに返す定義。race の再現に使う。 */
    lockedDefinitions?: DefinitionFixture[];
    options: { id: string; definitionId: string; archivedAt: Date | null }[];
}

/** Prisma.sql / Prisma.join が作る埋め込み断片（値と SQL 文字列を持つ）。 */
interface SqlFragment {
    sql: string;
    values: unknown[];
}

const isSqlFragment = (value: unknown): value is SqlFragment =>
    typeof value === "object" &&
    value !== null &&
    "values" in value &&
    Array.isArray(value.values) &&
    "sql" in value &&
    typeof value.sql === "string";

/** 埋め込み断片から値を平坦化して取り出す。 */
const flattenValues = (values: unknown[]): unknown[] =>
    values.flatMap((value) => (isSqlFragment(value) ? value.values : [value]));

const routeQueryRaw = (world: World) =>
    mockDb.$queryRaw.mockImplementation(
        async (strings: TemplateStringsArray, ...rawValues: unknown[]) => {
            const sql = strings.join("?");
            const values = flattenValues(rawValues);
            const locked = rawValues.some(
                (value) =>
                    isSqlFragment(value) &&
                    /FOR (NO KEY UPDATE|UPDATE|SHARE)/.test(value.sql)
            );
            if (sql.includes('FROM "AttributeDefinition" d')) {
                return locked && world.lockedDefinitions
                    ? world.lockedDefinitions
                    : world.definitions;
            }
            if (sql.includes('FROM "AttributeOption"')) {
                return world.options.filter((option) =>
                    values.includes(option.id)
                );
            }
            if (sql.includes('FROM "ProductVariant"')) {
                return world.variants.filter((variant) =>
                    values.includes(variant.id)
                );
            }
            if (sql.includes('FROM "Product"')) {
                return world.product ? [world.product] : [];
            }
            if (sql.includes('"path" IN')) {
                return [ROOT, LEAF];
            }
            if (sql.includes('FROM "Category"')) {
                return [ROOT, LEAF].filter((row) => values.includes(row.id));
            }
            throw new Error(`unexpected query: ${sql}`);
        }
    );

const productInput = (
    attributes: AttributeValueInput[] | undefined,
    overrides = {}
) => ({
    productId: "product-1",
    variantId: "variant-1",
    name: "Rice Crackers",
    description: "desc",
    variantName: "Salt",
    variantDescription: "",
    images: [{ url: "https://example.com/1.jpg" }],
    variantImage: "https://example.com/v.jpg",
    categoryId: ROOT.id,
    subCategoryId: LEAF.id,
    offerTagId: undefined,
    isSale: false,
    saleEndDate: null,
    brand: "Brand",
    sku: "SKU",
    weight: 0.2,
    colors: [],
    sizes: [{ size: "S", quantity: 1, price: 1, discount: 0 }],
    product_specs: [],
    variant_specs: [],
    keywords: [],
    questions: [],
    freeShippingForAllCountries: false,
    freeShippingCountriesIds: [],
    shippingFeeMethod: "ITEM",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    attributes,
    ...overrides,
});

/** 属性行・商品本体への書き込みが一切起きていないこと（3 階層の (c) 副作用なし）。 */
const expectNoWrites = () => {
    expect(mockDb.productAttributeValue.createMany).not.toHaveBeenCalled();
    expect(mockDb.productAttributeValue.deleteMany).not.toHaveBeenCalled();
    expect(mockDb.variantAttributeValue.createMany).not.toHaveBeenCalled();
    expect(mockDb.variantAttributeValue.deleteMany).not.toHaveBeenCalled();
    expect(mockDb.product.create).not.toHaveBeenCalled();
    expect(mockDb.product.update).not.toHaveBeenCalled();
    expect(mockDb.productVariant.create).not.toHaveBeenCalled();
};

beforeEach(() => {
    jest.resetAllMocks();
    (currentUser as jest.Mock).mockResolvedValue({
        id: TEST_CONFIG.DEFAULT_USER_ID,
        privateMetadata: { role: "SELLER" },
    });
    mockDb.store.findUnique.mockResolvedValue(createMockStore());
    mockDb.product.findFirst.mockResolvedValue(null);
    mockDb.productVariant.findFirst.mockResolvedValue(null);
    mockDb.productAttributeValue.findMany.mockResolvedValue([]);
    mockDb.variantAttributeValue.findMany.mockResolvedValue([]);
    mockDb.$transaction.mockImplementation(
        async (fn: (tx: typeof mockDb) => Promise<unknown>) => fn(mockDb)
    );
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
    jest.restoreAllMocks();
});

/** 既存の商品 + バリアントを更新する状態にする。 */
const asExistingProduct = (world: World) => {
    mockDb.product.findUnique.mockResolvedValue({
        id: "product-1",
        name: "Rice Crackers",
        slug: "rice-crackers",
        categoryId: ROOT.id,
        subCategoryId: LEAF.id,
    });
    mockDb.productVariant.findFirst.mockResolvedValue({
        id: "variant-1",
        variantName: "Salt",
        slug: "salt",
    });
    world.product = { id: "product-1", storeId: STORE_ID };
    world.variants.push({ id: "variant-1", productId: "product-1" });
};

describe("upsertProduct の属性値保存", () => {
    describe("認可の拒否（SECURITY_GAP_REPORT §5.2 の 3 階層）", () => {
        it("(1) 別商品のバリアント id を混ぜた payload を拒否する", async () => {
            // Arrange
            const world: World = {
                product: null,
                variants: [{ id: "variant-other", productId: "product-other" }],
                definitions: [
                    definition({
                        id: "net_weight",
                        type: "NUMBER",
                        scope: "VARIANT",
                    }),
                ],
                options: [],
            };
            asExistingProduct(world);
            routeQueryRaw(world);

            // Act & Assert (a) スロー
            await expect(
                upsertProduct(
                    productInput([
                        {
                            scope: "VARIANT",
                            definitionId: "net_weight",
                            variantId: "variant-other",
                            value: "100",
                        },
                    ]) as never,
                    TEST_CONFIG.TEST_STORE_URL
                )
            ).rejects.toThrow("Variant does not belong to this product.");

            // (b) where 構造: 商品は店舗で、バリアントは商品 + 店舗で絞って引いている
            expect(mockDb.product.findUnique).toHaveBeenCalledWith({
                where: { id: "product-1", storeId: STORE_ID },
            });
            expect(mockDb.productVariant.findFirst).toHaveBeenCalledWith({
                where: {
                    id: "variant-1",
                    productId: "product-1",
                    product: { storeId: STORE_ID },
                },
            });
            // (c) 副作用なし（外側の検証で止まり tx に入らない）
            expect(mockDb.$transaction).not.toHaveBeenCalled();
            expectNoWrites();
        });

        it("(2) 別店舗の商品 id で呼ぶと拒否する", async () => {
            // Arrange: 店舗で絞った lookup は null（= 自店舗の商品ではない）が、行は実在する
            mockDb.product.findUnique.mockResolvedValue(null);
            const world: World = {
                product: { id: "product-1", storeId: "store-other" },
                variants: [],
                definitions: [],
                options: [],
            };
            routeQueryRaw(world);

            // Act & Assert (a)
            await expect(
                upsertProduct(
                    productInput([]) as never,
                    TEST_CONFIG.TEST_STORE_URL
                )
            ).rejects.toThrow("Product does not belong to this store.");

            // (b)
            expect(mockDb.product.findUnique).toHaveBeenCalledWith({
                where: { id: "product-1", storeId: STORE_ID },
            });
            // (c)
            expect(mockDb.$transaction).not.toHaveBeenCalled();
            expectNoWrites();
        });

        it("(3) 選択カテゴリと無関係な定義を拒否する", async () => {
            // Arrange
            const world: World = {
                product: null,
                variants: [],
                definitions: [definition({ id: "allergens_note" })],
                options: [],
            };
            routeQueryRaw(world);

            // Act & Assert (a)
            await expect(
                upsertProduct(
                    productInput([
                        {
                            scope: "PRODUCT",
                            definitionId: "screen_size",
                            value: "55",
                        },
                    ]) as never,
                    TEST_CONFIG.TEST_STORE_URL
                )
            ).rejects.toThrow(
                "Attribute is not available for the selected category."
            );

            // (b) 定義は選択ノード + 祖先の Category id で絞って引いている
            const definitionQuery = mockDb.$queryRaw.mock.calls.find(
                ([strings]: [TemplateStringsArray]) =>
                    strings.join("?").includes('FROM "AttributeDefinition" d')
            );
            expect(flattenValues(definitionQuery.slice(1))).toEqual([
                ROOT.id,
                LEAF.id,
            ]);
            // (c)
            expect(mockDb.$transaction).not.toHaveBeenCalled();
            expectNoWrites();
        });
    });

    describe("保存（A-1: 型が指す列だけを埋める）", () => {
        it("新規作成で PRODUCT / VARIANT の値を所有先ごとに作る", async () => {
            // Arrange
            const world: World = {
                product: null,
                variants: [],
                definitions: [
                    definition({ id: "origin", type: "ENUM" }),
                    definition({
                        id: "net_weight",
                        type: "NUMBER",
                        scope: "VARIANT",
                    }),
                ],
                options: [
                    { id: "opt-jp", definitionId: "origin", archivedAt: null },
                ],
            };
            routeQueryRaw(world);
            mockDb.product.create.mockImplementation(async () => {
                // tx 内の再検証から見えるよう、作成した行を world に足す
                world.product = { id: "product-1", storeId: STORE_ID };
                world.variants.push({
                    id: "variant-1",
                    productId: "product-1",
                });
                return { id: "product-1" };
            });

            // Act
            await upsertProduct(
                productInput([
                    {
                        scope: "PRODUCT",
                        definitionId: "origin",
                        value: "opt-jp",
                    },
                    {
                        scope: "VARIANT",
                        definitionId: "net_weight",
                        variantId: "variant-1",
                        value: "120",
                    },
                ]) as never,
                TEST_CONFIG.TEST_STORE_URL
            );

            // Assert
            expect(
                mockDb.productAttributeValue.createMany
            ).toHaveBeenCalledWith({
                data: [
                    expect.objectContaining({
                        productId: "product-1",
                        definitionId: "origin",
                        scope: "PRODUCT",
                        type: "ENUM",
                        optionId: "opt-jp",
                        valueText: null,
                        valueNumber: null,
                        valueBool: null,
                    }),
                ],
            });
            const [{ data }] =
                mockDb.variantAttributeValue.createMany.mock.calls[0];
            expect(data[0]).toMatchObject({
                variantId: "variant-1",
                definitionId: "net_weight",
                scope: "VARIANT",
                type: "NUMBER",
                valueText: null,
                optionId: null,
            });
            expect(data[0].valueNumber.toString()).toBe("120");
        });

        it("削除は所有先 + アクティブな有効定義に限定する（アーカイブ済み定義の値を巻き込まない）", async () => {
            // Arrange
            const world: World = {
                product: null,
                variants: [],
                definitions: [
                    definition({ id: "origin_note" }),
                    definition({ id: "legacy", archivedAt: new Date() }),
                ],
                options: [],
            };
            asExistingProduct(world);
            routeQueryRaw(world);

            // Act
            await upsertProduct(
                productInput([
                    {
                        scope: "PRODUCT",
                        definitionId: "origin_note",
                        value: "",
                    },
                ]) as never,
                TEST_CONFIG.TEST_STORE_URL
            );

            // Assert
            expect(
                mockDb.productAttributeValue.deleteMany
            ).toHaveBeenCalledWith({
                where: {
                    productId: "product-1",
                    definitionId: { in: ["origin_note"] },
                },
            });
            expect(
                mockDb.productAttributeValue.createMany
            ).not.toHaveBeenCalled();
        });
    });

    describe("必須（A-3: create / update の両方で拒否）", () => {
        const allergens = definition({
            id: "allergens",
            type: "ENUM",
            multiValued: true,
            required: true,
        });

        it("create: 必須属性を送らない商品は作成できない（payload 省略でも迂回できない）", async () => {
            routeQueryRaw({
                product: null,
                variants: [],
                definitions: [allergens],
                options: [],
            });

            await expect(
                upsertProduct(
                    productInput(undefined) as never,
                    TEST_CONFIG.TEST_STORE_URL
                )
            ).rejects.toThrow("allergens is required.");
            expectNoWrites();
        });

        it("update: 必須属性を空で送ると拒否する", async () => {
            const world: World = {
                product: null,
                variants: [],
                definitions: [allergens],
                options: [],
            };
            asExistingProduct(world);
            routeQueryRaw(world);

            await expect(
                upsertProduct(
                    productInput([
                        {
                            scope: "PRODUCT",
                            definitionId: "allergens",
                            value: [],
                        },
                    ]) as never,
                    TEST_CONFIG.TEST_STORE_URL
                )
            ).rejects.toThrow("allergens is required.");
            expectNoWrites();
        });
    });

    describe("選択肢の検証", () => {
        const origin = definition({ id: "origin", type: "ENUM" });

        const saveOrigin = async (world: World, optionId: string) => {
            asExistingProduct(world);
            routeQueryRaw(world);
            return upsertProduct(
                productInput([
                    {
                        scope: "PRODUCT",
                        definitionId: "origin",
                        value: optionId,
                    },
                ]) as never,
                TEST_CONFIG.TEST_STORE_URL
            );
        };

        it("別定義の選択肢は拒否する", async () => {
            const world: World = {
                product: null,
                variants: [],
                definitions: [origin],
                options: [
                    {
                        id: "opt-500ml",
                        definitionId: "volume",
                        archivedAt: null,
                    },
                ],
            };

            await expect(saveOrigin(world, "opt-500ml")).rejects.toThrow(
                "Select a valid origin."
            );
            expectNoWrites();
        });

        it("アーカイブ済み選択肢は、そのレコードの現在値でなければ拒否する", async () => {
            const world: World = {
                product: null,
                variants: [],
                definitions: [origin],
                options: [
                    {
                        id: "opt-old",
                        definitionId: "origin",
                        archivedAt: new Date(),
                    },
                ],
            };

            await expect(saveOrigin(world, "opt-old")).rejects.toThrow(
                "Select a valid origin."
            );
        });

        it("A-11: そのレコードの現在値であるアーカイブ済み選択肢は無編集保存できる", async () => {
            const world: World = {
                product: null,
                variants: [],
                definitions: [origin],
                options: [
                    {
                        id: "opt-old",
                        definitionId: "origin",
                        archivedAt: new Date(),
                    },
                ],
            };
            mockDb.productAttributeValue.findMany.mockResolvedValue([
                {
                    definitionId: "origin",
                    type: "ENUM",
                    multiValued: false,
                    valueText: null,
                    valueNumber: null,
                    valueBool: null,
                    optionId: "opt-old",
                },
            ]);

            await saveOrigin(world, "opt-old");

            expect(
                mockDb.productAttributeValue.createMany
            ).toHaveBeenCalledWith({
                data: [expect.objectContaining({ optionId: "opt-old" })],
            });
        });
    });

    it("tx 内の再検証: 外側の検証後に定義が archive されたら属性行を 1 行も書かない", async () => {
        // Arrange: 外側（ロックなし）ではアクティブ、tx 内（行ロック付き）ではアーカイブ済み
        const active = definition({ id: "origin_note" });
        const world: World = {
            product: null,
            variants: [],
            definitions: [active],
            lockedDefinitions: [{ ...active, archivedAt: new Date() }],
            options: [],
        };
        asExistingProduct(world);
        routeQueryRaw(world);

        // Act & Assert
        await expect(
            upsertProduct(
                productInput([
                    {
                        scope: "PRODUCT",
                        definitionId: "origin_note",
                        value: "Japan",
                    },
                ]) as never,
                TEST_CONFIG.TEST_STORE_URL
            )
        ).rejects.toThrow(
            "Attribute is not available for the selected category."
        );
        expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
        expect(mockDb.productAttributeValue.createMany).not.toHaveBeenCalled();
        expect(mockDb.productAttributeValue.deleteMany).not.toHaveBeenCalled();
    });

    it("payload の形が不正なら拒否する（型付き union を信用しない）", async () => {
        routeQueryRaw({
            product: null,
            variants: [],
            definitions: [],
            options: [],
        });

        await expect(
            upsertProduct(
                productInput([
                    {
                        scope: "VARIANT",
                        definitionId: "net_weight",
                        value: "1",
                    },
                ] as never) as never,
                TEST_CONFIG.TEST_STORE_URL
            )
        ).rejects.toThrow("Invalid attribute values.");
        expectNoWrites();
    });
});
