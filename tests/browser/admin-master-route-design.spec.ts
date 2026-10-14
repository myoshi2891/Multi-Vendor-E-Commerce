import { test, expect, type BrowserContext } from "@playwright/test";
import { clerk, clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import { readFileSync } from "node:fs";
import { masterAccessible, masterFocus } from "./master-eight-assertions";
import { expectTouch, expectBoundaryContrast } from "./seller-residual-assertions";

// prepare-admin-master-route.ts only reads existing dedicated test data/accounts.
// No save, delete, archive, type conversion, or Cloudinary upload is performed.
type Prepared = {
    adminEmail: string;
    category: { id: string; name: string; url: string };
    attribute: { id: string; name: string };
    coupon: { code: string };
    offerTag: { name: string };
};
const manifest = process.env.DESIGN_ADMIN_MASTER_ROUTE;
if (!manifest) throw new Error("Set DESIGN_ADMIN_MASTER_ROUTE to the read-only preparation manifest.");
const prepared: Prepared = JSON.parse(readFileSync(manifest, "utf8"));
const routes = [
    { id: "DS-PAGE-043", path: "/dashboard/admin/categories", dialogTrigger: `Edit category ${prepared.category.name}`, search: prepared.category.name },
    { id: "DS-PAGE-042", path: "/dashboard/admin/categories/new" },
    { id: "DS-PAGE-041", path: "/dashboard/admin/attributes", menuTrigger: `Open menu for ${prepared.attribute.name}`, menuAction: "Edit details", search: prepared.attribute.name },
    { id: "DS-PAGE-040", path: "/dashboard/admin/attributes/new" },
    { id: "DS-PAGE-039", path: `/dashboard/admin/attributes/${prepared.attribute.id}/options`, optionMenu: true },
    { id: "DS-PAGE-045", path: "/dashboard/admin/coupons", dialogTrigger: `Edit coupon ${prepared.coupon.code}`, search: prepared.coupon.code },
    { id: "DS-PAGE-044", path: "/dashboard/admin/coupons/new" },
    { id: "DS-PAGE-047", path: "/dashboard/admin/offer-tags", dialogTrigger: `Edit offer tag ${prepared.offerTag.name}`, search: prepared.offerTag.name },
] as const;
let session: Awaited<ReturnType<BrowserContext["storageState"]>>;
test.beforeAll(async ({ browser }) => {
    test.setTimeout(600000);
    await clerkSetup();
    const context = await browser.newContext();
    try {
        const page = await context.newPage();
        await setupClerkTestingToken({ page });
        await page.goto("/");
        await clerk.signIn({ page, emailAddress: prepared.adminEmail });
        for (const route of routes) {
            const response = await page.goto(route.path, { waitUntil: "load", timeout: 120000 });
            expect(response?.status()).toBe(200);
            await expect(page).toHaveURL(url => url.pathname === route.path);
            await page.waitForLoadState("networkidle");
        }
        session = await context.storageState();
    } finally {
        await context.close();
    }
});

for (const route of routes) {
    for (const width of [1440, 768, 390]) {
        for (const theme of ["light", "dark"] as const) {
            test(`${route.id} ${width} ${theme}: real data and non-saving controls`, async ({ browser }, info) => {
                test.setTimeout(120000);
                const context = await browser.newContext({ storageState: session, viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: "reduce" });
                const page = await context.newPage();
                const pageErrors: string[] = [];
                page.on("pageerror", error => pageErrors.push(error.message));
                try {
                    await setupClerkTestingToken({ page });
                    const response = await page.goto(route.path, { waitUntil: "load", timeout: 90000 });
                    expect(response?.status()).toBe(200);
                    await expect(page).toHaveURL(url => url.pathname === route.path);
                    await page.waitForLoadState("networkidle");
                    await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
                    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
                    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
                    await masterAccessible(page);
                    if ("search" in route) await page.getByRole("searchbox").fill(route.search);
                    if ("dialogTrigger" in route) {
                        // Seed data contains categories sharing a display name. Their URL is unique.
                        const scope = route.id === "DS-PAGE-043"
                            ? page.getByRole("row").filter({ has: page.getByText(`/${prepared.category.url}`, { exact: true }) })
                            : page;
                        const trigger = scope.getByRole("button", { name: route.dialogTrigger, exact: true }).first();
                        await expectTouch(trigger);
                        await masterFocus(trigger);
                        await trigger.press("Enter");
                        const dialog = page.getByRole("dialog");
                        await expect(dialog.getByRole("form")).toBeVisible();
                        for (const input of await dialog.locator('input:not([aria-hidden="true"]):not([type="checkbox"]):not([type="hidden"]), select').all()) {
                            await expectTouch(input);
                            if (!(await input.isDisabled())) await expectBoundaryContrast(input, "borderTopColor");
                        }
                        await masterAccessible(page);
                        await page.keyboard.press("Escape");
                        await expect(dialog).toBeHidden();
                        await expect(trigger).toBeFocused();
                    } else if ("menuTrigger" in route || "optionMenu" in route) {
                        const trigger = "menuTrigger" in route
                            ? page.getByRole("button", { name: route.menuTrigger, exact: true }).first()
                            : page.getByRole("button", { name: /^Open menu for / }).first();
                        await expectTouch(trigger);
                        await trigger.focus();
                        await trigger.press("Enter");
                        const menu = page.getByRole("menu");
                        await expect(menu).toHaveCSS("border-radius", "3px");
                        await expect(menu).toHaveCSS("box-shadow", "none");
                        await masterAccessible(page);
                        await menu.getByRole("menuitem", { name: "menuAction" in route ? route.menuAction : "Edit label", exact: true }).click();
                        const dialog = page.getByRole("dialog");
                        await expect(dialog.getByRole("form")).toBeVisible();
                        await masterAccessible(page);
                        await page.keyboard.press("Escape");
                        await expect(dialog).toBeHidden();
                        await expect(trigger).toBeFocused();
                    } else {
                        const form = page.getByRole("form");
                        for (const input of await form.locator('input:not([aria-hidden="true"]):not([type="checkbox"]):not([type="hidden"]), select').all()) {
                            await expectTouch(input);
                            await expectBoundaryContrast(input, "borderTopColor");
                        }
                        await masterFocus(form.getByRole("button", { name: /^Create / }).first());
                    }
                    await page.evaluate(() => window.scrollTo(0, 0));
                    await page.screenshot({ path: info.outputPath(`${route.id}-${width}-${theme}.png`), fullPage: true });
                    expect(pageErrors).toEqual([]);
                } finally {
                    await context.close();
                }
            });
        }
    }
}
