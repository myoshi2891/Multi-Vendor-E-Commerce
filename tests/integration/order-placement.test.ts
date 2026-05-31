/**
 * Order Placement Integration Tests (placeOrder)
 *
 * 注文確定フロー `placeOrder` (`src/queries/user.ts`) を実 DB (testcontainers PostgreSQL)
 * + `db.$transaction` で検証する。モック Prisma の unit テスト (`src/queries/user.test.ts`)
 * では構造的に検証できない以下の境界をカバーする:
 *
 *   - 店舗別 OrderGroup 分割 (groupedItems の reduce)
 *   - 在庫上限キャップ (validQuantity = Math.min(quantity, size.quantity))
 *   - クーポン割引の店舗限定適用 (storeId === cartCoupon.storeId のグループのみ)
 *   - Order / OrderGroup / OrderItem の Decimal 集計 (subTotal / shippingFees / total)
 *   - 所有権ガード (where: { id: cartId, userId }) による IDOR 防止 + 副作用なし
 *   - 不正な variant/size 組み合わせ時の拒否 + Order 非永続化
 *
 * 送料は placeOrder 内部で getShippingDetails を介し Store デフォルト料率を用いる。
 * ShippingRate を seed しないため details は store.defaultShippingFee* にフォールバックする。
 * 期待送料は computeShippingTotal で独立に pin する。
 *
 * 関連:
 * - ADR-004: docs/architecture/decisions/004-integration-test-db-strategy.md
 * - src/queries/user.ts (placeOrder)
 * - src/queries/product.ts (getShippingDetails / getDeliveryDetailsForStoreByCountry)
 * - src/lib/shipping-utils.ts (computeShippingTotal)
 */

// ----------------------------------------------------------------------------
// Mocks (must be declared before importing the modules they affect)
// ----------------------------------------------------------------------------

// placeOrder は currentUser() で認証ユーザーを取得する。テストごとに差し替え可能にする。
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

// ----------------------------------------------------------------------------

import type { ShippingAddress, Store } from "@prisma/client";
import { currentUser } from "@clerk/nextjs/server";
import { computeShippingTotal } from "@/lib/shipping-utils";
import { placeOrder } from "@/queries/user";
import { disconnectTestDb, getTestDb } from "./setup/db";
import { resetDb } from "./setup/reset-db";
import {
    seedCart,
    seedCartItem,
    seedCategoryWithSubcategory,
    seedCoupon,
    seedCountry,
    seedProductWithVariantAndSize,
    seedShippingAddress,
    seedStore,
    seedUser,
} from "./setup/seed";

const db = getTestDb();

// Store デフォルト送料 (ITEM 方式): 1 個目 $10、追加 1 個ごと $3
const DEFAULT_FEE_PER_ITEM = 10;
const DEFAULT_FEE_ADDITIONAL = 3;

const storeShippingDefaults = {
    defaultShippingFeePerItem: DEFAULT_FEE_PER_ITEM,
    defaultShippingFeeForAdditionalItem: DEFAULT_FEE_ADDITIONAL,
};

