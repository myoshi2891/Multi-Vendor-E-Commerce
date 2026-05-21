import { expect, test, Page } from "@playwright/test";
import { buildE2ESeed } from "../seed/constants";
import { setupE2ETestState, waitForCartPersist } from "@/config/test-helpers";

/**
 * Visual Regression: Cart ページ
 *
 * 売上直結フローの UI 崩れをマージ前に阻止する。
 * Chromium 限定（Firefox/WebKit はフォントレンダリング差が大きいため Phase 2）。
 *
 * Baseline 更新:
 *   bunx playwright test tests/e2e/visual --update-snapshots --project=chromium
 */

async function addItemToCart(
    page: Page,
    productSlug: string,
    variantSlug: string
) {
    await page.goto(`/product/${productSlug}/${variantSlug}`);
    const firstSize = page.locator('[data-testid^="size-option-"]').first();
    await firstSize.click();
    await page.waitForURL(/.*\?size=.*/, { timeout: 5000 });
    await page.getByTestId("add-to-cart").click();
    await expect(page.getByText(/Product added to cart/i)).toBeVisible({
        timeout: 5000,
    });
    await waitForCartPersist(page);
    await page.goto("/cart", { waitUntil: "commit" });
    await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
}

test.describe("Visual: Cart", () => {
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

    test("空カートの表示", async ({ page }) => {
        await page.goto("/cart", { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("cart-empty-message")).toBeVisible();
        await expect(page).toHaveScreenshot("cart-empty.png", {
            fullPage: true,
        });
    });

    test("商品追加後のカート表示", async ({ page }, testInfo) => {
        const seed = buildE2ESeed({
            workerIndex: testInfo.workerIndex,
            projectName: testInfo.project.name,
        });
        await addItemToCart(page, seed.product.slug, seed.variant.slug);
        await expect(page.getByTestId("cart-item-name")).toBeVisible();
        await expect(page).toHaveScreenshot("cart-with-item.png", {
            fullPage: true,
            mask: [
                // 動的に変わる可能性のある領域をマスク（必要に応じて追加）
                page.locator("[data-testid='cart-item-image']"),
            ],
        });
    });
});
