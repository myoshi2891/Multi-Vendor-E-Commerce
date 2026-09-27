/**
 * Category Attributes Integration Tests（plan 069 Step 11）
 *
 * カテゴリ別属性の不変条件を実 DB (testcontainers PostgreSQL) で検証する。
 * unit テスト（`src/queries/product-attributes.test.ts` ほか）は Prisma をモックしているため、
 * 次の 3 点は原理的に検証できない:
 *
 *   1. **DB 制約そのもの**（ADR-007 D-5 / D-6 / D-7）—— migration の raw SQL に書いた
 *      CHECK・複合 FK・部分 UNIQUE が張られていて、アプリ層を外しても拒否すること
 *   2. **行ロックによる直列化** —— 外側検証を通った後に前提が崩れても、tx 内の再検証が
 *      掴んだ行の値で拒否し、属性行を 1 行も残さないこと（往復テスト (5)〜(7)）
 *   3. **往復**（保存 → 再読込）で値・列・所有先が保たれること（A-1 / A-9 / 往復 (1)〜(4)）
 *
 * 関連:
 * - ADR-004: docs/architecture/decisions/004-integration-test-db-strategy.md
 * - ADR-007: docs/architecture/decisions/007-attribute-storage.md（D-5〜D-7）
 * - docs/design/category-attributes/design.md §5（A-1〜A-11）/ Q7（ON CONFLICT）
 * - plans/069-implement-category-attributes.md Step 8 / Step 11
 */

// ----------------------------------------------------------------------------
// Mocks (must be declared before importing the modules they affect)
// ----------------------------------------------------------------------------

// ADMIN（定義・カテゴリ操作）と SELLER（商品保存）を同一テスト内で並行に走らせるため、
// 呼び出し文脈を AsyncLocalStorage で伝える（category-tree-write.test.ts と同じ手法）。
import { AsyncLocalStorage } from "node:async_hooks";

const authContext = new AsyncLocalStorage<{
    id: string;
    role: "ADMIN" | "SELLER";
}>();

jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(async () => {
        const store = authContext.getStore();
        if (!store) return null;
        return { id: store.id, privateMetadata: { role: store.role } };
    }),
}));

/**
 * 「外側検証の後」「tx 内の同期の直前」に割り込むためのフック。
 *
 * 固定 sleep で競合を作ると、遅い環境では割り込みが間に合わず**競合を再現しないまま緑**に
 * なる。検証と書き込みの間に決定的に割り込めるよう、実装はそのまま呼びつつ前後にだけ
 * フックを挟む（検証ロジック自体は差し替えない）。
 */
const mockHooks: {
    afterPrecheck?: () => Promise<void>;
    beforeSync?: () => Promise<void>;
    syncCalls: number;
} = { syncCalls: 0 };

jest.mock("@/lib/attribute-sync", () => {
    const actual = jest.requireActual("@/lib/attribute-sync");
    return {
        ...actual,
        precheckAttributeValues: async (...args: unknown[]) => {
            await actual.precheckAttributeValues(...args);
            await mockHooks.afterPrecheck?.();
        },
        syncAttributeValues: async (...args: unknown[]) => {
            mockHooks.syncCalls++;
            await mockHooks.beforeSync?.();
            return actual.syncAttributeValues(...args);
        },
    };
});

// ----------------------------------------------------------------------------

import { randomUUID } from "node:crypto";

import {
    Prisma,
    type AttributeScope,
    type AttributeType,
    type Category,
} from "@prisma/client";
import type { AttributeValueInput } from "@/lib/attribute-definitions";
import { findProductAttributeDisplay } from "@/lib/attribute-repository";
// 表示の読み取りはアプリと同じ（Accelerate 拡張型の）クライアントで行う
import { db as appDb } from "@/lib/db";
import { fromAttributeValueRows } from "@/lib/attribute-value";
import type { ProductWithVariantType } from "@/lib/types";
import {
    archiveAttributeDefinition,
    changeAttributeTypeToNumber,
    getEffectiveAttributeDefinitions,
    upsertAttributeDefinition,
    upsertAttributeOption,
} from "@/queries/attribute";
import { upsertCategory } from "@/queries/category";
import { getProductVariantForEdit, upsertProduct } from "@/queries/product";
import { disconnectTestDb, getTestDb } from "./setup/db";
import { resetDb } from "./setup/reset-db";
import {
    seedCategoryWithSubcategory,
    seedProductWithVariantAndSize,
    seedStore,
    seedUser,
} from "./setup/seed";

const db = getTestDb();

const ADMIN_ID = "admin-category-attributes";

const asAdmin = <T>(fn: () => Promise<T>): Promise<T> =>
    authContext.run({ id: ADMIN_ID, role: "ADMIN" }, fn);

const asSeller = <T>(userId: string, fn: () => Promise<T>): Promise<T> =>
    authContext.run({ id: userId, role: "SELLER" }, fn);

// ----------------------------------------------------------------------------
// Fixtures
// ----------------------------------------------------------------------------

interface DefinitionSpec {
    key: string;
    type?: AttributeType;
    scope?: AttributeScope;
    required?: boolean;
    multiValued?: boolean;
    unit?: string | null;
    /** ENUM の選択肢 value（label は大文字化したもの） */
    options?: string[];
}

/** 定義 + 選択肢の作成（検証対象ではない前提データ）。 */
const createDefinition = (categoryId: string, spec: DefinitionSpec) =>
    db.attributeDefinition.create({
        data: {
            categoryId,
            key: spec.key,
            name: spec.key,
            type: spec.type ?? "TEXT",
            scope: spec.scope ?? "PRODUCT",
            required: spec.required ?? false,
            multiValued: spec.multiValued ?? false,
            unit: spec.unit ?? null,
            options: {
                create: (spec.options ?? []).map((value, sortOrder) => ({
                    value,
                    label: value.toUpperCase(),
                    sortOrder,
                })),
            },
        },
        include: { options: { orderBy: { sortOrder: "asc" } } },
    });

type Seeded = Awaited<ReturnType<typeof seedProductWithVariantAndSize>>;

/** オーナー + 店舗 + root/leaf ツリー + 商品一式。 */
async function arrange() {
    const owner = await seedUser(db);
    const store = await seedStore(db, { userId: owner.id });
    const { category: root, childNode: leaf } =
        await seedCategoryWithSubcategory(db);
    const seeded = await seedProductWithVariantAndSize(db, {
        storeId: store.id,
        categoryId: root.id,
        subCategoryId: leaf.id,
    });
    return { owner, store, root, leaf, seeded };
}

/** 同じ商品に 2 つ目以降のバリアントを足す。 */
const createVariant = (productId: string, label: string) => {
    const suffix = randomUUID().slice(0, 8);
    return db.productVariant.create({
        data: {
            variantName: `Variant ${label} ${suffix}`,
            variantImage: "https://example.test/variant.png",
            slug: `variant-${label}-${suffix}`,
            sku: `SKU-${suffix}`,
            weight: 1,
            productId,
        },
    });
};

