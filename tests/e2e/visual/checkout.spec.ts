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

        // Clerk ウィジェットは client-only のため、URL 到達直後はまだ本文が空。
        // その状態でも 100ms 間隔の 2 枚が一致するので toHaveScreenshot は
        // 「安定」と判定してしまい、ヘッダー＋フッターだけのベースラインを固定する
        // （plan 043 の実測 — 3 試行ともバイト同一の空本文だった）。それでは
        // サインイン画面の差分検出器にならず、マシン速度が変われば描画が間に合って
        // 恒常 red にもなる。
        //
        // アンカーは「撮る画面に実際に写っているもの」を使う。ベースライン
        // (checkout-redirect-signin-chromium-darwin.png) は <SignIn /> の初期表示、
        // すなわち識別子入力ステップであり、パスワード欄は写っていない。
        // helpers/auth.ts はパスワード欄を待つが、あちらは識別子を入力して
        // 次ステップへ進めた後の話で、こことは待つ対象が違う。
        const clerkRoot = page.locator(".cl-signIn-root");
        await clerkRoot.waitFor({ state: "visible", timeout: 15000 });
        await expect(clerkRoot.locator('input[name="identifier"]')).toBeVisible({
            timeout: 15000,
        });

        await expect(page).toHaveScreenshot("checkout-redirect-signin.png", {
            fullPage: true,
        });
    });
});
