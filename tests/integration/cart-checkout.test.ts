/**
 * @jest-environment jsdom
 */
/**
 * Cart → Checkout Integration Tests (B3)
 *
 * Cart ページと Checkout ページの間の状態橋渡しを実 DB + Zustand persist で検証する。
 *
 * 検証対象の境界:
 *   - Client-side Zustand cart-store (`src/cart-store/useCartStore.ts`) の persist
 *     ミドルウェアによる localStorage hydration
 *   - DB の Cart / CartItem / Coupon テーブル (testcontainers PostgreSQL)
 *   - Server actions (`applyCoupon` from `src/queries/coupon.ts`)
 *   - Checkout page の未認証時 redirect ロジック
 *
 * 設計判断: 本テストでは React Testing Library によるコンポーネント描画を**意図的に
 * 避ける**。理由は ADR-003 で報告されている jsdom + RTL + userEvent + waitFor の
 * CI flake を継承しないため。検証は state / DB / server-action の各層で行う。
 *
 * 関連:
 * - ADR-004: docs/architecture/decisions/004-integration-test-db-strategy.md
 * - ADR-003: docs/architecture/decisions/003-modal-setopen-sync-for-react19.md
 * - docs/testing/COVERAGE_REPORT.md §3 (B3 定義)
 * - src/lib/shipping-utils.ts (computeShippingTotal)
 */

// ----------------------------------------------------------------------------
// Mocks (must be declared before importing the modules they affect)
// ----------------------------------------------------------------------------

// Scenario 4 用: Clerk の currentUser をテストごとに差し替え可能にする
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

// Scenario 4 用: Next.js の redirect は通常 throw する設計 (NEXT_REDIRECT)。
// テストでは捕捉可能な Error を投げてアサーションする。
jest.mock("next/navigation", () => ({
    redirect: jest.fn((url: string) => {
        throw new Error(`NEXT_REDIRECT:${url}`);
    }),
}));

// CheckoutPage が cookies() を呼ぶため、空の cookie store を返すモック
jest.mock("next/headers", () => ({
    cookies: jest.fn().mockResolvedValue({
        get: jest.fn().mockReturnValue(undefined),
    }),
}));

// ----------------------------------------------------------------------------

import { Prisma, ShippingFeeMethod } from "@prisma/client";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { useCartStore } from "@/cart-store/useCartStore";
import { computeShippingTotal } from "@/lib/shipping-utils";
import type { CartProductType } from "@/lib/types";
import { applyCoupon } from "@/queries/coupon";
import { disconnectTestDb, getTestDb } from "./setup/db";
import { resetDb } from "./setup/reset-db";
import {
    seedCart,
    seedCartItem,
    seedCategoryWithSubcategory,
    seedCoupon,
    seedProductWithVariantAndSize,
    seedStore,
    seedUser,
} from "./setup/seed";

const db = getTestDb();

// ----------------------------------------------------------------------------
// Fixture builder
// ----------------------------------------------------------------------------

/**
 * CartProductType の全 21 フィールドを埋めた fixture を生成する。
 * Zustand store / saveUserCart に投入する形式。
 */
function buildCartProduct(
    overrides: Partial<CartProductType> = {}
): CartProductType {
    return {
        productId: "product-1",
        variantId: "variant-1",
        productSlug: "product-1",
        variantSlug: "variant-1",
        name: "Test Product",
        variantName: "Default Variant",
        image: "https://example.test/product.png",
        variantImage: "https://example.test/variant.png",
        sizeId: "size-1",
        size: "M",
        quantity: 1,
        price: 100,
        stock: 10,
        weight: 1,
        shippingMethod: "ITEM",
        shippingService: "Standard",
        shippingFee: 5,
        extraShippingFee: 2,
        deliveryTimeMin: 7,
        deliveryTimeMax: 14,
        isFreeShipping: false,
        ...overrides,
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

    // Zustand store と localStorage を毎回クリア
    localStorage.clear();
    useCartStore.setState({ cart: [], totalItems: 0, totalPrice: 0 });

    // mocks をリセット
    (currentUser as unknown as jest.Mock).mockReset();
    (redirect as unknown as jest.Mock).mockClear();
});

// ============================================================================
// Scenario 1: Zustand persist hydration
// ============================================================================

