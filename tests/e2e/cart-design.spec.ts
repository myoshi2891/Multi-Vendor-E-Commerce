import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const item = {
    productId: "cart-design",
    variantId: "ivory",
    sizeId: "medium",
    productSlug: "piece",
    variantSlug: "ivory",
    name: "Considered linen with a beautifully long product name",
    variantName: "Ivory",
    size: "M",
    image: "/assets/images/cart.avif",
    price: 120,
    quantity: 2,
    stock: 8,
    weight: 1,
    shippingMethod: "ITEM",
    shippingFee: 5,
    extraShippingFee: 2,
    shippingService: "Standard",
};
async function setup(page: Page, populated: boolean, fail = false) {
    await page.addInitScript(
        (cart) =>
            localStorage.setItem(
                "cart",
                JSON.stringify({
                    state: { cart, totalItems: cart.length, totalPrice: 240 },
                    version: 0,
                })
            ),
        populated ? [item] : []
    );
    await page.route("**/cart", async (route) => {
        if (!route.request().headers()["next-action"]) return route.continue();
        if (fail) return route.fulfill({ status: 500, body: "Unavailable" });
        const args = JSON.parse(route.request().postData() || "[]");
        const result = Array.isArray(args[0]) ? args[0] : true;
        await route.fulfill({
            contentType: "text/x-component",
            body: `0:{"a":"$@1","f":"","b":"development"}\n1:${JSON.stringify(result)}\n`,
        });
    });
}
async function accessible(page: Page) {
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth
        )
    ).toBe(false);
    expect(
        (
            await new AxeBuilder({ page })
                .include("main")
                .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                .analyze()
        ).violations
    ).toEqual([]);
}
for (const width of [1440, 390, 768]) {
    test(`empty branded cart ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await setup(page, false);
        await page.goto("/cart");
        await expect(page.locator("main h1")).toHaveText("Your shopping bag");
        await expect(page.locator("main")).toHaveCSS(
            "background-color",
            "rgb(243, 240, 232)"
        );
        const explore = page.getByRole("link", {
            name: "Explore items",
            exact: true,
        });
        await explore.focus();
        await expect(explore).toHaveCSS("outline-style", "solid");
        await accessible(page);
    });
    test(`populated branded cart ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await setup(page, true);
        await page.goto("/cart");
        await expect(page.getByTestId("cart-total")).toHaveText("$247.00");
        const select = page.getByRole("checkbox", {
            name: "Select all products",
        });
        await select.focus();
        await page.keyboard.press("Space");
        await expect(select).toBeChecked();
        await accessible(page);
        await page.screenshot({
            path: test.info().outputPath(`cart-${width}.png`),
            fullPage: true,
        });
        await page
            .getByRole("button", { name: "Delete all selected products" })
            .click();
        await expect(page.getByTestId("cart-empty-message")).toBeVisible();
    });
}
test("sync error shows branded dismissible toast and keeps local items", async ({
    page,
}) => {
    await setup(page, true, true);
    await page.goto("/cart");
    await expect(page.getByTestId("cart-item-name")).toBeVisible();
    const notification = page
        .getByRole("status")
        .filter({ hasText: "We couldn’t refresh" });
    await expect(notification).toBeVisible();
    await expect(notification).toHaveCSS("background-color", "rgb(23, 37, 29)");
    await page.getByRole("button", { name: "Dismiss notification" }).click();
    await expect(notification).toHaveCount(0);
    await accessible(page);
});

test("loading and out-of-stock states are accessible", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1000 });
    await setup(page, true);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    await page.route("**/cart", async (route) => {
        if (!route.request().headers()["next-action"]) return route.fallback();
        await gate;
        await route.fulfill({
            contentType: "text/x-component",
            body: `0:{"a":"$@1","f":"","b":"development"}\n1:${JSON.stringify([{ ...item, stock: 0 }])}\n`,
        });
    });
    await page.goto("/cart");
    await expect(page.getByRole("status")).toContainText(
        "Loading your shopping bag"
    );
    await accessible(page);
    release();
    await expect(page.getByText("Out of stock")).toBeVisible();
    await expect(
        page.getByRole("button", { name: "Increase quantity" })
    ).toBeDisabled();
    await accessible(page);
});

test("wishlist success has branded feedback without a real write", async ({
    page,
}) => {
    await setup(page, true);
    await page.goto("/cart");
    await page.getByTestId("cart-item-wishlist-btn").click();
    const notification = page
        .getByRole("status")
        .filter({ hasText: "Product successfully added to wishlist" });
    await expect(notification).toBeVisible();
    await expect(notification).toHaveCSS("background-color", "rgb(23, 37, 29)");
    await page.keyboard.press("Tab");
    await page.getByRole("button", { name: "Dismiss notification" }).focus();
    await expect(
        page.getByRole("button", { name: "Dismiss notification" })
    ).toHaveCSS("outline-style", "solid");
    expect(
        (
            await new AxeBuilder({ page })
                .include('[role="status"]')
                .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                .analyze()
        ).violations
    ).toEqual([]);
});

test("checkout pending and failure preserve the bag", async ({ page }) => {
    await setup(page, true);
    await page.goto("/cart");
    await expect(page.getByTestId("cart-total")).toBeVisible();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    await page.route("**/cart", async (route) => {
        if (!route.request().headers()["next-action"]) return route.fallback();
        await gate;
        await route.fulfill({ status: 500, body: "Unable to save" });
    });
    await page.getByTestId("checkout").click();
    await expect(page.getByTestId("checkout")).toBeDisabled();
    await expect(page.getByRole("status")).toContainText("Preparing checkout");
    await accessible(page);
    release();
    await expect(
        page.getByRole("button", { name: "Dismiss notification" })
    ).toBeVisible();
    await expect(page.getByTestId("checkout")).toBeEnabled();
    await expect(page.getByTestId("cart-item-name")).toBeVisible();
    await expect(page).toHaveURL(/\/cart$/);
});
