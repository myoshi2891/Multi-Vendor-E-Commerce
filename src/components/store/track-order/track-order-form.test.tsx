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
// ステータスは 3 タグで重複しない値にし、各タグの描画を一意に検証できるようにする。
const matchedResult = {
    id: "order-001",
    orderStatus: "Processing", // OrderStatusTag → "Processing"
    paymentStatus: "Paid", // PaymentStatusTag → "Paid"
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
                    status: "Shipped", // ProductStatusTag → "Shipped"
                },
            ],
        },
    ],
};

/** 有効な注文番号・メールを入力して送信する共通操作。 */
const fillAndSubmit = () => {
    fireEvent.change(screen.getByPlaceholderText("注文番号"), {
        target: { value: "order-001" },
    });
    fireEvent.change(screen.getByPlaceholderText("メールアドレス"), {
        target: { value: "owner@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /追跡する/ }));
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

    it("T-TO8: 一致時に order/group/item の各ステータスが描画される", async () => {
        // Arrange
        (trackOrder as jest.Mock).mockResolvedValue(matchedResult);
        render(<TrackOrderForm />);

        // Act: 有効な入力で送信
        fillAndSubmit();

        // Assert: server action が正しい引数で呼ばれる
        await waitFor(() => {
            expect(trackOrder).toHaveBeenCalledWith({
                orderId: "order-001",
                email: "owner@example.com",
            });
        });

        // Assert: 店舗名・商品名に加え、3 つの共有ステータスタグの文言が描画される
        expect(await screen.findByText("Test Store")).toBeInTheDocument();
        expect(screen.getByText("Test Product")).toBeInTheDocument();
        expect(screen.getByText("Processing")).toBeInTheDocument(); // OrderStatusTag
        expect(screen.getByText("Paid")).toBeInTheDocument(); // PaymentStatusTag
        expect(screen.getByText("Shipped")).toBeInTheDocument(); // ProductStatusTag

        // 不一致・失敗メッセージは出ない
        expect(
            screen.queryByText("注文が見つかりませんでした。")
        ).not.toBeInTheDocument();
        expect(
            screen.queryByText(
                "注文の照会に失敗しました。時間をおいて再度お試しください。"
            )
        ).not.toBeInTheDocument();
    });

    it("T-TO9: trackOrder が null を返すと not-found のみ表示し結果 UI を出さない", async () => {
        // Arrange: 不一致/不存在を表す null
        (trackOrder as jest.Mock).mockResolvedValue(null);
        render(<TrackOrderForm />);

        // Act
        fillAndSubmit();

        // Assert: 汎用の not-found メッセージのみ
        expect(
            await screen.findByText("注文が見つかりませんでした。")
        ).toBeInTheDocument();
        // 結果 UI（店舗名・結果セクション）は描画されない
        expect(screen.queryByText("Test Store")).not.toBeInTheDocument();
        expect(
            screen.queryByRole("region", { name: "注文追跡の結果" })
        ).not.toBeInTheDocument();
    });

    it("T-TO10: trackOrder が throw すると not-found ではなく再試行メッセージを表示する", async () => {
        // Arrange: 一過性のインフラ障害
        (trackOrder as jest.Mock).mockRejectedValue(new Error("DB down"));
        render(<TrackOrderForm />);

        // Act
        fillAndSubmit();

        // Assert: 汎用の再試行メッセージが出て、not-found は出ない
        expect(
            await screen.findByText(
                "注文の照会に失敗しました。時間をおいて再度お試しください。"
            )
        ).toBeInTheDocument();
        expect(
            screen.queryByText("注文が見つかりませんでした。")
        ).not.toBeInTheDocument();
        expect(screen.queryByText("Test Store")).not.toBeInTheDocument();
    });
});
