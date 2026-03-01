import { currentUser } from "@clerk/nextjs/server";
import { getOrder, updateOrderGroupStatus, updateOrderItemStatus } from "./order";
import { TEST_CONFIG } from "../config/test-config";
import {
    createMockStore,
    createMockOrder,
    createMockOrderGroup,
    createMockOrderItem,
    createMockShippingAddress,
    createMockPaymentDetails,
    createMockCoupon,
} from "../config/test-fixtures";

// ---- モック設定 ----
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
    db: {
        order: {
            findUnique: jest.fn(),
        },
        store: {
            findUnique: jest.fn(),
        },
        orderGroup: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        orderItem: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    },
}));

const mockDb = require("@/lib/db").db;

beforeEach(() => {
    jest.clearAllMocks();
});

// ==================================================
// getOrder
// ==================================================
describe("getOrder", () => {
    describe("認証エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(getOrder("order-001")).rejects.toThrow(
                "Unauthenticated."
            );
        });
    });

    describe("IDOR防止", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
        });

        it("他人の注文を取得できない（userIdでフィルタ）", async () => {
            // findUniqueはwhere条件にuserIdを含むため、他人の注文はnullが返る
            mockDb.order.findUnique.mockResolvedValue(null);

            const result = await getOrder("other-user-order");

            expect(result).toBeNull();
            expect(mockDb.order.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        id: "other-user-order",
                        userId: TEST_CONFIG.DEFAULT_USER_ID,
                    },
                })
            );
        });
    });

    describe("正常系", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
        });

        it("注文詳細を正常に取得する（groups / items / store / shippingAddress / paymentDetails含む）", async () => {
            const orderData = {
                ...createMockOrder(),
                groups: [
                    {
                        ...createMockOrderGroup(),
                        items: [createMockOrderItem()],
                        store: createMockStore(),
                        coupon: null,
                        _count: { items: 1 },
                    },
                ],
                shippingAddress: {
                    ...createMockShippingAddress(),
                    country: { id: "country-001", name: "Japan", code: "JP" },
                    user: { id: TEST_CONFIG.DEFAULT_USER_ID, name: "Test User" },
                },
                paymentDetails: createMockPaymentDetails(),
            };
            mockDb.order.findUnique.mockResolvedValue(orderData);

            const result = await getOrder("order-001");

            expect(result).toEqual(orderData);
            expect(result.groups).toHaveLength(1);
            expect(result.groups[0].items).toHaveLength(1);
            expect(result.shippingAddress).toBeDefined();
            expect(result.paymentDetails).toBeDefined();
        });

        it("includeオプションにgroups, shippingAddress, paymentDetailsが含まれる", async () => {
            mockDb.order.findUnique.mockResolvedValue(createMockOrder());

            await getOrder("order-001");

            expect(mockDb.order.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    include: expect.objectContaining({
                        groups: expect.any(Object),
                        shippingAddress: expect.any(Object),
                        paymentDetails: true,
                    }),
                })
            );
        });

        it("groupsがtotal降順でソートされる", async () => {
            mockDb.order.findUnique.mockResolvedValue(createMockOrder());

            await getOrder("order-001");

            expect(mockDb.order.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    include: expect.objectContaining({
                        groups: expect.objectContaining({
                            orderBy: { total: "desc" },
                        }),
                    }),
                })
            );
        });

        it("存在しない注文の場合nullを返す", async () => {
            mockDb.order.findUnique.mockResolvedValue(null);

            const result = await getOrder("nonexistent");

            expect(result).toBeNull();
        });
    });
});

