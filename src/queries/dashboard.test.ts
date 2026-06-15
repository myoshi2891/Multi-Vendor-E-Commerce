import { currentUser } from "@clerk/nextjs/server";
import {
    getAdminDashboardStats,
    getSalesOverTime,
    getRecentOrders,
    getRecentStores,
} from "./dashboard";
import { TEST_CONFIG } from "../config/test-config";
import { Prisma } from "@prisma/client";

// next/cache の unstable_cache をパススルーにしてキャッシュを無効化
jest.mock("next/cache", () => ({
    unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
    db: {
        order: {
            aggregate: jest.fn(),
            count: jest.fn(),
            findMany: jest.fn(),
        },
        store: {
            groupBy: jest.fn(),
            findMany: jest.fn(),
        },
        user: {
            count: jest.fn(),
        },
        product: {
            count: jest.fn(),
        },
        category: {
            count: jest.fn(),
        },
        subCategory: {
            count: jest.fn(),
        },
    },
}));

const mockDb = require("@/lib/db").db;

beforeEach(() => {
    jest.clearAllMocks();
});

// ==================================================
// getAdminDashboardStats
// ==================================================
describe("getAdminDashboardStats", () => {
    describe("認証・権限エラー（3 階層検証）", () => {
        it("未認証ユーザーの場合 'Unauthenticated.' をスローする", async () => {
            // Arrange
            (currentUser as jest.Mock).mockResolvedValue(null);

            // Act & Assert
            // (a) スロー検証
            await expect(getAdminDashboardStats()).rejects.toThrow(
                "Unauthenticated."
            );
        });

        it("USER ロールの場合 'Only admins can perform this action.' をスローする", async () => {
            // Arrange
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "USER" },
            });

            // Act & Assert
            // (a) スロー検証
            await expect(getAdminDashboardStats()).rejects.toThrow(
                "Only admins can perform this action."
            );
        });

        it("SELLER ロールの場合 'Only admins can perform this action.' をスローする", async () => {
            // Arrange
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });

            // Act & Assert
            // (a) スロー検証
            await expect(getAdminDashboardStats()).rejects.toThrow(
                "Only admins can perform this action."
            );
        });

        it("権限エラー時に currentUser が呼ばれる（認証チェックが実行される）", async () => {
            // Arrange
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "USER" },
            });

            // Act
            await getAdminDashboardStats().catch(() => {});

            // Assert
            // (b) 構造検証 — 認可ガードが currentUser() を呼び出したことを確認
            expect(currentUser).toHaveBeenCalledTimes(1);
        });

        it("権限エラー時に DB クエリが実行されない", async () => {
            // Arrange
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "USER" },
            });

            // Act
            await getAdminDashboardStats().catch(() => {});

            // Assert
            // (c) 副作用なし検証 — ガード失敗時に DB が呼ばれないことを確認
            expect(mockDb.order.aggregate).not.toHaveBeenCalled();
            expect(mockDb.order.count).not.toHaveBeenCalled();
            expect(mockDb.store.groupBy).not.toHaveBeenCalled();
            expect(mockDb.user.count).not.toHaveBeenCalled();
            expect(mockDb.product.count).not.toHaveBeenCalled();
            expect(mockDb.category.count).not.toHaveBeenCalled();
            expect(mockDb.subCategory.count).not.toHaveBeenCalled();
        });
    });

    describe("正常系 — 集計スコープ境界", () => {
        beforeEach(() => {
            // ADMIN として認証済み
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });

            // デフォルトのモック戻り値（境界テストで個別上書き）
            mockDb.order.aggregate.mockResolvedValue({
                _sum: { total: new Prisma.Decimal("0") },
            });
            mockDb.order.count.mockResolvedValue(0);
            mockDb.store.groupBy.mockResolvedValue([]);
            mockDb.user.count.mockResolvedValue(0);
            mockDb.product.count.mockResolvedValue(0);
            mockDb.category.count.mockResolvedValue(0);
            mockDb.subCategory.count.mockResolvedValue(0);
        });

        it("売上集計は paymentStatus=Paid の注文のみ対象になる（AC-F1-2）", async () => {
            // Arrange: $300 の Paid 注文
            mockDb.order.aggregate.mockResolvedValue({
                _sum: { total: new Prisma.Decimal("300.00") },
            });

            // Act
            const stats = await getAdminDashboardStats();

            // Assert: aggregate に where: { paymentStatus: "Paid" } が渡される
            expect(mockDb.order.aggregate).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { paymentStatus: "Paid" },
                })
            );
            expect(stats.totalRevenue).toBe(300);
        });

        it("集計結果が null の場合は売上 0 を返す", async () => {
            // Arrange: aggregate が _sum.total = null を返すケース（注文ゼロ）
            mockDb.order.aggregate.mockResolvedValue({
                _sum: { total: null },
            });

            // Act
            const stats = await getAdminDashboardStats();

            // Assert
            expect(stats.totalRevenue).toBe(0);
        });

        it("ストア数は isDeleted=false のみカウントする（AC-F1-4）", async () => {
            // Arrange: ACTIVE 2件、PENDING 1件
            mockDb.store.groupBy.mockResolvedValue([
                { status: "ACTIVE", _count: { _all: 2 } },
                { status: "PENDING", _count: { _all: 1 } },
            ]);

            // Act
            const stats = await getAdminDashboardStats();

            // Assert: groupBy に where: { isDeleted: false } が渡される
            expect(mockDb.store.groupBy).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { isDeleted: false },
                })
            );
            expect(stats.activeStores).toBe(2);
            expect(stats.pendingStores).toBe(1);
        });

        it("論理削除済みストアはカウントに含まれない（AC-F1-4）", async () => {
            // Arrange: isDeleted=true のストアが存在してもカウント 0
            mockDb.store.groupBy.mockResolvedValue([]);

            // Act
            const stats = await getAdminDashboardStats();

            // Assert: isDeleted=false のストアが 0 件 → activeStores/pendingStores は 0
            expect(stats.activeStores).toBe(0);
            expect(stats.pendingStores).toBe(0);
        });

        it("論理削除済みストアの Paid 注文は売上に算入する（AC-F1-5）", async () => {
            // Arrange: 論理削除済みストアの Paid 注文 $100 が集計に含まれる
            // （order.aggregate に isDeleted フィルタが付かないことで担保）
            mockDb.order.aggregate.mockResolvedValue({
                _sum: { total: new Prisma.Decimal("100.00") },
            });

            // Act
            const stats = await getAdminDashboardStats();

            // Assert: aggregate の where に isDeleted フィルタが含まれない
            expect(mockDb.order.aggregate).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.not.objectContaining({ isDeleted: expect.anything() }),
                })
            );
            expect(stats.totalRevenue).toBe(100);
        });

        it("全 KPI 項目を正しく集計して返す", async () => {
            // Arrange
            mockDb.order.aggregate.mockResolvedValue({
                _sum: { total: new Prisma.Decimal("500.50") },
            });
            mockDb.order.count.mockResolvedValue(10);
            mockDb.store.groupBy.mockResolvedValue([
                { status: "ACTIVE", _count: { _all: 3 } },
                { status: "PENDING", _count: { _all: 2 } },
            ]);
            mockDb.user.count.mockResolvedValue(50);
            mockDb.product.count.mockResolvedValue(120);
            mockDb.category.count.mockResolvedValue(5);
            mockDb.subCategory.count.mockResolvedValue(15);

            // Act
            const stats = await getAdminDashboardStats();

            // Assert
            expect(stats).toEqual({
                totalRevenue: 500.5,
                totalOrders: 10,
                activeStores: 3,
                pendingStores: 2,
                totalUsers: 50,
                totalProducts: 120,
                totalCategories: 5,
                totalSubCategories: 15,
            });
        });
    });

    describe("異常系 — DB エラー", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
        });

        it("異常系: DB エラー時に 'Failed to aggregate dashboard stats.' をスローする", async () => {
            // Arrange
            mockDb.order.aggregate.mockRejectedValue(new Error("DB connection error"));
            mockDb.order.count.mockResolvedValue(0);
            mockDb.store.groupBy.mockResolvedValue([]);
            mockDb.user.count.mockResolvedValue(0);
            mockDb.product.count.mockResolvedValue(0);
            mockDb.category.count.mockResolvedValue(0);
            mockDb.subCategory.count.mockResolvedValue(0);

            // Act & Assert
            await expect(getAdminDashboardStats()).rejects.toThrow(
                "Failed to aggregate dashboard stats."
            );
        });

        it("異常系: 非 Error オブジェクトでも 'Failed to aggregate dashboard stats.' をスローする", async () => {
            // Arrange — catch 内 error instanceof Error が false の分岐をカバー
            mockDb.order.aggregate.mockRejectedValue("string error");
            mockDb.order.count.mockResolvedValue(0);
            mockDb.store.groupBy.mockResolvedValue([]);
            mockDb.user.count.mockResolvedValue(0);
            mockDb.product.count.mockResolvedValue(0);
            mockDb.category.count.mockResolvedValue(0);
            mockDb.subCategory.count.mockResolvedValue(0);

            // Act & Assert
            await expect(getAdminDashboardStats()).rejects.toThrow(
                "Failed to aggregate dashboard stats."
            );
        });
    });
});

