import { db } from "@/lib/db";
import { dispatchPendingDeliveries, RETRY_WINDOW_MS } from "./dispatch";
import type { EmailProvider, EmailSendResult } from "./email-provider";

jest.mock("@/lib/db", () => ({
    db: {
        notificationDelivery: {
            findMany: jest.fn(),
            updateMany: jest.fn(),
            update: jest.fn(),
        },
        notification: { findUnique: jest.fn() },
    },
}));

const mockDb = db as unknown as {
    notificationDelivery: {
        findMany: jest.Mock;
        updateMany: jest.Mock;
        update: jest.Mock;
    };
    notification: { findUnique: jest.Mock };
};

const NOW = new Date("2026-10-07T12:00:00.000Z");

const makeProvider = (
    result: EmailSendResult,
    idempotencyWindowMs = 24 * 60 * 60 * 1000
): EmailProvider & { send: jest.Mock } => ({
    name: "test",
    idempotencyWindowMs,
    send: jest.fn().mockResolvedValue(result),
});

const candidate = (over: Record<string, unknown> = {}) => ({
    id: "d-1",
    status: "PENDING",
    attemptCount: 0,
    firstAttemptAt: null,
    notificationId: "n-1",
    ...over,
});

const notificationRow = {
    type: "order.group.shipped",
    params: { storeName: "Acme", orderId: "order-1" },
    dedupeKey: "order.group.shipped:OrderGroup:g-1:Shipped:user-1",
    user: { email: "buyer@example.com" },
};

