/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import CartSummary from "@/components/store/cart-page/summary";
import { createMockCartProduct } from "@/config/test-fixtures";
import { saveUserCart } from "@/queries/user";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

/**
 * カート集計と保存（`src/components/store/cart-page/summary.tsx`）の検証。
 *
 * チェックアウト完了率はこのプロダクトの最重要 KPI（`.claude/steering/product.md`）だが、
 * 「表示された合計」と「Checkout 押下でサーバーへ保存 → /checkout へ遷移」の配線は
 * lcov 0% だった。保存に失敗したまま遷移すると、ユーザーは空のチェックアウトに着地する。
 */

jest.mock("@/queries/user", () => ({
    saveUserCart: jest.fn(),
}));
jest.mock("next/navigation", () => ({
    useRouter: jest.fn(),
}));
jest.mock("react-hot-toast", () => ({
    __esModule: true,
    default: {
        error: jest.fn(),
        success: jest.fn(),
    },
}));

describe("CartSummary", () => {
    const mockPush = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    });

    // 期待値はすべて手計算した定数。コンポーネントと同じ reduce で導出すると
    // 集計が一貫して間違っていても永久に緑になる（plan 010 が確立した原則）。
    const cartItems = [
        createMockCartProduct({ productId: "p-1", price: 10.5, quantity: 2 }), // 21.00
        createMockCartProduct({ productId: "p-2", price: 4.25, quantity: 4 }), // 17.00
    ];
    const SHIPPING_FEES = 7.5;
    const EXPECTED_SUBTOTAL = "$38.00"; // 21.00 + 17.00
    const EXPECTED_TOTAL = "$45.50"; // 38.00 + 7.50

    it("renders the subtotal and the total including shipping fees", () => {
        // Arrange + Act
        render(
            <CartSummary cartItems={cartItems} shippingFees={SHIPPING_FEES} />
        );

        // Assert
        expect(screen.getByText(EXPECTED_SUBTOTAL)).toBeInTheDocument();
        expect(
            screen.getByText(`+$${SHIPPING_FEES.toFixed(2)}`)
        ).toBeInTheDocument();
        expect(screen.getByTestId("cart-total")).toHaveTextContent(
            EXPECTED_TOTAL
        );
        // ボタンラベルは点数を出す（0 件と 2 件で表示が変わる導線）
        expect(screen.getByTestId("checkout")).toHaveTextContent(
            "Checkout (2)"
        );
    });

    it("saves the cart and navigates to /checkout on success", async () => {
        // Arrange
        (saveUserCart as jest.Mock).mockResolvedValue(true);
        render(
            <CartSummary cartItems={cartItems} shippingFees={SHIPPING_FEES} />
        );

        // Act
        fireEvent.click(screen.getByTestId("checkout"));

        // Assert
        await waitFor(() => {
            expect(saveUserCart).toHaveBeenCalledWith(cartItems);
        });
        await waitFor(() => {
            expect(mockPush).toHaveBeenCalledWith("/checkout");
        });
    });

    it("does not navigate when saving the cart rejects", async () => {
        // Arrange
        (saveUserCart as jest.Mock).mockRejectedValue(
            new Error("Unauthenticated.")
        );
        render(
            <CartSummary cartItems={cartItems} shippingFees={SHIPPING_FEES} />
        );

        // Act
        fireEvent.click(screen.getByTestId("checkout"));

        // Assert: 遷移しないことが本質。保存されていないのに /checkout へ送ると
        // ユーザーは空のチェックアウトに着地する。
        await waitFor(() => {
            expect(toast.error).toHaveBeenCalled();
        });
        expect(mockPush).not.toHaveBeenCalled();
    });

    it("does not navigate when saveUserCart resolves falsy", async () => {
        // Arrange: 実装は `if (res) router.push(...)` なので、reject しなくても
        // 偽値なら遷移しない。reject 系だけでは この分岐の false 側が未検証で残る。
        (saveUserCart as jest.Mock).mockResolvedValue(undefined);
        render(
            <CartSummary cartItems={cartItems} shippingFees={SHIPPING_FEES} />
        );

        // Act
        fireEvent.click(screen.getByTestId("checkout"));

        // Assert
        await waitFor(() => {
            expect(saveUserCart).toHaveBeenCalled();
        });
        expect(mockPush).not.toHaveBeenCalled();
        expect(toast.error).not.toHaveBeenCalled();
    });
});