// ==================================================
// getSalesOverTime
// ==================================================
describe("getSalesOverTime", () => {
    describe("認証・権限エラー", () => {
        it("非 ADMIN ユーザーはスローする", async () => {
            // Arrange
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "USER" },
            });

            // Act & Assert
            await expect(getSalesOverTime()).rejects.toThrow(
                "Only admins can perform this action."
            );
        });
    });

    describe("正常系", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
        });

        it("monthly モードで Paid 注文を月次バケットに集計する", async () => {
            // Arrange: 2024-01 に $100、2024-02 に $200
            mockDb.order.findMany.mockResolvedValue([
                {
                    createdAt: new Date("2024-01-15"),
                    total: new Prisma.Decimal("100.00"),
                },
                {
                    createdAt: new Date("2024-02-10"),
                    total: new Prisma.Decimal("200.00"),
                },
            ]);

            // Act
            const result = await getSalesOverTime("monthly");

            // Assert: paymentStatus=Paid フィルタが付いていること
            expect(mockDb.order.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ paymentStatus: "Paid" }),
                })
            );
            expect(result).toEqual([
                { label: "2024-01", revenue: 100 },
                { label: "2024-02", revenue: 200 },
            ]);
        });

        it("daily モードで 'YYYY-MM-DD' ラベルを返す", async () => {
            // Arrange
            mockDb.order.findMany.mockResolvedValue([
                {
                    createdAt: new Date("2024-03-05"),
                    total: new Prisma.Decimal("50.00"),
                },
            ]);

            // Act
            const result = await getSalesOverTime("daily");

            // Assert
            expect(result[0].label).toBe("2024-03-05");
            expect(result[0].revenue).toBe(50);
        });

        it("注文がない場合は空配列を返す", async () => {
            // Arrange
            mockDb.order.findMany.mockResolvedValue([]);

            // Act
            const result = await getSalesOverTime();

            // Assert
            expect(result).toEqual([]);
        });

        it("同じ月の注文は合算される", async () => {
            // Arrange: 2024-01 に 2 件
            mockDb.order.findMany.mockResolvedValue([
                {
                    createdAt: new Date("2024-01-10"),
                    total: new Prisma.Decimal("100.00"),
                },
                {
                    createdAt: new Date("2024-01-20"),
                    total: new Prisma.Decimal("150.00"),
                },
            ]);

            // Act
            const result = await getSalesOverTime("monthly");

            // Assert: 同一月は合算されて 1 エントリ
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ label: "2024-01", revenue: 250 });
        });
    });

    describe("異常系 — DB エラー", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
        });

        it("異常系: DB エラー時に 'Failed to fetch sales over time.' をスローする", async () => {
            // Arrange
            mockDb.order.findMany.mockRejectedValue(new Error("DB connection error"));

            // Act & Assert
            await expect(getSalesOverTime()).rejects.toThrow(
                "Failed to fetch sales over time."
            );
        });

        it("異常系: 非 Error オブジェクトでも 'Failed to fetch sales over time.' をスローする", async () => {
            // Arrange — catch 内 error instanceof Error が false の分岐をカバー
            mockDb.order.findMany.mockRejectedValue("string error");

            // Act & Assert
            await expect(getSalesOverTime()).rejects.toThrow(
                "Failed to fetch sales over time."
            );
        });
    });
});

