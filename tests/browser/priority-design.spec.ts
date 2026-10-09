import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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
for (const width of [1440, 768, 390]) {
    test(`following component states at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?scenario=following-error&page=2");
        await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
            "font-family",
            /Georgia/
        );
        await expect(page.getByRole("link", { name: "Next" })).toHaveAttribute(
            "href",
            "/profile/following/3"
        );
        const button = page.getByRole("button", { name: "Following" });
        await page.keyboard.press("Tab");
        await button.focus();
        await expect(button).toHaveCSS("outline-style", "solid");
        await page.keyboard.press("Enter");
        await expect(button).toBeDisabled();
        await expect(page.getByRole("status")).toHaveText("Updating store…");
        await accessible(page);
        await expect(page.getByRole("alert")).toContainText(
            "Could not update this store."
        );
        await expect(button).toHaveAttribute("aria-pressed", "true");
        await button.click();
        await expect(
            page.getByRole("button", { name: "Follow", exact: true })
        ).toHaveAttribute("aria-pressed", "false");
        await expect(
            page.getByText("11 followers", { exact: true })
        ).toBeVisible();
        await accessible(page);
        await page.screenshot({
            path: info.outputPath(`following-${width}.png`),
            fullPage: true,
        });
        await page.getByRole("link", { name: "Next" }).click();
        await expect(
            page.getByRole("link", { name: "Page 3", exact: true })
        ).toHaveAttribute("aria-current", "page");
        await page.goBack();
        await expect(
            page.getByRole("link", { name: "Page 2", exact: true })
        ).toHaveAttribute("aria-current", "page");
        await page.goto("/?scenario=following-empty");
        await expect(
            page.getByRole("heading", { name: "No followed stores yet." })
        ).toBeVisible();
        await accessible(page);
    });
    test(`history component states at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?scenario=history-error&page=2");
        await expect(page.getByRole("alert")).toContainText(
            "Recently viewed pieces could not be loaded."
        );
        await accessible(page);
        const retry = page.getByRole("button", { name: "Try again" });
        await page.keyboard.press("Tab");
        await retry.focus();
        await expect(retry).toHaveCSS("outline-style", "solid");
        await page.keyboard.press("Enter");
        await expect(page.getByRole("status")).toContainText(
            "Loading recently viewed pieces…"
        );
        await expect(page.getByTestId("history-products")).toHaveCount(0);
        await expect(page.getByTestId("product-card-actions")).toHaveCount(4);
        await expect(page.getByRole("link", { name: "Next" })).toHaveAttribute(
            "href",
            "/profile/history/3"
        );
        await accessible(page);
        const compare = page
            .getByRole("button", { name: "Add to compare" })
            .first();
        await compare.focus();
        await page.keyboard.press("Enter");
        await expect(
            page.getByRole("button", { name: "Remove from compare" })
        ).toHaveCount(1);
        await page.screenshot({
            path: info.outputPath(`history-${width}.png`),
            fullPage: true,
        });
        // Reload a successful route before back/forward: the error scenario deliberately fails once per document.
        await page.goto("/profile/history/2");
        await expect(
            page.getByRole("link", { name: "Page 2", exact: true })
        ).toHaveAttribute("aria-current", "page");
        await page.getByRole("link", { name: "Next" }).click();
        await expect(
            page.getByRole("link", { name: "Page 3", exact: true })
        ).toHaveAttribute("aria-current", "page");
        await page.goBack();
        await expect(
            page.getByRole("link", { name: "Page 2", exact: true })
        ).toHaveAttribute("aria-current", "page");
        await page.goto("/?scenario=history-empty");
        await expect(
            page.getByRole("heading", { name: "No recently viewed pieces." })
        ).toBeVisible();
        await accessible(page);
    });
    test(`notification list states at ${width}px (plan 086)`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?scenario=notifications");
        await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
            "font-family",
            /Georgia/
        );
        await expect(page.getByText("Unread", { exact: true })).toHaveCount(2);
        await expect(
            page.getByRole("link", { name: "Older notifications" })
        ).toHaveAttribute("href", "/profile/notifications?cursor=n3");
        await accessible(page);
        await page.screenshot({
            path: info.outputPath(`notifications-${width}.png`),
            fullPage: true,
        });
        const markAll = page.getByRole("button", { name: "Mark all as read" });
        await markAll.focus();
        await expect(markAll).toHaveCSS("outline-style", "solid");
        await page.keyboard.press("Enter");
        await expect(page.getByText("Unread", { exact: true })).toHaveCount(0);
        await expect(markAll).toBeDisabled();
        await accessible(page);

        await page.goto("/?scenario=notifications-error");
        await page.getByRole("button", { name: "Mark all as read" }).click();
        await expect(page.getByRole("alert")).toHaveText(
            "Couldn't update notifications. Please try again."
        );
        await expect(page.getByText("Unread", { exact: true })).toHaveCount(2);
        await accessible(page);

        await page.goto("/?scenario=notifications-empty");
        await expect(page.getByText("No notifications yet.")).toBeVisible();
        await accessible(page);
    });
}

