import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"]) {
        test(`shell ${width} ${theme}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", { name: "Store overview" })
            ).toBeVisible();
            expect(
                await page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth
                )
            ).toBe(true);
            await expect(page.getByRole("heading", { level: 1 })).toHaveCSS(
                "font-family",
                /Georgia/
            );
            if (width === 390) {
                const toggle = page.getByRole("button", {
                    name: "Store navigation",
                });
                await toggle.focus();
                await page.keyboard.press("Enter");
                await expect(toggle).toHaveAttribute("aria-expanded", "true");
                await page
                    .getByRole("link", { name: "Products", exact: true })
                    .focus();
                await page.keyboard.press("Escape");
                await expect(toggle).toBeFocused();
                await expect(toggle).toHaveAttribute("aria-expanded", "false");
            }
            await page.getByRole("button", { name: "Toggle theme" }).click();
            await page
                .getByRole("menuitem", {
                    name: theme === "dark" ? "Light" : "Dark",
                    exact: true,
                })
                .click();
            await expect(page.locator("html")).toHaveClass(
                theme === "dark" ? /^$/ : /dark/
            );
            await expect(page.locator("#root")).not.toHaveAttribute(
                "aria-hidden",
                "true"
            );
            await expect(page.getByRole("menu")).toHaveCount(0);
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            const violations = (
                await new AxeBuilder({ page })
                    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                    .analyze()
            ).violations;
            expect(violations).toEqual([]);
            await page.evaluate(() => {
                window.scrollTo(0, 0);
                document.querySelectorAll('[role="dialog"]').forEach((node) => {
                    node.scrollTop = 0;
                });
            });
            await page.screenshot({
                path: info.outputPath(`seven-shell-${width}-${theme}.png`),
                fullPage: true,
            });
        });
    }

for (const width of [1440, 768, 390])
    test(`settings ${width}`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/?screen=settings");
        await expect(
            page.getByRole("heading", { name: "Account settings" })
        ).toHaveCSS("font-family", /Georgia/);
        await expect(
            page.getByRole("region", { name: "Account settings" })
        ).toHaveCSS("background-color", "rgb(243, 240, 232)");
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
            path: info.outputPath(`seven-settings-${width}.png`),
            fullPage: true,
        });
    });

for (const width of [1440, 768, 390])
    test(`apply ${width}`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/?screen=apply");
        await expect(
            page.getByRole("heading", { name: "Become a seller" })
        ).toHaveCSS("font-family", /Georgia/);
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await expect(page.getByText("Choose a logo image.")).toBeVisible();
        await page
            .getByRole("button", { name: "Upload profile image" })
            .click();
        await page.getByRole("button", { name: "Upload cover image" }).click();
        await page
            .getByRole("textbox", { name: "Store name", exact: true })
            .fill("Example Store");
        await page
            .getByRole("textbox", { name: "Store description", exact: true })
            .fill(
                "A detailed description of our example store for this fixture."
            );
        await page
            .getByRole("textbox", { name: "Store URL", exact: true })
            .fill("example-store");
        await page
            .getByRole("textbox", { name: "Store email", exact: true })
            .fill("test@example.com");
        await page
            .getByRole("textbox", { name: "Store phone", exact: true })
            .fill("1234567890");
        await page.getByRole("button", { name: "Previous" }).click();
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await expect(
            page.getByRole("textbox", { name: "Store name", exact: true })
        ).toHaveValue("Example Store");
        await page.getByRole("button", { name: "Next", exact: true }).click();
        await page
            .getByRole("textbox", { name: "Shipping service" })
            .fill("International Delivery");
        await page
            .getByRole("textbox", { name: "Return policy" })
            .fill("Return within 30 days");
        await page.getByRole("button", { name: "Submit", exact: true }).click();
        await expect(
            page.getByRole("button", { name: "Submitting…" })
        ).toBeDisabled();
        await expect(page.getByRole("alert")).toContainText("Please try again");
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
            path: info.outputPath(`seven-apply-${width}.png`),
            fullPage: true,
        });
        await page.getByRole("button", { name: "Submit", exact: true }).click();
        await expect(
            page.getByRole("heading", { name: "Your store has been created!" })
        ).toBeVisible();
        await expect(
            page.getByRole("link", { name: "Back to home" })
        ).toHaveAttribute("href", "/");
        expect(
            (
                await new AxeBuilder({ page })
                    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                    .analyze()
            ).violations
        ).toEqual([]);
    });

for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"])
        test(`overview ${width} ${theme}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/?screen=overview");
            await page.evaluate(
                (dark) =>
                    document.documentElement.classList.toggle("dark", dark),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", { name: "店舗ダッシュボード" })
            ).toBeVisible();
            await expect(page.getByText("$1,234.50")).toBeVisible();
            await expect(page.locator(".recharts-surface")).toBeVisible();
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
            await page.evaluate(() => {
                window.scrollTo(0, 0);
                document.querySelectorAll('[role="dialog"]').forEach((node) => {
                    node.scrollTop = 0;
                });
            });
            await page.screenshot({
                path: info.outputPath(`seven-overview-${width}-${theme}.png`),
                fullPage: true,
            });
            await page.goto("/?screen=overview&empty=1");
            await expect(
                page.getByText("売上データがありません。")
            ).toBeVisible();
        });

