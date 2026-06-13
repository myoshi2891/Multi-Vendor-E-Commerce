import { currentUser } from "@clerk/nextjs/server";
import {
    getOrder,
    updateOrderGroupStatus,
    updateOrderItemStatus,
    getAllOrders,
    getOrderForAdmin,
    updateOrderGroupStatusAsAdmin,
    updateOrderItemStatusAsAdmin,
    updateOrderPaymentStatus,
} from "./order";
import { OrderStatus, PaymentStatus, ProductStatus } from "../lib/types";
import { AssertionHelpers } from "../config/test-helpers";
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
            findMany: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
        },
        store: {
            findUnique: jest.fn(),
        },
        orderGroup: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
        },
        orderItem: {
            findUnique: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
        },
        $transaction: jest.fn(),
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
            expect(result?.groups).toHaveLength(1);
            expect(result?.groups[0].items).toHaveLength(1);
            expect(result?.shippingAddress).toBeDefined();
            expect(result?.paymentDetails).toBeDefined();
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

// ==================================================
// getAllOrders（admin・全店舗横断）
// ==================================================
describe("getAllOrders", () => {
    describe("認可エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await AssertionHelpers.expectAuthError(getAllOrders());
        });

        // (a) スロー検証: ADMIN 以外は拒否される
        it("ADMINロール以外の場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });

            await AssertionHelpers.expectRoleError(getAllOrders(), "admins");
        });

        // (c) 副作用なし検証: 認可失敗時に DB へ到達しない
        it("認可失敗時にDBクエリを実行しない", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "USER" },
            });

            await expect(getAllOrders()).rejects.toThrow(
                "Only admins can perform this action."
            );
            AssertionHelpers.expectNotCalled(mockDb.order.findMany);
            AssertionHelpers.expectNotCalled(mockDb.order.count);
        });
    });

    describe("正常系（ADMIN）", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            mockDb.order.findMany.mockResolvedValue([]);
            mockDb.order.count.mockResolvedValue(0);
        });

        // (b) where 構造検証: admin は userId フィルタ無しで全店舗横断
        it("userIdフィルタ無しで全注文を取得する", async () => {
            await getAllOrders();

            const callArg = mockDb.order.findMany.mock.calls[0][0];
            expect(callArg.where).not.toHaveProperty("userId");
            expect(callArg.orderBy).toEqual({ createdAt: "desc" });
        });

        it("limit=500000 は 100 にキャップされる（DoS防止）", async () => {
            const result = await getAllOrders({ limit: 500000 });

            expect(mockDb.order.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ take: 100 })
            );
            expect(result.limit).toBe(100);
        });

        it("page/limit から skip を算出する", async () => {
            await getAllOrders({ page: 3, limit: 20 });

            expect(mockDb.order.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ skip: 40, take: 20 })
            );
        });

        it("paymentStatus / orderStatus / search を where に合成する", async () => {
            await getAllOrders({
                paymentStatus: "Paid" as never,
                orderStatus: "Shipped" as never,
                search: "abc",
            });

            expect(mockDb.order.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        paymentStatus: "Paid",
                        orderStatus: "Shipped",
                        id: { contains: "abc" },
                    },
                })
            );
        });

        it("orders / total / page / limit を返す", async () => {
            mockDb.order.findMany.mockResolvedValue([createMockOrder()]);
            mockDb.order.count.mockResolvedValue(1);

            const result = await getAllOrders({ page: 1, limit: 20 });

            expect(result.total).toBe(1);
            expect(result.orders).toHaveLength(1);
            expect(result.page).toBe(1);
            expect(result.limit).toBe(20);
        });
    });
});

// ==================================================
// getOrderForAdmin（admin・userId フィルタ無し）
// ==================================================
describe("getOrderForAdmin", () => {
    describe("認可エラー", () => {
        it("ADMINロール以外の場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });

            await AssertionHelpers.expectRoleError(
                getOrderForAdmin("order-001"),
                "admins"
            );
            AssertionHelpers.expectNotCalled(mockDb.order.findUnique);
        });
    });

    describe("正常系（ADMIN）", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
        });

        // where に userId を含めない（seller 版 getOrder との唯一の差分）
        it("whereにuserIdを含めず注文IDのみで取得する", async () => {
            mockDb.order.findUnique.mockResolvedValue(createMockOrder());

            await getOrderForAdmin("order-001");

            const callArg = mockDb.order.findUnique.mock.calls[0][0];
            expect(callArg.where).toEqual({ id: "order-001" });
            expect(callArg.where).not.toHaveProperty("userId");
        });

        it("存在しない注文の場合nullを返す", async () => {
            mockDb.order.findUnique.mockResolvedValue(null);

            const result = await getOrderForAdmin("nonexistent");

            expect(result).toBeNull();
        });
    });
});

