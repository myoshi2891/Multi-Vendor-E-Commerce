import { currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import {
    approveReturnRequest,
    approveReturnRequestAsAdmin,
    cancelReturnRequest,
    cancelReturnRequestAsAdmin,
    createReturnRequest,
    getStoreReturnRequests,
    receiveReturnRequest,
    rejectReturnRequest,
    resolveReturnRequest,
    setReturnTrackingNumber,
} from "./returns";
import { ProductStatus } from "../lib/types";
import { createMockStore } from "../config/test-fixtures";

// ---- モック設定 ----
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
    db: {
        store: { findUnique: jest.fn() },
        returnRequest: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
        },
        returnRequestItem: {
            groupBy: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
        },
        orderItem: { updateManyAndReturn: jest.fn() },
        size: { updateMany: jest.fn() },
        $queryRaw: jest.fn(),
        $transaction: jest.fn(),
    },
}));

jest.mock("@/lib/notifications/rma-events", () => ({
    recordReturnRequestNotification: jest.fn(),
}));
jest.mock("@/lib/notifications/schedule", () => ({
    scheduleDispatch: jest.fn(),
}));

const mockDb = require("@/lib/db").db;
const {
    recordReturnRequestNotification: mockRecordNotification,
} = require("@/lib/notifications/rma-events");
const {
    scheduleDispatch: mockScheduleDispatch,
} = require("@/lib/notifications/schedule");

const USER_ID = "user-001";
const SELLER_ID = "seller-001";
const STORE_ID = "store-001";
const STORE_URL = "test-store";
const GROUP_ID = "6f1c1c2e-3b4d-4c5e-8f60-718293a4b5c6";
const ITEM_ID = "0a1b2c3d-4e5f-4a6b-8c7d-8e9fa0b1c2d3";
const RMA_ID = "9b8a7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d";
const RMA_ITEM_ID = "1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
const KEY = "4d3c2b1a-0f9e-4d8c-8b7a-6f5e4d3c2b1a";

const mockAuth = (id: string, role: "USER" | "SELLER" | "ADMIN"): void => {
    (currentUser as jest.Mock).mockResolvedValue({
        id,
        privateMetadata: { role },
    });
};

/** requireStoreOwner を通すため、所有店舗を返す */
const mockSellerOwnsStore = (): void => {
    mockAuth(SELLER_ID, "SELLER");
    mockDb.store.findUnique.mockResolvedValue(
        createMockStore({ id: STORE_ID, url: STORE_URL, userId: SELLER_ID })
    );
};

const validRequest = (overrides: Record<string, unknown> = {}) => ({
    orderGroupId: GROUP_ID,
    idempotencyKey: KEY,
    resolution: "REFUND" as const,
    items: [
        { orderItemId: ITEM_ID, quantity: 1, reasonCode: "SIZE_FIT" as const },
    ],
    ...overrides,
});

/** createReturnRequest の FOR UPDATE が返す行（配達済み・期限内・返品可） */
const lockedRow = (overrides: Record<string, unknown> = {}) => ({
    id: ITEM_ID,
    quantity: 3,
    status: ProductStatus.Delivered,
    storeId: STORE_ID,
    shippingDeliveryMax: 14,
    orderCreatedAt: new Date(),
    acceptsReturns: true,
    returnWindowDays: null,
    ...overrides,
});

/** $queryRaw の tagged template 呼び出しから SQL 本文を復元する */
const sqlOf = (callIndex: number): string =>
    (mockDb.$queryRaw.mock.calls[callIndex][0] as string[]).join("?");

beforeEach(() => {
    jest.clearAllMocks();
    mockDb.$transaction.mockImplementation(
        (callback: (tx: unknown) => Promise<unknown>) => callback(mockDb)
    );
    mockDb.returnRequest.findUnique.mockResolvedValue(null);
    mockDb.returnRequestItem.groupBy.mockResolvedValue([]);
    mockDb.returnRequest.create.mockResolvedValue({
        id: RMA_ID,
        status: "REQUESTED",
    });
    mockDb.size.updateMany.mockResolvedValue({ count: 1 });
    mockDb.orderItem.updateManyAndReturn.mockResolvedValue([]);
    mockRecordNotification.mockResolvedValue(["delivery-1"]);
});

