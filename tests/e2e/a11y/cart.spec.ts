import { test } from "@playwright/test";
import { runA11yScan } from "./_helpers";

/**
 * a11y: カートページ /cart（空状態）(WCAG 2.1 AA)
 *
 * 空カートのみを対象とする。商品入りカートは checkout.spec.ts のセットアップと
 * 重複するため、ここではページ骨格（ヘッダー／フッター／空状態メッセージ）の
 * 適合のみを担保する。
 *
 * 空カートは Playwright がテスト毎に新規コンテキストを与えるため自然に成立する
 * （Zustand persist の localStorage が空のまま）。
 */

test.describe("a11y: /cart (空カート)", () => {
    test.skip(
        ({ browserName }) => browserName !== "chromium",
        "a11y スキャンは chromium 限定（レンダリング差を排除）"
    );

    test("WCAG 2.1 AA 違反が無いこと", async ({ page }) => {
        await runA11yScan(page, "/cart", {
            readinessLocator: page.getByTestId("cart-empty-message"),
        });
    });
});
