import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [1440, 390, 768]) {
    test(`FAQs appearance and navigation at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/faqs", { waitUntil: "commit" });
        const main = page.getByRole("main");
        const title = main.getByRole("heading", { level: 1, name: "FAQs" });
        await expect(title).toBeVisible();
        await expect(main).toHaveCSS("background-color", "rgb(243, 240, 232)");
        await expect(main.locator("header")).toHaveCSS("background-color", "rgb(11, 16, 14)");
        await expect(title).toHaveCSS("font-family", /Georgia/);
        const nav = main.getByRole("navigation", { name: "質問一覧" });
        await expect(nav.getByRole("link")).toHaveCount(4);
        const link = nav.getByRole("link").last();
        await link.focus();
        await expect(link).toBeFocused();
        await expect(link).toHaveCSS("outline-style", "solid");
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/#faq-4$/);
        await expect(main.locator("#faq-4")).toBeInViewport();
        for (const answer of await main.locator("section[id^='faq-'] p").all()) {
            await expect(answer).toBeVisible();
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        const results = await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        expect(results.violations).toEqual([]);
        await page.screenshot({ path: `test-results/faqs-${width}.png`, fullPage: true });
    });
}

test("legacy FAQ permanently redirects to FAQs", async ({ request }) => {
    const response = await request.get("/faq", { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe("/faqs");
});
