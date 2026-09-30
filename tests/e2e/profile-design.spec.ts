import { expect, test } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import AxeBuilder from "@axe-core/playwright";
import { createCustomerSession, requiresClerkAdmin } from "./helpers/auth";

test.describe("Profile design system", () => {
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
        await page.goto("/profile", { waitUntil: "commit" });
    });
    for (const width of [1440, 390, 768]) {
        test(`account overview is responsive and accessible at ${width}px`, async ({
            page,
        }) => {
            await page.setViewportSize({ width, height: 1000 });
            const main = page.getByRole("main");
            await expect(
                main.getByRole("heading", { name: "My account", level: 1 })
            ).toBeVisible();
            await expect(page.locator("[data-profile-shell]")).toHaveCSS(
                "background-color",
                "rgb(243, 240, 232)"
            );
            await expect(
                main.getByRole("heading", { name: "My account", level: 1 })
            ).toHaveCSS("font-family", /Georgia/);
            const nav = page.getByRole("navigation", {
                name: "Account navigation",
            });
            await expect(
                nav.getByRole("link", { name: "Overview", exact: true })
            ).toHaveAttribute("aria-current", "page");
            await expect(
                main
                    .getByRole("region", { name: "My orders" })
                    .getByRole("link")
            ).toHaveCount(7);
            const orders = nav.getByRole("link", {
                name: "Orders",
                exact: true,
            });
            await orders.focus();
            await page.keyboard.press("Tab");
            await expect(
                nav.getByRole("link", { name: "Payment", exact: true })
            ).toBeFocused();
            await expect(
                nav.getByRole("link", { name: "Payment", exact: true })
            ).toHaveCSS("outline-style", "solid");
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth
                )
            ).toBe(true);
            const result = await new AxeBuilder({ page })
                .include("[data-profile-shell]")
                .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                .analyze();
            expect(result.violations).toEqual([]);
            await page.screenshot({
                path: `test-results/profile-${width}.png`,
                fullPage: true,
            });
        });
    }
    test("shared account navigation reaches orders, addresses and settings", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        const nav = page.getByRole("navigation", {
            name: "Account navigation",
        });
        for (const [title, path] of [
            ["Orders", "/profile/orders"],
            ["Shipping address", "/profile/addresses"],
            ["Settings", "/profile/settings"],
        ]) {
            const link = nav.getByRole("link", { name: title, exact: true });
            await link.focus();
            await page.keyboard.press("Enter");
            await expect(page).toHaveURL(new RegExp(`${path}$`));
            await expect(
                nav.getByRole("link", { name: title, exact: true })
            ).toHaveAttribute("aria-current", "page");
            await expect(page.getByRole("main")).toBeVisible();
        }
        await expect(page.locator(".cl-userProfile-root")).toBeVisible({
            timeout: 20000,
        });
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth
            )
        ).toBe(true);
    });
});

test("guest profile access redirects to sign-in", async ({ page }) => {
    await page.goto("/profile", { waitUntil: "commit" });
    await expect(page).toHaveURL(/sign-in/);
    await expect(
        page.getByRole("heading", { name: "My account", level: 1 })
    ).toHaveCount(0);
});
