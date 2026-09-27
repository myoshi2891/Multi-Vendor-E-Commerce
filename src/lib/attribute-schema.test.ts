import type { AttributeDefinitionDTO } from "./attribute-definitions";
import {
    emptyAttributeValues,
    makeProductSchema,
    toAttributePayload,
} from "./attribute-schema";

const def = (
    overrides: Partial<AttributeDefinitionDTO> &
        Pick<AttributeDefinitionDTO, "id">
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

const productAttrs = (
    defs: AttributeDefinitionDTO[],
    values: Record<string, unknown>,
    options: Parameters<typeof makeProductSchema>[1] = {
        includeProductScope: true,
    }
) => makeProductSchema(defs, options).shape.productAttributes.safeParse(values);

describe("makeProductSchema", () => {
    it("ProductFormSchema を extend で合成し、属性のエラーは単一パスに出る（intersection を使わない）", () => {
        // Arrange
        const schema = makeProductSchema(
            [def({ id: "material", required: true })],
            { includeProductScope: true }
        );

        // Act
        const result = schema.safeParse({
            productAttributes: {},
            variantAttributes: {},
        });

        // Assert
        expect(schema.shape.name).toBeDefined();
        expect(result.success).toBe(false);
        if (result.success) return;
        const paths = result.error.issues.map((issue) => issue.path.join("."));
        expect(paths).toContain("name");
        expect(
            paths.filter((p) => p === "productAttributes.material")
        ).toHaveLength(1);
    });

    describe("必須（A-3）", () => {
        it("必須 TEXT の空文字は拒否する", () => {
            const result = productAttrs(
                [def({ id: "material", required: true })],
                {
                    material: "  ",
                }
            );

            expect(result.success).toBe(false);
        });

        it("必須 ENUM（多値）の空配列は拒否する", () => {
            const allergens = def({
                id: "allergens",
                type: "ENUM",
                multiValued: true,
                required: true,
                options: [{ id: "wheat", value: "wheat", label: "Wheat" }],
            });

            expect(productAttrs([allergens], { allergens: [] }).success).toBe(
                false
            );
            expect(
                productAttrs([allergens], { allergens: ["wheat"] }).success
            ).toBe(true);
        });

        it("必須 BOOLEAN の未回答（null）は拒否し、false は受け付ける", () => {
            const organic = def({
                id: "organic",
                type: "BOOLEAN",
                required: true,
            });

            expect(productAttrs([organic], { organic: null }).success).toBe(
                false
            );
            expect(productAttrs([organic], { organic: false }).success).toBe(
                true
            );
        });
    });

    describe("NUMBER（A-9: 空入力が 0 に化けない）", () => {
        const weight = def({ id: "weight", type: "NUMBER" });

        it("任意 NUMBER の空文字はそのまま空として通る", () => {
            const result = productAttrs([weight], { weight: "" });

            expect(result).toEqual({ success: true, data: { weight: "" } });
        });

        it("数値でない文字列は拒否する", () => {
            expect(productAttrs([weight], { weight: "28g" }).success).toBe(
                false
            );
        });

        it("数値文字列は文字列のまま通る（精度を落とさない）", () => {
            expect(productAttrs([weight], { weight: "12.50" })).toEqual({
                success: true,
                data: { weight: "12.50" },
            });
        });
    });

    describe("ENUM の候補（A-11: アーカイブ済みはそのレコードの現在値だけ許す）", () => {
        const color = def({
            id: "color",
            type: "ENUM",
            scope: "VARIANT",
            options: [{ id: "red", value: "red", label: "Red" }],
        });
        const variantAttrs = (
            values: Record<string, unknown>,
            archivedCurrent: Record<
                string,
                { id: string; value: string; label: string }[]
            > = {}
        ) =>
            makeProductSchema([color], {
                includeProductScope: true,
                archivedCurrent,
            }).shape.variantAttributes.safeParse(values);

        it("アクティブな選択肢は通る", () => {
            expect(variantAttrs({ color: "red" }).success).toBe(true);
        });

        it("候補に無い（他レコードのアーカイブ済み）選択肢は拒否する", () => {
            expect(variantAttrs({ color: "old-blue" }).success).toBe(false);
        });

        it("このレコードの現在値であるアーカイブ済み選択肢は無編集保存できる", () => {
            const result = variantAttrs(
                { color: "old-green" },
                { color: [{ id: "old-green", value: "green", label: "Green" }] }
            );

            expect(result.success).toBe(true);
        });
    });

    it("includeProductScope: false では PRODUCT 属性を検証しない（新バリアント画面）", () => {
        const schema = makeProductSchema(
            [def({ id: "material", required: true })],
            {
                includeProductScope: false,
            }
        );

        expect(schema.shape.productAttributes.safeParse({}).success).toBe(true);
    });
});

describe("emptyAttributeValues", () => {
    it("スコープ別に未入力値（単値 null・多値 []）を作り、既存値で上書きする", () => {
        const defs = [
            def({ id: "material" }),
            def({ id: "allergens", type: "ENUM", multiValued: true }),
            def({ id: "size", type: "NUMBER", scope: "VARIANT" }),
        ];

        expect(
            emptyAttributeValues(defs, "PRODUCT", { material: "Silk" })
        ).toEqual({
            material: "Silk",
            allergens: [],
        });
        expect(emptyAttributeValues(defs, "VARIANT")).toEqual({ size: null });
    });
});

describe("toAttributePayload", () => {
    const defs = [
        def({ id: "material" }),
        def({ id: "size", type: "NUMBER", scope: "VARIANT" }),
    ];

    it("描画した全定義を送る（空は value: null = 削除対象）。VARIANT は variantId を持つ", () => {
        const payload = toAttributePayload(
            defs,
            {
                productAttributes: { material: "" },
                variantAttributes: { size: "42" },
            },
            { variantId: "v1", includeProductScope: true }
        );

        expect(payload).toEqual([
            { scope: "PRODUCT", definitionId: "material", value: null },
            {
                scope: "VARIANT",
                definitionId: "size",
                variantId: "v1",
                value: "42",
            },
        ]);
    });

    it("includeProductScope: false では PRODUCT 属性を送らない（= 同期対象外）", () => {
        const payload = toAttributePayload(
            defs,
            { productAttributes: {}, variantAttributes: { size: "" } },
            { variantId: "v1", includeProductScope: false }
        );

        expect(payload).toEqual([
            {
                scope: "VARIANT",
                definitionId: "size",
                variantId: "v1",
                value: null,
            },
        ]);
    });
});
