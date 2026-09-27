import {
    resolveSeedAttributeDefinition,
    seedAttributes,
    seedAttributeValues,
} from "../seeders/attribute-seeder";
import {
    SEED_ATTRIBUTE_DEFINITIONS,
    SEED_ATTRIBUTE_VALUES,
} from "../constants/attributes";
import { ALL_SEED_PRODUCTS, PILOT_PRODUCTS } from "../constants/products";
import { SEED_CATEGORIES } from "../constants/categories";
import {
    AttributeDefinitionFormSchema,
    AttributeOptionFormSchema,
} from "@/lib/schemas";

const mockFindFirst = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockOptionUpsert = jest.fn();

function createMockPrisma() {
    return {
        attributeDefinition: {
            findFirst: mockFindFirst,
            create: mockCreate,
            update: mockUpdate,
        },
        attributeOption: { upsert: mockOptionUpsert },
    } as unknown as import("@prisma/client").PrismaClient;
}

/** 全ノード url -> 擬似 id */
const categoryMap = () =>
    new Map(SEED_CATEGORIES.map((c) => [c.url, `cat-${c.url}`]));

const TOTAL_OPTIONS = SEED_ATTRIBUTE_DEFINITIONS.reduce(
    (sum, def) => sum + (def.options?.length ?? 0),
    0
);

describe("SEED_ATTRIBUTE_DEFINITIONS", () => {
    it("全定義が admin フォームの Zod 制約を満たすこと（ENUM 以外の多値・TEXT の facetable を含まない）", () => {
        for (const def of SEED_ATTRIBUTE_DEFINITIONS) {
            const result = AttributeDefinitionFormSchema.safeParse({
                categoryId: def.categoryUrl,
                key: def.key,
                name: def.name,
                type: def.type,
                scope: def.scope,
                unit: def.unit,
                required: def.required,
                facetable: def.facetable,
                multiValued: def.multiValued,
                sortOrder: 0,
            });
            expect(result.success).toBe(true);
        }
    });

    it("全選択肢が Zod 制約を満たし、定義内で value が一意であること", () => {
        for (const def of SEED_ATTRIBUTE_DEFINITIONS) {
            const values = (def.options ?? []).map((o) => o.value);
            expect(new Set(values).size).toBe(values.length);
            for (const option of def.options ?? []) {
                expect(
                    AttributeOptionFormSchema.safeParse({
                        ...option,
                        sortOrder: 0,
                    }).success
                ).toBe(true);
            }
        }
    });

    it("ENUM は選択肢を持ち、ENUM 以外は持たないこと", () => {
        for (const def of SEED_ATTRIBUTE_DEFINITIONS) {
            if (def.type === "ENUM") {
                expect(def.options?.length ?? 0).toBeGreaterThan(0);
            } else {
                expect(def.options).toBeUndefined();
            }
        }
    });

    it("同一カテゴリ内で key が一意であること（アクティブ部分 UNIQUE と整合）", () => {
        const keys = SEED_ATTRIBUTE_DEFINITIONS.map(
            (d) => `${d.categoryUrl}:${d.key}`
        );
        expect(new Set(keys).size).toBe(keys.length);
    });

    it("定義先は lux- カテゴリに限られ、E2E の e2e- カテゴリへ波及しないこと", () => {
        const urls = new Set(SEED_CATEGORIES.map((c) => c.url));
        for (const def of SEED_ATTRIBUTE_DEFINITIONS) {
            expect(def.categoryUrl).toMatch(/^lux-/);
            expect(urls.has(def.categoryUrl)).toBe(true);
        }
    });

    it("パイロット 3 部門を含み、多値は食品の allergens のみであること（design.md §4）", () => {
        const roots = new Set(
            SEED_ATTRIBUTE_DEFINITIONS.map((d) =>
                d.categoryUrl.split("-").slice(0, 2).join("-")
            )
        );
        expect(roots).toEqual(
            new Set(["lux-electronics", "lux-women", "lux-men", "lux-gourmet"])
        );
        expect(
            SEED_ATTRIBUTE_DEFINITIONS.filter((d) => d.multiValued).map(
                (d) => `${d.categoryUrl}:${d.key}`
            )
        ).toEqual(["lux-gourmet:allergens"]);
    });
});

