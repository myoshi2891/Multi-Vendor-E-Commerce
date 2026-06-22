/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import SupportForm from "./support-form";
import { createSupportTicket } from "@/queries/support";

// server action をモック（コンポーネント単体検証）
jest.mock("@/queries/support", () => ({
    createSupportTicket: jest.fn(),
}));

const mockCreate = createSupportTicket as jest.Mock;

describe("SupportForm", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCreate.mockResolvedValue({ id: "ticket-1" });
    });

    // T-SF5 / AC-SF5
    it("必須未入力で submit するとエラーを表示し createSupportTicket を呼ばない", async () => {
        // Arrange
        render(<SupportForm category="CONTACT" />);

        // Act — 何も入力せず送信
        fireEvent.click(screen.getByRole("button", { name: /送信|send/i }));

        // Assert — フィールド検証エラーが出て action は未呼び出し
        await waitFor(() => {
            expect(
                screen.getByText("お名前を入力してください。")
            ).toBeInTheDocument();
        });
        expect(mockCreate).not.toHaveBeenCalled();
    });

    // T-SF6 / AC-SF6
    it("連続 submit してもリエントランシーガードで1回だけ呼ばれる", async () => {
        // Arrange — 解決を遅延させて二重 submit を再現
        let resolveFn: (v: { id: string }) => void = () => {};
        mockCreate.mockImplementation(
            () =>
                new Promise<{ id: string }>((resolve) => {
                    resolveFn = resolve;
                })
        );
        render(<SupportForm category="CONTACT" />);

        fireEvent.change(screen.getByLabelText("お名前"), {
            target: { value: "山田太郎" },
        });
        fireEvent.change(screen.getByLabelText("メールアドレス"), {
            target: { value: "taro@example.com" },
        });
        fireEvent.change(screen.getByLabelText("件名"), {
            target: { value: "件名" },
        });
        fireEvent.change(screen.getByLabelText("内容"), {
            target: { value: "本文です。" },
        });

        // Act — 連続クリック
        const button = screen.getByRole("button", { name: /送信|send/i });
        fireEvent.click(button);
        fireEvent.click(button);

        await waitFor(() => {
            expect(mockCreate).toHaveBeenCalledTimes(1);
        });

        // 後始末（保留 promise を解決）
        resolveFn({ id: "ticket-1" });
    });
});
