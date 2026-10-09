import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const screens = [
    { key: "orders", heading: "My orders", empty: "No orders yet" },
];

async function accessible(page: Page) {
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
}

for (const screen of screens) {
    test(`${screen.key} follows shared tokens`, async ({ page }) => {
        await page.goto(`/?screen=${screen.key}`);
        await expect(
            page.getByRole("heading", { name: screen.heading, level: 1 })
        ).toBeVisible();
        await page.locator("[data-postpurchase-shell]").evaluate((root) => {
            const style = (root as HTMLElement).style;
            style.setProperty("--purchase-panel", "#fffdf7");
            style.setProperty("--purchase-gold", "#dfc38e");
            style.setProperty("--purchase-link", "#604a2b");
            style.setProperty("--purchase-focus", "#604a2b");
            style.setProperty("--purchase-touch", "52px");
        });
        await expect(
            page.getByRole("link", { name: "Need a hand? →" })
        ).toHaveCSS("color", "rgb(96, 74, 43)");
        await expect(
            page
                .getByRole("list", { name: "Your orders" })
                .locator("li")
                .first()
        ).toHaveCSS("background-color", "rgb(255, 253, 247)");
        const search = page.getByRole("button", {
            name: "Search",
            exact: true,
        });
        await expect(search).toHaveCSS(
            "background-color",
            "rgb(223, 195, 142)"
        );
        await expect(search).toHaveCSS("color", "rgb(23, 37, 29)");
        await expect(search).toHaveCSS("min-height", "52px");
        await search.focus();
        await expect(search).toHaveCSS("outline-color", "rgb(96, 74, 43)");
    });

    for (const width of [1440, 768, 390]) {
        test(`${screen.key} states at ${width}px`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 1000 });
            await page.goto(`/?screen=${screen.key}`);
            await expect(
                page.getByRole("heading", { name: screen.heading, level: 1 })
            ).toHaveCSS("font-family", /Georgia/);
            await accessible(page);
            await page.screenshot({
                path: info.outputPath(`${screen.key}-${width}.png`),
                fullPage: true,
            });
            const search = page.getByRole("button", {
                name: "Search",
                exact: true,
            });
            await search.focus();
            await expect(search).toHaveCSS("outline-style", "solid");
            expect((await search.boundingBox())?.height).toBeGreaterThanOrEqual(
                44
            );
            await page.keyboard.press("Enter");
            await expect(search).toBeDisabled();
            await expect(search).toBeEnabled();
            await page.getByRole("button", { name: /Next/ }).click();
            await expect(page.getByText(/Page 2 of 3/).last()).toBeVisible();
            await accessible(page);
            await page.goto(`/?screen=${screen.key}&state=empty`);
            await expect(
                page.getByRole("heading", { name: screen.empty, exact: true })
            ).toBeVisible();
            await accessible(page);
            await page.goto(`/?screen=${screen.key}&state=error`);
            await expect(page.getByRole("alert")).toBeVisible();
            await accessible(page);
            await page.getByRole("button", { name: "Try again" }).click();
            await expect(page.getByRole("alert")).toHaveCount(0);
            await page.goto(`/?screen=${screen.key}&state=retry`);
            await page
                .getByRole("button", { name: "Search", exact: true })
                .click();
            await expect(page.getByRole("alert")).toBeVisible();
            await page.getByRole("button", { name: "Try again" }).click();
            await expect(page.getByRole("alert")).toHaveCount(0);
            await page.goto(`/?screen=${screen.key}&state=pending`);
            await page
                .getByRole("button", { name: "Search", exact: true })
                .click();
            await expect(page.getByRole("status")).toContainText("Loading");
            await accessible(page);
        });
    }
}
