import { expect, test } from "@playwright/test";
import { buildE2ESeed } from "./seed/constants";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
test("guest can add item to cart and see totals", async ({ page }, testInfo) => {
  const seed = buildE2ESeed({
    workerIndex: testInfo.workerIndex,
    projectName: testInfo.project.name,
  });
  const productSlug = process.env.E2E_PRODUCT_SLUG || seed.product.slug;
  const variantSlug = process.env.E2E_VARIANT_SLUG || seed.variant.slug;
  const productName = process.env.E2E_PRODUCT_NAME || seed.product.name;
  const unitPrice = Number(process.env.E2E_UNIT_PRICE || seed.size.price);

  await page.addInitScript(() => localStorage.clear());

  await page.context().addCookies([
    {
      name: "userCountry",
      value: JSON.stringify(seed.country),
      url: baseURL,
    },
  ]);

  await page.goto(`/product/${productSlug}/${variantSlug}`);
  await expect(page).toHaveURL(
    new RegExp(`/product/${productSlug}/${variantSlug}\\?size=`)
  );
  await expect(page.getByTestId("product-price")).toBeVisible();

  await page.getByTestId("add-to-cart").click();

  await page.goto("/cart");

  const itemName = page.getByTestId("cart-item-name");
  await expect(itemName).toContainText(productName);

  const qtyInput = page.getByTestId("cart-item-qty");
  await expect(qtyInput).toHaveValue("1");

  const total = page.getByTestId("cart-total");
  await expect(total).toHaveText(`$${unitPrice.toFixed(2)}`);

  await page.getByTestId("cart-qty-increase").click();
  await expect(qtyInput).toHaveValue("2");
  await expect(total).toHaveText(`$${(unitPrice * 2).toFixed(2)}`);
});