// ==================================================
// updateOrderGroupStatusAsAdmin（admin・親子連動）
// ==================================================
describe("updateOrderGroupStatusAsAdmin", () => {
    // $transaction はコールバックに mockDb を渡して実行する
    const setupTransaction = () => {
        mockDb.$transaction.mockImplementation(
            async (cb: (tx: typeof mockDb) => Promise<unknown>) => cb(mockDb)
        );
    };

    describe("認可エラー", () => {
        it("ADMINロール以外の場合エラーをスローし副作用なし", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });

            await AssertionHelpers.expectRoleError(
                updateOrderGroupStatusAsAdmin(
                    "order-group-001",
                    OrderStatus.Shipped
                ),
                "admins"
            );
            AssertionHelpers.expectNotCalled(mockDb.$transaction);
            AssertionHelpers.expectNotCalled(mockDb.orderGroup.update);
        });
    });

    describe("正常系（ADMIN・親子連動）", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            setupTransaction();
            mockDb.orderGroup.update.mockResolvedValue({
                id: "order-group-001",
                orderId: "order-001",
                status: OrderStatus.Shipped,
            });
            mockDb.order.update.mockResolvedValue({});
        });

        it("店舗所有権チェック無しでOrderGroupを更新する", async () => {
            mockDb.orderGroup.findMany.mockResolvedValue([
                { status: OrderStatus.Shipped },
            ]);

            const result = await updateOrderGroupStatusAsAdmin(
                "order-group-001",
                OrderStatus.Shipped
            );

            expect(result).toBe(OrderStatus.Shipped);
            // where に storeId/userId が含まれない（admin は所有権非依存）
            expect(mockDb.orderGroup.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "order-group-001" },
                    data: { status: OrderStatus.Shipped },
                })
            );
        });

        it("全子GroupがShipped → 親OrderをShippedに集約する", async () => {
            mockDb.orderGroup.findMany.mockResolvedValue([
                { status: OrderStatus.Shipped },
                { status: OrderStatus.Shipped },
            ]);

            await updateOrderGroupStatusAsAdmin(
                "order-group-001",
                OrderStatus.Shipped
            );

            expect(mockDb.order.update).toHaveBeenCalledWith({
                where: { id: "order-001" },
                data: { orderStatus: OrderStatus.Shipped },
            });
        });

        it("一部の子のみShipped → 親をPartiallyShippedに集約する", async () => {
            mockDb.orderGroup.findMany.mockResolvedValue([
                { status: OrderStatus.Shipped },
                { status: OrderStatus.Pending },
            ]);

            await updateOrderGroupStatusAsAdmin(
                "order-group-001",
                OrderStatus.Shipped
            );

            expect(mockDb.order.update).toHaveBeenCalledWith({
                where: { id: "order-001" },
                data: { orderStatus: OrderStatus.PartiallyShipped },
            });
        });

        it("子が混在（Shipped/Delivered無し）→ 親をProcessingに集約する", async () => {
            mockDb.orderGroup.findMany.mockResolvedValue([
                { status: OrderStatus.Pending },
                { status: OrderStatus.Confirmed },
            ]);

            await updateOrderGroupStatusAsAdmin(
                "order-group-001",
                OrderStatus.Confirmed
            );

            expect(mockDb.order.update).toHaveBeenCalledWith({
                where: { id: "order-001" },
                data: { orderStatus: OrderStatus.Processing },
            });
        });

        it("更新と親連動が同一$transaction内で実行される", async () => {
            mockDb.orderGroup.findMany.mockResolvedValue([
                { status: OrderStatus.Shipped },
            ]);

            await updateOrderGroupStatusAsAdmin(
                "order-group-001",
                OrderStatus.Shipped
            );

            expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
        });
    });
});

