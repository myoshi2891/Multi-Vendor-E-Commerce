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
 * 決済の送信は sandbox のみ（Stripe テストカード／PayPal sandbox 購入者）。対象は専用DBの注文に限る。
 * Stripe 系は DESIGN_STRIPE_READY=1、PayPal 決済は PAYPAL_SANDBOX_BUYER_EMAIL / _PASSWORD がある時だけ実行する。
 */

type Prepared = {
    customerEmail: string;
    couponCode: string;
    paidOrderId: string;
    pendingOrderId: string;
    stripeOrderId: string;
    paypalOrderId: string;
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

// クーポン適用後のカートで注文を確定する（専用DBに未払い注文が 1 件増え、カートは空になる）
test("checkout: place order opens the new pending order and empties the bag", async ({
    browser,
}, info) => {
    test.setTimeout(180_000);
    await withCustomer(browser, async (page) => {
        await gotoRoute(page, "/checkout");
        await page.getByRole("button", { name: "Place order" }).click();
        await expect(page).toHaveURL(
            (url) =>
                /^\/order\/[0-9a-f-]{36}$/.test(url.pathname) &&
                !url.pathname.endsWith(prepared.pendingOrderId),
            { timeout: 60_000 }
        );
        await expect(
            page.getByRole("heading", { name: "Order Details", level: 1 })
        ).toBeVisible();
        await expect(page.getByTestId("order-payment")).toBeVisible();
        await accessible(page);
        await page.screenshot({
            path: info.outputPath("route-order-placed.png"),
            fullPage: true,
        });
        // カートが無くなると checkout は /cart へ戻す（page.tsx の redirect）
        await page.goto("/checkout", { waitUntil: "load" });
        await expect(page).toHaveURL((url) => url.pathname === "/cart");
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

// 印刷は PDF を読み込んだ隠し iframe の print() を呼ぶ。init script は子 frame にも入るので、
// 全 frame の print を記録に差し替えて OS の印刷ダイアログを開かずに呼び出しを確認する
test("order paid: print prepares the invoice and calls print once", async ({
    browser,
}) => {
    test.setTimeout(180_000);
    await withCustomer(browser, async (page) => {
        await page.addInitScript(`
            window.print = () => {
                const top = window.top;
                top.__printCalls = (top.__printCalls || 0) + 1;
            };
        `);
        await gotoRoute(page, `/order/${prepared.paidOrderId}`);
        await page.getByRole("button", { name: "Print", exact: true }).click();
        await expect
            .poll(() => page.evaluate("window.__printCalls || 0"), {
                timeout: 30_000,
            })
            .toBe(1);
        await expect(
            page.getByText(/couldn’t prepare your invoice/)
        ).toHaveCount(0);
        await expect(
            page.getByRole("button", { name: "Print", exact: true })
        ).toBeEnabled();
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
// テストキーが有効なことを確認してから DESIGN_STRIPE_READY=1 で実行する
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

const expectSettled = async (page: Page, orderId: string) => {
    await expect(page.getByTestId("order-payment")).toHaveCount(0, {
        timeout: 60_000,
    });
    // refresh 後の表示だけでなく、再読込（サーバーの注文状態）でも支払い欄が出ないこと
    await gotoRoute(page, `/order/${orderId}`);
    await expect(page.getByTestId("order-payment")).toHaveCount(0);
};

// Stripe テストカードで送信する（sandbox の決済記録が残る。課金なし）
test("order pending: Stripe test card payment settles the order", async ({
    browser,
}, info) => {
    test.skip(
        process.env.DESIGN_STRIPE_READY !== "1",
        "Valid Stripe test keys are required (set DESIGN_STRIPE_READY=1)."
    );
    test.setTimeout(240_000);
    await withCustomer(browser, async (page) => {
        await gotoRoute(page, `/order/${prepared.stripeOrderId}`);
        const form = page.getByRole("form", { name: "Card payment" });
        await expect(form).toBeVisible({ timeout: 60_000 });
        const card = form
            .frameLocator("iframe[name^='__privateStripeFrame']")
            .first();
        await card.locator("[name='number']").fill("4242424242424242");
        await card.locator("[name='expiry']").fill("1234");
        await card.locator("[name='cvc']").fill("123");
        const postal = card.locator("[name='postalCode']");
        if (await postal.isVisible()) await postal.fill("94103");
        // カード欄（別オリジンの Stripe iframe）にフォーカスがある状態で locator.click() すると、
        // 自動スクロール直後に同じ瞬間でマウスを押すため、Chrome がクリックを古い位置の iframe
        // （カード番号欄）へ配送し送信されない。人のホイール操作＋クリックや、スクロール後に
        // 間を置いたクリックでは送信できることを確認済み（アプリの不具合ではない）。
        // 固定待機に頼らないよう、キーボード利用者と同じくフォーカスして Enter で送信する
        const pay = form.getByRole("button", { name: "Pay Now" });
        await pay.focus();
        await expect(pay).toBeFocused();
        await page.keyboard.press("Enter");
        // 失敗時はフォームの alert 文言を失敗理由として出す（決済が止まった理由を残す）
        const alert = form.getByRole("alert");
        await expect
            .poll(
                async () =>
                    (await alert.count()) > 0
                        ? `alert: ${await alert.first().innerText()}`
                        : (await page.getByTestId("order-payment").count()) ===
                            0
                          ? "settled"
                          : "pending",
                { timeout: 90_000 }
            )
            .toBe("settled");
        await expectSettled(page, prepared.stripeOrderId);
        await page.screenshot({
            path: info.outputPath("route-order-stripe-paid.png"),
            fullPage: true,
        });
    });
});

// PayPal sandbox 購入者で承認する。認証情報は .env.local にのみ置く（コミットしない）
test("order pending: PayPal sandbox approval settles the order", async ({
    browser,
}, info) => {
    const buyerEmail = process.env.PAYPAL_SANDBOX_BUYER_EMAIL?.trim();
    const buyerPassword = process.env.PAYPAL_SANDBOX_BUYER_PASSWORD;
    test.skip(
        !buyerEmail || !buyerPassword,
        "PayPal sandbox buyer credentials are required."
    );
    test.setTimeout(300_000);
    await withCustomer(browser, async (page) => {
        await gotoRoute(page, `/order/${prepared.paypalOrderId}`);
        const button = page
            .getByTestId("order-payment")
            .frameLocator("iframe[title*='PayPal' i]")
            .first()
            .getByRole("link", { name: /PayPal/i })
            .first();
        await expect(button).toBeVisible({ timeout: 30_000 });
        const popupPromise = page.waitForEvent("popup");
        await button.click();
        const popup = await popupPromise;
        await popup.waitForLoadState("domcontentloaded");
        await popup.locator("#email").fill(buyerEmail!);
        const next = popup.locator("#btnNext");
        if (await next.isVisible()) await next.click();
        await popup.locator("#password").fill(buyerPassword!);
        await popup.locator("#btnLogin").click();
        await popup
            .getByRole("button", {
                name: /Complete Purchase|Pay Now|Continue/i,
            })
            .first()
            .click({ timeout: 60_000 });
        await popup.waitForEvent("close", { timeout: 60_000 });
        await expectSettled(page, prepared.paypalOrderId);
        await page.screenshot({
            path: info.outputPath("route-order-paypal-paid.png"),
            fullPage: true,
        });
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

// P2 support acceptance: prepare-purchase-route.ts resets three unread notifications for the customer
// (shipped with a link, two delivered without one). Every read path must survive a reload (DB persisted).
test("P2 notifications real route: unread states and persisted read paths", async ({browser}, info) => {
    await withCustomer(browser, async page => {
        const region = page.getByRole("region", {name:"Notifications", exact:true});
        const items = region.getByRole("listitem");
        const shipped = items.filter({hasText:"Your items have shipped"});
        const delivered = items.filter({hasText:"Your items were delivered"});
        const markAll = region.getByRole("button", {name:"Mark all as read"});
        for (const width of WIDTHS) {
            await page.setViewportSize({width, height:1000});
            await gotoRoute(page, "/profile/notifications");
            await expect(region.getByRole("heading", {level:1})).toBeVisible();
            await expect(region).toHaveCSS("color", "rgb(23, 37, 29)");
            await expect(region.getByRole("alert")).toHaveCount(0);
            await expect(items).toHaveCount(3);
            await expect(region.getByText("Unread", {exact:true})).toHaveCount(3);
            await expect(markAll).toBeEnabled();
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            expect((await new AxeBuilder({page}).include("main").withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
            await page.screenshot({path:info.outputPath(`p2-notifications-route-${width}.png`),fullPage:true});
        }

        // 1) リンク無しの未読はボタン。キーボードで既読にし、再読み込み後も保持される
        const firstDelivered = delivered.first().getByRole("button");
        await expectReadableFocus(firstDelivered);
        await page.keyboard.press("Enter");
        await expect(region.getByRole("status")).toHaveText("Notification marked as read.");
        await expect(delivered.filter({hasNotText:"Unread"})).toHaveCount(1);
        await page.reload();
        await expect(region.getByText("Unread", {exact:true})).toHaveCount(2);
        await expect(delivered.filter({hasNotText:"Unread"})).toHaveCount(1);

        // 2) リンク付きの未読は開くと既読になり、戻って再読み込みしても保持される
        await shipped.getByRole("link").click();
        await expect(page).toHaveURL(new RegExp(`/order/${prepared.paidOrderId}$`));
        await gotoRoute(page, "/profile/notifications");
        await expect(shipped).not.toContainText("Unread");
        await expect(region.getByText("Unread", {exact:true})).toHaveCount(1);

        // 3) 残り 1 件を一括既読にし、再読み込み後も全件既読・ボタン無効
        await expectReadableFocus(markAll);
        await page.keyboard.press("Enter");
        await expect(region.getByRole("status")).toHaveText("Notifications marked as read.");
        await expect(markAll).toBeDisabled();
        await page.reload();
        await expect(region.getByText("Unread", {exact:true})).toHaveCount(0);
        await expect(region.getByText("Read", {exact:true})).toHaveCount(3);
        await expect(markAll).toBeDisabled();
        expect((await new AxeBuilder({page}).include("main").withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
        await page.screenshot({path:info.outputPath("p2-notifications-route-read.png"),fullPage:true});
    });
});

// P2 support acceptance: reuse the same customer; no settings writes.
test("P2 settings real Clerk appearance hash and inline editor without saving", async ({browser}, info) => {
    await withCustomer(browser, async page => {
        for (const width of WIDTHS) {
            await page.setViewportSize({width, height:1000});
            await page.goto("/profile/settings");
            const region = page.getByRole("region", {name:"Account settings", exact:true});
            await expect(region.getByRole("heading", {name:"Account settings", exact:true})).toBeVisible();
            const update = region.getByRole("button", {name:"Update profile", exact:true});
            await expect(update).toBeVisible();
            await expectReadableFocus(update);
            const box = await update.boundingBox();
            expect(box?.width).toBeGreaterThanOrEqual(44);
            expect(box?.height).toBeGreaterThanOrEqual(44);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            expect((await new AxeBuilder({page}).include("main").withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
            await page.screenshot({path:info.outputPath(`p2-settings-route-${width}.png`),fullPage:true});
            await page.keyboard.press("Enter");
            await expect(region.getByRole("textbox", {name:"First name", exact:true})).toBeVisible();
            await expect(region.getByRole("button", {name:"Save", exact:true})).toBeDisabled();
            expect((await new AxeBuilder({page}).include("main").withTags(["wcag2a","wcag2aa","wcag21aa"]).analyze()).violations).toEqual([]);
            await page.screenshot({path:info.outputPath(`p2-settings-editor-route-${width}.png`),fullPage:true});
            const cancel = region.getByRole("button", {name:"Cancel", exact:true});
            await cancel.focus();
            await page.keyboard.press("Enter");
            await expect(update).toBeVisible();
            for (const button of await region.locator('button:not([aria-hidden="true"])').all()) {
                const target = await button.boundingBox();
                if (!target) continue;
                expect(target.width, await button.innerText()).toBeGreaterThanOrEqual(44);
                expect(target.height, await button.innerText()).toBeGreaterThanOrEqual(44);
            }
            const security = page.getByRole("button", {name:"Security", exact:true});
            if (!await security.isVisible()) {
                await region.locator(".cl-navbarMobileMenuButton").click({timeout:10000});
                await expect(security).toBeVisible();
                await page.screenshot({path:info.outputPath(`p2-settings-menu-route-${width}.png`),fullPage:true});
            }
            await security.click({timeout:10000});
            await expect(page).toHaveURL(/#.*security/);
            await expect(region.getByText("Password", {exact:true})).toBeVisible();
        }
    });
});
