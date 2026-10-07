import { recordNotifications } from "./record";
import type { NotificationEvent, NotificationTx } from "./types";

const makeTx = () => {
    const tx = {
        notification: { createManyAndReturn: jest.fn() },
        notificationDelivery: { createManyAndReturn: jest.fn() },
    };
    return { tx, asTx: tx as unknown as NotificationTx };
};

const shipped: NotificationEvent = {
    type: "order.group.shipped",
    recipientUserId: "user-1",
    source: { type: "OrderGroup", id: "group-1" },
    transition: "Shipped",
    params: { storeName: "Acme", orderId: "order-1" },
    linkUrl: "/order/order-1",
};

describe("recordNotifications", () => {
    it("Notification を skipDuplicates で作り、email 種別には PENDING の配信行を作る", async () => {
        // Arrange
        const { tx, asTx } = makeTx();
        tx.notification.createManyAndReturn.mockResolvedValue([
            { id: "n-1", type: "order.group.shipped" },
        ]);
        tx.notificationDelivery.createManyAndReturn.mockResolvedValue([
            { id: "d-1" },
        ]);

        // Act
        const result = await recordNotifications(asTx, [shipped]);

        // Assert
        expect(tx.notification.createManyAndReturn).toHaveBeenCalledWith({
            data: [
                {
                    userId: "user-1",
                    type: "order.group.shipped",
                    params: { storeName: "Acme", orderId: "order-1" },
                    linkUrl: "/order/order-1",
                    sourceType: "OrderGroup",
                    sourceId: "group-1",
                    dedupeKey:
                        "order.group.shipped:OrderGroup:group-1:Shipped:user-1",
                },
            ],
            skipDuplicates: true,
            select: { id: true, type: true },
        });
        expect(
            tx.notificationDelivery.createManyAndReturn
        ).toHaveBeenCalledWith({
            data: [{ notificationId: "n-1", channel: "email" }],
            skipDuplicates: true,
            select: { id: true },
        });
        expect(result).toEqual({ deliveryIds: ["d-1"] });
    });

    it("重複でスキップされた（返却 0 件の）ときは配信行を作らない", async () => {
        // Arrange
        const { tx, asTx } = makeTx();
        tx.notification.createManyAndReturn.mockResolvedValue([]);

        // Act
        const result = await recordNotifications(asTx, [shipped]);

        // Assert
        expect(
            tx.notificationDelivery.createManyAndReturn
        ).not.toHaveBeenCalled();
        expect(result).toEqual({ deliveryIds: [] });
    });

    it("in-app のみの種別は配信行を作らない", async () => {
        // Arrange
        const { tx, asTx } = makeTx();
        tx.notification.createManyAndReturn.mockResolvedValue([
            { id: "n-2", type: "catalog.review.approved" },
        ]);

        // Act
        const result = await recordNotifications(asTx, [
            {
                ...shipped,
                type: "catalog.review.approved",
                source: { type: "Product", id: "p-1" },
                transition: "APPROVED",
            },
        ]);

        // Assert
        expect(
            tx.notificationDelivery.createManyAndReturn
        ).not.toHaveBeenCalled();
        expect(result).toEqual({ deliveryIds: [] });
    });

    it("イベントが空なら DB を呼ばない", async () => {
        // Arrange
        const { tx, asTx } = makeTx();

        // Act
        const result = await recordNotifications(asTx, []);

        // Assert
        expect(tx.notification.createManyAndReturn).not.toHaveBeenCalled();
        expect(result).toEqual({ deliveryIds: [] });
    });

    it("書き込みの失敗は握りつぶさず呼び出し元へ伝える（主処理の tx をロールバックさせる）", async () => {
        // Arrange
        const { tx, asTx } = makeTx();
        tx.notification.createManyAndReturn.mockRejectedValue(
            new Error("db down")
        );

        // Act & Assert
        await expect(recordNotifications(asTx, [shipped])).rejects.toThrow(
            "db down"
        );
    });
});
