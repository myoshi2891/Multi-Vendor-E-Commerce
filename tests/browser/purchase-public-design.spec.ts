import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expectReadableFocus } from "./purchase-assertions";

for (const width of [1440, 768, 390]) {
    for (const route of ["/", "/browse", "/cart", "/compare"]) {
        test(`${route} ${width}: public route and shared header`, async ({
            page,
        }, info) => {
            test.skip(
                route === "/browse" && !process.env.E2E_DATABASE_URL,
                "Dedicated schema-current E2E database required for product-data acceptance."
            );
            test.setTimeout(45000);
            await page.setViewportSize({ width, height: 1000 });
            await page.goto(route);
            await expect(page.getByTestId("store-header")).toBeVisible();
            await expect(page.getByRole("main")).toBeVisible();
            if (route === "/compare") {
                await expect(page.getByRole("heading", { name: "Compare products" })).toBeVisible();
                await expect(page.getByTestId("compare-empty")).toBeVisible();
                await expectReadableFocus(page.getByRole("link", { name: "Explore the collection" }));
                expect((await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
            }
            await page.getByLabel("Account menu", { exact: true }).click();
            await expect(
                page.getByRole("link", { name: "Sign in", exact: true })
            ).toBeVisible();
            expect(
                (
                    await new AxeBuilder({ page })
                        .include("header")
                        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                        .analyze()
                ).violations
            ).toEqual([]);
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth
                )
            ).toBe(true);
            await page.screenshot({
                path: info.outputPath(
                    `${route === "/" ? "home" : route.slice(1)}-${width}.png`
                ),
                fullPage: true,
            });
        });
    }
}
test("checkout guest sign-in preserves its return destination", async ({
    page,
}) => {
    await page.goto("/checkout");
    await expect(page).toHaveURL(
        (url) =>
            url.pathname === "/sign-in" &&
            url.searchParams.get("redirect_url") ===
                new URL("/checkout", url.origin).href
    );
});

test("wishlist guest sign-in preserves its return destination", async ({ page }) => {
    await page.goto("/profile/wishlist/1");
    await expect(page).toHaveURL(url => url.pathname === "/sign-in" &&
        url.searchParams.get("redirect_url") === new URL("/profile/wishlist/1", url.origin).href);
});

for (const width of [1440, 768, 390]) {
    test(`audit public ${width}: real browse, motion and product controls`, async ({
        page,
    }, info) => {
        test.setTimeout(120000);
        const inventoryPath = process.env.DESIGN_AUDIT_INVENTORY;
        test.skip(!inventoryPath, "Read-only DB inventory is required.");
        const inventory: Array<{ id: string; actualPath: string }> = JSON.parse(
            readFileSync(inventoryPath!, "utf8")
        );
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/browse");
        const nav = page.getByRole("navigation", { name: "Collection pages" });
        await expect(nav).toBeVisible();
        for (const button of await nav.getByRole("button").all()) {
            const box = await button.boundingBox();
            expect(box!.height).toBeGreaterThanOrEqual(44);
            expect(box!.width).toBeGreaterThanOrEqual(44);
        }
        await page.screenshot({
            path: info.outputPath(`audit-real-browse-${width}.png`),
            fullPage: true,
        });
        await page.goto("/");
        const motion = page.getByRole("button", { name: /motion reduced/ });
        await expect(motion).toBeDisabled();
        expect((await motion.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await page.screenshot({
            path: info.outputPath(`audit-real-home-${width}.png`),
            fullPage: true,
        });
        const productRow = inventory.find((row) => row.id === "DS-PAGE-019");
        expect(
            productRow,
            "inventory row DS-PAGE-019 is missing"
        ).toBeDefined();
        await page.goto(productRow!.actualPath);
        const category = page.getByRole("button", {
            name: "Browse categories",
        });
        await expect(category).toBeVisible();
        const controls = [
            category,
            page.getByRole("button", { name: "Copy product link" }),
            page.getByRole("button", { name: "Follow boutique" }),
        ];
        for (const control of controls.slice(0, 3)) {
            const box = await control.boundingBox();
            expect(box!.height).toBeGreaterThanOrEqual(44);
            expect(box!.width).toBeGreaterThanOrEqual(44);
        }
        await category.focus();
        await category.press("Enter");
        await expect(category).toHaveAttribute("aria-expanded", "true");
        await category.press("Escape");
        await expect(category).toBeFocused();
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth
            )
        ).toBe(true);
        await page.screenshot({
            path: info.outputPath(`audit-real-product-${width}.png`),
            fullPage: true,
        });
    });
}
