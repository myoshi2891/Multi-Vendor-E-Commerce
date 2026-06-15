import { currentUser } from "@clerk/nextjs/server";
import { getAdminDashboardStats } from "./dashboard";
import { TEST_CONFIG } from "../config/test-config";

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
});
