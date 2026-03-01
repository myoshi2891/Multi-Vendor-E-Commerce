/**
 * グローバルテストヘルパー
 * 全テストファイルで共通利用する認証・権限・エラー検証ユーティリティ
 */

import { currentUser } from "@clerk/nextjs/server";
import { TEST_CONFIG } from "./test-config";

// Clerkユーザーモック生成
export const mockClerkUser = (
    role: "USER" | "SELLER" | "ADMIN" = "USER",
    overrides: Record<string, unknown> = {}
) => ({
    id: TEST_CONFIG.DEFAULT_USER_ID,
    privateMetadata: { role, ...overrides },
});

// Clerk認証状態のセットアップヘルパー
export class AuthTestHelpers {
    static mockAuthenticated(role: "USER" | "SELLER" | "ADMIN" = "USER") {
        (currentUser as jest.Mock).mockResolvedValue(mockClerkUser(role));
    }

    static mockUnauthenticated() {
        (currentUser as jest.Mock).mockResolvedValue(null);
    }

    static mockWithCustomUser(user: Record<string, unknown> | null) {
        (currentUser as jest.Mock).mockResolvedValue(user);
    }
}

// 共通アサーションヘルパー
export class AssertionHelpers {
    // 認証エラーを検証
    static async expectAuthError(promise: Promise<unknown>) {
        await expect(promise).rejects.toThrow("Unauthenticated.");
    }

    // ロールエラーを検証（SELLER/ADMIN専用アクション）
    static async expectRoleError(
        promise: Promise<unknown>,
        expectedRole: "sellers" | "admins" = "sellers"
    ) {
        await expect(promise).rejects.toThrow(
            `Only ${expectedRole} can perform this action.`
        );
    }

    // エラーメッセージを検証
    static async expectThrowError(
        promise: Promise<unknown>,
        expectedError: string
    ) {
        await expect(promise).rejects.toThrow(expectedError);
    }

    // DB操作が呼ばれていないことを検証（認証失敗時など）
    static expectNotCalled(method: jest.Mock | jest.SpyInstance) {
        expect(method).not.toHaveBeenCalled();
    }

    // DB操作の呼び出し回数を検証
    static expectCalledTimes(
        method: jest.Mock | jest.SpyInstance,
        times: number
    ) {
        expect(method).toHaveBeenCalledTimes(times);
    }

    // console.errorのモックとリストア
    static mockConsoleError() {
        return jest
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
    }

    // console.logのモックとリストア
    static mockConsoleLog() {
        return jest.spyOn(console, "log").mockImplementation(() => undefined);
    }
}
