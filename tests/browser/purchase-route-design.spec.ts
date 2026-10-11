import { test, expect, type Browser, type Page } from "@playwright/test";
import {
    clerk,
    clerkSetup,
    setupClerkTestingToken,
} from "@clerk/testing/playwright";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { expectReadableFocus } from "./purchase-assertions";

/**
 * 購入優先8画面の認証後実ルート受け入れ（checkout・注文詳細・wishlist）。
 *
 * 実行前に scripts/design/prepare-purchase-route.ts で専用DBと Clerk テスト顧客を用意し、
 * その出力 JSON を DESIGN_PURCHASE_ROUTE に渡す。クーポン適用がカートを変えるため、実行ごとに準備し直す。
 * 決済は描画まで（PayPal ボタン・Stripe Elements）。Place order・支払い送信は押さない。
 */

type Prepared = {
    customerEmail: string;
    couponCode: string;
    paidOrderId: string;
    pendingOrderId: string;
    wishlistCount: number;
};

const preparedPath = process.env.DESIGN_PURCHASE_ROUTE;
if (!preparedPath)
    throw new Error(
        "Set DESIGN_PURCHASE_ROUTE to the JSON written by prepare-purchase-route.ts."
    );
const prepared: Prepared = JSON.parse(readFileSync(preparedPath, "utf8"));
const WIDTHS = [1440, 768, 390] as const;

test.beforeAll(async () => {
    await clerkSetup();
});

// セッションは保存せず、テストごとにサインインする（短命トークンの期限切れを避ける。seller-eight-route と同じ）
const withCustomer = async (
    browser: Browser,
    run: (page: Page) => Promise<void>
) => {
    const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: "reduce",
        acceptDownloads: true,
    });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    try {
        await setupClerkTestingToken({ page });
        await page.goto("/", { waitUntil: "load" });
        await clerk.signIn({ page, emailAddress: prepared.customerEmail });
        await run(page);
        expect(pageErrors, "uncaught page errors").toEqual([]);
    } finally {
        await context.close();
    }
};

const gotoRoute = async (page: Page, path: string) => {
    const response = await page.goto(path, {
        waitUntil: "load",
        timeout: 90_000,
    });
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL((url) => url.pathname === path);
};

// 第三者 SDK の iframe 内部は検査対象外（アプリの DOM のみ）
const accessible = async (page: Page) => {
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
        )
    ).toBe(true);
    const result = await new AxeBuilder({ page })
        .include("main")
        .exclude("iframe")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
    expect(
        result.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
        }))
    ).toEqual([]);
};

test("checkout: real cart, saved addresses and address dialog", async ({
    browser,
}, info) => {
    test.setTimeout(240_000);
    await withCustomer(browser, async (page) => {
        for (const width of WIDTHS) {
            await page.setViewportSize({ width, height: 1000 });
            await gotoRoute(page, "/checkout");
            await expect(
                page.getByRole("heading", { name: "Checkout", level: 1 })
            ).toBeVisible();
            await expect(
                page.getByRole("button", { name: "Place order" })
            ).toBeEnabled();
            const radios = page.getByRole("radio");
            await expect(radios).toHaveCount(2);
            await expect(radios.first()).toBeChecked();
            await radios.nth(1).focus();
            await page.keyboard.press("Space");
            await expect(radios.nth(1)).toBeChecked();
            await accessible(page);
            await page.screenshot({
                path: info.outputPath(`route-checkout-${width}.png`),
                fullPage: true,
            });

            const trigger = page.getByRole("button", {
                name: "Add new address",
            });
            await expectReadableFocus(trigger);
            await page.keyboard.press("Enter");
            const dialog = page.getByRole("dialog", {
                name: "Add new address",
            });
            await expect(dialog).toBeVisible();
            await expect(page.getByLabel("First name")).toBeFocused();
            expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(
                width
            );
            await page.keyboard.press("Escape");
            await expect(dialog).toBeHidden();
            await expect(trigger).toBeFocused();
        }
    });
});

test("checkout: coupon rejects an unknown code, then applies a store coupon", async ({
    browser,
}, info) => {
    test.setTimeout(180_000);
    await withCustomer(browser, async (page) => {
        await gotoRoute(page, "/checkout");
        const input = page.getByLabel("Coupon code");
        const apply = page.getByRole("button", { name: "Apply", exact: true });
        await input.fill("NO-SUCH-CODE");
        await apply.click();
        await expect(page.getByRole("alert")).toBeVisible();
        await expect(input).toHaveValue("NO-SUCH-CODE");
        await expect(
            page.getByRole("button", { name: "Place order" })
        ).toBeEnabled();

        await input.fill(prepared.couponCode);
        await apply.click();
        await expect(
            page.getByText(/Coupon applied successfully/)
        ).toBeVisible();
        await expect(
            page.getByRole("button", { name: "Place order" })
        ).toBeEnabled();
        await accessible(page);
        await page.screenshot({
            path: info.outputPath("route-checkout-coupon.png"),
            fullPage: true,
        });
    });
});

