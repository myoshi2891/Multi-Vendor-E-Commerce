import { expect, test } from "@playwright/test";
import { buildE2ESeed } from "../seed/constants";
import { setupE2ETestState } from "@/config/test-helpers";

/**
 * Visual Regression: Checkout 未認証アクセス
 *
 * 認証済み /checkout の Visual Regression は Phase 2（Clerk テストセッション整備後）。
 * 本 spec では未認証時のリダイレクト先（/cart）の表示を検証する。
 *
 * Baseline 更新:
 *   bunx playwright test tests/e2e/visual --update-snapshots --project=chromium
 */

test.describe("Visual: Checkout (未認証)", () => {
    test.skip(
        ({ browserName }) => browserName !== "chromium",
        "Visual Regression は chromium 限定（フォントレンダリング差のため）"
    );

    test.beforeEach(async ({ page }, testInfo) => {
        const seed = buildE2ESeed({
            workerIndex: testInfo.workerIndex,
            projectName: testInfo.project.name,
        });
        await setupE2ETestState(page, seed);
    });

    test("未認証で /checkout にアクセスすると /cart にリダイレクトされる", async ({
        page,
    }) => {
        await page.goto("/checkout", { waitUntil: "domcontentloaded" });
        // 認証ミドルウェアでリダイレクトされる先を待つ
        await page.waitForURL(/\/(cart|sign-in)/, { timeout: 10000 });
        await expect(page).toHaveScreenshot("checkout-redirect.png", {
            fullPage: true,
        });
    });
});