describe("dispatchPendingDeliveries", () => {
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        mockDb.notificationDelivery.updateMany.mockResolvedValue({ count: 1 });
        mockDb.notificationDelivery.update.mockResolvedValue({});
        mockDb.notification.findUnique.mockResolvedValue(notificationRow);
    });

    afterEach(() => errorSpy.mockRestore());

    it("claim → 送信 → SENT の順に進み、冪等キーは `${dedupeKey}:email`", async () => {
        // Arrange
        mockDb.notificationDelivery.findMany.mockResolvedValue([candidate()]);
        const provider = makeProvider({ ok: true, providerMessageId: "m-1" });

        // Act
        const result = await dispatchPendingDeliveries({
            limit: 10,
            provider,
            now: () => NOW,
        });

        // Assert
        const claim = mockDb.notificationDelivery.updateMany.mock.calls[0][0];
        expect(claim.where.id).toBe("d-1");
        expect(claim.data).toMatchObject({
            status: "SENDING",
            attemptCount: { increment: 1 },
            firstAttemptAt: NOW,
        });
        expect(provider.send).toHaveBeenCalledWith(
            expect.objectContaining({
                to: "buyer@example.com",
                templateKey: "order.group.shipped",
                idempotencyKey: `${notificationRow.dedupeKey}:email`,
            })
        );
        expect(mockDb.notificationDelivery.update).toHaveBeenCalledWith({
            where: { id: "d-1" },
            data: expect.objectContaining({
                status: "SENT",
                sentAt: NOW,
                providerMessageId: "m-1",
                leaseExpiresAt: null,
            }),
        });
        expect(result).toEqual({ sent: 1, retried: 0, failed: 0, skipped: 0 });
    });

    it("送信前に SENT を書かない（claim の data は SENDING のみ）", async () => {
        // Arrange
        mockDb.notificationDelivery.findMany.mockResolvedValue([candidate()]);
        const provider = makeProvider({ ok: true, providerMessageId: "m-1" });
        const order: string[] = [];
        mockDb.notificationDelivery.updateMany.mockImplementation(
            async (args) => {
                order.push(`claim:${args.data.status}`);
                return { count: 1 };
            }
        );
        provider.send.mockImplementation(async () => {
            order.push("send");
            return { ok: true, providerMessageId: "m-1" };
        });
        mockDb.notificationDelivery.update.mockImplementation(async (args) => {
            order.push(`finish:${args.data.status}`);
            return {};
        });

        // Act
        await dispatchPendingDeliveries({
            limit: 10,
            provider,
            now: () => NOW,
        });

        // Assert
        expect(order).toEqual(["claim:SENDING", "send", "finish:SENT"]);
    });

    it("他のワーカーが先に claim した（count 0）行は送らない", async () => {
        // Arrange
        mockDb.notificationDelivery.findMany.mockResolvedValue([candidate()]);
        mockDb.notificationDelivery.updateMany.mockResolvedValue({ count: 0 });
        const provider = makeProvider({ ok: true, providerMessageId: "m-1" });

        // Act
        const result = await dispatchPendingDeliveries({
            limit: 10,
            provider,
            now: () => NOW,
        });

        // Assert
        expect(provider.send).not.toHaveBeenCalled();
        expect(result.skipped).toBe(1);
    });

    it("再試行できる失敗は PENDING に戻し、backoff を leaseExpiresAt に入れる", async () => {
        // Arrange
        mockDb.notificationDelivery.findMany.mockResolvedValue([candidate()]);
        const provider = makeProvider({
            ok: false,
            retryable: true,
            errorKind: "provider_5xx",
        });

        // Act
        const result = await dispatchPendingDeliveries({
            limit: 10,
            provider,
            now: () => NOW,
        });

        // Assert
        const finish = mockDb.notificationDelivery.update.mock.calls[0][0];
        expect(finish.data.status).toBe("PENDING");
        expect(finish.data.lastError).toBe("provider_5xx");
        expect(finish.data.leaseExpiresAt.getTime()).toBeGreaterThan(
            NOW.getTime()
        );
        expect(result.retried).toBe(1);
    });

    it("再試行できない失敗は FAILED にする", async () => {
        // Arrange
        mockDb.notificationDelivery.findMany.mockResolvedValue([candidate()]);
        const provider = makeProvider({
            ok: false,
            retryable: false,
            errorKind: "invalid_recipient",
        });

        // Act
        const result = await dispatchPendingDeliveries({
            limit: 10,
            provider,
            now: () => NOW,
        });

        // Assert
        const finish = mockDb.notificationDelivery.update.mock.calls[0][0];
        expect(finish.data).toMatchObject({
            status: "FAILED",
            lastError: "invalid_recipient",
        });
        expect(result.failed).toBe(1);
    });

    it("最初の試行から 23 時間を過ぎた行は送らずに FAILED（retry_window_exceeded）", async () => {
        // Arrange
        const firstAttemptAt = new Date(NOW.getTime() - RETRY_WINDOW_MS - 1);
        mockDb.notificationDelivery.findMany.mockResolvedValue([
            candidate({ firstAttemptAt }),
        ]);
        const provider = makeProvider({ ok: true, providerMessageId: "m-1" });

        // Act
        const result = await dispatchPendingDeliveries({
            limit: 10,
            provider,
            now: () => NOW,
        });

        // Assert
        expect(provider.send).not.toHaveBeenCalled();
        expect(mockDb.notificationDelivery.update).toHaveBeenCalledWith({
            where: { id: "d-1" },
            data: expect.objectContaining({
                status: "FAILED",
                lastError: "retry_window_exceeded",
            }),
        });
        expect(result.failed).toBe(1);
    });

    it("冪等キー非対応のプロバイダでは、リース切れの SENDING 行を再送しない", async () => {
        // Arrange
        mockDb.notificationDelivery.findMany.mockResolvedValue([
            candidate({
                status: "SENDING",
                firstAttemptAt: new Date(NOW.getTime() - 60_000),
            }),
        ]);
        const provider = makeProvider(
            { ok: true, providerMessageId: "m-1" },
            0
        );

        // Act
        const result = await dispatchPendingDeliveries({
            limit: 10,
            provider,
            now: () => NOW,
        });

        // Assert
        expect(provider.send).not.toHaveBeenCalled();
        expect(mockDb.notificationDelivery.update).toHaveBeenCalledWith({
            where: { id: "d-1" },
            data: expect.objectContaining({
                status: "FAILED",
                lastError: "unsafe_resend",
            }),
        });
        expect(result.failed).toBe(1);
    });

    it("1 件の DB 失敗で残りを止めず、ログに宛先を出さない", async () => {
        // Arrange
        mockDb.notificationDelivery.findMany.mockResolvedValue([
            candidate({ id: "d-1" }),
            candidate({ id: "d-2", notificationId: "n-2" }),
        ]);
        mockDb.notification.findUnique
            .mockRejectedValueOnce(new Error("db down"))
            .mockResolvedValueOnce(notificationRow);
        const provider = makeProvider({ ok: true, providerMessageId: "m-2" });

        // Act
        const result = await dispatchPendingDeliveries({
            limit: 10,
            provider,
            now: () => NOW,
        });

        // Assert
        expect(provider.send).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({ sent: 1, failed: 1 });
        const logged = JSON.stringify(errorSpy.mock.calls);
        expect(logged).not.toContain("buyer@example.com");
        expect(logged).toContain("d-1");
    });

    it("deliveryIds を渡すと、その ID だけを対象に抽出する", async () => {
        // Arrange
        mockDb.notificationDelivery.findMany.mockResolvedValue([]);
        const provider = makeProvider({ ok: true, providerMessageId: "m-1" });

        // Act
        await dispatchPendingDeliveries({
            deliveryIds: ["d-9"],
            limit: 1,
            provider,
            now: () => NOW,
        });

        // Assert
        const args = mockDb.notificationDelivery.findMany.mock.calls[0][0];
        expect(args.where.id).toEqual({ in: ["d-9"] });
        expect(args.take).toBe(1);
    });

    it("deliveryIds が空配列なら DB を呼ばない", async () => {
        // Arrange
        const provider = makeProvider({ ok: true, providerMessageId: "m-1" });

        // Act
        const result = await dispatchPendingDeliveries({
            deliveryIds: [],
            limit: 10,
            provider,
            now: () => NOW,
        });

        // Assert
        expect(mockDb.notificationDelivery.findMany).not.toHaveBeenCalled();
        expect(result).toEqual({ sent: 0, retried: 0, failed: 0, skipped: 0 });
    });
});
