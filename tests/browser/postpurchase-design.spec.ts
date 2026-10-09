import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("overview recovery follows touch and focus tokens", async ({ page }) => {
    await page.goto("/?screen=overview&state=error");
    await expect(page.getByRole("alert")).toBeVisible();
    await page.locator("[data-postpurchase-shell]").evaluate((root) => {
        const style = (root as HTMLElement).style;
        style.setProperty("--purchase-touch", "52px");
        style.setProperty("--purchase-link", "#604a2b");
        style.setProperty("--purchase-focus", "#604a2b");
    });
    const reload = page.getByRole("link", { name: "Reload account" });
    await expect(reload).toHaveCSS("min-height", "52px");
    await expect(reload).toHaveCSS("color", "rgb(96, 74, 43)");
    await page.keyboard.press("Tab");
    await reload.focus();
    await expect(reload).toHaveCSS("outline-color", "rgb(96, 74, 43)");
});

for (const width of [1440, 768, 390]) {
    test(`overview states at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?screen=overview");
        await expect(
            page.getByRole("heading", { name: "My account", level: 1 })
        ).toHaveCSS("font-family", /Georgia/);
        await expect(
            page.getByText("Coming soon", { exact: true })
        ).toHaveCount(2);
        await expect(
            page.getByRole("link", { name: /Coupons|Shopping credit/ })
        ).toHaveCount(0);
        await page
            .locator("[data-postpurchase-shell]")
            .evaluate((root) =>
                (root as HTMLElement).style.setProperty(
                    "--purchase-panel",
                    "#fffdf7"
                )
            );
        await expect(page.getByRole("region", { name: /Mina Mori/ })).toHaveCSS(
            "background-color",
            "rgb(255, 253, 247)"
        );
        await page
            .locator("[data-postpurchase-shell]")
            .evaluate((root) =>
                (root as HTMLElement).style.removeProperty("--purchase-panel")
            );
        for (const link of await page.getByRole("link").all()) {
            expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(
                44
            );
        }
        const orders = page.getByRole("link", { name: /View all orders/ });
        await orders.focus();
        await expect(orders).toHaveCSS("outline-style", "solid");
        await expect(
            page.getByRole("link", { name: /Unpaid/ })
        ).toHaveAttribute("href", "/profile/orders/unpaid");
        await accessible(page);
        await page.screenshot({
            path: info.outputPath(`overview-${width}.png`),
            fullPage: true,
        });
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/\/profile\/orders$/);
        await page.goto("/?screen=overview&state=error");
        const reload = page.getByRole("link", { name: "Reload account" });
        expect((await reload.boundingBox())?.height).toBeGreaterThanOrEqual(44);
        await accessible(page);
    });
}

test("messages follows shared tokens", async ({ page }) => {
    await page.goto("/?screen=messages");
    await page
        .getByRole("button", { name: "Open conversation with Garden Store" })
        .click();
    await expect(
        page.getByRole("textbox", { name: "Your message" })
    ).toBeEnabled();
    await page.locator("[data-postpurchase-shell]").evaluate((root) => {
        const style = (root as HTMLElement).style;
        style.setProperty("--purchase-panel", "#fffdf7");
        style.setProperty("--purchase-link", "#604a2b");
        style.setProperty("--purchase-gold", "#dfc38e");
        style.setProperty("--purchase-focus", "#604a2b");
        style.setProperty("--purchase-touch", "52px");
    });
    await expect(page.getByRole("link", { name: "Need a hand? →" })).toHaveCSS(
        "color",
        "rgb(96, 74, 43)"
    );
    const send = page.getByRole("button", { name: "Send", exact: true });
    await expect(send).toHaveCSS("background-color", "rgb(223, 195, 142)");
    await expect(send).toHaveCSS("min-height", "52px");
    await page.keyboard.press("Tab");
    await send.focus();
    await expect(send).toHaveCSS("outline-color", "rgb(96, 74, 43)");
});

for (const width of [1440, 768, 390]) {
    test(`messages states at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?screen=messages&state=retry");
        await page
            .getByRole("button", {
                name: "Open conversation with Garden Store",
            })
            .click();
        await expect(page.getByRole("alert")).toBeVisible();
        await page.getByRole("button", { name: "Retry messages" }).click();
        await expect(
            page.getByRole("textbox", { name: "Your message" })
        ).toBeEnabled();
        await accessible(page);
        await page
            .getByRole("textbox", { name: "Your message" })
            .fill("Thank you for the lovely scarf");
        const send = page.getByRole("button", { name: "Send", exact: true });
        await page.keyboard.press("Tab");
        await send.focus();
        await expect(send).toHaveCSS("outline-style", "solid");
        await page.keyboard.press("Enter");
        await expect(
            page.getByRole("button", { name: "Sending…", exact: true })
        ).toBeDisabled();
        await expect(page.getByRole("alert")).toContainText(
            "Your draft is saved"
        );
        await expect(
            page.getByRole("textbox", { name: "Your message" })
        ).toHaveValue("Thank you for the lovely scarf");
        await accessible(page);
        await send.click();
        await expect(
            page.getByRole("textbox", { name: "Your message" })
        ).toHaveValue("");
        await expect(
            page.getByText("Thank you for the lovely scarf", { exact: true })
        ).toBeVisible();
        await accessible(page);
        await page.screenshot({
            path: info.outputPath(`messages-${width}.png`),
            fullPage: true,
        });
        await page.goto("/?screen=messages&state=empty");
        await expect(
            page.getByRole("heading", { name: "No conversations yet" })
        ).toBeVisible();
        await accessible(page);
        await page.goto("/?screen=messages&state=error");
        await expect(page.getByRole("alert")).toBeVisible();
        await page.getByRole("button", { name: "Try again" }).click();
        await expect(page.getByRole("alert")).toHaveCount(0);
        await page.goto("/?screen=messages&state=pending");
        await page
            .getByRole("button", {
                name: "Open conversation with Garden Store",
            })
            .click();
        await page
            .getByRole("textbox", { name: "Your message" })
            .fill("Pending draft");
        await page.getByRole("button", { name: "Send", exact: true }).click();
        await expect(
            page.getByRole("textbox", { name: "Your message" })
        ).toBeDisabled();
        await expect(
            page.getByRole("button", {
                name: "Open conversation with Garden Store",
            })
        ).toBeDisabled();
        await accessible(page);
    });
}

