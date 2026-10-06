import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const screens = [
    { screen: "admincoupons", title: "Coupons" },
    { screen: "newcategory", title: "Create category" },
    { screen: "categories", title: "Categories" },
];
for (const entry of screens)
    for (const width of [1440, 768, 390])
        for (const theme of ["light", "dark"])
            test(`${entry.screen} ${width} ${theme}`, async ({
                page,
            }, info) => {
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
                    await form.getByRole("combobox").click();
                    await page
                        .getByRole("option", { name: "Shoes", exact: true })
                        .click();
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
                if (["categories", "admincoupons"].includes(entry.screen)) {
                    const category = entry.screen === "categories",
                        entity = category ? "category" : "coupon",
                        name = category ? "Shoes" : "WELCOME",
                        field = category ? "Category name" : "Coupon code",
                        edited = category ? "Edited shoes" : "EDITED",
                        saveButton = category
                            ? "Save category information"
                            : "Save coupon";
                    await page.getByRole("searchbox").fill("not-a-record");
                    await expect(page.getByText("No Results.")).toBeVisible();
                    await page.getByRole("searchbox").fill(name);
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
                            `category-dialog-${width}-${theme}.png`
                        ),
                        fullPage: true,
                    });
                    await page.keyboard.press("Escape");
                    await expect(edit).toBeFocused();
                    if (!category) {
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
                    await page.goto(`/?screen=${entry.screen}&empty`);
                    await expect(page.getByText("No Results.")).toBeVisible();
                    await page.goto(`/?screen=${entry.screen}&fetcherror`);
                    await expect(page.getByRole("alert")).toBeVisible();
                    await page
                        .getByRole("button", { name: "Retry", exact: true })
                        .click();
                }
            });
