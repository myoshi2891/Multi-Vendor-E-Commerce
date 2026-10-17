import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expectTouch, expectBoundaryContrast, expectTokenColor } from "./seller-residual-assertions";
import { masterAccessible, masterFocus } from "./master-eight-assertions";

for (const width of [1440, 768, 390]) {
    for (const theme of ["light", "dark"]) {
        test(`master eight offertags ${width} ${theme}: load retry and edit controls`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 1000 });
            await page.goto("/?screen=offertags&loadfailure");
            await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), theme === "dark");
            const trigger = page.getByRole("button", { name: "Edit offer tag Summer offers with a long seasonal title", exact: true });
            await expectTouch(trigger);
            await trigger.click();
            const dialog = page.getByRole("dialog");
            await expect(dialog.getByRole("alert")).toContainText("Could not load information");
            const retry = dialog.getByRole("button", { name: "Retry load" });
            await expectTouch(retry);
            await masterFocus(retry);
            await retry.press("Enter");
            const name = dialog.getByLabel("Offer tag name", { exact: true });
            await expect(name).toHaveValue("Summer offers with a long seasonal title");
            for (const field of await dialog.getByRole("textbox").all()) {
                await expectTouch(field);
                await expectBoundaryContrast(field, "borderTopColor");
            }
            await masterFocus(name);
            await expectTouch(dialog.getByRole("button", { name: "Save offer tag", exact: true }));
            await masterAccessible(page);
            await page.screenshot({ path: info.outputPath(`master-eight-offertags-${width}-${theme}.png`), fullPage: true });
            await page.keyboard.press("Escape");
            await expect(trigger).toBeFocused();
        });
    }
}

for (const width of [1440, 768, 390]) {
    for (const theme of ["light", "dark"]) {
        test(`master eight adminnewcoupon ${width} ${theme}: independent form and active label`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 1000 });
            await page.goto("/?screen=adminnewcoupon");
            await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), theme === "dark");
            const form = page.getByRole("form", { name: "Coupon information" });
            for (const input of await form.locator('input:not([type="checkbox"]), select').all()) {
                await expectTouch(input);
                await expectBoundaryContrast(input, "borderTopColor");
            }
            const active = form.locator("label").filter({ hasText: /^Active$/ });
            await expectTouch(active);
            const check = form.getByRole("checkbox", { name: "Active", exact: true });
            await expect(check).toBeChecked();
            const primary = await check.evaluate(element => {
                const probe = document.createElement("span");
                probe.style.color = "hsl(var(--primary))";
                element.parentElement!.append(probe);
                const color = getComputedStyle(probe).color;
                probe.remove();
                return color;
            });
            await expect(check).toHaveCSS("accent-color", primary);
            await active.click();
            await expect(check).not.toBeChecked();
            await form.getByLabel("Scope").selectOption("PLATFORM");
            await expect(form.getByLabel("Store ID")).toHaveCount(0);
            await form.getByLabel("Scope").selectOption("STORE");
            await expect(form.getByLabel("Store ID")).toBeVisible();
            await masterFocus(form.getByLabel("Coupon code", { exact: true }));
            await masterAccessible(page);
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({ path: info.outputPath(`master-eight-adminnewcoupon-${width}-${theme}.png`), fullPage: true });
        });
    }
}

for (const width of [1440, 768, 390]) {
    for (const theme of ["light", "dark"]) {
        test(`master eight admincoupons ${width} ${theme}: activation target and failed retry`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 1000 });
            await page.goto("/?screen=admincoupons&failure");
            await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), theme === "dark");
            const toggle = page.getByRole("button", { name: "Deactivate WELCOME", exact: true });
            await expectTouch(toggle);
            await masterFocus(toggle);
            await toggle.press("Enter");
            await expect(page.getByRole("button", { name: "Updating…" })).toBeDisabled();
            await expect(page.getByRole("alert")).toContainText("input has been kept");
            await toggle.click();
            const success = page.getByRole("status").filter({ hasText: "Changes saved." });
            await expect(success).toBeVisible();
            await expectTokenColor(success, "color", "var(--brand-success)");
            expect(await page.evaluate(() => (window as unknown as { calls: unknown[][] }).calls)).toEqual([["coupon-1"], ["coupon-1"]]);
            await masterAccessible(page);
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({ path: info.outputPath(`master-eight-admincoupons-${width}-${theme}.png`), fullPage: true });
        });
    }
}

