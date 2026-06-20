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
import MessagesContainer from "./messages-container";
import {
    getConversationMessages,
    markConversationRead,
} from "@/queries/message";
import {
    createMockConversationWithLatest,
    createMockMessageType,
} from "@/config/test-fixtures";

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
jest.mock("./conversation-thread", () => ({
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

const conversations = [
    createMockConversationWithLatest({
        id: "conv-1",
        userId: "user-buyer",
        storeId: "store-1",
        store: { id: "store-1", name: "Acme Store", logo: "", url: "acme" },
        messages: [
            createMockMessageType({ id: "m0", content: "latest preview" }),
        ],
    }),
    createMockConversationWithLatest({
        id: "conv-2",
        userId: "user-buyer",
        storeId: "store-2",
        store: { id: "store-2", name: "Beta Store", logo: "", url: "beta" },
        messages: [],
    }),
];

describe("MessagesContainer", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getConversationMessages as jest.Mock).mockResolvedValue([]);
        (markConversationRead as jest.Mock).mockResolvedValue({ count: 0 });
    });

    it("renders the conversation list from initial props", () => {
        render(<MessagesContainer initialConversations={conversations} />);
        expect(screen.getByText("Acme Store")).toBeInTheDocument();
        expect(screen.getByText("Beta Store")).toBeInTheDocument();
        expect(screen.getByText("latest preview")).toBeInTheDocument();
    });

    it("shows an empty state when there are no conversations", () => {
        render(<MessagesContainer initialConversations={[]} />);
        expect(screen.getByText(/no conversations yet/i)).toBeInTheDocument();
    });

    it("fetches messages and marks read when a conversation is selected", async () => {
        (getConversationMessages as jest.Mock).mockResolvedValue([
            { id: "m1" },
            { id: "m2" },
        ]);

        render(<MessagesContainer initialConversations={conversations} />);

        await act(async () => {
            fireEvent.click(screen.getByText("Acme Store"));
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
        render(<MessagesContainer initialConversations={conversations} />);

        await act(async () => {
            fireEvent.click(screen.getByText("Acme Store"));
        });
        // 選択時の初回フェッチ
        expect(getConversationMessages).toHaveBeenCalledTimes(1);

        // 5 秒進めると 2 回目のポーリング
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

        render(<MessagesContainer initialConversations={conversations} />);
        await act(async () => {
            fireEvent.click(screen.getByText("Acme Store"));
        });
        expect(getConversationMessages).toHaveBeenCalledTimes(1);

        // タブを背面化 → interval の poll は早期 return
        hiddenSpy.mockReturnValue(true);
        await act(async () => {
            await jest.advanceTimersByTimeAsync(5000);
        });
        expect(getConversationMessages).toHaveBeenCalledTimes(1);

        hiddenSpy.mockRestore();
        jest.useRealTimers();
    });

    it("refetches when the thread reports a successful send", async () => {
        render(<MessagesContainer initialConversations={conversations} />);

        await act(async () => {
            fireEvent.click(screen.getByText("Acme Store"));
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

        render(<MessagesContainer initialConversations={conversations} />);
        await act(async () => {
            fireEvent.click(screen.getByText("Acme Store"));
        });

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith(
                "[MessagesContainer:poll] Failed to fetch messages",
                error.message,
                error.stack
            );
        });
        consoleSpy.mockRestore();
    });

    it("renders the store logo as an avatar image when present", () => {
        const withLogo = [
            createMockConversationWithLatest({
                id: "conv-logo",
                userId: "user-buyer",
                storeId: "store-9",
                store: {
                    id: "store-9",
                    name: "Logo Store",
                    logo: "https://cdn.example/logo.png",
                    url: "logo",
                },
                messages: [],
            }),
        ];
        render(<MessagesContainer initialConversations={withLogo} />);

        const avatar = screen.getByRole("img", { name: "Logo Store" });
        expect(avatar).toHaveAttribute(
            "src",
            "https://cdn.example/logo.png"
        );
    });

    it("logs the unknown branch when polling rejects a non-Error", async () => {
        const consoleSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});
        (getConversationMessages as jest.Mock).mockRejectedValue("boom");

        render(<MessagesContainer initialConversations={conversations} />);
        await act(async () => {
            fireEvent.click(screen.getByText("Acme Store"));
        });

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith(
                "[MessagesContainer:poll] Unknown error",
                "boom"
            );
        });
        consoleSpy.mockRestore();
    });

    it("logs a structured error when markConversationRead fails (Error)", async () => {
        const consoleSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});
        const error = new Error("mark fail");
        (markConversationRead as jest.Mock).mockRejectedValue(error);

        render(<MessagesContainer initialConversations={conversations} />);
        await act(async () => {
            fireEvent.click(screen.getByText("Acme Store"));
        });

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith(
                "[MessagesContainer:markRead] Failed to mark as read",
                error.message,
                error.stack
            );
        });
        consoleSpy.mockRestore();
    });

    it("logs the unknown branch when markConversationRead rejects a non-Error", async () => {
        const consoleSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});
        (markConversationRead as jest.Mock).mockRejectedValue("mboom");

        render(<MessagesContainer initialConversations={conversations} />);
        await act(async () => {
            fireEvent.click(screen.getByText("Acme Store"));
        });

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith(
                "[MessagesContainer:markRead] Unknown error",
                "mboom"
            );
        });
        consoleSpy.mockRestore();
    });

    it("logs a structured error when the send refetch fails (Error)", async () => {
        const consoleSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});

        render(<MessagesContainer initialConversations={conversations} />);
        await act(async () => {
            fireEvent.click(screen.getByText("Acme Store"));
        });

        const error = new Error("refetch fail");
        (getConversationMessages as jest.Mock).mockRejectedValue(error);
        await act(async () => {
            fireEvent.click(screen.getByTestId("trigger-sent"));
        });

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith(
                "[MessagesContainer:handleSent] Failed to refetch",
                error.message,
                error.stack
            );
        });
        consoleSpy.mockRestore();
    });

    it("logs the unknown branch when the send refetch rejects a non-Error", async () => {
        const consoleSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});

        render(<MessagesContainer initialConversations={conversations} />);
        await act(async () => {
            fireEvent.click(screen.getByText("Acme Store"));
        });

        (getConversationMessages as jest.Mock).mockRejectedValue("hboom");
        await act(async () => {
            fireEvent.click(screen.getByTestId("trigger-sent"));
        });

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith(
                "[MessagesContainer:handleSent] Unknown error",
                "hboom"
            );
        });
        consoleSpy.mockRestore();
    });

    it("is a no-op when re-clicking the already-selected conversation", async () => {
        render(<MessagesContainer initialConversations={conversations} />);
        await act(async () => {
            fireEvent.click(screen.getByText("Acme Store"));
        });
        await waitFor(() =>
            expect(getConversationMessages).toHaveBeenCalledTimes(1)
        );

        // 同一会話を再クリック → selectConversation は早期 return（再フェッチしない）
        await act(async () => {
            fireEvent.click(screen.getByText("Acme Store"));
        });
        expect(getConversationMessages).toHaveBeenCalledTimes(1);
    });

    it("ignores a send event while no conversation is selected", async () => {
        render(<MessagesContainer initialConversations={conversations} />);

        // 未選択のまま送信通知 → handleSent は selectedId なしで早期 return
        await act(async () => {
            fireEvent.click(screen.getByTestId("trigger-sent"));
        });
        expect(getConversationMessages).not.toHaveBeenCalled();
    });

    it("skips an overlapping poll while a previous poll is still in flight", async () => {
        jest.useFakeTimers();
        // ポーリングを解決させず in-flight を維持する（次の interval が早期 return する）
        (getConversationMessages as jest.Mock).mockReturnValue(
            new Promise<never>(() => {})
        );

        render(<MessagesContainer initialConversations={conversations} />);
        await act(async () => {
            fireEvent.click(screen.getByText("Acme Store"));
        });
        expect(getConversationMessages).toHaveBeenCalledTimes(1);

        // 5 秒進めても前回ポーリングが in-flight のため 2 回目は早期 return（呼ばれない）
        await act(async () => {
            await jest.advanceTimersByTimeAsync(5000);
        });
        expect(getConversationMessages).toHaveBeenCalledTimes(1);

        jest.useRealTimers();
    });

    it("does not apply poll results after unmount (cancelled guard)", async () => {
        let resolvePoll: ((v: { id: string }[]) => void) | undefined;
        (getConversationMessages as jest.Mock).mockReturnValue(
            new Promise<{ id: string }[]>((resolve) => {
                resolvePoll = resolve;
            })
        );

        const { unmount } = render(
            <MessagesContainer initialConversations={conversations} />
        );
        await act(async () => {
            fireEvent.click(screen.getByText("Acme Store"));
        });
        expect(getConversationMessages).toHaveBeenCalledTimes(1);

        // アンマウント後に in-flight だったポーリングが解決 → cancelled で setMessages されない
        unmount();
        await act(async () => {
            resolvePoll?.([{ id: "late" }]);
        });
        // act 警告（unmount 後の state 更新）なく完了すれば cancelled ガードが機能している
    });

    it("discards a stale send-refetch when the conversation changed mid-flight", async () => {
        // conv-1 選択 → 送信 refetch を保留 → conv-2 へ切替 → 保留 refetch が解決しても
        // requestedId(conv-1) !== 現在選択(conv-2) なので破棄される（取り違え防止のレースガード）
        let resolveStale: ((v: { id: string }[]) => void) | undefined;
        (getConversationMessages as jest.Mock)
            .mockResolvedValueOnce([]) // conv-1 初回ポーリング
            .mockImplementationOnce(
                () =>
                    new Promise<{ id: string }[]>((resolve) => {
                        resolveStale = resolve;
                    })
            ) // 送信 refetch（保留）
            .mockResolvedValue([{ id: "fresh-1" }, { id: "fresh-2" }]); // conv-2 ポーリング

        render(<MessagesContainer initialConversations={conversations} />);
        await act(async () => {
            fireEvent.click(screen.getByText("Acme Store"));
        });

        // 送信 refetch を起動（保留状態のまま）
        await act(async () => {
            fireEvent.click(screen.getByTestId("trigger-sent"));
        });

        // 別会話へ切替（selectedIdRef が conv-2 になる）
        await act(async () => {
            fireEvent.click(screen.getByText("Beta Store"));
        });
        await waitFor(() =>
            expect(screen.getByTestId("selected-id")).toHaveTextContent(
                "conv-2"
            )
        );

        // 保留中だった conv-1 の refetch を遅延解決 → 古い結果なので破棄される
        await act(async () => {
            resolveStale?.([{ id: "stale-1" }]);
        });

        // conv-2 のポーリング結果（2件）のまま。stale の 1 件で上書きされていない
        await waitFor(() =>
            expect(screen.getByTestId("message-count")).toHaveTextContent("2")
        );
    });
});