/** seed 済み商品の「変更なし」更新入力に属性を載せる。 */
function buildUpdateInput(
    seeded: Seeded,
    attributes: AttributeValueInput[] | undefined,
    overrides: Partial<ProductWithVariantType> = {}
): ProductWithVariantType {
    return {
        productId: seeded.product.id,
        variantId: seeded.variant.id,
        name: seeded.product.name,
        description: seeded.product.description,
        variantName: seeded.variant.variantName,
        variantDescription: seeded.variant.variantDescription ?? "",
        images: [{ url: "https://example.test/updated.png" }],
        variantImage: seeded.variant.variantImage,
        categoryId: seeded.product.categoryId,
        subCategoryId: seeded.product.subCategoryId,
        isSale: false,
        brand: seeded.product.brand,
        sku: seeded.variant.sku,
        weight: seeded.variant.weight ?? 1,
        colors: [{ color: "Black" }],
        sizes: [{ size: "L", quantity: 5, price: 120, discount: 0 }],
        product_specs: [{ name: "care", value: "hand wash" }],
        variant_specs: [{ name: "fit", value: "regular" }],
        keywords: ["test"],
        questions: [{ question: "Q1?", answer: "A1" }],
        freeShippingForAllCountries: false,
        freeShippingCountriesIds: [],
        shippingFeeMethod: seeded.product.shippingFeeMethod,
        createdAt: seeded.product.createdAt,
        updatedAt: new Date(),
        attributes,
        ...overrides,
    };
}

/** 新規商品の作成入力（productId / variantId はクライアント採番）。 */
function buildCreateInput(
    category: { rootId: string; leafId: string },
    attributes: AttributeValueInput[] | undefined,
    ids: { productId: string; variantId: string } = {
        productId: randomUUID(),
        variantId: randomUUID(),
    }
): ProductWithVariantType {
    const suffix = randomUUID().slice(0, 8);
    return {
        productId: ids.productId,
        variantId: ids.variantId,
        name: `Attr Product ${suffix}`,
        description: "integration",
        variantName: `Attr Variant ${suffix}`,
        variantDescription: "",
        images: [{ url: "https://example.test/new.png" }],
        variantImage: "https://example.test/variant.png",
        categoryId: category.rootId,
        subCategoryId: category.leafId,
        isSale: false,
        brand: "Acme",
        sku: `SKU-${suffix}`,
        weight: 1,
        colors: [{ color: "Black" }],
        sizes: [{ size: "M", quantity: 5, price: 100, discount: 0 }],
        product_specs: [{ name: "care", value: "hand wash" }],
        variant_specs: [{ name: "fit", value: "regular" }],
        keywords: ["test"],
        questions: [{ question: "Q1?", answer: "A1" }],
        freeShippingForAllCountries: false,
        freeShippingCountriesIds: [],
        shippingFeeMethod: "ITEM",
        createdAt: new Date(),
        updatedAt: new Date(),
        attributes,
    };
}

const productRows = (productId: string) =>
    db.productAttributeValue.findMany({
        where: { productId },
        orderBy: { createdAt: "asc" },
    });

const variantRows = (variantId: string) =>
    db.variantAttributeValue.findMany({
        where: { variantId },
        orderBy: { createdAt: "asc" },
    });

const countAllValueRows = async () =>
    (await db.productAttributeValue.count()) +
    (await db.variantAttributeValue.count());

/** 保存済みの行をフォーム値へ戻す（`fromAttributeValueRows` = 読み取り側の唯一の経路）。 */
const readBack = (
    definition: { id: string; type: AttributeType; multiValued: boolean },
    rows: {
        definitionId: string;
        type: AttributeType;
        multiValued: boolean;
        valueText: string | null;
        valueNumber: Prisma.Decimal | null;
        valueBool: boolean | null;
        optionId: string | null;
    }[]
) =>
    fromAttributeValueRows(
        definition,
        rows.filter((row) => row.definitionId === definition.id)
    );

/** upsertCategory へ渡す 1 ノード分（親の付け替え用）。 */
const moveNodeInput = (node: Category, parentId: string) => ({
    id: node.id,
    name: node.name,
    image: node.image,
    url: node.url,
    featured: node.featured,
    createdAt: node.createdAt,
    updatedAt: new Date(),
    parentId,
    sortOrder: 0,
});

/** 別コネクションが行ロック待ちに入るまで待つ（固定 sleep は偽陰性の元）。 */
const waitForLockedBackend = async (timeoutMs = 20_000): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const [row] = await db.$queryRaw<{ blocked: number }[]>`
            SELECT count(*)::int AS blocked
              FROM pg_stat_activity
             WHERE datname = current_database()
               AND pid <> pg_backend_pid()
               AND wait_event_type = 'Lock'
        `;
        if (row.blocked > 0) return;
        if (Date.now() >= deadline) {
            throw new Error(
                "ロック待ちに入る backend を検出できませんでした（競合が再現していない）"
            );
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
};

/** 値行を raw SQL で 1 行入れる（アプリ層の検証を完全に外す経路）。 */
const insertProductValueRaw = (row: {
    productId: string;
    definitionId: string;
    scope: AttributeScope;
    type: AttributeType;
    multiValued: boolean;
    valueText?: string | null;
    valueNumber?: string | null;
    optionId?: string | null;
}) => db.$executeRaw`
    INSERT INTO "ProductAttributeValue"
        ("id", "productId", "definitionId", "scope", "type", "multiValued",
         "valueText", "valueNumber", "optionId", "updatedAt")
    VALUES
        (${randomUUID()}, ${row.productId}, ${row.definitionId},
         ${row.scope}::"AttributeScope", ${row.type}::"AttributeType", ${row.multiValued},
         ${row.valueText ?? null}, ${row.valueNumber ?? null}::numeric, ${row.optionId ?? null}, NOW())
`;

beforeEach(async () => {
    await resetDb(db);
    jest.clearAllMocks();
    mockHooks.afterPrecheck = undefined;
    mockHooks.beforeSync = undefined;
    mockHooks.syncCalls = 0;
});

afterAll(async () => {
    await disconnectTestDb();
});

// ============================================================================
// ADR-007 D-5 / D-6: scope と type の一致を DB が強制する（7 本）
// ============================================================================