/** currentUser モックを指定ユーザー ID で解決させる */
function mockAuthAs(userId: string): void {
    (currentUser as unknown as jest.Mock).mockResolvedValue({ id: userId });
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
// Scenario 1: Single-store cart → 1 Order / 1 OrderGroup / N OrderItems
// ============================================================================

describe("Scenario 1: single-store order placement", () => {
    it("creates Order + OrderGroup + OrderItem with correct FK linkage and Decimal totals", async () => {
        // Arrange
        const user = await seedUser(db);
        const country = await seedCountry(db);
        const address = await seedShippingAddress(db, {
            userId: user.id,
            countryId: country.id,
        });
        const store = await seedStore(db, {
            userId: user.id,
            overrides: storeShippingDefaults,
        });
        const { category, subCategory } = await seedCategoryWithSubcategory(db);
        const { product, variant, size } = await seedProductWithVariantAndSize(
            db,
            {
                storeId: store.id,
                categoryId: category.id,
                subCategoryId: subCategory.id,
                shippingFeeMethod: "ITEM",
                sizePrice: 100,
                sizeQuantity: 10,
            }
        );
        const cart = await seedCart(db, { userId: user.id });
        await seedCartItem(db, {
            cartId: cart.id,
            storeId: store.id,
            product,
            variant,
            size,
            quantity: 2,
        });

        mockAuthAs(user.id);

        // 期待値: ITEM 方式 qty=2 → 送料 = 10 + 3*(2-1) = 13
        const expectedShipping = computeShippingTotal(
            "ITEM",
            DEFAULT_FEE_PER_ITEM,
            DEFAULT_FEE_ADDITIONAL,
            variant.weight,
            2
        );
        expect(expectedShipping).toBeCloseTo(13, 2);
        const expectedLineTotal = 100 * 2 + expectedShipping; // 213
        const expectedSubTotal = 100 * 2; // 200

        // Act
        const { orderId } = await placeOrder(address as ShippingAddress, cart.id);

        // Assert: Order
        const order = await db.order.findUniqueOrThrow({
            where: { id: orderId },
            include: { groups: { include: { items: true } } },
        });
        expect(order.userId).toBe(user.id);
        expect(order.shippingAddressId).toBe(address.id);
        expect(order.orderStatus).toBe("Pending");
        expect(order.paymentStatus).toBe("Pending");
        expect(order.subTotal.toNumber()).toBeCloseTo(expectedSubTotal, 2);
        expect(order.shippingFees.toNumber()).toBeCloseTo(expectedShipping, 2);
        expect(order.total.toNumber()).toBeCloseTo(expectedLineTotal, 2);

        // Assert: 1 OrderGroup
        expect(order.groups).toHaveLength(1);
        const group = order.groups[0];
        expect(group.storeId).toBe(store.id);
        expect(group.couponId).toBeNull();
        expect(group.subTotal.toNumber()).toBeCloseTo(expectedSubTotal, 2);
        expect(group.shippingFees.toNumber()).toBeCloseTo(expectedShipping, 2);
        expect(group.total.toNumber()).toBeCloseTo(expectedLineTotal, 2);

        // Assert: 1 OrderItem (FK linkage + snapshot)
        expect(group.items).toHaveLength(1);
        const item = group.items[0];
        expect(item.orderGroupId).toBe(group.id);
        expect(item.productId).toBe(product.id);
        expect(item.variantId).toBe(variant.id);
        expect(item.sizeId).toBe(size.id);
        expect(item.quantity).toBe(2);
        expect(item.price.toNumber()).toBeCloseTo(100, 2);
        expect(item.shippingFee.toNumber()).toBeCloseTo(expectedShipping, 2);
        expect(item.totalPrice.toNumber()).toBeCloseTo(expectedLineTotal, 2);
        // placeOrder は variant.images[0].url を image に詰める
        expect(item.image).toContain("https://example.test/variant-");
    });
});

// ============================================================================
// Scenario 2: Multi-store cart → one OrderGroup per store
// ============================================================================

describe("Scenario 2: multi-store order placement", () => {
    it("creates a separate OrderGroup per store with store-scoped totals", async () => {
        // Arrange: 1 ユーザー / 2 店舗 / 各店舗 1 商品 (qty=1)
        const user = await seedUser(db);
        const country = await seedCountry(db);
        const address = await seedShippingAddress(db, {
            userId: user.id,
            countryId: country.id,
        });
        const { category, subCategory } = await seedCategoryWithSubcategory(db);

        const storeA = await seedStore(db, {
            userId: user.id,
            overrides: storeShippingDefaults,
        });
        const a = await seedProductWithVariantAndSize(db, {
            storeId: storeA.id,
            categoryId: category.id,
            subCategoryId: subCategory.id,
            shippingFeeMethod: "ITEM",
            sizePrice: 100,
        });

        const storeB = await seedStore(db, {
            userId: user.id,
            overrides: storeShippingDefaults,
        });
        const b = await seedProductWithVariantAndSize(db, {
            storeId: storeB.id,
            categoryId: category.id,
            subCategoryId: subCategory.id,
            shippingFeeMethod: "ITEM",
            sizePrice: 200,
        });

        const cart = await seedCart(db, { userId: user.id });
        await seedCartItem(db, {
            cartId: cart.id,
            storeId: storeA.id,
            product: a.product,
            variant: a.variant,
            size: a.size,
            quantity: 1,
        });
        await seedCartItem(db, {
            cartId: cart.id,
            storeId: storeB.id,
            product: b.product,
            variant: b.variant,
            size: b.size,
            quantity: 1,
        });

        mockAuthAs(user.id);

        // qty=1 → ITEM 送料は基本料 $10 のみ (追加料なし)
        const shippingPerItem = DEFAULT_FEE_PER_ITEM;

        // Act
        const { orderId } = await placeOrder(address as ShippingAddress, cart.id);

        // Assert
        const order = await db.order.findUniqueOrThrow({
            where: { id: orderId },
            include: { groups: true },
        });
        expect(order.groups).toHaveLength(2);

        const groupA = order.groups.find((g) => g.storeId === storeA.id);
        const groupB = order.groups.find((g) => g.storeId === storeB.id);
        expect(groupA).toBeDefined();
        expect(groupB).toBeDefined();

        // storeA: price 100 + shipping 10 = 110, subTotal 100
        expect(groupA!.subTotal.toNumber()).toBeCloseTo(100, 2);
        expect(groupA!.shippingFees.toNumber()).toBeCloseTo(shippingPerItem, 2);
        expect(groupA!.total.toNumber()).toBeCloseTo(110, 2);

        // storeB: price 200 + shipping 10 = 210, subTotal 200
        expect(groupB!.subTotal.toNumber()).toBeCloseTo(200, 2);
        expect(groupB!.shippingFees.toNumber()).toBeCloseTo(shippingPerItem, 2);
        expect(groupB!.total.toNumber()).toBeCloseTo(210, 2);

        // Order 集計: subTotal 300 / shipping 20 / total 320
        expect(order.subTotal.toNumber()).toBeCloseTo(300, 2);
        expect(order.shippingFees.toNumber()).toBeCloseTo(20, 2);
        expect(order.total.toNumber()).toBeCloseTo(320, 2);
    });
});

// ============================================================================
// Scenario 3: Stock capping (validQuantity = Math.min(quantity, stock))
// ============================================================================

describe("Scenario 3: stock capping", () => {
    it("caps OrderItem.quantity at available stock when cart quantity exceeds it", async () => {
        // Arrange: 在庫 3 に対しカート数量 5
        const user = await seedUser(db);
        const country = await seedCountry(db);
        const address = await seedShippingAddress(db, {
            userId: user.id,
            countryId: country.id,
        });
        const store = await seedStore(db, {
            userId: user.id,
            overrides: storeShippingDefaults,
        });
        const { category, subCategory } = await seedCategoryWithSubcategory(db);
        const { product, variant, size } = await seedProductWithVariantAndSize(
            db,
            {
                storeId: store.id,
                categoryId: category.id,
                subCategoryId: subCategory.id,
                shippingFeeMethod: "ITEM",
                sizePrice: 100,
                sizeQuantity: 3,
            }
        );
        const cart = await seedCart(db, { userId: user.id });
        await seedCartItem(db, {
            cartId: cart.id,
            storeId: store.id,
            product,
            variant,
            size,
            quantity: 5, // 在庫 3 を超過
        });

        mockAuthAs(user.id);

        // 期待: validQuantity=3 → 送料 = 10 + 3*(3-1) = 16
        const expectedShipping = computeShippingTotal(
            "ITEM",
            DEFAULT_FEE_PER_ITEM,
            DEFAULT_FEE_ADDITIONAL,
            variant.weight,
            3
        );
        expect(expectedShipping).toBeCloseTo(16, 2);

        // Act
        const { orderId } = await placeOrder(address as ShippingAddress, cart.id);

        // Assert
        const order = await db.order.findUniqueOrThrow({
            where: { id: orderId },
            include: { groups: { include: { items: true } } },
        });
        const item = order.groups[0].items[0];
        expect(item.quantity).toBe(3); // 5 ではなく在庫上限 3
        expect(item.totalPrice.toNumber()).toBeCloseTo(
            100 * 3 + expectedShipping,
            2
        ); // 316
    });
});

// ============================================================================
// Scenario 4: Coupon applies only to the matching store's OrderGroup
// ============================================================================

describe("Scenario 4: store-scoped coupon discount", () => {
    it("discounts only the coupon's store group and sets couponId on that group only", async () => {
        // Arrange: storeA / storeB の 2 商品。クーポンは storeA のみ 10% OFF。
        const user = await seedUser(db);
        const country = await seedCountry(db);
        const address = await seedShippingAddress(db, {
            userId: user.id,
            countryId: country.id,
        });
        const { category, subCategory } = await seedCategoryWithSubcategory(db);

        const storeA = await seedStore(db, {
            userId: user.id,
            overrides: storeShippingDefaults,
        });
        const a = await seedProductWithVariantAndSize(db, {
            storeId: storeA.id,
            categoryId: category.id,
            subCategoryId: subCategory.id,
            shippingFeeMethod: "ITEM",
            sizePrice: 100,
        });

        const storeB = await seedStore(db, {
            userId: user.id,
            overrides: storeShippingDefaults,
        });
        const b = await seedProductWithVariantAndSize(db, {
            storeId: storeB.id,
            categoryId: category.id,
            subCategoryId: subCategory.id,
            shippingFeeMethod: "ITEM",
            sizePrice: 200,
        });

        const coupon = await seedCoupon(db, {
            storeId: storeA.id,
            discount: 10,
            code: "SAVE10",
        });

        const cart = await seedCart(db, {
            userId: user.id,
            couponId: coupon.id,
        });
        await seedCartItem(db, {
            cartId: cart.id,
            storeId: storeA.id,
            product: a.product,
            variant: a.variant,
            size: a.size,
            quantity: 1,
        });
        await seedCartItem(db, {
            cartId: cart.id,
            storeId: storeB.id,
            product: b.product,
            variant: b.variant,
            size: b.size,
            quantity: 1,
        });

        mockAuthAs(user.id);

        // Act
        const { orderId } = await placeOrder(address as ShippingAddress, cart.id);

        // Assert
        const order = await db.order.findUniqueOrThrow({
            where: { id: orderId },
            include: { groups: true },
        });
        const groupA = order.groups.find((g) => g.storeId === storeA.id)!;
        const groupB = order.groups.find((g) => g.storeId === storeB.id)!;

        // storeA: groupedTotal = 110 (price100 + shipping10) → discount 11 → total 99
        expect(groupA.couponId).toBe(coupon.id);
        expect(groupA.total.toNumber()).toBeCloseTo(99, 2);

        // storeB: 割引なし → couponId null / total 210
        expect(groupB.couponId).toBeNull();
        expect(groupB.total.toNumber()).toBeCloseTo(210, 2);

        // Order total = 99 + 210 = 309
        expect(order.total.toNumber()).toBeCloseTo(309, 2);
    });
});

// ============================================================================
// Scenario 5: Ownership guard (IDOR) — foreign cartId throws, no Order persisted
// ============================================================================

describe("Scenario 5: ownership guard", () => {
    it("throws 'Cart not found.' for a cart owned by another user and creates no Order", async () => {
        // Arrange: owner がカートを持ち、別ユーザー (attacker) として placeOrder を呼ぶ
        const owner = await seedUser(db);
        const attacker = await seedUser(db);
        const country = await seedCountry(db);
        const address = await seedShippingAddress(db, {
            userId: attacker.id,
            countryId: country.id,
        });
        const store = await seedStore(db, {
            userId: owner.id,
            overrides: storeShippingDefaults,
        });
        const { category, subCategory } = await seedCategoryWithSubcategory(db);
        const { product, variant, size } = await seedProductWithVariantAndSize(
            db,
            {
                storeId: store.id,
                categoryId: category.id,
                subCategoryId: subCategory.id,
                sizePrice: 100,
            }
        );
        const cart = await seedCart(db, { userId: owner.id });
        await seedCartItem(db, {
            cartId: cart.id,
            storeId: store.id,
            product,
            variant,
            size,
            quantity: 1,
        });

        // attacker として認証
        mockAuthAs(attacker.id);

        // Act + Assert: where: { id, userId } で他人のカートは取得できず throw
        await expect(
            placeOrder(address as ShippingAddress, cart.id)
        ).rejects.toThrow(/Cart not found/);

        // 副作用なし検証: Order / OrderGroup / OrderItem が 1 件も作られていない
        expect(await db.order.count()).toBe(0);
        expect(await db.orderGroup.count()).toBe(0);
        expect(await db.orderItem.count()).toBe(0);
    });
});

// ============================================================================
// Scenario 6: Invalid variant/size combination → reject + no Order
// ============================================================================

describe("Scenario 6: invalid product combination", () => {
    it("rejects when cart item references a variant not belonging to its product and persists no Order", async () => {
        // Arrange: productA と productB を seed し、CartItem を
        // productId=A / variantId=B / sizeId=B の不整合な組み合わせで作る。
        // placeOrder は product A の variants から variantId=B を見つけられず throw する。
        const user = await seedUser(db);
        const country = await seedCountry(db);
        const address = await seedShippingAddress(db, {
            userId: user.id,
            countryId: country.id,
        });
        const store = await seedStore(db, {
            userId: user.id,
            overrides: storeShippingDefaults,
        });
        const { category, subCategory } = await seedCategoryWithSubcategory(db);
        const a = await seedProductWithVariantAndSize(db, {
            storeId: store.id,
            categoryId: category.id,
            subCategoryId: subCategory.id,
            sizePrice: 100,
        });
        const b = await seedProductWithVariantAndSize(db, {
            storeId: store.id,
            categoryId: category.id,
            subCategoryId: subCategory.id,
            sizePrice: 100,
        });

        const cart = await seedCart(db, { userId: user.id });
        // product=A だが variant/size は B のものを渡す → 不整合な CartItem
        await seedCartItem(db, {
            cartId: cart.id,
            storeId: store.id,
            product: a.product,
            variant: b.variant,
            size: b.size,
            quantity: 1,
        });

        mockAuthAs(user.id);

        // Act + Assert
        await expect(
            placeOrder(address as ShippingAddress, cart.id)
        ).rejects.toThrow(/Invalid product, variant, or size combination/);

        // 検証前段で throw するため Order は永続化されない
        expect(await db.order.count()).toBe(0);
    });
});
