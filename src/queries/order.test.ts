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
    trackOrder,
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
            updateMany: jest.fn(),
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
            findFirst: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
            // 在庫復元の入口 settleOrderItems（plan 087）。既定は「遷移した item 無し」
            updateManyAndReturn: jest.fn().mockResolvedValue([]),
        },
        size: {
            update: jest.fn(),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        // updateOrderGroupStatus が tx 内で更新前の状態をロックして読む（plan 086）
        $queryRaw: jest.fn().mockResolvedValue([]),
        $transaction: jest.fn(),
    },
}));

// 通知（plan 086）。記録は tx の中、送信予約は commit 後に呼ばれることを検証する
jest.mock("@/lib/notifications/order-events", () => ({
    recordOrderGroupStatusNotification: jest.fn().mockResolvedValue([]),
}));
jest.mock("@/lib/notifications/schedule", () => ({
    scheduleDispatch: jest.fn(),
}));

const mockDb = require("@/lib/db").db;
const {
    recordOrderGroupStatusNotification: mockRecordGroupNotification,
} = require("@/lib/notifications/order-events");
const {
    scheduleDispatch: mockScheduleDispatch,
} = require("@/lib/notifications/schedule");

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
                    user: {
                        id: TEST_CONFIG.DEFAULT_USER_ID,
                        name: "Test User",
                    },
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

    describe("DB エラー", () => {
        let errSpy: jest.SpyInstance;

        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        });
        afterEach(() => errSpy.mockRestore());

        it("DBクエリ失敗時に汎用メッセージへ変換してスローする", async () => {
            // Arrange —— admin 版 getOrderForAdmin と同形。失敗を握り潰して null を
            // 返すと「他人の注文（IDOR で弾かれた）」と区別できなくなる。
            mockDb.order.findUnique.mockRejectedValue(new Error("db down"));

            // Act / Assert
            await expect(getOrder("order-001")).rejects.toThrow(
                "Failed to fetch order."
            );
            expect(errSpy).toHaveBeenCalled();
        });
    });
});