describe("seedAttributes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        let counter = 0;
        mockCreate.mockImplementation(() => ({ id: `def-${++counter}` }));
        mockOptionUpsert.mockResolvedValue({});
    });

    it("未投入なら全定義を create し、選択肢を upsert する", async () => {
        // Arrange
        mockFindFirst.mockResolvedValue(null);

        // Act
        const result = await seedAttributes(createMockPrisma(), categoryMap());

        // Assert
        expect(mockCreate).toHaveBeenCalledTimes(
            SEED_ATTRIBUTE_DEFINITIONS.length
        );
        expect(mockUpdate).not.toHaveBeenCalled();
        expect(mockOptionUpsert).toHaveBeenCalledTimes(TOTAL_OPTIONS);
        expect(result.definitions.size).toBe(SEED_ATTRIBUTE_DEFINITIONS.length);
        expect(result.optionCount).toBe(TOTAL_OPTIONS);
    });

    it("アクティブ定義を (categoryId, key, archivedAt: null) で探す", async () => {
        mockFindFirst.mockResolvedValue(null);

        await seedAttributes(createMockPrisma(), categoryMap());

        const [first] = SEED_ATTRIBUTE_DEFINITIONS;
        expect(mockFindFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    categoryId: `cat-${first.categoryUrl}`,
                    key: first.key,
                    archivedAt: null,
                },
            })
        );
    });

    it("2 回目（既存あり）は create せず、可変列だけを update する（冪等）", async () => {
        // Arrange: DB が定数と同じ構造の行を返す
        mockFindFirst.mockImplementation(
            (args: { where: { categoryId: string; key: string } }) => {
                const def = SEED_ATTRIBUTE_DEFINITIONS.find(
                    (d) =>
                        `cat-${d.categoryUrl}` === args.where.categoryId &&
                        d.key === args.where.key
                );
                return def
                    ? {
                          id: `existing-${def.categoryUrl}-${def.key}`,
                          type: def.type,
                          scope: def.scope,
                          multiValued: def.multiValued,
                      }
                    : null;
            }
        );

        // Act
        const result = await seedAttributes(createMockPrisma(), categoryMap());

        // Assert
        expect(mockCreate).not.toHaveBeenCalled();
        expect(mockUpdate).toHaveBeenCalledTimes(
            SEED_ATTRIBUTE_DEFINITIONS.length
        );
        for (const [args] of mockUpdate.mock.calls) {
            const data = (args as { data: Record<string, unknown> }).data;
            expect(Object.keys(data).sort()).toEqual(
                ["facetable", "name", "required", "sortOrder", "unit"].sort()
            );
        }
        expect(result.definitions.get("lux-gourmet:allergens")).toBe(
            "existing-lux-gourmet-allergens"
        );
    });

    it("選択肢は (definitionId, value) で upsert し、archivedAt を更新しない", async () => {
        mockFindFirst.mockResolvedValue(null);

        await seedAttributes(createMockPrisma(), categoryMap());

        for (const [args] of mockOptionUpsert.mock.calls) {
            expect(args.where).toHaveProperty("definitionId_value");
            expect(args.update).not.toHaveProperty("archivedAt");
            expect(args.create).not.toHaveProperty("archivedAt");
        }
    });

    it("既存定義の構造（type / scope / multiValued）が定数と食い違えば throw する", async () => {
        // Arrange
        mockFindFirst.mockResolvedValue({
            id: "existing",
            type: "TEXT",
            scope: "PRODUCT",
            multiValued: false,
        });

        // Act & Assert
        await expect(
            seedAttributes(createMockPrisma(), categoryMap())
        ).rejects.toThrow("構造が定数と食い違います");
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("定義先カテゴリが未投入なら throw する", async () => {
        await expect(
            seedAttributes(createMockPrisma(), new Map())
        ).rejects.toThrow("定義先カテゴリが見つかりません");
        expect(mockCreate).not.toHaveBeenCalled();
    });
});

