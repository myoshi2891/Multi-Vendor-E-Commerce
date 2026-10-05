import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const width of [1440, 768, 390])
    test(`legal actual route ${width}`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        const response = await page.goto("/legal");
        expect(response?.status()).toBe(200);
        await expect(
            page.getByRole("heading", { level: 1, name: "Legal & Privacy" })
        ).toHaveCSS("font-family", /Georgia/);
        await expect(page).toHaveTitle("Legal & Privacy | Marketplace");
        const nav = page.getByRole("navigation", { name: "Legal contents" });
        await expect(nav.getByRole("link")).toHaveCount(3);
        const link = nav.getByRole("link", { name: "Privacy Policy" });
        await link.focus();
        await expect(link).toHaveCSS("outline-style", "solid");
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/\/legal#privacy-policy$/);
        await expect(page.locator("#privacy-policy")).toBeFocused();
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth
            )
        ).toBe(true);
        expect(
            (
                await new AxeBuilder({ page })
                    .include("main")
                    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                    .analyze()
            ).violations
        ).toEqual([]);
        await page.screenshot({
            path: info.outputPath(`legal-route-${width}.png`),
            fullPage: true,
        });
    });
test("protected P3 routes preserve guest redirects", async ({ request }) => {
    for (const path of [
        "/dashboard/admin",
        "/dashboard/admin/orders",
        "/dashboard/admin/stores",
        "/dashboard/seller/stores/example/coupons",
        "/dashboard/seller/stores/example/coupons/new",
    ]) {
        const response = await request.get(path, { maxRedirects: 0 });
        expect([302, 303, 307, 308]).toContain(response.status());
        expect(response.headers().location).toBe("/");
    }
});
