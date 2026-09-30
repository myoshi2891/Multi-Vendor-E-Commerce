import { expect, test } from "@playwright/test";
import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import AxeBuilder from "@axe-core/playwright";
import { db } from "../../src/lib/db";
import { createCustomerSession, requiresClerkAdmin } from "./helpers/auth";

test.describe("Wishlist design", () => {
    test.skip(() => requiresClerkAdmin, "Requires Clerk test credentials");
    const session = createCustomerSession();
    test.beforeAll(async () => {
        await session.create({ role: "USER" });
    });
    test.afterAll(async () => {
        await session.cleanup();
    });
    test.beforeEach(async ({ page }, testInfo) => {
        await db.wishlist.deleteMany({
            where: { userId: session.clerkUserId! },
        });
        if (!testInfo.title.includes("empty")) {
            const products = await db.product.findMany({
                where: {
                    variants: {
                        some: { images: { some: {} }, sizes: { some: {} } },
                    },
                },
                select: {
                    id: true,
                    variants: {
                        where: { images: { some: {} }, sizes: { some: {} } },
                        select: { id: true },
                        take: 1,
                    },
                },
                take: 11,
            });
            expect(products).toHaveLength(11);
            await db.wishlist.createMany({
                data: products.map((p) => ({
                    userId: session.clerkUserId!,
                    productId: p.id,
                    variantId: p.variants[0].id,
                })),
            });
        }
        await setupClerkTestingToken({ page });
        await page.goto("/sign-in", { waitUntil: "commit" });
        await clerk.signIn({ page, emailAddress: session.email });
        await page.goto("/profile/wishlist/1", { waitUntil: "commit" });
    });
    test("empty wishlist offers the collection and preserves the alias redirect", async ({
        page,
    }) => {
        await expect(
            page.getByRole("heading", { name: "Your Wishlist", level: 1 })
        ).toBeVisible();
        await expect(page.getByText("Your wishlist is empty.")).toBeVisible();
        await expect(
            page.getByRole("link", { name: /Explore the collection/ })
        ).toHaveAttribute("href", "/browse");
        await page.goto("/profile/wishlist", { waitUntil: "commit" });
        await expect(page).toHaveURL(/\/profile\/wishlist\/1$/);
        const results = await new AxeBuilder({ page })
            .include("main")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze();
        expect(results.violations).toEqual([]);
        await page.screenshot({
            path: "test-results/wishlist-empty.png",
            fullPage: true,
        });
    });
    for (const width of [1440, 390, 768]) {
        test(`saved pieces at ${width}px preserve card actions and remain accessible`, async ({
            page,
        }) => {
            await page.setViewportSize({ width, height: 1000 });
            const main = page.getByRole("main");
            const heading = main.getByRole("heading", {
                name: "Your Wishlist",
                level: 1,
            });
            await expect(heading).toHaveCSS("font-family", /Georgia/);
            await expect(
                main.locator('[data-variant="editorial"]')
            ).toBeVisible();
            const cards = main.locator('a[data-testid^="product-card-"]');
            await expect(cards).toHaveCount(10);
            await cards.first().focus();
            await expect(cards.first()).toHaveCSS("outline-style", "solid");
            const compare = main
                .getByRole("button", { name: "Add to compare", exact: true })
                .first();
            await compare.focus();
            await page.keyboard.press("Enter");
            await expect(
                main
                    .getByRole("button", {
                        name: "Remove from compare",
                        exact: true,
                    })
                    .first()
            ).toHaveAttribute("aria-pressed", "true");
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth
                )
            ).toBe(true);
            const results = await new AxeBuilder({ page })
                .include("main")
                .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                .analyze();
            expect(results.violations).toEqual([]);
            await page.screenshot({
                path: `test-results/wishlist-${width}.png`,
                fullPage: true,
            });
        });
    }
    test("paging, browser back, and out-of-range URLs keep the canonical page", async ({
        page,
    }) => {
        const nav = page.getByRole("navigation", {
            name: "Wishlist pagination",
        });
        const next = nav.getByRole("link", { name: "Next", exact: true });
        await next.focus();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/\/wishlist\/2$/);
        await expect(nav.getByRole("link", { name: "Page 2" })).toHaveAttribute(
            "aria-current",
            "page"
        );
        await expect(
            page.getByRole("main").getByTestId("product-card-actions")
        ).toHaveCount(1);
        await page.goBack({ waitUntil: "commit" });
        await expect(page).toHaveURL(/\/wishlist\/1$/);
        await expect(nav.getByRole("link", { name: "Page 1" })).toHaveAttribute(
            "aria-current",
            "page"
        );
        await page.goto("/profile/wishlist/99", { waitUntil: "commit" });
        await expect(page).toHaveURL(/\/wishlist\/2$/);
        await page.goto("/profile/wishlist/invalid", { waitUntil: "commit" });
        await expect(nav.getByRole("link", { name: "Page 1" })).toHaveAttribute(
            "aria-current",
            "page"
        );
    });
});