describe("resolveSeedAttributeDefinition", () => {
    it("祖先から継承し、同じ key は最も深いノードの定義を返す", () => {
        expect(
            resolveSeedAttributeDefinition(
                "lux-electronics-cameras",
                "connectivity"
            )?.categoryUrl
        ).toBe("lux-electronics");
        expect(
            resolveSeedAttributeDefinition(
                "lux-electronics-cameras",
                "resolution"
            )?.categoryUrl
        ).toBe("lux-electronics-cameras");
    });

    it("祖先パス上に無い key は undefined", () => {
        expect(
            resolveSeedAttributeDefinition(
                "lux-electronics-audio",
                "resolution"
            )
        ).toBeUndefined();
    });
});

describe("SEED_ATTRIBUTE_VALUES", () => {
    const productBySlug = new Map(ALL_SEED_PRODUCTS.map((p) => [p.slug, p]));

    it("全値が実在する商品（とその商品のバリアント）を指し、定義の scope と一致すること", () => {
        for (const entry of SEED_ATTRIBUTE_VALUES) {
            const product = productBySlug.get(entry.productSlug);
            expect(product).toBeDefined();
            if (!product) continue;
            const def = resolveSeedAttributeDefinition(
                product.categoryUrl,
                entry.key
            );
            expect(def).toBeDefined();
            expect(def?.scope).toBe(entry.variantSlug ? "VARIANT" : "PRODUCT");
            if (entry.variantSlug) {
                expect(product.variants.map((v) => v.slug)).toContain(
                    entry.variantSlug
                );
            }
        }
    });

    it("ENUM の値は選択肢の value に存在し、多値かどうかと配列かどうかが一致すること", () => {
        for (const entry of SEED_ATTRIBUTE_VALUES) {
            const product = productBySlug.get(entry.productSlug);
            const def =
                product &&
                resolveSeedAttributeDefinition(product.categoryUrl, entry.key);
            if (!def || def.type !== "ENUM") continue;
            const values = Array.isArray(entry.value)
                ? entry.value
                : [entry.value];
            expect(Array.isArray(entry.value)).toBe(def.multiValued);
            const optionValues = (def.options ?? []).map((o) => o.value);
            for (const value of values) {
                expect(optionValues).toContain(value);
            }
        }
    });

    it("同じ所有先 × key の値が重複しないこと", () => {
        const keys = SEED_ATTRIBUTE_VALUES.map(
            (e) => `${e.productSlug}:${e.variantSlug ?? "-"}:${e.key}`
        );
        expect(new Set(keys).size).toBe(keys.length);
    });

    it("パイロット商品は必須属性をすべて満たすこと（PRODUCT は商品、VARIANT は全バリアント）", () => {
        for (const product of PILOT_PRODUCTS) {
            const keys = new Set(SEED_ATTRIBUTE_DEFINITIONS.map((d) => d.key));
            for (const key of keys) {
                const def = resolveSeedAttributeDefinition(
                    product.categoryUrl,
                    key
                );
                if (!def?.required) continue;
                const owners =
                    def.scope === "PRODUCT"
                        ? [undefined]
                        : product.variants.map((v) => v.slug);
                for (const variantSlug of owners) {
                    expect(
                        SEED_ATTRIBUTE_VALUES.some(
                            (e) =>
                                e.productSlug === product.slug &&
                                e.variantSlug === variantSlug &&
                                e.key === key
                        )
                    ).toBe(true);
                }
            }
        }
    });
});

