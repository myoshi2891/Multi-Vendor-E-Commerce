/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import PaypalPayment from "@/components/store/cards/payment/paypal/paypal-payment";
import { capturePayPalPayment, createPayPalPayment } from "@/queries/paypal";
import { useRouter } from "next/navigation";

/**
 * PayPal 決済ボタン（`.../payment/paypal/paypal-payment.tsx`）の配線検証。
 *
 * 検証しているのは **SDK の挙動ではなくコンポーネントの配線**である:
 * createOrder が payment id を ref に退避し、onApprove がその id で capture を呼ぶ
 * という 2 ステップの受け渡しは、id が失われると capture が別注文を掴むか失敗する。
 * lcov 0% だった経路。
 */

/**
 * PayPalButtons の stub。
 *
 * 実 SDK は iframe を立てるため jsdom では動かない。createOrder / onApprove / onError の
 * 3 つの props を「押すと発火するボタン」として露出させ、コンポーネント側の配線だけを見る。
 * `Function` / `any` は使わない（`.claude/steering/tech.md`）。
 */
type PayPalButtonsStubProps = {
    createOrder: (
        data: Record<string, never>,
        actions: Record<string, never>
    ) => Promise<string>;
    onApprove: () => Promise<void>;
    onError: (err: unknown) => void;
};

jest.mock("@paypal/react-paypal-js", () => ({
    PayPalButtons: ({
        createOrder,
        onApprove,
        onError,
    }: PayPalButtonsStubProps) => (
        <div>
            <button onClick={() => void createOrder({}, {})}>pp-create</button>
            <button onClick={() => void onApprove()}>pp-approve</button>
            <button onClick={() => onError(new Error("pp boom"))}>
                pp-error
            </button>
        </div>
    ),
}));

jest.mock("@/queries/paypal", () => ({
    createPayPalPayment: jest.fn(),
    capturePayPalPayment: jest.fn(),
}));
jest.mock("next/navigation", () => ({
    useRouter: jest.fn(),
}));

describe("PaypalPayment", () => {
    const mockRefresh = jest.fn();
    const ORDER_ID = "order-001";
    const PAYPAL_PAYMENT_ID = "PAYPAL-ORDER-XYZ";

    beforeEach(() => {
        jest.clearAllMocks();
        (useRouter as jest.Mock).mockReturnValue({ refresh: mockRefresh });
    });

    it("creates a PayPal order for the given orderId", async () => {
        // Arrange
        (createPayPalPayment as jest.Mock).mockResolvedValue({
            id: PAYPAL_PAYMENT_ID,
        });
        render(<PaypalPayment orderId={ORDER_ID} />);

        // Act
        fireEvent.click(screen.getByText("pp-create"));

        // Assert
        await waitFor(() => {
            expect(createPayPalPayment).toHaveBeenCalledWith(ORDER_ID);
        });
    });

    it("captures using the payment id returned by createOrder, then refreshes", async () => {
        // Arrange
        (createPayPalPayment as jest.Mock).mockResolvedValue({
            id: PAYPAL_PAYMENT_ID,
        });
        (capturePayPalPayment as jest.Mock).mockResolvedValue({
            id: "CAPTURE-1",
        });
        render(<PaypalPayment orderId={ORDER_ID} />);

        // Act: create → approve の順。この順序が本テストの主題で、
        // approve だけを撃つと ref は空文字のままになる（次のテストで固定する）。
        fireEvent.click(screen.getByText("pp-create"));
        await waitFor(() => {
            expect(createPayPalPayment).toHaveBeenCalled();
        });
        fireEvent.click(screen.getByText("pp-approve"));

        // Assert: ref 経由で受け渡された payment id が capture に渡ること
        await waitFor(() => {
            expect(capturePayPalPayment).toHaveBeenCalledWith(
                ORDER_ID,
                PAYPAL_PAYMENT_ID
            );
        });
        await waitFor(() => {
            expect(mockRefresh).toHaveBeenCalledTimes(1);
        });
    });

    it("does not refresh when the capture response has no id", async () => {
        // Arrange: 実装は `if (captureResponse.id) router.refresh()`。
        // この false 側を固定しないと、capture が失敗しても画面を更新して
        // 「支払い済み」に見せてしまう回帰を検出できない。
        (createPayPalPayment as jest.Mock).mockResolvedValue({
            id: PAYPAL_PAYMENT_ID,
        });
        (capturePayPalPayment as jest.Mock).mockResolvedValue({});
        render(<PaypalPayment orderId={ORDER_ID} />);

        // Act
        fireEvent.click(screen.getByText("pp-create"));
        await waitFor(() => {
            expect(createPayPalPayment).toHaveBeenCalled();
        });
        fireEvent.click(screen.getByText("pp-approve"));

        // Assert
        await waitFor(() => {
            expect(capturePayPalPayment).toHaveBeenCalled();
        });
        expect(mockRefresh).not.toHaveBeenCalled();
    });

    it("logs the SDK error through onError", async () => {
        // Arrange
        const consoleSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});
        render(<PaypalPayment orderId={ORDER_ID} />);

        // Act
        fireEvent.click(screen.getByText("pp-error"));

        // Assert
        expect(consoleSpy).toHaveBeenCalledWith(
            "[PaypalPayment] PayPal Button Error:",
            expect.any(Error)
        );
        consoleSpy.mockRestore();
    });
});
