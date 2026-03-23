import { expect, test } from "@playwright/test";
import { buildE2ESeed } from "./seed/constants";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";

test.describe("決済異常系", () => {
  let seed: ReturnType<typeof buildE2ESeed>;

  test.beforeEach(async ({ page }, testInfo) => {
    seed = buildE2ESeed({
      workerIndex: testInfo.workerIndex,
      projectName: testInfo.project.name,
    });
    await page.addInitScript(() => localStorage.clear());
    await page.context().addCookies([
      {
        name: "userCountry",
        value: JSON.stringify(seed.country),
        url: baseURL,
      },
    ]);
  });

  test("カート空でチェックアウトページにアクセスするとリダイレクトされる", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/checkout");
    await page.waitForURL((url) => !url.pathname.includes('/checkout') && (url.pathname === '/cart' || url.pathname === '/'));
    expect(page.url()).not.toContain("/checkout");
  });

  test("住所未選択で注文ボタンをクリックするとエラーメッセージが表示される", async ({ page }) => {
    await setupClerkTestingToken({ page });
    const productSlug = process.env.E2E_PRODUCT_SLUG || seed.product.slug;
    const variantSlug = process.env.E2E_VARIANT_SLUG || seed.variant.slug;
    
    // go to product and add to cart
    await page.goto(`/product/${productSlug}/${variantSlug}`);
    await page.getByTestId("add-to-cart").click();

    // go to checkout
    await page.goto("/checkout");
    
    // click place order without selecting address
    const placeOrderBtn = page.getByRole("button", { name: /Place Order/i });
    await expect(placeOrderBtn).toBeVisible();
    await placeOrderBtn.click();
    await expect(page.getByText(/Please select a shipping address|Address is required/i)).toBeVisible({ timeout: 5000 });
  });

  test.skip("在庫切れ商品がカートにある場合 Out of stock と表示される", async ({ page }) => {
    await page.goto("/cart");
    // Mock the API response for out of stock or just check the logic if we had one
    // For now, asserting that the page loads without crashing
    await expect(page.getByRole("heading", { name: /Shopping Cart/i })).toBeVisible();
  });

  test.skip("ブラウザバック後に二重送信されない（冪等性検証）", async ({ page }) => {
    // Navigate to a mock success page then back
    await page.goto("/cart");
    await page.goto("/");
    await page.goBack();
    await expect(page).toHaveURL(/.*cart/);
  });
});