// ==================================================
// createReturnRequest（T1）
// ==================================================
describe("createReturnRequest", () => {
    it("未認証なら 'Unauthenticated.' で拒否し、tx を開かない", async () => {
        // Arrange
        (currentUser as jest.Mock).mockResolvedValue(null);

        // Act & Assert
        await expect(createReturnRequest(validRequest())).rejects.toThrow(
            "Unauthenticated."
        );
        expect(mockDb.$transaction).not.toHaveBeenCalled();
    });

    it.each([
        [
            "quantity が 0",
            {
                items: [
                    { orderItemId: ITEM_ID, quantity: 0, reasonCode: "OTHER" },
                ],
            },
        ],
        [
            "quantity が負",
            {
                items: [
                    { orderItemId: ITEM_ID, quantity: -1, reasonCode: "OTHER" },
                ],
            },
        ],
        [
            "quantity が小数",
            {
                items: [
                    {
                        orderItemId: ITEM_ID,
                        quantity: 1.5,
                        reasonCode: "OTHER",
                    },
                ],
            },
        ],
        ["resolution が EXCHANGE", { resolution: "EXCHANGE" }],
        ["idempotencyKey が無い", { idempotencyKey: undefined }],
        ["明細が空", { items: [] }],
        [
            "同じ item が重複",
            {
                items: [
                    { orderItemId: ITEM_ID, quantity: 1, reasonCode: "OTHER" },
                    { orderItemId: ITEM_ID, quantity: 1, reasonCode: "OTHER" },
                ],
            },
        ],
    ])("%s なら Zod で拒否し、tx を開かない", async (_label, overrides) => {
        // Arrange
        mockAuth(USER_ID, "USER");

        // Act & Assert
        await expect(
            createReturnRequest(
                validRequest(overrides) as Parameters<
                    typeof createReturnRequest
                >[0]
            )
        ).rejects.toThrow("Invalid return request.");
        expect(mockDb.$transaction).not.toHaveBeenCalled();
    });

    it("ロックの SQL は注文の所有者（o.\"userId\"）で絞り、0 行なら 'Order item not found' で作らない", async () => {
        // Arrange
        mockAuth(USER_ID, "USER");
        mockDb.$queryRaw.mockResolvedValue([]);

        // Act & Assert
        await expect(createReturnRequest(validRequest())).rejects.toThrow(
            "Order item not found"
        );
        const sql = sqlOf(0);
        expect(sql).toContain('o."userId" = ?');
        expect(sql).toContain("FOR UPDATE OF oi");
        expect(mockDb.$queryRaw.mock.calls[0]).toContain(USER_ID);
        expect(mockDb.returnRequest.create).not.toHaveBeenCalled();
        expect(mockRecordNotification).not.toHaveBeenCalled();
    });

    it("Delivered でない item は 'Order item is not eligible for return.' で拒否する", async () => {
        // Arrange
        mockAuth(USER_ID, "USER");
        mockDb.$queryRaw.mockResolvedValue([
            lockedRow({ status: ProductStatus.Shipped }),
        ]);

        // Act & Assert
        await expect(createReturnRequest(validRequest())).rejects.toThrow(
            "Order item is not eligible for return."
        );
        expect(mockDb.returnRequest.create).not.toHaveBeenCalled();
    });

    it("有効な RMA の合計 + 申請数が購入数を超えると拒否する（R-1）", async () => {
        // Arrange
        mockAuth(USER_ID, "USER");
        mockDb.$queryRaw.mockResolvedValue([lockedRow()]);
        mockDb.returnRequestItem.groupBy.mockResolvedValue([
            { orderItemId: ITEM_ID, _sum: { quantity: 2 } },
        ]);

        // Act & Assert
        await expect(
            createReturnRequest(
                validRequest({
                    items: [
                        {
                            orderItemId: ITEM_ID,
                            quantity: 2,
                            reasonCode: "OTHER",
                        },
                    ],
                })
            )
        ).rejects.toThrow("Return quantity exceeds purchased quantity.");
        expect(mockDb.returnRequestItem.groupBy).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    returnRequest: {
                        status: { notIn: ["REJECTED", "CANCELED"] },
                    },
                }),
            })
        );
        expect(mockDb.returnRequest.create).not.toHaveBeenCalled();
    });

    it("作成時の storeId と userId は入力ではなく、ロックした行と認証から取る", async () => {
        // Arrange
        mockAuth(USER_ID, "USER");
        mockDb.$queryRaw.mockResolvedValue([lockedRow()]);

        // Act
        const result = await createReturnRequest(
            validRequest({ customerNote: "too small" })
        );

        // Assert
        expect(result).toEqual({ id: RMA_ID, status: "REQUESTED" });
        const { data } = mockDb.returnRequest.create.mock.calls[0][0];
        expect(data).toMatchObject({
            storeId: STORE_ID,
            userId: USER_ID,
            idempotencyKey: KEY,
            customerNote: "too small",
        });
        expect(data.requestHash).toMatch(/^[0-9a-f]{64}$/);
        expect(mockRecordNotification).toHaveBeenCalledWith(mockDb, {
            returnRequestId: RMA_ID,
            status: "REQUESTED",
            recipients: ["seller"],
        });
        expect(mockScheduleDispatch).toHaveBeenCalledWith(["delivery-1"]);
    });

    it("同じキー・同じ内容の再送は既存の RMA を返し、作り直さない（R-2）", async () => {
        // Arrange —— 1 回目で正規化ハッシュを得る
        mockAuth(USER_ID, "USER");
        mockDb.$queryRaw.mockResolvedValue([lockedRow()]);
        await createReturnRequest(validRequest({ customerNote: "first" }));
        const { requestHash } =
            mockDb.returnRequest.create.mock.calls[0][0].data;
        jest.clearAllMocks();
        mockDb.returnRequest.findUnique.mockResolvedValue({
            id: RMA_ID,
            status: "APPROVED",
            requestHash,
        });

        // Act —— メモだけ変えた再送（customerNote はハッシュに含めない）
        const result = await createReturnRequest(
            validRequest({ customerNote: "edited" })
        );

        // Assert
        expect(result).toEqual({ id: RMA_ID, status: "APPROVED" });
        expect(mockDb.$queryRaw).not.toHaveBeenCalled();
        expect(mockDb.returnRequest.create).not.toHaveBeenCalled();
        expect(mockScheduleDispatch).not.toHaveBeenCalled();
    });

    it("ロックを待つ間に同じキーの申請が確定していたら、数量を数えずに既存を返す", async () => {
        // Arrange —— 1 回目でハッシュを得る
        mockAuth(USER_ID, "USER");
        mockDb.$queryRaw.mockResolvedValue([lockedRow()]);
        await createReturnRequest(validRequest());
        const { requestHash } =
            mockDb.returnRequest.create.mock.calls[0][0].data;
        jest.clearAllMocks();
        mockDb.$transaction.mockImplementation(
            (callback: (tx: unknown) => Promise<unknown>) => callback(mockDb)
        );
        mockDb.$queryRaw.mockResolvedValue([lockedRow()]);
        mockDb.returnRequest.findUnique
            .mockResolvedValueOnce(null) // ロック前: まだ無い
            .mockResolvedValueOnce({
                id: RMA_ID,
                status: "REQUESTED",
                requestHash,
            }); // ロック後: 並行した同じキーの申請が確定済み

        // Act
        const result = await createReturnRequest(validRequest());

        // Assert
        expect(result).toEqual({ id: RMA_ID, status: "REQUESTED" });
        expect(mockDb.returnRequestItem.groupBy).not.toHaveBeenCalled();
        expect(mockDb.returnRequest.create).not.toHaveBeenCalled();
    });

    it("同じキーで内容が違えば拒否する", async () => {
        // Arrange
        mockAuth(USER_ID, "USER");
        mockDb.returnRequest.findUnique.mockResolvedValue({
            id: RMA_ID,
            status: "REQUESTED",
            requestHash: "different",
        });

        // Act & Assert
        await expect(createReturnRequest(validRequest())).rejects.toThrow(
            "Idempotency key was reused with a different request."
        );
    });

    it("並行な再送の一意制約違反（P2002）は tx の外で既存を引き直す", async () => {
        // Arrange
        mockAuth(USER_ID, "USER");
        mockDb.$queryRaw.mockResolvedValue([lockedRow()]);
        let capturedHash = "";
        mockDb.returnRequest.findUnique
            .mockResolvedValueOnce(null) // tx 内の事前確認（ロック前）
            .mockResolvedValueOnce(null) // tx 内の再確認（ロック後）
            .mockImplementationOnce(async () => ({
                id: RMA_ID,
                status: "REQUESTED",
                requestHash: capturedHash,
            }));
        mockDb.returnRequest.create.mockImplementationOnce(
            async (args: { data: { requestHash: string } }) => {
                capturedHash = args.data.requestHash;
                throw new Prisma.PrismaClientKnownRequestError(
                    "Unique constraint",
                    {
                        code: "P2002",
                        clientVersion: "test",
                    }
                );
            }
        );

        // Act
        const result = await createReturnRequest(validRequest());

        // Assert
        expect(result).toEqual({ id: RMA_ID, status: "REQUESTED" });
        expect(mockDb.returnRequest.findUnique).toHaveBeenCalledTimes(3);
        expect(mockScheduleDispatch).not.toHaveBeenCalled();
    });

    it("DB 障害は汎用メッセージで返し、送信を予約しない", async () => {
        // Arrange
        mockAuth(USER_ID, "USER");
        mockDb.$queryRaw.mockRejectedValue(new Error("connection lost"));
        const errorSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});

        // Act & Assert
        await expect(createReturnRequest(validRequest())).rejects.toThrow(
            "Failed to create return request."
        );
        expect(errorSpy).toHaveBeenCalled();
        expect(mockScheduleDispatch).not.toHaveBeenCalled();
        errorSpy.mockRestore();
    });
});

