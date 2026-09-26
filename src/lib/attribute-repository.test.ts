import { Prisma } from "@prisma/client";
import type { AttributeDefinitionDTO } from "./attribute-definitions";
import {
    findProductAttributeDisplay,
    toAttributeDisplayItems,
    type AttributeDisplayClient,
} from "./attribute-repository";

const defDTO = (
    overrides: Partial<AttributeDefinitionDTO> & { id: string }
): AttributeDefinitionDTO => ({
    key: overrides.id,
    name: overrides.id,
    type: "TEXT",
    scope: "PRODUCT",
    unit: null,
    required: false,
    multiValued: false,
    options: [],
    ...overrides,
});

type RowOverrides = {
    definitionId: string;
    type?: "TEXT" | "NUMBER" | "BOOLEAN" | "ENUM";
    multiValued?: boolean;
    valueText?: string | null;
    valueNumber?: Prisma.Decimal | null;
    valueBool?: boolean | null;
    optionId?: string | null;
    option?: { label: string } | null;
};

const valueRow = (overrides: RowOverrides) => ({
    type: "TEXT" as const,
    multiValued: false,
    valueText: null,
    valueNumber: null,
    valueBool: null,
    optionId: null,
    option: null,
    ...overrides,
});

/** findEffectiveDefinitionsByPath が読む行（category.path 付き）。 */
const definitionRow = (
    overrides: Partial<AttributeDefinitionDTO> & { id: string; path: string }
) => {
    const { path, ...rest } = overrides;
    return { ...defDTO(rest), category: { path } };
};

const makeClient = (fixtures: {
    definitions: unknown[];
    productValues?: unknown[];
    variantValues?: unknown[];
}) => {
    const client = {
        attributeDefinition: {
            findMany: jest.fn().mockResolvedValue(fixtures.definitions),
        },
        productAttributeValue: {
            findMany: jest.fn().mockResolvedValue(fixtures.productValues ?? []),
        },
        variantAttributeValue: {
            findMany: jest.fn().mockResolvedValue(fixtures.variantValues ?? []),
        },
    };
    return {
        client,
        typed: client as unknown as AttributeDisplayClient,
    };
};

describe("toAttributeDisplayItems", () => {
    it("型ごとに表示文字列へ変換し、定義順に並べる", () => {
        // Arrange
        const defs = [
            defDTO({ id: "d-wifi", type: "BOOLEAN" }),
            defDTO({ id: "d-screen", type: "NUMBER", unit: "inch" }),
            defDTO({ id: "d-material", type: "TEXT" }),
        ];
        const rows = [
            valueRow({ definitionId: "d-material", valueText: "Aluminium" }),
            valueRow({
                definitionId: "d-screen",
                type: "NUMBER",
                valueNumber: new Prisma.Decimal("55.5"),
            }),
            valueRow({
                definitionId: "d-wifi",
                type: "BOOLEAN",
                valueBool: false,
            }),
        ];

        // Act
        const items = toAttributeDisplayItems(defs, rows);

        // Assert
        expect(items).toEqual([
            {
                definitionId: "d-wifi",
                key: "d-wifi",
                name: "d-wifi",
                unit: null,
                values: ["No"],
            },
            {
                definitionId: "d-screen",
                key: "d-screen",
                name: "d-screen",
                unit: "inch",
                values: ["55.5"],
            },
            {
                definitionId: "d-material",
                key: "d-material",
                name: "d-material",
                unit: null,
                values: ["Aluminium"],
            },
        ]);
    });

    it("ENUM は値行の FK 先 label を表示する（A-4: 改名に追随・アーカイブ済み選択肢も表示）", () => {
        // Arrange: 定義 DTO の options（アクティブのみ）には opt-old が無い
        const defs = [
            defDTO({
                id: "d-color",
                type: "ENUM",
                options: [
                    { id: "opt-new", value: "new", label: "Stale label" },
                ],
            }),
        ];
        const rows = [
            valueRow({
                definitionId: "d-color",
                type: "ENUM",
                optionId: "opt-old",
                option: { label: "Midnight Black" },
            }),
        ];

        // Act
        const [item] = toAttributeDisplayItems(defs, rows);

        // Assert
        expect(item.values).toEqual(["Midnight Black"]);
    });

    it("多値 ENUM は選択肢ごとに 1 要素", () => {
        const defs = [
            defDTO({ id: "d-allergens", type: "ENUM", multiValued: true }),
        ];
        const rows = [
            valueRow({
                definitionId: "d-allergens",
                type: "ENUM",
                multiValued: true,
                optionId: "o-milk",
                option: { label: "Milk" },
            }),
            valueRow({
                definitionId: "d-allergens",
                type: "ENUM",
                multiValued: true,
                optionId: "o-egg",
                option: { label: "Egg" },
            }),
        ];

        const [item] = toAttributeDisplayItems(defs, rows);

        expect(item.values).toEqual(["Milk", "Egg"]);
    });

    it("値の無い定義と、定義集合に無い値行（アーカイブ済み定義の履歴）は表示しない", () => {
        // Arrange
        const defs = [defDTO({ id: "d-a" }), defDTO({ id: "d-b" })];
        const rows = [
            valueRow({ definitionId: "d-b", valueText: "kept" }),
            valueRow({ definitionId: "d-archived", valueText: "history" }),
        ];

        // Act
        const items = toAttributeDisplayItems(defs, rows);

        // Assert
        expect(items.map((i) => i.definitionId)).toEqual(["d-b"]);
    });
});

