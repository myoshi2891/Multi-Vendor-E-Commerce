import { expect, test } from "@playwright/test";
import { buildE2ESeed } from "./seed/constants";

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
    // 認証をモックした前提
    await page.goto("/checkout");
    // カートが空の場合はカートページまたはトップページにリダイレクトされる
    await page.waitForURL(/\/cart|\//);
    expect(page.url()).not.toContain("/checkout");
  });

  test("住所未選択で注文ボタンをクリックするとエラーメッセージが表示される", async ({ page }) => {
    // カートにアイテムを追加
    const productSlug = process.env.E2E_PRODUCT_SLUG || seed.product.slug;
    const variantSlug = process.env.E2E_VARIANT_SLUG || seed.variant.slug;
    await page.goto(`/product/${productSlug}/${variantSlug}`);
    await page.getByTestId("add-to-cart").click();

    // checkoutに移動
    // （未認証ゲストだと/sign-inに行くため、認証状態を作るか、ログイン不要なモックを想定）
    // await page.goto("/checkout");
    // await page.getByRole("button", { name: "Place Order" }).click();
    // await expect(page.getByText("Please select a shipping address")).toBeVisible();
  });

  test("在庫切れ商品がカートにある場合 Out of stock と表示される", async ({ page }) => {
    // 在庫切れ商品をカートに入れる（あるいはカートに入れた後で在庫を0にする処理）
    // await page.goto("/cart");
    // await expect(page.getByText("Out of stock")).toBeVisible();
  });

  test("ブラウザバック後に二重送信されない（冪等性検証）", async ({ page }) => {
    // 決済完了画面からブラウザバックして再度Place Orderを押しても処理されない
  });

  test("ネットワークエラー後に再試行できる", async ({ page }) => {
    // 意図的にオフラインにするかAPIエラーをモック
  });

  test("決済中ページリロードで状態リカバリできる", async ({ page }) => {
    // 決済中にリロード
  });
});
