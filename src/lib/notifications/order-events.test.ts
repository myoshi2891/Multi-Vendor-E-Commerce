import { recordOrderGroupStatusNotification } from "./order-events";
import { recordNotifications } from "./record";
import type { NotificationTx } from "./types";

jest.mock("./record", () => ({ recordNotifications: jest.fn() }));

const mockRecord = recordNotifications as jest.Mock;

const makeTx = (row: unknown) => {
    const tx = { orderGroup: { findUnique: jest.fn().mockResolvedValue(row) } };
    return { tx, asTx: tx as unknown as NotificationTx };
};

const groupRow = {
    orderId: "order-1",
    order: { userId: "user-1" },
    store: { name: "Acme" },
};

describe("recordOrderGroupStatusNotification", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRecord.mockResolvedValue({ deliveryIds: ["d-1"] });
    });

    it.each([
        ["Shipped", "order.group.shipped"],
        ["Delivered", "order.group.delivered"],
    ])("%s への遷移で顧客宛ての通知を記録する", async (next, type) => {
        // Arrange
        const { tx, asTx } = makeTx(groupRow);

        // Act
        const ids = await recordOrderGroupStatusNotification(asTx, {
            groupId: "group-1",
            previousStatus: "Processing",
            nextStatus: next as never,
        });

        // Assert
        expect(tx.orderGroup.findUnique).toHaveBeenCalledWith({
            where: { id: "group-1" },
            select: {
                orderId: true,
                order: { select: { userId: true } },
                store: { select: { name: true } },
            },
        });
        expect(mockRecord).toHaveBeenCalledWith(asTx, [
            {
                type,
                recipientUserId: "user-1",
                source: { type: "OrderGroup", id: "group-1" },
                transition: next,
                params: { storeName: "Acme", orderId: "order-1" },
                linkUrl: "/order/order-1",
            },
        ]);
        expect(ids).toEqual(["d-1"]);
    });

    it("通知対象でない状態（Confirmed 等）では何もしない", async () => {
        // Arrange
        const { tx, asTx } = makeTx(groupRow);

        // Act
        const ids = await recordOrderGroupStatusNotification(asTx, {
            groupId: "group-1",
            previousStatus: "Pending",
            nextStatus: "Confirmed" as never,
        });

        // Assert
        expect(tx.orderGroup.findUnique).not.toHaveBeenCalled();
        expect(mockRecord).not.toHaveBeenCalled();
        expect(ids).toEqual([]);
    });

    it("同じ状態への再設定（遷移なし）では通知しない", async () => {
        // Arrange
        const { asTx } = makeTx(groupRow);

        // Act
        const ids = await recordOrderGroupStatusNotification(asTx, {
            groupId: "group-1",
            previousStatus: "Shipped",
            nextStatus: "Shipped" as never,
        });

        // Assert
        expect(mockRecord).not.toHaveBeenCalled();
        expect(ids).toEqual([]);
    });

    it("記録の失敗は呼び出し元へ伝える（tx をロールバックさせる）", async () => {
        // Arrange
        const { asTx } = makeTx(groupRow);
        mockRecord.mockRejectedValue(new Error("db down"));

        // Act & Assert
        await expect(
            recordOrderGroupStatusNotification(asTx, {
                groupId: "group-1",
                previousStatus: "Processing",
                nextStatus: "Shipped" as never,
            })
        ).rejects.toThrow("db down");
    });

    it("group が見つからなければ throw する（黙って通知を落とさない）", async () => {
        // Arrange
        const { asTx } = makeTx(null);

        // Act & Assert
        await expect(
            recordOrderGroupStatusNotification(asTx, {
                groupId: "group-1",
                previousStatus: "Processing",
                nextStatus: "Shipped" as never,
            })
        ).rejects.toThrow("[Notifications:recordOrderGroupStatusNotification]");
    });
});