for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"])
        test(`products ${width} ${theme}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/?screen=products");
            await page.evaluate(
                (d) => document.documentElement.classList.toggle("dark", d),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", { name: "Products", exact: true })
            ).toBeVisible();
            await expect(page.getByText("M · 3 · $12.50")).toBeVisible();
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
                ).violations.map((v) => ({
                    id: v.id,
                    nodes: v.nodes.map((n) => ({
                        html: n.html,
                        failure: n.failureSummary,
                    })),
                }))
            ).toEqual([]);
            await page.evaluate(() => {
                window.scrollTo(0, 0);
                document.querySelectorAll('[role="dialog"]').forEach((node) => {
                    node.scrollTop = 0;
                });
            });
            await page.screenshot({
                path: info.outputPath(`seven-products-${width}-${theme}.png`),
                fullPage: true,
            });
            await page.getByRole("searchbox").fill("unmatched");
            await expect(page.getByText("No Results.")).toBeVisible();
            await page.getByRole("searchbox").fill("");
            await page.getByRole("button", { name: /Actions for/ }).click();
            await page
                .getByRole("menuitem", { name: "Delete product" })
                .click();
            const dialog = page.getByRole("alertdialog", {
                name: "Delete product",
            });
            await expect(dialog).toBeVisible();
            await dialog
                .getByRole("button", { name: "Delete", exact: true })
                .click();
            await expect(
                dialog.getByRole("button", { name: "Deleting…" })
            ).toBeDisabled();
            await expect(dialog.getByRole("alert")).toContainText(
                "Please try again"
            );
            expect(
                (
                    await new AxeBuilder({ page })
                        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                        .analyze()
                ).violations.map((v) => ({
                    id: v.id,
                    nodes: v.nodes.map((n) => ({
                        html: n.html,
                        failure: n.failureSummary,
                    })),
                }))
            ).toEqual([]);
            await dialog.getByRole("button", { name: "Cancel" }).click();
            await expect(dialog).toHaveCount(0);
            const create = page.getByRole("button", {
                name: "Create New Product",
            });
            await create.click();
            await expect(
                page.getByRole("dialog", { name: "Create product" })
            ).toBeVisible();
            expect(
                (
                    await new AxeBuilder({ page })
                        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                        .analyze()
                ).violations.map((v) => ({
                    id: v.id,
                    nodes: v.nodes.map((n) => ({
                        html: n.html,
                        failure: n.failureSummary,
                    })),
                }))
            ).toEqual([]);
            await page.keyboard.press("Escape");
            await expect(page.getByRole("dialog")).toHaveCount(0);
            await expect(create).toBeFocused();
        });

for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"])
        test(`inventory ${width} ${theme}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/?screen=inventory");
            await page.evaluate(
                (d) => document.documentElement.classList.toggle("dark", d),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", { name: "Inventory", exact: true })
            ).toBeVisible();
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
            await page.evaluate(() => {
                window.scrollTo(0, 0);
                document.querySelectorAll('[role="dialog"]').forEach((node) => {
                    node.scrollTop = 0;
                });
            });
            await page.screenshot({
                path: info.outputPath(`seven-inventory-${width}-${theme}.png`),
                fullPage: true,
            });
            for (const label of ["在庫数", "過小在庫しきい値"]) {
                const editor = page
                    .getByRole("group", { name: `${label}の編集` })
                    .first();
                await editor.getByLabel(label, { exact: true }).fill("-1");
                await editor
                    .getByRole("button", { name: "保存", exact: true })
                    .click();
                await expect(editor.getByRole("alert")).toContainText("整数");
                await editor.getByLabel(label, { exact: true }).fill("10");
                await editor
                    .getByRole("button", { name: "保存", exact: true })
                    .click();
                await expect(
                    editor.getByRole("button", { name: "保存中…" })
                ).toBeDisabled();
                await expect(editor.getByRole("alert")).toContainText("失敗");
                await editor.getByRole("button", { name: "再試行" }).click();
                await expect(editor.getByRole("status")).toContainText(
                    "更新しました"
                );
                await expect(
                    editor.getByLabel(label, { exact: true })
                ).toHaveValue("10");
            }
            expect(
                (
                    await new AxeBuilder({ page })
                        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                        .analyze()
                ).violations
            ).toEqual([]);
            await page.getByRole("searchbox").fill("unmatched");
            await expect(page.getByText("No Results.")).toBeVisible();
        });

