import { ProductStatus } from "./types";
import { settleOrderItems, type SettlementTx } from "./order-item-settlement";

/** settleOrderItems が触る tx の最小のモック */
const createTx = () => ({
    orderItem: { updateManyAndReturn: jest.fn() },
    returnRequestItem: { groupBy: jest.fn().mockResolvedValue([]) },
    size: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
});

const asTx = (tx: ReturnType<typeof createTx>): SettlementTx =>
    tx as unknown as SettlementTx;

describe("settleOrderItems（返品済み数量の差し引き・returns-rma design §4.3）", () => {
    it("返品が無ければ購入数をそのまま戻す", async () => {
        // Arrange
        const tx = createTx();
        tx.orderItem.updateManyAndReturn.mockResolvedValue([
            { id: "oi-1", sizeId: "size-1", quantity: 3 },
        ]);

        // Act
        await settleOrderItems(
            asTx(tx),
            { id: "oi-1" },
            ProductStatus.Refunded
        );

        // Assert
        expect(tx.size.updateMany).toHaveBeenCalledWith({
            where: { id: "size-1" },
            data: { quantity: { increment: 3 } },
        });
    });

    it("受け取り済み（RECEIVED / RESOLVED）の返品数量を差し引いて戻す", async () => {
        // Arrange
        const tx = createTx();
        tx.orderItem.updateManyAndReturn.mockResolvedValue([
            { id: "oi-1", sizeId: "size-1", quantity: 3 },
        ]);
        tx.returnRequestItem.groupBy.mockResolvedValue([
            { orderItemId: "oi-1", _sum: { quantity: 1 } },
        ]);

        // Act
        await settleOrderItems(
            asTx(tx),
            { id: "oi-1" },
            ProductStatus.Refunded
        );

        // Assert
        expect(tx.returnRequestItem.groupBy).toHaveBeenCalledWith({
            by: ["orderItemId"],
            where: {
                orderItemId: { in: ["oi-1"] },
                returnRequest: { status: { in: ["RECEIVED", "RESOLVED"] } },
            },
            _sum: { quantity: true },
        });
        expect(tx.size.updateMany).toHaveBeenCalledWith({
            where: { id: "size-1" },
            data: { quantity: { increment: 2 } },
        });
    });

    it("全数が返品済みなら在庫に触れない", async () => {
        // Arrange
        const tx = createTx();
        tx.orderItem.updateManyAndReturn.mockResolvedValue([
            { id: "oi-1", sizeId: "size-1", quantity: 3 },
        ]);
        tx.returnRequestItem.groupBy.mockResolvedValue([
            { orderItemId: "oi-1", _sum: { quantity: 3 } },
        ]);

        // Act
        await settleOrderItems(
            asTx(tx),
            { id: "oi-1" },
            ProductStatus.Returned
        );

        // Assert
        expect(tx.size.updateMany).not.toHaveBeenCalled();
    });

    it("遷移した item が無ければ返品数量も読まない", async () => {
        // Arrange
        const tx = createTx();
        tx.orderItem.updateManyAndReturn.mockResolvedValue([]);

        // Act
        const settled = await settleOrderItems(
            asTx(tx),
            { orderGroupId: "g-1" },
            ProductStatus.Canceled
        );

        // Assert
        expect(settled).toEqual([]);
        expect(tx.returnRequestItem.groupBy).not.toHaveBeenCalled();
    });

    it("restock: false なら遷移だけして在庫を戻さない", async () => {
        // Arrange
        const tx = createTx();
        tx.orderItem.updateManyAndReturn.mockResolvedValue([
            { id: "oi-1", sizeId: "size-1", quantity: 3 },
        ]);

        // Act
        await settleOrderItems(
            asTx(tx),
            { id: "oi-1" },
            ProductStatus.Refunded,
            {
                restock: false,
            }
        );

        // Assert
        expect(tx.size.updateMany).not.toHaveBeenCalled();
    });
});