// ==================================================
// 遷移（seller）
// ==================================================
describe("approveReturnRequest", () => {
    it("seller でなければ 'Only sellers can perform this action.' のまま拒否する（汎用メッセージで上書きしない）", async () => {
        // Arrange
        mockAuth(USER_ID, "USER");

        // Act & Assert
        await expect(approveReturnRequest(STORE_URL, RMA_ID)).rejects.toThrow(
            "Only sellers can perform this action."
        );
        expect(mockDb.$transaction).not.toHaveBeenCalled();
    });

    it("遷移元 REQUESTED と所有店舗の storeId を条件に更新し、顧客に通知する", async () => {
        // Arrange
        mockSellerOwnsStore();
        mockDb.returnRequest.updateMany.mockResolvedValue({ count: 1 });

        // Act
        const status = await approveReturnRequest(STORE_URL, RMA_ID);

        // Assert
        expect(status).toBe("APPROVED");
        expect(mockDb.returnRequest.updateMany).toHaveBeenCalledWith({
            where: {
                id: RMA_ID,
                storeId: STORE_ID,
                status: { in: ["REQUESTED"] },
            },
            data: expect.objectContaining({
                status: "APPROVED",
                approvedAt: expect.any(Date),
            }),
        });
        expect(mockRecordNotification).toHaveBeenCalledWith(mockDb, {
            returnRequestId: RMA_ID,
            status: "APPROVED",
            recipients: ["customer"],
        });
        expect(mockScheduleDispatch).toHaveBeenCalledWith(["delivery-1"]);
    });

    it("count === 0 で対象が見つからなければ 'Return request not found.'、副作用なし", async () => {
        // Arrange
        mockSellerOwnsStore();
        mockDb.returnRequest.updateMany.mockResolvedValue({ count: 0 });
        mockDb.returnRequest.findFirst.mockResolvedValue(null);

        // Act & Assert
        await expect(approveReturnRequest(STORE_URL, RMA_ID)).rejects.toThrow(
            "Return request not found."
        );
        expect(mockRecordNotification).not.toHaveBeenCalled();
        expect(mockScheduleDispatch).not.toHaveBeenCalled();
    });

    it("count === 0 ですでに APPROVED なら、副作用なしで同じ状態を返す（遷移の冪等性）", async () => {
        // Arrange
        mockSellerOwnsStore();
        mockDb.returnRequest.updateMany.mockResolvedValue({ count: 0 });
        mockDb.returnRequest.findFirst.mockResolvedValue({
            status: "APPROVED",
        });

        // Act
        const status = await approveReturnRequest(STORE_URL, RMA_ID);

        // Assert
        expect(status).toBe("APPROVED");
        expect(mockRecordNotification).not.toHaveBeenCalled();
        expect(mockScheduleDispatch).not.toHaveBeenCalled();
    });

    it("count === 0 で別の状態（終端）なら拒否する", async () => {
        // Arrange
        mockSellerOwnsStore();
        mockDb.returnRequest.updateMany.mockResolvedValue({ count: 0 });
        mockDb.returnRequest.findFirst.mockResolvedValue({
            status: "REJECTED",
        });

        // Act & Assert
        await expect(approveReturnRequest(STORE_URL, RMA_ID)).rejects.toThrow(
            "Return request is not in a valid state for this action."
        );
    });

    it("ID が UUID でなければ tx を開かずに 'Return request not found.'", async () => {
        // Arrange
        mockSellerOwnsStore();

        // Act & Assert
        await expect(approveReturnRequest(STORE_URL, "abc")).rejects.toThrow(
            "Return request not found."
        );
        expect(mockDb.$transaction).not.toHaveBeenCalled();
    });

    it("DB 障害は 'Failed to approve return request.' で返す", async () => {
        // Arrange
        mockSellerOwnsStore();
        mockDb.returnRequest.updateMany.mockRejectedValue(new Error("db down"));
        const errorSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});

        // Act & Assert
        await expect(approveReturnRequest(STORE_URL, RMA_ID)).rejects.toThrow(
            "Failed to approve return request."
        );
        errorSpy.mockRestore();
    });
});

