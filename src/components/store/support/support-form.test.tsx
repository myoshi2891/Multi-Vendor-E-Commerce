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
        render(
            <SupportForm
                submitAction={createSupportTicket}
                category="CONTACT"
            />
        );

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
        render(
            <SupportForm
                submitAction={createSupportTicket}
                category="CONTACT"
            />
        );

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
        expect(await screen.findByRole("status")).toHaveTextContent(
            "受け付けました。"
        );
    });

    /** 有効入力を全フィールドに入力するヘルパー */
    const fillValid = () => {
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
    };

    // T-SF7 — 送信成功で受付メッセージ（<output> = role status）を表示する
    it("送信成功で受付メッセージを表示する", async () => {
        // Arrange
        render(
            <SupportForm
                submitAction={createSupportTicket}
                category="CONTACT"
            />
        );
        fillValid();

        // Act
        fireEvent.click(screen.getByRole("button", { name: /送信|send/i }));

        // Assert
        await waitFor(() => {
            expect(screen.getByRole("status")).toHaveTextContent(
                "受け付けました。"
            );
        });
        expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    // T-SF8 — server action が reject するとルートエラー（role alert）を表示する
    it("送信失敗時にエラーメッセージを alert で表示する", async () => {
        // Arrange
        mockCreate.mockRejectedValue(new Error("boom"));
        render(
            <SupportForm
                submitAction={createSupportTicket}
                category="CONTACT"
            />
        );
        fillValid();

        // Act
        fireEvent.click(screen.getByRole("button", { name: /送信|send/i }));

        // Assert
        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent("boom");
        });
    });

    // T-SF9 — category=RETURN_REQUEST から注文番号欄の表示を導出する
    it("category=RETURN_REQUEST で対象の注文番号欄を表示する", () => {
        // Arrange / Act
        render(
            <SupportForm
                submitAction={createSupportTicket}
                category="RETURN_REQUEST"
            />
        );

        // Assert
        expect(screen.getByLabelText("対象の注文番号")).toBeInTheDocument();
    });

    // T-SF10 — submitLabel でボタン文言を上書きする
    it("submitLabel でボタン文言を上書きする", () => {
        // Arrange / Act
        render(
            <SupportForm
                submitAction={createSupportTicket}
                category="CONTACT"
                submitLabel="送信する"
            />
        );

        // Assert
        expect(
            screen.getByRole("button", { name: "送信する" })
        ).toBeInTheDocument();
    });
    it("返品のブランドフォームは送信中を通知して入力をロックし、注文番号とカテゴリを送信する", async () => {
        let resolve!: (value: { id: string }) => void;
        mockCreate.mockImplementation(
            () =>
                new Promise((done) => {
                    resolve = done;
                })
        );
        render(
            <SupportForm
                submitAction={createSupportTicket}
                category="RETURN_REQUEST"
                appearance="brand"
            />
        );
        fillValid();
        fireEvent.change(screen.getByLabelText("対象の注文番号"), {
            target: { value: "123e4567-e89b-12d3-a456-426614174000" },
        });
        fireEvent.click(screen.getByRole("button", { name: "送信" }));
        expect(
            await screen.findByRole("button", { name: "送信中…" })
        ).toBeDisabled();
        for (const field of screen.getAllByRole("textbox"))
            expect(field).toBeDisabled();
        expect(mockCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                category: "RETURN_REQUEST",
                orderId: "123e4567-e89b-12d3-a456-426614174000",
            })
        );
        resolve({ id: "ticket-1" });
        expect(await screen.findByRole("status")).toHaveTextContent(
            "受け付けました。"
        );
    });

    it("返品申請の失敗後も入力を保持し再試行できる", async () => {
        mockCreate.mockRejectedValueOnce(new Error("送信に失敗しました。"));
        render(
            <SupportForm
                submitAction={createSupportTicket}
                category="RETURN_REQUEST"
                appearance="brand"
            />
        );
        fillValid();
        fireEvent.change(screen.getByLabelText("対象の注文番号"), {
            target: { value: "123e4567-e89b-12d3-a456-426614174000" },
        });
        fireEvent.click(screen.getByRole("button", { name: "送信" }));
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "送信に失敗しました。"
        );
        expect(screen.getByLabelText("対象の注文番号")).toHaveValue(
            "123e4567-e89b-12d3-a456-426614174000"
        );
        fireEvent.click(screen.getByRole("button", { name: "送信" }));
        expect(await screen.findByRole("status")).toHaveTextContent(
            "受け付けました。"
        );
    });
});