for (const width of [1440, 768, 390]) {
    for (const theme of ["light", "dark"]) {
        test(`master eight attributeoptions ${width} ${theme}: option menu and immutable edit`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 1000 });
            await page.goto("/?screen=attributeoptions");
            await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), theme === "dark");
            const trigger = page.getByRole("button", { name: "Open menu for Linen", exact: true });
            await trigger.focus();
            await trigger.press("Enter");
            const menu = page.getByRole("menu");
            await expect(menu).toHaveCSS("border-radius", "3px");
            await expect(menu).toHaveCSS("box-shadow", "none");
            await expectTokenColor(menu, "background-color", "hsl(var(--popover))");
            await masterAccessible(page);
            const edit = menu.getByRole("menuitem", { name: "Edit label", exact: true });
            await expectTouch(edit);
            await edit.press("Enter");
            const dialog = page.getByRole("dialog");
            await expect(dialog.getByLabel("Value", { exact: true })).toBeDisabled();
            const label = dialog.getByLabel("Label", { exact: true });
            await expectTouch(label);
            await expectBoundaryContrast(label, "borderTopColor");
            await masterFocus(label);
            await masterAccessible(page);
            await page.screenshot({ path: info.outputPath(`master-eight-attributeoptions-${width}-${theme}.png`), fullPage: true });
            await page.keyboard.press("Escape");
            await expect(trigger).toBeFocused();
        });
    }
}

for (const width of [1440, 768, 390]) {
    for (const theme of ["light", "dark"]) {
        test(`master eight newattribute ${width} ${theme}: semantic success and boolean labels`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 1000 });
            await page.goto("/?screen=newattribute");
            await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), theme === "dark");
            const form = page.getByRole("form", { name: "Attribute information" });
            await form.getByLabel("Category").selectOption("cat-1");
            await form.getByLabel("Key", { exact: true }).fill("material");
            await form.getByLabel("Display name", { exact: true }).fill("Material");
            await form.getByLabel("Type", { exact: true }).selectOption("ENUM");
            for (const name of ["Required", "Facetable", "Multi-valued"]) {
                await expectTouch(form.locator("label").filter({ hasText: new RegExp(`^${name}$`) }));
            }
            const submit = form.getByRole("button", { name: "Create attribute", exact: true });
            await masterFocus(submit);
            await submit.press("Enter");
            const success = page.getByRole("status").filter({ hasText: "Changes saved." });
            await expect(success).toBeVisible();
            await expectTokenColor(success, "color", "var(--brand-success)");
            await masterAccessible(page);
            await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({ path: info.outputPath(`master-eight-newattribute-${width}-${theme}.png`), fullPage: true });
        });
    }
}

for (const width of [1440, 768, 390]) {
    for (const theme of ["light", "dark"]) {
        test(`master eight attributes ${width} ${theme}: independent menu surface`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 1000 });
            await page.goto("/?screen=attributes");
            await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), theme === "dark");
            const trigger = page.getByRole("button", { name: "Open menu for Material", exact: true });
            await masterFocus(trigger);
            await trigger.press("Enter");
            const menu = page.getByRole("menu");
            await expect(menu).toHaveCSS("border-radius", "3px");
            await expect(menu).toHaveCSS("box-shadow", "none");
            await expectTokenColor(menu, "background-color", "hsl(var(--popover))");
            const edit = menu.getByRole("menuitem", { name: "Edit details" });
            await expectTouch(edit);
            await edit.focus();
            await expectBoundaryContrast(edit, "outlineColor");
            await masterAccessible(page);
            await page.screenshot({ path: info.outputPath(`master-eight-attributes-${width}-${theme}.png`), fullPage: true });
            await page.keyboard.press("Escape");
            await expect(trigger).toBeFocused();
        });
    }
}

