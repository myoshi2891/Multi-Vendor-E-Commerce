import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const screens = [{ screen: "categories", title: "Categories" }];
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
                if (entry.screen === "categories") {
                    await page.getByRole("searchbox").fill("not-a-category");
                    await expect(page.getByText("No Results.")).toBeVisible();
                    await page.getByRole("searchbox").fill("Shoes");
                    await page.goto("/?screen=categories&loadfailure&failure");
                    await page.evaluate(
                        (dark) =>
                            document.documentElement.classList.toggle(
                                "dark",
                                dark
                            ),
                        theme === "dark"
                    );
                    const edit = page.getByRole("button", {
                        name: "Edit category Shoes",
                        exact: true,
                    });
                    await edit.click();
                    const dialog = page.getByRole("dialog");
                    await expect(dialog.getByRole("alert")).toBeVisible();
                    await dialog
                        .getByRole("button", { name: "Retry load" })
                        .click();
                    await expect(
                        dialog.getByLabel("Category name")
                    ).toHaveValue("Shoes");
                    await dialog
                        .getByLabel("Category name")
                        .fill("Edited shoes");
                    await dialog
                        .getByRole("button", {
                            name: "Save category information",
                        })
                        .click();
                    await expect(
                        dialog.getByLabel("Category name")
                    ).toBeDisabled();
                    await page.keyboard.press("Escape");
                    await expect(dialog).toBeVisible();
                    await expect(dialog.getByRole("alert")).toBeVisible();
                    await expect(
                        dialog.getByLabel("Category name")
                    ).toHaveValue("Edited shoes");
                    await dialog
                        .getByRole("button", {
                            name: "Save category information",
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
                    await page
                        .getByRole("button", {
                            name: "Delete category Shoes",
                            exact: true,
                        })
                        .click();
                    await page
                        .getByRole("button", { name: "Cancel", exact: true })
                        .click();
                    await expect(page.getByRole("dialog")).not.toBeVisible();
                    await page.goto("/?screen=categories&empty");
                    await expect(page.getByText("No Results.")).toBeVisible();
                    await page.goto("/?screen=categories&fetcherror");
                    await expect(page.getByRole("alert")).toBeVisible();
                    await page
                        .getByRole("button", { name: "Retry", exact: true })
                        .click();
                }
            });