// ==================================================
// updateOrderGroupStatus
// ==================================================
describe("updateOrderGroupStatus", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(
                updateOrderGroupStatus(
                    TEST_CONFIG.DEFAULT_STORE_ID,
                    "order-group-001",
                    "Confirmed" as never
                )
            ).rejects.toThrow("Unauthenticated.");
        });

        it("SELLERロール以外の場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "USER" },
            });

            await expect(
                updateOrderGroupStatus(
                    TEST_CONFIG.DEFAULT_STORE_ID,
                    "order-group-001",
                    "Confirmed" as never
                )
            ).rejects.toThrow("Only sellers can perform this action.");
        });
    });

    describe("IDOR防止（ストア所有権検証）", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
        });

        it("他人のストアのOrderGroupを更新できない", async () => {
            // ストアが見つからない（userId不一致）
            mockDb.store.findUnique.mockResolvedValue(null);

            await expect(
                updateOrderGroupStatus(
                    "other-store",
                    "order-group-001",
                    "Confirmed" as never
                )
            ).rejects.toThrow(
                "Unauthorized to update order group status."
            );

            expect(mockDb.store.findUnique).toHaveBeenCalledWith({
                where: {
                    id: "other-store",
                    userId: TEST_CONFIG.DEFAULT_USER_ID,
                },
            });
        });
    });

    describe("バリデーション", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
        });

        it("存在しないOrderGroupの場合エラーをスローする", async () => {
            mockDb.orderGroup.findUnique.mockResolvedValue(null);

            await expect(
                updateOrderGroupStatus(
                    TEST_CONFIG.DEFAULT_STORE_ID,
                    "nonexistent",
                    "Confirmed" as never
                )
            ).rejects.toThrow("Order not found");
        });
    });

    describe("ステータス更新（正常系）", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
        });

        const validTransitions = [
            { from: "Pending", to: "Confirmed" },
            { from: "Confirmed", to: "Processing" },
            { from: "Processing", to: "Shipped" },
            { from: "Shipped", to: "Delivered" },
            { from: "Pending", to: "Canceled" },
        ];

        validTransitions.forEach(({ from, to }) => {
            it(`${from} → ${to} の遷移が正常に行われる`, async () => {
                mockDb.orderGroup.findUnique.mockResolvedValue(
                    createMockOrderGroup({ status: from })
                );
                mockDb.orderGroup.update.mockResolvedValue(
                    createMockOrderGroup({ status: to })
                );

                const result = await updateOrderGroupStatus(
                    TEST_CONFIG.DEFAULT_STORE_ID,
                    "order-group-001",
                    to as never
                );

                expect(result).toBe(to);
                expect(mockDb.orderGroup.update).toHaveBeenCalledWith({
                    where: { id: "order-group-001" },
                    data: { status: to },
                });
            });
        });

        it("ストアIDでOrderGroupをフィルタする", async () => {
            mockDb.orderGroup.findUnique.mockResolvedValue(
                createMockOrderGroup()
            );
            mockDb.orderGroup.update.mockResolvedValue(
                createMockOrderGroup({ status: "Confirmed" })
            );

            await updateOrderGroupStatus(
                TEST_CONFIG.DEFAULT_STORE_ID,
                "order-group-001",
                "Confirmed" as never
            );

            expect(mockDb.orderGroup.findUnique).toHaveBeenCalledWith({
                where: {
                    id: "order-group-001",
                    storeId: TEST_CONFIG.DEFAULT_STORE_ID,
                },
            });
        });
    });
});

// ==================================================
// updateOrderItemStatus
// ==================================================
describe("updateOrderItemStatus", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(
                updateOrderItemStatus(
                    TEST_CONFIG.DEFAULT_STORE_ID,
                    "order-item-001",
                    "Processing" as never
                )
            ).rejects.toThrow("Unauthenticated.");
        });

        it("SELLERロール以外の場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "USER" },
            });

            await expect(
                updateOrderItemStatus(
                    TEST_CONFIG.DEFAULT_STORE_ID,
                    "order-item-001",
                    "Processing" as never
                )
            ).rejects.toThrow("Only sellers can perform this action.");
        });
    });

    describe("IDOR防止（ストア所有権検証）", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
        });

        it("他人のストアのOrderItemを更新できない", async () => {
            mockDb.store.findUnique.mockResolvedValue(null);

            await expect(
                updateOrderItemStatus(
                    "other-store",
                    "order-item-001",
                    "Processing" as never
                )
            ).rejects.toThrow(
                "Unauthorized to update order item status."
            );
        });
    });

    describe("バリデーション", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
        });

        it("存在しないOrderItemの場合エラーをスローする", async () => {
            mockDb.orderItem.findUnique.mockResolvedValue(null);

            await expect(
                updateOrderItemStatus(
                    TEST_CONFIG.DEFAULT_STORE_ID,
                    "nonexistent",
                    "Processing" as never
                )
            ).rejects.toThrow("Order item not found");
        });
    });

    describe("正常系", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
        });

        it("OrderItemのステータスを正常に更新する", async () => {
            mockDb.orderItem.findUnique.mockResolvedValue(
                createMockOrderItem({ status: "Pending" })
            );
            mockDb.orderItem.update.mockResolvedValue(
                createMockOrderItem({ status: "Processing" })
            );

            const result = await updateOrderItemStatus(
                TEST_CONFIG.DEFAULT_STORE_ID,
                "order-item-001",
                "Processing" as never
            );

            expect(result).toBe("Processing");
            expect(mockDb.orderItem.update).toHaveBeenCalledWith({
                where: { id: "order-item-001" },
                data: { status: "Processing" },
            });
        });

        it("Shipped → Delivered の遷移が正常に行われる", async () => {
            mockDb.orderItem.findUnique.mockResolvedValue(
                createMockOrderItem({ status: "Shipped" })
            );
            mockDb.orderItem.update.mockResolvedValue(
                createMockOrderItem({ status: "Delivered" })
            );

            const result = await updateOrderItemStatus(
                TEST_CONFIG.DEFAULT_STORE_ID,
                "order-item-001",
                "Delivered" as never
            );

            expect(result).toBe("Delivered");
        });

        it("Canceled ステータスに更新できる", async () => {
            mockDb.orderItem.findUnique.mockResolvedValue(
                createMockOrderItem({ status: "Pending" })
            );
            mockDb.orderItem.update.mockResolvedValue(
                createMockOrderItem({ status: "Canceled" })
            );

            const result = await updateOrderItemStatus(
                TEST_CONFIG.DEFAULT_STORE_ID,
                "order-item-001",
                "Canceled" as never
            );

            expect(result).toBe("Canceled");
        });
    });
});