// ==================================================
// updateOrderGroupStatus
// ==================================================
describe("updateOrderGroupStatus", () => {
    // 更新は $transaction の中で行う（通知の記録と原子的にするため・plan 086）
    beforeEach(() => {
        mockDb.$transaction.mockImplementation(
            async (cb: (tx: typeof mockDb) => Promise<unknown>) => cb(mockDb)
        );
    });

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
            ).rejects.toThrow("Unauthorized to update order group status.");

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

    describe("DB エラー", () => {
        let errSpy: jest.SpyInstance;

        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
            errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        });
        afterEach(() => errSpy.mockRestore());

        it("ストア照会の失敗を汎用メッセージへ変換してスローする", async () => {
            // Arrange
            mockDb.store.findUnique.mockRejectedValue(new Error("db down"));

            // Act / Assert —— 所有権拒否の文言と混ざらないこと
            await expect(
                updateOrderGroupStatus(
                    TEST_CONFIG.DEFAULT_STORE_ID,
                    "order-group-001",
                    "Confirmed" as never
                )
            ).rejects.toThrow("Failed to update order group status.");
            expect(errSpy).toHaveBeenCalled();
        });

        it("ステータス更新の失敗を汎用メッセージへ変換してスローする", async () => {
            // Arrange
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
            mockDb.orderGroup.findUnique.mockResolvedValue(
                createMockOrderGroup()
            );
            mockDb.orderGroup.update.mockRejectedValue(new Error("db down"));

            // Act / Assert
            await expect(
                updateOrderGroupStatus(
                    TEST_CONFIG.DEFAULT_STORE_ID,
                    "order-group-001",
                    "Confirmed" as never
                )
            ).rejects.toThrow("Failed to update order group status.");
            expect(errSpy).toHaveBeenCalled();
        });

        it("所有権の拒否は DB エラーの文言で上書きしない（ログもしない）", async () => {
            // Arrange —— 認可の拒否は catch を通らない経路であること
            mockDb.store.findUnique.mockResolvedValue(null);

            // Act / Assert
            await expect(
                updateOrderGroupStatus(
                    "other-store",
                    "order-group-001",
                    "Confirmed" as never
                )
            ).rejects.toThrow("Unauthorized to update order group status.");
            expect(errSpy).not.toHaveBeenCalled();
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
    // 読み取り・遷移・在庫復元は 1 つの $transaction の中で行う（plan 087・経路 D）
    beforeEach(() => {
        mockDb.$transaction.mockImplementation(
            async (cb: (tx: typeof mockDb) => Promise<unknown>) => cb(mockDb)
        );
        // clearAllMocks は実装を消さないため、前のテストの戻り値を持ち越さないよう既定に戻す
        mockDb.orderItem.updateManyAndReturn.mockResolvedValue([]);
    });

    const scopedWhere = (id: string) => ({
        id,
        orderGroup: { storeId: TEST_CONFIG.DEFAULT_STORE_ID },
    });
    const NOT_SETTLED = {
        status: {
            notIn: [
                ProductStatus.Canceled,
                ProductStatus.Refunded,
                ProductStatus.Returned,
            ],
        },
    };

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
            ).rejects.toThrow("Unauthorized to update order item status.");
        });

        it("他店舗の OrderItem は更新できない（店舗スコープで見つからない → not found）", async () => {
            // Arrange
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
            mockDb.orderItem.findFirst.mockResolvedValue(null);

            // Act + Assert (a) スロー
            await expect(
                updateOrderItemStatus(
                    TEST_CONFIG.DEFAULT_STORE_ID,
                    "victim-item",
                    ProductStatus.Canceled
                )
            ).rejects.toThrow("Order item not found");

            // (b) where 構造: 所有店舗でスコープしている
            expect(mockDb.orderItem.findFirst).toHaveBeenCalledWith({
                where: scopedWhere("victim-item"),
                select: { status: true },
            });
            // (c) 副作用なし: 遷移も在庫復元も起きない
            AssertionHelpers.expectNotCalled(mockDb.orderItem.updateMany);
            AssertionHelpers.expectNotCalled(
                mockDb.orderItem.updateManyAndReturn
            );
            AssertionHelpers.expectNotCalled(mockDb.size.updateMany);
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
            mockDb.orderItem.findFirst.mockResolvedValue(null);

            await expect(
                updateOrderItemStatus(
                    TEST_CONFIG.DEFAULT_STORE_ID,
                    "nonexistent",
                    "Processing" as never
                )
            ).rejects.toThrow("Order item not found");
        });

        // tech.md「外部呼び出し（Prisma）は必ず try/catch でラップ」。
        // 生の Prisma エラーは接続文字列等を含みうるため、UI へ素通しさせない。
        it("DB エラー時は構造化ログを出し、汎用エラーに変換する", async () => {
            const consoleSpy = AssertionHelpers.mockConsoleError();
            mockDb.orderItem.findFirst.mockRejectedValue(
                new Error("connection terminated unexpectedly")
            );

            await expect(
                updateOrderItemStatus(
                    TEST_CONFIG.DEFAULT_STORE_ID,
                    "order-item-001",
                    "Processing" as never
                )
            ).rejects.toThrow("Failed to update order item status.");

            expect(consoleSpy).toHaveBeenCalledWith(
                "[Order:updateOrderItemStatus] status update failed",
                expect.objectContaining({
                    error: "connection terminated unexpectedly",
                })
            );
            consoleSpy.mockRestore();
        });

        // 「見つからない」「精算済み」は判定であり、DB 障害の汎用エラーで
        // 上書きしてはならない（判定の throw は try/catch の外に置く）。
        it("DB エラーの汎用化が Order item not found を潰さない", async () => {
            mockDb.orderItem.findFirst.mockResolvedValue(null);

            await expect(
                updateOrderItemStatus(
                    TEST_CONFIG.DEFAULT_STORE_ID,
                    "nonexistent",
                    "Processing" as never
                )
            ).rejects.toThrow("Order item not found");
        });

        it("終端 → 非終端は already settled で拒否し、書き込みしない（吸収状態・plan 087）", async () => {
            // Arrange
            mockDb.orderItem.findFirst.mockResolvedValue({
                status: ProductStatus.Canceled,
            });

            // Act + Assert
            await expect(
                updateOrderItemStatus(
                    TEST_CONFIG.DEFAULT_STORE_ID,
                    "order-item-001",
                    ProductStatus.Processing
                )
            ).rejects.toThrow("Order item is already settled.");
            AssertionHelpers.expectNotCalled(mockDb.orderItem.updateMany);
            AssertionHelpers.expectNotCalled(mockDb.size.updateMany);
        });

        it("非終端 → 非終端の更新中に他経路で精算されたら already settled で拒否する", async () => {
            // Arrange: 読み取り時は非終端、条件付き更新の時点では終端（count 0）
            mockDb.orderItem.findFirst.mockResolvedValue({
                status: ProductStatus.Pending,
            });
            mockDb.orderItem.updateMany.mockResolvedValue({ count: 0 });

            // Act + Assert
            await expect(
                updateOrderItemStatus(
                    TEST_CONFIG.DEFAULT_STORE_ID,
                    "order-item-001",
                    ProductStatus.Shipped
                )
            ).rejects.toThrow("Order item is already settled.");
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

        it("OrderItemのステータスを正常に更新する（非終端 → 非終端は条件付き更新）", async () => {
            // Arrange
            mockDb.orderItem.findFirst.mockResolvedValue({
                status: ProductStatus.Pending,
            });
            mockDb.orderItem.updateMany.mockResolvedValue({ count: 1 });

            // Act
            const result = await updateOrderItemStatus(
                TEST_CONFIG.DEFAULT_STORE_ID,
                "order-item-001",
                "Processing" as never
            );

            // Assert
            expect(result).toBe("Processing");
            expect(mockDb.orderItem.updateMany).toHaveBeenCalledWith({
                where: { AND: [scopedWhere("order-item-001"), NOT_SETTLED] },
                data: { status: "Processing" },
            });
            AssertionHelpers.expectNotCalled(mockDb.size.updateMany);
        });

        it("Shipped → Delivered の遷移が正常に行われる", async () => {
            mockDb.orderItem.findFirst.mockResolvedValue({
                status: ProductStatus.Shipped,
            });
            mockDb.orderItem.updateMany.mockResolvedValue({ count: 1 });

            const result = await updateOrderItemStatus(
                TEST_CONFIG.DEFAULT_STORE_ID,
                "order-item-001",
                "Delivered" as never
            );

            expect(result).toBe("Delivered");
        });

        it("非終端 → Canceled で遷移した item の在庫を戻す", async () => {
            // Arrange
            mockDb.orderItem.findFirst.mockResolvedValue({
                status: ProductStatus.Pending,
            });
            mockDb.orderItem.updateManyAndReturn.mockResolvedValue([
                { id: "order-item-001", sizeId: "size-001", quantity: 2 },
            ]);

            // Act
            const result = await updateOrderItemStatus(
                TEST_CONFIG.DEFAULT_STORE_ID,
                "order-item-001",
                ProductStatus.Canceled
            );

            // Assert: 店舗スコープ付きの条件付き遷移 → 遷移した行だけ復元
            expect(result).toBe(ProductStatus.Canceled);
            expect(mockDb.orderItem.updateManyAndReturn).toHaveBeenCalledWith({
                where: { AND: [scopedWhere("order-item-001"), NOT_SETTLED] },
                data: { status: ProductStatus.Canceled },
                select: { id: true, sizeId: true, quantity: true },
            });
            expect(mockDb.size.updateMany).toHaveBeenCalledWith({
                where: { id: "size-001" },
                data: { quantity: { increment: 2 } },
            });
        });

        it("終端 → 別の終端は付け替えのみで在庫を戻さない", async () => {
            // Arrange: すでに Canceled（updateManyAndReturn は既定で [] = 遷移なし）
            mockDb.orderItem.findFirst.mockResolvedValue({
                status: ProductStatus.Canceled,
            });
            mockDb.orderItem.updateMany.mockResolvedValue({ count: 1 });

            // Act
            const result = await updateOrderItemStatus(
                TEST_CONFIG.DEFAULT_STORE_ID,
                "order-item-001",
                ProductStatus.Refunded
            );

            // Assert
            expect(result).toBe(ProductStatus.Refunded);
            expect(mockDb.orderItem.updateMany).toHaveBeenCalledWith({
                where: scopedWhere("order-item-001"),
                data: { status: ProductStatus.Refunded },
            });
            AssertionHelpers.expectNotCalled(mockDb.size.updateMany);
        });

        it("終端への遷移も付け替えも 0 件なら成功扱いにしない", async () => {
            // Arrange: 読んだ後に行が消えた（遷移 [] かつ付け替え count 0）
            mockDb.orderItem.findFirst.mockResolvedValue({
                status: ProductStatus.Canceled,
            });
            mockDb.orderItem.updateMany.mockResolvedValue({ count: 0 });

            // Act & Assert
            await expect(
                updateOrderItemStatus(
                    TEST_CONFIG.DEFAULT_STORE_ID,
                    "order-item-001",
                    ProductStatus.Refunded
                )
            ).rejects.toThrow("Order item is already settled.");
            AssertionHelpers.expectNotCalled(mockDb.size.updateMany);
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

        it("page=1e12 は 10_000 にキャップされる（DoS防止）", async () => {
            const result = await getAllOrders({ page: 1e12, limit: 50 });

            // クランプが無いと skip=(1e12-1)*50≒5e13 となり、巨大 OFFSET による
            // 過大な DB スキャンと Number.MAX_SAFE_INTEGER 超えの精度喪失を招く
            expect(mockDb.order.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ skip: (10_000 - 1) * 50, take: 50 })
            );
            expect(result.page).toBe(10_000);
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

    describe("異常系（DBエラー）", () => {
        let errSpy: jest.SpyInstance;
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        });
        afterEach(() => errSpy.mockRestore());

        it("DBクエリ失敗時に汎用メッセージへ変換してスローする", async () => {
            mockDb.order.findMany.mockRejectedValue(new Error("db down"));
            mockDb.order.count.mockResolvedValue(0);

            await expect(getAllOrders()).rejects.toThrow(
                "Failed to fetch orders."
            );
            expect(errSpy).toHaveBeenCalled();
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

    describe("異常系（DBエラー）", () => {
        let errSpy: jest.SpyInstance;
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        });
        afterEach(() => errSpy.mockRestore());

        it("DBクエリ失敗時に汎用メッセージへ変換してスローする", async () => {
            mockDb.order.findUnique.mockRejectedValue(new Error("db down"));

            await expect(getOrderForAdmin("order-001")).rejects.toThrow(
                "Failed to fetch order."
            );
            expect(errSpy).toHaveBeenCalled();
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

        it("全子GroupがDelivered → 親OrderをDeliveredに集約する", async () => {
            mockDb.orderGroup.findMany.mockResolvedValue([
                { status: OrderStatus.Delivered },
                { status: OrderStatus.Delivered },
            ]);

            await updateOrderGroupStatusAsAdmin(
                "order-group-001",
                OrderStatus.Delivered
            );

            expect(mockDb.order.update).toHaveBeenCalledWith({
                where: { id: "order-001" },
                data: { orderStatus: OrderStatus.Delivered },
            });
        });

        it("全子GroupがCanceled → 親OrderをCanceledに集約する", async () => {
            mockDb.orderGroup.findMany.mockResolvedValue([
                { status: OrderStatus.Canceled },
                { status: OrderStatus.Canceled },
            ]);

            await updateOrderGroupStatusAsAdmin(
                "order-group-001",
                OrderStatus.Canceled
            );

            expect(mockDb.order.update).toHaveBeenCalledWith({
                where: { id: "order-001" },
                data: { orderStatus: OrderStatus.Canceled },
            });
        });

        it("全子GroupがRefunded → 親OrderをRefundedに集約する", async () => {
            mockDb.orderGroup.findMany.mockResolvedValue([
                { status: OrderStatus.Refunded },
                { status: OrderStatus.Refunded },
            ]);

            await updateOrderGroupStatusAsAdmin(
                "order-group-001",
                OrderStatus.Refunded
            );

            expect(mockDb.order.update).toHaveBeenCalledWith({
                where: { id: "order-001" },
                data: { orderStatus: OrderStatus.Refunded },
            });
        });

        it("子Groupが0件のとき親連動をスキップする（早期return）", async () => {
            mockDb.orderGroup.findMany.mockResolvedValue([]);

            await updateOrderGroupStatusAsAdmin(
                "order-group-001",
                OrderStatus.Shipped
            );

            // groups.length === 0 のため親 Order.update は呼ばれない
            AssertionHelpers.expectNotCalled(mockDb.order.update);
        });
    });

    describe("異常系（DBエラー）", () => {
        let errSpy: jest.SpyInstance;
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            setupTransaction();
            errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        });
        afterEach(() => errSpy.mockRestore());

        it("tx内のDB失敗時に元のErrorをそのまま再スローする", async () => {
            mockDb.orderGroup.update.mockRejectedValue(new Error("db down"));

            await expect(
                updateOrderGroupStatusAsAdmin(
                    "order-group-001",
                    OrderStatus.Shipped
                )
            ).rejects.toThrow("db down");
        });
    });
});

// ==================================================
// updateOrderItemStatusAsAdmin（admin・配送/履行ステータス）
// ==================================================
describe("updateOrderItemStatusAsAdmin", () => {
    // 読み取り・遷移・在庫復元は 1 つの $transaction の中で行う（plan 087・経路 C）
    beforeEach(() => {
        mockDb.$transaction.mockImplementation(
            async (cb: (tx: typeof mockDb) => Promise<unknown>) => cb(mockDb)
        );
        // clearAllMocks は実装を消さないため、前のテストの戻り値を持ち越さないよう既定に戻す
        mockDb.orderItem.updateManyAndReturn.mockResolvedValue([]);
    });

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
            AssertionHelpers.expectNotCalled(mockDb.$transaction);
            AssertionHelpers.expectNotCalled(mockDb.orderItem.updateMany);
        });
    });

    describe("正常系（ADMIN）", () => {
        let errSpy: jest.SpyInstance;
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            // 監査ログ（console.error）を握る
            errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        });
        afterEach(() => errSpy.mockRestore());

        it("店舗所有権チェック無しでOrderItemを更新する", async () => {
            // Arrange
            mockDb.orderItem.findUnique.mockResolvedValue({
                status: ProductStatus.Processing,
            });
            mockDb.orderItem.updateMany.mockResolvedValue({ count: 1 });

            // Act
            const result = await updateOrderItemStatusAsAdmin(
                "order-item-001",
                ProductStatus.Shipped
            );

            // Assert
            expect(result).toBe(ProductStatus.Shipped);
            expect(mockDb.orderItem.updateMany).toHaveBeenCalledWith({
                where: {
                    AND: [
                        { id: "order-item-001" },
                        {
                            status: {
                                notIn: [
                                    ProductStatus.Canceled,
                                    ProductStatus.Refunded,
                                    ProductStatus.Returned,
                                ],
                            },
                        },
                    ],
                },
                data: { status: ProductStatus.Shipped },
            });
            AssertionHelpers.expectNotCalled(mockDb.size.updateMany);
        });

        it("非終端 → Returned で遷移した item の在庫を戻す", async () => {
            // Arrange
            mockDb.orderItem.findUnique.mockResolvedValue({
                status: ProductStatus.Delivered,
            });
            mockDb.orderItem.updateManyAndReturn.mockResolvedValue([
                { id: "order-item-001", sizeId: "size-001", quantity: 3 },
            ]);

            // Act
            await updateOrderItemStatusAsAdmin(
                "order-item-001",
                ProductStatus.Returned
            );

            // Assert
            expect(mockDb.size.updateMany).toHaveBeenCalledWith({
                where: { id: "size-001" },
                data: { quantity: { increment: 3 } },
            });
        });

        it("Size が消えていても（count 0）throw せず警告を残して完了する（F-3）", async () => {
            // Arrange
            const warnSpy = jest
                .spyOn(console, "warn")
                .mockImplementation(() => {});
            mockDb.orderItem.findUnique.mockResolvedValue({
                status: ProductStatus.Pending,
            });
            mockDb.orderItem.updateManyAndReturn.mockResolvedValue([
                { id: "order-item-001", sizeId: "gone-size", quantity: 1 },
            ]);
            mockDb.size.updateMany.mockResolvedValueOnce({ count: 0 });

            // Act
            const result = await updateOrderItemStatusAsAdmin(
                "order-item-001",
                ProductStatus.Canceled
            );

            // Assert
            expect(result).toBe(ProductStatus.Canceled);
            expect(warnSpy).toHaveBeenCalledWith(
                "[Order:restockOrderItems] Size not found, skip restock",
                { sizeId: "gone-size" }
            );
            warnSpy.mockRestore();
        });

        it("終端 → 非終端は already settled で拒否し、書き込みしない（吸収状態）", async () => {
            // Arrange
            mockDb.orderItem.findUnique.mockResolvedValue({
                status: ProductStatus.Refunded,
            });

            // Act + Assert
            await expect(
                updateOrderItemStatusAsAdmin(
                    "order-item-001",
                    ProductStatus.Processing
                )
            ).rejects.toThrow("Order item is already settled.");
            AssertionHelpers.expectNotCalled(mockDb.orderItem.updateMany);
            AssertionHelpers.expectNotCalled(mockDb.size.updateMany);
        });

        it("存在しない item は not found で拒否する", async () => {
            mockDb.orderItem.findUnique.mockResolvedValue(null);

            await expect(
                updateOrderItemStatusAsAdmin(
                    "nonexistent",
                    ProductStatus.Canceled
                )
            ).rejects.toThrow("Order item not found");
            AssertionHelpers.expectNotCalled(
                mockDb.orderItem.updateManyAndReturn
            );
        });
    });

    describe("異常系（DBエラー）", () => {
        let errSpy: jest.SpyInstance;
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        });
        afterEach(() => errSpy.mockRestore());

        it("DB失敗時に元のErrorをそのまま再スローする", async () => {
            mockDb.orderItem.findUnique.mockRejectedValue(new Error("db down"));

            await expect(
                updateOrderItemStatusAsAdmin(
                    "order-item-001",
                    ProductStatus.Shipped
                )
            ).rejects.toThrow("db down");
            expect(errSpy).toHaveBeenCalled();
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
            // 条件付き遷移（非終端 → Cancelled/Refunded）が成立した想定（count===1）
            mockDb.order.updateMany.mockResolvedValue({ count: 1 });
            mockDb.orderGroup.updateMany.mockResolvedValue({ count: 1 });
            mockDb.orderItem.updateMany.mockResolvedValue({ count: 1 });
            // 在庫復元の対象 items は空（復元 no-op）
            mockDb.orderItem.findMany.mockResolvedValue([]);
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
            AssertionHelpers.expectNotCalled(
                mockDb.orderItem.updateManyAndReturn
            );
        });

        // AC-F2-5: 親 Cancelled → 子 OrderGroup/OrderItem を同一 tx で連動
        // enum スペル: 親 Cancelled（ll）→ 子 Canceled（l）
        it("Cancelledへの変更で子をCanceledに連動する（スペル写像）", async () => {
            await updateOrderPaymentStatus(
                "order-001",
                PaymentStatus.Cancelled
            );

            // 親 Order は条件付き updateMany（非終端ガード）で paymentStatus と
            // orderStatus を原子的に整合更新する
            expect(mockDb.order.updateMany).toHaveBeenCalledWith({
                where: {
                    id: "order-001",
                    paymentStatus: {
                        notIn: [
                            PaymentStatus.Cancelled,
                            PaymentStatus.Refunded,
                        ],
                    },
                },
                data: {
                    paymentStatus: PaymentStatus.Cancelled,
                    orderStatus: OrderStatus.Canceled,
                },
            });
            expect(mockDb.orderGroup.updateMany).toHaveBeenCalledWith({
                where: { orderId: "order-001" },
                data: { status: OrderStatus.Canceled },
            });
            // item は「まだ終端でないもの」だけを条件付きで遷移させる（plan 087）。
            // 先に Canceled の item を Refunded で上書きしないため、無条件の updateMany ではない
            expect(mockDb.orderItem.updateManyAndReturn).toHaveBeenCalledWith({
                where: {
                    AND: [
                        { orderGroup: { orderId: "order-001" } },
                        {
                            status: {
                                notIn: [
                                    ProductStatus.Canceled,
                                    ProductStatus.Refunded,
                                    ProductStatus.Returned,
                                ],
                            },
                        },
                    ],
                },
                data: { status: ProductStatus.Canceled },
                select: { id: true, sizeId: true, quantity: true },
            });
        });

        it("Refundedへの変更で子をRefundedに連動する", async () => {
            await updateOrderPaymentStatus("order-001", PaymentStatus.Refunded);

            // 親 Order は条件付き updateMany（非終端ガード）で paymentStatus と
            // orderStatus を原子的に整合更新する
            expect(mockDb.order.updateMany).toHaveBeenCalledWith({
                where: {
                    id: "order-001",
                    paymentStatus: {
                        notIn: [
                            PaymentStatus.Cancelled,
                            PaymentStatus.Refunded,
                        ],
                    },
                },
                data: {
                    paymentStatus: PaymentStatus.Refunded,
                    orderStatus: OrderStatus.Refunded,
                },
            });
            expect(mockDb.orderGroup.updateMany).toHaveBeenCalledWith({
                where: { orderId: "order-001" },
                data: { status: OrderStatus.Refunded },
            });
            // item は「まだ終端でないもの」だけを条件付きで遷移させる（plan 087）。
            // 先に Canceled の item を Refunded で上書きしないため、無条件の updateMany ではない
            expect(mockDb.orderItem.updateManyAndReturn).toHaveBeenCalledWith({
                where: {
                    AND: [
                        { orderGroup: { orderId: "order-001" } },
                        {
                            status: {
                                notIn: [
                                    ProductStatus.Canceled,
                                    ProductStatus.Refunded,
                                    ProductStatus.Returned,
                                ],
                            },
                        },
                    ],
                },
                data: { status: ProductStatus.Refunded },
                select: { id: true, sizeId: true, quantity: true },
            });
        });

        // AC-F2-6: 外部決済 API（Stripe/PayPal）を呼ばない
        it("子連動は同一$transaction内で実行される（決済APIは呼ばない）", async () => {
            await updateOrderPaymentStatus("order-001", PaymentStatus.Refunded);

            expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
        });
    });

    describe("異常系（DBエラー）", () => {
        let errSpy: jest.SpyInstance;
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            setupTransaction();
            errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        });
        afterEach(() => errSpy.mockRestore());

        it("tx内のDB失敗時に元のErrorをそのまま再スローする", async () => {
            mockDb.order.update.mockRejectedValue(new Error("db down"));

            await expect(
                updateOrderPaymentStatus("order-001", PaymentStatus.Paid)
            ).rejects.toThrow("db down");
        });
    });
});

