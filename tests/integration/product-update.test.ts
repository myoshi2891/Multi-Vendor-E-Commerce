/**
 * Product Update Integration Tests (upsertProduct → handleProductAndVariantUpdate)
 *
 * セラーの商品編集フローを実 DB (testcontainers PostgreSQL) で検証する。
 * `handleProductAndVariantUpdate` は `db.$transaction` 内で specs / questions /
 * freeShipping / images / colors / sizes を **deleteMany → createMany の全置換**で
 * 更新する。この設計には実 DB でしか観測できない 3 つの帰結がある:
 *
 *   1. tx が途中で失敗したとき子テーブルが半置換で残らないこと（原子性）
 *   2. 名前変更時の slug 再生成が unique 制約と衝突したら suffix (`-1`) で解決されること
 *   3. sizes の全置換で `Size.id` が変わるため、`Wishlist.sizeId`（FK / SET NULL）は
 *      NULL 化し、`CartItem.sizeId`（FK なしの平文字列）は古い id のまま残ること
 *
 * 全モックの unit テスト（`src/queries/product.test.ts`）はこのいずれも実行しない。
 *
 * 関連:
 * - ADR-004: docs/architecture/decisions/004-integration-test-db-strategy.md
 * - src/queries/product.ts (upsertProduct / handleProductAndVariantUpdate / generateUniqueSlug)
 * - plans/038-integration-test-product-update-tx.md
 */

// ----------------------------------------------------------------------------
// Mocks (must be declared before importing the modules they affect)
// ----------------------------------------------------------------------------

jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

// ----------------------------------------------------------------------------

import { randomUUID } from "node:crypto";

import type { Product, ProductVariant, Size } from "@prisma/client";
import { currentUser } from "@clerk/nextjs/server";
import type { ProductWithVariantType } from "@/lib/types";
import { upsertProduct } from "@/queries/product";
import { disconnectTestDb, getTestDb } from "./setup/db";
import { resetDb } from "./setup/reset-db";
import {
    seedCart,
    seedCartItem,
    seedCategoryWithSubcategory,
    seedProductWithVariantAndSize,
    seedStore,
    seedUser,
} from "./setup/seed";

const db = getTestDb();

/** 一時 CHECK 制約名。他テストと衝突しないよう本ファイル固有にする */
const TMP_CONSTRAINT = "tmp_block_boom";

/** currentUser モックを店舗オーナー(SELLER)として解決させる */
function mockAuthAsSeller(userId: string): void {
    (currentUser as unknown as jest.Mock).mockResolvedValue({
        id: userId,
        privateMetadata: { role: "SELLER" },
    });
}

type Seeded = { product: Product; variant: ProductVariant; size: Size };

/**
 * seed 済み product/variant/size から「変更なし」の更新入力を組み立てる。
 * overrides で 1 フィールドだけ動かすことで、各シナリオの変数を 1 つに絞る。
 */
function buildUpdateInput(
    seeded: Seeded,
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
        product_specs: [{ name: "material", value: "cotton" }],
        variant_specs: [{ name: "fit", value: "regular" }],
        keywords: ["test"],
        questions: [{ question: "Q1?", answer: "A1" }],
        freeShippingForAllCountries: false,
        freeShippingCountriesIds: [],
        shippingFeeMethod: seeded.product.shippingFeeMethod,
        createdAt: seeded.product.createdAt,
        updatedAt: new Date(),
        ...overrides,
    };
}

/** 共通 Arrange: オーナー + 店舗 + カテゴリ + 商品一式 + 旧子レコード */
async function arrangeSeller() {
    const owner = await seedUser(db);
    mockAuthAsSeller(owner.id);
    const store = await seedStore(db, { userId: owner.id });
    const { category, subCategory } = await seedCategoryWithSubcategory(db);
    const seeded = await seedProductWithVariantAndSize(db, {
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
    });

    // 「置換前」の状態を作る
    const oldSpec = await db.spec.create({
        data: {
            name: "old-spec",
            value: "old-value",
            productId: seeded.product.id,
        },
    });
    const oldQuestion = await db.question.create({
        data: {
            question: "old-question?",
            answer: "old-answer",
            productId: seeded.product.id,
        },
    });

    return {
        owner,
        store,
        category,
        subCategory,
        seeded,
        oldSpec,
        oldQuestion,
    };
}

// ----------------------------------------------------------------------------
// Lifecycle
// ----------------------------------------------------------------------------

afterAll(async () => {
    await disconnectTestDb();
});