test("addresses portal follows shared tokens", async ({ page }) => {
    await page.goto("/?screen=addresses");
    await page
        .getByRole("button", { name: "Edit address for Mina Mori" })
        .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Independent portals own their theme; override it on the rendered surface.
    await dialog.evaluate((root) => {
        (root as HTMLElement).style.setProperty("--purchase-panel", "#fffdf7");
        (root as HTMLElement).style.setProperty("--purchase-gold", "#dfc38e");
    });
    await expect(dialog).toHaveCSS("background-color", "rgb(255, 253, 247)");
    await expect(
        page.getByRole("button", { name: "Save address", exact: true })
    ).toHaveCSS("background-color", "rgb(223, 195, 142)");
});

for (const width of [1440, 768, 390]) {
    test(`addresses states at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/?screen=addresses&state=retry");
        const edit = page.getByRole("button", {
            name: "Edit address for Mina Mori",
        });
        await edit.click();
        await expect(
            page.getByRole("textbox", { name: "First name", exact: true })
        ).toHaveValue("Mina");
        await accessible(page);
        const save = page.getByRole("button", {
            name: "Save address",
            exact: true,
        });
        await page.keyboard.press("Tab");
        await save.focus();
        await expect(save).toHaveCSS("outline-style", "solid");
        await page.keyboard.press("Enter");
        await expect(
            page.getByRole("button", { name: "Saving address…" })
        ).toBeDisabled();
        await expect(page.getByRole("alert")).toContainText("couldn’t save");
        await expect(
            page.getByRole("textbox", { name: "First name", exact: true })
        ).toHaveValue("Mina");
        await accessible(page);
        await save.click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(edit).toBeFocused();
        await page
            .getByRole("button", { name: "Make default address for Mina Mori" })
            .click();
        await expect(page.getByRole("alert")).toContainText("couldn’t update");
        await page
            .getByRole("button", { name: "Make default address for Mina Mori" })
            .click();
        await expect(
            page.getByText("Default address", { exact: true })
        ).toBeVisible();
        await accessible(page);
        await page.screenshot({
            path: info.outputPath(`addresses-${width}.png`),
            fullPage: true,
        });
        await edit.click();
        await page.screenshot({
            path: info.outputPath(`addresses-dialog-${width}.png`),
            fullPage: true,
        });
        await page.keyboard.press("Escape");
        await expect(edit).toBeFocused();
        await page.goto("/?screen=addresses&state=empty");
        await accessible(page);
        await page.getByRole("button", { name: /Add.*address/i }).click();
        await page
            .getByRole("button", { name: "Save address", exact: true })
            .click();
        await expect(page.getByRole("alert")).toContainText(
            "highlighted fields"
        );
        await accessible(page);
        await page.goto("/?screen=addresses&state=error");
        await expect(page.getByRole("alert")).toBeVisible();
        await page.getByRole("button", { name: "Try again" }).click();
        await expect(page.getByRole("alert")).toHaveCount(0);
        await page.goto("/?screen=addresses&state=pending");
        await page
            .getByRole("button", { name: "Edit address for Mina Mori" })
            .click();
        await page
            .getByRole("button", { name: "Save address", exact: true })
            .click();
        await expect(
            page.getByRole("button", { name: "Saving address…" })
        ).toBeDisabled();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toBeVisible();
        await accessible(page);
    });
}

const screens = [
    { key: "orders", heading: "My orders", empty: "No orders yet" },
    { key: "payment", heading: "My payments", empty: "No payments yet" },
    { key: "reviews", heading: "My reviews", empty: "No reviews yet" },
];

async function accessible(page: Page) {
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
}

for (const screen of screens) {
    test(`${screen.key} follows shared tokens`, async ({ page }) => {
        await page.goto(`/?screen=${screen.key}`);
        await expect(
            page.getByRole("heading", { name: screen.heading, level: 1 })
        ).toBeVisible();
        await page.locator("[data-postpurchase-shell]").evaluate((root) => {
            const style = (root as HTMLElement).style;
            style.setProperty("--purchase-panel", "#fffdf7");
            style.setProperty("--purchase-gold", "#dfc38e");
            style.setProperty("--purchase-link", "#604a2b");
            style.setProperty("--purchase-focus", "#604a2b");
            style.setProperty("--purchase-touch", "52px");
        });
        await expect(
            page.getByRole("link", { name: "Need a hand? →" })
        ).toHaveCSS("color", "rgb(96, 74, 43)");
        await expect(
            page
                .getByRole("list", {
                    name:
                        screen.key === "orders"
                            ? "Your orders"
                            : screen.key === "payment"
                              ? "Your payments"
                              : "Your reviews",
                })
                .locator("li")
                .first()
        ).toHaveCSS("background-color", "rgb(255, 253, 247)");
        const search = page.getByRole("button", {
            name: "Search",
            exact: true,
        });
        await expect(search).toHaveCSS(
            "background-color",
            "rgb(223, 195, 142)"
        );
        await expect(search).toHaveCSS("color", "rgb(23, 37, 29)");
        await expect(search).toHaveCSS("min-height", "52px");
        await search.focus();
        await expect(search).toHaveCSS("outline-color", "rgb(96, 74, 43)");
    });

    for (const width of [1440, 768, 390]) {
        test(`${screen.key} states at ${width}px`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 1000 });
            await page.goto(`/?screen=${screen.key}`);
            await expect(
                page.getByRole("heading", { name: screen.heading, level: 1 })
            ).toHaveCSS("font-family", /Georgia/);
            await accessible(page);
            await page.screenshot({
                path: info.outputPath(`${screen.key}-${width}.png`),
                fullPage: true,
            });
            const search = page.getByRole("button", {
                name: "Search",
                exact: true,
            });
            await search.focus();
            await expect(search).toHaveCSS("outline-style", "solid");
            expect((await search.boundingBox())?.height).toBeGreaterThanOrEqual(
                44
            );
            await page.keyboard.press("Enter");
            await expect(search).toBeDisabled();
            await expect(search).toBeEnabled();
            await page.getByRole("button", { name: /Next/ }).click();
            await expect(page.getByText(/Page 2 of 3/).last()).toBeVisible();
            await accessible(page);
            await page.goto(`/?screen=${screen.key}&state=empty`);
            await expect(
                page.getByRole("heading", { name: screen.empty, exact: true })
            ).toBeVisible();
            await accessible(page);
            await page.goto(`/?screen=${screen.key}&state=error`);
            await expect(page.getByRole("alert")).toBeVisible();
            await accessible(page);
            await page.getByRole("button", { name: "Try again" }).click();
            await expect(page.getByRole("alert")).toHaveCount(0);
            await page.goto(`/?screen=${screen.key}&state=retry`);
            await page
                .getByRole("button", { name: "Search", exact: true })
                .click();
            await expect(page.getByRole("alert")).toBeVisible();
            await page.getByRole("button", { name: "Try again" }).click();
            await expect(page.getByRole("alert")).toHaveCount(0);
            await page.goto(`/?screen=${screen.key}&state=pending`);
            await page
                .getByRole("button", { name: "Search", exact: true })
                .click();
            await expect(page.getByRole("status")).toContainText("Loading");
            await accessible(page);
        });
    }
}
