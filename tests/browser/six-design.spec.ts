import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [1440, 768, 390]) {
    for (const theme of ["light", "dark"]) {
        test(`product ${width} ${theme}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/?screen=product");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", { level: 1, name: "Create product" })
            ).toHaveCSS("font-family", /Georgia/);
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth
                )
            ).toBe(true);
            await page
                .getByPlaceholder("Product Name", { exact: true })
                .focus();
            await expect(
                page.getByPlaceholder("Product Name", { exact: true })
            ).toHaveCSS("outline-style", "solid");
            await page
                .getByRole("combobox", { name: "Category", exact: true })
                .click();
            await page.getByRole("option", { name: /Watches/ }).click();
            await expect(
                page.getByRole("combobox", { name: "Category", exact: true })
            ).toContainText("Watches");
            await expect(
                page.getByRole("heading", {
                    level: 2,
                    name: "Product information",
                    exact: true,
                })
            ).toBeVisible();
            if (width === 390) {
                expect(
                    (await page
                        .getByText("Product Label", { exact: true })
                        .boundingBox())!.height
                ).toBeLessThan(30);
                expect(
                    (await page
                        .getByText("Product Label", { exact: true })
                        .locator("..")
                        .boundingBox())!.width
                ).toBeGreaterThan(180);
                expect(
                    (await page
                        .getByPlaceholder("size", { exact: true })
                        .boundingBox())!.width
                ).toBeGreaterThanOrEqual(70);
            }
            await expect(
                page.getByRole("button", {
                    name: "Upload standard image",
                    exact: true,
                })
            ).toHaveCSS("background-image", "none");
            expect(
                (
                    await new AxeBuilder({ page })
                        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                        .analyze()
                ).violations
            ).toEqual([]);
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({
                path: info.outputPath(`six-product-${width}-${theme}.png`),
                fullPage: true,
            });
        });
    }
}

for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"])
        test(`newvariant ${width} ${theme}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/?screen=newvariant");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", { level: 1, name: "Add variant" })
            ).toHaveCSS("font-family", /Georgia/);
            await expect(
                page.getByPlaceholder("Product Name", { exact: true })
            ).toHaveCount(0);
            await expect(
                page.getByRole("combobox", { name: "Category", exact: true })
            ).toBeEnabled();
            await expect(
                page.getByRole("combobox", { name: "Category", exact: true })
            ).toContainText("Watches");
            await page
                .getByPlaceholder("Variant Name", { exact: true })
                .focus();
            await expect(
                page.getByPlaceholder("Variant Name", { exact: true })
            ).toHaveCSS("outline-style", "solid");
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
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({
                path: info.outputPath(`six-newvariant-${width}-${theme}.png`),
                fullPage: true,
            });
        });
