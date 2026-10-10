import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { clerk, clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";

/**
 * 販売者8画面の認証後実ルート受け入れ（plans/layout-design/priority-eight-seller-residual-design-system-plan.md）。
 * 実行前に scripts/design/prepare-seller-route.ts で専用DBと Clerk テスト販売者を用意し、
 * その出力 JSON を DESIGN_SELLER_ROUTE に渡す。storageState はファイルへ保存しない。
 */
type Prepared = { sellerEmail: string; storeUrl: string; otherStoreUrl: string; orderId: string };
const preparedPath = process.env.DESIGN_SELLER_ROUTE;
if (!preparedPath) throw new Error("Set DESIGN_SELLER_ROUTE to the JSON written by prepare-seller-route.ts.");
const prepared: Prepared = JSON.parse(readFileSync(preparedPath, "utf8"));
const base = `/dashboard/seller/stores/${prepared.storeUrl}`;

const ROUTES = [
    { id: "DS-PAGE-058", name: "overview", path: "" },
    { id: "DS-PAGE-062", name: "products", path: "/products" },
    { id: "DS-PAGE-055", name: "inventory", path: "/inventory" },
    { id: "DS-PAGE-057", name: "orders", path: "/orders" },
    { id: "DS-PAGE-056", name: "messages", path: "/messages" },
    { id: "DS-PAGE-061", name: "products-new", path: "/products/new" },
    { id: "DS-PAGE-064", name: "shipping", path: "/shipping" },
    { id: "DS-PAGE-063", name: "settings", path: "/settings" },
] as const;

let session: Awaited<ReturnType<BrowserContext["storageState"]>>;

test.beforeAll(async ({ browser }) => {
    test.setTimeout(600_000);
    await clerkSetup();
    const context = await browser.newContext();
    const page = await context.newPage();
    await setupClerkTestingToken({ page });
    await page.goto("/");
    await clerk.signIn({ page, emailAddress: prepared.sellerEmail });
    // dev サーバーは初回コンパイル後にページ全体を再読込するため、操作前に全ルートを一度描画しておく
    for (const route of ROUTES) {
        await page.goto(`${base}${route.path}`, { waitUntil: "load", timeout: 120_000 });
        await page.waitForLoadState("networkidle");
    }
    session = await context.storageState();
    await context.close();
});

const openSeller = async (
    browser: Browser,
    width: number,
    colorScheme: "light" | "dark"
): Promise<{ context: BrowserContext; page: Page }> => {
    const context = await browser.newContext({
        storageState: session,
        viewport: { width, height: 900 },
        colorScheme,
        reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await setupClerkTestingToken({ page });
    return { context, page };
};

for (const route of ROUTES)
    for (const width of [1440, 768, 390])
        for (const colorScheme of ["light", "dark"] as const)
            test(`${route.id} ${route.name} ${width} ${colorScheme}`, async ({ browser }, info) => {
                test.setTimeout(120_000);
                const { context, page } = await openSeller(browser, width, colorScheme);
                const pageErrors: string[] = [];
                page.on("pageerror", (error) => pageErrors.push(error.message));
                try {
                    const response = await page.goto(`${base}${route.path}`, { waitUntil: "load", timeout: 90_000 });
                    // Jodit は dynamic import のため、ツールバー描画後に axe を実行する（未描画だと判定が揺れる）
                    if (route.name === "products-new") await expect(page.locator('.jodit-toolbar__box [role="listitem"]').first()).toBeVisible({ timeout: 30_000 });
                    expect(response?.status()).toBe(200);
                    expect(new URL(page.url()).pathname).toBe(`${base}${route.path}`);
                    await expect(page.locator("html")).toHaveClass(colorScheme === "dark" ? /dark/ : /^(?!.*dark)/);
                    await expect(page.getByText(/Application error|Unhandled Runtime Error/)).toHaveCount(0);
                    // 全条件の結果を集めるため soft で判定し、違反の有無にかかわらず証跡を残す
                    expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal overflow").toBe(true);
                    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
                    const summary = violations.map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target.join(" ")) }));
                    await info.attach("axe-violations.json", { body: JSON.stringify(summary, null, 2), contentType: "application/json" });
                    expect.soft(summary.map((v) => v.id), "axe WCAG A/AA").toEqual([]);
                    await page.screenshot({ path: info.outputPath(`${route.name}-${width}-${colorScheme}.png`), fullPage: true });
                    expect(pageErrors, "uncaught page errors").toEqual([]);
                } finally {
                    await context.close();
                }
            });

