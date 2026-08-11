/**
 * deleteProduct の FK セマンティクス統合テスト (plan 036 / TESTS-20)
 *
 * `deleteProduct` (`src/queries/product.ts`) は `db.product.delete` の**ハード削除**であり、
 * 「何が連鎖して消え、何が削除を阻止するか」は DB の FK 定義でしか決まらない。
 * `db.product.delete` をモックする unit テスト (`src/queries/product.test.ts`) では
 * 原理的に検証できない境界を、実 PostgreSQL (testcontainers) で固定する:
 *
 *   - **RESTRICT**: `Review.productId → Product` は onDelete 未指定 = Prisma 既定の Restrict。
 *     レビューが 1 件でも付いた商品は削除できず P2003 が投げられる（＝ セラーのダッシュボードに
 *     500 として露出する現挙動の characterization）
 *   - **CASCADE**: ProductVariant / Size / ProductVariantImage / Color / Spec（product・variant の
 *     両経路）/ Question / Wishlist / FreeShipping / FreeShippingCountry の連鎖消滅。
 *     FreeShippingCountry は Product の**孫**（Product → FreeShipping → FreeShippingCountry）で、
 *     多段連鎖の回帰を取り逃さないため孫まで assert する
 *   - **原子性**: RESTRICT で失敗した場合に「子だけ部分的に消える」ことがないこと
 *   - 所有権ガード（IDOR 防止）が実 DB でも副作用を残さないこと
 *
 * 本テストは**現挙動の characterization** であり、「レビュー付き商品は削除できない」を
 * 正しい仕様として肯定するものではない。プロダクト判断で削除可能にする場合
 * （レビュー先行削除 / ソフト削除化 / onDelete 変更）は、シナリオ 2 の期待値を
 * 意図的に反転させること。
 *
 * 関連:
 * - ADR-004: docs/architecture/decisions/004-integration-test-db-strategy.md
 * - plans/036-integration-test-product-deletion-fk.md
 * - prisma/schema.prisma (onDelete 定義が本テストの SSOT)
 */

// ----------------------------------------------------------------------------
// Mocks (must be declared before importing the modules they affect)
// ----------------------------------------------------------------------------

// deleteProduct は requireSeller() 経由で currentUser() を呼ぶ。テストごとに差し替える。
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

// ----------------------------------------------------------------------------

import type { PrismaClient, Product, ProductVariant, Size } from "@prisma/client";
import { currentUser } from "@clerk/nextjs/server";
import { deleteProduct } from "@/queries/product";
import { disconnectTestDb, getTestDb } from "./setup/db";
import { resetDb } from "./setup/reset-db";
import {
    seedCategoryWithSubcategory,
    seedCountry,
    seedProductWithVariantAndSize,
    seedStore,
    seedUser,
} from "./setup/seed";

let db: PrismaClient;

/**
 * `requireSeller` は `user.privateMetadata?.role !== "SELLER"` で判定する
 * (`src/lib/auth-guards.ts`)。placeOrder 系の mock（role を見ない）とは形が異なる。
 */
function mockAuthAsSeller(userId: string): void {
    (currentUser as unknown as jest.Mock).mockResolvedValue({
        id: userId,
        privateMetadata: { role: "SELLER" },
    });
}

interface ProductChildCounts {
    variant: number;
    size: number;
    image: number;
    color: number;
    spec: number;
    question: number;
    wishlist: number;
    freeShipping: number;
    fsCountry: number;
}

/**
 * Product に連鎖する全子テーブルの件数を 1 度に取る。
 * オブジェクト全体を `toEqual` で比較することで、子テーブルを 1 つ足したのに
 * assert を書き忘れる漏れが差分として顕在化する。
 */
async function countProductChildren(): Promise<ProductChildCounts> {
    const [
        variant,
        size,
        image,
        color,
        spec,
        question,
        wishlist,
        freeShipping,
        fsCountry,
    ] = await Promise.all([
        db.productVariant.count(),
        db.size.count(),
        db.productVariantImage.count(),
        db.color.count(),
        db.spec.count(),
        db.question.count(),
        db.wishlist.count(),
        db.freeShipping.count(),
        db.freeShippingCountry.count(),
    ]);
    return {
        variant,
        size,
        image,
        color,
        spec,
        question,
        wishlist,
        freeShipping,
        fsCountry,
    };
}

interface SeededFixture {
    ownerId: string;
    product: Product;
    variant: ProductVariant;
    size: Size;
}

/**
 * オーナー・店舗・商品と、CASCADE 表の**全行**にあたる子レコードを揃える。
 *
 * Arrange の網羅性がこのテストの肝である。1 つでも生成を省くと、そのテーブルの CASCADE は
 * 「0 件のものを数えて 0 件だった」と言っているだけになり未検証のまま通ってしまう。
 */