// ==================================================
// updateOrderItemStatusAsAdmin（admin・配送/履行ステータス）
// ==================================================
describe("updateOrderItemStatusAsAdmin", () => {
    describe("認可エラー", () => {
        it("ADMINロール以外の場合エラーをスローし副作用なし", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });

            await AssertionHelpers.expectRoleError(
                updateOrderItemStatusAsAdmin(
                    "order-item-001",
                    ProductStatus.Shipped
                ),
                "admins"
            );
            AssertionHelpers.expectNotCalled(mockDb.orderItem.update);
        });
    });

    describe("正常系（ADMIN）", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
        });

        it("店舗所有権チェック無しでOrderItemを更新する", async () => {
            mockDb.orderItem.update.mockResolvedValue({
                status: ProductStatus.Shipped,
            });

            const result = await updateOrderItemStatusAsAdmin(
                "order-item-001",
                ProductStatus.Shipped
            );

            expect(result).toBe(ProductStatus.Shipped);
            expect(mockDb.orderItem.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "order-item-001" },
                    data: { status: ProductStatus.Shipped },
                })
            );
        });
    });
});

// ==================================================
// updateOrderPaymentStatus（admin・DBのみ更新・親子連動）
// ==================================================
describe("updateOrderPaymentStatus", () => {
    const setupTransaction = () => {
        mockDb.$transaction.mockImplementation(
            async (cb: (tx: typeof mockDb) => Promise<unknown>) => cb(mockDb)
        );
    };

    describe("認可エラー", () => {
        it("ADMINロール以外の場合エラーをスローし副作用なし", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "USER" },
            });

            await AssertionHelpers.expectRoleError(
                updateOrderPaymentStatus("order-001", PaymentStatus.Paid),
                "admins"
            );
            AssertionHelpers.expectNotCalled(mockDb.$transaction);
        });
    });

    describe("正常系（ADMIN）", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            setupTransaction();
            mockDb.order.update.mockResolvedValue({});
            mockDb.orderGroup.updateMany.mockResolvedValue({ count: 1 });
            mockDb.orderItem.updateMany.mockResolvedValue({ count: 1 });
        });

        it("Paidへの変更ではDBのpaymentStatusのみ更新し子連動しない", async () => {
            const result = await updateOrderPaymentStatus(
                "order-001",
                PaymentStatus.Paid
            );

            expect(result).toBe(PaymentStatus.Paid);
            expect(mockDb.order.update).toHaveBeenCalledWith({
                where: { id: "order-001" },
                data: { paymentStatus: PaymentStatus.Paid },
            });
            // Paid は返金/キャンセルではないため子連動なし
            AssertionHelpers.expectNotCalled(mockDb.orderGroup.updateMany);
            AssertionHelpers.expectNotCalled(mockDb.orderItem.updateMany);
        });

        // AC-F2-5: 親 Cancelled → 子 OrderGroup/OrderItem を同一 tx で連動
        // enum スペル: 親 Cancelled（ll）→ 子 Canceled（l）
        it("Cancelledへの変更で子をCanceledに連動する（スペル写像）", async () => {
            await updateOrderPaymentStatus(
                "order-001",
                PaymentStatus.Cancelled
            );

            expect(mockDb.orderGroup.updateMany).toHaveBeenCalledWith({
                where: { orderId: "order-001" },
                data: { status: OrderStatus.Canceled },
            });
            expect(mockDb.orderItem.updateMany).toHaveBeenCalledWith({
                where: { orderGroup: { orderId: "order-001" } },
                data: { status: ProductStatus.Canceled },
            });
        });

        it("Refundedへの変更で子をRefundedに連動する", async () => {
            await updateOrderPaymentStatus(
                "order-001",
                PaymentStatus.Refunded
            );

            expect(mockDb.orderGroup.updateMany).toHaveBeenCalledWith({
                where: { orderId: "order-001" },
                data: { status: OrderStatus.Refunded },
            });
            expect(mockDb.orderItem.updateMany).toHaveBeenCalledWith({
                where: { orderGroup: { orderId: "order-001" } },
                data: { status: ProductStatus.Refunded },
            });
        });

        // AC-F2-6: 外部決済 API（Stripe/PayPal）を呼ばない
        it("子連動は同一$transaction内で実行される（決済APIは呼ばない）", async () => {
            await updateOrderPaymentStatus(
                "order-001",
                PaymentStatus.Refunded
            );

            expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
        });
    });
});