for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"])
        test(`orders ${width} ${theme}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/?screen=orders");
            await page.evaluate(
                (d) => document.documentElement.classList.toggle("dark", d),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", { name: "Orders", exact: true })
            ).toBeVisible();
            await expect(
                page.getByText("$19.90", { exact: true })
            ).toBeVisible();
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
            await page.evaluate(() => {
                window.scrollTo(0, 0);
                document.querySelectorAll('[role="dialog"]').forEach((node) => {
                    node.scrollTop = 0;
                });
            });
            await page.screenshot({
                path: info.outputPath(`seven-orders-${width}-${theme}.png`),
                fullPage: true,
            });
            const editor = page.getByRole("group", {
                name: "Order status order-1 editor",
            });
            await editor
                .getByLabel("Order status order-1", { exact: true })
                .selectOption("Processing");
            await editor.getByRole("button", { name: "Save status" }).click();
            await expect(
                editor.getByRole("button", { name: "Saving…" })
            ).toBeDisabled();
            await expect(editor.getByRole("alert")).toContainText("try again");
            await editor.getByRole("button", { name: "Retry" }).click();
            await expect(editor.getByRole("status")).toHaveText(
                "Status updated."
            );
            const view = page.getByRole("button", {
                name: "View order order-1",
            });
            await view.click();
            const dialog = page.getByRole("dialog", { name: "Order details" });
            await expect(dialog).toBeVisible();
            await expect(
                dialog.getByText("buyer@example.test", { exact: false })
            ).toBeVisible();
            const item = dialog.getByRole("group", {
                name: "Item status item-1 editor",
            });
            await item
                .getByLabel("Item status item-1", { exact: true })
                .selectOption("Shipped");
            await item.getByRole("button", { name: "Save status" }).click();
            await expect(item.getByRole("alert")).toContainText("try again");
            await item.getByRole("button", { name: "Retry" }).click();
            await expect(item.getByRole("status")).toHaveText(
                "Status updated."
            );
            expect(
                (
                    await new AxeBuilder({ page })
                        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                        .analyze()
                ).violations
            ).toEqual([]);
            await page.evaluate(() => {
                window.scrollTo(0, 0);
                document.querySelectorAll('[role="dialog"]').forEach((node) => {
                    node.scrollTop = 0;
                });
            });
            await page.screenshot({
                path: info.outputPath(
                    `seven-order-details-${width}-${theme}.png`
                ),
                fullPage: true,
            });
            await page.keyboard.press("Escape");
            await expect(dialog).toHaveCount(0);
            await expect(view).toBeFocused();
            await page.getByRole("searchbox").fill("unmatched");
            await expect(page.getByText("No Results.")).toBeVisible();
        });

for (const width of [1440, 768, 390])
    for (const theme of ["light", "dark"])
        test(`messages ${width} ${theme}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/?screen=messages");
            await page.evaluate(
                (d) => document.documentElement.classList.toggle("dark", d),
                theme === "dark"
            );
            await expect(
                page.getByRole("heading", { name: "Messages", exact: true })
            ).toBeVisible();
            const open = page.getByRole("button", {
                name: /Open conversation with/,
            });
            await open.focus();
            await page.keyboard.press("Enter");
            await expect(
                page.getByRole("button", { name: "Retry messages" })
            ).toBeVisible();
            await page
                .getByRole("button", { name: "Retry read status" })
                .click();
            await page.getByRole("button", { name: "Retry messages" }).click();
            await expect(
                page.getByRole("log").getByText("Hello from the buyer")
            ).toBeVisible();
            const draft = page.getByRole("textbox", { name: "Your message" });
            await page
                .getByRole("button", { name: "Send", exact: true })
                .click();
            await expect(page.getByRole("alert")).toContainText(
                "メッセージを入力"
            );
            await draft.fill("Reply from seller");
            await page
                .getByRole("button", { name: "Send", exact: true })
                .click();
            await expect(
                page.getByRole("button", { name: "Sending…", exact: true })
            ).toBeDisabled();
            await expect(page.getByRole("alert")).toContainText(
                "draft is saved"
            );
            await expect(draft).toHaveValue("Reply from seller");
            await page
                .getByRole("button", { name: "Send", exact: true })
                .click();
            await expect(draft).toHaveValue("");
            await expect(
                page.getByRole("log").getByText("Reply from seller")
            ).toBeVisible();
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
            await page.evaluate(() => {
                window.scrollTo(0, 0);
                document.querySelectorAll('[role="dialog"]').forEach((node) => {
                    node.scrollTop = 0;
                });
            });
            await page.screenshot({
                path: info.outputPath(`seven-messages-${width}-${theme}.png`),
                fullPage: true,
            });
            if (width <= 1000) {
                await expect(open).toBeHidden();
                await page
                    .getByRole("button", { name: "Back to conversations" })
                    .click();
                await expect(open).toBeFocused();
            }
            await page.goto("/?screen=messages&empty=1");
            await expect(
                page.getByRole("heading", { name: "No conversations yet" })
            ).toBeVisible();
            await page.goto("/?screen=messages&error=1");
            await expect(page.getByRole("alert")).toContainText("try again");
            await page
                .getByRole("button", { name: "Try again", exact: true })
                .click();
            await expect(
                page.getByRole("button", { name: /Open conversation with/ })
            ).toBeVisible();
        });

