import { expect, test } from "@playwright/test";
import { E2E_SEED } from "./seed/constants";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
const productSlug = process.env.E2E_PRODUCT_SLUG || E2E_SEED.product.slug;
const variantSlug = process.env.E2E_VARIANT_SLUG || E2E_SEED.variant.slug;
const productName = process.env.E2E_PRODUCT_NAME || E2E_SEED.product.name;
const unitPrice = Number(
  process.env.E2E_UNIT_PRICE || E2E_SEED.size.price
);

test("guest can add item to cart and see totals", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());

  await page.context().addCookies([
    {
      name: "userCountry",
      value: JSON.stringify(E2E_SEED.country),
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
