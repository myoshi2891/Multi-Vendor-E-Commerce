import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [1440, 768, 390]) {
    test(`header panels ${width}: brand, keyboard, search, country states`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?screen=browse");
        await page.route("**/api/search-products?*", (route) =>
            route.fulfill({
                json: [
                    {
                        name: "A considered piece ".repeat(12),
                        image: "/assets/images/no_image.png",
                        link: "/product/fixture/variant",
                    },
                ],
            })
        );
        const account = page.getByLabel("Account menu", { exact: true });
        await account.focus();
        await account.press("Enter");
        await expect(
            page.getByRole("link", { name: "Sign in", exact: true })
        ).toBeVisible();
        expect(
            await page
                .getByRole("heading", { name: "Your account" })
                .locator("..")
                .evaluate((el) => getComputedStyle(el).backgroundColor)
        ).toBe("rgb(243, 240, 232)");
        await page.screenshot({
            path: info.outputPath(`account-${width}.png`),
        });
        expect(
            (
                await new AxeBuilder({ page })
                    .include("header")
                    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                    .analyze()
            ).violations
        ).toEqual([]);
        await account.press("Escape");
        await expect(account).toBeFocused();
        const search = page.getByLabel("Open search / 検索", { exact: true });
        const size = await search.boundingBox();
        expect(size!.height).toBeGreaterThanOrEqual(44);
        expect(size!.width).toBeGreaterThanOrEqual(44);
        await search.press("Enter");
        await page
            .getByRole("textbox", { name: "Search products" })
            .fill("piece");
        const link = page.getByRole("link", { name: /A considered piece/ });
        await expect(link).toBeVisible();
        await link.focus();
        await expect(link).toBeFocused();
        await page.screenshot({ path: info.outputPath(`search-${width}.png`) });
        expect(
            (
                await new AxeBuilder({ page })
                    .include("header")
                    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                    .analyze()
            ).violations
        ).toEqual([]);
        await search.press("Escape");
        await page.getByLabel("Open menu / メニュー", { exact: true }).click();
        await page.getByLabel("Country, language and currency:").click();
        await page.getByRole("button", { name: "Ship to: Japan" }).click();
        await page
            .getByRole("searchbox", { name: "Search a country" })
            .fill("United States");
        await page.route("**/api/setUserCountryInCookies", (route) =>
            route.fulfill({ status: 500, json: {} })
        );
        await page.getByRole("searchbox").press("ArrowDown");
        await page
            .getByRole("option", { name: "United States", exact: true })
            .press("Enter");
        await expect(page.getByRole("alert")).toContainText(
            "previous selection is unchanged"
        );
        await page.unroute("**/api/setUserCountryInCookies");
        await page.route("**/api/setUserCountryInCookies", async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 250));
            await route.fulfill({ json: {} });
        });
        await page.getByRole("button", { name: "Retry", exact: true }).click();
        await expect(
            page
                .getByRole("status")
                .filter({ hasText: "Shipping country saved" })
        ).toContainText("United States");
        await page.screenshot({
            path: info.outputPath(`country-${width}.png`),
        });
        expect(
            (
                await new AxeBuilder({ page })
                    .include("header")
                    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                    .analyze()
            ).violations
        ).toEqual([]);
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth
            )
        ).toBe(true);
    });
}

test("signed account presentation preserves provider control and links", async ({
    page,
}) => {
    await page.goto("/?screen=browse&signed=1");
    await page.getByLabel("Account menu", { exact: true }).click();
    await expect(
        page.getByRole("button", { name: "Manage account" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await expect(page.getByRole("link", { name: "My Orders" })).toHaveAttribute(
        "href",
        "/profile/orders"
    );
});
test("suggestion Enter follows its existing product route", async ({
    page,
}) => {
    await page.route("**/api/search-products?*", (route) =>
        route.fulfill({
            json: [
                {
                    name: "Considered piece",
                    image: "/assets/images/no_image.png",
                    link: "/product/fixture/variant",
                },
            ],
        })
    );
    await page.goto("/?screen=browse");
    await page.getByLabel("Open search / 検索", { exact: true }).click();
    await page.getByRole("textbox", { name: "Search products" }).fill("piece");
    await page.getByRole("link", { name: "Considered piece" }).press("Enter");
    await expect(page).toHaveURL(/\/product\/fixture\/variant$/);
});

for (const width of [1440, 768, 390]) {
    test(`home ${width}: reduced motion and collection navigation`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?screen=home");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(
            page.getByRole("button", { name: /motion reduced/ })
        ).toBeDisabled();
        await expect(
            page
                .getByRole("main")
                .getByRole("link", { name: /Discover the collections/ })
        ).toHaveAttribute("href", "/browse");
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth
            )
        ).toBe(true);
        expect(
            (
                await new AxeBuilder({ page })
                    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                    .analyze()
            ).violations
        ).toEqual([]);
        await page.screenshot({
            path: info.outputPath(`home-${width}.png`),
            fullPage: true,
        });
    });
}

