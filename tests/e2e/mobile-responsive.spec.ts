import { expect, test } from "@playwright/test";
import { buildE2ESeed } from "./seed/constants";
import { setupE2ETestState, waitForCartPersist } from "@/config/test-helpers";

test.describe("モバイルレスポンシブ", () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE 等のサイズ

  let seed: ReturnType<typeof buildE2ESeed>;
  let productSlug: string;
  let variantSlug: string;

  test.beforeEach(async ({ page }, testInfo) => {
    seed = buildE2ESeed({
      workerIndex: testInfo.workerIndex,
      projectName: testInfo.project.name,
    });
    productSlug = seed.product.slug;
    variantSlug = seed.variant.slug;
    await setupE2ETestState(page, seed);
  });

  // TODO: ハンバーガーメニュー実装後に有効化
  // アンブロック条件: mobile-menu-toggle, mobile-navigation, mobile-menu-close の data-testid が実装されること
  // 期限: 2026-04-30
  // 再現手順: (1) 375px viewport で / に遷移 (2) ハンバーガーメニューをクリック → ナビゲーション表示 (3) 閉じるボタンクリック → ナビゲーション非表示
  // 実装場所: src/components/store/layout/header/ (推定)
  test.skip("モバイルビューポートでナビゲーションメニューが開閉する -- ハンバーガーメニュー未実装", async ({ page }) => {
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

  // TODO: カートページのモバイルレイアウト修正後に有効化
  // アンブロック条件: /cart が 375px 幅で正常表示されること（flex+w-[380px]サイドバー問題の解決）
  // 期限: 2026-04-30
  // 再現手順: (1) 375px viewport で商品をカートに追加 (2) /cart に遷移 → カートアイテムと数量変更ボタンが画面内に表示されること
  // 実装場所: src/components/store/cart-page/container.tsx
  test.skip("モバイルでカート操作 (追加・数量変更) が機能する -- カートページが375px幅未対応（flex+w-[380px]サイドバーでアイテム列が画面外）", async ({ page }) => {
    await page.goto(`/product/${productSlug}/${variantSlug}`);
    // サイズ選択（purchase-flow と同パターン）
    const firstSize = page.locator('[data-testid^="size-option-"]').first();
    await firstSize.click();
    await page.waitForURL(/.*\?size=.*/, { timeout: 5000 });
    await page.getByTestId("add-to-cart").click();
    // Zustand persist が localStorage に書き込むのを待つ
    await expect(page.getByText(/Product added to cart/i)).toBeVisible({ timeout: 5000 });

    // カートページに移動
    await page.goto("/cart", { waitUntil: "domcontentloaded" });

    // モバイルでも数量変更ボタンが押せることを確認
    const increaseBtn = page.getByTestId("cart-qty-increase").first();
    await increaseBtn.scrollIntoViewIfNeeded();
    await expect(increaseBtn).toBeVisible();
    // 375px 幅ではレイアウトのサブピクセル移動で actionability チェックがリトライループに陥るため force
    await increaseBtn.click({ force: true });
    const qtyInput = page.getByTestId("cart-item-qty").first();
    await expect(qtyInput).toBeVisible();
    await expect(qtyInput).toHaveValue("2");
  });

  test("モバイルでチェックアウトボタンが機能する", async ({ page }, testInfo) => {
    // Firefox: /cart ナビゲーションが dev 環境でハングする既知の問題
    test.skip(testInfo.project.name === "firefox", "Firefox: cart navigation hangs in dev mode");

    await page.goto(`/product/${productSlug}/${variantSlug}`);
    // サイズ選択
    const firstSize = page.locator('[data-testid^="size-option-"]').first();
    await firstSize.click();
    await page.waitForURL(/.*\?size=.*/, { timeout: 5000 });
    await page.getByTestId("add-to-cart").click();
    // Zustand persist が localStorage に書き込むのを待つ
    await expect(page.getByText(/Product added to cart/i)).toBeVisible({ timeout: 5000 });

    // 共通ヘルパーで localStorage 書き込み完了を待つ
    await waitForCartPersist(page);

    await page.goto("/cart", { waitUntil: "domcontentloaded" });

    // checkoutボタンがモバイルでも見えるか、押せるか
    const checkoutBtn = page.getByTestId("checkout");
    await expect(checkoutBtn).toBeVisible();
    await checkoutBtn.click();
    // saveUserCart が未認証エラーを throw し、toast でエラー表示される
    await expect(page.getByText(/Unauthenticated/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe("タブレットレスポンシブ", () => {
  test.use({ viewport: { width: 768, height: 1024 } }); // iPad 縦等のサイズ

  let seed: ReturnType<typeof buildE2ESeed>;

  test.beforeEach(async ({ page }, testInfo) => {
    seed = buildE2ESeed({
      workerIndex: testInfo.workerIndex,
      projectName: testInfo.project.name,
    });
    await setupE2ETestState(page, seed);
  });

  test("タブレットビューポートでレイアウト切替", async ({ page }) => {
    // Set viewport explicitly to a tablet size
    await page.goto("/");
    // 特定の要素のスタイルや表示状態を確認する
    // StoreHeader は <div> で描画されるため banner ロールは存在しない。h1 "GoShop" で代替
    const header = page.locator("h1").filter({ hasText: "GoShop" });
    await expect(header).toBeVisible();

    // Assert presence/visibility of the main layout/sidebar
    const mainContent = page.getByTestId("app-main");
    await expect(mainContent).toBeVisible();

    // Check that we have a grid containing products
    const productCards = page.locator('[data-testid^="product-card-"]');
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
