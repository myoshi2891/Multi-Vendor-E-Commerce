import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"]) {
        test(`overview ${width} ${theme}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/?screen=overview");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", { level: 1, name: "ダッシュボード" })
            ).toHaveCSS("font-family", /Georgia/);
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth
                )
            ).toBe(true);
            if (width === 390) {
                await page
                    .getByRole("button", { name: "Administration navigation" })
                    .click();
                await page
                    .getByRole("link", { name: "Overview", exact: true })
                    .focus();
                await page.keyboard.press("Escape");
                await expect(
                    page.getByRole("button", {
                        name: "Administration navigation",
                    })
                ).toBeFocused();
            }
            expect(
                (
                    await new AxeBuilder({ page })
                        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                        .analyze()
                ).violations
            ).toEqual([]);
            await page.screenshot({
                path: info.outputPath(`overview-${width}-${theme}.png`),
                fullPage: true,
            });
            await page.goto("/?screen=overview&empty");
            await expect(
                page.getByText("売上データがありません。")
            ).toBeVisible();
            await page.goto("/?screen=overview&fetcherror");
            await expect(page.getByRole("alert")).toBeVisible();
            await page.getByRole("button", { name: "Retry" }).click();
            expect(
                await page.evaluate(() =>
                    Boolean(
                        (window as unknown as { refreshed?: boolean }).refreshed
                    )
                )
            ).toBe(true);
        });
    }
for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"])
        test(`orders ${width} ${theme}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/?screen=orders&failure");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", {
                    level: 1,
                    name: "Orders",
                    exact: true,
                })
            ).toHaveCSS("font-family", /Georgia/);
            const search = page.getByRole("searchbox");
            await search.fill("missing");
            await expect(page.getByText("No Results.")).toBeVisible();
            await search.fill("order-1");
            const editor = page.getByRole("group", {
                name: "Order status group-1 editor",
            });
            await editor.getByRole("combobox").selectOption("Shipped");
            await editor.getByRole("button", { name: "Save status" }).click();
            await expect(editor.getByRole("combobox")).toBeDisabled();
            await expect(editor.getByRole("alert")).toBeVisible();
            await editor.getByRole("button", { name: "Retry" }).click();
            await expect(editor.getByRole("status")).toBeVisible();
            const details = page.getByRole("button", {
                name: "View order order-1",
            });
            await details.click();
            await expect(page.getByRole("dialog")).toContainText("Stripe");
            expect(
                (
                    await new AxeBuilder({ page })
                        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                        .analyze()
                ).violations
            ).toEqual([]);
            await page.screenshot({
                path: info.outputPath(`orders-${width}-${theme}.png`),
                fullPage: true,
            });
            await page.keyboard.press("Escape");
            await expect(details).toBeFocused();
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth
                )
            ).toBe(true);
            await page.goto("/?screen=orders&fetcherror");
            await expect(page.getByRole("alert")).toContainText(
                "Could not load orders"
            );
        });