// ==================================================
// getRecentOrders
// ==================================================
describe("getRecentOrders", () => {
    describe("認証・権限エラー", () => {
        it("非 ADMIN ユーザーはスローする", async () => {
            // Arrange
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });

            // Act & Assert
            await expect(getRecentOrders()).rejects.toThrow(
                "Only admins can perform this action."
            );
        });
    });

    describe("正常系", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
        });

        it("デフォルト limit=5 で注文を降順取得する", async () => {
            // Arrange
            const mockOrders = [{ id: "order-1" }, { id: "order-2" }];
            mockDb.order.findMany.mockResolvedValue(mockOrders);

            // Act
            const result = await getRecentOrders();

            // Assert
            expect(mockDb.order.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: { createdAt: "desc" },
                    take: 5,
                })
            );
            expect(result).toEqual(mockOrders);
        });

        it("limit を指定すると指定件数で取得する", async () => {
            // Arrange
            mockDb.order.findMany.mockResolvedValue([]);

            // Act
            await getRecentOrders(3);

            // Assert
            expect(mockDb.order.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ take: 3 })
            );
        });
    });

    describe("異常系 — DB エラー", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
        });

        it("異常系: DB エラー時に 'Failed to fetch recent orders.' をスローする", async () => {
            // Arrange
            mockDb.order.findMany.mockRejectedValue(new Error("DB connection error"));

            // Act & Assert
            await expect(getRecentOrders()).rejects.toThrow(
                "Failed to fetch recent orders."
            );
        });

        it("異常系: 非 Error オブジェクトでも 'Failed to fetch recent orders.' をスローする", async () => {
            // Arrange — catch 内 error instanceof Error が false の分岐をカバー
            mockDb.order.findMany.mockRejectedValue("string error");

            // Act & Assert
            await expect(getRecentOrders()).rejects.toThrow(
                "Failed to fetch recent orders."
            );
        });
    });
});