describe("ADR-007 D-5 / D-6: DB rejects scope and type mismatches", () => {
    it("#1 rejects a VARIANT definition written to ProductAttributeValue", async () => {
        const { root, seeded } = await arrange();
        const def = await createDefinition(root.id, {
            key: "storage",
            type: "TEXT",
            scope: "VARIANT",
        });

        await expect(
            db.productAttributeValue.create({
                data: {
                    productId: seeded.product.id,
                    definitionId: def.id,
                    type: "TEXT",
                    multiValued: false,
                    valueText: "128GB",
                },
            })
        ).rejects.toThrow(/definitionId_scope_type_multiValued_fkey/);
        expect(await countAllValueRows()).toBe(0);
    });

    it("#2 rejects a PRODUCT definition written to VariantAttributeValue", async () => {
        const { root, seeded } = await arrange();
        const def = await createDefinition(root.id, { key: "brand" });

        await expect(
            db.variantAttributeValue.create({
                data: {
                    variantId: seeded.variant.id,
                    definitionId: def.id,
                    type: "TEXT",
                    multiValued: false,
                    valueText: "Acme",
                },
            })
        ).rejects.toThrow(/definitionId_scope_type_multiValued_fkey/);
        expect(await countAllValueRows()).toBe(0);
    });

    it("#3 rejects scope = 'VARIANT' written directly into ProductAttributeValue ($executeRaw)", async () => {
        const { root, seeded } = await arrange();
        // FK だけなら通る組み合わせ（VARIANT 定義 × scope 列 VARIANT）でも CHECK が拒否する
        const def = await createDefinition(root.id, {
            key: "storage",
            scope: "VARIANT",
        });

        await expect(
            insertProductValueRaw({
                productId: seeded.product.id,
                definitionId: def.id,
                scope: "VARIANT",
                type: "TEXT",
                multiValued: false,
                valueText: "128GB",
            })
        ).rejects.toThrow(/ProductAttributeValue_scope_product/);
        expect(await countAllValueRows()).toBe(0);
    });

    it("#4 rejects a NUMBER value row that only fills valueText ($executeRaw)", async () => {
        const { root, seeded } = await arrange();
        const def = await createDefinition(root.id, {
            key: "screen_size",
            type: "NUMBER",
        });

        await expect(
            insertProductValueRaw({
                productId: seeded.product.id,
                definitionId: def.id,
                scope: "PRODUCT",
                type: "NUMBER",
                multiValued: false,
                valueText: "55 inch",
            })
        ).rejects.toThrow(/ProductAttributeValue_value_matches_type/);
    });

    it("#5 rejects a value row with all four value columns NULL", async () => {
        const { root, seeded } = await arrange();
        const def = await createDefinition(root.id, { key: "brand" });

        await expect(
            db.productAttributeValue.create({
                data: {
                    productId: seeded.product.id,
                    definitionId: def.id,
                    type: "TEXT",
                    multiValued: false,
                },
            })
        ).rejects.toThrow(/ProductAttributeValue_value_matches_type/);
    });

    it("#6 rejects changing only the definition type while value rows keep the old type", async () => {
        const { root, seeded } = await arrange();
        const def = await createDefinition(root.id, { key: "weight_text" });
        await db.productAttributeValue.create({
            data: {
                productId: seeded.product.id,
                definitionId: def.id,
                type: "TEXT",
                multiValued: false,
                valueText: "12",
            },
        });

        await expect(
            db.attributeDefinition.update({
                where: { id: def.id },
                data: { type: "NUMBER" },
            })
        ).rejects.toThrow();
        const after = await db.attributeDefinition.findUniqueOrThrow({
            where: { id: def.id },
        });
        expect(after.type).toBe("TEXT");
    });

    it("#7 accepts the correct scope / type combination (control)", async () => {
        const { root, seeded } = await arrange();
        const productDef = await createDefinition(root.id, {
            key: "screen_size",
            type: "NUMBER",
        });
        const variantDef = await createDefinition(root.id, {
            key: "wifi",
            type: "BOOLEAN",
            scope: "VARIANT",
        });

        await db.productAttributeValue.create({
            data: {
                productId: seeded.product.id,
                definitionId: productDef.id,
                type: "NUMBER",
                multiValued: false,
                valueNumber: new Prisma.Decimal("55.5"),
            },
        });
        await db.variantAttributeValue.create({
            data: {
                variantId: seeded.variant.id,
                definitionId: variantDef.id,
                type: "BOOLEAN",
                multiValued: false,
                valueBool: false,
            },
        });

        expect(await countAllValueRows()).toBe(2);
    });
});

// ============================================================================
// ADR-007 D-7: 部分 UNIQUE（1 属性 1 値 / 多値は 1 選択肢 1 行）
// ============================================================================

describe("ADR-007 D-7: partial unique indexes", () => {
    it("rejects a second row for a single-valued definition on the same product", async () => {
        const { root, seeded } = await arrange();
        const def = await createDefinition(root.id, { key: "brand" });
        const row = {
            productId: seeded.product.id,
            definitionId: def.id,
            scope: "PRODUCT" as const,
            type: "TEXT" as const,
            multiValued: false,
        };
        await insertProductValueRaw({ ...row, valueText: "Acme" });

        await expect(
            insertProductValueRaw({ ...row, valueText: "Other" })
        ).rejects.toThrow(
            // raw の一意違反は制約名ではなく DETAIL（キー列）を返す。列の組で単値索引と判別する
            /23505[\s\S]*Key \("productId", "definitionId"\)=/
        );
    });

    it("accepts different options for a multi-valued definition and rejects the same option twice", async () => {
        const { root, seeded } = await arrange();
        const def = await createDefinition(root.id, {
            key: "allergens",
            type: "ENUM",
            multiValued: true,
            options: ["milk", "egg"],
        });
        const row = {
            productId: seeded.product.id,
            definitionId: def.id,
            scope: "PRODUCT" as const,
            type: "ENUM" as const,
            multiValued: true,
        };
        await insertProductValueRaw({ ...row, optionId: def.options[0].id });
        await insertProductValueRaw({ ...row, optionId: def.options[1].id });

        await expect(
            insertProductValueRaw({ ...row, optionId: def.options[0].id })
        ).rejects.toThrow(
            /23505[\s\S]*Key \("productId", "definitionId", "optionId"\)=/
        );
        expect(await productRows(seeded.product.id)).toHaveLength(2);
    });

    it("rejects the same variant twice for a single-valued VARIANT definition", async () => {
        const { root, seeded } = await arrange();
        const def = await createDefinition(root.id, {
            key: "storage",
            type: "NUMBER",
            scope: "VARIANT",
        });
        const data = {
            variantId: seeded.variant.id,
            definitionId: def.id,
            type: "NUMBER" as const,
            multiValued: false,
            valueNumber: new Prisma.Decimal("128"),
        };
        await db.variantAttributeValue.create({ data });

        await expect(
            db.variantAttributeValue.create({ data })
        ).rejects.toThrow();
        expect(await variantRows(seeded.variant.id)).toHaveLength(1);
    });

    it("rejects a value row whose multiValued disagrees with its definition (FK)", async () => {
        const { root, seeded } = await arrange();
        const def = await createDefinition(root.id, {
            key: "color",
            type: "ENUM",
            options: ["red"],
        });

        await expect(
            insertProductValueRaw({
                productId: seeded.product.id,
                definitionId: def.id,
                scope: "PRODUCT",
                type: "ENUM",
                multiValued: true,
                optionId: def.options[0].id,
            })
        ).rejects.toThrow(/definitionId_scope_type_multiValued_fkey/);
    });

    it("rejects a multi-valued definition that is not ENUM", async () => {
        const { root } = await arrange();

        await expect(
            createDefinition(root.id, {
                key: "tags",
                type: "TEXT",
                multiValued: true,
            })
        ).rejects.toThrow(/AttributeDefinition_multi_valued_enum_only/);
    });
});

// ============================================================================
// 往復テスト (1)〜(4) + A-1 / A-8 / A-9
// ============================================================================

