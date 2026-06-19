/** @jest-environment jsdom */
import React from "react";
import {
    render,
    screen,
    fireEvent,
    waitFor,
    act,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import ConversationThread from "./conversation-thread";
import { sendMessage } from "@/queries/message";
import { ConversationWithLatest, MessageType } from "@/lib/types";

// server action をモック
jest.mock("@/queries/message", () => ({
    sendMessage: jest.fn(),
}));

// toast をモック（送信失敗時の通知検証用）
jest.mock("react-hot-toast", () => ({
    __esModule: true,
    default: { success: jest.fn(), error: jest.fn() },
}));

const BUYER_ID = "user-buyer";
const SELLER_ID = "user-seller";

const conversation = {
    id: "conv-1",
    userId: BUYER_ID, // 購入者
    storeId: "store-1",
    store: { id: "store-1", name: "Acme", logo: "", url: "acme" },
    messages: [],
} as unknown as ConversationWithLatest;

const makeMessage = (
    overrides: Partial<MessageType> &
        Pick<MessageType, "id" | "senderId" | "content">
): MessageType =>
    ({
        conversationId: "conv-1",
        isRead: false,
        readAt: null,
        createdAt: new Date(),
        ...overrides,
    }) as unknown as MessageType;

describe("ConversationThread", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders a placeholder when no conversation is selected", () => {
        render(
            <ConversationThread
                conversation={null}
                messages={[]}
                onSent={jest.fn()}
            />
        );
        expect(screen.getByText(/select a conversation/i)).toBeInTheDocument();
    });

    it("renders an empty-state when the conversation has no messages", () => {
        render(
            <ConversationThread
                conversation={conversation}
                messages={[]}
                onSent={jest.fn()}
            />
        );
        expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
    });

    it("aligns buyer messages right and seller messages left", () => {
        const messages = [
            makeMessage({
                id: "m1",
                senderId: BUYER_ID,
                content: "from buyer",
            }),
            makeMessage({
                id: "m2",
                senderId: SELLER_ID,
                content: "from seller",
            }),
        ];
        render(
            <ConversationThread
                conversation={conversation}
                messages={messages}
                onSent={jest.fn()}
            />
        );

        // バブル内側の div の親（flex 行）の class で左右を判定
        const buyerRow = screen.getByText("from buyer").parentElement;
        const sellerRow = screen.getByText("from seller").parentElement;
        expect(buyerRow).toHaveClass("justify-end");
        expect(sellerRow).toHaveClass("justify-start");
    });

    it("sends a message and notifies the parent on success", async () => {
        (sendMessage as jest.Mock).mockResolvedValue({ id: "m-new" });
        const onSent = jest.fn();

        render(
            <ConversationThread
                conversation={conversation}
                messages={[]}
                onSent={onSent}
            />
        );

        await act(async () => {
            fireEvent.change(screen.getByPlaceholderText(/type a message/i), {
                target: { value: "hello seller" },
            });
        });
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /send/i }));
        });

        await waitFor(() => {
            expect(sendMessage).toHaveBeenCalledWith("conv-1", "hello seller");
            expect(onSent).toHaveBeenCalledTimes(1);
        });
    });

    it("does not send when the content is empty (Zod validation)", async () => {
        render(
            <ConversationThread
                conversation={conversation}
                messages={[]}
                onSent={jest.fn()}
            />
        );

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /send/i }));
        });

        await waitFor(() => {
            expect(
                screen.getByText(/メッセージを入力してください/)
            ).toBeInTheDocument();
        });
        expect(sendMessage).not.toHaveBeenCalled();
    });

    it("guards against duplicate sends via the reentrancy ref", async () => {
        // sendMessage を保留 Promise にして連続送信中の状態を作る
        let resolveSend: (v: { id: string }) => void = () => {};
        (sendMessage as jest.Mock).mockImplementation(
            () =>
                new Promise<{ id: string }>((resolve) => {
                    resolveSend = resolve;
                })
        );

        render(
            <ConversationThread
                conversation={conversation}
                messages={[]}
                onSent={jest.fn()}
            />
        );

        await act(async () => {
            fireEvent.change(screen.getByPlaceholderText(/type a message/i), {
                target: { value: "double click" },
            });
        });
        const button = screen.getByRole("button", { name: /send/i });
        await act(async () => {
            fireEvent.click(button);
            fireEvent.click(button);
        });

        await waitFor(() => {
            expect(sendMessage).toHaveBeenCalledTimes(1);
        });

        await act(async () => {
            resolveSend({ id: "m-new" });
        });
    });

    it("shows a toast and logs when sending fails", async () => {
        const toast = (await import("react-hot-toast")).default;
        const consoleSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});
        const error = new Error("network down");
        (sendMessage as jest.Mock).mockRejectedValue(error);

        render(
            <ConversationThread
                conversation={conversation}
                messages={[]}
                onSent={jest.fn()}
            />
        );

        await act(async () => {
            fireEvent.change(screen.getByPlaceholderText(/type a message/i), {
                target: { value: "will fail" },
            });
        });
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /send/i }));
        });

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(
                "メッセージの送信に失敗しました。"
            );
            expect(consoleSpy).toHaveBeenCalledWith(
                "[ConversationThread:handleSubmit] Failed to send message",
                error.message,
                error.stack
            );
        });
        consoleSpy.mockRestore();
    });
});