// 実DBへの保存→再読込。専用DBでのみ実行し、検証後は元の値へ戻す
// 保存系はセッションを使い回さず毎回サインインする。beforeAll の storageState を流用すると短命な
// セッショントークンが期限切れになり、保存直後の refresh が Clerk の再認証遷移と重なって成功表示が
// 消える（流用時 16/18、毎回サインインで 27/27 を実測）
const withSeller = async (browser: Browser, run: (page: Page) => Promise<void>) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    try {
        await setupClerkTestingToken({ page });
        await page.goto("/", { waitUntil: "load" });
        await clerk.signIn({ page, emailAddress: prepared.sellerEmail });
        await run(page);
        expect(pageErrors, "uncaught page errors").toEqual([]);
    } finally {
        await context.close();
    }
};
const gotoSeller = async (page: Page, path: string) => {
    const response = await page.goto(`${base}${path}`, { waitUntil: "load", timeout: 90_000 });
    expect(response?.status()).toBe(200);
    await page.waitForLoadState("networkidle");
};

test("permissions: unauthenticated and other store", async ({ browser }) => {
    test.setTimeout(120_000);
    const anonymous = await browser.newContext();
    try {
        const page = await anonymous.newPage();
        await page.goto(base, { waitUntil: "load", timeout: 90_000 });
        expect(new URL(page.url()).pathname).toBe("/");
    } finally {
        await anonymous.close();
    }
    await withSeller(browser, async (page) => {
        await page.goto(`/dashboard/seller/stores/${prepared.otherStoreUrl}`, { waitUntil: "load", timeout: 90_000 });
        await expect(page.getByText("Store information is unavailable")).toBeVisible();
        await expect(page.getByText("E2E Store B")).toHaveCount(0);
    });
});

test("inventory: threshold and stock persist after reload", async ({ browser }) => {
    test.setTimeout(180_000);
    await withSeller(browser, async (page) => {
        const save = async (group: ReturnType<Page["getByRole"]>, value: string) => {
            await group.getByRole("spinbutton").fill(value);
            await group.getByRole("button", { name: "保存", exact: true }).click();
            // dev サーバーは Server Action の初回コンパイルで数秒かかるため長めに待つ
            await expect(group.getByRole("status")).toContainText("更新しました", { timeout: 30_000 });
        };
        await gotoSeller(page, "/inventory");
        const threshold = () => page.getByRole("group", { name: "過小在庫しきい値の編集" });
        const stock = () => page.getByRole("group", { name: "在庫数の編集" }).first();
        const original = { threshold: await threshold().getByRole("spinbutton").inputValue(), stock: await stock().getByRole("spinbutton").inputValue() };
        // 受け入れ条件は「保存→再読込で値が保持される」こと。保存ごとに再読込して確認する
        const saveAndReload = async (group: () => ReturnType<Page["getByRole"]>, value: string) => {
            await save(group(), value);
            await page.reload({ waitUntil: "load" });
            await page.waitForLoadState("networkidle");
            await expect(group().getByRole("spinbutton")).toHaveValue(value);
        };
        await saveAndReload(threshold, "7");
        await saveAndReload(stock, "11");
        await saveAndReload(threshold, original.threshold);
        await saveAndReload(stock, original.stock);
    });
});

test("orders: status persists and details dialog returns focus", async ({ browser }) => {
    test.setTimeout(180_000);
    await withSeller(browser, async (page) => {
        await gotoSeller(page, "/orders");
        const status = () => page.getByRole("combobox", { name: /^Order status / }).first();
        const editor = () => page.getByRole("group", { name: /^Order status .* editor$/ }).first();
        const original = await status().inputValue();
        await status().selectOption("Processing");
        await editor().getByRole("button", { name: "Save status" }).click();
        await expect(editor().getByRole("status")).toHaveText("Status updated.", { timeout: 30_000 });
        await page.reload({ waitUntil: "load" });
        await expect(status()).toHaveValue("Processing");
        // 復元は表示フィードバックではなく再読込後の値で確認する（保存後の router.refresh で再描画されるため）
        await status().selectOption(original);
        await editor().getByRole("button", { name: "Save status" }).click();
        await expect(editor().getByRole("status")).toHaveText("Status updated.", { timeout: 30_000 });
        await page.reload({ waitUntil: "load" });
        await expect(status()).toHaveValue(original);
        const view = page.getByRole("button", { name: /^View order / }).first();
        await view.click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(view).toBeFocused();
    });
});