async function seedProductWithAllChildren(): Promise<SeededFixture> {
    const owner = await seedUser(db);
    const store = await seedStore(db, { userId: owner.id });
    const { category, subCategory } = await seedCategoryWithSubcategory(db);
    const { product, variant, size } = await seedProductWithVariantAndSize(db, {
        storeId: store.id,
        categoryId: category.id,
        subCategoryId: subCategory.id,
    });

    // seed ヘルパーは Color を作らないため直接 create する
    await db.color.create({
        data: { name: "Black", productVariantId: variant.id },
    });

    // Spec は productId / variantId の両方が任意 FK。どちらの経路も CASCADE するため
    // 2 行作り、両方が消えることを確認する（片方だけでは CASCADE の半分しか見ていない）。
    await db.spec.create({
        data: { name: "Material", value: "Cotton", productId: product.id },
    });
    await db.spec.create({
        data: { name: "Fit", value: "Regular", variantId: variant.id },
    });

    await db.question.create({
        data: {
            question: "Is it machine washable?",
            answer: "Yes.",
            productId: product.id,
        },
    });

    await db.wishlist.create({
        data: {
            userId: owner.id,
            productId: product.id,
            variantId: variant.id,
            sizeId: size.id,
        },
    });

    // 孫までの多段連鎖: Product → FreeShipping → FreeShippingCountry
    const country = await seedCountry(db);
    const freeShipping = await db.freeShipping.create({
        data: { productId: product.id },
    });
    await db.freeShippingCountry.create({
        data: { freeShippingId: freeShipping.id, countryId: country.id },
    });

    return { ownerId: owner.id, product, variant, size };
}

beforeAll(() => {
    db = getTestDb();
});

afterAll(async () => {
    await disconnectTestDb();
});

beforeEach(async () => {
    await resetDb(db);
    (currentUser as unknown as jest.Mock).mockReset();
});

describe("deleteProduct — FK CASCADE / RESTRICT の実挙動", () => {
    it("シナリオ1: レビューなし商品の削除で子テーブルが全て連鎖消滅する（孫の FreeShippingCountry を含む）", async () => {
        // Arrange
        const { ownerId, product } = await seedProductWithAllChildren();
        mockAuthAsSeller(ownerId);

        // 削除前に厳密な期待件数を固定する。下限（>= 1）だと Arrange の二重生成・
        // 取りこぼしを検出できず、CASCADE の検証そのものが空振りになる。
        expect(await countProductChildren()).toEqual({
            variant: 1,
            size: 1,
            image: 1,
            color: 1,
            spec: 2,
            question: 1,
            wishlist: 1,
            freeShipping: 1,
            fsCountry: 1,
        });

        // Act
        await expect(deleteProduct(product.id)).resolves.toMatchObject({
            id: product.id,
        });

        // Assert
        expect(await db.product.count()).toBe(0);
        // fsCountry: 0 が Product → FreeShipping → FreeShippingCountry の 2 段連鎖の証拠
        expect(await countProductChildren()).toEqual({
            variant: 0,
            size: 0,
            image: 0,
            color: 0,
            spec: 0,
            question: 0,
            wishlist: 0,
            freeShipping: 0,
            fsCountry: 0,
        });
    });

    it("シナリオ2: レビュー付き商品の削除は P2003 で失敗し、商品・レビュー・子テーブルが全て無傷のまま残る", async () => {
        // Arrange
        const { ownerId, product } = await seedProductWithAllChildren();
        const reviewer = await seedUser(db);
        await db.review.create({
            data: {
                variant: "Variant A",
                review: "Great product.",
                rating: 4,
                color: "Black",
                size: "M",
                quantity: "1",
                userId: reviewer.id,
                productId: product.id,
            },
        });
        mockAuthAsSeller(ownerId);
        const before = await countProductChildren();

        // Act
        await expect(deleteProduct(product.id)).rejects.toMatchObject({
            code: "P2003",
        });

        // Assert
        expect(await db.product.count()).toBe(1);
        expect(await db.review.count()).toBe(1);
        // 子テーブル全件不変であることが「原子性」の証拠。商品と variant だけを数えると
        // 「RESTRICT で止まった」は分かっても「部分的に子だけ消えていない」ことは示せない
        // （DB は tx 内で子の CASCADE を実行してから RESTRICT に到達しうる）。
        expect(await countProductChildren()).toEqual(before);
    });

    it("シナリオ3: 非所有商品の削除は所有権ガードで拒否され、副作用を残さない（IDOR）", async () => {
        // Arrange
        const { product } = await seedProductWithAllChildren();
        const otherSeller = await seedUser(db);
        mockAuthAsSeller(otherSeller.id);
        const before = await countProductChildren();

        // Act & Assert
        await expect(deleteProduct(product.id)).rejects.toThrow(
            "You can only delete your own products."
        );
        expect(await db.product.count()).toBe(1);
        expect(await countProductChildren()).toEqual(before);
    });

    it("シナリオ4: 存在しない productId は 'Product not found.' で拒否される", async () => {
        // Arrange
        const seller = await seedUser(db);
        mockAuthAsSeller(seller.id);

        // Act & Assert
        await expect(
            deleteProduct("00000000-0000-0000-0000-000000000000")
        ).rejects.toThrow("Product not found.");
    });
});
