import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [1440, 768, 390]) {
    for (const theme of ["light", "dark"]) {
        test(`product ${width} ${theme}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/?screen=product");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", { level: 1, name: "Create product" })
            ).toHaveCSS("font-family", /Georgia/);
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth
                )
            ).toBe(true);
            await page
                .getByPlaceholder("Product Name", { exact: true })
                .focus();
            await expect(
                page.getByPlaceholder("Product Name", { exact: true })
            ).toHaveCSS("outline-style", "solid");
            await page
                .getByRole("combobox", { name: "Category", exact: true })
                .click();
            await page.getByRole("option", { name: /Watches/ }).click();
            await expect(
                page.getByRole("combobox", { name: "Category", exact: true })
            ).toContainText("Watches");
            await expect(
                page.getByRole("heading", {
                    level: 2,
                    name: "Product information",
                    exact: true,
                })
            ).toBeVisible();
            if (width === 390) {
                expect(
                    (await page
                        .getByText("Product Label", { exact: true })
                        .boundingBox())!.height
                ).toBeLessThan(30);
                expect(
                    (await page
                        .getByText("Product Label", { exact: true })
                        .locator("..")
                        .boundingBox())!.width
                ).toBeGreaterThan(180);
                expect(
                    (await page
                        .getByPlaceholder("size", { exact: true })
                        .boundingBox())!.width
                ).toBeGreaterThanOrEqual(70);
            }
            await expect(
                page.getByRole("button", {
                    name: "Upload standard image",
                    exact: true,
                })
            ).toHaveCSS("background-image", "none");
            expect(
                (
                    await new AxeBuilder({ page })
                        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                        .analyze()
                ).violations
            ).toEqual([]);
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({
                path: info.outputPath(`six-product-${width}-${theme}.png`),
                fullPage: true,
            });
        });
    }
}

for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"])
        test(`newvariant ${width} ${theme}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/?screen=newvariant");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", { level: 1, name: "Add variant" })
            ).toHaveCSS("font-family", /Georgia/);
            await expect(
                page.getByPlaceholder("Product Name", { exact: true })
            ).toHaveCount(0);
            await expect(
                page.getByRole("combobox", { name: "Category", exact: true })
            ).toBeEnabled();
            await expect(
                page.getByRole("combobox", { name: "Category", exact: true })
            ).toContainText("Watches");
            await page
                .getByPlaceholder("Variant Name", { exact: true })
                .focus();
            await expect(
                page.getByPlaceholder("Variant Name", { exact: true })
            ).toHaveCSS("outline-style", "solid");
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
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({
                path: info.outputPath(`six-newvariant-${width}-${theme}.png`),
                fullPage: true,
            });
        });

for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"])
        test(`editvariant ${width} ${theme}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/?screen=editvariant&failure=1");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", { level: 1, name: "Edit variant" })
            ).toHaveCSS("font-family", /Georgia/);
            await expect(
                page.getByPlaceholder("Product Name", { exact: true })
            ).toHaveValue(/An example watch/);
            await expect(
                page.getByRole("spinbutton", { name: "price 1", exact: true })
            ).toHaveValue("12.5");
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth
                )
            ).toBe(true);
            await page
                .getByRole("button", { name: "Save product", exact: true })
                .click();
            await expect(
                page.getByRole("status").filter({ hasText: "Saving product" })
            ).toBeVisible();
            await expect(
                page.getByPlaceholder("Product Name", { exact: true })
            ).toBeDisabled();
            await expect(
                page.getByRole("alert").filter({ hasText: "Please try again" })
            ).toBeVisible();
            await expect(
                page.getByPlaceholder("Variant Name", { exact: true })
            ).toHaveValue("Gold");
            await page
                .getByRole("button", { name: "Save product", exact: true })
                .click();
            await expect(
                page.getByRole("status").filter({ hasText: "Product saved" })
            ).toBeVisible();
            expect(
                await page.evaluate(
                    () =>
                        (window as unknown as { refreshed: boolean }).refreshed
                )
            ).toBe(true);
            expect(
                (
                    await new AxeBuilder({ page })
                        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                        .analyze()
                ).violations
            ).toEqual([]);
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({
                path: info.outputPath(`six-editvariant-${width}-${theme}.png`),
                fullPage: true,
            });
        });

for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"])
        test(`shipping ${width} ${theme}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/?screen=shipping&failure=1");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", {
                    level: 1,
                    name: "Shipping settings",
                })
            ).toHaveCSS("font-family", /Georgia/);
            const defaults = page.getByRole("form", {
                name: "Default shipping details",
            });
            await expect(
                defaults.getByRole("spinbutton", {
                    name: "Shipping fee per item",
                    exact: true,
                })
            ).toHaveValue("12.5");
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth
                )
            ).toBe(true);
            await page.getByRole("searchbox").fill("Japan");
            await expect(
                page.getByText("An example country with a long name", {
                    exact: true,
                })
            ).toHaveCount(0);
            const trigger = page.getByRole("button", {
                name: "Actions for Japan",
            });
            await trigger.focus();
            await page.keyboard.press("Enter");
            await expect(page.getByRole("menu")).toHaveCSS(
                "color",
                theme === "dark" ? "rgb(243, 240, 232)" : "rgb(24, 38, 29)"
            );
            await page.getByRole("menuitem", { name: "Edit details" }).click();
            const dialog = page.getByRole("dialog", {
                name: "Edit shipping for Japan",
            });
            await expect(dialog).toBeVisible();
            await expect(
                dialog.getByRole("spinbutton", {
                    name: "Shipping fee per item",
                    exact: true,
                })
            ).toHaveValue("12.5");
            await dialog.getByRole("button", { name: "Save changes" }).click();
            await expect(
                dialog.getByRole("textbox", { name: "Shipping service" })
            ).toBeDisabled();
            await expect(
                dialog.getByRole("button", { name: "Close", exact: true })
            ).toBeDisabled();
            await page.keyboard.press("Escape");
            await expect(dialog).toBeVisible();
            await expect(dialog.getByRole("alert")).toContainText(
                "Please try again"
            );
            await dialog.getByRole("button", { name: "Save changes" }).click();
            await expect(dialog.getByRole("status")).toContainText(
                "Shipping rate saved"
            );
            expect(
                (
                    await new AxeBuilder({ page })
                        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                        .analyze()
                ).violations
            ).toEqual([]);
            await dialog.screenshot({
                path: info.outputPath(
                    `six-shipping-dialog-${width}-${theme}.png`
                ),
            });
            await page.keyboard.press("Escape");
            await expect(dialog).toHaveCount(0);
            await expect(trigger).toBeFocused();
            await defaults
                .getByRole("button", { name: "Save changes" })
                .click();
            await expect(defaults.getByRole("status")).toContainText(
                "Shipping details saved"
            );
            expect(
                (
                    await new AxeBuilder({ page })
                        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                        .analyze()
                ).violations
            ).toEqual([]);
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({
                path: info.outputPath(`six-shipping-${width}-${theme}.png`),
                fullPage: true,
            });
        });

