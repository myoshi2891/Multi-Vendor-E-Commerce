import { seedAttributes } from "../seeders/attribute-seeder";
import { SEED_ATTRIBUTE_DEFINITIONS } from "../constants/attributes";
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