test("order paid: details, breadcrumb targets and invoice export", async ({
    browser,
}, info) => {
    test.setTimeout(240_000);
    await withCustomer(browser, async (page) => {
        for (const width of WIDTHS) {
            await page.setViewportSize({ width, height: 1000 });
            await gotoRoute(page, `/order/${prepared.paidOrderId}`);
            await expect(
                page.getByRole("heading", { name: "Order Details", level: 1 })
            ).toBeVisible();
            await expect(page.getByTestId("order-total")).toHaveCount(1);
            await expect(page.getByTestId("order-payment")).toHaveCount(0);
            for (const link of await page
                .getByRole("navigation", { name: "Breadcrumb" })
                .getByRole("link")
                .all()) {
                const box = await link.boundingBox();
                expect(box!.height).toBeGreaterThanOrEqual(44);
                expect(box!.width).toBeGreaterThanOrEqual(44);
            }
            await accessible(page);
            await page.screenshot({
                path: info.outputPath(`route-order-paid-${width}.png`),
                fullPage: true,
            });
        }
        // 実 PDF 生成（@react-pdf）→ ダウンロード。印刷ダイアログは開かない
        const download = page.waitForEvent("download");
        await page.getByRole("button", { name: "Export", exact: true }).click();
        expect((await download).suggestedFilename()).toBe(
            `Order-${prepared.paidOrderId}.pdf`
        );
        // Next.js のルートアナウンサーも role="alert" なので、請求書の失敗表示に限定する
        await expect(
            page.getByText(/couldn’t prepare your invoice/)
        ).toHaveCount(0);
    });
});

const openPendingPayment = async (page: Page, width: number) => {
    await page.setViewportSize({ width, height: 1000 });
    await gotoRoute(page, `/order/${prepared.pendingOrderId}`);
    const payment = page.getByTestId("order-payment");
    await expect(payment).toBeVisible();
    return payment;
};

test("order pending: PayPal buttons render without submission", async ({
    browser,
}, info) => {
    test.setTimeout(240_000);
    await withCustomer(browser, async (page) => {
        for (const width of WIDTHS) {
            const payment = await openPendingPayment(page, width);
            await expect(
                payment.locator("iframe[title*='PayPal' i]").first()
            ).toBeVisible({ timeout: 30_000 });
            // iframe の枠だけでなく、SDK がボタンを描画したことまで確認する（押さない）
            await expect(
                payment
                    .frameLocator("iframe[title*='PayPal' i]")
                    .first()
                    .getByRole("link", { name: /PayPal/i })
                    .first()
            ).toBeVisible({ timeout: 30_000 });
            await accessible(page);
            await page.screenshot({
                path: info.outputPath(`route-order-pending-${width}.png`),
                fullPage: true,
            });
        }
    });
});

// 描画時に Stripe テストモードの PaymentIntent が作られる（課金・カード送信なし）。
// テストキーが有効なことを確認してから DESIGN_STRIPE_READY=1 で実行する（2026-10-11 時点は期限切れで保留）
test("order pending: Stripe Elements render without submission", async ({
    browser,
}) => {
    test.skip(
        process.env.DESIGN_STRIPE_READY !== "1",
        "Valid Stripe test keys are required (set DESIGN_STRIPE_READY=1)."
    );
    test.setTimeout(240_000);
    await withCustomer(browser, async (page) => {
        for (const width of WIDTHS) {
            const payment = await openPendingPayment(page, width);
            await expect(
                payment.locator("iframe[name^='__privateStripeFrame']").first()
            ).toBeVisible({ timeout: 30_000 });
            await expect(payment.getByRole("alert")).toHaveCount(0);
            await accessible(page);
        }
    });
});

test("wishlist: real items, pagination and history", async ({
    browser,
}, info) => {
    test.setTimeout(240_000);
    await withCustomer(browser, async (page) => {
        for (const width of WIDTHS) {
            await page.setViewportSize({ width, height: 1000 });
            await gotoRoute(page, "/profile/wishlist/1");
            const nav = page.getByRole("navigation", {
                name: "Wishlist pagination",
            });
            await expect(
                nav.getByRole("link", { name: "Page 1", exact: true })
            ).toHaveAttribute("aria-current", "page");
            await accessible(page);
            await page.screenshot({
                path: info.outputPath(`route-wishlist-${width}.png`),
                fullPage: true,
            });
            const next = nav.getByRole("link", { name: "Next" });
            await expectReadableFocus(next);
            await page.keyboard.press("Enter");
            await expect(page).toHaveURL(/\/profile\/wishlist\/2$/);
            await expect(
                nav.getByRole("link", { name: "Page 2", exact: true })
            ).toHaveAttribute("aria-current", "page");
            await expect(
                nav.getByText("Next", { exact: true })
            ).toHaveAttribute("aria-disabled", "true");
            await accessible(page);
            await page.goBack();
            await expect(page).toHaveURL(/\/profile\/wishlist\/1$/);
        }
    });
});
