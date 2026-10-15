import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expectReadableBorder, expectReadableFocus } from "./purchase-assertions";

for (const width of [1440, 768, 390]) {
    for (const route of ["/", "/browse", "/cart", "/compare"]) {
        test(`${route} ${width}: public route and shared header`, async ({
            page,
        }, info) => {
            test.skip(
                route === "/browse" && !process.env.E2E_DATABASE_URL,
                "Dedicated schema-current E2E database required for product-data acceptance."
            );
            test.setTimeout(45000);
            await page.setViewportSize({ width, height: 1000 });
            await page.goto(route);
            await expect(page.getByTestId("store-header")).toBeVisible();
            await expect(page.getByRole("main")).toBeVisible();
            if (route === "/compare") {
                await expect(page.getByRole("heading", { name: "Compare products" })).toBeVisible();
                await expect(page.getByTestId("compare-empty")).toBeVisible();
                await expectReadableFocus(page.getByRole("link", { name: "Explore the collection" }));
                for (const link of [
                    page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Home", exact: true }),
                    page.getByRole("link", { name: "Continue exploring" }),
                ]) {
                    const box = await link.boundingBox();
                    expect(box!.height).toBeGreaterThanOrEqual(44);
                    expect(box!.width).toBeGreaterThanOrEqual(44);
                    await expectReadableFocus(link);
                }
                expect((await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
            }
            await page.getByLabel("Account menu", { exact: true }).click();
            await expect(
                page.getByRole("link", { name: "Sign in", exact: true })
            ).toBeVisible();
            expect(
                (
                    await new AxeBuilder({ page })
                        .include("header")
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
                    `${route === "/" ? "home" : route.slice(1)}-${width}.png`
                ),
                fullPage: true,
            });
        });
    }
}
test("checkout guest sign-in preserves its return destination", async ({
    page,
}) => {
    await page.goto("/checkout");
    await expect(page).toHaveURL(
        (url) =>
            url.pathname === "/sign-in" &&
            url.searchParams.get("redirect_url") ===
                new URL("/checkout", url.origin).href
    );
});

test("wishlist guest sign-in preserves its return destination", async ({ page }) => {
    await page.goto("/profile/wishlist/1");
    await expect(page).toHaveURL(url => url.pathname === "/sign-in" &&
        url.searchParams.get("redirect_url") === new URL("/profile/wishlist/1", url.origin).href);
});

for (const width of [1440, 768, 390]) {
    test(`audit public ${width}: real browse, motion and product controls`, async ({
        page,
    }, info) => {
        test.setTimeout(120000);
        const inventoryPath = process.env.DESIGN_AUDIT_INVENTORY;
        test.skip(!inventoryPath, "Read-only DB inventory is required.");
        const inventory: Array<{ id: string; actualPath: string }> = JSON.parse(
            readFileSync(inventoryPath!, "utf8")
        );
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/browse");
        const nav = page.getByRole("navigation", { name: "Collection pages" });
        await expect(nav).toBeVisible();
        for (const button of await nav.getByRole("button").all()) {
            const box = await button.boundingBox();
            expect(box!.height).toBeGreaterThanOrEqual(44);
            expect(box!.width).toBeGreaterThanOrEqual(44);
        }
        await page.screenshot({
            path: info.outputPath(`audit-real-browse-${width}.png`),
            fullPage: true,
        });
        await page.goto("/");
        const motion = page.getByRole("button", { name: /motion reduced/ });
        await expect(motion).toBeDisabled();
        expect((await motion.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await page.screenshot({
            path: info.outputPath(`audit-real-home-${width}.png`),
            fullPage: true,
        });
        const productRow = inventory.find((row) => row.id === "DS-PAGE-019");
        expect(
            productRow,
            "inventory row DS-PAGE-019 is missing"
        ).toBeDefined();
        await page.goto(productRow!.actualPath);
        const category = page.getByRole("button", {
            name: "Browse categories",
        });
        await expect(category).toBeVisible();
        const controls = [
            category,
            page.getByRole("button", { name: "Copy product link" }),
            page.getByRole("button", { name: "Follow boutique" }),
        ];
        for (const control of controls.slice(0, 3)) {
            const box = await control.boundingBox();
            expect(box!.height).toBeGreaterThanOrEqual(44);
            expect(box!.width).toBeGreaterThanOrEqual(44);
        }
        await category.focus();
        await category.press("Enter");
        await expect(category).toHaveAttribute("aria-expanded", "true");
        await category.press("Escape");
        await expect(category).toBeFocused();
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth
            )
        ).toBe(true);
        await page.screenshot({
            path: info.outputPath(`audit-real-product-${width}.png`),
            fullPage: true,
        });
    });
}

// 店舗詳細と比較の通常データは実 DB の inventory（DS-PAGE-037）から辿る。比較は localStorage の選択を
// 実 getProductsByIds で解決するため、fixture では確認できない「実 API の商品を並べた状態」を受け入れる。
for (const width of [1440, 768, 390]) {
    test(`audit store ${width}: real store detail and compare with API data`, async ({
        page,
    }, info) => {
        test.setTimeout(120000);
        const inventoryPath = process.env.DESIGN_AUDIT_INVENTORY;
        test.skip(!inventoryPath, "Read-only DB inventory is required.");
        const inventory: Array<{ id: string; actualPath: string }> = JSON.parse(
            readFileSync(inventoryPath!, "utf8")
        );
        const storeRow = inventory.find((row) => row.id === "DS-PAGE-037");
        expect(storeRow, "inventory row DS-PAGE-037 is missing").toBeDefined();
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(storeRow!.actualPath);
        await expect(page.getByTestId("store-header")).toBeVisible();
        await expect(page.getByRole("main")).toBeVisible();
        const addButtons = page.getByRole("button", {
            name: "Add to compare",
            exact: true,
        });
        await expect(addButtons.first()).toBeVisible();
        expect(await addButtons.count()).toBeGreaterThanOrEqual(2);
        for (const button of (await addButtons.all()).slice(0, 2)) {
            const box = await button.boundingBox();
            expect(box!.height).toBeGreaterThanOrEqual(44);
            expect(box!.width).toBeGreaterThanOrEqual(44);
        }
        expect(
            (
                await new AxeBuilder({ page })
                    .include("main")
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
            path: info.outputPath(`audit-real-store-${width}.png`),
            fullPage: true,
        });

        // 押すたびに該当ボタンが Remove へ変わり first() が次の商品を指す
        for (let i = 0; i < 2; i++) {
            await addButtons.first().focus();
            await addButtons.first().press("Enter");
        }
        await expect(
            page.getByRole("button", { name: "Remove from compare", exact: true })
        ).toHaveCount(2);

        await page.goto("/compare");
        const selection = page.getByRole("region", { name: "Selected products" });
        await expect(selection.getByRole("article")).toHaveCount(2);
        await expect(page.getByText("2 of 4 selected")).toBeVisible();
        // 購入再監査: 実商品を並べた状態でも hero 導線が 44px を保つ
        for (const link of [
            page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Home", exact: true }),
            page.getByRole("link", { name: "Continue exploring" }),
        ]) {
            const box = await link.boundingBox();
            expect(box!.height).toBeGreaterThanOrEqual(44);
            expect(box!.width).toBeGreaterThanOrEqual(44);
            await expectReadableFocus(link);
        }
        for (const link of await selection
            .getByRole("link", { name: /^View / })
            .all()) {
            await expect(link).toHaveAttribute("href", /^\/product\//);
        }
        expect(
            (
                await new AxeBuilder({ page })
                    .include("main")
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
            path: info.outputPath(`audit-real-compare-${width}.png`),
            fullPage: true,
        });

        const remove = selection
            .getByRole("button", { name: "Remove from compare" })
            .first();
        await expectReadableFocus(remove);
        await remove.press("Enter");
        await expect(selection.getByRole("article")).toHaveCount(1);
        await expect(
            page.getByRole("heading", { name: "Your selection" })
        ).toBeFocused();
    });
}

// 購入再監査8の修正点（sort 境界・URL 保持、画像 modal の focus 制御）を実 DB の商品・店舗で受け入れる
for (const width of [1440, 768, 390]) {
    for (const colorScheme of ["light", "dark"] as const) {
        test(`reaudit real ${width} ${colorScheme}: sort boundary and enlarged image focus`, async ({
            page,
        }, info) => {
            test.setTimeout(120000);
            const inventoryPath = process.env.DESIGN_AUDIT_INVENTORY;
            test.skip(!inventoryPath, "Read-only DB inventory is required.");
            const inventory: Array<{ id: string; actualPath: string }> = JSON.parse(
                readFileSync(inventoryPath!, "utf8")
            );
            const pathOf = (id: string) => {
                const row = inventory.find((entry) => entry.id === id);
                expect(row, `inventory row ${id} is missing`).toBeDefined();
                return row!.actualPath;
            };
            await page.emulateMedia({ colorScheme });
            await page.setViewportSize({ width, height: 1000 });

            await page.goto("/browse?search=a");
            const browseSort = page.getByRole("button", { name: /^Sort by / });
            await expectReadableBorder(browseSort);
            await expectReadableFocus(browseSort);
            await browseSort.press("Enter");
            await page.getByRole("menuitemradio", { name: "New Arrivals" }).press("Enter");
            await expect(page).toHaveURL(/sort=new-arrivals/);
            expect(new URL(page.url()).searchParams.get("search")).toBe("a");
            await expect(browseSort).toBeFocused();
            await page.screenshot({ path: info.outputPath(`reaudit-real-browse-${width}-${colorScheme}.png`), fullPage: true });

            await page.goto(pathOf("DS-PAGE-037"));
            const storeSort = page.getByRole("button", { name: /^Sort by / });
            await expectReadableBorder(storeSort);
            await storeSort.hover();
            await expectReadableBorder(storeSort);
            await expectReadableFocus(storeSort);
            await storeSort.press("Enter");
            await page.getByRole("menuitemradio", { name: "Top Rated" }).press("Enter");
            await expect(page).toHaveURL(/sort=top-rated/);
            await expect(storeSort).toBeFocused();

            await page.goto(pathOf("DS-PAGE-019"));
            // 専用DBの商品画像は全件 /no_image のプレースホルダー。プレースホルダー選択中は拡大ボタンを
            // 出さない仕様（product-swiper.test.tsx）なので、実データで開けるときだけ modal を検証する
            const trigger = page.getByRole("button", { name: "Enlarge product image" });
            if ((await trigger.count()) === 0) {
                await expect(page.getByText("Product imagery coming soon")).toBeVisible();
                info.annotations.push({ type: "real-data-gap", description: "No non-placeholder product image in the dedicated DB; modal focus is covered by fixture/RTL." });
            } else {
                await trigger.focus();
                await trigger.press("Enter");
                const dialog = page.getByRole("dialog", { name: "Enlarged product image" });
                const close = dialog.getByRole("button", { name: "Close image" });
                await expect(close).toBeFocused();
                await page.keyboard.press("Tab");
                await expect(close).toBeFocused();
                await expectReadableFocus(close);
                await page.keyboard.press("Escape");
                await expect(dialog).toBeHidden();
                await expect(trigger).toBeFocused();
            }
            await page.screenshot({ path: info.outputPath(`reaudit-real-product-${width}-${colorScheme}.png`), fullPage: true });
            expect(
                (await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations
            ).toEqual([]);

            // カートは localStorage（Zustand persist）なので、実商品を在庫のあるサイズで入れてから確認する
            await page.locator("button[aria-pressed]:not([disabled])").first().click();
            await page.getByRole("button", { name: "Add to bag" }).click();
            await page.goto("/cart");
            const title = page.getByTestId("cart-item-name").first();
            await expect(title).toBeVisible();
            const box = await title.boundingBox();
            expect(box!.height).toBeGreaterThanOrEqual(44);
            expect(box!.width).toBeGreaterThanOrEqual(44);
            await expect(title).toHaveAttribute("href", /\/product\/.+\/.+\?size=/);
            await expectReadableFocus(title);
            expect(
                (await new AxeBuilder({ page }).include("main").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations
            ).toEqual([]);
            await page.screenshot({ path: info.outputPath(`reaudit-real-cart-${width}-${colorScheme}.png`), fullPage: true });
        });
    }
}

// 外部共有は遷移させず、各ボタンが実商品 URL を含む共有 URL を開こうとすることだけ確認する
test("audit product share: real URLs without leaving the site", async ({
    browser,
}) => {
    test.setTimeout(120000);
    const inventoryPath = process.env.DESIGN_AUDIT_INVENTORY;
    test.skip(!inventoryPath, "Read-only DB inventory is required.");
    const inventory: Array<{ id: string; actualPath: string }> = JSON.parse(
        readFileSync(inventoryPath!, "utf8")
    );
    const productRow = inventory.find((row) => row.id === "DS-PAGE-019");
    expect(productRow, "inventory row DS-PAGE-019 is missing").toBeDefined();
    const context = await browser.newContext({
        permissions: ["clipboard-read", "clipboard-write"],
    });
    const page = await context.newPage();
    try {
        await page.addInitScript(`
            window.__opened = [];
            window.open = (url) => {
                window.__opened.push(String(url));
                return { closed: true, focus() {}, close() {} };
            };
        `);
        await page.goto(productRow!.actualPath);
        const productUrl = new URL(productRow!.actualPath, page.url()).toString();
        const hosts = {
            Facebook: "facebook.com",
            X: "twitter.com",
            WhatsApp: "whatsapp.com",
            Pinterest: "pinterest.com",
        } as const;
        for (const [name, host] of Object.entries(hosts)) {
            await page.getByRole("button", { name: `Share on ${name}` }).click();
            const opened = await page.evaluate("window.__opened.at(-1)");
            expect(String(opened)).toContain(host);
            expect(decodeURIComponent(String(opened))).toContain(productUrl);
        }
        expect(new URL(page.url()).pathname).toBe(productRow!.actualPath);
        await page.getByRole("button", { name: "Copy product link" }).click();
        await expect(page.getByText("Product link copied to clipboard")).toBeAttached();
        expect(await page.evaluate("navigator.clipboard.readText()")).toBe(productUrl);
    } finally {
        await context.close();
    }
});
