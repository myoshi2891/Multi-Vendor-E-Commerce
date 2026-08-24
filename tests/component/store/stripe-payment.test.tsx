/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import StripePayment from "@/components/store/cards/payment/stripe/stripe-payment";
import {
    createStripePayment,
    createStripePaymentIntent,
} from "@/queries/stripe";
import { useElements, useStripe } from "@stripe/react-stripe-js";
import { useRouter } from "next/navigation";

/**
 * Stripe 決済フォーム（`.../payment/stripe/stripe-payment.tsx`）の配線検証。
 *
 * 検証しているのは **Stripe SDK の挙動ではなくコンポーネントの配線**である。
 * lcov 0%・分岐 35 の最大の未カバー面で、「いつ server action を呼ぶか」
 * 「失敗時に何を出すか」「どの経路で router.refresh() まで進むか」が回帰無検出だった。
 *
 * 金額・通貨の検証はサーバー権威（`createStripePayment` が paymentIntentId から
 * retrieve して照合する / plan 003・`4b13ce1`）なので、ここで固定するのは
 * 「渡す引数が `paymentIntent.id`（string）であること」だけである。
 */

jest.mock("@/queries/stripe", () => ({
    createStripePaymentIntent: jest.fn(),
    createStripePayment: jest.fn(),
}));
jest.mock("@stripe/react-stripe-js", () => ({
    useStripe: jest.fn(),
    useElements: jest.fn(),
    PaymentElement: () => <div data-testid="payment-element" />,
}));
jest.mock("next/navigation", () => ({
    useRouter: jest.fn(),
}));

describe("StripePayment", () => {
    const ORDER_ID = "order-001";
    const CLIENT_SECRET = "cs_test_123";
    const PAYMENT_INTENT_ID = "pi_123";

    const mockRefresh = jest.fn();
    const mockConfirmPayment = jest.fn();
    const mockElementsSubmit = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        (useRouter as jest.Mock).mockReturnValue({ refresh: mockRefresh });
        (useStripe as jest.Mock).mockReturnValue({
            confirmPayment: mockConfirmPayment,
        });
        (useElements as jest.Mock).mockReturnValue({
            submit: mockElementsSubmit,
        });
        (createStripePaymentIntent as jest.Mock).mockResolvedValue({
            clientSecret: CLIENT_SECRET,
        });
        mockElementsSubmit.mockResolvedValue({ error: undefined });
    });

    /** clientSecret 取得後の描画（フォーム表示）まで進める */
    const renderReady = async () => {
        render(<StripePayment orderId={ORDER_ID} />);
        await waitFor(() => {
            expect(screen.getByTestId("payment-element")).toBeInTheDocument();
        });
    };

    it("fetches the client secret on mount and renders the payment form", async () => {
        // Arrange + Act
        await renderReady();

        // Assert
        expect(createStripePaymentIntent).toHaveBeenCalledWith(ORDER_ID);
        expect(
            screen.getByRole("button", { name: "Pay Now" })
        ).toBeInTheDocument();
    });

    it("surfaces the error when the intent request fails instead of spinning forever", async () => {
        // Arrange
        (createStripePaymentIntent as jest.Mock).mockRejectedValue(
            new Error("intent boom")
        );

        // Act
        render(<StripePayment orderId={ORDER_ID} />);
        await waitFor(() => {
            expect(createStripePaymentIntent).toHaveBeenCalled();
        });

        // Assert: errorMessage はローダーガードより先に描画されるため、取得失敗は
        // 無限スピナーではなくメッセージとしてユーザーへ届く。
        await waitFor(() => {
            expect(screen.getByText("intent boom")).toBeInTheDocument();
        });
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
        expect(screen.queryByTestId("payment-element")).not.toBeInTheDocument();
    });

    it("surfaces elements.submit() validation errors without confirming payment", async () => {
        // Arrange
        await renderReady();
        mockElementsSubmit.mockResolvedValue({
            error: { message: "bad card" },
        });

        // Act
        fireEvent.click(screen.getByRole("button", { name: "Pay Now" }));

        // Assert
        await waitFor(() => {
            expect(screen.getByText("bad card")).toBeInTheDocument();
        });
        // 検証で弾かれた時点で決済に進まないことが本質
        expect(mockConfirmPayment).not.toHaveBeenCalled();
        expect(createStripePayment).not.toHaveBeenCalled();
    });

    it("persists the payment with the intent id and refreshes on success", async () => {
        // Arrange
        await renderReady();
        mockConfirmPayment.mockResolvedValue({
            error: undefined,
            paymentIntent: { id: PAYMENT_INTENT_ID, amount: 1000 },
        });
        (createStripePayment as jest.Mock).mockResolvedValue({
            paymentDetails: { paymentIntentId: PAYMENT_INTENT_ID },
        });

        // Act
        fireEvent.click(screen.getByRole("button", { name: "Pay Now" }));

        // Assert: 第 2 引数は intent オブジェクトではなく id（string）。
        // サーバー側が id から retrieve して amount/currency を権威検証するため、
        // クライアントは金額を渡さない。
        await waitFor(() => {
            expect(createStripePayment).toHaveBeenCalledWith(
                ORDER_ID,
                PAYMENT_INTENT_ID
            );
        });
        await waitFor(() => {
            expect(mockRefresh).toHaveBeenCalledTimes(1);
        });
    });

    it("does not persist the payment when confirmPayment returns an error", async () => {
        // Arrange
        await renderReady();
        mockConfirmPayment.mockResolvedValue({
            error: { message: "card declined" },
            paymentIntent: undefined,
        });

        // Act
        fireEvent.click(screen.getByRole("button", { name: "Pay Now" }));

        // Assert
        await waitFor(() => {
            expect(mockConfirmPayment).toHaveBeenCalled();
        });
        expect(createStripePayment).not.toHaveBeenCalled();
        expect(mockRefresh).not.toHaveBeenCalled();
    });

    it("shows 'Payment failed' and does not refresh when persistence returns no payment details", async () => {
        // Arrange: 実装は `if (!res.paymentDetails?.paymentIntentId) throw`。
        // 決済は Stripe 側で成立しているのに保存が欠けた状態で、ここを固定しないと
        // 「保存できていないのに画面だけ更新して支払い済みに見せる」回帰を検出できない。
        const consoleSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});
        await renderReady();
        mockConfirmPayment.mockResolvedValue({
            error: undefined,
            paymentIntent: { id: PAYMENT_INTENT_ID },
        });
        (createStripePayment as jest.Mock).mockResolvedValue({});

        // Act
        fireEvent.click(screen.getByRole("button", { name: "Pay Now" }));

        // Assert
        await waitFor(() => {
            expect(screen.getByText("Payment failed")).toBeInTheDocument();
        });
        expect(mockRefresh).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});