describe("rejectReturnRequest", () => {
    it("却下の理由が空なら拒否する", async () => {
        // Arrange
        mockSellerOwnsStore();

        // Act & Assert
        await expect(
            rejectReturnRequest(STORE_URL, RMA_ID, "   ")
        ).rejects.toThrow("Invalid reject request.");
        expect(mockDb.$transaction).not.toHaveBeenCalled();
    });

    it("sellerNote と rejectedAt を書いて REJECTED にする", async () => {
        // Arrange
        mockSellerOwnsStore();
        mockDb.returnRequest.updateMany.mockResolvedValue({ count: 1 });

        // Act
        const status = await rejectReturnRequest(
            STORE_URL,
            RMA_ID,
            "Worn item"
        );

        // Assert
        expect(status).toBe("REJECTED");
        expect(
            mockDb.returnRequest.updateMany.mock.calls[0][0].data
        ).toMatchObject({
            status: "REJECTED",
            sellerNote: "Worn item",
        });
    });
});

describe("receiveReturnRequest", () => {
    const rmaItem = { id: RMA_ITEM_ID, orderItemId: ITEM_ID, quantity: 2 };

    beforeEach(() => {
        mockSellerOwnsStore();
        mockDb.returnRequest.updateMany.mockResolvedValue({ count: 1 });
        mockDb.returnRequestItem.findMany.mockResolvedValue([rmaItem]);
    });

    it("RESELLABLE なら明細の数量だけ在庫を戻し、restockedQuantity に記録する", async () => {
        // Arrange
        mockDb.$queryRaw.mockResolvedValue([
            { id: ITEM_ID, status: ProductStatus.Delivered, sizeId: "size-1" },
        ]);

        // Act
        await receiveReturnRequest(STORE_URL, RMA_ID, [
            { returnRequestItemId: RMA_ITEM_ID, condition: "RESELLABLE" },
        ]);

        // Assert
        expect(sqlOf(0)).toContain("FOR UPDATE");
        expect(mockDb.returnRequestItem.update).toHaveBeenCalledWith({
            where: { id: RMA_ITEM_ID },
            data: { condition: "RESELLABLE", restockedQuantity: 2 },
        });
        expect(mockDb.size.updateMany).toHaveBeenCalledWith({
            where: { id: "size-1" },
            data: { quantity: { increment: 2 } },
        });
    });

    it("DAMAGED なら在庫を戻さない", async () => {
        // Arrange
        mockDb.$queryRaw.mockResolvedValue([
            { id: ITEM_ID, status: ProductStatus.Delivered, sizeId: "size-1" },
        ]);

        // Act
        await receiveReturnRequest(STORE_URL, RMA_ID, [
            { returnRequestItemId: RMA_ITEM_ID, condition: "DAMAGED" },
        ]);

        // Assert
        expect(mockDb.returnRequestItem.update).toHaveBeenCalledWith({
            where: { id: RMA_ITEM_ID },
            data: { condition: "DAMAGED", restockedQuantity: 0 },
        });
        expect(mockDb.size.updateMany).not.toHaveBeenCalled();
    });

    it("OrderItem がすでに終端なら RESELLABLE でも戻さず、警告を残す", async () => {
        // Arrange
        mockDb.$queryRaw.mockResolvedValue([
            { id: ITEM_ID, status: ProductStatus.Refunded, sizeId: "size-1" },
        ]);
        const warnSpy = jest
            .spyOn(console, "warn")
            .mockImplementation(() => {});

        // Act
        await receiveReturnRequest(STORE_URL, RMA_ID, [
            { returnRequestItemId: RMA_ITEM_ID, condition: "RESELLABLE" },
        ]);

        // Assert
        expect(mockDb.returnRequestItem.update).toHaveBeenCalledWith({
            where: { id: RMA_ITEM_ID },
            data: { condition: "RESELLABLE", restockedQuantity: 0 },
        });
        expect(mockDb.size.updateMany).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it("全明細の状態がそろっていなければ、その理由で拒否する（汎用メッセージにしない）", async () => {
        // Arrange
        const otherItemId = "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a";

        // Act & Assert
        await expect(
            receiveReturnRequest(STORE_URL, RMA_ID, [
                { returnRequestItemId: otherItemId, condition: "RESELLABLE" },
            ])
        ).rejects.toThrow("Condition is required for every returned item.");
        expect(mockRecordNotification).not.toHaveBeenCalled();
        expect(mockScheduleDispatch).not.toHaveBeenCalled();
    });
});

describe("resolveReturnRequest", () => {
    it("返金額を Decimal で確定し、全数が返品された item を Returned にする", async () => {
        // Arrange
        mockSellerOwnsStore();
        mockDb.returnRequest.updateMany.mockResolvedValue({ count: 1 });
        mockDb.returnRequestItem.findMany.mockResolvedValue([
            {
                orderItemId: ITEM_ID,
                quantity: 2,
                orderItem: { price: new Prisma.Decimal("100.10"), quantity: 2 },
            },
        ]);
        mockDb.$queryRaw.mockResolvedValue([
            { id: ITEM_ID, status: ProductStatus.Delivered, sizeId: "s1" },
        ]);
        mockDb.returnRequestItem.groupBy.mockResolvedValue([
            { orderItemId: ITEM_ID, _sum: { quantity: 2 } },
        ]);

        // Act
        const status = await resolveReturnRequest(STORE_URL, RMA_ID);

        // Assert
        expect(status).toBe("RESOLVED");
        const { data } = mockDb.returnRequest.update.mock.calls[0][0];
        expect(data.refundAmount.toFixed(2)).toBe("200.20");
        expect(mockDb.orderItem.updateManyAndReturn).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { status: ProductStatus.Returned },
            })
        );
    });

    it("一部だけの返品なら OrderItem は終端にしない", async () => {
        // Arrange
        mockSellerOwnsStore();
        mockDb.returnRequest.updateMany.mockResolvedValue({ count: 1 });
        mockDb.returnRequestItem.findMany.mockResolvedValue([
            {
                orderItemId: ITEM_ID,
                quantity: 1,
                orderItem: { price: new Prisma.Decimal("100"), quantity: 3 },
            },
        ]);
        mockDb.$queryRaw.mockResolvedValue([
            { id: ITEM_ID, status: ProductStatus.Delivered, sizeId: "s1" },
        ]);
        mockDb.returnRequestItem.groupBy.mockResolvedValue([
            { orderItemId: ITEM_ID, _sum: { quantity: 1 } },
        ]);

        // Act
        await resolveReturnRequest(STORE_URL, RMA_ID);

        // Assert
        expect(mockDb.orderItem.updateManyAndReturn).not.toHaveBeenCalled();
    });

    it("ロック時点で終端（取り消し・返金済み）の item は返金額に含めない", async () => {
        // Arrange
        mockSellerOwnsStore();
        mockDb.returnRequest.updateMany.mockResolvedValue({ count: 1 });
        mockDb.returnRequestItem.findMany.mockResolvedValue([
            {
                orderItemId: ITEM_ID,
                quantity: 1,
                orderItem: { price: new Prisma.Decimal("100"), quantity: 1 },
            },
            {
                orderItemId: "item-refunded",
                quantity: 1,
                orderItem: { price: new Prisma.Decimal("50"), quantity: 1 },
            },
        ]);
        mockDb.$queryRaw.mockResolvedValue([
            { id: ITEM_ID, status: ProductStatus.Delivered, sizeId: "s1" },
            {
                id: "item-refunded",
                status: ProductStatus.Refunded,
                sizeId: "s2",
            },
        ]);
        mockDb.returnRequestItem.groupBy.mockResolvedValue([]);

        // Act
        await resolveReturnRequest(STORE_URL, RMA_ID);

        // Assert
        const { data } = mockDb.returnRequest.update.mock.calls[0][0];
        expect(data.refundAmount.toFixed(2)).toBe("100.00");
    });

    it("手動で Returned にされた item は返金額に含め、精算（settle）はし直さない", async () => {
        // Arrange: seller が updateOrderItemStatus で Returned にしても、返金はまだ行われていない
        mockSellerOwnsStore();
        mockDb.returnRequest.updateMany.mockResolvedValue({ count: 1 });
        mockDb.returnRequestItem.findMany.mockResolvedValue([
            {
                orderItemId: ITEM_ID,
                quantity: 1,
                orderItem: { price: new Prisma.Decimal("80"), quantity: 1 },
            },
        ]);
        mockDb.$queryRaw.mockResolvedValue([
            { id: ITEM_ID, status: ProductStatus.Returned, sizeId: "s1" },
        ]);
        mockDb.returnRequestItem.groupBy.mockResolvedValue([
            { orderItemId: ITEM_ID, _sum: { quantity: 1 } },
        ]);

        // Act
        await resolveReturnRequest(STORE_URL, RMA_ID);

        // Assert
        const { data } = mockDb.returnRequest.update.mock.calls[0][0];
        expect(data.refundAmount.toFixed(2)).toBe("80.00");
        expect(mockDb.orderItem.updateManyAndReturn).not.toHaveBeenCalled();
    });

    it("同じ item の RECEIVED が 2 件あるとき、新しい方から解決しても両方に返金額が付く", async () => {
        // Arrange: 購入数 2 の item に、1 個ずつの RMA（古い順に older / newer）が RECEIVED で並ぶ
        mockSellerOwnsStore();
        const OLDER_ID = RMA_ID;
        const NEWER_ID = "2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a";
        const rmaStatus = new Map<string, string>([
            [OLDER_ID, "RECEIVED"],
            [NEWER_ID, "RECEIVED"],
        ]);
        let itemStatus: string = ProductStatus.Delivered;
        const matchesStatus = (status: string, filter: unknown): boolean => {
            if (typeof filter === "string") return status === filter;
            if (filter && typeof filter === "object" && "in" in filter) {
                const list = (filter as { in: unknown }).in;
                return Array.isArray(list) && list.includes(status);
            }
            return false;
        };
        mockDb.returnRequest.updateMany.mockImplementation(
            async ({
                where,
                data,
            }: {
                where: { id: string };
                data: { status: string };
            }) => {
                rmaStatus.set(where.id, data.status);
                return { count: 1 };
            }
        );
        mockDb.returnRequestItem.findMany.mockImplementation(async () => [
            {
                orderItemId: ITEM_ID,
                quantity: 1,
                orderItem: { price: new Prisma.Decimal("100"), quantity: 2 },
            },
        ]);
        mockDb.$queryRaw.mockImplementation(async () => [
            { id: ITEM_ID, status: itemStatus, sizeId: "s1" },
        ]);
        mockDb.returnRequestItem.groupBy.mockImplementation(
            async ({
                where,
            }: {
                where: { returnRequest: { status: unknown } };
            }) => {
                const sum = [...rmaStatus.values()].filter((status) =>
                    matchesStatus(status, where.returnRequest.status)
                ).length;
                return sum > 0
                    ? [{ orderItemId: ITEM_ID, _sum: { quantity: sum } }]
                    : [];
            }
        );
        mockDb.orderItem.updateManyAndReturn.mockImplementation(async () => {
            itemStatus = ProductStatus.Returned;
            return [];
        });

        // Act
        await resolveReturnRequest(STORE_URL, NEWER_ID);
        await resolveReturnRequest(STORE_URL, OLDER_ID);

        // Assert: どちらの RMA も 1 個分の返金額を持ち、item は 2 件目の解決で初めて終端になる
        const amounts = mockDb.returnRequest.update.mock.calls.map(
            ([arg]: [{ data: { refundAmount: Prisma.Decimal } }]) =>
                arg.data.refundAmount.toFixed(2)
        );
        expect(amounts).toEqual(["100.00", "100.00"]);
        expect(mockDb.orderItem.updateManyAndReturn).toHaveBeenCalledTimes(1);
    });
});