describe("seedAttributeValues", () => {
    const mockProductDeleteMany = jest.fn();
    const mockVariantDeleteMany = jest.fn();
    const mockProductCreateMany = jest.fn();
    const mockVariantCreateMany = jest.fn();
    const mockOptionFindMany = jest.fn();

    const valuePrisma = () =>
        ({
            productAttributeValue: {
                deleteMany: mockProductDeleteMany,
                createMany: mockProductCreateMany,
            },
            variantAttributeValue: {
                deleteMany: mockVariantDeleteMany,
                createMany: mockVariantCreateMany,
            },
            attributeOption: { findMany: mockOptionFindMany },
        }) as unknown as import("@prisma/client").PrismaClient;

    const maps = () => ({
        definitions: new Map(
            SEED_ATTRIBUTE_DEFINITIONS.map((d) => [
                `${d.categoryUrl}:${d.key}`,
                `def:${d.categoryUrl}:${d.key}`,
            ])
        ),
        products: new Map(
            ALL_SEED_PRODUCTS.map((p) => [p.slug, `p:${p.slug}`])
        ),
        variants: new Map(
            ALL_SEED_PRODUCTS.flatMap((p) =>
                p.variants.map((v) => [v.slug, `v:${v.slug}`] as const)
            )
        ),
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // 選択肢 id は `opt:<definitionId>:<value>` とする
        mockOptionFindMany.mockImplementation(
            (args: { where: { definitionId: string } }) => {
                const def = SEED_ATTRIBUTE_DEFINITIONS.find(
                    (d) =>
                        `def:${d.categoryUrl}:${d.key}` ===
                        args.where.definitionId
                );
                return (def?.options ?? []).map((o) => ({
                    id: `opt:${args.where.definitionId}:${o.value}`,
                    value: o.value,
                }));
            }
        );
    });

    it("全シード商品の既存値を所有先単位で消してから作り直す（収束）", async () => {
        // Act
        await seedAttributeValues(valuePrisma(), maps());

        // Assert
        expect(mockProductDeleteMany).toHaveBeenCalledWith({
            where: {
                productId: {
                    in: ALL_SEED_PRODUCTS.map((p) => `p:${p.slug}`),
                },
            },
        });
        expect(mockVariantDeleteMany).toHaveBeenCalledWith({
            where: {
                variantId: {
                    in: ALL_SEED_PRODUCTS.flatMap((p) =>
                        p.variants.map((v) => `v:${v.slug}`)
                    ),
                },
            },
        });
    });

    it("型に応じた列へ変換し、ENUM は選択肢 value を id へ引く（多値は選択肢ごとに 1 行）", async () => {
        await seedAttributeValues(valuePrisma(), maps());

        const productRows = mockProductCreateMany.mock.calls.flatMap(
            ([args]) => args.data
        );
        const allergenDef = "def:lux-gourmet:allergens";
        expect(
            productRows
                .filter(
                    (r: { definitionId: string }) =>
                        r.definitionId === allergenDef
                )
                .map((r: { optionId: string }) => r.optionId)
        ).toEqual([
            `opt:${allergenDef}:milk`,
            `opt:${allergenDef}:tree_nuts`,
            `opt:${allergenDef}:soy`,
        ]);
        const screen = productRows.find(
            (r: { definitionId: string }) =>
                r.definitionId === "def:lux-electronics-cameras:screen_size"
        );
        expect(screen).toEqual(
            expect.objectContaining({
                productId: "p:lux-atelier-rangefinder-camera",
                scope: "PRODUCT",
                type: "NUMBER",
                multiValued: false,
                valueText: null,
                optionId: null,
            })
        );
        expect(screen.valueNumber.toString()).toBe("3");

        const variantRows = mockVariantCreateMany.mock.calls.flatMap(
            ([args]) => args.data
        );
        expect(
            variantRows.map((r: { variantId: string }) => r.variantId).sort()
        ).toEqual(
            [
                "v:lux-atelier-rangefinder-camera-256",
                "v:lux-atelier-rangefinder-camera-512",
                "v:lux-lumiere-grand-cru-chocolate-12",
                "v:lux-lumiere-grand-cru-chocolate-24",
            ].sort()
        );
        expect(
            variantRows.every((r: { scope: string }) => r.scope === "VARIANT")
        ).toBe(true);
    });

    it("選択肢が DB に無ければ throw する（黙って落とさない）", async () => {
        mockOptionFindMany.mockResolvedValue([]);

        await expect(
            seedAttributeValues(valuePrisma(), maps())
        ).rejects.toThrow("選択肢が見つかりません");
    });

    it("定義が投入されていなければ throw する", async () => {
        await expect(
            seedAttributeValues(valuePrisma(), {
                ...maps(),
                definitions: new Map(),
            })
        ).rejects.toThrow("属性定義が見つかりません");
    });
});
