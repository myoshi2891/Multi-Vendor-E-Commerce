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
