import { expect, test } from "@playwright/test";
import { buildE2ESeed } from "./seed/constants";
import { setupE2ETestState } from "@/config/test-helpers";

test.describe("検索・フィルタ", () => {
  let seed: ReturnType<typeof buildE2ESeed>;
  let productName: string;

  test.beforeEach(async ({ page }, testInfo) => {
    seed = buildE2ESeed({
      workerIndex: testInfo.workerIndex,
      projectName: testInfo.project.name,
    });
    await setupE2ETestState(page, seed);
    productName = process.env.E2E_PRODUCT_NAME || seed.product.name;
    await page.goto("/");
  });

  test("商品名で検索し結果が表示される", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search|What are you looking for/i).first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill(productName);
    await searchInput.press("Enter");

    await page.waitForURL(/.*search=.*/);
    await expect(page.getByText(productName).first()).toBeVisible({ timeout: 10000 });
  });

  test("カテゴリフィルタで絞り込まれる", async ({ page }) => {
    await page.goto("/browse");
    // seed:e2e は全プロジェクト分の同名カテゴリを作成するため .first() で限定
    const categoryLabel = page.locator("label").filter({ hasText: seed.category.name }).first();
    await expect(categoryLabel).toBeVisible();
    await categoryLabel.click();
    // カテゴリパラメータが URL に反映されることを確認
    await page.waitForURL(/[?&]category=/, { timeout: 5000 });
    await expect(page.getByText(productName).first()).toBeVisible({ timeout: 10000 });
  });

  test("フィルタ条件が URL パラメータに反映される", async ({ page }) => {
    await page.goto(`/browse?search=${encodeURIComponent(productName)}&category=${encodeURIComponent(seed.category.url)}`);
    const searchInput = page.getByPlaceholder(/Search|What are you looking for/i).first();
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveValue(productName);

    // カテゴリが選択されていることを、アクティブインジケータ（内側ドット）の存在で確認
    // 同名カテゴリが複数存在するため、アクティブインジケータを持つラベルで限定
    const activeCategory = page.locator("label")
      .filter({ hasText: seed.category.name })
      .filter({ has: page.locator("div.rounded-full.bg-black") });
    await expect(activeCategory).toBeVisible({ timeout: 10000 });
  });

  test("検索結果 0 件で適切なメッセージ表示される", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search|What are you looking for/i).first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("NonExistentProductxyz123");
    await searchInput.press("Enter");
    await expect(page.getByText(/No Products/i)).toBeVisible({ timeout: 10000 });
  });

  test.skip("ページネーションで次ページに遷移できる", async ({ page }) => {
    // Intercept API or provide a robust mock if it's a client fetch, otherwise just test URL logic
    await page.route("**/api/index-products*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          products: Array(15).fill(seed.product),
          total: 30,
          page: 1,
          limit: 15,
          totalPages: 2
        }),
      });
    });
    // Fallback: forcefully navigate with mock pagination to ensure button exists
    await page.goto("/browse");
    
    // If the button exists via SSR (which route mocking might not affect), we click it.
    // If it doesn't exist, we evaluate a script to inject a dummy one to test the routing logic, OR we use setupE2ETestState properly.
    const nextButton = page.getByRole("button", { name: /Next/i });
    await expect(nextButton).toBeVisible();
    await nextButton.click();
    await expect(page).toHaveURL(/.*page=2.*/);
  });
});
