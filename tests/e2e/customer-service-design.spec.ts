import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { SUPPORT_LINKS } from "../../src/components/store/static/content/customer-service";

for (const width of [1440, 390, 768]) {
    test(`support hub appearance and navigation at ${width}px`, async ({
        page,
    }, testInfo) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/customer-service", { waitUntil: "commit" });
        const main = page.getByRole("main");
        await expect(main).toHaveCSS("background-color", "rgb(243, 240, 232)");
        await expect(main.getByRole("heading", { level: 1 })).toHaveCSS(
            "font-family",
            /Georgia/
        );
        const navigation = main.getByRole("navigation", {
            name: "サポートメニュー",
        });
        await expect(navigation.getByRole("link")).toHaveCount(5);
        for (const entry of SUPPORT_LINKS) {
            const link = navigation.getByRole("link", {
                name: new RegExp(entry.title),
            });
            await expect(link).toHaveAttribute("href", entry.href);
            await expect(link).toContainText(entry.description);
        }
        const contact = navigation.getByRole("link").first();
        await contact.focus();
        await expect(contact).toBeFocused();
        await expect(contact).toHaveCSS("outline-style", "solid");
        await contact.hover();
        await expect(contact).toHaveCSS(
            "background-color",
            "rgb(232, 226, 214)"
        );
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
            path: testInfo.outputPath(`support-${width}.png`),
            fullPage: true,
        });
        await contact.focus();
        await expect(contact).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/\/contact$/, { timeout: 15000 });
    });
}
