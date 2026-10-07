/** @jest-environment jsdom */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import NotificationList from "@/components/store/profile/notifications/notification-list";
import type { NotificationListItem } from "@/queries/notification";

jest.mock("next/link", () => ({
    __esModule: true,
    default: ({
        children,
        href,
        onClick,
        className,
    }: React.PropsWithChildren<{
        href: string;
        onClick?: () => void;
        className?: string;
    }>) => (
        <a
            href={href}
            className={className}
            onClick={(event) => {
                event.preventDefault();
                onClick?.();
            }}
        >
            {children}
        </a>
    ),
}));

const item = (
    over: Partial<NotificationListItem> = {}
): NotificationListItem => ({
    id: "n-1",
    title: "Your items have shipped",
    body: "Items from Acme in order-1 are on the way.",
    linkUrl: "/order/order-1",
    isRead: false,
    createdAt: "2026-10-07T00:00:00.000Z",
    ...over,
});

const setup = (
    items: NotificationListItem[],
    overrides: Partial<React.ComponentProps<typeof NotificationList>> = {}
) => {
    const markReadAction = jest.fn().mockResolvedValue({ count: 1 });
    const markAllReadAction = jest
        .fn()
        .mockResolvedValue({ count: items.length });
    render(
        <NotificationList
            initialItems={items}
            nextCursor={null}
            markReadAction={markReadAction}
            markAllReadAction={markAllReadAction}
            {...overrides}
        />
    );
    return { markReadAction, markAllReadAction, user: userEvent.setup() };
};

describe("NotificationList", () => {
    it("通知が無いときは空の状態を出し、一括既読ボタンを出さない", () => {
        // Act
        setup([]);

        // Assert
        expect(screen.getByText("No notifications yet.")).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Mark all as read" })
        ).not.toBeInTheDocument();
    });

    it("未読の通知に印を付け、リンク先へ飛べるようにする", () => {
        // Act
        setup([item(), item({ id: "n-2", isRead: true, title: "Delivered" })]);

        // Assert
        const unread = screen.getByRole("link", {
            name: /Your items have shipped/,
        });
        expect(unread).toHaveAttribute("href", "/order/order-1");
        expect(unread).toHaveTextContent("Unread");
        expect(
            screen.getByRole("link", { name: /Delivered/ })
        ).not.toHaveTextContent("Unread");
    });

    it("一括既読で印が消え、ボタンが無効になる", async () => {
        // Arrange
        const { markAllReadAction, user } = setup([item()]);

        // Act
        await user.click(
            screen.getByRole("button", { name: "Mark all as read" })
        );

        // Assert
        expect(markAllReadAction).toHaveBeenCalledTimes(1);
        await waitFor(() =>
            expect(screen.queryByText("Unread")).not.toBeInTheDocument()
        );
        expect(
            screen.getByRole("button", { name: "Mark all as read" })
        ).toBeDisabled();
    });

    it("一括既読が失敗したら印を残し、エラーを知らせる", async () => {
        // Arrange
        const consoleSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});
        const { user } = setup([item()], {
            markAllReadAction: jest
                .fn()
                .mockRejectedValue(new Error("db down")),
        });

        // Act
        await user.click(
            screen.getByRole("button", { name: "Mark all as read" })
        );

        // Assert
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Couldn't update notifications. Please try again."
        );
        expect(screen.getByText("Unread")).toBeInTheDocument();
        consoleSpy.mockRestore();
    });

    it("未読の通知を開くとその 1 件を既読にする（既読の通知では呼ばない）", async () => {
        // Arrange
        const { markReadAction, user } = setup([
            item(),
            item({ id: "n-2", isRead: true, title: "Delivered" }),
        ]);

        // Act
        await user.click(
            screen.getByRole("link", { name: /Your items have shipped/ })
        );
        await user.click(screen.getByRole("link", { name: /Delivered/ }));

        // Assert
        expect(markReadAction).toHaveBeenCalledTimes(1);
        expect(markReadAction).toHaveBeenCalledWith("n-1");
        await waitFor(() =>
            expect(screen.queryByText("Unread")).not.toBeInTheDocument()
        );
    });

    it("次のページがあれば、cursor 付きのリンクを出す", () => {
        // Act
        setup([item()], { nextCursor: "n-1" });

        // Assert
        expect(
            screen.getByRole("link", { name: "Older notifications" })
        ).toHaveAttribute("href", "/profile/notifications?cursor=n-1");
    });

    it("一覧が空でも次のページがあれば、古い通知へのリンクを出す", () => {
        // Act —— 未知の種別だけのページは items が空でも nextCursor が立つ
        setup([], { nextCursor: "n-9" });

        // Assert
        expect(screen.getByText("No notifications yet.")).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Older notifications" })
        ).toHaveAttribute("href", "/profile/notifications?cursor=n-9");
    });

    it("リンク先の無い未読の通知は、ボタンで 1 件ずつ既読にできる", async () => {
        // Arrange
        const { markReadAction, user } = setup([
            item({ linkUrl: null }),
            item({
                id: "n-2",
                linkUrl: null,
                isRead: true,
                title: "Delivered",
            }),
        ]);

        // Act
        await user.click(
            screen.getByRole("button", { name: /Your items have shipped/ })
        );

        // Assert
        expect(markReadAction).toHaveBeenCalledWith("n-1");
        await waitFor(() =>
            expect(screen.queryByText("Unread")).not.toBeInTheDocument()
        );
        // 既読の通知はボタンにしない
        expect(
            screen.queryByRole("button", { name: /Delivered/ })
        ).not.toBeInTheDocument();
    });

    it("リンク先の無い通知の既読化が失敗したら未読のまま残し、もう一度押せる", async () => {
        // Arrange
        const markReadAction = jest
            .fn()
            .mockRejectedValueOnce(new Error("db down"))
            .mockResolvedValueOnce({ count: 1 });
        const { user } = setup([item({ linkUrl: null })], { markReadAction });
        const errorSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => undefined);

        // Act
        await user.click(
            screen.getByRole("button", { name: /Your items have shipped/ })
        );

        // Assert —— 失敗しても印とボタンが残る
        await waitFor(() => expect(errorSpy).toHaveBeenCalled());
        expect(screen.getByText("Unread")).toBeInTheDocument();

        // Act —— 再試行は成功する
        await user.click(
            screen.getByRole("button", { name: /Your items have shipped/ })
        );

        // Assert
        expect(markReadAction).toHaveBeenCalledTimes(2);
        await waitFor(() =>
            expect(screen.queryByText("Unread")).not.toBeInTheDocument()
        );
        errorSpy.mockRestore();
    });
});