// ==================================================
// F3-5: キャンセル/返品時の在庫復元（restock）
// ==================================================
describe("在庫復元（F3-5・restock on cancel/refund）", () => {
    // plan 087: 在庫復元は settleOrderItems（item の条件付き遷移 updateManyAndReturn）が返した
    // 「実際に遷移した item」だけに対して行う。group / order の status は復元の判断に使わない。
    const setupTransaction = () => {
        mockDb.$transaction.mockImplementation(
            async (cb: (tx: typeof mockDb) => Promise<unknown>) => cb(mockDb)
        );
    };
    const NOT_SETTLED = {
        status: {
            notIn: [
                ProductStatus.Canceled,
                ProductStatus.Refunded,
                ProductStatus.Returned,
            ],
        },
    };
    const mockGroupUpdate = (status: OrderStatus) => {
        mockDb.orderGroup.update.mockResolvedValue({
            id: "order-group-001",
            orderId: "order-001",
            status,
        });
        mockDb.orderGroup.findMany.mockResolvedValue([{ status }]);
    };

    beforeEach(() => {
        (currentUser as jest.Mock).mockResolvedValue({
            id: TEST_CONFIG.DEFAULT_USER_ID,
            privateMetadata: { role: "ADMIN" },
        });
        setupTransaction();
        mockDb.order.update.mockResolvedValue({});
        // 既定は「非終端 → 終端」遷移成立（count===1）。冪等ケースは個別に count:0 へ上書き。
        mockDb.order.updateMany.mockResolvedValue({ count: 1 });
        mockDb.orderGroup.updateMany.mockResolvedValue({ count: 1 });
        mockDb.orderItem.updateManyAndReturn.mockResolvedValue([]);
    });

    describe("updateOrderGroupStatusAsAdmin（グループ単位・経路 B）", () => {
        it("非終端 → Canceled で group 内の未精算 item を遷移させ、その在庫を復元する", async () => {
            // Arrange
            mockDb.orderGroup.findUnique.mockResolvedValue({
                status: OrderStatus.Processing,
            });
            mockGroupUpdate(OrderStatus.Canceled);
            mockDb.orderItem.updateManyAndReturn.mockResolvedValue([
                { id: "i1", sizeId: "size-001", quantity: 3 },
                { id: "i2", sizeId: "size-002", quantity: 1 },
            ]);

            // Act
            await updateOrderGroupStatusAsAdmin(
                "order-group-001",
                OrderStatus.Canceled
            );

            // Assert
            expect(mockDb.orderItem.updateManyAndReturn).toHaveBeenCalledWith({
                where: {
                    AND: [{ orderGroupId: "order-group-001" }, NOT_SETTLED],
                },
                data: { status: ProductStatus.Canceled },
                select: { id: true, sizeId: true, quantity: true },
            });
            expect(mockDb.size.updateMany).toHaveBeenCalledTimes(2);
            expect(mockDb.size.updateMany).toHaveBeenCalledWith({
                where: { id: "size-001" },
                data: { quantity: { increment: 3 } },
            });
            expect(mockDb.size.updateMany).toHaveBeenCalledWith({
                where: { id: "size-002" },
                data: { quantity: { increment: 1 } },
            });
        });

        // 冪等性: item がすでに終端なら遷移する行が無く、復元しない（二重復元防止）
        it("Canceled → Canceled の再実行では在庫を復元しない（冪等）", async () => {
            // Arrange: updateManyAndReturn は既定で []（遷移なし）
            mockDb.orderGroup.findUnique.mockResolvedValue({
                status: OrderStatus.Canceled,
            });
            mockGroupUpdate(OrderStatus.Canceled);

            // Act
            await updateOrderGroupStatusAsAdmin(
                "order-group-001",
                OrderStatus.Canceled
            );

            // Assert
            AssertionHelpers.expectNotCalled(mockDb.size.updateMany);
        });

        it("非終端 → Shipped（非終端遷移）では item に触れず在庫も復元しない", async () => {
            mockDb.orderGroup.findUnique.mockResolvedValue({
                status: OrderStatus.Processing,
            });
            mockGroupUpdate(OrderStatus.Shipped);

            await updateOrderGroupStatusAsAdmin(
                "order-group-001",
                OrderStatus.Shipped
            );

            AssertionHelpers.expectNotCalled(
                mockDb.orderItem.updateManyAndReturn
            );
            AssertionHelpers.expectNotCalled(mockDb.size.updateMany);
        });

        // design §7: group の再オープンは許可するが、終端の item は再活性化しない
        it("Canceled → Processing（再オープン）では item を書き換えない", async () => {
            mockDb.orderGroup.findUnique.mockResolvedValue({
                status: OrderStatus.Canceled,
            });
            mockGroupUpdate(OrderStatus.Processing);

            await updateOrderGroupStatusAsAdmin(
                "order-group-001",
                OrderStatus.Processing
            );

            AssertionHelpers.expectNotCalled(mockDb.orderItem.updateMany);
            AssertionHelpers.expectNotCalled(
                mockDb.orderItem.updateManyAndReturn
            );
            AssertionHelpers.expectNotCalled(mockDb.size.updateMany);
        });
    });

    describe("updateOrderGroupStatus（seller・グループ単位・経路 E）", () => {
        it("非終端 → Refunded で group 内の未精算 item を Refunded に遷移させ在庫を戻す", async () => {
            // Arrange
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
            mockDb.orderGroup.findUnique.mockResolvedValue(
                createMockOrderGroup()
            );
            mockDb.orderGroup.update.mockResolvedValue({
                status: OrderStatus.Refunded,
            });
            mockDb.orderItem.updateManyAndReturn.mockResolvedValue([
                { id: "i1", sizeId: "size-001", quantity: 4 },
            ]);

            // Act
            await updateOrderGroupStatus(
                TEST_CONFIG.DEFAULT_STORE_ID,
                "order-group-001",
                OrderStatus.Refunded
            );

            // Assert
            expect(mockDb.orderItem.updateManyAndReturn).toHaveBeenCalledWith({
                where: {
                    AND: [{ orderGroupId: "order-group-001" }, NOT_SETTLED],
                },
                data: { status: ProductStatus.Refunded },
                select: { id: true, sizeId: true, quantity: true },
            });
            expect(mockDb.size.updateMany).toHaveBeenCalledWith({
                where: { id: "size-001" },
                data: { quantity: { increment: 4 } },
            });
        });
    });

    describe("updateOrderPaymentStatus（注文単位・経路 A）", () => {
        it("非終端 → Refunded で注文配下の未精算 item を遷移させ、その在庫を復元する", async () => {
            // Arrange
            mockDb.orderItem.updateManyAndReturn.mockResolvedValue([
                { id: "i1", sizeId: "size-001", quantity: 2 },
                { id: "i3", sizeId: "size-003", quantity: 5 },
            ]);

            // Act
            await updateOrderPaymentStatus("order-001", PaymentStatus.Refunded);

            // Assert
            expect(mockDb.size.updateMany).toHaveBeenCalledTimes(2);
            expect(mockDb.size.updateMany).toHaveBeenCalledWith({
                where: { id: "size-001" },
                data: { quantity: { increment: 2 } },
            });
            expect(mockDb.size.updateMany).toHaveBeenCalledWith({
                where: { id: "size-003" },
                data: { quantity: { increment: 5 } },
            });
        });

        // 冪等性: 既に Cancelled で item もすべて終端なら、遷移する行が無く復元しない
        it("Cancelled → Cancelled の再実行では在庫を復元しない（冪等）", async () => {
            // Arrange: 条件付き updateMany は 0 行（didTransition=false）、item も遷移なし
            mockDb.order.updateMany.mockResolvedValue({ count: 0 });

            // Act
            await updateOrderPaymentStatus(
                "order-001",
                PaymentStatus.Cancelled
            );

            // Assert: group の連動は didTransition のときだけ
            AssertionHelpers.expectNotCalled(mockDb.orderGroup.updateMany);
            AssertionHelpers.expectNotCalled(mockDb.size.updateMany);
        });

        // design §4.1: webhook が先に paymentStatus を書いていても（didTransition=false）、
        // 未精算の item は遷移して在庫が戻る（現行ではこの場合に戻らなかった）
        it("paymentStatus がすでに終端でも、未精算 item は遷移して在庫を戻す", async () => {
            // Arrange
            mockDb.order.updateMany.mockResolvedValue({ count: 0 });
            mockDb.orderItem.updateManyAndReturn.mockResolvedValue([
                { id: "i1", sizeId: "size-001", quantity: 2 },
            ]);

            // Act
            await updateOrderPaymentStatus("order-001", PaymentStatus.Refunded);

            // Assert
            AssertionHelpers.expectNotCalled(mockDb.orderGroup.updateMany);
            expect(mockDb.size.updateMany).toHaveBeenCalledWith({
                where: { id: "size-001" },
                data: { quantity: { increment: 2 } },
            });
        });

        it("Paid（非キャンセル遷移）では在庫を復元しない", async () => {
            await updateOrderPaymentStatus("order-001", PaymentStatus.Paid);

            AssertionHelpers.expectNotCalled(
                mockDb.orderItem.updateManyAndReturn
            );
            AssertionHelpers.expectNotCalled(mockDb.size.updateMany);
        });
    });
});