describe("Scenario 1: Zustand persist hydration", () => {
    it("hydrates cart, totalItems, totalPrice from localStorage on rehydrate", async () => {
        // Arrange: localStorage に Zustand persist 形式 ({ state, version }) で書き込む
        const fixture: CartProductType[] = [
            buildCartProduct({
                productId: "p1",
                variantId: "v1",
                sizeId: "s1",
                name: "Product A",
                price: 100,
                quantity: 2,
            }),
            buildCartProduct({
                productId: "p2",
                variantId: "v2",
                sizeId: "s2",
                name: "Product B",
                price: 50,
                quantity: 1,
            }),
        ];

        localStorage.setItem(
            "cart",
            JSON.stringify({
                state: {
                    cart: fixture,
                    totalItems: 2,
                    totalPrice: 250,
                },
                version: 0,
            })
        );

        // Act: rehydrate を強制実行 (通常はマウント時に自動だが、テストでは明示的に呼ぶ)
        await useCartStore.persist.rehydrate();

        // Assert
        const state = useCartStore.getState();
        expect(state.cart).toHaveLength(2);
        expect(state.cart[0].name).toBe("Product A");
        expect(state.cart[1].name).toBe("Product B");
        expect(state.totalItems).toBe(2);
        expect(state.totalPrice).toBe(250);
    });

    it("persists state changes back to localStorage when addToCart is called", async () => {
        // Arrange: 空の状態から開始
        expect(useCartStore.getState().cart).toHaveLength(0);

        // Act
        const product = buildCartProduct({
            productId: "p-new",
            variantId: "v-new",
            sizeId: "s-new",
            name: "New Product",
            price: 200,
            quantity: 3,
            stock: 5,
        });
        useCartStore.getState().addToCart(product);

        // Assert: store の state と localStorage の中身が一致
        const state = useCartStore.getState();
        expect(state.cart).toHaveLength(1);
        expect(state.totalPrice).toBe(600);

        const stored = JSON.parse(localStorage.getItem("cart") ?? "{}");
        expect(stored.state.cart).toHaveLength(1);
        expect(stored.state.cart[0].name).toBe("New Product");
    });
});

// ============================================================================
// Scenario 2: Shipping fee consistency across 3 methods (ITEM / WEIGHT / FIXED)
// ============================================================================

describe("Scenario 2: Shipping fee consistency", () => {
    /**
     * 各 ShippingFeeMethod について、computeShippingTotal の出力と DB に
     * 保存される CartItem.shippingFee が完全一致することを検証する。
     */
    it.each<{
        method: ShippingFeeMethod;
        baseFee: number;
        extraFee: number;
        weight: number;
        quantity: number;
    }>([
        { method: ShippingFeeMethod.ITEM, baseFee: 10, extraFee: 3, weight: 1, quantity: 3 },
        { method: ShippingFeeMethod.WEIGHT, baseFee: 5, extraFee: 0, weight: 2.5, quantity: 2 },
        { method: ShippingFeeMethod.FIXED, baseFee: 15, extraFee: 0, weight: 1, quantity: 4 },
    ])(
        "stores DB CartItem.shippingFee matching computeShippingTotal for method=$method",
        async ({ method, baseFee, extraFee, weight, quantity }) => {
            // Arrange: User → Store → Category → Product → Variant → Size を実 DB に seed
            const user = await seedUser(db);
            const store = await seedStore(db, { userId: user.id });
            const { category, subCategory } = await seedCategoryWithSubcategory(db);
            const { product, variant, size } = await seedProductWithVariantAndSize(db, {
                storeId: store.id,
                categoryId: category.id,
                subCategoryId: subCategory.id,
                shippingFeeMethod: method,
                weight,
                sizePrice: 100,
                sizeQuantity: quantity + 10, // 在庫余裕
            });

            // Act: computeShippingTotal で期待値を計算 → Cart + CartItem を seed
            const expectedShippingFee = computeShippingTotal(
                method,
                baseFee,
                extraFee,
                weight,
                quantity
            );

            const cart = await seedCart(db, { userId: user.id });
            await seedCartItem(db, {
                cartId: cart.id,
                storeId: store.id,
                product,
                variant,
                size,
                quantity,
                shippingFee: expectedShippingFee,
            });

            // Assert: DB から読み戻して shippingFee と totalPrice の整合性を検証
            const stored = await db.cart.findUniqueOrThrow({
                where: { id: cart.id },
                include: { cartItems: true },
            });

            expect(stored.cartItems).toHaveLength(1);
            const storedItem = stored.cartItems[0];

            // Decimal の比較は文字列または toNumber() 経由で
            expect(storedItem.shippingFee.toNumber()).toBeCloseTo(
                expectedShippingFee,
                2
            );

            // line total = unit price * qty + shipping fee
            const expectedLineTotal = new Prisma.Decimal(100)
                .mul(quantity)
                .add(expectedShippingFee);
            expect(storedItem.totalPrice.toNumber()).toBeCloseTo(
                expectedLineTotal.toNumber(),
                2
            );
        }
    );
});

// ============================================================================
// Scenario 3: Coupon application state transition (applyCoupon server action)
// ============================================================================