for (const width of [1440, 768, 390]) {
    for (const theme of ["light", "dark"]) {
        test(`master eight newcategory ${width} ${theme}: standalone input and featured targets`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 1000 });
            await page.goto("/?screen=newcategory");
            await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), theme === "dark");
            const form = page.getByRole("form", { name: "Category information" });
            for (const input of await form.locator('input:not([type="checkbox"]):not([aria-hidden="true"]), select').all()) {
                await expectTouch(input);
                await expectBoundaryContrast(input, "borderTopColor");
            }
            const featured = form.locator("label").filter({ hasText: /^Featured$/ });
            await expectTouch(featured);
            await featured.click();
            await expect(form.getByRole("checkbox", { name: "Featured", exact: true })).toBeChecked();
            const parent = form.getByRole("combobox", { name: "Parent category" });
            await parent.selectOption("cat-1");
            await expect(parent).toHaveValue("cat-1");
            await parent.selectOption("__root__");
            const upload = form.getByRole("button", { name: "Upload profile image" });
            await expectTouch(upload);
            await masterFocus(upload);
            await expectTouch(form.getByRole("button", { name: "Create category", exact: true }));
            await masterAccessible(page);
            await page.screenshot({ path: info.outputPath(`master-eight-newcategory-${width}-${theme}.png`), fullPage: true });
        });
    }
}

for (const width of [1440, 768, 390]) {
    for (const theme of ["light", "dark"]) {
        test(`master eight categories ${width} ${theme}: dialog controls and recovery`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/?screen=categories&failure");
            await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), theme === "dark");
            const trigger = page.getByRole("button", { name: "Create New Category", exact: true });
            await expectTouch(trigger);
            await trigger.focus();
            await trigger.press("Enter");
            const dialog = page.getByRole("dialog");
            for (const input of await dialog.locator('input:not([type="checkbox"]):not([aria-hidden="true"]), select').all()) {
                await expectTouch(input);
                await expectBoundaryContrast(input, "borderTopColor");
            }
            await expectTouch(dialog.getByRole("button", { name: "Create category", exact: true }));
            await expectTouch(dialog.getByRole("button", { name: "Close", exact: true }));
            expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
            await page.screenshot({ path: info.outputPath(`master-eight-categories-${width}-${theme}.png`), fullPage: true });
            await page.keyboard.press("Escape");
            await expect(trigger).toBeFocused();
        });
    }
}

