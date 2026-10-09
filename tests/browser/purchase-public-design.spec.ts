import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [1440, 768, 390]) {
    for (const route of ["/", "/browse", "/cart"]) {
        test(`${route} ${width}: public route and shared header`, async ({
            page,
        }, info) => {
            test.skip(route === "/browse" && !process.env.E2E_DATABASE_URL, "Dedicated schema-current E2E database required for product-data acceptance.");
                test.setTimeout(45000);
            await page.setViewportSize({ width, height: 1000 });
            await page.goto(route);
            await expect(page.getByTestId("store-header")).toBeVisible();
            await expect(page.getByRole("main")).toBeVisible();
            await page.getByLabel("Account menu", { exact: true }).click();
            await expect(
                page.getByRole("link", { name: "Sign in", exact: true })
            ).toBeVisible();
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
            await page.screenshot({
                path: info.outputPath(
                    `${route === "/" ? "home" : route.slice(1)}-${width}.png`
                ),
                fullPage: true,
            });
        });
    }
}
test("checkout guest sign-in preserves its return destination", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page).toHaveURL(url => url.pathname === "/sign-in" && url.searchParams.get("redirect_url") === new URL("/checkout", url.origin).href);
});