describe("Round trip: save → reload keeps value, column and owner", () => {
    it("(1) stores each type in its own column and reads back the same values (A-1)", async () => {
        // Arrange
        const { owner, store, root, seeded } = await arrange();
        const text = await createDefinition(root.id, { key: "brand" });
        const number = await createDefinition(root.id, {
            key: "screen_size",
            type: "NUMBER",
        });
        const bool = await createDefinition(root.id, {
            key: "wifi",
            type: "BOOLEAN",
        });
        const single = await createDefinition(root.id, {
            key: "resolution",
            type: "ENUM",
            options: ["fhd", "4k"],
        });
        const multi = await createDefinition(root.id, {
            key: "allergens",
            type: "ENUM",
            multiValued: true,
            options: ["milk", "egg", "soy"],
        });
        const variantNumber = await createDefinition(root.id, {
            key: "storage",
            type: "NUMBER",
            scope: "VARIANT",
        });

        // Act
        await asSeller(owner.id, () =>
            upsertProduct(
                buildUpdateInput(seeded, [
                    {
                        scope: "PRODUCT",
                        definitionId: text.id,
                        value: " Acme ",
                    },
                    {
                        scope: "PRODUCT",
                        definitionId: number.id,
                        value: "55.5",
                    },
                    { scope: "PRODUCT", definitionId: bool.id, value: false },
                    {
                        scope: "PRODUCT",
                        definitionId: single.id,
                        value: single.options[1].id,
                    },
                    {
                        scope: "PRODUCT",
                        definitionId: multi.id,
                        value: [multi.options[0].id, multi.options[2].id],
                    },
                    {
                        scope: "VARIANT",
                        definitionId: variantNumber.id,
                        variantId: seeded.variant.id,
                        value: "128",
                    },
                ]),
                store.url
            )
        );

        // Assert —— 値
        const rows = await productRows(seeded.product.id);
        expect(readBack(text, rows)).toBe("Acme");
        expect(readBack(number, rows)).toBe("55.5");
        expect(readBack(bool, rows)).toBe(false);
        expect(readBack(single, rows)).toBe(single.options[1].id);
        expect(readBack(multi, rows)).toEqual([
            multi.options[0].id,
            multi.options[2].id,
        ]);
        expect(
            readBack(variantNumber, await variantRows(seeded.variant.id))
        ).toBe("128");

        // Assert —— 列（A-1: type が指す列だけが埋まる）
        const filled = (row: (typeof rows)[number]) =>
            [
                row.valueText !== null && "valueText",
                row.valueNumber !== null && "valueNumber",
                row.valueBool !== null && "valueBool",
                row.optionId !== null && "optionId",
            ].filter(Boolean);
        const expectedColumn: Record<AttributeType, string> = {
            TEXT: "valueText",
            NUMBER: "valueNumber",
            BOOLEAN: "valueBool",
            ENUM: "optionId",
        };
        for (const row of rows) {
            expect(filled(row)).toEqual([expectedColumn[row.type]]);
        }
    });

    it("(1) keeps legacy Spec rows working alongside attributes (A-8)", async () => {
        const { owner, store, root, seeded } = await arrange();
        const text = await createDefinition(root.id, { key: "brand" });

        await asSeller(owner.id, () =>
            upsertProduct(
                buildUpdateInput(seeded, [
                    { scope: "PRODUCT", definitionId: text.id, value: "Acme" },
                ]),
                store.url
            )
        );

        const specs = await db.spec.findMany({
            where: {
                OR: [
                    { productId: seeded.product.id },
                    { variantId: seeded.variant.id },
                ],
            },
            select: { name: true, value: true },
            orderBy: { name: "asc" },
        });
        expect(specs).toEqual([
            { name: "care", value: "hand wash" },
            { name: "fit", value: "regular" },
        ]);
        expect(await productRows(seeded.product.id)).toHaveLength(1);
    });

    it("(2) deletes the row when the value is cleared, and never turns an empty NUMBER into 0 (A-9)", async () => {
        // Arrange
        const { owner, store, root, seeded } = await arrange();
        const number = await createDefinition(root.id, {
            key: "screen_size",
            type: "NUMBER",
        });
        const text = await createDefinition(root.id, { key: "brand" });
        const save = (value: string) =>
            asSeller(owner.id, () =>
                upsertProduct(
                    buildUpdateInput(seeded, [
                        { scope: "PRODUCT", definitionId: number.id, value },
                        {
                            scope: "PRODUCT",
                            definitionId: text.id,
                            value: "Acme",
                        },
                    ]),
                    store.url
                )
            );
        await save("0");
        expect(readBack(number, await productRows(seeded.product.id))).toBe(
            "0"
        );

        // Act —— 空で送信（clear）
        await save("");

        // Assert —— 行が消え、再読込は null（0 ではない）
        const rows = await productRows(seeded.product.id);
        expect(rows.filter((r) => r.definitionId === number.id)).toHaveLength(
            0
        );
        expect(readBack(number, rows)).toBeNull();
        expect(readBack(text, rows)).toBe("Acme");
    });

    it("(3) keeps separate values for two variants; editing one never overwrites the other", async () => {
        // Arrange
        const { owner, store, root, seeded } = await arrange();
        const variantB = await createVariant(seeded.product.id, "b");
        const storage = await createDefinition(root.id, {
            key: "storage",
            type: "NUMBER",
            scope: "VARIANT",
        });
        await asSeller(owner.id, () =>
            upsertProduct(
                buildUpdateInput(seeded, [
                    {
                        scope: "VARIANT",
                        definitionId: storage.id,
                        variantId: seeded.variant.id,
                        value: "128",
                    },
                    {
                        scope: "VARIANT",
                        definitionId: storage.id,
                        variantId: variantB.id,
                        value: "256",
                    },
                ]),
                store.url
            )
        );

        // Act —— A だけを編集
        await asSeller(owner.id, () =>
            upsertProduct(
                buildUpdateInput(seeded, [
                    {
                        scope: "VARIANT",
                        definitionId: storage.id,
                        variantId: seeded.variant.id,
                        value: "512",
                    },
                ]),
                store.url
            )
        );

        // Assert
        expect(readBack(storage, await variantRows(seeded.variant.id))).toBe(
            "512"
        );
        expect(readBack(storage, await variantRows(variantB.id))).toBe("256");
    });

    it("(4) deletes unsent definitions only for the variant that was synced", async () => {
        // Arrange
        const { owner, store, root, seeded } = await arrange();
        const variantB = await createVariant(seeded.product.id, "b");
        const storage = await createDefinition(root.id, {
            key: "storage",
            type: "NUMBER",
            scope: "VARIANT",
        });
        const color = await createDefinition(root.id, {
            key: "color",
            scope: "VARIANT",
        });
        const both = (variantId: string) =>
            [
                {
                    scope: "VARIANT",
                    definitionId: storage.id,
                    variantId,
                    value: "64",
                },
                {
                    scope: "VARIANT",
                    definitionId: color.id,
                    variantId,
                    value: "Red",
                },
            ] as const;
        await asSeller(owner.id, () =>
            upsertProduct(
                buildUpdateInput(seeded, [
                    ...both(seeded.variant.id),
                    ...both(variantB.id),
                ]),
                store.url
            )
        );

        // Act —— A には storage だけを送る（color は「送信されなかった」）
        await asSeller(owner.id, () =>
            upsertProduct(
                buildUpdateInput(seeded, [
                    {
                        scope: "VARIANT",
                        definitionId: storage.id,
                        variantId: seeded.variant.id,
                        value: "64",
                    },
                ]),
                store.url
            )
        );

        // Assert —— A の color だけが消え、B は 2 件とも残る
        const rowsA = await variantRows(seeded.variant.id);
        expect(rowsA.map((r) => r.definitionId)).toEqual([storage.id]);
        expect(await variantRows(variantB.id)).toHaveLength(2);
    });
});

// ============================================================================
// 往復テスト (5)〜(7): 外側検証の後に前提が崩れても無効な行は commit されない
// ============================================================================