const screens = [
    { screen: "newoffertag", title: "Create offer tag" },
    { screen: "offertags", title: "Offer tags" },
    { screen: "adminnewcoupon", title: "Create coupon" },
    { screen: "admincoupons", title: "Coupons" },
    { screen: "newcategory", title: "Create category" },
    { screen: "categories", title: "Categories" },
];
test("category dialog native parent, Tab and reduced motion", async ({
    page,
}, info) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?screen=categories");
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    const create = page.getByRole("button", {
        name: "Create New Category",
        exact: true,
    });
    await create.click();
    const dialog = page.getByRole("dialog"),
        upload = dialog.getByRole("button", { name: "Upload profile image" });
    await upload.focus();
    await page.keyboard.press("Tab");
    await expect(dialog.getByLabel("Category name")).toBeFocused();
    await expect(upload).toHaveCSS("transition-duration", "0s");
    await expect(upload.locator("..")).toHaveCSS("box-shadow", "none");
    await expect(upload.locator("..")).toHaveCSS("border-radius", "3px");
    const parent = dialog.getByRole("combobox");
    await parent.selectOption("cat-1");
    await expect(parent).toHaveValue("cat-1");
    await parent.selectOption("__root__");
    await expect(parent).toHaveValue("__root__");
    expect(
        (
            await new AxeBuilder({ page })
                .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                .analyze()
        ).violations
    ).toEqual([]);
    await page.screenshot({
        path: info.outputPath("category-parent-dialog-390-dark.png"),
        fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(create).toBeFocused();
});
for (const entry of screens)
    for (const width of [1440, 768, 390])
        for (const theme of ["light", "dark"])
            test(`${entry.screen} ${width} ${theme}`, async ({
                page,
            }, info) => {
                await page.route("https://example.test/**", (route) =>
                    route.fulfill({
                        contentType: "image/svg+xml",
                        body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#d4ba83"/><path d="M30 95h100v25H30z M50 40h35v55H50z" fill="#17251d"/></svg>',
                    })
                );
                await page.setViewportSize({ width, height: 900 });
                await page.goto(`/?screen=${entry.screen}`);
                await page.evaluate(
                    (dark) =>
                        document.documentElement.classList.toggle("dark", dark),
                    theme === "dark"
                );
                await expect(
                    page.getByRole("heading", {
                        level: 1,
                        name: entry.title,
                        exact: true,
                    })
                ).toHaveCSS("font-family", /Georgia/);
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
                    path: info.outputPath(
                        `${entry.screen}-${width}-${theme}.png`
                    ),
                    fullPage: true,
                });
                if (entry.screen === "newoffertag") {
                    for (const input of await page.getByRole("form", { name: "Offer tag information" }).getByRole("textbox").all()) {
                        expect((await input.boundingBox())!.height).toBeGreaterThanOrEqual(44);
                    }
                    await page.goto("/?screen=newoffertag&failure");
                    await page.evaluate(
                        (dark) =>
                            document.documentElement.classList.toggle(
                                "dark",
                                dark
                            ),
                        theme === "dark"
                    );
                    const form = page.getByRole("form", {
                        name: "Offer tag information",
                    });
                    await form
                        .getByRole("button", {
                            name: "Create offer tag",
                            exact: true,
                        })
                        .click();
                    await expect(
                        form.getByLabel("Offer tag name")
                    ).toHaveAttribute("aria-invalid", "true");
                    await form.getByLabel("Offer tag name").fill("New offer");
                    await form.getByLabel("Offer tag url").fill("new-offer");
                    await form.getByLabel("Offer tag name").focus();
                    await expect(form.getByLabel("Offer tag name")).toHaveCSS(
                        "outline-style",
                        "solid"
                    );
                    await form
                        .getByRole("button", {
                            name: "Create offer tag",
                            exact: true,
                        })
                        .press("Enter");
                    await expect(
                        form.getByLabel("Offer tag name")
                    ).toBeDisabled();
                    await expect(page.getByRole("alert")).toBeVisible();
                    await expect(form.getByLabel("Offer tag name")).toHaveValue(
                        "New offer"
                    );
                    await form
                        .getByRole("button", {
                            name: "Create offer tag",
                            exact: true,
                        })
                        .click();
                    await expect(
                        page.getByText("Changes saved.")
                    ).toBeVisible();
                    expect(
                        (
                            await new AxeBuilder({ page })
                                .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                                .analyze()
                        ).violations
                    ).toEqual([]);
                }
                if (entry.screen === "adminnewcoupon") {
                    await page.goto("/?screen=adminnewcoupon&failure");
                    await page.evaluate(
                        (dark) =>
                            document.documentElement.classList.toggle(
                                "dark",
                                dark
                            ),
                        theme === "dark"
                    );
                    const form = page.getByRole("form", {
                        name: "Coupon information",
                    });
                    await form
                        .getByRole("button", {
                            name: "Create coupon",
                            exact: true,
                        })
                        .click();
                    await expect(
                        form.getByLabel("Coupon code")
                    ).toHaveAttribute("aria-invalid", "true");
                    await form.getByLabel("Coupon code").fill("NEWCODE");
                    await form.getByLabel("Coupon discount").fill("10");
                    await form.getByLabel("Scope").selectOption("PLATFORM");
                    await expect(form.getByLabel("Store ID")).not.toBeVisible();
                    await form.getByLabel("Coupon code").focus();
                    await expect(form.getByLabel("Coupon code")).toHaveCSS(
                        "outline-style",
                        "solid"
                    );
                    await form
                        .getByRole("button", {
                            name: "Create coupon",
                            exact: true,
                        })
                        .click();
                    await expect(form.getByLabel("Coupon code")).toBeDisabled();
                    await expect(page.getByRole("alert")).toBeVisible();
                    await expect(form.getByLabel("Coupon code")).toHaveValue(
                        "NEWCODE"
                    );
                    await form
                        .getByRole("button", {
                            name: "Create coupon",
                            exact: true,
                        })
                        .click();
                    await expect(
                        page.getByText("Changes saved.")
                    ).toBeVisible();
                    expect(
                        (
                            await new AxeBuilder({ page })
                                .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                                .analyze()
                        ).violations
                    ).toEqual([]);
                }
                if (entry.screen === "newcategory") {
                    await page.goto("/?screen=newcategory&failure");
                    await page.evaluate(
                        (dark) =>
                            document.documentElement.classList.toggle(
                                "dark",
                                dark
                            ),
                        theme === "dark"
                    );
                    const form = page.getByRole("form", {
                        name: "Category information",
                    });
                    await form
                        .getByRole("button", {
                            name: "Create category",
                            exact: true,
                        })
                        .click();
                    await expect(
                        form.getByLabel("Category name")
                    ).toHaveAttribute("aria-invalid", "true");
                    await form.getByLabel("Category name").fill("New shoes");
                    await form.getByLabel("Category url").fill("new-shoes");
                    await form
                        .getByRole("button", { name: "Upload profile image" })
                        .click();
                    await form.getByRole("combobox").selectOption("cat-1");
                    await form
                        .getByRole("checkbox", { name: "Featured" })
                        .check();
                    await form.getByLabel("Category name").focus();
                    await expect(form.getByLabel("Category name")).toHaveCSS(
                        "outline-style",
                        "solid"
                    );
                    await form
                        .getByRole("button", {
                            name: "Create category",
                            exact: true,
                        })
                        .click();
                    await expect(
                        form.getByLabel("Category name")
                    ).toBeDisabled();
                    await expect(page.getByRole("alert")).toBeVisible();
                    await expect(form.getByLabel("Category name")).toHaveValue(
                        "New shoes"
                    );
                    await form
                        .getByRole("button", {
                            name: "Create category",
                            exact: true,
                        })
                        .click();
                    await expect(
                        page.getByText("Changes saved.")
                    ).toBeVisible();
                    expect(
                        (
                            await new AxeBuilder({ page })
                                .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                                .analyze()
                        ).violations
                    ).toEqual([]);
                }
                if (
                    ["categories", "admincoupons", "offertags"].includes(
                        entry.screen
                    )
                ) {
                    const category = entry.screen === "categories",
                        entity = category
                            ? "category"
                            : entry.screen === "offertags"
                              ? "offer tag"
                              : "coupon",
                        name = category
                            ? "Shoes"
                            : entry.screen === "offertags"
                              ? "Summer offers with a long seasonal title"
                              : "WELCOME",
                        field = category
                            ? "Category name"
                            : entry.screen === "offertags"
                              ? "Offer tag name"
                              : "Coupon code",
                        edited = category
                            ? "Edited shoes"
                            : entry.screen === "offertags"
                              ? "Edited offer"
                              : "EDITED",
                        saveButton = category
                            ? "Save category information"
                            : entry.screen === "offertags"
                              ? "Save offer tag"
                              : "Save coupon";
                    await page.getByRole("searchbox").fill("not-a-record");
                    await expect(page.getByText("No Results.")).toBeVisible();
                    await page.getByRole("searchbox").fill(name);
                    await expect(
                        page.getByRole("button", {
                            name: `Edit ${entity} ${name}`,
                            exact: true,
                        })
                    ).toBeVisible();
                    await page.goto(
                        `/?screen=${entry.screen}&loadfailure&failure`
                    );
                    await page.evaluate(
                        (dark) =>
                            document.documentElement.classList.toggle(
                                "dark",
                                dark
                            ),
                        theme === "dark"
                    );
                    const edit = page.getByRole("button", {
                        name: `Edit ${entity} ${name}`,
                        exact: true,
                    });
                    await edit.click();
                    const dialog = page.getByRole("dialog");
                    await expect(dialog.getByRole("alert")).toBeVisible();
                    await dialog
                        .getByRole("button", { name: "Retry load" })
                        .click();
                    await expect(dialog.getByLabel(field)).toHaveValue(name);
                    await dialog.getByLabel(field).fill(edited);
                    await dialog
                        .getByRole("button", {
                            name: saveButton,
                        })
                        .click();
                    await expect(dialog.getByLabel(field)).toBeDisabled();
                    await page.keyboard.press("Escape");
                    await expect(dialog).toBeVisible();
                    await expect(dialog.getByRole("alert")).toBeVisible();
                    await expect(dialog.getByLabel(field)).toHaveValue(edited);
                    await dialog
                        .getByRole("button", {
                            name: saveButton,
                        })
                        .click();
                    await expect(dialog.getByRole("status")).toHaveText(
                        "Changes saved."
                    );
                    expect(
                        (
                            await new AxeBuilder({ page })
                                .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                                .analyze()
                        ).violations
                    ).toEqual([]);
                    await page.screenshot({
                        path: info.outputPath(
                            `${entry.screen}-dialog-${width}-${theme}.png`
                        ),
                        fullPage: true,
                    });
                    await page.keyboard.press("Escape");
                    await expect(edit).toBeFocused();
                    if (entry.screen === "admincoupons") {
                        const toggle = page.getByRole("button", {
                            name: "Deactivate WELCOME",
                            exact: true,
                        });
                        await toggle.click();
                        await expect(
                            page.getByRole("button", {
                                name: "Updating…",
                                exact: true,
                            })
                        ).toBeDisabled();
                        await expect(
                            page.getByText("Changes saved.")
                        ).toBeVisible();
                    }
                    await page
                        .getByRole("button", {
                            name: `Delete ${entity} ${name}`,
                            exact: true,
                        })
                        .click();
                    await page
                        .getByRole("button", { name: "Cancel", exact: true })
                        .click();
                    await expect(page.getByRole("dialog")).not.toBeVisible();
                    await page
                        .getByRole("button", {
                            name: `Delete ${entity} ${name}`,
                            exact: true,
                        })
                        .click();
                    await page
                        .getByRole("button", {
                            name: "Confirm delete",
                            exact: true,
                        })
                        .click();
                    await expect(
                        page.getByRole("button", {
                            name: "Cancel",
                            exact: true,
                        })
                    ).toBeDisabled();
                    await page.keyboard.press("Escape");
                    await expect(page.getByRole("dialog")).toBeVisible();
                    await expect(
                        page.getByText(`Deleted ${entity} ${name}.`)
                    ).toBeVisible();
                    const id = category
                        ? "cat-1"
                        : entry.screen === "offertags"
                          ? "tag-1"
                          : "coupon-1";
                    expect(
                        await page.evaluate(() =>
                            (
                                window as unknown as { calls: unknown[][] }
                            ).calls.at(-1)
                        )
                    ).toEqual([id]);
                    const create = page.getByRole("button", {
                        name: category
                            ? "Create New Category"
                            : entry.screen === "offertags"
                              ? "Create New Offer Tag"
                              : "Create New Coupon",
                        exact: true,
                    });
                    await create.click();
                    await expect(page.getByRole("form")).toBeVisible();
                    expect(
                        (
                            await new AxeBuilder({ page })
                                .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                                .analyze()
                        ).violations
                    ).toEqual([]);
                    await page.keyboard.press("Escape");
                    await expect(create).toBeFocused();
                    await page.goto(
                        `/?screen=${entry.screen}&missingcoupon&missing`
                    );
                    await page
                        .getByRole("button", {
                            name: `Edit ${entity} ${name}`,
                            exact: true,
                        })
                        .click();
                    await expect(
                        page.getByRole("dialog").getByRole("alert")
                    ).toBeVisible();
                    await expect(page.getByRole("form")).not.toBeVisible();
                    await page.goto(`/?screen=${entry.screen}&empty`);
                    await expect(page.getByText("No Results.")).toBeVisible();
                    await page.goto(`/?screen=${entry.screen}&fetcherror`);
                    await expect(page.getByRole("alert")).toBeVisible();
                    await page
                        .getByRole("button", { name: "Retry", exact: true })
                        .click();
                }
            });