beforeEach(async () => {
    await resetDb(db);
    (currentUser as unknown as jest.Mock).mockReset();
});

// ============================================================================
// Scenario 1: 子レコードの全置換
// ============================================================================

describe("Scenario 1: children are fully replaced", () => {
    it("drops the old specs/questions/sizes and creates the new ones with fresh ids", async () => {
        // Arrange
        const { store, seeded } = await arrangeSeller();

        // Act
        await upsertProduct(buildUpdateInput(seeded), store.url);

        // Assert: spec は新しい 1 件のみ（旧行は消える）
        const specs = await db.spec.findMany({
            where: { productId: seeded.product.id },
        });
        expect(specs).toHaveLength(1);
        expect(specs[0].name).toBe("material");

        const questions = await db.question.findMany({
            where: { productId: seeded.product.id },
        });
        expect(questions).toHaveLength(1);
        expect(questions[0].question).toBe("Q1?");

        // Assert: sizes も全置換。**id が変わる**ことがシナリオ 4 / 5 の前提になる。
        const sizes = await db.size.findMany({
            where: { productVariantId: seeded.variant.id },
        });
        expect(sizes).toHaveLength(1);
        expect(sizes[0].size).toBe("L");
        expect(sizes[0].id).not.toBe(seeded.size.id);
    });
});

// ============================================================================
// Scenario 2: 名前変更で slug 再生成 + 衝突時は suffix
// ============================================================================

describe("Scenario 2: renaming regenerates the slug", () => {
    it("appends a -1 suffix when the generated slug already exists", async () => {
        // Arrange: 衝突相手を先に作る
        const { store, category, subCategory, seeded } = await arrangeSeller();
        const rival = await seedProductWithVariantAndSize(db, {
            storeId: store.id,
            categoryId: category.id,
            subCategoryId: subCategory.id,
        });
        await db.product.update({
            where: { id: rival.product.id },
            data: { slug: "renamed-product" },
        });

        // Act
        await upsertProduct(
            buildUpdateInput(seeded, { name: "Renamed Product" }),
            store.url
        );

        // Assert: generateUniqueSlug が findFirst で衝突を検知し suffix を付ける
        const updated = await db.product.findUniqueOrThrow({
            where: { id: seeded.product.id },
        });
        expect(updated.slug).toBe("renamed-product-1");
        expect(updated.name).toBe("Renamed Product");
    });
});

// ============================================================================
// Scenario 3: 名前不変なら slug 不変
// ============================================================================

describe("Scenario 3: keeping the name keeps the slug", () => {
    it("does not regenerate the slug when the name is unchanged", async () => {
        // Arrange
        const { store, seeded } = await arrangeSeller();
        const originalSlug = seeded.product.slug;

        // Act
        await upsertProduct(buildUpdateInput(seeded), store.url);

        // Assert: 再生成が走ると suffix が付いて URL が変わり、既存リンクが切れる
        const updated = await db.product.findUniqueOrThrow({
            where: { id: seeded.product.id },
        });
        expect(updated.slug).toBe(originalSlug);
    });
});

// ============================================================================
// Scenario 4: sizes 全置換の下流副作用
// ============================================================================

describe("Scenario 4: downstream effects of replacing sizes", () => {
    it("nulls Wishlist.sizeId (FK SET NULL) but leaves CartItem.sizeId stale", async () => {
        // Arrange
        const { owner, store, seeded } = await arrangeSeller();
        await db.wishlist.create({
            data: {
                userId: owner.id,
                productId: seeded.product.id,
                variantId: seeded.variant.id,
                sizeId: seeded.size.id,
            },
        });
        const cart = await seedCart(db, { userId: owner.id });
        await seedCartItem(db, {
            cartId: cart.id,
            storeId: store.id,
            product: seeded.product,
            variant: seeded.variant,
            size: seeded.size,
        });

        // Act
        await upsertProduct(buildUpdateInput(seeded), store.url);

        // Assert: Wishlist.sizeId は FK（ON DELETE SET NULL）なので NULL 化する
        const wishlist = await db.wishlist.findFirstOrThrow({
            where: { userId: owner.id },
        });
        expect(wishlist.sizeId).toBeNull();

        // Assert: CartItem.sizeId は FK なしの平文字列なので**古い id のまま残る**。
        // これは checkout の再検証で弾かれる経路の前提であり、
        // 「編集がカートに与える副作用」の仕様書としてここに固定する。
        const cartItem = await db.cartItem.findFirstOrThrow({
            where: { cartId: cart.id },
        });
        expect(cartItem.sizeId).toBe(seeded.size.id);
        const staleSize = await db.size.findUnique({
            where: { id: seeded.size.id },
        });
        expect(staleSize).toBeNull(); // 参照先は既に存在しない
    });
});