describe("Round trip: tx-level re-validation after the outer precheck", () => {
    /** 2 本目の root/leaf（移動先・別商品用）。 */
    const arrangeWithSecondTree = async () => {
        const base = await arrange();
        const { category: otherRoot } = await seedCategoryWithSubcategory(db);
        return { ...base, otherRoot };
    };

    const expectNothingWritten = async (
        productId: string,
        originalName: string
    ) => {
        expect(await countAllValueRows()).toBe(0);
        // tx ごと巻き戻る（商品本体の更新も残らない）
        const product = await db.product.findUniqueOrThrow({
            where: { id: productId },
        });
        expect(product.name).toBe(originalName);
    };

    it("(5) rejects when the category node is moved away from the definition's node after the precheck", async () => {
        // Arrange
        const { owner, store, root, leaf, seeded, otherRoot } =
            await arrangeWithSecondTree();
        const brand = await createDefinition(root.id, { key: "brand" });
        mockHooks.afterPrecheck = async () => {
            mockHooks.afterPrecheck = undefined;
            await asAdmin(() =>
                upsertCategory(moveNodeInput(leaf, otherRoot.id))
            );
        };

        // Act
        const result = asSeller(owner.id, () =>
            upsertProduct(
                buildUpdateInput(
                    seeded,
                    [
                        {
                            scope: "PRODUCT",
                            definitionId: brand.id,
                            value: "Acme",
                        },
                    ],
                    { name: "renamed" }
                ),
                store.url
            )
        );

        // Assert
        await expect(result).rejects.toThrow(
            "Attribute is not available for the selected category."
        );
        await expectNothingWritten(seeded.product.id, seeded.product.name);
    });

    it("(5) rejects when the variant is re-attached to another product after the precheck", async () => {
        const { owner, store, root, leaf, seeded } = await arrange();
        const variantB = await createVariant(seeded.product.id, "b");
        const other = await seedProductWithVariantAndSize(db, {
            storeId: store.id,
            categoryId: root.id,
            subCategoryId: leaf.id,
        });
        const color = await createDefinition(root.id, {
            key: "color",
            scope: "VARIANT",
        });
        mockHooks.afterPrecheck = async () => {
            mockHooks.afterPrecheck = undefined;
            await db.productVariant.update({
                where: { id: variantB.id },
                data: { productId: other.product.id },
            });
        };

        await expect(
            asSeller(owner.id, () =>
                upsertProduct(
                    buildUpdateInput(
                        seeded,
                        [
                            {
                                scope: "VARIANT",
                                definitionId: color.id,
                                variantId: variantB.id,
                                value: "Red",
                            },
                        ],
                        { name: "renamed" }
                    ),
                    store.url
                )
            )
        ).rejects.toThrow("Variant does not belong to this product.");
        await expectNothingWritten(seeded.product.id, seeded.product.name);
    });

    it("(5) rejects when the definition is archived after the precheck", async () => {
        const { owner, store, root, seeded } = await arrange();
        const brand = await createDefinition(root.id, { key: "brand" });
        mockHooks.afterPrecheck = async () => {
            mockHooks.afterPrecheck = undefined;
            await asAdmin(() => archiveAttributeDefinition(brand.id));
        };

        await expect(
            asSeller(owner.id, () =>
                upsertProduct(
                    buildUpdateInput(
                        seeded,
                        [
                            {
                                scope: "PRODUCT",
                                definitionId: brand.id,
                                value: "Acme",
                            },
                        ],
                        { name: "renamed" }
                    ),
                    store.url
                )
            )
        ).rejects.toThrow(
            "Attribute is not available for the selected category."
        );
        await expectNothingWritten(seeded.product.id, seeded.product.name);
    });

    it("(6) rejects an option of another definition and an archived option at the outer precheck", async () => {
        const { owner, store, root, seeded } = await arrange();
        const color = await createDefinition(root.id, {
            key: "color",
            type: "ENUM",
            options: ["red", "blue"],
        });
        const capacity = await createDefinition(root.id, {
            key: "capacity",
            type: "ENUM",
            options: ["small"],
        });
        await db.attributeOption.update({
            where: { id: color.options[1].id },
            data: { archivedAt: new Date() },
        });
        const save = (value: string) =>
            asSeller(owner.id, () =>
                upsertProduct(
                    buildUpdateInput(
                        seeded,
                        [{ scope: "PRODUCT", definitionId: color.id, value }],
                        { name: "renamed" }
                    ),
                    store.url
                )
            );

        await expect(save(capacity.options[0].id)).rejects.toThrow(
            "Select a valid color."
        );
        await expect(save(color.options[1].id)).rejects.toThrow(
            "Select a valid color."
        );
        // 外側で落ちている（tx 内の同期まで到達していない）
        expect(mockHooks.syncCalls).toBe(0);
        await expectNothingWritten(seeded.product.id, seeded.product.name);
    });

    it("(6) rejects an option archived or re-assigned after the precheck inside the tx", async () => {
        const { owner, store, root, seeded } = await arrange();
        const color = await createDefinition(root.id, {
            key: "color",
            type: "ENUM",
            options: ["red", "blue"],
        });
        const capacity = await createDefinition(root.id, {
            key: "capacity",
            type: "ENUM",
            options: ["small"],
        });
        const save = () =>
            asSeller(owner.id, () =>
                upsertProduct(
                    buildUpdateInput(
                        seeded,
                        [
                            {
                                scope: "PRODUCT",
                                definitionId: color.id,
                                value: color.options[0].id,
                            },
                        ],
                        { name: "renamed" }
                    ),
                    store.url
                )
            );

        // archive
        mockHooks.afterPrecheck = async () => {
            mockHooks.afterPrecheck = undefined;
            await db.attributeOption.update({
                where: { id: color.options[0].id },
                data: { archivedAt: new Date() },
            });
        };
        await expect(save()).rejects.toThrow("Select a valid color.");
        await expectNothingWritten(seeded.product.id, seeded.product.name);

        // 別定義への付け替え
        await db.attributeOption.update({
            where: { id: color.options[0].id },
            data: { archivedAt: null },
        });
        mockHooks.afterPrecheck = async () => {
            mockHooks.afterPrecheck = undefined;
            await db.attributeOption.update({
                where: { id: color.options[0].id },
                data: { definitionId: capacity.id },
            });
        };
        await expect(save()).rejects.toThrow("Select a valid color.");
        expect(mockHooks.syncCalls).toBe(2);
        await expectNothingWritten(seeded.product.id, seeded.product.name);
    });

    it("(7) a concurrent category move waits for the attribute tx, so the committed rows were valid when written", async () => {
        // Arrange
        const { owner, store, root, leaf, seeded, otherRoot } =
            await arrangeWithSecondTree();
        const brand = await createDefinition(root.id, { key: "brand" });

        let releaseSync: () => void = () => undefined;
        const syncGate = new Promise<void>((resolve) => {
            releaseSync = resolve;
        });
        let reachedSync: () => void = () => undefined;
        const syncReached = new Promise<void>((resolve) => {
            reachedSync = resolve;
        });
        mockHooks.beforeSync = async () => {
            mockHooks.beforeSync = undefined;
            reachedSync();
            await syncGate;
        };

        const order: string[] = [];

        // Act —— 属性 tx がカテゴリ行を掴んだ状態で止まっている間にカテゴリを移動する
        const save = asSeller(owner.id, () =>
            upsertProduct(
                buildUpdateInput(seeded, [
                    { scope: "PRODUCT", definitionId: brand.id, value: "Acme" },
                ]),
                store.url
            )
        ).then(() => order.push("save"));
        await syncReached;
        const move = asAdmin(() =>
            upsertCategory(moveNodeInput(leaf, otherRoot.id))
        ).then(() => order.push("move"));
        await waitForLockedBackend();
        releaseSync();
        await Promise.all([save, move]);

        // Assert —— カテゴリ側が待たされ、属性行は祖先集合が保たれた状態で commit された。
        // 検証しているのは**不変条件**であってロックの取り方ではない: tx 先頭の
        // lockAttributeCategoryPath を外しても、商品行の UPDATE が FK 検査で参照先の
        // Category 行（root / leaf）に FOR KEY SHARE を取り、移動側の FOR UPDATE
        // （移動ノード + 子孫）と衝突するため、この順序は変わらない（2026-09-27 ミューテーションで確認）。
        expect(order).toEqual(["save", "move"]);
        expect(readBack(brand, await productRows(seeded.product.id))).toBe(
            "Acme"
        );
        const movedLeaf = await db.category.findUniqueOrThrow({
            where: { id: leaf.id },
        });
        expect(movedLeaf.path).toBe(`${otherRoot.path}/${leaf.url}`);
    });

    it("(7) a category move that commits first makes the attribute tx reject (no invalid row)", async () => {
        const { owner, store, root, leaf, seeded, otherRoot } =
            await arrangeWithSecondTree();
        const brand = await createDefinition(root.id, { key: "brand" });
        mockHooks.afterPrecheck = async () => {
            mockHooks.afterPrecheck = undefined;
            await asAdmin(() =>
                upsertCategory(moveNodeInput(leaf, otherRoot.id))
            );
        };

        await expect(
            asSeller(owner.id, () =>
                upsertProduct(
                    buildUpdateInput(seeded, [
                        {
                            scope: "PRODUCT",
                            definitionId: brand.id,
                            value: "Acme",
                        },
                    ]),
                    store.url
                )
            )
        ).rejects.toThrow(
            "Attribute is not available for the selected category."
        );
        expect(await countAllValueRows()).toBe(0);
    });
});

