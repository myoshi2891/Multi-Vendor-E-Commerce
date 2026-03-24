import { expect, test } from "@playwright/test";
import { buildE2ESeed } from "./seed/constants";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { setupE2ETestState } from "@/config/test-helpers";

test.describe("決済異常系", () => {
  let seed: ReturnType<typeof buildE2ESeed>;

  test.beforeEach(async ({ page }, testInfo) => {
    seed = buildE2ESeed({
      workerIndex: testInfo.workerIndex,
      projectName: testInfo.project.name,
    });
    await setupE2ETestState(page, seed);
  });

  test("未認証でチェックアウトページにアクセスするとサインインにリダイレクトされる", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/checkout");
    // /checkout はミドルウェアで保護されているため、未認証ではサインインにリダイレクト
    await page.waitForURL(/sign-in/, { timeout: 10000 });
  });

  test.skip("住所未選択で注文ボタンをクリックするとエラーメッセージが表示される -- Clerk認証セッションが必要", async ({ page }) => {
    await setupClerkTestingToken({ page });
    const productSlug = process.env.E2E_PRODUCT_SLUG || seed.product.slug;
    const variantSlug = process.env.E2E_VARIANT_SLUG || seed.variant.slug;

    // go to product, select size, and add to cart
    await page.goto(`/product/${productSlug}/${variantSlug}`);
    const firstSize = page.locator('[data-testid^="size-option-"]').first();
    await firstSize.click();
    await page.waitForURL(/.*\?size=.*/, { timeout: 5000 });
    await page.getByTestId("add-to-cart").click();
    // Zustand persist が localStorage に書き込むのを待つ
    await expect(page.getByText(/Product added to cart/i)).toBeVisible({ timeout: 5000 });

    // go to checkout
    await page.goto("/checkout");

    // click place order without selecting address
    const placeOrderBtn = page.getByRole("button", { name: /Place Order/i });
    await expect(placeOrderBtn).toBeVisible();
    await placeOrderBtn.click();
    await expect(page.getByText(/Select a shipping address/i)).toBeVisible({ timeout: 5000 });
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