// ============================================================================
// Scenario 5: tx 原子性（後段失敗で前段の全置換も巻き戻る）
// ============================================================================

describe("Scenario 5: transactional atomicity of the replacement", () => {
    it("rolls back every replacement when a late step in the transaction fails", async () => {
        // Arrange
        const { store, seeded, oldSpec, oldQuestion } = await arrangeSeller();

        // 失敗注入は tx の**後段**でなければならない。
        // tx 冒頭（product.update）で落とすと Spec / Question / Size の置換はそもそも
        // 一度も実行されず、旧行が残るのは「巻き戻った」のではなく「未実行」なだけ。
        // それでは $transaction が無くてもテストが緑になり、原子性の証拠にならない。
        // tx 内の最終操作は variant 分の Spec 置換なので、そこだけを CHECK 制約で落とす。
        //
        // ADD の直前に冪等な DROP を打つ（過去の実行が finally に届かず落ちていると
        // 制約が残留し、ADD が duplicate_object でテスト本体と無関係に赤くなる）。
        await db.$executeRawUnsafe(
            `ALTER TABLE "Spec" DROP CONSTRAINT IF EXISTS "${TMP_CONSTRAINT}"`
        );
        await db.$executeRawUnsafe(
            `ALTER TABLE "Spec" ADD CONSTRAINT "${TMP_CONSTRAINT}" CHECK ("value" <> 'BOOM')`
        );

        try {
            const input = buildUpdateInput(seeded, {
                product_specs: [{ name: "material", value: "cotton" }], // 前段は成功する
                variant_specs: [{ name: "trigger", value: "BOOM" }], // tx 最終段で落ちる
            });

            // Act + Assert
            await expect(upsertProduct(input, store.url)).rejects.toThrow();

            // Assert: 前段で「既に実行された」置換がすべて巻き戻っている
            const specs = await db.spec.findMany({
                where: { productId: seeded.product.id },
            });
            expect(specs).toHaveLength(1);
            expect(specs[0].name).toBe(oldSpec.name);
            expect(await db.spec.count({ where: { name: "material" } })).toBe(
                0
            );

            // 旧 Size.id が保たれていることが決定的な証拠。シナリオ 1 のとおり
            // Size 置換が実行されれば id は必ず新しくなるので、旧 id のままなら
            // 「実行されたがロールバックで取り消された」ことを意味する。
            const sizes = await db.size.findMany({
                where: { productVariantId: seeded.variant.id },
            });
            expect(sizes).toHaveLength(1);
            expect(sizes[0].id).toBe(seeded.size.id);
            expect(sizes[0].size).toBe("M");

            const questions = await db.question.findMany({
                where: { productId: seeded.product.id },
            });
            expect(questions).toHaveLength(1);
            expect(questions[0].question).toBe(oldQuestion.question);
        } finally {
            // IF EXISTS 必須。finally は ADD が落ちた経路でも必ず走るため、素の DROP は
            // 「制約が無い」で別の例外を投げ、**try 側の本来の失敗原因を置き換える**。
            // 表示されるのが二次エラーだけになり、失敗注入が成立したかすら判別できなくなる。
            await db.$executeRawUnsafe(
                `ALTER TABLE "Spec" DROP CONSTRAINT IF EXISTS "${TMP_CONSTRAINT}"`
            );
        }
    });
});

// ============================================================================
// Scenario 6: カテゴリツリー FK の dual-write（plan 067 Phase B）
// ============================================================================

/**
 * 読み取りは新 FK `categoryNodeId` へ切り替わっているが、旧 2 列（`categoryId` /
 * `subCategoryId`）は Phase C（plan 068）まで書き続ける —— 旧列が生きている間だけ
 * 読み取りを巻き戻せるためである。**片側だけ書く実装へ退行すると、症状は
 * 「新しく作った商品だけが browse に出ない」という形でしか現れない**ので、
 * 書き込み経路（create / update）の両方で 3 列が揃うことを実 DB で固定する。
 */
