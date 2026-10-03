import { expect, test, type Page, type Route } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import AxeBuilder from "@axe-core/playwright";
import { createCustomerSession, requiresClerkAdmin } from "./helpers/auth";
const review = {
    id: "review-one",
    review: "A lovely discovery. " + "LongReviewWord".repeat(28),
    rating: 4.5,
    variant: "SilkScarf".repeat(15),
    color: "Gold, Green",
    size: "One size",
    quantity: "2",
    updatedAt: "2026-10-01T00:00:00Z",
    user: { name: "Mina Mori", picture: "" },
    images: [
        {
            id: "photo-one",
            url: "/assets/images/to-de-reviewed.webp",
            alt: "Scarf detail",
        },
    ],
};
const data = { reviews: [review], totalPages: 2 };
async function fulfill(route: Route, value: unknown) {
    await route.fulfill({
        contentType: "text/x-component",
        body: `0:{"a":"$@1","f":"","b":"development"}\n1:${JSON.stringify(value)}\n`,
    });
}
async function accessible(page: Page) {
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
        )
    ).toBe(true);
    const result = await new AxeBuilder({ page })
        .include("[data-reviews]")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
    expect(result.violations).toEqual([]);
}
test.describe("Profile reviews design system", () => {
    test.skip(() => requiresClerkAdmin, "Requires Clerk test credentials");
    const session = createCustomerSession();
    test.beforeAll(async () => {
        await session.create({ role: "USER" });
    });
    test.afterAll(async () => {
        await session.cleanup();
    });
    test.beforeEach(async ({ page }) => {
        await setupClerkTestingToken({ page });
        await page.goto("/sign-in", { waitUntil: "commit" });
        await clerk.signIn({ page, emailAddress: session.email });
        await page.goto("/profile/reviews", { waitUntil: "networkidle" });
    });
    for (const width of [1440, 390, 768]) {
        test(`empty and populated reviews at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 1000 });
            await expect(
                page.getByRole("heading", { name: "My reviews", level: 1 })
            ).toHaveCSS("font-family", /Georgia/);
            await expect(
                page.getByRole("heading", { name: "No reviews yet" })
            ).toBeVisible();
            await accessible(page);
            await page.route("**/profile/reviews", async (route) => {
                if (!route.request().headers()["next-action"])
                    return route.continue();
                await fulfill(route, data);
            });
            const filter = page.getByRole("button", {
                name: "5 stars",
                exact: true,
            });
            await page.keyboard.press("Tab");
            await filter.focus();
            await expect(filter).toHaveCSS("outline-style", "solid");
            await page.keyboard.press("Enter");
            await expect(
                page.getByText(review.review, { exact: true })
            ).toBeVisible();
            await expect(page.getByText("4.5 out of 5 stars")).toBeVisible();
            await expect(page.getByText("Gold, Green")).toBeVisible();
            await expect(
                page.getByRole("img", { name: "Scarf detail" })
            ).toBeVisible();
            await expect(
                page.getByRole("link", { name: "Reviews", exact: true })
            ).toHaveAttribute("aria-current", "page");
            await expect(
                page.getByRole("button", { name: "Previous page" })
            ).toBeDisabled();
            await accessible(page);
            await page.screenshot({
                path: `test-results/profile-reviews-${width}.png`,
                fullPage: true,
            });
        });
    }
    test("pending, failure, retry, period, search, pager and full reset", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 1000 });
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        const calls: unknown[][] = [];
        await page.route("**/profile/reviews", async (route) => {
            if (!route.request().headers()["next-action"])
                return route.continue();
            const args = JSON.parse(route.request().postData() || "[]");
            calls.push(args);
            if (calls.length === 1) {
                await gate;
                return route.fulfill({ status: 500, body: "Unavailable" });
            }
            return fulfill(
                route,
                args[2] === "missing" ? { reviews: [], totalPages: 0 } : data
            );
        });
        await page
            .getByRole("button", { name: "4 stars", exact: true })
            .click();
        await expect(page.getByRole("status")).toHaveText("Loading reviews…");
        await expect(page.getByRole("searchbox")).toBeDisabled();
        await expect(
            page.getByRole("button", { name: "5 stars", exact: true })
        ).toBeDisabled();
        await accessible(page);
        release();
        await expect(
            page.locator("[data-reviews]").getByRole("alert")
        ).toContainText("We couldn’t load your reviews");
        await accessible(page);
        await page.getByRole("button", { name: "Try again" }).click();
        await expect(
            page.getByText(review.review, { exact: true })
        ).toBeVisible();
        expect(calls.slice(0, 2)).toEqual([
            ["4", "", "", 1],
            ["4", "", "", 1],
        ]);
        await page
            .getByRole("combobox", { name: "Review period" })
            .selectOption("last-1-year");
        await expect(page.getByRole("combobox")).toBeEnabled();
        await page.getByRole("searchbox").fill("lovely");
        await page.getByRole("searchbox").press("Enter");
        await expect(
            page.getByRole("button", { name: "Next page" })
        ).toBeEnabled();
        await expect
            .poll(() => calls.at(-1))
            .toEqual(["4", "last-1-year", "lovely", 1]);
        await page.getByRole("button", { name: "Next page" }).click();
        await expect(
            page.getByRole("button", { name: "Next page" })
        ).toBeDisabled();
        await expect
            .poll(() => calls.at(-1))
            .toEqual(["4", "last-1-year", "lovely", 2]);
        await page.getByRole("searchbox").fill("missing");
        await page.getByRole("searchbox").press("Enter");
        await expect(
            page.getByRole("heading", { name: "No matching reviews" })
        ).toBeVisible();
        await accessible(page);
        await page.getByRole("searchbox").fill("");
        await page.getByRole("searchbox").press("Enter");
        await expect(
            page.getByRole("button", { name: "Next page" })
        ).toBeEnabled();
        await expect
            .poll(() => calls.at(-1))
            .toEqual(["4", "last-1-year", "", 1]);
        await page.getByRole("button", { name: "Remove all filters" }).click();
        await expect(
            page.getByRole("button", { name: "View all", exact: true })
        ).toHaveAttribute("aria-pressed", "true");
        await expect(page.getByRole("combobox")).toHaveValue("");
        await expect(page.getByRole("searchbox")).toHaveValue("");
        await expect(
            page.getByRole("button", { name: "Next page" })
        ).toBeEnabled();
        await expect.poll(() => calls.at(-1)).toEqual(["", "", "", 1]);
        await accessible(page);
    });
});
test("guest reviews access redirects to sign-in", async ({ page }) => {
    await setupClerkTestingToken({ page });
    await page.goto("/profile/reviews");
    await expect(page).toHaveURL(/sign-in/);
});
