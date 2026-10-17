import { test, expect, type BrowserContext } from "@playwright/test";
import {
    clerk,
    clerkSetup,
    setupClerkTestingToken,
} from "@clerk/testing/playwright";
import { readFileSync } from "node:fs";
import { masterAccessible, masterFocus } from "./master-eight-assertions";
import { expectTouch } from "./seller-residual-assertions";

type Prepared = {
    sellerEmail: string;
    adminEmail: string;
    customerEmail: string;
    stores: { name: string; url: string }[];
    productSlug: string;
    variantSlugs: string[];
};
const manifest = process.env.DESIGN_REMAINING_ROUTE;
if (!manifest)
    throw new Error(
        "Run prepare-remaining-route.ts and set DESIGN_REMAINING_ROUTE."
    );
const prepared: Prepared = JSON.parse(readFileSync(manifest, "utf8"));
let sellerSession: Awaited<ReturnType<BrowserContext["storageState"]>>;
test.beforeAll(async ({ browser }) => {
    test.setTimeout(180000);
    await clerkSetup();
    const context = await browser.newContext();
    try {
        const page = await context.newPage();
        await setupClerkTestingToken({ page });
        await page.goto("/");
        await clerk.signIn({ page, emailAddress: prepared.sellerEmail });
        await page.goto("/dashboard/seller/stores");
        await expect(
            page.getByRole("heading", { level: 1, name: "Your stores" })
        ).toBeVisible();
        sellerSession = await context.storageState();
    } finally {
        await context.close();
    }
});

for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"] as const) {
        test(`DS-PAGE-066 stores ${width} ${theme}`, async ({
            browser,
        }, info) => {
            test.setTimeout(90000);
            const context = await browser.newContext({
                storageState: sellerSession,
                viewport: { width, height: 1000 },
                colorScheme: theme,
                reducedMotion: "reduce",
            });
            try {
                const page = await context.newPage();
                await setupClerkTestingToken({ page });
                const errors: string[] = [];
                page.on("pageerror", (error) => errors.push(error.message));
                expect(
                    (await page.goto("/dashboard/seller/stores"))?.status()
                ).toBe(200);
                await expect(
                    page.getByRole("heading", { level: 1, name: "Your stores" })
                ).toBeVisible();
                await expect(page.locator("html")).toHaveClass(
                    theme === "dark" ? /dark/ : /^(?!.*dark)/
                );
                await expect(
                    page
                        .getByRole("list", { name: "Your stores" })
                        .getByRole("listitem")
                ).toHaveCount(prepared.stores.length);
                for (const store of prepared.stores) {
                    const link = page.getByRole("link", {
                        name: `Manage ${store.name}`,
                        exact: true,
                    });
                    await expect(link).toHaveAttribute(
                        "href",
                        `/dashboard/seller/stores/${encodeURIComponent(store.url)}`
                    );
                    await expectTouch(link);
                    await masterFocus(link);
                }
                await expect(
                    page.getByRole("main").getByRole("alert")
                ).toHaveCount(0);
                await masterAccessible(page);
                await page.screenshot({
                    path: info.outputPath("stores.png"),
                    fullPage: true,
                });
                expect(errors).toEqual([]);
            } finally {
                await context.close();
            }
        });
    }

for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"] as const) {
        test(`DS-PAGE-046 offer creation ${width} ${theme}`, async ({
            browser,
        }, info) => {
            test.setTimeout(120000);
            const context = await browser.newContext({
                viewport: { width, height: 1000 },
                colorScheme: theme,
                reducedMotion: "reduce",
            });
            try {
                const page = await context.newPage();
                await setupClerkTestingToken({ page });
                await page.goto("/");
                await clerk.signIn({ page, emailAddress: prepared.adminEmail });
                expect(
                    (
                        await page.goto("/dashboard/admin/offer-tags/new")
                    )?.status()
                ).toBe(200);
                await expect(
                    page.getByRole("heading", {
                        level: 1,
                        name: "Create offer tag",
                        exact: true,
                    })
                ).toBeVisible();
                const form = page.getByRole("form", {
                    name: "Offer tag information",
                });
                await form
                    .getByRole("button", {
                        name: "Create offer tag",
                        exact: true,
                    })
                    .click();
                await expect(form.getByLabel("Offer tag name")).toHaveAttribute(
                    "aria-invalid",
                    "true"
                );
                for (const input of await form.getByRole("textbox").all()) {
                    await expectTouch(input);
                    await masterFocus(input);
                }
                await masterAccessible(page);
                await page.screenshot({
                    path: info.outputPath("offer-create-validation.png"),
                    fullPage: true,
                });
            } finally {
                await context.close();
            }
        });
    }

for (const width of [1440, 768, 390]) {
    test(`DS-PAGE-020 product alias ${width}`, async ({ page }, info) => {
        test.setTimeout(90000);
        await page.setViewportSize({ width, height: 1000 });
        await setupClerkTestingToken({ page });
        const response = await page.goto(`/product/${prepared.productSlug}`);
        expect(response?.status()).toBe(200);
        await expect(page).toHaveURL((url) =>
            prepared.variantSlugs.some(
                (slug) =>
                    url.pathname === `/product/${prepared.productSlug}/${slug}`
            )
        );
        await expect(
            page.getByRole("main").getByRole("heading", { level: 1 })
        ).toBeVisible();
        await masterAccessible(page);
        await page.screenshot({
            path: info.outputPath("product-destination.png"),
            fullPage: true,
        });
    });
}

for (const alias of [
    {
        id: "DS-PAGE-023",
        path: "/profile/following",
        heading: "Stores you follow",
    },
]) {
    for (const width of [1440, 768, 390]) {
        test(`${alias.id} authenticated alias ${width}`, async ({
            browser,
        }, info) => {
            test.setTimeout(120000);
            const context = await browser.newContext({
                viewport: { width, height: 1000 },
                reducedMotion: "reduce",
            });
            try {
                const page = await context.newPage();
                await setupClerkTestingToken({ page });
                await page.goto("/");
                await clerk.signIn({
                    page,
                    emailAddress: prepared.customerEmail,
                });
                expect((await page.goto(alias.path))?.status()).toBe(200);
                await expect(page).toHaveURL(
                    (url) => url.pathname === `${alias.path}/1`
                );
                await expect(
                    page
                        .getByRole("main")
                        .getByRole("heading", { level: 1, name: alias.heading })
                ).toBeVisible();
                await expect(
                    page.getByRole("main").getByRole("alert")
                ).toHaveCount(0);
                await masterAccessible(page);
                await page.screenshot({
                    path: info.outputPath("account-destination.png"),
                    fullPage: true,
                });
            } finally {
                await context.close();
            }
        });
    }
    test(`${alias.id} guest requires sign in`, async ({ page }) => {
        test.setTimeout(90000);
        await setupClerkTestingToken({ page });
        await page.goto(alias.path);
        await expect(page).toHaveURL((url) =>
            url.pathname.startsWith("/sign-in")
        );
        await expect(page.locator("[data-profile-shell]")).toHaveCount(0);
    });
}
