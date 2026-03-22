/**
 * グローバルテストヘルパー
 * 全テストファイルで共通利用する認証・権限・エラー検証ユーティリティ
 */

import { currentUser } from "@clerk/nextjs/server";
import { TEST_CONFIG } from "./test-config";
import type { Page } from "@playwright/test";

/**
 * Setup E2E test state (viewport, local storage, cookies) for a page
 */
export const setupE2ETestState = async (page: Page, seed: any) => {
    await page.addInitScript(() => localStorage.clear());
    await page.context().addCookies([
        {
            name: "userCountry",
            value: JSON.stringify(seed.country),
            url: TEST_CONFIG.E2E_BASE_URL,
        },
    ]);
};

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

    /**
     * console.error をモック化する。
     * 戻り値の SpyInstance に対し、テスト後に `.mockRestore()` を呼ぶ責任は呼び出し元にある。
     * afterEach 内での復元を推奨。
     */
    static mockConsoleError() {
        return jest
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
    }

    /**
     * console.log をモック化する。
     * 戻り値の SpyInstance に対し、テスト後に `.mockRestore()` を呼ぶ責任は呼び出し元にある。
     * afterEach 内での復元を推奨。
     */
    static mockConsoleLog() {
        return jest.spyOn(console, "log").mockImplementation(() => undefined);
    }
}

export const matchText = (text: string) => (content: string, _element: Element | null = null) => {
    const normalizedContent = content.replace(/\s+/g, ' ').trim()
    const normalizedText = text.replace(/\s+/g, ' ').trim()
    return normalizedContent.includes(normalizedText)
}

export const matchTextCrunch = (text: string) => (content: string, _element: Element | null = null) => {
    const crunch = (s: string) => s.replace(/\s+/g, '').replace(/\u00a0/g, '')
    return crunch(content).includes(crunch(text))
}
