import { expect, test } from "@playwright/test";
import { buildE2ESeed } from "./seed/constants";
import { setupE2ETestState } from "@/config/test-helpers";

test.describe("購入フルフロー", () => {
  let seed: ReturnType<typeof buildE2ESeed>;
  let productSlug: string;
  let variantSlug: string;
  let productName: string;
  let unitPrice: number;

  test.beforeEach(async ({ page }, testInfo) => {
    seed = buildE2ESeed({
      workerIndex: testInfo.workerIndex,
      projectName: testInfo.project.name,
    });
    productSlug = process.env.E2E_PRODUCT_SLUG || seed.product.slug;
    variantSlug = process.env.E2E_VARIANT_SLUG || seed.variant.slug;
    productName = process.env.E2E_PRODUCT_NAME || seed.product.name;
    unitPrice = Number(process.env.E2E_UNIT_PRICE ?? seed.size.price);
    if (!Number.isFinite(unitPrice)) {
      throw new Error(`Invalid E2E_UNIT_PRICE: ${process.env.E2E_UNIT_PRICE}`);
    }

    await setupE2ETestState(page, seed);
  });

  test("商品一覧→詳細→サイズ選択→カート追加→カートページ表示と数量変更", async ({ page }) => {
    await page.goto(`/product/${productSlug}/${variantSlug}`);
    
    await page.waitForURL('**/*?size=*', { timeout: 5000 });
    const current = new URL(page.url());
    expect(current.pathname).toBe(`/product/${productSlug}/${variantSlug}`);
    expect(current.searchParams.has("size")).toBe(true);
    await expect(page.getByTestId("product-price")).toBeVisible();

    await page.getByTestId("add-to-cart").click();

    await page.goto("/cart");

    const itemName = page.getByTestId("cart-item-name");
    await expect(itemName).toContainText(productName);

    const qtyInput = page.getByTestId("cart-item-qty");
    await expect(qtyInput).toHaveValue("1");

    const total = page.getByTestId("cart-total");
    await expect(total).toHaveText(`$${unitPrice.toFixed(2)}`);

    // 数量増加
    await page.getByTestId("cart-qty-increase").click();
    await expect(qtyInput).toHaveValue("2");
    await expect(total).toHaveText(`$${(unitPrice * 2).toFixed(2)}`);
    
    // 数量減少
    await page.getByTestId("cart-qty-decrease").click();
    await expect(qtyInput).toHaveValue("1");
    await expect(total).toHaveText(`$${unitPrice.toFixed(2)}`);
  });

  test("カートからアイテムを削除できる", async ({ page }) => {
    // Add item
    await page.goto(`/product/${productSlug}/${variantSlug}`);
    await page.getByTestId("add-to-cart").click();
    await page.goto("/cart");

    const itemName = page.getByTestId("cart-item-name");
    await expect(itemName).toContainText(productName);

    // qty=1 の状態で decrease すると削除される
    await page.getByTestId("cart-qty-decrease").click();
    
    await expect(page.getByText("Your cart is empty")).toBeVisible();
    await expect(page.getByTestId("cart-item-name")).toHaveCount(0);
  });

  test("ページリロード後もカートが永続化されている", async ({ page }) => {
    await page.goto(`/product/${productSlug}/${variantSlug}`);
    await page.getByTestId("add-to-cart").click();
    await page.goto("/cart");

    await expect(page.getByTestId("cart-item-name")).toBeVisible();
    
    await page.reload();

    await expect(page.getByTestId("cart-item-name")).toBeVisible();
    await expect(page.getByTestId("cart-item-qty")).toHaveValue("1");
  });

  test("未認証ユーザーがチェックアウトに進むとログインにリダイレクト", async ({ page }) => {
    await page.goto(`/product/${productSlug}/${variantSlug}`);
    await page.getByTestId("add-to-cart").click();
    await page.goto("/cart");

    await page.getByTestId("checkout").click();

    // Clerkのログインページへリダイレクトされることを確認（URLにsign-inが含まれる）
    await page.waitForURL(/\/sign-in/);
  });
});
