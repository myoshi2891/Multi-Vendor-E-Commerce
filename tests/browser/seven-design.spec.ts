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
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
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

for (const width of [1440, 768, 390])
    test(`settings ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/?screen=settings");
        await expect(
            page.getByRole("heading", { name: "Account settings" })
        ).toHaveCSS("font-family", /Georgia/);
        await expect(
            page.getByRole("region", { name: "Account settings" })
        ).toHaveCSS("background-color", "rgb(243, 240, 232)");
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
            path: `test-results/seven-settings-${width}.png`,
            fullPage: true,
        });
    });

for (const width of [1440, 768, 390])
    test(`apply ${width}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/?screen=apply");
        await expect(
            page.getByRole("heading", { name: "Become a seller" })
        ).toHaveCSS("font-family", /Georgia/);
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await expect(page.getByText("Choose a logo image.")).toBeVisible();
        await page
            .getByRole("button", { name: "Upload profile image" })
            .click();
        await page.getByRole("button", { name: "Upload cover image" }).click();
        await page
            .getByRole("textbox", { name: "Store name", exact: true })
            .fill("Example Store");
        await page
            .getByRole("textbox", { name: "Store description", exact: true })
            .fill(
                "A detailed description of our example store for this fixture."
            );
        await page
            .getByRole("textbox", { name: "Store URL", exact: true })
            .fill("example-store");
        await page
            .getByRole("textbox", { name: "Store email", exact: true })
            .fill("test@example.com");
        await page
            .getByRole("textbox", { name: "Store phone", exact: true })
            .fill("1234567890");
        await page.getByRole("button", { name: "Previous" }).click();
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await expect(
            page.getByRole("textbox", { name: "Store name", exact: true })
        ).toHaveValue("Example Store");
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await page
            .getByRole("textbox", { name: "Shipping service" })
            .fill("International Delivery");
        await page
            .getByRole("textbox", { name: "Return policy" })
            .fill("Return within 30 days");
        await page.getByRole("button", { name: "Submit", exact: true }).click();
        await expect(
            page.getByRole("button", { name: "Submitting…" })
        ).toBeDisabled();
        await expect(page.getByRole("alert")).toContainText("Please try again");
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
            path: `test-results/seven-apply-${width}.png`,
            fullPage: true,
        });
        await page.getByRole("button", { name: "Submit", exact: true }).click();
        await expect(
            page.getByRole("heading", { name: "Your store has been created!" })
        ).toBeVisible();
        await expect(
            page.getByRole("link", { name: "Back to home" })
        ).toHaveAttribute("href", "/");
        expect(
            (
                await new AxeBuilder({ page })
                    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                    .analyze()
            ).violations
        ).toEqual([]);
    });

for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"])
        test(`overview ${width} ${theme}`, async ({ page }) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/?screen=overview");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", { name: "店舗ダッシュボード" })
            ).toBeVisible();
            await expect(page.getByText("$1,234.50")).toBeVisible();
            await expect(page.locator(".recharts-surface")).toBeVisible();
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
                path: `test-results/seven-overview-${width}-${theme}.png`,
                fullPage: true,
            });
            await page.goto("/?screen=overview&empty=1");
            await expect(
                page.getByText("売上データがありません。")
            ).toBeVisible();
        });
