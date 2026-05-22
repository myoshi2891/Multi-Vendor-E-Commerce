import { Page } from "@playwright/test";
import { test, expect } from "./_fixtures";
import { waitForCartPersist } from "@/config/test-helpers";

/**
 * Visual Regression: Cart ページ
 *
 * 売上直結フローの UI 崩れをマージ前に阻止する。
 * Chromium 限定（Firefox/WebKit はフォントレンダリング差が大きいため Phase 2）。
 *
 * Baseline 更新:
 *   bunx playwright test tests/e2e/visual --update-snapshots --project=chromium
 */

// スラグに正規表現メタ文字（. + ? など）が混入しても URL マッチが壊れないよう、
// RegExp に渡す前にエスケープする（MDN 標準パターン）。
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function addItemToCart(
    page: Page,
    productSlug: string,
    variantSlug: string
) {
    await page.goto(`/product/${productSlug}/${variantSlug}`);
    const firstSize = page.locator('[data-testid^="size-option-"]').first();
    await firstSize.click();
    // 製品/バリアントパスを含む厳密な URL を待つ（broad な /.*\?size=.*/ では他ページに誤マッチする可能性があるため）
    const escapedProductSlug = escapeRegex(productSlug);
    const escapedVariantSlug = escapeRegex(variantSlug);
    await page.waitForURL(
        new RegExp(
            `/product/${escapedProductSlug}/${escapedVariantSlug}\\?size=`
        ),
        { timeout: 5000 }
    );
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

    test("空カートの表示", async ({ page, seed: _seed }) => {
        await page.goto("/cart", { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId("cart-empty-message")).toBeVisible();
        await expect(page).toHaveScreenshot("cart-empty.png", {
            fullPage: true,
        });
    });

    test("商品追加後のカート表示", async ({ page, seed }) => {
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