// ==================================================
// admin / 顧客
// ==================================================
describe("admin の遷移", () => {
    it("admin でなければ 'Only admins can perform this action.' で拒否する", async () => {
        // Arrange
        mockAuth(SELLER_ID, "SELLER");

        // Act & Assert
        await expect(approveReturnRequestAsAdmin(RMA_ID)).rejects.toThrow(
            "Only admins can perform this action."
        );
        expect(mockDb.$transaction).not.toHaveBeenCalled();
    });

    it("運営の取り消し（T8）は店舗スコープなしで、顧客と seller の両方に通知する", async () => {
        // Arrange
        mockAuth("admin-001", "ADMIN");
        mockDb.returnRequest.updateMany.mockResolvedValue({ count: 1 });

        // Act
        const status = await cancelReturnRequestAsAdmin(RMA_ID);

        // Assert
        expect(status).toBe("CANCELED");
        expect(mockDb.returnRequest.updateMany.mock.calls[0][0].where).toEqual({
            id: RMA_ID,
            status: { in: ["REQUESTED", "APPROVED"] },
        });
        expect(mockRecordNotification).toHaveBeenCalledWith(mockDb, {
            returnRequestId: RMA_ID,
            status: "CANCELED",
            recipients: ["customer", "seller"],
        });
    });
});