test("settings: store phone persists after reload", async ({ browser }) => {
    test.setTimeout(180_000);
    await withSeller(browser, async (page) => {
        await gotoSeller(page, "/settings");
        const phone = () => page.getByRole("textbox", { name: "Store phone number" });
        const submit = async (value: string) => {
            await phone().fill(value);
            await page.getByRole("button", { name: "Save store information" }).click();
            await expect(page.getByRole("form", { name: "Store information" }).getByRole("status")).toHaveText("Store information saved.", { timeout: 30_000 });
        };
        const original = await phone().inputValue();
        await submit("0000000009");
        await page.reload({ waitUntil: "load" });
        await expect(phone()).toHaveValue("0000000009");
        await submit(original);
    });
});

test("shipping: default service persists and rate dialog returns focus", async ({ browser }) => {
    test.setTimeout(180_000);
    await withSeller(browser, async (page) => {
        await gotoSeller(page, "/shipping");
        const service = () => page.getByRole("textbox", { name: "Shipping service" });
        const submit = async (value: string) => {
            await service().fill(value);
            await page.getByRole("button", { name: "Save changes" }).click();
            await expect(page.getByRole("form", { name: "Default shipping details" }).getByRole("status")).toHaveText("Shipping details saved.", { timeout: 30_000 });
        };
        const original = await service().inputValue();
        await submit("International Delivery QA");
        await page.reload({ waitUntil: "load" });
        await expect(service()).toHaveValue("International Delivery QA");
        await submit(original);
        const actions = page.getByRole("button", { name: /^Actions for / }).first();
        await actions.click();
        await page.getByRole("menuitem").first().click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(actions).toBeFocused();
    });
});

test("products: create dialog returns focus on Escape", async ({ browser }) => {
    test.setTimeout(120_000);
    await withSeller(browser, async (page) => {
        await gotoSeller(page, "/products");
        const create = page.getByRole("button", { name: "Create New Product" });
        await create.click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(create).toBeFocused();
    });
});

test("messages: seller reply persists after reload", async ({ browser }) => {
    test.setTimeout(180_000);
    await withSeller(browser, async (page) => {
        await gotoSeller(page, "/messages");
        const reply = `Design verification reply ${Date.now()}`;
        await page.getByRole("button", { name: "Open conversation with Design Buyer" }).click();
        await page.getByRole("textbox", { name: "Your message" }).fill(reply);
        await page.getByRole("button", { name: "Send", exact: true }).click();
        const log = page.getByRole("log", { name: "Conversation messages" });
        await expect(log.getByText(reply)).toBeVisible();
        await page.reload({ waitUntil: "load" });
        await page.getByRole("button", { name: "Open conversation with Design Buyer" }).click();
        await expect(page.getByRole("log", { name: "Conversation messages" }).getByText(reply)).toBeVisible();
    });
});

// 画像SDKはウィジェットの起動・表示まで（ファイルは送信しない。plan の承認範囲）
for (const target of [
    { path: "/products/new", button: "Upload standard image" },
    { path: "/settings", button: "Upload profile image" },
])
    test(`image SDK opens without upload ${target.path}`, async ({ browser }, info) => {
        test.setTimeout(120_000);
        await withSeller(browser, async (page) => {
            // 修正前に例外を再現した条件（load 直後・SDK 読込前）で押下し、無効化されて例外にならないことを
            // withSeller の pageerror 0 で確認する
            await page.goto(`${base}${target.path}`, { waitUntil: "load", timeout: 90_000 });
            const upload = page.getByRole("button", { name: target.button }).first();
            await upload.dispatchEvent("click");
            if (target.path === "/products/new") await expect(page.locator(".jodit-wysiwyg").first()).toBeVisible();
            await expect(upload).toBeEnabled({ timeout: 30_000 });
            await upload.click();
            // ウィジェットは iframe を 2 枚生成し、表示されるのは先頭（全画面）の 1 枚
            const widget = page.locator('iframe[data-test="uw-iframe"]').first().contentFrame();
            await expect(widget.getByText("Drag and Drop assets here")).toBeVisible({ timeout: 30_000 });
            await page.screenshot({ path: info.outputPath("cloudinary-widget.png") });
        });
    });
