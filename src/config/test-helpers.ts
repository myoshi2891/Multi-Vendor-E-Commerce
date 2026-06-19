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
export type E2ESeedPayload = {
    country: { code: string; name: string; [key: string]: unknown };
    [key: string]: unknown;
};

export const setupE2ETestState = async (page: Page, seed: E2ESeedPayload) => {
    // sessionStorage をマーカーに使い、テスト開始時の初回ナビゲーションのみ localStorage をクリアする。
    // addInitScript は全てのナビゲーションで実行されるため、ガードなしだと
    // page.goto("/cart") 時に Zustand persist のカートデータまで消えてしまう。
    await page.addInitScript(() => {
        try {
            if (!sessionStorage.getItem("__e2e_cleared")) {
                localStorage.clear();
                sessionStorage.setItem("__e2e_cleared", "1");
            }
        } catch {
            // sessionStorage が使えない場合は安全にスキップ
        }
    });
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

/**
 * Zustand persist が localStorage にカート状態を書き込むのを待つ
 * purchase-flow と mobile-responsive の両方で使用
 */
export const waitForCartPersist = async (page: Page) => {
    await page.waitForFunction(() => {
        const cartState = window.localStorage.getItem("cart");
        if (!cartState) return false;
        try {
            const parsed = JSON.parse(cartState);
            // Zustand persist の形式: { state: { cart: [...], totalItems, totalPrice }, version: 0 }
            return parsed.state?.cart?.length > 0;
        } catch {
            return false;
        }
    }, { timeout: 5000 });
};

/**
 * Clerk サインイン後のクライアントリダイレクトが完全に着地するまで待つ。
 *
 * `waitForURL(!/sign-in)` は「/sign-in を離れた瞬間」に解決するが、Clerk は
 * その後さらにホーム `/` へ soft redirect を撃つ。Chromium は速いので後続の
 * `page.goto()` 前にこのリダイレクトが着地するが、WebKit/Firefox は遅く、
 * goto 実行中に着地して `page.goto: ... is interrupted by another navigation to "/"`
 * を引き起こす（認証リダイレクト race）。
 *
 * ホーム着地 + networkidle まで待ち、後続ナビゲーションへの割り込みを排除する。
 */
export const waitForPostSignInSettle = async (page: Page) => {
    // 1. /sign-in を離脱するまで待つ（Clerk の factor ステップ中は /sign-in を含む）
    await page
        .waitForURL((url) => !url.pathname.includes("/sign-in"), { timeout: 15000 })
        .catch(() => {});
    // 2. サインイン後の遷移先であるホーム "/" の着地を待つ
    await page
        .waitForURL((url) => url.pathname === "/", { timeout: 15000 })
        .catch(() => {});
    // 3. 遅延リダイレクト・XHR をフラッシュし、後続 goto への割り込みを減らす
    await page.waitForLoadState("networkidle").catch(() => {});
};

/**
 * `page.goto` を実行し、別ナビゲーションへの割り込み（"interrupted by another
 * navigation"）が起きた場合のみリトライする。
 *
 * Clerk サインイン後のホーム `/` への soft redirect は WebKit/Firefox で着地が遅く、
 * `waitForPostSignInSettle` で待っても networkidle 後に発火しうる。この遅延リダイレクトが
 * 後続 goto に割り込むと Playwright が例外を投げるため、割り込み時のみ再試行する。
 * 割り込んだリダイレクトは "/" へ着地済みなので、再試行は保留中の遷移なしで成功する。
 *
 * ブラウザエンジンごとに「割り込み」のエラー文言が異なる:
 * - Chromium / WebKit: "interrupted by another navigation"
 * - Firefox (Gecko):   "NS_BINDING_ABORTED" / "frame was detached"
 *
 * さらに、Prisma/Neon が持続負荷下で間欠的にクエリをハングさせると SSR 応答が
 * 返らず goto がテストタイムアウトまで占有する。これを避けるため per-goto
 * タイムアウトを設け、TimeoutError も「一過性」として再試行対象に含める。
 *
 * @param page Playwright Page
 * @param url 遷移先 URL
 * @param retries 一過性失敗（割り込み / タイムアウト）の最大リトライ回数（既定 2）
 * @param timeoutMs per-goto タイムアウト（既定 30000）。ハング時に全テスト予算を
 *   食い潰さず fail-fast → 再試行できるようにする。
 */
export const gotoStable = async (
    page: Page,
    url: string,
    retries = 2,
    timeoutMs = 30000
) => {
    // 一過性の遷移失敗を示すエンジン横断のシグネチャ（割り込み + タイムアウト）
    const transientSignatures = [
        "interrupted by another navigation", // Chromium / WebKit（遅延リダイレクト割り込み）
        "NS_BINDING_ABORTED", // Firefox
        "frame was detached", // Firefox（中断に伴う派生メッセージ）
        "Timeout", // per-goto タイムアウト（負荷下の SSR 応答遅延）
    ];
    for (let attempt = 0; ; attempt++) {
        try {
            // waitUntil:"domcontentloaded" を明示する。既定の "load" は
            // Cloudinary 画像など継続的なリソース読み込みで発火せず、goto が
            // テストタイムアウトまでハングしうる（WebKit/Chromium で観測）。
            await page.goto(url, {
                waitUntil: "domcontentloaded",
                timeout: timeoutMs,
            });
            return;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            const transient = transientSignatures.some((sig) =>
                message.includes(sig)
            );
            if (!transient || attempt >= retries) {
                throw error;
            }
            // 割り込んだリダイレクト / 一過性ハングの沈静化を待ってから再試行する
            await page.waitForLoadState("domcontentloaded").catch(() => {});
        }
    }
};