describe("Scenario 6: category tree FK dual-write", () => {
    it("fills both the legacy subCategoryId and the new categoryNodeId on create", async () => {
        // Arrange —— 未使用の id を渡して create 経路へ入れる
        const { store, category, subCategory, seeded } = await arrangeSeller();
        const newProductId = randomUUID();
        const input = buildUpdateInput(seeded, {
            productId: newProductId,
            variantId: randomUUID(),
            name: "Dual Write Product",
            variantName: "Dual Write Variant",
        });

        // Act
        await upsertProduct(input, store.url);

        // Assert
        const created = await db.product.findUniqueOrThrow({
            where: { id: newProductId },
        });
        expect(created.categoryId).toBe(category.id);
        expect(created.subCategoryId).toBe(subCategory.id);
        // Phase A の不変条件（SubCategory と Category ノードの id 共有）により、
        // 新 FK は旧 subCategoryId と同じ id を指す。
        expect(created.categoryNodeId).toBe(subCategory.id);
    });

    it("keeps the two columns in step when the category changes on update", async () => {
        // Arrange —— 別ツリーへの付け替え。旧列だけ動いて新 FK が取り残されると、
        // 商品は「移動前のカテゴリで検索するとまだ出る」状態で固まる。
        const { store, seeded } = await arrangeSeller();
        const moved = await seedCategoryWithSubcategory(db);

        // Act
        await upsertProduct(
            buildUpdateInput(seeded, {
                categoryId: moved.category.id,
                subCategoryId: moved.subCategory.id,
            }),
            store.url
        );

        // Assert
        const updated = await db.product.findUniqueOrThrow({
            where: { id: seeded.product.id },
        });
        expect(updated.categoryId).toBe(moved.category.id);
        expect(updated.subCategoryId).toBe(moved.subCategory.id);
        expect(updated.categoryNodeId).toBe(moved.childNode.id);
    });
});

// ============================================================================
// Scenario: 検索ベクトルの非正規化列 searchKeywords の同期（plan 074 / ADR-008）
// ============================================================================

/**
 * `searchVector`（生成列）で `term` に一致する商品 id を返す。
 * Prisma Client は `Unsupported("tsvector")` 列を扱えないため生 SQL で引く。
 */