describe("Scenario 3: Coupon application", () => {
    /**
     * 共通の準備: User + 2 Store + 各 Store の Product + Variant + Size + Cart + CartItem
     */
    async function seedFullCheckoutState(): Promise<{
        userId: string;
        cartId: string;
        storeA: { id: string };
        storeB: { id: string };
    }> {
        const user = await seedUser(db);
        const { category, subCategory } = await seedCategoryWithSubcategory(db);

        const storeA = await seedStore(db, { userId: user.id });
        const productA = await seedProductWithVariantAndSize(db, {
            storeId: storeA.id,
            categoryId: category.id,
            subCategoryId: subCategory.id,
            sizePrice: 100,
        });

        const storeB = await seedStore(db, { userId: user.id });
        const productB = await seedProductWithVariantAndSize(db, {
            storeId: storeB.id,
            categoryId: category.id,
            subCategoryId: subCategory.id,
            sizePrice: 200,
        });

        const cart = await seedCart(db, {
            userId: user.id,
            subTotal: 300,
            shippingFees: 0,
            total: 300,
        });

        await seedCartItem(db, {
            cartId: cart.id,
            storeId: storeA.id,
            product: productA.product,
            variant: productA.variant,
            size: productA.size,
            quantity: 1,
            shippingFee: 0,
        });
        await seedCartItem(db, {
            cartId: cart.id,
            storeId: storeB.id,
            product: productB.product,
            variant: productB.variant,
            size: productB.size,
            quantity: 1,
            shippingFee: 0,
        });

        return { userId: user.id, cartId: cart.id, storeA, storeB };
    }

    it("applies a valid coupon, sets couponId, and reduces total by discount %", async () => {
        // Arrange
        const { cartId, storeA } = await seedFullCheckoutState();
        const coupon = await seedCoupon(db, {
            storeId: storeA.id,
            discount: 10, // 10%
            code: "SAVE10",
        });

        // Act
        const result = await applyCoupon(coupon.code, cartId);

        // Assert: 成功メッセージ + DB の coupon と total が更新
        expect(result.message).toContain("Coupon applied successfully");
        expect(result.message).toContain("-$10.00"); // storeA は $100 × 10% = $10

        const updatedCart = await db.cart.findUniqueOrThrow({
            where: { id: cartId },
        });
        expect(updatedCart.couponId).toBe(coupon.id);
        // total: 300 - 10 = 290
        expect(updatedCart.total.toNumber()).toBeCloseTo(290, 2);
    });

    it("rejects an invalid coupon code", async () => {
        const { cartId } = await seedFullCheckoutState();
        await expect(applyCoupon("NONEXISTENT", cartId)).rejects.toThrow(
            /Coupon not found/
        );
    });

    it("rejects an expired coupon (endDate in the past)", async () => {
        const { cartId, storeA } = await seedFullCheckoutState();
        const expired = await seedCoupon(db, {
            storeId: storeA.id,
            code: "EXPIRED",
            startDate: new Date("2020-01-01").toISOString(),
            endDate: new Date("2020-12-31").toISOString(),
        });

        await expect(applyCoupon(expired.code, cartId)).rejects.toThrow(
            /Coupon is not valid for this date/
        );
    });

    it("rejects a coupon when no cart items belong to the coupon's store", async () => {
        // Arrange: storeC を作って その coupon を適用しようとする (cart には storeA / storeB のみ)
        const { cartId } = await seedFullCheckoutState();
        const userC = await seedUser(db);
        const storeC = await seedStore(db, { userId: userC.id });
        const couponC = await seedCoupon(db, {
            storeId: storeC.id,
            code: "STOREC10",
        });

        await expect(applyCoupon(couponC.code, cartId)).rejects.toThrow(
            /No items in the cart belong to the store/
        );
    });

    it("rejects re-applying a coupon when one is already attached", async () => {
        const { cartId, storeA } = await seedFullCheckoutState();
        const couponA = await seedCoupon(db, {
            storeId: storeA.id,
            code: "FIRST",
        });
        await applyCoupon(couponA.code, cartId);

        const couponB = await seedCoupon(db, {
            storeId: storeA.id,
            code: "SECOND",
        });

        await expect(applyCoupon(couponB.code, cartId)).rejects.toThrow(
            /Coupon is already applied to this cart/
        );
    });
});

// ============================================================================
// Scenario 4: Checkout page unauth redirect
// ============================================================================

describe("Scenario 4: Unauth checkout redirects to /cart", () => {
    it("calls redirect('/cart') when currentUser returns null", async () => {
        // Arrange: currentUser を null に。CheckoutPage はその場合 redirect('/cart') を呼ぶ。
        (currentUser as unknown as jest.Mock).mockResolvedValue(null);

        // Dynamic import: CheckoutPage は default export
        const { default: CheckoutPage } = await import(
            "@/app/(store)/checkout/page"
        );

        // Act + Assert: redirect は throw する設計 (NEXT_REDIRECT:/cart)
        await expect(CheckoutPage()).rejects.toThrow(/NEXT_REDIRECT:\/cart/);
        expect(redirect).toHaveBeenCalledWith("/cart");
    });
});