describe("findProductAttributeDisplay", () => {
    it("categoryPath が null（未移行の商品）なら DB を引かずに空を返す", async () => {
        // Arrange
        const { client, typed } = makeClient({ definitions: [] });

        // Act
        const result = await findProductAttributeDisplay(typed, {
            categoryPath: null,
            productId: "p1",
            variantIds: ["v1"],
        });

        // Assert
        expect(result).toEqual({ product: [], variants: {} });
        expect(client.attributeDefinition.findMany).not.toHaveBeenCalled();
    });

    it("有効定義が無ければ値テーブルを引かない", async () => {
        const { client, typed } = makeClient({ definitions: [] });

        const result = await findProductAttributeDisplay(typed, {
            categoryPath: "electronics",
            productId: "p1",
            variantIds: ["v1"],
        });

        expect(result).toEqual({ product: [], variants: {} });
        expect(client.productAttributeValue.findMany).not.toHaveBeenCalled();
        expect(client.variantAttributeValue.findMany).not.toHaveBeenCalled();
    });

    it("祖先パス集合で定義を引き、値行は有効定義 id と所有先で絞る", async () => {
        // Arrange
        const { client, typed } = makeClient({
            definitions: [
                definitionRow({ id: "d-brand", path: "electronics" }),
                definitionRow({
                    id: "d-storage",
                    path: "electronics/phone",
                    scope: "VARIANT",
                }),
            ],
        });

        // Act
        await findProductAttributeDisplay(typed, {
            categoryPath: "electronics/phone",
            productId: "p1",
            variantIds: ["v1", "v2"],
        });

        // Assert
        expect(client.attributeDefinition.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    category: {
                        path: { in: ["electronics", "electronics/phone"] },
                    },
                    archivedAt: null,
                },
            })
        );
        expect(client.productAttributeValue.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    productId: "p1",
                    definitionId: { in: ["d-brand", "d-storage"] },
                },
            })
        );
        expect(client.variantAttributeValue.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    variantId: { in: ["v1", "v2"] },
                    definitionId: { in: ["d-brand", "d-storage"] },
                },
            })
        );
    });

    it("VARIANT 属性を variantId ごとに束ね、互いに混ざらない", async () => {
        // Arrange
        const { typed } = makeClient({
            definitions: [
                definitionRow({ id: "d-brand", path: "electronics" }),
                definitionRow({
                    id: "d-storage",
                    path: "electronics",
                    scope: "VARIANT",
                    type: "NUMBER",
                    unit: "GB",
                }),
            ],
            productValues: [
                valueRow({ definitionId: "d-brand", valueText: "Acme" }),
            ],
            variantValues: [
                {
                    ...valueRow({
                        definitionId: "d-storage",
                        type: "NUMBER",
                        valueNumber: new Prisma.Decimal("128"),
                    }),
                    variantId: "v1",
                },
                {
                    ...valueRow({
                        definitionId: "d-storage",
                        type: "NUMBER",
                        valueNumber: new Prisma.Decimal("256"),
                    }),
                    variantId: "v2",
                },
            ],
        });

        // Act
        const result = await findProductAttributeDisplay(typed, {
            categoryPath: "electronics",
            productId: "p1",
            variantIds: ["v1", "v2", "v3"],
        });

        // Assert
        expect(result.product.map((i) => i.values)).toEqual([["Acme"]]);
        expect(result.variants.v1.map((i) => i.values)).toEqual([["128"]]);
        expect(result.variants.v2.map((i) => i.values)).toEqual([["256"]]);
        expect(result.variants.v3).toEqual([]);
    });

    it("VARIANT 定義が無ければバリアント値テーブルを引かない", async () => {
        const { client, typed } = makeClient({
            definitions: [
                definitionRow({ id: "d-brand", path: "electronics" }),
            ],
        });

        await findProductAttributeDisplay(typed, {
            categoryPath: "electronics",
            productId: "p1",
            variantIds: ["v1"],
        });

        expect(client.variantAttributeValue.findMany).not.toHaveBeenCalled();
    });
});