for (const width of [1440, 768, 390]) {
    test(`browse ${width}: filter and sort portal preserve conditions`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(
            "/browse?screen=browse&category=art&size=M&search=piece"
        );
        if (width === 390) {
            await page
                .getByRole("button", { name: "Show filters" })
                .press("Enter");
            await expect(
                page.getByRole("button", { name: "Hide filters" })
            ).toHaveAttribute("aria-expanded", "true");
        }
        const sort = page.getByRole("button", { name: "Sort by Most Popular" });
        await sort.focus();
        await sort.press("Enter");
        const choice = page.getByRole("menuitemradio", {
            name: "Price low to high",
        });
        await expect(choice).toBeVisible();
        await choice.focus();
        expect((await choice.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        expect(
            (
                await new AxeBuilder({ page })
                    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                    .analyze()
            ).violations.map((v) => ({
                id: v.id,
                nodes: v.nodes.map((n) => ({
                    target: n.target,
                    summary: n.failureSummary,
                })),
            }))
        ).toEqual([]);
        await page.screenshot({
            path: info.outputPath(`browse-sort-${width}.png`),
        });
        await choice.press("Enter");
        const query = new URL(page.url()).searchParams;
        expect(query.get("sort")).toBe("price-low-to-high");
        expect(query.get("category")).toBe("art");
        expect(query.get("size")).toBe("M");
        expect(query.get("search")).toBe("piece");
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth
            )
        ).toBe(true);
    });
}

for (const width of [1440, 768, 390]) {
    test(`product ${width}: quantity and review controls`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?screen=product");
        const plus = page.getByRole("button", { name: "Increase quantity" });
        expect((await plus.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        expect((await plus.boundingBox())!.width).toBeGreaterThanOrEqual(44);
        await plus.press("Enter");
        await expect(page.getByRole("spinbutton")).toHaveValue("2");
        await plus.press("Enter");
        await expect(plus).toBeDisabled();
        const photos = page.getByRole("button", { name: /With photos/ });
        expect((await photos.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await photos.press("Enter");
        await expect(photos).toHaveAttribute("aria-pressed", "true");
        const pages = page.getByRole("navigation", { name: "Review pages" });
        await pages
            .getByRole("button", { name: "2", exact: true })
            .press("Enter");
        await expect(
            pages.getByRole("button", { name: "2", exact: true })
        ).toHaveAttribute("aria-current", "page");
        expect(
            (
                await new AxeBuilder({ page })
                    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                    .analyze()
            ).violations.map((v) => ({
                id: v.id,
                nodes: v.nodes.map((n) => ({
                    target: n.target,
                    summary: n.failureSummary,
                })),
            }))
        ).toEqual([]);
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth
            )
        ).toBe(true);
        await page.screenshot({
            path: info.outputPath(`product-${width}.png`),
        });
        await page.goto("/?screen=product&no-size=1");
        await expect(page.getByRole("status")).toContainText(
            "Select a size to choose quantity."
        );
        await expect(page.getByRole("spinbutton")).toHaveCount(0);
    });
}

for (const width of [1440, 768, 390]) {
    test(`store ${width}: long identity, collection and empty state`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?screen=store");
        const collection = page.getByRole("link", {
            name: "Explore the collection",
        });
        expect((await collection.boundingBox())!.height).toBeGreaterThanOrEqual(
            44
        );
        await collection.press("Enter");
        await expect(page).toHaveURL(/#collection$/);
        await expect(page.getByRole("heading", { level: 1 })).toContainText(
            "A considered store"
        );
        await expect(
            page.getByRole("link", { name: /Clear filters/ })
        ).toHaveAttribute("href", "/store/fixture#collection");
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth
            )
        ).toBe(true);
        expect(
            (
                await new AxeBuilder({ page })
                    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                    .analyze()
            ).violations.map((v) => ({
                id: v.id,
                nodes: v.nodes.map((n) => ({
                    target: n.target,
                    summary: n.failureSummary,
                })),
            }))
        ).toEqual([]);
        await page.screenshot({
            path: info.outputPath(`store-${width}.png`),
            fullPage: true,
        });
    });
}

for (const width of [1440, 768, 390]) {
    test(`store cards ${width}: editorial product actions`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?screen=store&pieces=1");
        await expect(
            page.getByRole("status").filter({ hasText: "1 piece found" })
        ).toHaveCount(1);
        const compare = page.getByRole("button", {
            name: "Add to compare",
            exact: true,
        });
        await compare.focus();
        expect((await compare.boundingBox())!.height).toBeGreaterThanOrEqual(
            44
        );
        expect((await compare.boundingBox())!.width).toBeGreaterThanOrEqual(44);
        await compare.press("Enter");
        await expect(
            page.getByRole("button", {
                name: "Remove from compare",
                exact: true,
            })
        ).toBeVisible();
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth
            )
        ).toBe(true);
        expect(
            (
                await new AxeBuilder({ page })
                    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                    .analyze()
            ).violations.map((v) => ({
                id: v.id,
                nodes: v.nodes.map((n) => ({
                    target: n.target,
                    summary: n.failureSummary,
                })),
            }))
        ).toEqual([]);
        await page.screenshot({
            path: info.outputPath(`store-cards-${width}.png`),
        });
    });
}

