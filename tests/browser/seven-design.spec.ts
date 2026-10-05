import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"]) {
        test(`shell ${width} ${theme}`, async ({ page }) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", { name: "Store overview" })
            ).toBeVisible();
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth
                )
            ).toBe(true);
            await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
                "font-family",
                /Georgia/
            );
            if (width === 390) {
                const toggle = page.getByRole("button", {
                    name: "Store navigation",
                });
                await toggle.focus();
                await page.keyboard.press("Enter");
                await expect(toggle).toHaveAttribute("aria-expanded", "true");
                await page
                    .getByRole("link", { name: "Products", exact: true })
                    .focus();
                await page.keyboard.press("Escape");
                await expect(toggle).toBeFocused();
                await expect(toggle).toHaveAttribute("aria-expanded", "false");
            }
            await page.getByRole("button", { name: "Toggle theme" }).click();
            await page
                .getByRole("menuitem", {
                    name: theme === "dark" ? "Light" : "Dark",
                    exact: true,
                })
                .click();
            await expect(page.locator("html")).toHaveClass(
                theme === "dark" ? /^$/ : /dark/
            );
            await expect(page.locator("#root")).not.toHaveAttribute(
                "aria-hidden",
                "true"
            );
            await expect(page.getByRole("menu")).toHaveCount(0);
            await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), theme === "dark");
            const violations = (
                await new AxeBuilder({ page })
                    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                    .analyze()
            ).violations;
            expect(violations).toEqual([]);
            await page.screenshot({
                path: `test-results/seven-shell-${width}-${theme}.png`,
                fullPage: true,
            });
        });
    }
