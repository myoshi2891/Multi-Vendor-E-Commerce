import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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
