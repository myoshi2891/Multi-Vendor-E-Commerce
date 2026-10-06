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
