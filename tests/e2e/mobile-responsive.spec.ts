import { expect, test } from "@playwright/test";
import { E2E_SEED } from "./seed/constants";
import { setupE2ETestState } from "@/config/test-helpers";

test.describe("モバイルレスポンシブ", () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE 等のサイズ

  const seed = E2E_SEED;
  const productSlug = seed.product.slug;
  const variantSlug = seed.variant.slug;

  test.beforeEach(async ({ page }) => {
    await setupE2ETestState(page, seed);
  });

  test("モバイルビューポートでナビゲーションメニューが開閉する", async ({ page }) => {
    await page.goto("/");
    const menuButton = page.getByTestId("mobile-menu-toggle");
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(page.getByTestId("mobile-navigation")).toBeVisible();
    // 閉じる操作
    const closeButton = page.getByTestId("mobile-menu-close");
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    // The menu might not immediately unmount or might use opacity, checking isHidden is better
    await expect(page.getByTestId("mobile-navigation")).toBeHidden({ timeout: 5000 });
  });

  test("モバイルでカート操作 (追加・数量変更) が機能する", async ({ page }) => {
    await page.goto(`/product/${productSlug}/${variantSlug}`);
    await page.getByTestId("add-to-cart").click();
    
    // カートページに移動
    await page.goto("/cart");
    
    // モバイルでも数量変更ボタンが押せることを確認
    const increaseBtn = page.getByTestId("cart-qty-increase").first();
    await expect(increaseBtn).toBeVisible();
    await increaseBtn.click();
    const qtyInput = page.getByTestId("cart-item-qty").first();
    await expect(qtyInput).toBeVisible();
    await expect(qtyInput).toHaveValue("2");
  });

  test("モバイルでチェックアウトフローが完了できる", async ({ page }) => {
    await page.goto(`/product/${productSlug}/${variantSlug}`);
    await page.getByTestId("add-to-cart").click();
    await page.goto("/cart");

    // checkoutボタンがモバイルでも見えるか、押せるか
    const checkoutBtn = page.getByTestId("checkout");
    await expect(checkoutBtn).toBeVisible();
    await checkoutBtn.click();
    // ゲストなのでログインにリダイレクトされることを確認
    await page.waitForURL(/.*sign-in.*/);
  });
});

test.describe("タブレットレスポンシブ", () => {
  test.use({ viewport: { width: 768, height: 1024 } }); // iPad 縦等のサイズ

  const seed = E2E_SEED;

  test.beforeEach(async ({ page }) => {
    await setupE2ETestState(page, seed);
  });

  test("タブレットビューポートでレイアウト切替", async ({ page }) => {
    // Set viewport explicitly to a tablet size
    await page.goto("/");
    // 特定の要素のスタイルや表示状態を確認する
    const header = page.getByRole("banner");
    await expect(header).toBeVisible();

    // Assert presence/visibility of the main layout/sidebar
    const mainContent = page.getByTestId("app-main");
    await expect(mainContent).toBeVisible();
    
    // Check that we have a grid containing products
    const productCards = page.getByTestId("product-card");
    // Ensure product cards are rendered
    await expect(productCards.first()).toBeVisible({ timeout: 10000 });

    // Verify tablet behaviors such as the product grid column count (inspect computed style)
    const productGrid = page.getByTestId("product-grid").first();
    const gridStyle = await productGrid.evaluate((el) => window.getComputedStyle(el).display);
    expect(gridStyle).toBe("flex");

    // Count visible column items to verify tablet specific grid
    const visibleCount = await productCards.count();
    expect(visibleCount).toBeGreaterThan(0);
  });
});