for (const width of [1440, 768, 390]) {
    test(`cart ${width}: quantity, checkout failure and empty`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?screen=cart");
        const plus = page.getByRole("button", {
            name: "Increase quantity",
            exact: true,
        });
        await expect(plus).toBeEnabled();
        expect((await plus.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await plus.press("Enter");
        await expect(page.getByTestId("cart-item-qty")).toHaveValue("2");
        const checkout = page.getByTestId("checkout");
        await checkout.press("Enter");
        await expect(checkout).toBeDisabled();
        await expect(page.getByRole("alert")).toContainText(
            "couldn’t start checkout"
        );
        const dismiss = page.getByRole("button", {
            name: "Dismiss notification",
        });
        expect((await dismiss.boundingBox())!.height).toBeGreaterThanOrEqual(
            44
        );
        expect(
            (
                await new AxeBuilder({ page })
                    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                    .analyze()
            ).violations.map((v) => ({
                id: v.id,
                nodes: v.nodes.map((n) => ({
                    target: n.target,
                    summary: n.failureSummary,
                })),
            }))
        ).toEqual([]);
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth
            )
        ).toBe(true);
        await page.screenshot({
            path: info.outputPath(`cart-${width}.png`),
            fullPage: true,
        });
        await dismiss.press("Enter");
        await page
            .getByRole("button", { name: /^Remove .* from cart$/ })
            .press("Enter");
        await expect(
            page.getByRole("link", { name: /Explore items/ })
        ).toHaveAttribute("href", "/browse");
    });
}

test("cart retry starts checkout after retaining failed bag", async ({
    page,
}) => {
    await page.goto("/?screen=cart");
    const checkout = page.getByTestId("checkout");
    await expect(checkout).toBeEnabled();
    await checkout.click();
    await expect(checkout).toBeDisabled();
    await expect(page.getByRole("alert")).toContainText(
        "couldn’t start checkout"
    );
    await expect(page.getByTestId("cart-item-qty")).toHaveValue("1");
    await checkout.click();
    await expect(page).toHaveURL(/\/checkout$/);
});
test("cart sync failure keeps local contents", async ({ page }) => {
    await page.goto("/?screen=cart&sync-error=1");
    await expect(page.getByTestId("cart-item-qty")).toHaveValue("1");
    await expect(
        page.getByRole("alert").filter({ hasText: "Prices and" })
    ).toBeVisible();
});

// Residual migration: use rendered styles, rather than CSS-source assertions.
test("residual tokens: filter panel is an explicit light purchase surface", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.goto("/?screen=browse");
    const toggle = page.getByRole("button", { name: "Show filters" });
    await expect(toggle.locator("..")).toHaveCSS("background-color", "rgb(243, 240, 232)");
    await toggle.focus();
    await expect(toggle).toHaveCSS("outline-style", "solid");
    await expect(toggle.locator("..")).toHaveCSS("color-scheme", "light");
});

for (const width of [1440, 768, 390]) {
    test(`residual browse ${width}: filter hit area and focus`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/browse?screen=browse&size=M&search=piece");
        if (width < 851) await page.getByRole("button", { name: "Show filters" }).press("Enter");
        const category = page.getByRole("button", { name: "Category", exact: true });
        expect((await category.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        const art = page.getByRole("button", { name: "Art", exact: true });
        expect((await art.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await art.focus();
        await expect(art).toHaveCSS("outline-style", "solid");
        await art.press("Enter");
        const params = new URL(page.url()).searchParams;
        expect(params.get("category")).toBe("art");
        expect(params.get("size")).toBe("M");
        expect(params.get("search")).toBe("piece");
    });
}

for (const width of [1440, 768, 390]) {
    test(`residual variants ${width}: keyboard preview, size and navigation`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?screen=browse&pieces=1&variants=1");
        const forest = page.getByRole("link", { name: "Choose Forest" });
        await page.keyboard.press("Tab");
        await forest.focus();
        await expect(forest).toHaveAttribute("aria-current", "true");
        expect((await forest.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        expect((await forest.boundingBox())!.width).toBeGreaterThanOrEqual(44);
        await expect(page.getByTestId("product-card-considered-piece")).toHaveAttribute("href", "/product/considered-piece/forest");
        await expect(forest).toHaveCSS("outline-style", "solid");
        expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
        await page.screenshot({ path: info.outputPath(`residual-variants-${width}.png`) });
        await forest.press("Enter");
        await expect(page).toHaveURL(/\/product\/considered-piece\/forest$/);
    });
}

for (const width of [1440, 768, 390]) {
    test(`residual store ${width}: empty surface and keyboard focus`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?screen=store");
        const empty = page.getByRole("link", { name: /Clear filters/ }).locator("..");
        await expect(empty).toHaveCSS("background-color", "rgb(248, 246, 239)");
        const clear = page.getByRole("link", { name: /Clear filters/ });
        await page.keyboard.press("Tab");
        await clear.focus();
        await expect(clear).toHaveCSS("outline-color", "rgb(120, 96, 53)");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
}