// ============================================================================
// 認可の拒否 3 本（型付き payload は認可ではない）
// ============================================================================

describe("Authorization: typed payload is not authorization", () => {
    it("(1) rejects a variant id of another product", async () => {
        const { owner, store, root, leaf, seeded } = await arrange();
        const other = await seedProductWithVariantAndSize(db, {
            storeId: store.id,
            categoryId: root.id,
            subCategoryId: leaf.id,
        });
        const color = await createDefinition(root.id, {
            key: "color",
            scope: "VARIANT",
        });

        await expect(
            asSeller(owner.id, () =>
                upsertProduct(
                    buildUpdateInput(seeded, [
                        {
                            scope: "VARIANT",
                            definitionId: color.id,
                            variantId: other.variant.id,
                            value: "Red",
                        },
                    ]),
                    store.url
                )
            )
        ).rejects.toThrow("Variant does not belong to this product.");
        expect(await countAllValueRows()).toBe(0);
    });

    it("(2) rejects a product id that belongs to another store", async () => {
        const { owner, store, root, leaf } = await arrange();
        const victim = await seedUser(db);
        const victimStore = await seedStore(db, { userId: victim.id });
        const victimProduct = await seedProductWithVariantAndSize(db, {
            storeId: victimStore.id,
            categoryId: root.id,
            subCategoryId: leaf.id,
        });
        const brand = await createDefinition(root.id, { key: "brand" });

        await expect(
            asSeller(owner.id, () =>
                upsertProduct(
                    buildCreateInput(
                        { rootId: root.id, leafId: leaf.id },
                        [
                            {
                                scope: "PRODUCT",
                                definitionId: brand.id,
                                value: "Pwned",
                            },
                        ],
                        {
                            productId: victimProduct.product.id,
                            variantId: randomUUID(),
                        }
                    ),
                    store.url
                )
            )
        ).rejects.toThrow("Product does not belong to this store.");
        expect(await countAllValueRows()).toBe(0);
    });

    it("(3) rejects a definition unrelated to the selected category", async () => {
        const { owner, store, seeded } = await arrange();
        const { category: unrelatedRoot } =
            await seedCategoryWithSubcategory(db);
        const foreign = await createDefinition(unrelatedRoot.id, {
            key: "brand",
        });

        await expect(
            asSeller(owner.id, () =>
                upsertProduct(
                    buildUpdateInput(seeded, [
                        {
                            scope: "PRODUCT",
                            definitionId: foreign.id,
                            value: "X",
                        },
                    ]),
                    store.url
                )
            )
        ).rejects.toThrow(
            "Attribute is not available for the selected category."
        );
        expect(await countAllValueRows()).toBe(0);
    });
});

// ============================================================================
// A-2 / A-3 / A-10: 継承・必須・同一 key
// ============================================================================

describe("Inheritance and required attributes", () => {
    it("A-2 / A-3: an ancestor's required attribute blocks product creation until provided", async () => {
        // Arrange
        const { owner, store, root, leaf } = await arrange();
        const material = await createDefinition(root.id, {
            key: "material",
            required: true,
        });
        const category = { rootId: root.id, leafId: leaf.id };

        // Act & Assert —— 欠落は拒否（商品も作られない）
        const missing = buildCreateInput(category, []);
        await expect(
            asSeller(owner.id, () => upsertProduct(missing, store.url))
        ).rejects.toThrow("material is required.");
        expect(
            await db.product.findUnique({ where: { id: missing.productId } })
        ).toBeNull();

        // 提供すれば作成できる（子孫の商品で継承が効いている）
        const provided = buildCreateInput(category, [
            { scope: "PRODUCT", definitionId: material.id, value: "Wool" },
        ]);
        await asSeller(owner.id, () => upsertProduct(provided, store.url));
        expect(readBack(material, await productRows(provided.productId))).toBe(
            "Wool"
        );
    });

    it("A-3: a required attribute cannot be cleared on update", async () => {
        const { owner, store, root, seeded } = await arrange();
        const material = await createDefinition(root.id, {
            key: "material",
            required: true,
        });
        await asSeller(owner.id, () =>
            upsertProduct(
                buildUpdateInput(seeded, [
                    {
                        scope: "PRODUCT",
                        definitionId: material.id,
                        value: "Wool",
                    },
                ]),
                store.url
            )
        );

        await expect(
            asSeller(owner.id, () =>
                upsertProduct(
                    buildUpdateInput(seeded, [
                        {
                            scope: "PRODUCT",
                            definitionId: material.id,
                            value: "",
                        },
                    ]),
                    store.url
                )
            )
        ).rejects.toThrow("material is required.");
        expect(readBack(material, await productRows(seeded.product.id))).toBe(
            "Wool"
        );
    });

    it("A-3: a new variant must provide required VARIANT attributes", async () => {
        const { owner, store, root, seeded } = await arrange();
        const netWeight = await createDefinition(root.id, {
            key: "net_weight",
            type: "NUMBER",
            scope: "VARIANT",
            required: true,
        });
        const newVariantId = randomUUID();
        const input = (attributes: AttributeValueInput[]) =>
            buildUpdateInput(seeded, attributes, {
                variantId: newVariantId,
                variantName: `New ${newVariantId.slice(0, 6)}`,
                sku: `SKU-${newVariantId.slice(0, 6)}`,
            });

        await expect(
            asSeller(owner.id, () => upsertProduct(input([]), store.url))
        ).rejects.toThrow("net_weight is required.");
        expect(
            await db.productVariant.findUnique({ where: { id: newVariantId } })
        ).toBeNull();

        await asSeller(owner.id, () =>
            upsertProduct(
                input([
                    {
                        scope: "VARIANT",
                        definitionId: netWeight.id,
                        variantId: newVariantId,
                        value: "250",
                    },
                ]),
                store.url
            )
        );
        expect(readBack(netWeight, await variantRows(newVariantId))).toBe(
            "250"
        );
    });

    it("A-10: with the same key on ancestor and leaf, the leaf definition wins for read, save and rejection", async () => {
        // Arrange
        const { owner, store, root, leaf, seeded } = await arrange();
        const rootDef = await createDefinition(root.id, { key: "size_label" });
        const leafDef = await createDefinition(leaf.id, {
            key: "size_label",
            type: "NUMBER",
        });

        // Assert —— 読み取り: 最深の定義 1 件だけ
        const effective = await getEffectiveAttributeDefinitions(leaf.id);
        expect(effective.map((d) => d.id)).toEqual([leafDef.id]);

        // 保存: leaf 定義は通り、root 定義は拒否される
        await asSeller(owner.id, () =>
            upsertProduct(
                buildUpdateInput(seeded, [
                    { scope: "PRODUCT", definitionId: leafDef.id, value: "42" },
                ]),
                store.url
            )
        );
        await expect(
            asSeller(owner.id, () =>
                upsertProduct(
                    buildUpdateInput(seeded, [
                        {
                            scope: "PRODUCT",
                            definitionId: rootDef.id,
                            value: "L",
                        },
                    ]),
                    store.url
                )
            )
        ).rejects.toThrow(
            "Attribute is not available for the selected category."
        );
        const rows = await productRows(seeded.product.id);
        expect(rows.map((r) => r.definitionId)).toEqual([leafDef.id]);
        expect(readBack(leafDef, rows)).toBe("42");
    });
});