for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"]) {
        test(`audit attributes ${width} ${theme}: heading, search and edit portal`, async ({
            page,
        }, info) => {
            await page.setViewportSize({ width, height: 1000 });
            await page.goto("/?screen=attributes");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", {
                    level: 1,
                    name: "Attributes",
                    exact: true,
                })
            ).toHaveCSS("font-family", /Georgia/);
            const search = page.getByRole("searchbox");
            await search.fill("not-found");
            await expect(page.getByText("No Results.")).toBeVisible();
            await search.fill("");
            const edit = page.getByRole("button", {
                name: "Open menu for Material",
                exact: true,
            });
            await edit.focus();
            await expect(edit).toHaveCSS("outline-style", "solid");
            expect((await edit.boundingBox())!.height).toBeGreaterThanOrEqual(
                44
            );
            await edit.press("Enter");
            await page.getByRole("menuitem", { name: "Edit details" }).click();
            const dialog = page.getByRole("dialog");
            await expect(dialog.getByLabel("Key")).toBeDisabled();
            await expect(dialog).toHaveCSS("color-scheme", theme);
            expect(
                (
                    await new AxeBuilder({ page })
                        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                        .analyze()
                ).violations
            ).toEqual([]);
            await page.screenshot({
                path: info.outputPath(`audit-attributes-${width}-${theme}.png`),
                fullPage: true,
            });
            await page.keyboard.press("Escape");
            await expect(edit).toBeFocused();
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth
                )
            ).toBe(true);
            await page.goto("/?screen=attributes&failure");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await page
                .getByRole("button", { name: "Open menu for Material" })
                .click();
            await page.getByRole("menuitem", { name: "Edit details" }).click();
            await dialog.getByLabel("Display name").fill("Material updated");
            await dialog
                .getByRole("button", { name: "Save attribute information" })
                .click();
            await expect(dialog.getByLabel("Display name")).toBeDisabled();
            await page.keyboard.press("Escape");
            await expect(dialog).toBeVisible();
            await expect(dialog.getByRole("alert")).toContainText(
                "input has been kept"
            );
            await expect(dialog.getByLabel("Display name")).toHaveValue(
                "Material updated"
            );
            await dialog
                .getByRole("button", { name: "Save attribute information" })
                .click();
            await expect(dialog.getByRole("status")).toHaveText(
                "Changes saved."
            );
            expect(
                (
                    await new AxeBuilder({ page })
                        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                        .analyze()
                ).violations
            ).toEqual([]);
            await page.keyboard.press("Escape");
            await page.goto("/?screen=attributes&empty");
            await expect(page.getByText("No Results.")).toBeVisible();
            await page.goto("/?screen=attributes&fetcherror");
            await expect(page.getByRole("alert")).toContainText(
                "Could not load attributes"
            );
            await expect(
                page.getByRole("button", { name: "Retry" })
            ).toBeVisible();
        });
    }

