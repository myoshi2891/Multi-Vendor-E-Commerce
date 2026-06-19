/** @jest-environment jsdom */
import React from "react";
import {
    render,
    screen,
    fireEvent,
    act,
    waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import SellerMessagesContainer from "./seller-messages-container";
import {
    getConversationMessages,
    markConversationRead,
} from "@/queries/message";
import { StoreConversationWithLatest } from "@/lib/types";

jest.mock("@/queries/message", () => ({
    getConversationMessages: jest.fn(),
    markConversationRead: jest.fn(),
}));

// next/image を素の img に差し替え（jsdom で next 最適化を回避）
jest.mock("next/image", () => ({
    __esModule: true,
    default: (props: { src: string; alt: string }) => (
        <img src={props.src} alt={props.alt} />
    ),
}));

// 子スレッドはモックし、渡された conversation / messages / onSent を観測する
jest.mock("@/components/store/profile/messages/conversation-thread", () => ({
    __esModule: true,
    default: ({
        conversation,
        messages,
        onSent,
    }: {
        conversation: { id: string } | null;
        messages: { id: string }[];
        onSent: () => void;
    }) => (
        <div data-testid="thread">
            <span data-testid="selected-id">{conversation?.id ?? "none"}</span>
            <span data-testid="message-count">{messages.length}</span>
            <button data-testid="trigger-sent" onClick={() => onSent()}>
                sent
            </button>
        </div>
    ),
}));

// 販売者一覧は store(自店舗) ではなく購入者(user) で会話を識別する
const conversations = [
    {
        id: "conv-1",
        userId: "user-buyer-1",
        storeId: "store-1",
        store: { id: "store-1", name: "Acme Store", logo: "", url: "acme" },
        user: { id: "user-buyer-1", name: "Alice Buyer", picture: "" },
        messages: [{ id: "m0", content: "latest preview" }],
    },
    {
        id: "conv-2",
        userId: "user-buyer-2",
        storeId: "store-1",
        store: { id: "store-1", name: "Acme Store", logo: "", url: "acme" },
        user: { id: "user-buyer-2", name: "Bob Buyer", picture: "" },
        messages: [],
    },
] as unknown as StoreConversationWithLatest[];

describe("SellerMessagesContainer", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getConversationMessages as jest.Mock).mockResolvedValue([]);
        (markConversationRead as jest.Mock).mockResolvedValue({ count: 0 });
    });

    it("renders the conversation list identified by buyer name", () => {
        render(
            <SellerMessagesContainer initialConversations={conversations} />
        );
        expect(screen.getByText("Alice Buyer")).toBeInTheDocument();
        expect(screen.getByText("Bob Buyer")).toBeInTheDocument();
        expect(screen.getByText("latest preview")).toBeInTheDocument();
    });

    it("shows an empty state when there are no conversations", () => {
        render(<SellerMessagesContainer initialConversations={[]} />);
        expect(screen.getByText(/no conversations yet/i)).toBeInTheDocument();
    });

    it("fetches messages and marks read when a conversation is selected", async () => {
        (getConversationMessages as jest.Mock).mockResolvedValue([
            { id: "m1" },
            { id: "m2" },
        ]);

        render(
            <SellerMessagesContainer initialConversations={conversations} />
        );

        await act(async () => {
            fireEvent.click(screen.getByText("Alice Buyer"));
        });

        await waitFor(() => {
            expect(getConversationMessages).toHaveBeenCalledWith("conv-1");
            expect(markConversationRead).toHaveBeenCalledWith("conv-1");
            expect(screen.getByTestId("selected-id")).toHaveTextContent(
                "conv-1"
            );
            expect(screen.getByTestId("message-count")).toHaveTextContent("2");
        });
    });

    it("re-polls every 5 seconds while a conversation is selected", async () => {
        jest.useFakeTimers();
        render(
            <SellerMessagesContainer initialConversations={conversations} />
        );

        await act(async () => {
            fireEvent.click(screen.getByText("Alice Buyer"));
        });
        expect(getConversationMessages).toHaveBeenCalledTimes(1);

        await act(async () => {
            await jest.advanceTimersByTimeAsync(5000);
        });
        expect(getConversationMessages).toHaveBeenCalledTimes(2);

        jest.useRealTimers();
    });

    it("skips polling while the tab is hidden (document.hidden)", async () => {
        jest.useFakeTimers();
        const hiddenSpy = jest
            .spyOn(document, "hidden", "get")
            .mockReturnValue(false);

        render(
            <SellerMessagesContainer initialConversations={conversations} />
        );
        await act(async () => {
            fireEvent.click(screen.getByText("Alice Buyer"));
        });
        expect(getConversationMessages).toHaveBeenCalledTimes(1);

        hiddenSpy.mockReturnValue(true);
        await act(async () => {
            await jest.advanceTimersByTimeAsync(5000);
        });
        expect(getConversationMessages).toHaveBeenCalledTimes(1);

        hiddenSpy.mockRestore();
        jest.useRealTimers();
    });

    it("refetches when the thread reports a successful reply", async () => {
        render(
            <SellerMessagesContainer initialConversations={conversations} />
        );

        await act(async () => {
            fireEvent.click(screen.getByText("Alice Buyer"));
        });
        await waitFor(() =>
            expect(getConversationMessages).toHaveBeenCalledTimes(1)
        );

        await act(async () => {
            fireEvent.click(screen.getByTestId("trigger-sent"));
        });
        await waitFor(() =>
            expect(getConversationMessages).toHaveBeenCalledTimes(2)
        );
    });

    it("logs a structured error when polling fails", async () => {
        const consoleSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});
        const error = new Error("fetch failed");
        (getConversationMessages as jest.Mock).mockRejectedValue(error);

        render(
            <SellerMessagesContainer initialConversations={conversations} />
        );
        await act(async () => {
            fireEvent.click(screen.getByText("Alice Buyer"));
        });

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith(
                "[SellerMessagesContainer:poll] Failed to fetch messages",
                error.message,
                error.stack
            );
        });
        consoleSpy.mockRestore();
    });
});
