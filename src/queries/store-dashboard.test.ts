import { currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import {
    getStoreDashboardStats,
    getStoreSalesOverTime,
    getStoreRecentOrders,
    getStoreTopProducts,
} from "./store-dashboard";
import { TEST_CONFIG } from "../config/test-config";

// next/cache の unstable_cache をパススルーにしてキャッシュを無効化
jest.mock("next/cache", () => ({
    unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

// Clerk
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

// DB シングルトン
jest.mock("@/lib/db", () => ({
    db: {
        store: {
            findUnique: jest.fn(),
        },
        orderGroup: {
            aggregate: jest.fn(),
            count: jest.fn(),
            findMany: jest.fn(),
        },
        product: {
            aggregate: jest.fn(),
            count: jest.fn(),
            findMany: jest.fn(),
        },
        size: {
            count: jest.fn(),
        },
    },
}));

const mockDb = require("@/lib/db").db as {
    store: { findUnique: jest.Mock };
    orderGroup: { aggregate: jest.Mock; count: jest.Mock; findMany: jest.Mock };
    product: { aggregate: jest.Mock; count: jest.Mock; findMany: jest.Mock };
    size: { count: jest.Mock };
};

/** 認可ガード関連の共通エラーメッセージ（auth-guards.ts と整合） */
const ERRORS = {
    UNAUTHENTICATED: "Unauthenticated.",
    NOT_SELLER: "Only sellers can perform this action.",
    NOT_OWNER: "Forbidden: store not owned by current user.",
} as const;

const LOW_STOCK_THRESHOLD = 5;

/** テストデータファクトリー */
const TestData = {
    seller: (role = "SELLER") => ({
        id: TEST_CONFIG.DEFAULT_USER_ID,
        privateMetadata: { role },
    }),
    ownedStore: (overrides: Record<string, unknown> = {}) => ({
        id: TEST_CONFIG.DEFAULT_STORE_ID,
        url: TEST_CONFIG.TEST_STORE_URL,
        userId: TEST_CONFIG.DEFAULT_USER_ID,
        lowStockThreshold: LOW_STOCK_THRESHOLD,
        ...overrides,
    }),
};

const mockCurrentUser = (user: Record<string, unknown> | null) => {
    (currentUser as jest.Mock).mockResolvedValue(user);
};

/** SELLER + 店舗所有者として認証済みにする（requireStoreOwner を通す） */
const authenticateAsOwner = (storeOverrides: Record<string, unknown> = {}) => {
    mockCurrentUser(TestData.seller());
    mockDb.store.findUnique.mockResolvedValue(TestData.ownedStore(storeOverrides));
};

/** getStoreDashboardStats の 5 並列集計にデフォルト値を流し込む（境界テストで個別上書き） */
const stubStatsAggregates = () => {
    mockDb.orderGroup.aggregate.mockResolvedValue({
        _sum: { total: new Prisma.Decimal("0") },
    });
    mockDb.orderGroup.count.mockResolvedValue(0);
    mockDb.product.aggregate.mockResolvedValue({
        _sum: { views: 0, sales: 0 },
    });
    mockDb.product.count.mockResolvedValue(0);
    mockDb.size.count.mockResolvedValue(0);
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

// ==================================================
// 認可エラー（3 階層検証）— 全 query 共通
// ==================================================
describe("store-dashboard 認可ガード（3 階層検証）", () => {
    const cases: ReadonlyArray<{
        name: string;
        run: () => Promise<unknown>;
    }> = [
        {
            name: "getStoreDashboardStats",
            run: () => getStoreDashboardStats(TEST_CONFIG.TEST_STORE_URL),
        },
        {
            name: "getStoreSalesOverTime",
            run: () => getStoreSalesOverTime(TEST_CONFIG.TEST_STORE_URL),
        },
        {
            name: "getStoreRecentOrders",
            run: () => getStoreRecentOrders(TEST_CONFIG.TEST_STORE_URL),
        },
        {
            name: "getStoreTopProducts",
            run: () => getStoreTopProducts(TEST_CONFIG.TEST_STORE_URL),
        },
    ];

    describe.each(cases)("$name", ({ run }) => {
        it("未認証ユーザーは 'Unauthenticated.' をスローする（(a) スロー検証）", async () => {
            // Arrange
            mockCurrentUser(null);

            // Act & Assert
            await expect(run()).rejects.toThrow(ERRORS.UNAUTHENTICATED);
        });

        it("非 SELLER ロールは 'Only sellers...' をスローする（(a) スロー検証）", async () => {
            // Arrange
            mockCurrentUser(TestData.seller("USER"));

            // Act & Assert
            await expect(run()).rejects.toThrow(ERRORS.NOT_SELLER);
        });

        it("非所有店舗は 'Forbidden: store not owned...' をスローする（(a) スロー検証）", async () => {
            // Arrange: SELLER だが findUnique が null（所有していない）
            mockCurrentUser(TestData.seller());
            mockDb.store.findUnique.mockResolvedValue(null);

            // Act & Assert
            await expect(run()).rejects.toThrow(ERRORS.NOT_OWNER);
        });

        it("認可失敗時に集計 DB クエリが実行されない（(c) 副作用なし検証）", async () => {
            // Arrange
            mockCurrentUser(TestData.seller("USER"));

            // Act
            await run().catch(() => {});

            // Assert
            expect(mockDb.orderGroup.aggregate).not.toHaveBeenCalled();
            expect(mockDb.orderGroup.count).not.toHaveBeenCalled();
            expect(mockDb.orderGroup.findMany).not.toHaveBeenCalled();
            expect(mockDb.product.aggregate).not.toHaveBeenCalled();
            expect(mockDb.product.count).not.toHaveBeenCalled();
            expect(mockDb.product.findMany).not.toHaveBeenCalled();
            expect(mockDb.size.count).not.toHaveBeenCalled();
        });
    });
});

// ==================================================
// getStoreDashboardStats — 集計境界
// ==================================================
describe("getStoreDashboardStats", () => {
    describe("正常系 — 集計スコープ境界", () => {
        beforeEach(() => {
            authenticateAsOwner();
            stubStatsAggregates();
        });

        it("売上集計は親 Order.paymentStatus=Paid のみ対象（storeId スコープ・AC-F1-3）", async () => {
            // Arrange
            mockDb.orderGroup.aggregate.mockResolvedValue({
                _sum: { total: new Prisma.Decimal("300.00") },
            });

            // Act
            const stats = await getStoreDashboardStats(TEST_CONFIG.TEST_STORE_URL);

            // Assert: where に storeId + order:{ paymentStatus: "Paid" }
            expect(mockDb.orderGroup.aggregate).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        storeId: TEST_CONFIG.DEFAULT_STORE_ID,
                        order: { paymentStatus: "Paid" },
                    },
                })
            );
            expect(stats.totalRevenue).toBe(300);
        });

        it("売上 _sum.total が null の場合は 0 を返す（AC-F1-5）", async () => {
            // Arrange
            mockDb.orderGroup.aggregate.mockResolvedValue({
                _sum: { total: null },
            });

            // Act
            const stats = await getStoreDashboardStats(TEST_CONFIG.TEST_STORE_URL);

            // Assert
            expect(stats.totalRevenue).toBe(0);
        });

        it("views/sales が null の場合は 0 を返す（AC-F1-5）", async () => {
            // Arrange
            mockDb.product.aggregate.mockResolvedValue({
                _sum: { views: null, sales: null },
            });

            // Act
            const stats = await getStoreDashboardStats(TEST_CONFIG.TEST_STORE_URL);

            // Assert
            expect(stats.totalViews).toBe(0);
            expect(stats.totalSales).toBe(0);
        });

        it("PV/sales は Σ Product.views / Σ Product.sales を返す（AC-F1-4）", async () => {
            // Arrange
            mockDb.product.aggregate.mockResolvedValue({
                _sum: { views: 1500, sales: 42 },
            });

            // Act
            const stats = await getStoreDashboardStats(TEST_CONFIG.TEST_STORE_URL);

            // Assert: product.aggregate は storeId スコープ
            expect(mockDb.product.aggregate).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { storeId: TEST_CONFIG.DEFAULT_STORE_ID },
                })
            );
            expect(stats.totalViews).toBe(1500);
            expect(stats.totalSales).toBe(42);
        });

        it("在庫アラート件数は store.lowStockThreshold を lte 条件に使う（所有権チェーン where）", async () => {
            // Arrange
            mockDb.size.count.mockResolvedValue(7);

            // Act
            const stats = await getStoreDashboardStats(TEST_CONFIG.TEST_STORE_URL);

            // Assert: where に productVariant.product.storeId + quantity.lte=threshold
            expect(mockDb.size.count).toHaveBeenCalledWith({
                where: {
                    productVariant: {
                        product: { storeId: TEST_CONFIG.DEFAULT_STORE_ID },
                    },
                    quantity: { lte: LOW_STOCK_THRESHOLD },
                },
            });
            expect(stats.lowStockCount).toBe(7);
        });

        it("全 KPI 項目を正しく集計して返す", async () => {
            // Arrange
            mockDb.orderGroup.aggregate.mockResolvedValue({
                _sum: { total: new Prisma.Decimal("500.50") },
            });
            mockDb.orderGroup.count.mockResolvedValue(10);
            mockDb.product.aggregate.mockResolvedValue({
                _sum: { views: 800, sales: 30 },
            });
            mockDb.product.count.mockResolvedValue(25);
            mockDb.size.count.mockResolvedValue(3);

            // Act
            const stats = await getStoreDashboardStats(TEST_CONFIG.TEST_STORE_URL);

            // Assert
            expect(stats).toEqual({
                totalRevenue: 500.5,
                totalOrders: 10,
                totalViews: 800,
                totalSales: 30,
                totalProducts: 25,
                lowStockCount: 3,
            });
        });
    });

    describe("店舗スコープ — キャッシュキーに storeId 含有（AC-F1-7）", () => {
        it("store ごとに独立した where.storeId で集計され混線しない", async () => {
            // Arrange: 別 store-B の所有者として認証
            mockCurrentUser({
                id: "user-b",
                privateMetadata: { role: "SELLER" },
            });
            mockDb.store.findUnique.mockResolvedValue({
                id: "store-B",
                url: "store-b",
                userId: "user-b",
                lowStockThreshold: 2,
            });
            stubStatsAggregates();

            // Act
            await getStoreDashboardStats("store-b");

            // Assert: すべての集計が store-B にスコープされる
            expect(mockDb.orderGroup.aggregate).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { storeId: "store-B", order: { paymentStatus: "Paid" } },
                })
            );
            expect(mockDb.orderGroup.count).toHaveBeenCalledWith({
                where: { storeId: "store-B" },
            });
            expect(mockDb.size.count).toHaveBeenCalledWith({
                where: {
                    productVariant: { product: { storeId: "store-B" } },
                    quantity: { lte: 2 },
                },
            });
        });
    });

    describe("異常系 — DB エラー", () => {
        beforeEach(() => {
            authenticateAsOwner();
            stubStatsAggregates();
        });

        it("DB エラー時に 'Failed to aggregate store dashboard stats.' をスローする", async () => {
            // Arrange
            mockDb.orderGroup.aggregate.mockRejectedValue(
                new Error("DB connection error")
            );

            // Act & Assert
            await expect(
                getStoreDashboardStats(TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("Failed to aggregate store dashboard stats.");
        });

        it("非 Error オブジェクトでも汎用メッセージをスローする", async () => {
            // Arrange — catch 内 error instanceof Error が false の分岐をカバー
            mockDb.orderGroup.aggregate.mockRejectedValue("string error");

            // Act & Assert
            await expect(
                getStoreDashboardStats(TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("Failed to aggregate store dashboard stats.");
        });
    });
});

// ==================================================
// getStoreSalesOverTime
// ==================================================
describe("getStoreSalesOverTime", () => {
    describe("正常系", () => {
        beforeEach(() => {
            authenticateAsOwner();
        });

        it("monthly モードで Paid 売上を月次バケットに集計する（storeId + 親 Paid join）", async () => {
            // Arrange
            mockDb.orderGroup.findMany.mockResolvedValue([
                { createdAt: new Date("2024-01-15"), total: new Prisma.Decimal("100.00") },
                { createdAt: new Date("2024-02-10"), total: new Prisma.Decimal("200.00") },
            ]);

            // Act
            const result = await getStoreSalesOverTime(
                TEST_CONFIG.TEST_STORE_URL,
                "monthly"
            );

            // Assert: where に storeId + order:{ paymentStatus: "Paid" }
            expect(mockDb.orderGroup.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        storeId: TEST_CONFIG.DEFAULT_STORE_ID,
                        order: { paymentStatus: "Paid" },
                    }),
                })
            );
            expect(result).toEqual([
                { label: "2024-01", revenue: 100 },
                { label: "2024-02", revenue: 200 },
            ]);
        });

        it("daily モードで 'YYYY-MM-DD' ラベルを返す", async () => {
            // Arrange
            mockDb.orderGroup.findMany.mockResolvedValue([
                { createdAt: new Date("2024-03-05"), total: new Prisma.Decimal("50.00") },
            ]);

            // Act
            const result = await getStoreSalesOverTime(
                TEST_CONFIG.TEST_STORE_URL,
                "daily"
            );

            // Assert
            expect(result[0].label).toBe("2024-03-05");
            expect(result[0].revenue).toBe(50);
        });

        it("注文がない場合は空配列を返す（AC-F1-5）", async () => {
            // Arrange
            mockDb.orderGroup.findMany.mockResolvedValue([]);

            // Act
            const result = await getStoreSalesOverTime(TEST_CONFIG.TEST_STORE_URL);

            // Assert
            expect(result).toEqual([]);
        });

        it("同じ月の注文は合算される", async () => {
            // Arrange
            mockDb.orderGroup.findMany.mockResolvedValue([
                { createdAt: new Date("2024-01-10"), total: new Prisma.Decimal("100.00") },
                { createdAt: new Date("2024-01-20"), total: new Prisma.Decimal("150.00") },
            ]);

            // Act
            const result = await getStoreSalesOverTime(
                TEST_CONFIG.TEST_STORE_URL,
                "monthly"
            );

            // Assert
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({ label: "2024-01", revenue: 250 });
        });
    });

    describe("異常系 — DB エラー", () => {
        beforeEach(() => {
            authenticateAsOwner();
        });

        it("DB エラー時に 'Failed to fetch store sales over time.' をスローする", async () => {
            // Arrange
            mockDb.orderGroup.findMany.mockRejectedValue(
                new Error("DB connection error")
            );

            // Act & Assert
            await expect(
                getStoreSalesOverTime(TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("Failed to fetch store sales over time.");
        });

        it("非 Error オブジェクトでも汎用メッセージをスローする", async () => {
            // Arrange
            mockDb.orderGroup.findMany.mockRejectedValue("string error");

            // Act & Assert
            await expect(
                getStoreSalesOverTime(TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("Failed to fetch store sales over time.");
        });
    });
});

// ==================================================
// getStoreRecentOrders
// ==================================================
describe("getStoreRecentOrders", () => {
    describe("正常系", () => {
        beforeEach(() => {
            authenticateAsOwner();
        });

        it("デフォルト limit=5 で storeId スコープの OrderGroup を降順取得する", async () => {
            // Arrange
            const mockOrders = [{ id: "og-1" }, { id: "og-2" }];
            mockDb.orderGroup.findMany.mockResolvedValue(mockOrders);

            // Act
            const result = await getStoreRecentOrders(TEST_CONFIG.TEST_STORE_URL);

            // Assert
            expect(mockDb.orderGroup.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { storeId: TEST_CONFIG.DEFAULT_STORE_ID },
                    orderBy: { updatedAt: "desc" },
                    take: 5,
                })
            );
            expect(result).toEqual(mockOrders);
        });

        it("limit を指定すると指定件数で取得する", async () => {
            // Arrange
            mockDb.orderGroup.findMany.mockResolvedValue([]);

            // Act
            await getStoreRecentOrders(TEST_CONFIG.TEST_STORE_URL, 3);

            // Assert
            expect(mockDb.orderGroup.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ take: 3 })
            );
        });
    });

    describe("異常系 — DB エラー", () => {
        beforeEach(() => {
            authenticateAsOwner();
        });

        it("DB エラー時に 'Failed to fetch store recent orders.' をスローする", async () => {
            // Arrange
            mockDb.orderGroup.findMany.mockRejectedValue(
                new Error("DB connection error")
            );

            // Act & Assert
            await expect(
                getStoreRecentOrders(TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("Failed to fetch store recent orders.");
        });

        it("非 Error オブジェクトでも汎用メッセージをスローする", async () => {
            // Arrange
            mockDb.orderGroup.findMany.mockRejectedValue("string error");

            // Act & Assert
            await expect(
                getStoreRecentOrders(TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("Failed to fetch store recent orders.");
        });
    });
});

// ==================================================
// getStoreTopProducts
// ==================================================
describe("getStoreTopProducts", () => {
    describe("正常系", () => {
        beforeEach(() => {
            authenticateAsOwner();
        });

        it("デフォルト limit=5 で sales 降順・storeId スコープで取得する", async () => {
            // Arrange
            const mockProducts = [{ id: "p-1" }, { id: "p-2" }];
            mockDb.product.findMany.mockResolvedValue(mockProducts);

            // Act
            const result = await getStoreTopProducts(TEST_CONFIG.TEST_STORE_URL);

            // Assert
            expect(mockDb.product.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { storeId: TEST_CONFIG.DEFAULT_STORE_ID },
                    orderBy: { sales: "desc" },
                    take: 5,
                })
            );
            expect(result).toEqual(mockProducts);
        });

        it("limit を指定すると指定件数で取得する", async () => {
            // Arrange
            mockDb.product.findMany.mockResolvedValue([]);

            // Act
            await getStoreTopProducts(TEST_CONFIG.TEST_STORE_URL, 8);

            // Assert
            expect(mockDb.product.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ take: 8 })
            );
        });
    });

    describe("異常系 — DB エラー", () => {
        beforeEach(() => {
            authenticateAsOwner();
        });

        it("DB エラー時に 'Failed to fetch store top products.' をスローする", async () => {
            // Arrange
            mockDb.product.findMany.mockRejectedValue(new Error("DB connection error"));

            // Act & Assert
            await expect(
                getStoreTopProducts(TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("Failed to fetch store top products.");
        });

        it("非 Error オブジェクトでも汎用メッセージをスローする", async () => {
            // Arrange
            mockDb.product.findMany.mockRejectedValue("string error");

            // Act & Assert
            await expect(
                getStoreTopProducts(TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("Failed to fetch store top products.");
        });
    });
});