for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"]) {
        test(`audit newattribute ${width} ${theme}: creation validation and retry`, async ({
            page,
        }, info) => {
            await page.setViewportSize({ width, height: 1000 });
            await page.goto("/?screen=newattribute&failure");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", {
                    level: 1,
                    name: "Create attribute",
                    exact: true,
                })
            ).toHaveCSS("font-family", /Georgia/);
            const form = page.getByRole("form", {
                name: "Attribute information",
            });
            await form
                .getByRole("button", { name: "Create attribute" })
                .click();
            await expect(
                page.getByText("Category is required.", { exact: true })
            ).toBeVisible();
            await form
                .getByLabel("Category", { exact: true })
                .selectOption("cat-1");
            await form.getByLabel("Key", { exact: true }).fill("material");
            await form.getByLabel("Display name").fill("Material");
            await form.getByLabel("Type", { exact: true }).selectOption("ENUM");
            await form
                .getByLabel("Scope", { exact: true })
                .selectOption("VARIANT");
            await form.getByRole("checkbox", { name: "Multi-valued" }).check();
            await form
                .getByRole("button", { name: "Create attribute" })
                .click();
            await expect(form.getByLabel("Display name")).toBeDisabled();
            await expect(page.getByRole("alert")).toContainText(
                "input has been kept"
            );
            await expect(form.getByLabel("Display name")).toHaveValue(
                "Material"
            );
            await form
                .getByRole("button", { name: "Create attribute" })
                .click();
            await expect(page.getByRole("status")).toContainText(
                "Changes saved"
            );
            expect(
                await page.evaluate(
                    () =>
                        (window as unknown as { destination: string })
                            .destination
                )
            ).toBe("/dashboard/admin/attributes");
            expect(
                (
                    await new AxeBuilder({ page })
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
                    `audit-newattribute-${width}-${theme}.png`
                ),
                fullPage: true,
            });
        });
    }

