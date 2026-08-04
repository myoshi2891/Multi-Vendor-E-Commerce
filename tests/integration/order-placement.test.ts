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
 *   - 在庫のアトミック減算 (条件付き updateMany による check-and-decrement) の実減算量
 *   - オーバーセルロールバック (減算時点で在庫不足 → $transaction 全体を巻き戻し部分確定なし)
 *   - PLATFORM クーポンの端数吸収 (最終グループが「総割引 − Σ確定済割引」を負担)
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

// Scenario 8 がカート検証後・在庫減算前に在庫を横取りするための seam。
// placeOrder は getDeliveryDetailsForStoreByCountry を「トランザクション外」で呼ぶ
// (src/queries/user.ts の "事前にdelivery詳細を全store分取得" ブロック) ため、
// ここに割り込めば TOCTOU レースを決定論的に再現できる。
// 既定は実装透過 (jest.fn が actual をそのまま呼ぶ) なので他シナリオに影響しない。
//
// factory 内はローカルの jest.requireActual のままにすること。jest.mock は import より
// 上へ巻き上げられるため、import した actualDeliveryDetails は factory 実行時点で未初期化。
jest.mock("@/queries/product", () => {
    const actual =
        jest.requireActual<typeof import("@/queries/product")>(
            "@/queries/product"
        );
    return {
        ...actual,
        getDeliveryDetailsForStoreByCountry: jest.fn(
            actual.getDeliveryDetailsForStoreByCountry
        ),
    };
});

// ----------------------------------------------------------------------------

import { Prisma, type ShippingAddress, type Store } from "@prisma/client";
import { currentUser } from "@clerk/nextjs/server";
import { computeShippingTotal } from "@/lib/shipping-utils";
import { getDeliveryDetailsForStoreByCountry } from "@/queries/product";
import { placeOrder } from "@/queries/user";
import { actualDeliveryDetails } from "./setup/query-mocks";
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

/** Scenario 8 の割り込み用。実関数のシグネチャを保った型付きモック */
const mockedDelivery =
    getDeliveryDetailsForStoreByCountry as jest.MockedFunction<
        typeof getDeliveryDetailsForStoreByCountry
    >;

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

afterEach(() => {
    // mockClear() では mockImplementationOnce のキューが残るため mockReset() で実装ごと消し、
    // 透過実装を必ず張り直す (張り直さないと他シナリオが実装欠落で落ちる)。
    mockedDelivery.mockReset();
    mockedDelivery.mockImplementation(actualDeliveryDetails);
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

// ============================================================================
// Scenario 7: Atomic stock decrement — 減算後の Size.quantity を固定 (TESTS-05 前半)
// ============================================================================

describe("Scenario 7: atomic stock decrement", () => {
    it("decrements Size.quantity by the ordered quantity when stock is sufficient", async () => {
        // Arrange: 在庫 10 / カート数量 4 (キャップ非発動)
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
            quantity: 4,
        });

        mockAuthAs(user.id);

        // Act
        const { orderId } = await placeOrder(address as ShippingAddress, cart.id);

        // Assert: 発注数どおり減算されている (10 − 4 = 6)
        const decremented = await db.size.findUniqueOrThrow({
            where: { id: size.id },
        });
        expect(decremented.quantity).toBe(6);

        // 注文側の数量とも一致する (キャップが誤発動していないことの裏取り)
        const order = await db.order.findUniqueOrThrow({
            where: { id: orderId },
            include: { groups: { include: { items: true } } },
        });
        expect(order.groups[0].items[0].quantity).toBe(4);
    });
});

// ============================================================================
// Scenario 8: Oversell rollback — 減算時点で在庫不足なら全ロールバック (TESTS-05 後半)
// ============================================================================

describe("Scenario 8: oversell rollback", () => {
    it("rolls back the whole transaction when stock drops between validation and decrement", async () => {
        // Arrange: 在庫 5 / カート数量 5 → 検証時点ではキャップが効かず quantity 5 のまま通過する
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
                sizeQuantity: 5,
            }
        );
        const cart = await seedCart(db, { userId: user.id });
        await seedCartItem(db, {
            cartId: cart.id,
            storeId: store.id,
            product,
            variant,
            size,
            quantity: 5,
        });

        mockAuthAs(user.id);

        // カート検証 (キャップ) 通過後・$transaction の在庫減算前に、別トランザクションで
        // 在庫を 5 → 2 に減らす。これが実運用の「他ユーザーが先に買った」レースに相当する。
        mockedDelivery.mockImplementationOnce(async (storeId, countryId) => {
            await db.size.update({
                where: { id: size.id },
                data: { quantity: 2 },
            });
            return actualDeliveryDetails(storeId, countryId);
        });

        // Act + Assert: 条件付き updateMany が where quantity >= 5 に一致せず count === 0 → throw
        await expect(
            placeOrder(address as ShippingAddress, cart.id)
        ).rejects.toThrow("在庫が不足しています");

        // 割り込みが実際に発火したことを確認 (発火していなければテストは無意味)
        expect(mockedDelivery).toHaveBeenCalledTimes(1);

        // ロールバック検証 1: 注文リソースが 1 件も残っていない (部分確定なし)
        expect(await db.order.count()).toBe(0);
        expect(await db.orderGroup.count()).toBe(0);
        expect(await db.orderItem.count()).toBe(0);

        // ロールバック検証 2: 在庫は横取り後の 2 のまま (マイナス在庫にならない・二重減算もない)
        const afterRollback = await db.size.findUniqueOrThrow({
            where: { id: size.id },
        });
        expect(afterRollback.quantity).toBe(2);

        // ロールバック検証 3: カート消費 (冪等性ゲートの deleteMany) も巻き戻り再試行できる
        expect(await db.cart.count({ where: { id: cart.id } })).toBe(1);
    });
});