// ==================================================
// trackOrder（公開・注文番号 + メールで配送状況を照会）
//   IDOR 3 階層: (a) スロー検証 / (b) where 構造 / (c) 副作用なし
//   不一致と不存在を同一応答（null）にして注文 ID の存在を秘匿する。
// ==================================================
describe("trackOrder", () => {
    const OWNER_EMAIL = "owner@example.com";

    /** 所有者 email を含む注文データを組み立てる（trackOrder の include 形に対応）。 */
    const buildTrackableOrder = () => ({
        ...createMockOrder(),
        user: { email: OWNER_EMAIL },
        groups: [
            {
                ...createMockOrderGroup(),
                items: [createMockOrderItem()],
                store: { name: "Test Store", url: "test-store" },
            },
        ],
    });

    it("T-TO1: email 一致（大小無視）で order/group/item を返し、user(email) を除去する", async () => {
        // Arrange
        const orderData = buildTrackableOrder();
        mockDb.order.findUnique.mockResolvedValue(orderData);

        // Act: 入力 email を大文字にしても所有者 email と一致させる
        const result = await trackOrder({
            orderId: "order-001",
            email: OWNER_EMAIL.toUpperCase(),
        });

        // Assert: 結果が返り、PII（user.email）が除去されている
        expect(result).not.toBeNull();
        expect(result).not.toHaveProperty("user");
        expect(result?.groups).toHaveLength(1);
        expect(result?.groups[0].items).toHaveLength(1);
        expect(result?.groups[0].store).toEqual({
            name: "Test Store",
            url: "test-store",
        });
    });

    it("T-TO2: email 不一致のとき null を返す（IDOR スロー検証・データを漏らさない）", async () => {
        // Arrange
        mockDb.order.findUnique.mockResolvedValue(buildTrackableOrder());

        // Act
        const result = await trackOrder({
            orderId: "order-001",
            email: "attacker@example.com",
        });

        // Assert
        expect(result).toBeNull();
    });

    it("T-TO3: findUnique の where が { id: orderId }（email を where に混ぜない）", async () => {
        // Arrange
        mockDb.order.findUnique.mockResolvedValue(buildTrackableOrder());

        // Act
        await trackOrder({ orderId: "order-001", email: OWNER_EMAIL });

        // Assert
        expect(mockDb.order.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: "order-001" },
            })
        );
    });

    it("T-TO4: 不一致時に update/delete 等を呼ばない（副作用なし・読取のみ）", async () => {
        // Arrange
        mockDb.order.findUnique.mockResolvedValue(buildTrackableOrder());

        // Act
        await trackOrder({
            orderId: "order-001",
            email: "attacker@example.com",
        });

        // Assert
        AssertionHelpers.expectNotCalled(mockDb.order.update);
        AssertionHelpers.expectNotCalled(mockDb.orderGroup.update);
        AssertionHelpers.expectNotCalled(mockDb.orderItem.update);
    });

    it("T-TO5: 不存在 orderId のとき null（T-TO2 と同一応答・列挙防止）", async () => {
        // Arrange
        mockDb.order.findUnique.mockResolvedValue(null);

        // Act
        const result = await trackOrder({
            orderId: "nonexistent",
            email: OWNER_EMAIL,
        });

        // Assert
        expect(result).toBeNull();
    });

    it("T-TO6: 不正入力（空 orderId）のとき Zod で null・findUnique 未呼び出し", async () => {
        // Act
        const result = await trackOrder({ orderId: "", email: OWNER_EMAIL });

        // Assert
        expect(result).toBeNull();
        AssertionHelpers.expectNotCalled(mockDb.order.findUnique);
    });

    it("T-TO11: DB 障害は null に変換せず throw する（not-found と区別）", async () => {
        // Arrange: 一過性のインフラ障害。PII ログを抑制する。
        const errSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});
        mockDb.order.findUnique.mockRejectedValue(new Error("db down"));

        // Act / Assert: null ではなく汎用メッセージで throw
        await expect(
            trackOrder({ orderId: "order-001", email: OWNER_EMAIL })
        ).rejects.toThrow(
            "注文の照会に失敗しました。時間をおいて再度お試しください。"
        );
        expect(errSpy).toHaveBeenCalled();

        // PII 不漏洩契約の固定: ログ引数（第2引数の { error, stack } 等を含む
        // 全呼び出し・全引数）を直列化し、email・orderId が一切含まれないことを検証する。
        const loggedPayload = JSON.stringify(errSpy.mock.calls);
        expect(loggedPayload).not.toContain(OWNER_EMAIL);
        expect(loggedPayload).not.toContain("order-001");

        errSpy.mockRestore();
    });
});