for (const width of [1440, 768, 767, 390]) {
    test(`settings token adapter at ${width}`, async ({page}, info) => {
        await page.setViewportSize({width, height: 1000});
        await page.goto("/?screen=settings");
        const settings = page.getByRole("region", {name: "Account settings"});
        // This adapter consumes production appearance; it does not prove real Clerk lifecycle.
        await expect(page.getByRole("region", {name: "Clerk fixture"})).toHaveAttribute("data-routing", "hash");
        await settings.evaluate(root => {
            (root as HTMLElement).style.setProperty("--purchase-link", "#604a2b");
            (root as HTMLElement).style.setProperty("--purchase-input", "#fffdf7");
        });
        const save = page.getByRole("button", {name: "Save profile"});
        await expect(save).toHaveCSS("background-color", "rgb(96, 74, 43)");
        await expect(page.getByRole("textbox", {name: "Name"})).toHaveCSS("background-color", "rgb(255, 253, 247)");
        await settings.evaluate(root => (root as HTMLElement).removeAttribute("style"));
        await save.focus();
        await expect(save).toHaveCSS("outline-style", "solid");
        const box = await save.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
        await expect(page.getByRole("button", {name: "Delete account"})).toHaveCSS("color", "rgb(138, 48, 40)");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        expect((await new AxeBuilder({page}).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
        await page.screenshot({path: info.outputPath(`settings-p2-${width}.png`), fullPage: true});
        await page.goto("/?screen=settings&portal");
        const portal = page.getByRole("region", {name: "Clerk portal adapter"});
        await expect(portal).toHaveCSS("background-color", "rgb(248, 246, 239)");
        await expect(portal.getByRole("button")).toHaveCSS("background-color", "rgb(117, 97, 59)");
        await portal.getByRole("button").focus();
        await expect(portal.getByRole("button")).toHaveCSS("outline-style", "solid");
        await page.emulateMedia({reducedMotion: "reduce"});
        await expect(portal.getByRole("button")).toHaveCSS("animation-name", "none");
    });
}

// Residual adoption: production shell and controls, using the existing seven harness.
import { touchControl, sellerEvidence } from "./seller-eight-assertions";
for (const width of [390, 767])
    for (const theme of ["light", "dark"])
        test(`residual foundation ${width} ${theme}`, async ({ page }, info) => {
            await page.setViewportSize({ width, height: 900 });
            await page.goto("/");
            await page.evaluate(dark => document.documentElement.classList.toggle("dark", dark), theme === "dark");
            const toggle = page.getByRole("button", { name: "Store navigation" });
            await touchControl(toggle);
            await touchControl(page.getByRole("button", { name: "Toggle theme" }), true);
            await toggle.focus();
            await page.keyboard.press("Enter");
            await expect(toggle).toHaveAttribute("aria-expanded", "true");
            await page.getByRole("link", { name: "Products", exact: true }).focus();
            await page.keyboard.press("Escape");
            await expect(toggle).toBeFocused();
            await expect(toggle).toHaveCSS("outline-style", "solid");
            await page.getByRole("button", { name: "Toggle theme" }).click();
            for (const name of ["Light", "Dark", "System"]) await touchControl(page.getByRole("menuitem", { name, exact: true }));
            await page.keyboard.press("Escape");
            await expect(page.locator("#root")).not.toHaveAttribute("aria-hidden", "true");
            await sellerEvidence(page, info);
        });
