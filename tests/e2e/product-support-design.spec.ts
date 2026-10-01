import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { PRODUCT_SUPPORT_SECTIONS } from "../../src/components/store/static/content/product-support";

for (const width of [1440, 390, 768]) {
    test(`product support appearance and navigation at ${width}px`, async ({
        page,
    }, testInfo) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/product-support", { waitUntil: "commit" });
        const main = page.getByRole("main");
        await expect(main).toHaveCSS("background-color", "rgb(243, 240, 232)");
        await expect(main.getByRole("heading", { level: 1 })).toHaveCSS(
            "font-family",
            /Georgia/
        );
        for (const section of PRODUCT_SUPPORT_SECTIONS)
            await expect(main.getByText(section.body)).toBeVisible();
        const toc = main.getByRole("navigation", { name: "サポート内容一覧" });
        await expect(toc.getByRole("link")).toHaveCount(3);
        const last = toc.getByRole("link").last();
        await last.focus();
        await expect(last).toHaveCSS("outline-style", "solid");
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/#support-3$/);
        await expect(main.locator("#support-3")).toBeInViewport();
        const support = main.getByRole("navigation", { name: "サポート窓口" });
        await expect(support.getByRole("link")).toHaveCount(4);
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth
            )
        ).toBe(true);
        const result = await new AxeBuilder({ page })
            .include("main")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze();
        expect(result.violations).toEqual([]);
        await page.screenshot({
            path: testInfo.outputPath(`product-support-${width}.png`),
            fullPage: true,
        });
        const contact = support.getByRole("link", { name: /Contact us/ });
        await contact.focus();
        await expect(contact).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/\/contact$/, { timeout: 15000 });
    });
}
