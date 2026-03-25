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

  // TODO: Clerk 認証セッション完全セットアップ後に有効化
  // アンブロック条件: setupClerkTestingToken が /checkout への認証済みアクセスを許可し、address 選択画面まで正常動作すること
  // 期限: 2026-04-30
  // 再現手順: (1) 認証済みセッションで /checkout に遷移 (2) 住所未選択で Place Order クリック → "Select a shipping address" エラー表示を確認
  // 関連: setupClerkTestingToken はテストトークンを設定するのみで、ミドルウェア保護ルートへの完全認証は提供しない
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

  // TODO: 在庫切れロジック実装後に有効化
  // アンブロック条件: カートページで在庫切れ商品に "Out of stock" 表示が実装されること
  // 期限: 2026-04-30
  // 再現手順: (1) 在庫0の商品をカートに追加 (2) /cart に遷移 → "Out of stock" メッセージを確認
  // 実装場所: src/components/store/cart-page/
  test.skip("在庫切れ商品がカートにある場合 Out of stock と表示される", async ({ page }) => {
    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    // Mock the API response for out of stock or just check the logic if we had one
    // For now, asserting that the page loads without crashing
    await expect(page.getByRole("heading", { name: /Shopping Cart/i })).toBeVisible();
  });

  // TODO: 冪等性検証ロジック実装後に有効化
  // アンブロック条件: 注文送信の冪等性トークン（またはセッションベース重複防止）が実装されること
  // 期限: 2026-04-30
  // 再現手順: (1) 注文を送信 (2) ブラウザバックして再送信 → 二重送信が防止されることを確認
  // 実装場所: src/queries/user.ts (placeOrder) または checkout ページ
  test.skip("ブラウザバック後に二重送信されない（冪等性検証）", async ({ page }) => {
    // Navigate to a mock success page then back
    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await page.goto("/");
    await page.goBack();
    await expect(page).toHaveURL(/.*cart/);
  });
});
