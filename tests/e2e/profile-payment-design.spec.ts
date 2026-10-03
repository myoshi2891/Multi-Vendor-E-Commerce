import { expect, test, type Page } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import AxeBuilder from "@axe-core/playwright";
import { createCustomerSession, requiresClerkAdmin } from "./helpers/auth";

const paymentId = "payment-identifier-".repeat(7);
const intentId = "pi_" + "long-provider-reference".repeat(6);
const payments = [
    {
        id: paymentId,
        paymentIntentId: intentId,
        paymentMethod: "Stripe",
        amount: 42.5,
        status: "Completed",
        orderId: "order-one",
        updatedAt: "2026-10-01T00:00:00.000Z",
    },
    {
        id: "payment-paypal",
        paymentIntentId: "paypal-reference",
        paymentMethod: "PayPal",
        amount: "50.00",
        status: "Pending",
        orderId: "order-two",
        updatedAt: "2026-10-01T00:00:00.000Z",
    },
];
const response = `0:{"a":"$@1","f":"","b":"development"}\n1:${JSON.stringify({ payments, totalPages: 2 })}\n`;
async function accessible(page: Page) {
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
        )
    ).toBe(true);
    const result = await new AxeBuilder({ page })
        .include("[data-payments]")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
    expect(result.violations).toEqual([]);
}
test.describe("Profile payment design system", () => {
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
        await page.goto("/profile/payment", { waitUntil: "commit" });
    });
    for (const width of [1440, 390, 768]) {
        test(`empty and populated payments at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 1000 });
            await expect(
                page.getByRole("heading", { name: "My payments", level: 1 })
            ).toHaveCSS("font-family", /Georgia/);
            await expect(
                page.getByRole("heading", { name: "No payments yet" })
            ).toBeVisible();
            await expect(
                page.getByRole("link", { name: "Explore the collection" })
            ).toHaveAttribute("href", "/browse");
            await accessible(page);
            await page.route("**/profile/payment", async (route) => {
                if (!route.request().headers()["next-action"])
                    return route.continue();
                await route.fulfill({
                    contentType: "text/x-component",
                    body: response,
                });
            });
            const filter = page.getByRole("button", {
                name: "Credit card",
                exact: true,
            });
            await filter.focus();
            await expect(filter).toHaveCSS("outline-style", "solid");
            await page.keyboard.press("Enter");
            await expect(
                page.getByText("$42.50", { exact: true })
            ).toBeVisible();
            await expect(
                page.getByText("$50.00", { exact: true })
            ).toBeVisible();
            await expect(
                page.getByText(intentId, { exact: true })
            ).toBeVisible();
            await expect(
                page.getByText("Completed", { exact: true })
            ).toBeVisible();
            await expect(
                page.getByText("Pending", { exact: true })
            ).toBeVisible();
            await expect(
                page.getByRole("link", {
                    name: `View order for payment ${paymentId}`,
                })
            ).toHaveAttribute("href", "/order/order-one");
            await expect(filter).toHaveAttribute("aria-pressed", "true");
            await expect(
                page
                    .getByRole("navigation", { name: "Account navigation" })
                    .getByRole("link", { name: "Payment", exact: true })
            ).toHaveAttribute("aria-current", "page");
            await accessible(page);
            await page.screenshot({
                path: `test-results/profile-payment-${width}.png`,
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
        await page.route("**/profile/payment", async (route) => {
            if (!route.request().headers()["next-action"])
                return route.continue();
            requests.push(JSON.parse(route.request().postData() || "[]"));
            if (++calls === 1) {
                await gate;
                return route.fulfill({ status: 500, body: "Unavailable" });
            }
            return route.fulfill({
                contentType: "text/x-component",
                body: response,
            });
        });
        await page.waitForLoadState("networkidle");
        await page.getByRole("button", { name: "PayPal", exact: true }).click();
        await expect(page.getByRole("status")).toContainText(
            "Loading payments"
        );
        await expect(
            page.getByRole("button", { name: "Search", exact: true })
        ).toBeDisabled();
        await accessible(page);
        release();
        await expect(
            page.locator("[data-payments]").getByRole("alert")
        ).toContainText("We couldn’t load your payments");
        await accessible(page);
        await page.getByRole("button", { name: "Try again" }).click();
        await expect(page.getByText("$42.50", { exact: true })).toBeVisible();
        await page
            .getByRole("combobox", { name: "Payment period" })
            .selectOption("last-1-year");
        await expect(
            page.getByRole("button", { name: "Search", exact: true })
        ).toBeEnabled();
        await page
            .getByRole("searchbox", { name: "Search payments" })
            .fill("pi_one");
        await page.getByRole("button", { name: "Search", exact: true }).click();
        await expect
            .poll(() => requests.at(-1))
            .toEqual(["paypal", "last-1-year", "pi_one", 1]);
        await expect(
            page.getByRole("button", { name: "Next page" })
        ).toBeEnabled();
        await page.getByRole("button", { name: "Next page" }).click();
        await expect
            .poll(() => requests.at(-1))
            .toEqual(["paypal", "last-1-year", "pi_one", 2]);
        await expect(
            page.getByRole("button", { name: "Remove all filters" })
        ).toBeEnabled();
        await page.getByRole("button", { name: "Remove all filters" }).click();
        await expect.poll(() => requests.at(-1)).toEqual(["", "", "", 1]);
        await expect(
            page.getByRole("combobox", { name: "Payment period" })
        ).toHaveValue("");
        await accessible(page);
    });
});
test("guest payment access redirects to sign-in", async ({ page }) => {
    await page.goto("/profile/payment", { waitUntil: "commit" });
    await expect(page).toHaveURL(/sign-in/);
    await expect(
        page.getByRole("heading", { name: "My payments", level: 1 })
    ).toHaveCount(0);
});