// ============================================================================
// A-4 / A-5 / A-6 / A-11 とアーカイブ後の値保持
// ============================================================================

describe("Options, archiving and display", () => {
    it("A-4: renaming an option label is reflected in the product display", async () => {
        const { owner, store, root, leaf, seeded } = await arrange();
        const color = await createDefinition(root.id, {
            key: "color",
            type: "ENUM",
            options: ["black"],
        });
        await asSeller(owner.id, () =>
            upsertProduct(
                buildUpdateInput(seeded, [
                    {
                        scope: "PRODUCT",
                        definitionId: color.id,
                        value: color.options[0].id,
                    },
                ]),
                store.url
            )
        );

        await asAdmin(() =>
            upsertAttributeOption(color.id, {
                id: color.options[0].id,
                value: "black",
                label: "Midnight Black",
                sortOrder: 0,
            })
        );

        const display = await findProductAttributeDisplay(appDb, {
            categoryPath: leaf.path,
            productId: seeded.product.id,
            variantIds: [seeded.variant.id],
        });
        expect(display.product).toEqual([
            expect.objectContaining({
                key: "color",
                values: ["Midnight Black"],
            }),
        ]);
    });

    it("A-5: a referenced option cannot be physically deleted", async () => {
        const { root, seeded } = await arrange();
        const color = await createDefinition(root.id, {
            key: "color",
            type: "ENUM",
            options: ["black"],
        });
        await db.productAttributeValue.create({
            data: {
                productId: seeded.product.id,
                definitionId: color.id,
                type: "ENUM",
                multiValued: false,
                optionId: color.options[0].id,
            },
        });

        await expect(
            db.attributeOption.delete({ where: { id: color.options[0].id } })
        ).rejects.toThrow();
        expect(
            await db.attributeOption.findUnique({
                where: { id: color.options[0].id },
            })
        ).not.toBeNull();
    });

    it("A-6: an archived definition disappears from the effective set and the display", async () => {
        const { owner, store, root, leaf, seeded } = await arrange();
        const brand = await createDefinition(root.id, { key: "brand" });
        const origin = await createDefinition(root.id, { key: "origin" });
        await asSeller(owner.id, () =>
            upsertProduct(
                buildUpdateInput(seeded, [
                    { scope: "PRODUCT", definitionId: brand.id, value: "Acme" },
                    { scope: "PRODUCT", definitionId: origin.id, value: "JP" },
                ]),
                store.url
            )
        );

        await asAdmin(() => archiveAttributeDefinition(brand.id));

        const effective = await getEffectiveAttributeDefinitions(leaf.id);
        expect(effective.map((d) => d.key)).toEqual(["origin"]);
        const display = await findProductAttributeDisplay(appDb, {
            categoryPath: leaf.path,
            productId: seeded.product.id,
            variantIds: [seeded.variant.id],
        });
        expect(display.product.map((item) => item.key)).toEqual(["origin"]);
    });

    it("keeps values of an archived definition when the product is saved again (PRODUCT and VARIANT)", async () => {
        // Arrange
        const { owner, store, root, seeded } = await arrange();
        const brand = await createDefinition(root.id, { key: "brand" });
        const origin = await createDefinition(root.id, { key: "origin" });
        const storage = await createDefinition(root.id, {
            key: "storage",
            type: "NUMBER",
            scope: "VARIANT",
        });
        const color = await createDefinition(root.id, {
            key: "color",
            scope: "VARIANT",
        });
        await asSeller(owner.id, () =>
            upsertProduct(
                buildUpdateInput(seeded, [
                    { scope: "PRODUCT", definitionId: brand.id, value: "Acme" },
                    { scope: "PRODUCT", definitionId: origin.id, value: "JP" },
                    {
                        scope: "VARIANT",
                        definitionId: storage.id,
                        variantId: seeded.variant.id,
                        value: "128",
                    },
                    {
                        scope: "VARIANT",
                        definitionId: color.id,
                        variantId: seeded.variant.id,
                        value: "Red",
                    },
                ]),
                store.url
            )
        );
        await asAdmin(() => archiveAttributeDefinition(brand.id));
        await asAdmin(() => archiveAttributeDefinition(storage.id));

        // Act —— フォームはアーカイブ済み定義を送らない（有効定義だけで同期スコープになる）
        await asSeller(owner.id, () =>
            upsertProduct(
                buildUpdateInput(seeded, [
                    { scope: "PRODUCT", definitionId: origin.id, value: "FR" },
                    {
                        scope: "VARIANT",
                        definitionId: color.id,
                        variantId: seeded.variant.id,
                        value: "Blue",
                    },
                ]),
                store.url
            )
        );

        // Assert —— アーカイブ済み定義の値は履歴として残る
        const pRows = await productRows(seeded.product.id);
        expect(readBack(brand, pRows)).toBe("Acme");
        expect(readBack(origin, pRows)).toBe("FR");
        const vRows = await variantRows(seeded.variant.id);
        expect(readBack(storage, vRows)).toBe("128");
        expect(readBack(color, vRows)).toBe("Blue");
    });

    it("A-11: archived current options stay per variant (unedited saves pass; B's value via A is rejected)", async () => {
        // Arrange —— A は black、B は white を持ち、どちらも後から archive される
        const { owner, store, root, seeded } = await arrange();
        const variantB = await createVariant(seeded.product.id, "b");
        const finish = await createDefinition(root.id, {
            key: "finish",
            type: "ENUM",
            scope: "VARIANT",
            options: ["black", "white", "silver"],
        });
        const [black, white] = finish.options;
        const entry = (variantId: string, optionId: string) => ({
            scope: "VARIANT" as const,
            definitionId: finish.id,
            variantId,
            value: optionId,
        });
        await asSeller(owner.id, () =>
            upsertProduct(
                buildUpdateInput(seeded, [
                    entry(seeded.variant.id, black.id),
                    entry(variantB.id, white.id),
                ]),
                store.url
            )
        );
        await db.attributeOption.updateMany({
            where: { id: { in: [black.id, white.id] } },
            data: { archivedAt: new Date() },
        });
        const save = (attributes: AttributeValueInput[]) =>
            asSeller(owner.id, () =>
                upsertProduct(buildUpdateInput(seeded, attributes), store.url)
            );

        // Act & Assert —— 無編集保存はそれぞれ通る
        await save([entry(seeded.variant.id, black.id)]);
        await save([entry(variantB.id, white.id)]);

        // A に B の現在値（archive 済み white）を入れる保存は拒否
        await expect(
            save([entry(seeded.variant.id, white.id)])
        ).rejects.toThrow("Select a valid finish.");
        expect(readBack(finish, await variantRows(seeded.variant.id))).toBe(
            black.id
        );
        expect(readBack(finish, await variantRows(variantB.id))).toBe(white.id);
    });
});

// ============================================================================
// 編集ページ: 読み込み → 無編集保存で値が変わらない
// ============================================================================

