import { test, expect } from "./_fixtures";

/**
 * Visual Regression: Checkout 未認証アクセス
 *
 * 認証済み /checkout の Visual Regression は Phase 2（Clerk テストセッション整備後）。
 * 本 spec では未認証時のリダイレクト先（middleware が auth.protect() で送る /sign-in）の
 * 表示を検証する。`/cart` への遷移はページレベルで認証済み・カート無しユーザー向けの分岐
 * （src/app/(store)/checkout/page.tsx:20）なので未認証ケースとは別である。
 *
 * Baseline 更新:
 *   bunx playwright test tests/e2e/visual --update-snapshots --project=chromium
 */

test.describe("Visual: Checkout (未認証)", () => {
    test.skip(
        ({ browserName }) => browserName !== "chromium",
        "Visual Regression は chromium 限定（フォントレンダリング差のため）"
    );

    test("未認証で /checkout にアクセスすると /sign-in にリダイレクトされる", async ({
        page,
        seed: _seed,
    }) => {
        await page.goto("/checkout", { waitUntil: "domcontentloaded" });
        // middleware の auth.protect() で /sign-in に飛ばされる
        await page.waitForURL(/\/sign-in/, { timeout: 10000 });
        await expect(page).toHaveScreenshot("checkout-redirect-signin.png", {
            fullPage: true,
        });
    });
});
