import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"]) {
        test(`overview ${width} ${theme}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/?screen=overview");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", { level: 1, name: "ダッシュボード" })
            ).toHaveCSS("font-family", /Georgia/);
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth
                )
            ).toBe(true);
            if (width === 390) {
                await page
                    .getByRole("button", { name: "Administration navigation" })
                    .click();
                await page
                    .getByRole("link", { name: "Overview", exact: true })
                    .focus();
                await page.keyboard.press("Escape");
                await expect(
                    page.getByRole("button", {
                        name: "Administration navigation",
                    })
                ).toBeFocused();
            }
            expect(
                (
                    await new AxeBuilder({ page })
                        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                        .analyze()
                ).violations
            ).toEqual([]);
            await page.screenshot({
                path: info.outputPath(`overview-${width}-${theme}.png`),
                fullPage: true,
            });
            await page.goto("/?screen=overview&empty");
            await expect(
                page.getByText("売上データがありません。")
            ).toBeVisible();
            await page.goto("/?screen=overview&fetcherror");
            await expect(page.getByRole("alert")).toBeVisible();
            await page.getByRole("button", { name: "Retry" }).click();
            expect(
                await page.evaluate(() =>
                    Boolean(
                        (window as unknown as { refreshed?: boolean }).refreshed
                    )
                )
            ).toBe(true);
        });
    }
