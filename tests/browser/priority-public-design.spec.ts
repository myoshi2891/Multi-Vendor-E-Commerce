import { storefrontControls, storefrontToken } from "./storefront-eight-assertions";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expectReadableBorder, expectReadableFocus } from "./purchase-assertions";

async function accessible(page: Page) {
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
        )
    ).toBe(true);
    const result = await new AxeBuilder({ page })
        .include("main")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
    expect(result.violations).toEqual([]);
}
// クライアント側バリデーションのハンドラーが付くまで待つ（未 hydrate だとネイティブ送信になる）
async function waitForFormHydration(page: Page) {
    await page.waitForFunction(() => {
        const form = document.querySelector("main form");
        return (
            form &&
            Object.keys(form).some((key) => key.startsWith("__reactProps$"))
        );
    });
}
for (const width of [1440, 768, 390]) {
    test(`offers actual route at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/offers");
        const main = page.getByRole("main");
        await expect(
            main.getByRole("heading", { level: 1, name: "Discounts & Offers" })
        ).toHaveCSS("font-family", /Georgia/);
        await expect(main).toHaveCSS("background-color", "rgb(243, 240, 232)");
        await expect(
            main.getByRole("navigation", { name: "Breadcrumb" })
        ).toBeVisible();
        // loading.tsx shares the heading, so wait for the streamed result before asserting.
        await expect(main.getByText("Loading offers…")).toHaveCount(0);
        const offerLinks = main.locator('a[href^="/browse?offer="]');
        const emptyState = main.getByRole("region", {
            name: "More discoveries await.",
        });
        await expect(offerLinks.first().or(emptyState)).toBeVisible();
        for (const link of await offerLinks.all()) {
            await expect(link).toContainText("商品");
            await expect(link).toHaveAttribute("href", /\/browse\?offer=.+/);
        }
        const link = main.getByRole("link").first();
        await link.focus();
        await expect(link).toHaveCSS("outline-style", "solid");
        await accessible(page);
        await page.screenshot({
            path: info.outputPath(`offers-${width}.png`),
            fullPage: true,
        });
    });
    for (const [path, title, submitLabel, orderRequired] of [
        ["/dispute", "Order dispute resolution", "申立を送信する", true],
        ["/report-problem", "Report a problem", "報告する", false],
    ] as const) {
        test(`${path} actual route and mocked submission at ${width}px`, async ({
            page,
        }, info) => {
            await page.setViewportSize({ width, height: 1000 });
            await page.goto(path);
            const main = page.getByRole("main");
            await expect(
                main.getByRole("heading", { name: title, level: 1 })
            ).toHaveCSS("font-family", /Georgia/);
            await expect(main).toHaveCSS(
                "background-color",
                "rgb(243, 240, 232)"
            );
            await waitForFormHydration(page);
            const submit = main.getByRole("button", { name: submitLabel });
            await accessible(page);
            await page.screenshot({
                path: info.outputPath(`form-${width}.png`),
                fullPage: true,
            });
            await submit.click();
            await expect(
                main.getByText("お名前を入力してください。")
            ).toBeVisible();
            await main
                .getByLabel("お名前", { exact: true })
                .fill("Test Customer");
            await main
                .getByLabel("メールアドレス", { exact: true })
                .fill("customer@example.com");
            await main.getByLabel("件名", { exact: true }).fill("Test request");
            await main
                .getByLabel("内容", { exact: true })
                .fill("Test request details");
            const order = main.getByLabel("対象の注文番号", { exact: true });
            await expect(order).toHaveCount(orderRequired ? 1 : 0);
            if (orderRequired) {
                await order.fill("invalid");
                await submit.click();
                await expect(
                    main.getByText("有効な注文番号を入力してください。")
                ).toBeVisible();
                await order.fill("123e4567-e89b-12d3-a456-426614174000");
            }
            let release!: () => void;
            let gate: Promise<void> | undefined = new Promise((done) => {
                release = done;
            });
            let fail = true;
            let calls = 0;
            await page.route(`**${path}`, async (route) => {
                if (!route.request().headers()["next-action"])
                    return route.continue();
                calls++;
                if (gate) await gate;
                if (fail)
                    return route.fulfill({ status: 500, body: "Unavailable" });
                return route.fulfill({
                    contentType: "text/x-component",
                    body: '0:{"a":"$@1","f":"","b":"development"}\n1:{"id":"ticket-fixture"}\n',
                });
            });
            await page.keyboard.press("Tab");
            await submit.focus();
            await expect(submit).toHaveCSS("outline-style", "solid");
            await page.keyboard.press("Enter");
            await expect(
                main.getByRole("button", { name: "送信中…" })
            ).toBeDisabled();
            for (const input of await main.getByRole("textbox").all())
                await expect(input).toBeDisabled();
            await accessible(page);
            release();
            gate = undefined;
            await expect(main.getByRole("alert")).toBeVisible();
            await expect(main.getByLabel("内容", { exact: true })).toHaveValue(
                "Test request details"
            );
            await accessible(page);
            fail = false;
            await submit.click();
            await expect(main.getByRole("status")).toContainText(
                "受け付けました。"
            );
            expect(calls).toBe(2);
            await accessible(page);
            await page.screenshot({
                path: info.outputPath(`success-${width}.png`),
                fullPage: true,
            });
        });
    }
}
for (const path of ["/profile/following/1", "/profile/history/1"]) {
    test(`guest redirect preserves ${path}`, async ({ page }) => {
        await page.goto(path);
        await expect(page).toHaveURL(/sign-in/);
        expect(new URL(page.url()).searchParams.get("redirect_url")).toContain(
            path
        );
    });
}

import { expectSupportTokens, supportAccessible, supportTargets } from "./support-eight-assertions";
for (const width of [1440, 768, 390]) {
    for (const path of ["/track-order", "/customer-service", "/returns-exchange", "/dispute", "/report-problem", "/offers"]) {
        test(`P2 support actual route ${path} ${width}`, async ({page}, info) => {
            await page.setViewportSize({width,height:1000});
            await page.goto(path);
            await expect(page.getByRole("main").getByRole("heading", {level:1})).toBeVisible();
            if (path === "/offers") await expect(page.getByText("Loading offers…")).toHaveCount(0);
            await expectSupportTokens(page, "");
            await supportTargets(page);
            const home=page.getByRole("main").getByRole("navigation", {name:"Breadcrumb"}).getByRole("link", {name:"Home"});
            await home.focus();
            await expect(home).toHaveCSS("outline-style","solid");
            await supportAccessible(page);
            const submit=page.getByRole("main").locator('form button[type="submit"]');
            if (await submit.count()) {
                await waitForFormHydration(page);
                await submit.click();
                await expect(page.getByText(path === "/track-order" ? "注文番号を入力してください。" : "お名前を入力してください。")).toBeVisible();
                await supportAccessible(page);
            }
            await page.screenshot({path:info.outputPath(`p2-support-route-${path.slice(1)}-${width}.png`),fullPage:true});
        });
    }
}

// Actual lookup uses a previously prepared order; no test data is inserted.
import { readFileSync } from "node:fs";
type TrackingData = {customerEmail: string; trackingOrderId: string};
const isTrackingData = (value: unknown): value is TrackingData =>
    typeof value === "object" && value !== null &&
    typeof (value as Record<string, unknown>).customerEmail === "string" &&
    typeof (value as Record<string, unknown>).trackingOrderId === "string";
// 読めない・壊れた JSON でも spec 全体の読み込みは止めず、追跡テストだけをデータ無しで skip させる
function loadTrackingData(): TrackingData | null {
    const path = process.env.DESIGN_PURCHASE_ROUTE;
    if (!path) return null;
    try {
        const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
        return isTrackingData(parsed) ? parsed : null;
    } catch (error: unknown) {
        console.warn("[priority-public-design] DESIGN_PURCHASE_ROUTE を読めません", {
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}
const trackingData = loadTrackingData();
test("P2 tracking existing order read-only lookup at three widths", async ({page}, info) => {
    test.skip(!trackingData, "Existing dedicated test order required; do not create data for verification.");
    if (!trackingData) return;
    for (const width of [1440, 768, 390]) {
        await page.setViewportSize({width,height:1000});
        await page.goto("/track-order");
        await waitForFormHydration(page);
        await page.getByLabel("注文番号", {exact:true}).fill(trackingData.trackingOrderId);
        await page.getByLabel("メールアドレス").fill(trackingData.customerEmail);
        await page.getByRole("button", {name:"追跡する"}).click();
        const result=page.getByRole("region", {name:"注文追跡の結果"});
        await expect(result).toBeVisible();
        expect(await result.locator('[data-appearance="store"]').count()).toBeGreaterThanOrEqual(2);
        await supportAccessible(page);
        await page.screenshot({path:info.outputPath(`p2-tracking-existing-${width}.png`),fullPage:true});
    }
});

for (const width of [1440,768,390]) {
    for (const path of ["/", "/contact", "/faqs", "/product-support", "/about"]) {
        test(`storefront eight public ${path} ${width}`, async ({page},info) => {
            test.setTimeout(90000);
            await page.setViewportSize({width,height:1000});
            const response = await page.goto(path);
            expect(response?.status()).toBe(200);
            const main = page.getByRole("main");
            await expect(main.getByRole("heading",{level:1})).toBeVisible();
            await storefrontToken(main,path === "/" ? "--purchase-dark" : "--purchase-page","background-color",path === "/" ? "rgb(11, 16, 14)" : "rgb(243, 240, 232)",path === "/" ? "rgb(17, 29, 22)" : "rgb(241, 238, 228)");
            await storefrontControls(main.locator("a,button,input,textarea"));
            await supportAccessible(page);
            await page.screenshot({path:info.outputPath(`storefront-real-${path === "/" ? "home" : path.slice(1)}-${width}.png`),fullPage:true});
        });
    }
}

// Real Clerk rendering: never submit credentials or create an account here.
for (const width of [1440, 801, 800, 768, 390]) {
    test(`pending eight sign-in ${width}: brand links and Clerk controls`, async ({ page }, info) => {
        const pageErrors: string[] = [];
        page.on("pageerror", error => pageErrors.push(error.message));
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/sign-in?redirect_url=%2Fprofile%2Ffollowing%2F1");
        const main = page.getByRole("main");
        await expect(main.locator(".cl-signIn-root")).toBeVisible();
        await expect(main.getByRole("heading", { name: "Welcome back." })).toHaveCSS("font-family", /Georgia/);
        await storefrontControls(main.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link"));
        await storefrontControls(main.getByRole("link", { name: /Explore the collection|Customer service/ }));
        const input = main.locator('input:not([type="hidden"])').first();
        await expect(input).toBeVisible();
        await expectReadableBorder(input);
        await expectReadableFocus(input);
        await storefrontControls(main.locator(".cl-signIn-root").locator("a,button"));
        await input.fill("invalid-email");
        await expect(input).toHaveValue("invalid-email");
        await accessible(page);
        expect(pageErrors, "uncaught authentication page errors").toEqual([]);
        await page.screenshot({ path: info.outputPath(`pending-sign-in-${width}.png`), fullPage: true });
    });
}

for (const width of [1440, 801, 800, 768, 390]) {
    test(`pending eight sign-up ${width}: shared theme and local input`, async ({ page }, info) => {
        const pageErrors: string[] = [];
        page.on("pageerror", error => pageErrors.push(error.message));
        await page.setViewportSize({ width, height: 1000 });
        await page.goto("/sign-up?redirect_url=%2Fprofile%2Ffollowing%2F1");
        const main = page.getByRole("main");
        const widget = main.locator(".cl-signUp-root");
        await expect(widget).toBeVisible();
        await expect(main.getByRole("heading", { name: "Begin something special." })).toHaveCSS("font-family", /Georgia/);
        await storefrontControls(main.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link"));
        await storefrontControls(main.getByRole("link", { name: /Explore the collection|Customer service/ }));
        await storefrontControls(widget.locator("a,button"));
        const email = widget.getByRole("textbox", { name: "Email address", exact: true });
        await expect(email).toBeVisible();
        await expectReadableBorder(email);
        await expectReadableFocus(email);
        await email.fill("invalid-email");
        await expect(email).toHaveValue("invalid-email");
        await accessible(page);
        expect(pageErrors, "uncaught authentication page errors").toEqual([]);
        await page.screenshot({ path: info.outputPath(`pending-sign-up-${width}.png`), fullPage: true });
    });
}