// ==================================================
// 発送状態の通知（plan 086）
// ==================================================
describe("OrderGroup の発送状態の通知（plan 086）", () => {
    let errSpy: jest.SpyInstance;

    beforeEach(() => {
        errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        mockDb.$transaction.mockImplementation(
            async (cb: (tx: typeof mockDb) => Promise<unknown>) => cb(mockDb)
        );
    });
    afterEach(() => errSpy.mockRestore());

    describe("seller: updateOrderGroupStatus", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
            mockDb.orderGroup.findUnique.mockResolvedValue(
                createMockOrderGroup({ status: "Processing" })
            );
            mockDb.orderGroup.update.mockResolvedValue(
                createMockOrderGroup({ status: "Shipped" })
            );
        });

        it("更新前の状態は tx の中で行ロックを取って読み直した値を使う（tx 外の古い値は使わない）", async () => {
            // Arrange —— tx 外の読み取りでは Shipped だったが、その後 Processing へ差し戻された
            mockDb.orderGroup.findUnique.mockResolvedValueOnce(
                createMockOrderGroup({ status: "Shipped" })
            );
            mockDb.$queryRaw.mockResolvedValueOnce([{ status: "Processing" }]);

            // Act
            await updateOrderGroupStatus(
                TEST_CONFIG.DEFAULT_STORE_ID,
                "order-group-001",
                "Shipped" as never
            );

            // Assert
            expect(mockDb.$queryRaw).toHaveBeenCalledTimes(1);
            const sql = (mockDb.$queryRaw.mock.calls[0][0] as string[]).join(
                "?"
            );
            expect(sql).toContain("FOR UPDATE");
            expect(mockRecordGroupNotification).toHaveBeenCalledWith(mockDb, {
                groupId: "order-group-001",
                previousStatus: "Processing",
                nextStatus: "Shipped",
            });
        });

        it("tx の中で更新前の状態を渡して記録し、commit 後に送信を予約する", async () => {
            // Arrange
            mockDb.$queryRaw.mockResolvedValueOnce([{ status: "Processing" }]);
            const order: string[] = [];
            mockRecordGroupNotification.mockImplementationOnce(async () => {
                order.push("record");
                return ["d-1"];
            });
            mockDb.$transaction.mockImplementationOnce(
                async (cb: (tx: typeof mockDb) => Promise<unknown>) => {
                    const value = await cb(mockDb);
                    order.push("commit");
                    return value;
                }
            );
            mockScheduleDispatch.mockImplementationOnce(() => {
                order.push("schedule");
            });

            // Act
            const result = await updateOrderGroupStatus(
                TEST_CONFIG.DEFAULT_STORE_ID,
                "order-group-001",
                "Shipped" as never
            );

            // Assert
            expect(result).toBe("Shipped");
            expect(mockRecordGroupNotification).toHaveBeenCalledWith(mockDb, {
                groupId: "order-group-001",
                previousStatus: "Processing",
                nextStatus: "Shipped",
            });
            expect(mockScheduleDispatch).toHaveBeenCalledWith(["d-1"]);
            expect(order).toEqual(["record", "commit", "schedule"]);
        });

        it("記録が失敗したら更新も失敗し、既存の汎用メッセージで返す（送信予約もしない）", async () => {
            // Arrange
            mockRecordGroupNotification.mockRejectedValueOnce(
                new Error("notification write failed")
            );

            // Act & Assert
            await expect(
                updateOrderGroupStatus(
                    TEST_CONFIG.DEFAULT_STORE_ID,
                    "order-group-001",
                    "Shipped" as never
                )
            ).rejects.toThrow("Failed to update order group status.");
            expect(mockScheduleDispatch).not.toHaveBeenCalled();
        });

        it("送信の予約が失敗しても、更新は成功して新しい状態を返す", async () => {
            // Arrange
            mockRecordGroupNotification.mockResolvedValueOnce(["d-1"]);
            mockScheduleDispatch.mockImplementationOnce(() => {
                throw new Error("provider down");
            });

            // Act
            const result = await updateOrderGroupStatus(
                TEST_CONFIG.DEFAULT_STORE_ID,
                "order-group-001",
                "Shipped" as never
            );

            // Assert
            expect(result).toBe("Shipped");
        });
    });

    describe("admin: updateOrderGroupStatusAsAdmin", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            mockDb.orderGroup.findUnique.mockResolvedValue({
                status: OrderStatus.Processing,
                items: [],
            });
            mockDb.orderGroup.update.mockResolvedValue({
                id: "order-group-001",
                orderId: "order-001",
                status: OrderStatus.Delivered,
            });
            mockDb.orderGroup.findMany.mockResolvedValue([
                { status: OrderStatus.Delivered },
            ]);
            mockDb.order.update.mockResolvedValue({});
        });

        it("tx の中で更新前の状態を渡して記録し、commit 後に送信を予約する", async () => {
            // Arrange
            mockRecordGroupNotification.mockResolvedValueOnce(["d-2"]);

            // Act
            const result = await updateOrderGroupStatusAsAdmin(
                "order-group-001",
                OrderStatus.Delivered
            );

            // Assert
            expect(result).toBe(OrderStatus.Delivered);
            expect(mockRecordGroupNotification).toHaveBeenCalledWith(mockDb, {
                groupId: "order-group-001",
                previousStatus: OrderStatus.Processing,
                nextStatus: OrderStatus.Delivered,
            });
            expect(mockScheduleDispatch).toHaveBeenCalledWith(["d-2"]);
        });

        it("更新前の状態を読む前に tx の中で行ロックを取る（seller 経路と同じ FOR UPDATE）", async () => {
            // Arrange
            const calls: string[] = [];
            mockDb.$queryRaw.mockImplementationOnce(async () => {
                calls.push("lock");
                return [{ status: OrderStatus.Processing }];
            });
            mockDb.orderGroup.findUnique.mockImplementationOnce(async () => {
                calls.push("read");
                return { status: OrderStatus.Processing, items: [] };
            });

            // Act
            await updateOrderGroupStatusAsAdmin(
                "order-group-001",
                OrderStatus.Delivered
            );

            // Assert
            expect(calls).toEqual(["lock", "read"]);
            const sql = (mockDb.$queryRaw.mock.calls[0][0] as string[]).join(
                "?"
            );
            expect(sql).toContain("FOR UPDATE");
        });

        it("記録が失敗したら更新も失敗する（送信予約もしない）", async () => {
            // Arrange
            mockRecordGroupNotification.mockRejectedValueOnce(
                new Error("notification write failed")
            );

            // Act & Assert
            await expect(
                updateOrderGroupStatusAsAdmin(
                    "order-group-001",
                    OrderStatus.Delivered
                )
            ).rejects.toThrow("notification write failed");
            expect(mockScheduleDispatch).not.toHaveBeenCalled();
        });
    });
});