describe("顧客の操作", () => {
    it("取り下げ（T4）は申請者の userId で絞り、seller に通知する", async () => {
        // Arrange
        mockAuth(USER_ID, "USER");
        mockDb.returnRequest.updateMany.mockResolvedValue({ count: 1 });

        // Act
        await cancelReturnRequest(RMA_ID);

        // Assert
        expect(mockDb.returnRequest.updateMany.mock.calls[0][0].where).toEqual({
            id: RMA_ID,
            userId: USER_ID,
            status: { in: ["REQUESTED", "APPROVED"] },
        });
        expect(mockRecordNotification.mock.calls[0][1].recipients).toEqual([
            "seller",
        ]);
    });

    it("追跡番号は APPROVED のときだけ書ける。それ以外は理由を返す", async () => {
        // Arrange
        mockAuth(USER_ID, "USER");
        mockDb.returnRequest.updateMany.mockResolvedValue({ count: 0 });
        mockDb.returnRequest.findFirst.mockResolvedValue({ id: RMA_ID });

        // Act & Assert
        await expect(
            setReturnTrackingNumber(RMA_ID, "TRACK-1")
        ).rejects.toThrow(
            "Return request is not in a valid state for this action."
        );
        expect(mockDb.returnRequest.updateMany).toHaveBeenCalledWith({
            where: { id: RMA_ID, userId: USER_ID, status: "APPROVED" },
            data: { returnTrackingNumber: "TRACK-1" },
        });
    });

    it("追跡番号が空なら拒否する", async () => {
        // Arrange
        mockAuth(USER_ID, "USER");

        // Act & Assert
        await expect(setReturnTrackingNumber(RMA_ID, " ")).rejects.toThrow(
            "Invalid tracking number."
        );
        expect(mockDb.$transaction).not.toHaveBeenCalled();
    });
});

describe("getStoreReturnRequests", () => {
    it("未知の状態で絞り込もうとすると拒否する", async () => {
        // Arrange
        mockSellerOwnsStore();

        // Act & Assert
        await expect(
            getStoreReturnRequests(
                STORE_URL,
                "BOGUS" as Parameters<typeof getStoreReturnRequests>[1]
            )
        ).rejects.toThrow("Invalid return request status.");
        expect(mockDb.returnRequest.findMany).not.toHaveBeenCalled();
    });

    it("所有店舗の storeId で絞り込む", async () => {
        // Arrange
        mockSellerOwnsStore();
        mockDb.returnRequest.findMany.mockResolvedValue([]);

        // Act
        await getStoreReturnRequests(STORE_URL, "REQUESTED");

        // Assert
        expect(mockDb.returnRequest.findMany.mock.calls[0][0].where).toEqual({
            storeId: STORE_ID,
            status: "REQUESTED",
        });
    });
});
