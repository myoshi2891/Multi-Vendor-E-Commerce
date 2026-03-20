import { expect, test } from "@playwright/test";
import { buildE2ESeed } from "./seed/constants";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";

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
    productSlug = process.env.E2E_PRODUCT_SLUG || seed.product.slug;
    variantSlug = process.env.E2E_VARIANT_SLUG || seed.variant.slug;

    await page.addInitScript(() => localStorage.clear());
    await page.context().addCookies([
      {
        name: "userCountry",
        value: JSON.stringify(seed.country),
        url: baseURL,
      },
    ]);
  });

  test("モバイルビューポートでナビゲーションメニューが開閉する", async ({ page }) => {
    await page.goto("/");
    const menuButton = page.getByRole("button", { name: /Toggle menu|Menu|Open/i }).first();
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(page.getByRole("navigation").first()).toBeVisible();
    // 閉じる操作
    const closeButton = page.getByRole("button", { name: /Close|Close menu/i }).first();
    await expect(closeButton).toBeVisible();
    await closeButton.click();
    // The menu might not immediately unmount or might use opacity, checking isHidden is better
    await expect(page.getByRole("navigation").first()).toBeHidden({ timeout: 5000 });
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
    expect(page.url()).toContain("sign-in");
  });
});

test.describe("タブレットレスポンシブ", () => {
  test.use({ viewport: { width: 768, height: 1024 } }); // iPad 縦等のサイズ

  test("タブレットビューポートでレイアウト切替", async ({ page }) => {
    await page.goto("/");
    // 特定の要素のスタイルや表示状態を確認する
    // e.g. check for visible product grid columns or header variations
    const header = page.getByRole("banner");
    await expect(header).toBeVisible();
  });
});