// ============================================================================
// Scenario 9: PLATFORM coupon remainder absorption (TESTS-08)
// ============================================================================

describe("Scenario 9: PLATFORM coupon remainder absorption", () => {
    it("applies the discount to every store group and lets the last group absorb the remainder", async () => {
        // Arrange: 2 店舗 ($33.33 / $66.67) + storeId なしの PLATFORM 10% クーポン。
        // storeId を null に固定するのがこのシナリオの識別力の要:
        // user.ts の判定は `isPlatformCoupon || (storeId === cartCoupon?.storeId && ...)` の
        // 論理和であり、クーポンに店舗を持たせると「STORE 一致の項で通っただけ」の可能性が
        // 残って PLATFORM 分岐を証明できない。null ならどの店舗とも一致しないため、
        // 割引が生じる経路が isPlatformCoupon に一意に絞られる。
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
            sizePrice: 33.33,
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
            sizePrice: 66.67,
        });

        const coupon = await seedCoupon(db, {
            storeId: null,
            scope: "PLATFORM",
            discount: 10,
            code: "PLATFORM10",
        });
        expect(coupon.scope).toBe("PLATFORM");
        expect(coupon.storeId).toBeNull();

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

        // 割引前のグループ合計 = 商品代 + 送料 (qty=1 の ITEM 方式は基本料 $10 のみ)。
        // 実装の割引基数 cartTotalPrice は item.totalPrice の合計 = 送料込みである点に注意。
        const shippingPerGroup = new Prisma.Decimal(DEFAULT_FEE_PER_ITEM);
        const grossByStore = new Map<string, Prisma.Decimal>([
            [storeA.id, new Prisma.Decimal("33.33").add(shippingPerGroup)], // 43.33
            [storeB.id, new Prisma.Decimal("66.67").add(shippingPerGroup)], // 76.67
        ]);
        const cartGross = new Prisma.Decimal("120.00");
        const expectedPlatformDiscount = cartGross.mul(10).div(100); // 12.00

        // Act
        const { orderId } = await placeOrder(address as ShippingAddress, cart.id);

        // Assert
        const order = await db.order.findUniqueOrThrow({
            where: { id: orderId },
            include: { groups: true },
        });
        expect(order.groups).toHaveLength(2);

        // 実装と同じ決定論的順序 (storeId の localeCompare 昇順) に並べ替える
        const sorted = [...order.groups].sort((x, y) =>
            x.storeId.localeCompare(y.storeId)
        );
        const leading = sorted.slice(0, -1);
        const last = sorted[sorted.length - 1];

        // 各グループの割引額は「割引前合計 − 保存された total」で逆算する
        const discountOf = (group: (typeof sorted)[number]): Prisma.Decimal => {
            const gross = grossByStore.get(group.storeId);
            if (!gross) throw new Error(`Unexpected storeId: ${group.storeId}`);
            return gross.sub(group.total);
        };

        // 1. PLATFORM 分岐の証明: storeId が null のクーポンなのに全グループへ適用されている
        for (const group of sorted) {
            expect(group.couponId).toBe(coupon.id);
            expect(discountOf(group).greaterThan(0)).toBe(true);
        }

        // 2. 非最終グループは素直な 10% (Decimal 文字列比較。toBeCloseTo は金額規約で禁止)
        for (const group of leading) {
            const gross = grossByStore.get(group.storeId)!;
            expect(discountOf(group).toFixed(2)).toBe(
                gross.mul(10).div(100).toFixed(2)
            );
        }

        // 3. 最終グループは残差 (総割引 − Σ 非最終グループ割引) を吸収する
        const leadingDiscount = leading.reduce(
            (acc, group) => acc.add(discountOf(group)),
            new Prisma.Decimal("0")
        );
        expect(discountOf(last).toFixed(2)).toBe(
            expectedPlatformDiscount.sub(leadingDiscount).toFixed(2)
        );

        // 4. 全グループ割引の合計がちょうど総割引 $12.00 (1 セントも漏れない)
        const totalDiscount = sorted.reduce(
            (acc, group) => acc.add(discountOf(group)),
            new Prisma.Decimal("0")
        );
        expect(totalDiscount.toFixed(2)).toBe("12.00");
        expect(expectedPlatformDiscount.toFixed(2)).toBe("12.00");

        // 5. Order レベル集計の整合: total = Σ グループ total、subTotal = total − 送料
        const groupTotalSum = sorted.reduce(
            (acc, group) => acc.add(group.total),
            new Prisma.Decimal("0")
        );
        expect(order.total.toFixed(2)).toBe(groupTotalSum.toFixed(2));
        expect(order.total.toFixed(2)).toBe("108.00"); // 120.00 − 12.00
        expect(order.shippingFees.toFixed(2)).toBe("20.00");
        expect(order.subTotal.toFixed(2)).toBe(
            order.total.sub(order.shippingFees).toFixed(2)
        );
    });
});