for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"])
        test(`stores ${width} ${theme}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/?screen=stores&failure");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", {
                    level: 1,
                    name: "Stores",
                    exact: true,
                })
            ).toHaveCSS("font-family", /Georgia/);
            const search = page.getByRole("searchbox");
            await search.fill("missing");
            await expect(page.getByText("No Results.")).toBeVisible();
            await search.fill("Example");
            const editor = page.getByRole("group", {
                name: "Store status Example store editor",
            });
            await editor.getByRole("combobox").selectOption("ACTIVE");
            await editor.getByRole("button", { name: "Save status" }).click();
            await expect(editor.getByRole("combobox")).toBeDisabled();
            await expect(editor.getByRole("alert")).toBeVisible();
            await editor.getByRole("button", { name: "Retry" }).click();
            await expect(editor.getByRole("status")).toBeVisible();
            const details = page.getByRole("button", {
                name: "View store Example store",
            });
            await details.click();
            await expect(page.getByRole("dialog")).toContainText("$12.50");
            expect(
                (
                    await new AxeBuilder({ page })
                        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                        .analyze()
                ).violations
            ).toEqual([]);
            await page.screenshot({
                path: info.outputPath(`stores-${width}-${theme}.png`),
                fullPage: true,
            });
            await page.keyboard.press("Escape");
            await expect(details).toBeFocused();
            await page
                .getByRole("button", {
                    name: "Delete store Example store",
                    exact: true,
                })
                .click();
            await page
                .getByRole("button", { name: "Cancel", exact: true })
                .click();
            await expect(page.getByRole("dialog")).toHaveCount(0);
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth
                )
            ).toBe(true);
            await page.goto("/?screen=stores&failure");
            await page
                .getByRole("button", {
                    name: "Delete store Example store",
                    exact: true,
                })
                .click();
            await page.getByRole("button", { name: "Confirm delete" }).click();
            await page.keyboard.press("Escape");
            await expect(page.getByRole("dialog")).toBeVisible();
            await expect(page.getByRole("alert")).toBeVisible();
            await page.getByRole("button", { name: "Retry delete" }).click();
            await expect(page.getByRole("dialog")).toHaveCount(0);
            await expect(page.getByRole("status")).toContainText(
                "Deleted store"
            );
            await page.goto("/?screen=stores&fetcherror");
            await expect(page.getByRole("alert")).toContainText(
                "Could not load stores"
            );
        });
for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"])
        test(`coupons ${width} ${theme}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/?screen=coupons&loadfailure&failure");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", {
                    level: 1,
                    name: "Coupons",
                    exact: true,
                })
            ).toHaveCSS("font-family", /Georgia/);
            const search = page.getByRole("searchbox");
            await search.fill("missing");
            await expect(page.getByText("No Results.")).toBeVisible();
            await search.fill("WELCOME");
            const edit = page.getByRole("button", {
                name: "Edit coupon WELCOME",
            });
            await edit.click();
            await expect(page.getByRole("alert")).toContainText(
                "Could not load coupon"
            );
            await expect(page.getByRole("form")).toHaveCount(0);
            await page.getByRole("button", { name: "Retry load" }).click();
            await expect(
                page.getByRole("textbox", { name: "Coupon code" })
            ).toHaveValue("WELCOME");
            await page
                .getByRole("spinbutton", { name: "Coupon discount" })
                .fill("15");
            await page
                .getByRole("button", { name: "Save coupon", exact: true })
                .click();
            await expect(
                page.getByRole("textbox", { name: "Coupon code" })
            ).toBeDisabled();
            await page.keyboard.press("Escape");
            await expect(page.getByRole("dialog")).toBeVisible();
            await expect(page.getByRole("alert")).toContainText(
                "Your input has been kept"
            );
            await expect(
                page.getByRole("spinbutton", { name: "Coupon discount" })
            ).toHaveValue("15");
            await page
                .getByRole("button", { name: "Save coupon", exact: true })
                .click();
            await expect(page.getByText("Coupon saved.")).toBeVisible();
            expect(
                (
                    await new AxeBuilder({ page })
                        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                        .analyze()
                ).violations
            ).toEqual([]);
            await page.screenshot({
                path: info.outputPath(`coupons-${width}-${theme}.png`),
                fullPage: true,
            });
            await page.keyboard.press("Escape");
            await expect(edit).toBeFocused();
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth
                )
            ).toBe(true);
            await page
                .getByRole("button", { name: "Create New Coupon", exact: true })
                .click();
            await page
                .getByRole("button", { name: "Create coupon", exact: true })
                .click();
            await expect(
                page.getByText("Discount percentage must be at least 1%")
            ).toBeVisible();
            await page.keyboard.press("Escape");
            await page
                .getByRole("button", {
                    name: "Delete coupon WELCOME",
                    exact: true,
                })
                .click();
            await page
                .getByRole("button", { name: "Cancel", exact: true })
                .click();
            await expect(page.getByRole("dialog")).toHaveCount(0);
            await page.goto("/?screen=coupons&missingcoupon");
            await page
                .getByRole("button", { name: "Edit coupon WELCOME" })
                .click();
            await expect(page.getByRole("alert")).toBeVisible();
            await expect(page.getByRole("form")).toHaveCount(0);
        });
for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"])
        test(`newcoupon ${width} ${theme}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/?screen=newcoupon&failure");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", {
                    level: 1,
                    name: "Create coupon",
                    exact: true,
                })
            ).toHaveCSS("font-family", /Georgia/);
            await page
                .getByRole("button", { name: "Create coupon", exact: true })
                .click();
            await expect(
                page.getByText("Discount percentage must be at least 1%")
            ).toBeVisible();
            await page
                .getByRole("textbox", { name: "Coupon code" })
                .fill("NEWCODE");
            await page
                .getByRole("spinbutton", { name: "Coupon discount" })
                .fill("15");
            await page
                .getByLabel("Start date", { exact: true })
                .fill("2026-10-01T12:30");
            await page
                .getByLabel("End date", { exact: true })
                .fill("2026-12-01T12:30");
            await page
                .getByRole("button", { name: "Create coupon", exact: true })
                .click();
            await expect(
                page.getByRole("textbox", { name: "Coupon code" })
            ).toBeDisabled();
            await expect(page.getByRole("alert")).toContainText(
                "Your input has been kept"
            );
            await expect(
                page.getByRole("textbox", { name: "Coupon code" })
            ).toHaveValue("NEWCODE");
            await page
                .getByRole("button", { name: "Create coupon", exact: true })
                .click();
            await expect(page.getByText("Coupon saved.")).toBeVisible();
            expect(
                await page.evaluate(
                    () =>
                        (window as unknown as { destination: string })
                            .destination
                )
            ).toBe("/dashboard/seller/stores/example/coupons");
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
            await page.screenshot({
                path: info.outputPath(`newcoupon-${width}-${theme}.png`),
                fullPage: true,
            });
        });
for (const width of [1440, 768, 390])
    test(`legal ${width}`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto("/?screen=legal");
        await expect(
            page.getByRole("heading", {
                level: 1,
                name: "Legal & Privacy",
                exact: true,
            })
        ).toHaveCSS("font-family", /Georgia/);
        const link = page
            .getByRole("navigation", { name: "Legal contents" })
            .getByRole("link", { name: "Privacy Policy" });
        await link.focus();
        await expect(link).toHaveCSS("outline-style", "solid");
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/#privacy-policy$/);
        await expect(page.locator("#privacy-policy")).toBeFocused();
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
        await page.screenshot({
            path: info.outputPath(`legal-${width}.png`),
            fullPage: true,
        });
    });