for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"])
        test(`storesettings ${width} ${theme}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/?screen=storesettings&failure=1");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", { level: 1, name: "Store settings" })
            ).toHaveCSS("font-family", /Georgia/);
            const form = page.getByRole("form", { name: "Store information" });
            await expect(
                form.getByRole("textbox", { name: "Store name", exact: true })
            ).toHaveValue("Example store");
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth
                )
            ).toBe(true);
            const name = form.getByRole("textbox", {
                name: "Store name",
                exact: true,
            });
            await name.fill("Updated store");
            await name.focus();
            await expect(name).toHaveCSS("outline-style", "solid");
            await form.getByRole("checkbox", { name: "Featured" }).check();
            await form
                .getByRole("button", { name: "Upload cover image" })
                .click();
            await expect(
                form.getByRole("button", { name: "Upload profile image" })
            ).toHaveCSS("background-image", "none");
            await form
                .getByRole("button", { name: "Save store information" })
                .click();
            await expect(name).toBeDisabled();
            await expect(
                form.getByRole("button", { name: "Upload cover image" })
            ).toBeDisabled();
            await expect(form.getByRole("alert")).toContainText(
                "Please try again"
            );
            await expect(name).toHaveValue("Updated store");
            await form
                .getByRole("button", { name: "Save store information" })
                .click();
            await expect(form.getByRole("status")).toContainText(
                "Store information saved"
            );
            expect(
                await page.evaluate(
                    () =>
                        (window as unknown as { refreshed: boolean }).refreshed
                )
            ).toBe(true);
            expect(
                (
                    await new AxeBuilder({ page })
                        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                        .analyze()
                ).violations
            ).toEqual([]);
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({
                path: info.outputPath(
                    `six-storesettings-${width}-${theme}.png`
                ),
                fullPage: true,
            });
        });

for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"])
        test(`newstore ${width} ${theme}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/?screen=newstore&failure=1");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", { level: 1, name: "Create store" })
            ).toHaveCSS("font-family", /Georgia/);
            await expect(
                page.getByRole("button", { name: "Store navigation" })
            ).toHaveCount(0);
            await page.getByRole("button", { name: "Toggle theme" }).click();
            await page
                .getByRole("menuitem", {
                    name: theme === "light" ? "Dark" : "Light",
                    exact: true,
                })
                .click();
            await expect(page.locator("html")).toHaveClass(
                theme === "light" ? /dark/ : /^$/
            );
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            const form = page.getByRole("form", { name: "Store information" });
            await form
                .getByRole("button", { name: "Create store", exact: true })
                .click();
            await expect(
                form.getByText("Choose a logo image.", { exact: true })
            ).toBeVisible();
            expect(
                (
                    await new AxeBuilder({ page })
                        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                        .analyze()
                ).violations
            ).toEqual([]);
            for (const [label, value] of [
                ["Store name", "Created store"],
                ["Store email", "new@example.test"],
                ["Store phone number", "1234567890"],
                ["Store url", "created-store"],
                [
                    "Store description",
                    "A store description longer than thirty characters for isolated verification.",
                ],
            ])
                await form
                    .getByRole("textbox", { name: label, exact: true })
                    .fill(value);
            await form
                .getByRole("button", { name: "Upload profile image" })
                .click();
            await form
                .getByRole("button", { name: "Upload cover image" })
                .click();
            await form
                .getByRole("button", { name: "Create store", exact: true })
                .click();
            await expect(
                form.getByRole("textbox", { name: "Store name", exact: true })
            ).toBeDisabled();
            await expect(form.getByRole("alert")).toContainText(
                "Please try again"
            );
            await expect(
                form.getByRole("textbox", { name: "Store name", exact: true })
            ).toHaveValue("Created store");
            await form
                .getByRole("button", { name: "Create store", exact: true })
                .click();
            await expect(form.getByRole("status")).toContainText(
                "Store information saved"
            );
            const saved = await page.evaluate(
                () =>
                    (window as unknown as { saved: Record<string, unknown>[] })
                        .saved[0]
            );
            expect(saved).not.toHaveProperty("id");
            expect(saved.url).toBe("created-store");
            expect(
                await page.evaluate(
                    () =>
                        (window as unknown as { destination: string })
                            .destination
                )
            ).toBe("/dashboard/seller/stores/example");
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
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({
                path: info.outputPath(`six-newstore-${width}-${theme}.png`),
                fullPage: true,
            });
        });
