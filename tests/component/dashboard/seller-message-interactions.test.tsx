/** @jest-environment jsdom */
import React from "react";
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import MessagesContainer from "@/components/dashboard/seller/seller-messages-container";
import {
    createMockStoreConversationWithLatest,
    createMockMessageType,
} from "@/config/test-fixtures";
jest.mock("@/queries/message", () => ({
    getProfileConversations: jest.fn().mockResolvedValue([]),
    getProfileConversationMessages: jest.fn().mockResolvedValue([]),
    getConversationMessages: jest.fn().mockResolvedValue([]),
    markConversationRead: jest.fn().mockResolvedValue({ count: 0 }),
    sendMessage: jest.fn(),
}));
jest.mock("next/image", () => ({
    __esModule: true,
    default: ({ src, alt }: { src: string; alt: string }) => (
        <img src={src} alt={alt} />
    ),
}));
const conversations = ["Alice Buyer", "Bob Buyer"].map((name, i) =>
    createMockStoreConversationWithLatest({
        id: `conv-${i}`,
        userId: "buyer",
        store: { id: `store-${i}`, name, url: `store-${i}`, logo: "" },
        messages: [],
        user: { id: "buyer", name, picture: "" },
    })
);
const message = createMockMessageType({
    id: "msg-one",
    senderId: "seller",
    content: "Hello from the store",
});
function setup(extra = {}) {
    const actions = {
        loadConversationsAction: jest.fn().mockResolvedValue(conversations),
        loadMessagesAction: jest.fn().mockResolvedValue([message]),
        markReadAction: jest.fn().mockResolvedValue({ count: 0 }),
        sendMessageAction: jest.fn().mockResolvedValue({ id: "new-message" }),
    };
    const props = { initialConversations: conversations, ...actions, ...extra };
    const mounted = render(<MessagesContainer {...props} />);
    return { ...actions, ...mounted, user: userEvent.setup() };
}
afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});
it("renders branded heading and explicit conversation selection", async () => {
    const { user, loadMessagesAction, markReadAction } = setup();
    expect(
        screen.getByRole("heading", { name: "Messages", level: 1 })
    ).toBeVisible();
    await user.click(
        screen.getByRole("button", {
            name: "Open conversation with Alice Buyer",
        })
    );
    expect(await screen.findByText("Hello from the store")).toBeVisible();
    expect(loadMessagesAction).toHaveBeenCalledWith("conv-0");
    expect(markReadAction).toHaveBeenCalledWith("conv-0");
    expect(
        screen.getByRole("button", {
            name: "Open conversation with Alice Buyer",
        })
    ).toHaveAttribute("aria-pressed", "true");
});
it("handles an empty inbox and retries initial list failure", async () => {
    const { user, loadConversationsAction } = setup({
        initialConversations: [],
        initialError: true,
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
        "We couldn’t load your conversations"
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(loadConversationsAction).toHaveBeenCalledTimes(1);
    await screen.findByRole("button", {
        name: "Open conversation with Alice Buyer",
    });
});
it("shows the empty inbox without a duplicate mount lookup", () => {
    const { loadConversationsAction } = setup({ initialConversations: [] });
    expect(
        screen.getByRole("heading", { name: "No conversations yet" })
    ).toBeVisible();
    expect(loadConversationsAction).not.toHaveBeenCalled();
});
it("shows loading and generic thread failure with retry", async () => {
    let reject!: (error: Error) => void;
    const loadMessagesAction = jest
        .fn()
        .mockImplementationOnce(
            () =>
                new Promise((_, fail) => {
                    reject = fail;
                })
        )
        .mockResolvedValue([message]);
    const { user } = setup({ loadMessagesAction });
    await user.click(
        screen.getByRole("button", {
            name: "Open conversation with Alice Buyer",
        })
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading messages");
    await act(async () => reject(new Error("private details")));
    expect(screen.getByRole("alert")).toHaveTextContent(
        "We couldn’t load these messages"
    );
    await user.click(screen.getByRole("button", { name: "Retry messages" }));
    expect(await screen.findByText(message.content)).toBeVisible();
});
it("validates, locks sending, prevents duplicates and preserves draft after failure", async () => {
    let reject!: (error: Error) => void;
    const sendMessageAction = jest
        .fn()
        .mockImplementationOnce(
            () =>
                new Promise((_, fail) => {
                    reject = fail;
                })
        )
        .mockResolvedValue({ id: "new" });
    const { user, loadMessagesAction } = setup({ sendMessageAction });
    await user.click(
        screen.getByRole("button", {
            name: "Open conversation with Alice Buyer",
        })
    );
    await screen.findByText(message.content);
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
        "メッセージを入力してください"
    );
    const input = screen.getByRole("textbox", { name: "Your message" });
    await user.type(input, "  Thank you  ");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(input).toBeDisabled();
    expect(
        screen.getByRole("button", {
            name: "Open conversation with Bob Buyer",
        })
    ).toBeDisabled();
    await act(async () => {
        fireEvent.submit(screen.getByRole("form", { name: "Send a message" }));
    });
    expect(sendMessageAction).toHaveBeenCalledTimes(1);
    await act(async () => reject(new Error("private details")));
    expect(input).toHaveValue("  Thank you  ");
    expect(screen.getByRole("alert")).toHaveTextContent(
        "We couldn’t send your message"
    );
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(input).toHaveValue(""));
    expect(sendMessageAction).toHaveBeenLastCalledWith("conv-0", "Thank you");
    expect(loadMessagesAction.mock.calls.length).toBeGreaterThan(1);
});
it("preserves the thread and allows retry when marking read fails", async () => {
    const markReadAction = jest
        .fn()
        .mockRejectedValueOnce(new Error("private details"))
        .mockResolvedValue({ count: 1 });
    const { user } = setup({ markReadAction });
    await user.click(
        screen.getByRole("button", {
            name: "Open conversation with Alice Buyer",
        })
    );
    expect(await screen.findByText(message.content)).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
        "We couldn’t update the read status"
    );
    await user.click(screen.getByRole("button", { name: "Retry read status" }));
    await waitFor(() =>
        expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    );
});
it("polls every five seconds, pauses hidden tabs and cleans up on unmount", async () => {
    jest.useFakeTimers();
    const hidden = jest.spyOn(document, "hidden", "get").mockReturnValue(false);
    const { loadMessagesAction, unmount } = setup();
    await act(async () => {
        fireEvent.click(
            screen.getByRole("button", {
                name: "Open conversation with Alice Buyer",
            })
        );
    });
    expect(loadMessagesAction).toHaveBeenCalledTimes(1);
    await act(async () => {
        await jest.advanceTimersByTimeAsync(5000);
    });
    expect(loadMessagesAction).toHaveBeenCalledTimes(2);
    hidden.mockReturnValue(true);
    await act(async () => {
        await jest.advanceTimersByTimeAsync(5000);
    });
    expect(loadMessagesAction).toHaveBeenCalledTimes(2);
    unmount();
    hidden.mockReturnValue(false);
    await act(async () => {
        await jest.advanceTimersByTimeAsync(5000);
    });
    expect(loadMessagesAction).toHaveBeenCalledTimes(2);
});
it("discards stale responses and does not overlap polling requests", async () => {
    jest.useFakeTimers();
    let resolve!: (messages: unknown[]) => void;
    const loadMessagesAction = jest
        .fn()
        .mockImplementationOnce(
            () =>
                new Promise((done) => {
                    resolve = done;
                })
        )
        .mockResolvedValue([{ ...message, content: "Beta reply" }]);
    setup({ loadMessagesAction });
    await act(async () => {
        fireEvent.click(
            screen.getByRole("button", {
                name: "Open conversation with Alice Buyer",
            })
        );
    });
    await act(async () => {
        await jest.advanceTimersByTimeAsync(5000);
    });
    expect(loadMessagesAction).toHaveBeenCalledTimes(1);
    await act(async () => {
        fireEvent.click(
            screen.getByRole("button", {
                name: "Open conversation with Bob Buyer",
            })
        );
    });
    await act(async () => resolve([message]));
    expect(screen.getByText("Beta reply")).toBeVisible();
    expect(screen.queryByText(message.content)).not.toBeInTheDocument();
});

