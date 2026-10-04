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
}
