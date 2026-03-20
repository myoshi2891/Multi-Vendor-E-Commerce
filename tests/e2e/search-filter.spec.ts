import { expect, test } from "@playwright/test";
import { buildE2ESeed } from "./seed/constants";

test.describe("検索・フィルタ", () => {
  let seed: ReturnType<typeof buildE2ESeed>;
  let productName: string;

  test.beforeEach(async ({ page }, testInfo) => {
    seed = buildE2ESeed({
      workerIndex: testInfo.workerIndex,
      projectName: testInfo.project.name,
    });
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
    const categoryCheckbox = page.getByRole("checkbox", { name: seed.category.name });
    if (await categoryCheckbox.isVisible()) {
        await categoryCheckbox.click();
        await expect(page).toHaveURL(new RegExp(`[?&]category=${encodeURIComponent(seed.category.url)}(?:&|$)`));
        await expect(page.getByText(productName).first()).toBeVisible();
    }
  });

  test("フィルタ条件が URL パラメータに反映される", async ({ page }) => {
    await page.goto(`/browse?search=${encodeURIComponent(productName)}&category=${seed.category.url}`);
    const searchInput = page.getByPlaceholder(/Search|What are you looking for/i).first();
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveValue(productName);
    
    const categoryCheckbox = page.getByRole("checkbox", { name: seed.category.name });
    await expect(categoryCheckbox).toBeVisible();
    await expect(categoryCheckbox).toBeChecked();
  });

  test("検索結果 0 件で適切なメッセージ表示される", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search|What are you looking for/i).first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("NonExistentProductxyz123");
    await searchInput.press("Enter");
    await expect(page.getByText(/No products found|0 results/i)).toBeVisible({ timeout: 10000 });
  });

  test("ページネーションで次ページに遷移できる", async ({ page }) => {
    await page.goto("/browse");
    const nextButton = page.getByRole("button", { name: /Next/i });
    await expect(nextButton).toBeVisible();
    await nextButton.click();
    await expect(page).toHaveURL(/.*page=2.*/);
  });
});