for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"]) {
        test(`audit attributeoptions ${width} ${theme}: option form and edit portal`, async ({
            page,
        }, info) => {
            await page.setViewportSize({ width, height: 1000 });
            await page.goto("/?screen=attributeoptions&failure");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", {
                    level: 1,
                    name: "Material options",
                    exact: true,
                })
            ).toHaveCSS("font-family", /Georgia/);
            const form = page.getByRole("form", {
                name: "Attribute option information",
            });
            await expect(form).toBeVisible();
            await form.getByRole("button", { name: "Add option" }).click();
            await expect(
                form.getByText("Label is required.", { exact: true })
            ).toBeVisible();
            await form.getByLabel("Value", { exact: true }).fill("silk");
            await form.getByLabel("Label", { exact: true }).fill("Silk");
            await form.getByRole("button", { name: "Add option" }).click();
            await expect(
                form.getByLabel("Label", { exact: true })
            ).toBeDisabled();
            await expect(page.getByRole("alert")).toContainText(
                "input has been kept"
            );
            await expect(form.getByLabel("Label", { exact: true })).toHaveValue(
                "Silk"
            );
            await form.getByRole("button", { name: "Add option" }).click();
            await expect(page.getByRole("status")).toContainText(
                "Changes saved"
            );
            await expect(form.getByLabel("Value", { exact: true })).toHaveValue(
                ""
            );
            await expect(form.getByLabel("Sort order")).toHaveValue("1");
            const trigger = page.getByRole("button", {
                name: "Open menu for Linen",
            });
            await trigger.click();
            await page.getByRole("menuitem", { name: "Edit label" }).click();
            const dialog = page.getByRole("dialog");
            await expect(
                dialog.getByLabel("Value", { exact: true })
            ).toBeDisabled();
            await expect(dialog).toHaveCSS("color-scheme", theme);
            await dialog
                .getByLabel("Label", { exact: true })
                .fill("Linen updated");
            await dialog.getByRole("button", { name: "Save option" }).click();
            await expect(
                dialog.getByLabel("Label", { exact: true })
            ).toBeDisabled();
            await page.keyboard.press("Escape");
            await expect(dialog).toBeVisible();
            await expect(dialog.getByRole("status")).toContainText(
                "Changes saved"
            );
            expect(
                (
                    await new AxeBuilder({ page })
                        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                        .analyze()
                ).violations
            ).toEqual([]);
            await page.screenshot({
                path: info.outputPath(
                    `audit-attributeoptions-${width}-${theme}.png`
                ),
                fullPage: true,
            });
            await page.keyboard.press("Escape");
            await expect(trigger).toBeFocused();
            await trigger.click();
            await page
                .getByRole("menuitem", { name: "Archive", exact: true })
                .click();
            await expect(
                page.getByRole("status").filter({ hasText: "Option archived" })
            ).toBeVisible();
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth
                )
            ).toBe(true);
            await page.goto("/?screen=attributeoptions&archived");
            await expect(
                page.getByRole("form", { name: "Attribute option information" })
            ).toHaveCount(0);
            await expect(page.getByRole("searchbox")).toBeVisible();
            await page.goto("/?screen=attributeoptions&empty");
            await expect(page.getByText("No Results.")).toBeVisible();
        });
    }