// Post-implementation checks for composer bounds and refresh during a pending poll.
it("rejects overlong messages without sending", async () => {
    const { user, sendMessageAction } = setup();
    await user.click(
        screen.getByRole("button", {
            name: "Open conversation with Alice Buyer",
        })
    );
    await screen.findByText(message.content);
    fireEvent.change(screen.getByRole("textbox", { name: "Your message" }), {
        target: { value: "x".repeat(2001) },
    });
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("alert")).toHaveTextContent("2000文字以内");
    expect(sendMessageAction).not.toHaveBeenCalled();
});
it("queues the post-send refresh behind an active background poll", async () => {
    jest.useFakeTimers();
    let resolve!: (value: unknown[]) => void;
    const loadMessagesAction = jest
        .fn()
        .mockResolvedValueOnce([message])
        .mockImplementationOnce(
            () =>
                new Promise((done) => {
                    resolve = done;
                })
        )
        .mockResolvedValue([{ ...message, content: "Latest after send" }]);
    const { sendMessageAction } = setup({ loadMessagesAction });
    await act(async () => {
        fireEvent.click(
            screen.getByRole("button", {
                name: "Open conversation with Alice Buyer",
            })
        );
    });
    await act(async () => {
        await jest.advanceTimersByTimeAsync(5000);
    });
    await act(async () => {
        fireEvent.change(
            screen.getByRole("textbox", { name: "Your message" }),
            { target: { value: "Thanks" } }
        );
        fireEvent.submit(screen.getByRole("form", { name: "Send a message" }));
    });
    expect(sendMessageAction).toHaveBeenCalledWith("conv-0", "Thanks");
    expect(loadMessagesAction).toHaveBeenCalledTimes(2);
    await act(async () => resolve([message]));
    expect(loadMessagesAction).toHaveBeenCalledTimes(3);
    expect(screen.getByText("Latest after send")).toBeVisible();
});
it("turns an initial server load failure into generic retry feedback", async () => {
    const { getProfileConversations } = await import("@/queries/message");
    (getProfileConversations as jest.Mock).mockRejectedValueOnce(
        new Error("private details")
    );
    const { default: Page } = await import(
        "@/app/(store)/profile/messages/page"
    );
    render(await Page());
    expect(screen.getByRole("alert")).toHaveTextContent(
        "We couldn’t load your conversations"
    );
    expect(screen.queryByText("private details")).not.toBeInTheDocument();
});

it("announces unread conversations and clears the indicator only after mark-read succeeds", async () => {
    const markReadAction = jest.fn().mockRejectedValueOnce(new Error("Fixture failure")).mockResolvedValue({ count: 1 });
    const { user } = setup({
        initialConversations: conversations.map(conversation => ({ ...conversation, unreadLatest: true })),
        markReadAction,
    });
    const open = screen.getByRole("button", { name: "Open conversation with Alice Buyer" });
    expect(open).toHaveAccessibleDescription("Unread");
    await user.click(open);
    await screen.findByRole("button", { name: "Retry read status" });
    expect(open).toHaveAccessibleDescription("Unread");
    await user.click(screen.getByRole("button", { name: "Retry read status" }));
    await waitFor(() => expect(open).not.toHaveAccessibleDescription("Unread"));
});
