import { test, expect } from "./_fixtures";

/**
 * Visual Regression: 商品詳細ページ
 *
 * 購買判断の最終ページ（Ship to / Buy now / Add to bag を含む右購入パネル）の
 * レイアウト回帰を検出する。E2E DB の商品は seed から決定論的に構築されるため、
 * 描画内容も決定論的でフレークリスクは低い。
 * Chromium 限定（Firefox/WebKit はフォントレンダリング差が大きいため）。
 *
 * `devices["Desktop Chrome"]` のビューポートは **1280x720**（playwright.config.ts:75）で、
 * これは plan 065 で購入パネルがクリップされていた幅そのものである。本スペックは
 * 同種のレイアウト崩れの再発検知器として機能する。
 *
 * Baseline 更新:
 *   bash scripts/e2e/run-local.sh tests/e2e/visual --project=chromium --update-snapshots
 *
 *   **`--` を挟まないこと。** `scripts/e2e/run-local.sh` の最終行は
 *   `bunx playwright test --retries=2 "$@"` で、引数をそのまま playwright へ渡す。
 *   区切りの `--` は `bun run test:e2e:local -- <args>` のように **`bun run` 経由で
 *   呼ぶときにだけ**必要な作法であり、スクリプトを直接叩く場合は不要。誤って渡すと
 *   playwright は `--` 以降を**位置引数（テスト名フィルタ）**として解釈し、
 *   `--update-snapshots` という名前のテストを探して **0 件マッチ** ——
 *   **ベースラインが更新されないまま成功したように見える**。
 */
test.describe("Visual: 商品詳細", () => {
    test.skip(
        ({ browserName }) => browserName !== "chromium",
        "Visual Regression は chromium 限定（フォントレンダリング差のため）"
    );

    // seed フィクスチャを受け取ることで setupE2ETestState が goto 前に走り、
    // cookie / localStorage が決定論的な初期状態になる（browse.spec.ts と同形）。
    test("商品詳細の購入パネル表示", async ({ page, seed }) => {
        await page.goto(`/product/${seed.product.slug}/${seed.variant.slug}`, {
            waitUntil: "commit",
        });

        // 購入パネルの CTA が出るまで待つ（未描画の状態を固定しない）
        const addToCart = page.getByTestId("add-to-cart");
        await expect(addToCart).toBeVisible({ timeout: 15000 });
        await expect(page.getByRole('navigation', { name: 'Explore collections' })).toBeVisible();
        await expect(page.getByLabel(/^\d\.\d{2} out of 5 stars$/)).toBeVisible();

        // ピクセル比較の前に、購入パネルがビューポート内に収まっていることを
        // 客観値で確認する（plan 065 の回帰ガード）。スクリーンショットだけだと
        // ベースライン更新時に壊れた状態をそのまま固定できてしまうため、
        // 「収まっている」ことは数値でも主張しておく。
        const box = await addToCart.boundingBox();
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
        expect(box).not.toBeNull();
        // 左端も見る。右端だけだと、CTA がビューポート外へ左へ流れた場合に
        // 「右端は超えていない」ため素通りしてしまう。
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(clientWidth);
        const shippingToggle = page.getByTestId('shipping-breakdown-toggle');
        await expect(shippingToggle).toBeVisible();
        await expect(shippingToggle).toHaveAttribute('aria-expanded', 'false');
        await expect(shippingToggle.locator('span')).toHaveCSS('color', 'rgb(23, 43, 31)');
        await expect(shippingToggle).toHaveCSS('background-color', 'rgb(212, 186, 131)');
        await expect(page.getByTestId('product-summary')).toContainText(seed.variant.description);
        await expect(page.getByRole('link', { name: 'Read the story' })).toHaveAttribute('href', '#description');
        const description = page.locator('#description');
        await expect(description).toBeVisible();
        await expect(description.locator('..')).toHaveCSS('border-top-width', '0px');
        expect(await description.evaluate((element) => {
            const reviews = document.getElementById('reviews');
            return reviews !== null && Boolean(element.compareDocumentPosition(reviews) & Node.DOCUMENT_POSITION_FOLLOWING);
        })).toBe(true);
        const sectionHeadings = await page.getByRole('heading', { level: 2 }).allTextContents();
        expect(sectionHeadings.indexOf('Description')).toBeLessThan(sectionHeadings.indexOf('Other specifications'));
        expect(sectionHeadings.indexOf('Other specifications')).toBeLessThan(sectionHeadings.indexOf('Related products'));
        const share = page.getByTestId('product-share');
        await expect(share).toBeVisible();
        await expect(page.getByRole('button', { name: 'Share on Facebook' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Share on X' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Share on WhatsApp' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Share on Pinterest' })).toBeVisible();
        await expect(share.getByTestId('share-tile').first()).toHaveCSS('background-color', 'rgb(251, 250, 245)');
        expect(await page.getByRole('complementary', { name: 'Purchase options' }).locator('[data-testid="product-share"]').count()).toBe(0);
        const curatedBy = page.getByTestId('curated-by');
        expect((await curatedBy.boundingBox())!.y).toBeLessThan((await share.boundingBox())!.y);

        await expect(page).toHaveScreenshot("product-detail.png", {
            fullPage: true,
            mask: [page.locator("img")],
        });
        await shippingToggle.click();
        await expect(shippingToggle).toHaveAttribute('aria-expanded', 'true');
        const feeRegion = page.getByRole('region', { name: 'Shipping fee breakdown' });
        await expect(feeRegion).toBeVisible();
        await expect(feeRegion).toHaveCSS('background-color', 'rgb(247, 243, 232)');
        await expect(feeRegion.locator('dt').first()).toHaveCSS('color', 'rgb(43, 62, 48)');
        await expect(feeRegion.getByText('Total delivery')).toBeVisible();
        await expect(page.getByRole('complementary', { name: 'Purchase options' })).toHaveScreenshot('shipping-expanded.png');
    });
});