test("audit attribute touch: forms, create and portal close have 44px targets", async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.goto("/?screen=attributes");
    const create = page.getByRole("button", {
        name: "Create attribute",
        exact: true,
    });
    expect((await create.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await create.click();
    const dialog = page.getByRole("dialog");
    const card = dialog
        .getByRole("form", { name: "Attribute information" })
        .locator("..")
        .locator("..");
    await expect(card).toHaveCSS("box-shadow", "none");
    await expect(card).toHaveCSS("border-radius", "3px");
    const controls = dialog.locator(
        'button:not([role="checkbox"]), input:not([type="checkbox"]), select'
    );
    for (const control of await controls.all()) {
        const box = await control.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        expect(box!.width).toBeGreaterThanOrEqual(44);
    }
    for (const name of ["Required", "Facetable", "Multi-valued"]) {
        const label = dialog
            .locator("label")
            .filter({ hasText: new RegExp(`^${name}$`) });
        expect((await label.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        expect((await label.boundingBox())!.width).toBeGreaterThanOrEqual(44);
    }
    await dialog
        .getByRole("button", { name: "Close", exact: true })
        .press("Escape");
    await page.goto("/?screen=attributeoptions");
    const add = page.getByRole("button", { name: "Add option", exact: true });
    expect((await add.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});