// Theme inheritance must be observable in rendered UI, including account child screens.
test("account shell inherits shared storefront tokens", async ({ page }) => {
    await page.goto("/?scenario=notifications");
    const title = page.getByRole("heading", { name: "Notifications" });
    await page.locator("#root > div").evaluate((root) => {
        (root as HTMLElement).style.setProperty("--purchase-ink", "#243b53");
        (root as HTMLElement).style.setProperty("--purchase-link", "#604a2b");
    });
    await expect(title).toHaveCSS("color", "rgb(36, 59, 83)");
    await expect(page.getByRole("button", { name: "Mark all as read" }))
        .toHaveCSS("color", "rgb(96, 74, 43)");
});

for (const width of [1440, 768, 700, 390]) {
    test(`compare tokens and states at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?scenario=compare-error");
        await expect(page.getByRole("alert")).toContainText("couldn’t load your selection");
        const retry = page.getByRole("button", { name: "Try again" });
        await retry.focus();
        await expect(retry).toHaveCSS("outline-style", "solid");
        await page.keyboard.press("Enter");
        await expect(page.getByRole("region", { name: "Selected products" })).toBeVisible();
        await expect(page.getByTestId("product-card-price").first()).toHaveText("$45.00");
        // Inject a theme change to prove the production price/cards use shared tokens.
        await page.locator("main").evaluate((root) => {
            (root as HTMLElement).style.setProperty("--purchase-link", "#604a2b");
            (root as HTMLElement).style.setProperty("--purchase-panel", "#fffdf7");
        });
        await expect(page.getByTestId("product-card-price").first()).toHaveCSS("color", "rgb(96, 74, 43)");
        await expect(page.locator("article").first()).toHaveCSS("background-color", "rgb(255, 253, 247)");
        await page.locator("main").evaluate((root) => (root as HTMLElement).removeAttribute("style"));
        const scroller = page.getByRole("region", { name: "Selected products" });
        await scroller.focus();
        await expect(scroller).toHaveCSS("outline-style", "solid");
        if (width === 390) {
            await page.keyboard.press("ArrowRight");
            await expect.poll(() => scroller.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
        }
        await accessible(page);
        await page.screenshot({ path: info.outputPath(`compare-p2-${width}.png`), fullPage: true });
        await page.getByRole("button", { name: "Remove from compare" }).first().click();
        await expect(page.getByText("3 of 4 selected")).toBeVisible();
        await page.getByRole("button", { name: "Clear all" }).click();
        await expect(page.getByTestId("compare-empty")).toBeVisible();
        await accessible(page);
        await page.goto("/?scenario=compare-unavailable");
        await expect(page.getByRole("status")).toContainText("no longer available");
        await accessible(page);
        await page.goto("/?scenario=compare-pending");
        await expect(page.getByRole("status")).toContainText("Loading your selection");
        await accessible(page);
    });
}
