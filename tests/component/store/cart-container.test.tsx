/** @jest-environment jsdom */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import CartContainer from "@/components/store/cart-page/container";
import { createMockCartProduct } from "@/config/test-fixtures";
import { useCartStore } from "@/cart-store/useCartStore";
import { updateCartWithLatest } from "@/queries/user";
import type { CartProductType } from "@/lib/types";

/**
 * カートページのオーケストレーション
 * （`src/components/store/cart-page/container.tsx`）の検証。
 *
 * このコンテナは「localStorage 由来のカートを、サーバー上の最新の在庫・価格・送料で
 * 引き直してから表示する」責務を持つ。引き直しが走らないと、ユーザーは在庫切れや
 * 旧価格のまま Checkout へ進む。lcov 0%・分岐 18 の未カバー面だった。
 *
 * 子コンポーネントは stub 化し、検証対象を**このコンテナの配線**に限定する
 * （CartProduct 自体は cart-product.test.tsx、集計は cart-summary.test.tsx の担当）。
 */

jest.mock("@/cart-store/useCartStore");
jest.mock("@/queries/user", () => ({
    updateCartWithLatest: jest.fn(),
}));
jest.mock("@/components/store/cart-page/cart-header", () => ({
    __esModule: true,
    default: ({ cartItems }: { cartItems: CartProductType[] }) => (
        <div data-testid="cart-header">{cartItems.length}</div>
    ),
}));
jest.mock("@/components/store/cards/cart-product", () => ({
    __esModule: true,
    default: ({ product }: { product: CartProductType }) => (
        <div data-testid="cart-product">{product.variantId}</div>
    ),
}));
jest.mock("@/components/store/cart-page/summary", () => ({
    __esModule: true,
    default: ({
        cartItems,
        shippingFees,
    }: {
        cartItems: CartProductType[];
        shippingFees: number;
    }) => (
        <div data-testid="cart-summary">
            {cartItems.length}:{shippingFees}
        </div>
    ),
}));
jest.mock("@/components/store/cart-page/empty-cart", () => ({
    __esModule: true,
    default: () => <div data-testid="empty-cart">EmptyCart</div>,
}));
jest.mock("@/components/store/cards/fast-delivery", () => ({
    __esModule: true,
    default: () => <div>FastDelivery</div>,
}));
jest.mock(
    "@/components/store/product-page/returns-security-privacy-card",
    () => ({
        SecurityPrivacyCard: () => <div>SecurityPrivacyCard</div>,
    })
);
jest.mock("@/components/store/shared/country-note", () => ({
    __esModule: true,
    default: ({ country }: { country: string }) => (
        <div data-testid="country-note">{country}</div>
    ),
}));

describe("CartContainer", () => {
    const mockSetCart = jest.fn();
    const userCountry = {
        name: "Japan",
        code: "JP",
        city: "Tokyo",
        region: "Kanto",
    };

    /**
     * useCartStore は 2 通りの呼ばれ方をする:
     *   - `useFromStore(useCartStore, (s) => s.cart)` 経由（カート本体の読み出し）
     *   - `useCartStore((s) => s.setCart)` 直接（更新関数の取得）
     * どちらも同じセレクタ機構なので、1 つの state を渡す実装で両方を満たす。
     */
    const mockStoreWith = (cart: CartProductType[]) => {
        (useCartStore as unknown as jest.Mock).mockImplementation(
            (
                selector: (state: {
                    cart: CartProductType[];
                    setCart: typeof mockSetCart;
                }) => unknown
            ) => selector({ cart, setCart: mockSetCart })
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const items = [
        createMockCartProduct({ variantId: "variant-1" }),
        createMockCartProduct({ variantId: "variant-2" }),
    ];

    it("renders the empty state when the cart has no items", () => {
        // Arrange
        mockStoreWith([]);

        // Act
        render(<CartContainer userCountry={userCountry} />);

        // Assert
        expect(screen.getByTestId("empty-cart")).toBeInTheDocument();
        expect(screen.queryByTestId("cart-summary")).not.toBeInTheDocument();
        // 空カートで引き直しても取得するものが無い
        expect(updateCartWithLatest).not.toHaveBeenCalled();
    });

    it("syncs the cart with the server and renders the items", async () => {
        // Arrange
        mockStoreWith(items);
        (updateCartWithLatest as jest.Mock).mockResolvedValue(items);

        // Act
        render(<CartContainer userCountry={userCountry} />);

        // Assert: サーバー同期が走り、その結果でストアが更新される。
        // ここが呼ばれないと、ユーザーは在庫切れや旧価格のまま Checkout へ進む。
        await waitFor(() => {
            expect(updateCartWithLatest).toHaveBeenCalledWith(items);
        });
        await waitFor(() => {
            expect(mockSetCart).toHaveBeenCalledWith(items);
        });

        // 同期完了で loading が解け、一覧と集計が描画される
        await waitFor(() => {
            expect(screen.getAllByTestId("cart-product")).toHaveLength(2);
        });
        expect(screen.getByTestId("cart-header")).toHaveTextContent("2");
        expect(screen.getByTestId("country-note")).toHaveTextContent("Japan");
    });

    it("passes the aggregated shipping total to the summary", async () => {
        // Arrange
        mockStoreWith(items);
        (updateCartWithLatest as jest.Mock).mockResolvedValue(items);

        // Act
        render(<CartContainer userCountry={userCountry} />);

        // Assert: 送料は CartProduct 群が setTotalShipping で積み上げる。
        // stub は積み上げないので初期値 0 のまま —— ここで固定するのは
        // 「集計値が summary へ渡る配線」であって送料計算そのものではない
        // （計算は shipping-utils.test.ts / shipping-fee.test.tsx の担当）。
        await waitFor(() => {
            expect(screen.getByTestId("cart-summary")).toHaveTextContent("2:0");
        });
    });

    it("stops the loading state when the sync fails", async () => {
        // Arrange
        const consoleSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});
        mockStoreWith(items);
        (updateCartWithLatest as jest.Mock).mockRejectedValue(
            new Error("sync boom")
        );

        // Act
        render(<CartContainer userCountry={userCountry} />);

        // Assert: 同期に失敗しても loading を解いて**ローカルのカートを表示する**。
        // ここで loading が解けないと、ユーザーは "loading..." に張り付いたまま
        // カートを操作できない。
        await waitFor(() => {
            expect(screen.getAllByTestId("cart-product")).toHaveLength(2);
        });
        expect(mockSetCart).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith(
            "Failed to sync cart",
            expect.any(Error)
        );
        consoleSpy.mockRestore();
    });
});
