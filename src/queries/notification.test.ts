import { currentUser } from "@clerk/nextjs/server";
import {
    getMyNotifications,
    getUnreadNotificationCount,
    markAllNotificationsRead,
    markNotificationRead,
} from "./notification";

jest.mock("@clerk/nextjs/server", () => ({ currentUser: jest.fn() }));

jest.mock("@/lib/db", () => ({
    db: {
        notification: {
            findMany: jest.fn(),
            count: jest.fn(),
            updateMany: jest.fn(),
        },
    },
}));

const mockDb = require("@/lib/db").db;

const USER = { id: "user-1", privateMetadata: { role: "USER" } };

const row = (over: Record<string, unknown> = {}) => ({
    id: "n-1",
    type: "order.group.shipped",
    params: { storeName: "Acme", orderId: "order-1" },
    linkUrl: "/order/order-1",
    isRead: false,
    createdAt: new Date("2026-10-07T00:00:00.000Z"),
    ...over,
});

describe("notification queries", () => {
    let errSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        (currentUser as jest.Mock).mockResolvedValue(USER);
        errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => errSpy.mockRestore());

    describe("認可", () => {
        it.each([
            ["getMyNotifications", () => getMyNotifications()],
            ["getUnreadNotificationCount", () => getUnreadNotificationCount()],
            ["markNotificationRead", () => markNotificationRead("n-1")],
            ["markAllNotificationsRead", () => markAllNotificationsRead()],
        ])(
            "%s は未認証なら Unauthenticated. を投げ、DB を呼ばない",
            async (_name, call) => {
                // Arrange
                (currentUser as jest.Mock).mockResolvedValue(null);

                // Act & Assert
                await expect(call()).rejects.toThrow("Unauthenticated.");
                expect(mockDb.notification.findMany).not.toHaveBeenCalled();
                expect(mockDb.notification.count).not.toHaveBeenCalled();
                expect(mockDb.notification.updateMany).not.toHaveBeenCalled();
            }
        );
    });

    describe("getMyNotifications", () => {
        it("自分の通知だけを新しい順に取り、文面を描画して返す", async () => {
            // Arrange
            mockDb.notification.findMany.mockResolvedValue([row()]);

            // Act
            const result = await getMyNotifications();

            // Assert
            const args = mockDb.notification.findMany.mock.calls[0][0];
            expect(args.where).toEqual({ userId: "user-1" });
            expect(args.orderBy).toEqual([
                { createdAt: "desc" },
                { id: "desc" },
            ]);
            expect(args.take).toBe(21); // 既定 20 件 + 次ページ判定の 1 件
            expect(result.items).toEqual([
                {
                    id: "n-1",
                    title: "Your items have shipped",
                    body: "Items from Acme in order-1 are on the way.",
                    linkUrl: "/order/order-1",
                    isRead: false,
                    createdAt: "2026-10-07T00:00:00.000Z",
                },
            ]);
            expect(result.nextCursor).toBeNull();
        });

        it("件数の上限を 50 にクランプする", async () => {
            // Arrange
            mockDb.notification.findMany.mockResolvedValue([]);

            // Act
            await getMyNotifications({ limit: "1e9" });

            // Assert
            expect(mockDb.notification.findMany.mock.calls[0][0].take).toBe(51);
        });

        it("次のページがあれば nextCursor を返し、余分な 1 件は含めない", async () => {
            // Arrange
            mockDb.notification.findMany.mockResolvedValue([
                row({ id: "n-1" }),
                row({ id: "n-2" }),
            ]);

            // Act
            const result = await getMyNotifications({ limit: 1 });

            // Assert
            expect(result.items.map((i) => i.id)).toEqual(["n-1"]);
            expect(result.nextCursor).toBe("n-1");
        });

        it("cursor を渡すとその次から取る（where の userId は維持する）", async () => {
            // Arrange
            mockDb.notification.findMany.mockResolvedValue([]);

            // Act
            await getMyNotifications({ cursor: "n-5" });

            // Assert
            const args = mockDb.notification.findMany.mock.calls[0][0];
            expect(args.cursor).toEqual({ id: "n-5" });
            expect(args.skip).toBe(1);
            expect(args.where).toEqual({ userId: "user-1" });
        });

        it("未知の種別の行は表示しない", async () => {
            // Arrange
            mockDb.notification.findMany.mockResolvedValue([
                row({ id: "n-x", type: "legacy.removed" }),
            ]);

            // Act
            const result = await getMyNotifications();

            // Assert
            expect(result.items).toEqual([]);
        });

        it("DB の失敗は汎用メッセージに変換する", async () => {
            // Arrange
            mockDb.notification.findMany.mockRejectedValue(
                new Error("db down")
            );

            // Act & Assert
            await expect(getMyNotifications()).rejects.toThrow(
                "Failed to load notifications."
            );
            expect(errSpy).toHaveBeenCalled();
        });
    });

    describe("getUnreadNotificationCount", () => {
        it("自分の未読だけを数える", async () => {
            // Arrange
            mockDb.notification.count.mockResolvedValue(3);

            // Act
            const count = await getUnreadNotificationCount();

            // Assert
            // 一覧に出ない未知の種別は数えない（バッジと一覧の件数を揃える）
            expect(mockDb.notification.count).toHaveBeenCalledWith({
                where: {
                    userId: "user-1",
                    isRead: false,
                    type: {
                        in: expect.arrayContaining(["order.group.shipped"]),
                    },
                },
            });
            expect(count).toBe(3);
        });
    });

    describe("markNotificationRead（IDOR）", () => {
        it("(b) where に自分の userId を入れて更新する", async () => {
            // Arrange
            mockDb.notification.updateMany.mockResolvedValue({ count: 1 });

            // Act
            const result = await markNotificationRead("n-1");

            // Assert
            const args = mockDb.notification.updateMany.mock.calls[0][0];
            expect(args.where).toEqual({
                id: "n-1",
                userId: "user-1",
                isRead: false,
            });
            expect(args.data.isRead).toBe(true);
            expect(args.data.readAt).toBeInstanceOf(Date);
            expect(result).toEqual({ count: 1 });
        });

        it("(a)(c) 他人の通知 ID では 0 件で、他人の行は変わらない", async () => {
            // Arrange —— where に userId があるので、他人の行には一致しない
            mockDb.notification.updateMany.mockResolvedValue({ count: 0 });

            // Act
            const result = await markNotificationRead("someone-elses");

            // Assert
            expect(result).toEqual({ count: 0 });
            expect(mockDb.notification.updateMany).toHaveBeenCalledTimes(1);
            expect(
                mockDb.notification.updateMany.mock.calls[0][0].where.userId
            ).toBe("user-1");
        });

        it("空の ID は DB を呼ばずに拒否する", async () => {
            // Act & Assert
            await expect(markNotificationRead("  ")).rejects.toThrow(
                "Invalid notification id."
            );
            expect(mockDb.notification.updateMany).not.toHaveBeenCalled();
        });
    });

    describe("markAllNotificationsRead", () => {
        it("自分の未読だけを一括で既読にする", async () => {
            // Arrange
            mockDb.notification.updateMany.mockResolvedValue({ count: 4 });

            // Act
            const result = await markAllNotificationsRead();

            // Assert
            const args = mockDb.notification.updateMany.mock.calls[0][0];
            expect(args.where).toEqual({ userId: "user-1", isRead: false });
            expect(result).toEqual({ count: 4 });
        });
    });
});
