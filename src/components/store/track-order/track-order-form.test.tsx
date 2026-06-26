/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import TrackOrderForm from "@/components/store/track-order/track-order-form";
import { trackOrder } from "@/queries/order";

// trackOrder（server action）をモックし、フォーム単体の挙動を検証する。
jest.mock("@/queries/order", () => ({
    trackOrder: jest.fn(),
}));

// 結果表示が参照する一致時の trackOrder 戻り値（user は除去済みの形）。
const matchedResult = {
    id: "order-001",
    orderStatus: "Processing",
    paymentStatus: "Paid",
    groups: [
        {
            id: "group-001",
            shippingService: "Standard Shipping",
            shippingDeliveryMin: 3,
            shippingDeliveryMax: 5,
            store: { name: "Test Store", url: "test-store" },
            items: [
                {
                    id: "item-001",
                    name: "Test Product",
                    image: "https://example.com/p.jpg",
                    quantity: 2,
                    status: "Processing",
                },
            ],
        },
    ],
};

describe("TrackOrderForm", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("T-TO7: 未入力 submit でエラー表示・trackOrder を呼ばない", async () => {
        // Arrange
        render(<TrackOrderForm />);

        // Act: 何も入力せず送信
        fireEvent.click(screen.getByRole("button", { name: /追跡する/ }));

        // Assert: バリデーションエラーが出て、server action は呼ばれない
        await waitFor(() => {
            expect(
                screen.getByText("注文番号を入力してください。")
            ).toBeInTheDocument();
        });
        expect(trackOrder).not.toHaveBeenCalled();
    });

    it("T-TO8: 一致時に order/group/item ステータスが描画される", async () => {
        // Arrange
        (trackOrder as jest.Mock).mockResolvedValue(matchedResult);
        render(<TrackOrderForm />);

        // Act: 有効な入力で送信
        fireEvent.change(screen.getByPlaceholderText("注文番号"), {
            target: { value: "order-001" },
        });
        fireEvent.change(screen.getByPlaceholderText("メールアドレス"), {
            target: { value: "owner@example.com" },
        });
        fireEvent.click(screen.getByRole("button", { name: /追跡する/ }));

        // Assert: 結果領域に店舗名・商品名・ステータスが描画される
        await waitFor(() => {
            expect(trackOrder).toHaveBeenCalledWith({
                orderId: "order-001",
                email: "owner@example.com",
            });
        });
        expect(await screen.findByText("Test Store")).toBeInTheDocument();
        expect(screen.getByText("Test Product")).toBeInTheDocument();
        // 不一致メッセージは出ない
        expect(
            screen.queryByText("注文が見つかりませんでした。")
        ).not.toBeInTheDocument();
    });
});
