import { test, expect } from "./_fixtures";

/**
 * Visual Regression: /browse の商品グリッド
 *
 * 商品発見の主経路のレイアウト崩れを検出する。E2E DB には seed の商品しか無いため
 * グリッドの内容は決定論的で、フレークリスクは低い。
 * Chromium 限定（Firefox/WebKit はフォントレンダリング差が大きいため）。
 *
 * Baseline 更新:
 *   bash scripts/e2e/run-local.sh tests/e2e/visual --project=chromium --update-snapshots
 *   （`--` は挟まない。理由は product.spec.ts の docstring を参照。）
 */
test.describe("Visual: browse グリッド", () => {
    test.skip(
        ({ browserName }) => browserName !== "chromium",
        "Visual Regression は chromium 限定（フォントレンダリング差のため）"
    );

    // seed フィクスチャを受け取ることで setupE2ETestState が goto 前に走り、
    // cookie / localStorage が決定論的な初期状態になる（未要求だとフィクスチャ自体が
    // 生成されず、前テストの残留状態がスクリーンショットに混ざりうる）。
    // 値そのものは使わないため `_seed` で受ける（cart.spec.ts / checkout.spec.ts と同形）。
    test("browse の商品グリッド表示", async ({ page, seed: _seed }) => {
        await page.goto("/browse", { waitUntil: "commit" });
        // カードが 1 枚でも出るまで待つ（空グリッドを固定しない）
        await expect(
            page.locator('[data-testid^="product-card-"]').first()
        ).toBeVisible({ timeout: 15000 });

        await expect(page).toHaveScreenshot("browse-grid.png", {
            fullPage: true,
            mask: [page.locator("img")],
        });
    });
});