async function idsMatchingSearchVector(term: string): Promise<string[]> {
    const rows = await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Product"
        WHERE "searchVector" @@ plainto_tsquery('simple', ${term})
        ORDER BY id`;
    return rows.map((row) => row.id);
}

describe("Scenario: searchKeywords follows every keyword write path", () => {
    it("fills searchKeywords on product create so variant keywords are searchable", async () => {
        // Arrange
        const { store, seeded } = await arrangeSeller();
        const newProductId = randomUUID();
        const input = buildUpdateInput(seeded, {
            productId: newProductId,
            variantId: randomUUID(),
            name: "Keyword Create Product",
            variantName: "Keyword Create Variant",
            keywords: ["quartzite", "granite"],
        });

        // Act
        await upsertProduct(input, store.url);

        // Assert — keywords はどちらも name / description に無い語
        const created = await db.product.findUniqueOrThrow({
            where: { id: newProductId },
        });
        // バリアント名 → 説明 → keywords の順に連結される（recomputeProductDerivedColumns）
        expect(created.searchKeywords).toContain("Keyword Create Variant");
        expect(created.searchKeywords).toContain("quartzite granite");
        expect(await idsMatchingSearchVector("quartzite")).toEqual([newProductId]);
    });

    it("appends the new variant's keywords when a variant is added", async () => {
        // Arrange
        const { store, seeded } = await arrangeSeller();
        await upsertProduct(
            buildUpdateInput(seeded, { keywords: ["obsidian"] }),
            store.url
        );

        // Act — 既存商品に新規バリアントを追加（handleVariantCreate 経路）
        await upsertProduct(
            buildUpdateInput(seeded, {
                variantId: randomUUID(),
                variantName: "Second Variant",
                sku: "SKU-SECOND",
                keywords: ["basalt"],
            }),
            store.url
        );

        // Assert — 両バリアントの keywords が残る
        expect(await idsMatchingSearchVector("obsidian")).toEqual([seeded.product.id]);
        expect(await idsMatchingSearchVector("basalt")).toEqual([seeded.product.id]);
    });

    it("keeps both variants' keywords when two variants are added concurrently", async () => {
        // Arrange — 子行の INSERT は FK で Product に FOR KEY SHARE を取る。Product の行ロックを
        // 子の書き込みより後に取ると、並行する 2 tx が互いの KEY SHARE を待ってデッドロックする。
        const { store, seeded } = await arrangeSeller();
        const addVariant = (variantName: string, sku: string, keyword: string) =>
            upsertProduct(
                buildUpdateInput(seeded, {
                    variantId: randomUUID(),
                    variantName,
                    sku,
                    keywords: [keyword],
                }),
                store.url
            );

        // Act — 同じ商品へ handleVariantCreate を並行実行
        const results = await Promise.allSettled([
            addVariant("Concurrent Variant A", "SKU-CONC-A", "andesite"),
            addVariant("Concurrent Variant B", "SKU-CONC-B", "rhyolite"),
        ]);

        // Assert — 両方成功し、どちらの keywords も導出列に残る
        expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled"]);
        const product = await db.product.findUniqueOrThrow({
            where: { id: seeded.product.id },
        });
        expect(product.searchKeywords).toContain("andesite");
        expect(product.searchKeywords).toContain("rhyolite");
    });

    it("makes variant names and descriptions searchable like the former ILIKE path", async () => {
        // Arrange — 旧 getProducts の検索は variantName / variantDescription も ILIKE で見ていた。
        // searchKeywords に入れないと、ブラウズ検索を searchVector へ移した時点で退行する（plan 075）。
        const { store, seeded } = await arrangeSeller();

        // Act
        await upsertProduct(
            buildUpdateInput(seeded, {
                variantName: "Cerulean Edition",
                variantDescription: "hand stitched lapels",
            }),
            store.url
        );

        // Assert
        expect(await idsMatchingSearchVector("cerulean")).toEqual([seeded.product.id]);
        expect(await idsMatchingSearchVector("lapels")).toEqual([seeded.product.id]);
    });

    it("replaces stale keywords when an existing variant is updated", async () => {
        // Arrange
        const { store, seeded } = await arrangeSeller();
        await upsertProduct(
            buildUpdateInput(seeded, { keywords: ["marble"] }),
            store.url
        );

        // Act — 同じバリアントの keywords を差し替える（handleProductAndVariantUpdate 経路）
        await upsertProduct(
            buildUpdateInput(seeded, { keywords: ["slate"] }),
            store.url
        );

        // Assert — 古い語では見つからず、新しい語で見つかる
        expect(await idsMatchingSearchVector("marble")).toEqual([]);
        expect(await idsMatchingSearchVector("slate")).toEqual([seeded.product.id]);
    });
});

// ============================================================================
// Scenario: 割引後最小価格 minPrice の同期（plan 076）
// ============================================================================

describe("Scenario: minPrice follows size price and discount writes", () => {
    it("stores the lowest discounted price, rounded to cents, on update", async () => {
        // Arrange — 100 の 12.5% 引き = 87.50 / 95 の 0% 引き = 95.00 → 最小は 87.50
        const { store, seeded } = await arrangeSeller();

        // Act
        await upsertProduct(
            buildUpdateInput(seeded, {
                sizes: [
                    { size: "M", quantity: 5, price: 100, discount: 12.5 },
                    { size: "L", quantity: 5, price: 95, discount: 0 },
                ],
            }),
            store.url
        );

        // Assert
        const updated = await db.product.findUniqueOrThrow({
            where: { id: seeded.product.id },
        });
        expect(updated.minPrice?.toString()).toBe("87.5");
    });

    it("fills minPrice on product create", async () => {
        // Arrange
        const { store, seeded } = await arrangeSeller();
        const newProductId = randomUUID();

        // Act
        await upsertProduct(
            buildUpdateInput(seeded, {
                productId: newProductId,
                variantId: randomUUID(),
                name: "Min Price Create Product",
                variantName: "Min Price Create Variant",
                sizes: [{ size: "S", quantity: 1, price: 40, discount: 25 }],
            }),
            store.url
        );

        // Assert — 40 の 25% 引き = 30.00
        const created = await db.product.findUniqueOrThrow({
            where: { id: newProductId },
        });
        expect(created.minPrice?.toString()).toBe("30");
    });

    it("takes the minimum across variants when a cheaper variant is added", async () => {
        // Arrange — 既存バリアントは 120（buildUpdateInput の既定）
        const { store, seeded } = await arrangeSeller();
        await upsertProduct(buildUpdateInput(seeded), store.url);

        // Act — 60 のバリアントを追加
        await upsertProduct(
            buildUpdateInput(seeded, {
                variantId: randomUUID(),
                variantName: "Cheaper Variant",
                sku: "SKU-CHEAP",
                sizes: [{ size: "XS", quantity: 1, price: 60, discount: 0 }],
            }),
            store.url
        );

        // Assert
        const updated = await db.product.findUniqueOrThrow({
            where: { id: seeded.product.id },
        });
        expect(updated.minPrice?.toString()).toBe("60");
    });
});
