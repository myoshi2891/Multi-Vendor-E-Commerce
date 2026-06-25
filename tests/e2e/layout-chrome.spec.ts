import { expect, test } from "@playwright/test";

/**
 * 共通レイアウト（ヘッダー/フッター）の表示検証。
 *
 * `(store)` グループの全ページで StoreHeader / Footer が一度だけ描画されること、
 * `(fullscreen)` グループの seller/apply には共通 chrome が付かないことを確認する。
 * Header(cookies) / Footer(DB) は async Server Component のため Jest/RTL では
 * 安定検証できず、E2E を採用している（plan 参照）。
 *
 * data-testid:
 *   - store-header : src/components/store/layout/header/header.tsx の最外 div
 *   - store-footer : src/components/store/layout/footer/footer.tsx の最外 div
 */
test.describe("共通レイアウト(ヘッダー/フッター)", () => {
  // 変更前は chrome が無かった代表ページ群
  const chromePages = ["/compare", "/returns-exchange", "/product-support"];

  for (const path of chromePages) {
    test(`${path} にヘッダーとフッターが各1つ表示される`, async ({ page }) => {
      await page.goto(path);

      await expect(page.getByTestId("store-header")).toHaveCount(1);
      await expect(page.getByTestId("store-header")).toBeVisible();
      await expect(page.getByTestId("store-footer")).toHaveCount(1);
      await expect(page.getByTestId("store-footer")).toBeVisible();
    });
  }

  test("ホームはヘッダーが二重にならず、フッターも表示される", async ({ page }) => {
    await page.goto("/");

    // (store)/layout.tsx の StoreHeader のみ。page.tsx 側の重複描画は除去済み。
    await expect(page.getByTestId("store-header")).toHaveCount(1);
    await expect(page.getByTestId("store-footer")).toHaveCount(1);
    await expect(page.getByTestId("store-footer")).toBeVisible();
  });

  test("一覧/カートにもヘッダーとフッターが各1つ表示される", async ({ page }) => {
    for (const path of ["/browse", "/cart"]) {
      await page.goto(path);
      await expect(page.getByTestId("store-header")).toHaveCount(1);
      await expect(page.getByTestId("store-footer")).toHaveCount(1);
    }
  });

  test("sign-in/sign-up にもヘッダーとフッターが各1つ表示される", async ({ page }) => {
    for (const path of ["/sign-in", "/sign-up"]) {
      await page.goto(path);
      await expect(page.getByTestId("store-header")).toHaveCount(1);
      await expect(page.getByTestId("store-footer")).toHaveCount(1);
    }
  });

  test("seller/apply は共通ヘッダー/フッターを持たない(MinimalHeader 全画面)", async ({ page }) => {
    await page.goto("/seller/apply");

    await expect(page.getByTestId("store-header")).toHaveCount(0);
    await expect(page.getByTestId("store-footer")).toHaveCount(0);
  });
});
