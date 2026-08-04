import { expect, test } from "@playwright/test";
import { buildE2ESeed } from "./seed/constants";
import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { createCustomerSession, requiresClerkAdmin } from "./helpers/auth";
import {
  gotoStable,
  setupE2ETestState,
  waitForCartPersist,
} from "@/config/test-helpers";

test.describe("決済異常系", () => {
  let seed: ReturnType<typeof buildE2ESeed>;

  test.beforeEach(async ({ page }, testInfo) => {
    seed = buildE2ESeed({
      parallelIndex: testInfo.parallelIndex,
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

  // 認証済み顧客の異常系。session の生成に Clerk Admin API を使うため、
  // ネストした describe に閉じ込めて上の未認証テストへ skip 条件を波及させない。
  test.describe("認証済み顧客", () => {
    test.skip(
      () => requiresClerkAdmin,
      "Requires CLERK_SECRET_KEY for Clerk admin operations."
    );

    // 住所を投入しない = 「住所未選択」状態が既定で成立する顧客
    const session = createCustomerSession();

    test.beforeAll(async () => {
      await session.create({ role: "USER" });
    });

    test.afterAll(async () => {
      await session.cleanup();
    });

    test("住所未選択で注文ボタンをクリックするとエラーメッセージが表示される", async ({
      page,
    }) => {
      // signIn + 商品ページ + カート投入 + checkout 遷移を含む重いフロー。
      // 本番ビルドでの認証フローに既定 30s では不足する（a11y/checkout.spec.ts:45 と同値）。
      //
      // サインイン直後に `waitForPostSignInSettle` を挟まないこと。挟むと後続の
      // 商品ページ goto がリクエストすら発行しないままハングする（実測: 45s × 3
      // リトライを 3 回連続で消費。同時刻にシェルから同 URL を curl すると
      // 0.5〜1.5s で 200 が返るのでサーバー側は健全）。同じ session ヘルパーで
      // settle を使わない a11y/checkout.spec.ts は同一フローを 9.3s で完走する。
      // 一方 `gotoStable` は残す —— Firefox はサインイン後のソフトリダイレクトが
      // goto に割り込んで `NS_BINDING_ABORTED` を投げるため、素の goto だと
      // 3 ブラウザ実測で flaky になる（gotoStable はこれを再試行で吸収する）。
      test.setTimeout(90000);
      const productSlug = process.env.E2E_PRODUCT_SLUG || seed.product.slug;
      const variantSlug = process.env.E2E_VARIANT_SLUG || seed.variant.slug;

      await session.signIn(page);

      // go to product, select size, and add to cart
      await gotoStable(page, `/product/${productSlug}/${variantSlug}`);
      const firstSize = page.locator('[data-testid^="size-option-"]').first();
      await firstSize.click();
      await page.waitForURL(/.*\?size=.*/, { timeout: 5000 });
      await page.getByTestId("add-to-cart").click();
      // Zustand persist が localStorage に書き込むのを待つ
      await expect(page.getByText(/Product added to cart/i)).toBeVisible({ timeout: 5000 });
      await waitForCartPersist(page);

      // /cart 経由で Checkout を押し DB Cart に同期する。
      // /checkout は DB Cart が空だと /cart にリダイレクトするため、
      // 直接 goto では到達できない（saveUserCart は /cart の Checkout で発火）。
      await page.goto("/cart", { waitUntil: "commit" });
      await page.waitForLoadState("domcontentloaded", { timeout: 15000 });
      await page.getByTestId("checkout").click();
      // Checkout ボタンは saveUserCart（サーバーアクション）の完了後に遷移する。
      // 本番ビルド + ローカル Postgres でも 10s を超える実測があったため 30s とる
      // （待ち時間の予算であって、検証内容の緩和ではない）。
      await page.waitForURL(/\/checkout/, { timeout: 30000 });

      // click place order without selecting address
      const placeOrderBtn = page.getByRole("button", { name: /Place order/i });
      await expect(placeOrderBtn).toBeVisible();
      await placeOrderBtn.click();
      await expect(page.getByText(/Select a shipping address/i)).toBeVisible({ timeout: 5000 });
    });
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