// ==================================================
// getRecentStores
// ==================================================
describe("getRecentStores", () => {
    describe("認証・権限エラー", () => {
        it("非 ADMIN ユーザーはスローする", async () => {
            // Arrange
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "USER" },
            });

            // Act & Assert
            await expect(getRecentStores()).rejects.toThrow(
                "Only admins can perform this action."
            );
        });
    });

    describe("正常系", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
        });

        it("isDeleted=false のストアのみ降順で取得する", async () => {
            // Arrange
            const mockStores = [{ id: "store-1" }, { id: "store-2" }];
            mockDb.store.findMany.mockResolvedValue(mockStores);

            // Act
            const result = await getRecentStores();

            // Assert
            expect(mockDb.store.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { isDeleted: false },
                    orderBy: { createdAt: "desc" },
                    take: 5,
                })
            );
            expect(result).toEqual(mockStores);
        });
    });

    describe("異常系 — DB エラー", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
        });

        it("異常系: DB エラー時に 'Failed to fetch recent stores.' をスローする", async () => {
            // Arrange
            mockDb.store.findMany.mockRejectedValue(new Error("DB connection error"));

            // Act & Assert
            await expect(getRecentStores()).rejects.toThrow(
                "Failed to fetch recent stores."
            );
        });

        it("異常系: 非 Error オブジェクトでも 'Failed to fetch recent stores.' をスローする", async () => {
            // Arrange — catch 内 error instanceof Error が false の分岐をカバー
            mockDb.store.findMany.mockRejectedValue("string error");

            // Act & Assert
            await expect(getRecentStores()).rejects.toThrow(
                "Failed to fetch recent stores."
            );
        });
    });
});