describe("Edit page round trip (getProductVariantForEdit → upsertProduct)", () => {
    it("loads attributes (incl. the record's archived option) and an unedited save keeps them", async () => {
        // Arrange
        const { owner, store, root, seeded } = await arrange();
        const color = await createDefinition(root.id, {
            key: "color",
            type: "ENUM",
            options: ["red", "old"],
        });
        const allergens = await createDefinition(root.id, {
            key: "allergens",
            type: "ENUM",
            multiValued: true,
            options: ["milk", "egg"],
        });
        const storage = await createDefinition(root.id, {
            key: "storage",
            type: "NUMBER",
            scope: "VARIANT",
        });
        const oldOption = color.options[1];
        await asSeller(owner.id, () =>
            upsertProduct(
                buildUpdateInput(seeded, [
                    {
                        scope: "PRODUCT",
                        definitionId: color.id,
                        value: oldOption.id,
                    },
                    {
                        scope: "PRODUCT",
                        definitionId: allergens.id,
                        value: allergens.options.map((o) => o.id),
                    },
                    {
                        scope: "VARIANT",
                        definitionId: storage.id,
                        variantId: seeded.variant.id,
                        value: "128",
                    },
                ]),
                store.url
            )
        );
        await db.attributeOption.update({
            where: { id: oldOption.id },
            data: { archivedAt: new Date() },
        });

        // Act —— 編集ページが読む値を、そのまま（フォームが送る形で）保存し直す
        const loaded = await asSeller(owner.id, () =>
            getProductVariantForEdit(
                store.url,
                seeded.product.id,
                seeded.variant.id
            )
        );
        if (!loaded) throw new Error("product not loaded");
        const attributes: AttributeValueInput[] = [
            ...Object.entries(loaded.productAttributes).map(
                ([definitionId, value]) =>
                    ({ scope: "PRODUCT", definitionId, value }) as const
            ),
            ...Object.entries(loaded.variantAttributes).map(
                ([definitionId, value]) =>
                    ({
                        scope: "VARIANT",
                        definitionId,
                        variantId: loaded.variantId,
                        value,
                    }) as const
            ),
        ];
        const before = await productRows(seeded.product.id);
        await asSeller(owner.id, () =>
            upsertProduct({ ...loaded, attributes }, store.url)
        );

        // Assert
        expect(loaded.archivedCurrent).toEqual({
            [color.id]: [{ id: oldOption.id, value: "old", label: "OLD" }],
        });
        const after = await productRows(seeded.product.id);
        expect(readBack(color, after)).toBe(oldOption.id);
        expect(readBack(allergens, after)).toEqual(readBack(allergens, before));
        expect(readBack(storage, await variantRows(seeded.variant.id))).toBe(
            "128"
        );
        // 商品本体の項目も往復で崩れない
        const product = await db.product.findUniqueOrThrow({
            where: { id: seeded.product.id },
            include: { specs: true },
        });
        expect(product.name).toBe(seeded.product.name);
        expect(product.specs.map((spec) => spec.name)).toEqual(["care"]);
    });

    it("returns null for another store's product (no data leak)", async () => {
        const { owner, store, root, leaf } = await arrange();
        const victim = await seedUser(db);
        const victimStore = await seedStore(db, { userId: victim.id });
        const victimProduct = await seedProductWithVariantAndSize(db, {
            storeId: victimStore.id,
            categoryId: root.id,
            subCategoryId: leaf.id,
        });

        await expect(
            asSeller(owner.id, () =>
                getProductVariantForEdit(
                    store.url,
                    victimProduct.product.id,
                    victimProduct.variant.id
                )
            )
        ).resolves.toBeNull();
    });
});

// ============================================================================
// A-7: TEXT → NUMBER の型変更（経路 1 / 経路 2）
// ============================================================================

describe("A-7: TEXT → NUMBER type change", () => {
    const seedTextValues = async (values: string[]) => {
        const base = await arrange();
        const def = await createDefinition(base.root.id, { key: "weight" });
        const products = [base.seeded];
        for (let i = 1; i < values.length; i++) {
            products.push(
                await seedProductWithVariantAndSize(db, {
                    storeId: base.store.id,
                    categoryId: base.root.id,
                    subCategoryId: base.leaf.id,
                })
            );
        }
        for (const [i, value] of values.entries()) {
            await db.productAttributeValue.create({
                data: {
                    productId: products[i].product.id,
                    definitionId: def.id,
                    type: "TEXT",
                    multiValued: false,
                    valueText: value,
                },
            });
        }
        return { ...base, def, products };
    };

    it("route 1: converts every row and leaves no valueText under the NUMBER definition", async () => {
        const { def } = await seedTextValues(["12", "3.5"]);

        const result = await asAdmin(() => changeAttributeTypeToNumber(def.id));

        expect(result).toEqual(
            expect.objectContaining({
                route: 1,
                definitionId: def.id,
                converted: 2,
                unconvertible: 0,
            })
        );
        const after = await db.attributeDefinition.findUniqueOrThrow({
            where: { id: def.id },
        });
        expect(after.type).toBe("NUMBER");
        const rows = await db.productAttributeValue.findMany({
            where: { definitionId: def.id },
        });
        expect(rows.map((r) => r.valueNumber?.toString()).sort()).toEqual([
            "12",
            "3.5",
        ]);
        expect(rows.every((r) => r.valueText === null)).toBe(true);
    });

    it("route 2: archives the TEXT definition and keeps unconvertible values there (never NULL-ed)", async () => {
        const { def } = await seedTextValues(["12", "28g (45cm)"]);

        const result = await asAdmin(() => changeAttributeTypeToNumber(def.id));

        expect(result).toEqual(
            expect.objectContaining({
                route: 2,
                converted: 1,
                unconvertible: 1,
            })
        );
        const old = await db.attributeDefinition.findUniqueOrThrow({
            where: { id: def.id },
        });
        expect(old.type).toBe("TEXT");
        expect(old.archivedAt).not.toBeNull();
        const oldRows = await db.productAttributeValue.findMany({
            where: { definitionId: def.id },
        });
        expect(oldRows.map((r) => r.valueText)).toEqual(["28g (45cm)"]);

        const next = await db.attributeDefinition.findUniqueOrThrow({
            where: { id: result.definitionId },
        });
        expect(next).toEqual(
            expect.objectContaining({
                key: "weight",
                type: "NUMBER",
                archivedAt: null,
            })
        );
        const newRows = await db.productAttributeValue.findMany({
            where: { definitionId: next.id },
        });
        expect(newRows.map((r) => r.valueNumber?.toString())).toEqual(["12"]);
    });
});

// ============================================================================
// design.md Q7: 定義作成の ON CONFLICT（並行作成で重複しない）
// ============================================================================

describe("Q7: concurrent definition creation", () => {
    it("creates exactly one active definition for the same (category, key)", async () => {
        const { root } = await arrange();
        const input = {
            categoryId: root.id,
            key: "material",
            name: "Material",
            type: "TEXT" as const,
            scope: "PRODUCT" as const,
            unit: null,
            required: false,
            facetable: false,
            multiValued: false,
            sortOrder: 0,
        };

        const results = await Promise.all(
            Array.from({ length: 6 }, () =>
                asAdmin(() => upsertAttributeDefinition(input))
            )
        );

        expect(new Set(results.map((r) => r.id)).size).toBe(1);
        expect(
            await db.attributeDefinition.count({
                where: {
                    categoryId: root.id,
                    key: "material",
                    archivedAt: null,
                },
            })
        ).toBe(1);
    });

    it("rejects a concurrent create whose shape differs from the active definition", async () => {
        const { root } = await arrange();
        const base = {
            categoryId: root.id,
            key: "material",
            name: "Material",
            scope: "PRODUCT" as const,
            unit: null,
            required: false,
            facetable: false,
            multiValued: false,
            sortOrder: 0,
        };

        const results = await Promise.allSettled([
            asAdmin(() => upsertAttributeDefinition({ ...base, type: "TEXT" })),
            asAdmin(() =>
                upsertAttributeDefinition({ ...base, type: "NUMBER" })
            ),
        ]);

        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
        expect(
            await db.attributeDefinition.count({
                where: { categoryId: root.id, key: "material" },
            })
        ).toBe(1);
    });
});
