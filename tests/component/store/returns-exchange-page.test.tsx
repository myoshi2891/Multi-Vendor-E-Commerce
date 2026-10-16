/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ReturnsExchangePage from "@/app/(store)/returns-exchange/page";

jest.mock("@/queries/support", () => ({ createSupportTicket: jest.fn() }));
jest.mock("@/components/store/support/support-form", () => ({
    __esModule: true,
    default: ({
        category,
        submitLabel,
    }: {
        category: string;
        submitLabel: string;
    }) => <button data-category={category}>{submitLabel}</button>,
}));

const original = process.env.RETURN_WINDOW_DAYS_DEFAULT;
afterEach(() => {
    if (original === undefined) delete process.env.RETURN_WINDOW_DAYS_DEFAULT;
    else process.env.RETURN_WINDOW_DAYS_DEFAULT = original;
});

describe("/returns-exchange の文面（plan 088 Step 5・design §3）", () => {
    it("返品できる日数をプラットフォームの設定から描く", () => {
        // Arrange
        process.env.RETURN_WINDOW_DAYS_DEFAULT = "14";

        // Act
        render(<ReturnsExchangePage />);

        // Assert
        expect(
            screen.getByText(
                "返品期限: 標準は商品の到着予定日から 14 日以内（店舗により異なる場合があります。実際の期限は注文詳細に表示されます）"
            )
        ).toBeInTheDocument();
        expect(screen.queryByText(/30 日/)).not.toBeInTheDocument();
    });

    it("ログイン中の申請は注文詳細へ案内し、フォームは相談窓口として残す", () => {
        // Act
        render(<ReturnsExchangePage />);

        // Assert
        expect(
            screen.getByRole("link", { name: /ご注文履歴から返品を申請する/ })
        ).toHaveAttribute("href", "/profile/orders");
        expect(
            screen.getByRole("heading", { name: "返品・交換のご相談" })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "相談を送信する" })
        ).toHaveAttribute("data-category", "RETURN_REQUEST");
    });
});
