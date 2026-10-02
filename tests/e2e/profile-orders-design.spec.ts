import { expect, test, type Page } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import AxeBuilder from "@axe-core/playwright";
import { createCustomerSession, requiresClerkAdmin } from "./helpers/auth";

const orderId = "a-very-long-order-identifier-".repeat(4);
const order = {
    id: orderId,
    total: 25.5,
    createdAt: "2026-10-01T00:00:00.000Z",
    paymentStatus: "Paid",
    orderStatus: "PartiallyShipped",
    groups: [
        {
            _count: { items: 2 },
            items: [{ image: "/assets/images/no_image.png" }],
        },
    ],
};
async function accessible(page: Page) {
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
        )
    ).toBe(true);
    const result = await new AxeBuilder({ page })
        .include("[data-orders]")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
    expect(result.violations).toEqual([]);
}
test.describe("Profile orders design system", () => {
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
        await page.goto("/profile/orders", { waitUntil: "commit" });
    });
    for (const width of [1440, 390, 768]) {
        test(`empty and populated orders at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 1000 });
            const heading = page.getByRole("heading", {
                name: "My orders",
                level: 1,
            });
            await expect(heading).toHaveCSS("font-family", /Georgia/);
            await expect(
                page.getByRole("heading", { name: "No orders yet" })
            ).toBeVisible();
            await expect(
                page.getByRole("link", { name: "Explore the collection" })
            ).toHaveAttribute("href", "/browse");
            await accessible(page);
            await page.route("**/profile/orders", async (route) => {
                if (!route.request().headers()["next-action"])
                    return route.continue();
                await route.fulfill({
                    contentType: "text/x-component",
                    body: `0:{"a":"$@1","f":"","b":"development"}\n1:${JSON.stringify({ orders: [order], totalPages: 2 })}\n`,
                });
            });
            const filter = page.getByRole("button", {
                name: "Shipped",
                exact: true,
            });
            await filter.focus();
            await expect(filter).toHaveCSS("outline-style", "solid");
            await page.keyboard.press("Enter");
            await expect(page.getByText("$25.50")).toBeVisible();
            await expect(
                page.getByText("Partially Shipped", { exact: true })
            ).toBeVisible();
            await expect(
                page.getByRole("link", { name: `View order ${orderId}` })
            ).toHaveAttribute("href", `/order/${orderId}`);
            await expect(filter).toHaveAttribute("aria-pressed", "true");
            await accessible(page);
            await page.screenshot({
                path: `test-results/profile-orders-${width}.png`,
                fullPage: true,
            });
        });
    }
    test("pending, failure, retry, search, period, paging and reset", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 1000 });
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        let calls = 0;
        const requests: unknown[][] = [];
        await page.route("**/profile/orders", async (route) => {
            if (!route.request().headers()["next-action"])
                return route.continue();
            requests.push(JSON.parse(route.request().postData() || "[]"));
            if (++calls === 1) {
                await gate;
                return route.fulfill({ status: 500, body: "Unavailable" });
            }
            return route.fulfill({
                contentType: "text/x-component",
                body: `0:{"a":"$@1","f":"","b":"development"}\n1:${JSON.stringify({ orders: [order], totalPages: 2 })}\n`,
            });
        });
        await page.getByRole("button", { name: "To pay" }).click();
        await expect(page.getByRole("status")).toContainText("Loading orders");
        await expect(
            page.getByRole("button", { name: "Search", exact: true })
        ).toBeDisabled();
        await accessible(page);
        release();
        await expect(
            page.locator("[data-orders]").getByRole("alert")
        ).toContainText("We couldn’t load your orders");
        await accessible(page);
        await page.getByRole("button", { name: "Try again" }).click();
        await expect(page.getByText("$25.50")).toBeVisible();
        await page
            .getByRole("combobox", { name: "Order period" })
            .selectOption("last-1-year");
        await expect(
            page.getByRole("button", { name: "Search", exact: true })
        ).toBeEnabled();
        await page
            .getByRole("searchbox", { name: "Search orders" })
            .fill("coat");
        await page.getByRole("button", { name: "Search", exact: true }).click();
        await expect
            .poll(() => requests.at(-1))
            .toEqual(["unpaid", "last-1-year", "coat", 1]);
        await expect(
            page.getByRole("button", { name: "Next page" })
        ).toBeEnabled();
        await page.getByRole("button", { name: "Next page" }).click();
        await expect
            .poll(() => requests.at(-1))
            .toEqual(["unpaid", "last-1-year", "coat", 2]);
        await expect(
            page.getByRole("button", { name: "Remove all filters" })
        ).toBeEnabled();
        await page.getByRole("button", { name: "Remove all filters" }).click();
        await expect.poll(() => requests.at(-1)).toEqual(["", "", "", 1]);
        await expect(
            page.getByRole("combobox", { name: "Order period" })
        ).toHaveValue("");
        await accessible(page);
        await page.goto("/profile/orders/unpaid", { waitUntil: "commit" });
        await expect(
            page.getByRole("button", { name: "To pay" })
        ).toHaveAttribute("aria-pressed", "true");
        await expect(
            page.getByRole("heading", { name: "No matching orders" })
        ).toBeVisible();
        await accessible(page);
        await page.goto("/profile/orders/invalid", { waitUntil: "commit" });
        await expect(
            page.getByRole("button", { name: "View all" })
        ).toHaveAttribute("aria-pressed", "true");
        await expect(
            page.getByRole("heading", { name: "No orders yet" })
        ).toBeVisible();
    });
});

test("guest orders access redirects to sign-in", async ({ page }) => {
    await page.goto("/profile/orders", { waitUntil: "commit" });
    await expect(page).toHaveURL(/sign-in/);
    await expect(
        page.getByRole("heading", { name: "My orders", level: 1 })
    ).toHaveCount(0);
});
