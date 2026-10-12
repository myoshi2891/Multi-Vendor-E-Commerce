import {
    test,
    expect,
    type Browser,
    type BrowserContext,
    type Page,
} from "@playwright/test";
import {
    clerk,
    clerkSetup,
    setupClerkTestingToken,
} from "@clerk/testing/playwright";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";

/**
 * P3残存8画面の認証後実ルート受け入れ（plans/layout-design/priority-eight-p3-residual-design-system-plan.md 追補）。
 * 実行前に scripts/design/prepare-seller-route.ts で専用DB・Clerk テスト販売者/管理者・検証クーポンを用意し、
 * その出力 JSON を DESIGN_SELLER_ROUTE に渡す。保存・削除・状態更新・upload は行わない。
 */
type Prepared = {
    sellerEmail: string;
    adminEmail: string;
    storeUrl: string;
    storeName: string;
    productId: string;
    variantId: string;
    variantName: string;
    couponCode: string;
};
const preparedPath = process.env.DESIGN_SELLER_ROUTE;
if (!preparedPath)
    throw new Error(
        "Set DESIGN_SELLER_ROUTE to the JSON written by prepare-seller-route.ts."
    );
const prepared: Prepared = JSON.parse(readFileSync(preparedPath, "utf8"));
const store = `/dashboard/seller/stores/${prepared.storeUrl}`;
const product = `${store}/products/${prepared.productId}/variants`;

type Role = "admin" | "seller";
const ROUTES = [
    {
        id: "DS-PAGE-049",
        name: "admin-overview",
        role: "admin",
        path: "/dashboard/admin",
    },
    {
        id: "DS-PAGE-048",
        name: "admin-orders",
        role: "admin",
        path: "/dashboard/admin/orders",
    },
    {
        id: "DS-PAGE-050",
        name: "admin-stores",
        role: "admin",
        path: "/dashboard/admin/stores",
    },
    {
        id: "DS-PAGE-054",
        name: "coupons",
        role: "seller",
        path: `${store}/coupons`,
    },
    {
        id: "DS-PAGE-053",
        name: "coupons-new",
        role: "seller",
        path: `${store}/coupons/new`,
    },
    {
        id: "DS-PAGE-060",
        name: "variant-new",
        role: "seller",
        path: `${product}/new`,
    },
    {
        id: "DS-PAGE-059",
        name: "variant-edit",
        role: "seller",
        path: `${product}/${prepared.variantId}`,
    },
    {
        id: "DS-PAGE-065",
        name: "store-new",
        role: "seller",
        path: "/dashboard/seller/stores/new",
    },
] as const satisfies readonly {
    id: string;
    name: string;
    role: Role;
    path: string;
}[];

const emailFor = (role: Role) =>
    role === "admin" ? prepared.adminEmail : prepared.sellerEmail;

const sessions = new Map<
    Role,
    Awaited<ReturnType<BrowserContext["storageState"]>>
>();

test.beforeAll(async ({ browser }) => {
    test.setTimeout(600_000);
    await clerkSetup();
    for (const role of ["admin", "seller"] as const) {
        const context = await browser.newContext();
        const page = await context.newPage();
        await setupClerkTestingToken({ page });
        await page.goto("/");
        await clerk.signIn({ page, emailAddress: emailFor(role) });
        // dev サーバーは初回コンパイル後にページ全体を再読込するため、操作前に全ルートを一度描画しておく
        for (const route of ROUTES.filter((r) => r.role === role)) {
            await page.goto(route.path, {
                waitUntil: "load",
                timeout: 120_000,
            });
            await page.waitForLoadState("networkidle");
        }
        sessions.set(role, await context.storageState());
        await context.close();
    }
});

const open = async (
    browser: Browser,
    role: Role,
    width: number,
    colorScheme: "light" | "dark"
): Promise<{ context: BrowserContext; page: Page }> => {
    const context = await browser.newContext({
        storageState: sessions.get(role),
        viewport: { width, height: 900 },
        colorScheme,
        reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await setupClerkTestingToken({ page });
    return { context, page };
};

const gotoOk = async (page: Page, path: string) => {
    const response = await page.goto(path, {
        waitUntil: "load",
        timeout: 90_000,
    });
    // リダイレクトや失敗応答を後続の待機に埋もれさせないため、先に判定する
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe(path);
    await page.waitForLoadState("networkidle");
};

const noOverflow = (page: Page) =>
    page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

for (const route of ROUTES)
    for (const width of [1440, 768, 390])
        for (const colorScheme of ["light", "dark"] as const)
            test(`${route.id} ${route.name} ${width} ${colorScheme}`, async ({
                browser,
            }, info) => {
                test.setTimeout(120_000);
                const { context, page } = await open(
                    browser,
                    route.role,
                    width,
                    colorScheme
                );
                const pageErrors: string[] = [];
                page.on("pageerror", (error) => pageErrors.push(error.message));
                try {
                    await gotoOk(page, route.path);
                    await expect(page.locator("html")).toHaveClass(
                        colorScheme === "dark" ? /dark/ : /^(?!.*dark)/
                    );
                    await expect(
                        page.getByText(
                            /Application error|Unhandled Runtime Error/
                        )
                    ).toHaveCount(0);
                    // 全条件の結果を集めるため soft で判定し、違反の有無にかかわらず証跡を残す
                    expect
                        .soft(await noOverflow(page), "no horizontal overflow")
                        .toBe(true);
                    const { violations } = await new AxeBuilder({ page })
                        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
                        .analyze();
                    const summary = violations.map((v) => ({
                        id: v.id,
                        impact: v.impact,
                        targets: v.nodes.map((n) => n.target.join(" ")),
                    }));
                    await info.attach("axe-violations.json", {
                        body: JSON.stringify(summary, null, 2),
                        contentType: "application/json",
                    });
                    expect
                        .soft(
                            summary.map((v) => v.id),
                            "axe WCAG A/AA"
                        )
                        .toEqual([]);
                    await page.screenshot({
                        path: info.outputPath(
                            `${route.name}-${width}-${colorScheme}.png`
                        ),
                        fullPage: true,
                    });
                    expect(pageErrors, "uncaught page errors").toEqual([]);
                } finally {
                    await context.close();
                }
            });

// 非保存操作。Dialog は Cancel / Escape で閉じ、確定ボタンは押さない
const withRole = async (
    browser: Browser,
    role: Role,
    run: (page: Page) => Promise<void>
) => {
    const { context, page } = await open(browser, role, 1440, "light");
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    try {
        await run(page);
        expect(pageErrors, "uncaught page errors").toEqual([]);
    } finally {
        await context.close();
    }
};

test("permissions: admin routes reject anonymous and seller", async ({
    browser,
}) => {
    test.setTimeout(120_000);
    const anonymous = await browser.newContext();
    try {
        const page = await anonymous.newPage();
        await page.goto("/dashboard/admin", {
            waitUntil: "load",
            timeout: 90_000,
        });
        expect(new URL(page.url()).pathname).toBe("/");
    } finally {
        await anonymous.close();
    }
    await withRole(browser, "seller", async (page) => {
        await page.goto("/dashboard/admin/stores", {
            waitUntil: "load",
            timeout: 90_000,
        });
        expect(new URL(page.url()).pathname).toBe("/");
    });
});

test("admin orders: details dialog closes and returns focus", async ({
    browser,
}) => {
    test.setTimeout(120_000);
    await withRole(browser, "admin", async (page) => {
        await gotoOk(page, "/dashboard/admin/orders");
        const view = page.getByRole("button", { name: /^View order / }).first();
        await view.click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(view).toBeFocused();
    });
});

test("admin stores: details and delete dialogs close without changes", async ({
    browser,
}) => {
    test.setTimeout(120_000);
    await withRole(browser, "admin", async (page) => {
        await gotoOk(page, "/dashboard/admin/stores");
        const details = page.getByRole("button", {
            name: `View store ${prepared.storeName}`,
            exact: true,
        });
        await details.click();
        await expect(page.getByRole("dialog")).toContainText(
            prepared.storeName
        );
        await page.keyboard.press("Escape");
        await expect(details).toBeFocused();
        const remove = page.getByRole("button", {
            name: `Delete store ${prepared.storeName}`,
            exact: true,
        });
        await remove.click();
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(remove).toBeFocused();
        await page.reload({ waitUntil: "load" });
        await expect(details).toBeVisible();
    });
});

test("coupons: edit dialog shows saved values and delete is cancelable", async ({
    browser,
}) => {
    test.setTimeout(120_000);
    await withRole(browser, "seller", async (page) => {
        await gotoOk(page, `${store}/coupons`);
        const edit = page.getByRole("button", {
            name: `Edit coupon ${prepared.couponCode}`,
            exact: true,
        });
        await edit.click();
        const dialog = page.getByRole("dialog");
        await expect(
            dialog.getByRole("textbox", { name: "Coupon code" })
        ).toHaveValue(prepared.couponCode);
        await expect(
            dialog.getByRole("spinbutton", { name: "Coupon discount" })
        ).toHaveValue("15");
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(edit).toBeFocused();
        const remove = page.getByRole("button", {
            name: `Delete coupon ${prepared.couponCode}`,
            exact: true,
        });
        await remove.click();
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await page.reload({ waitUntil: "load" });
        await expect(edit).toBeVisible();
    });
});

test("coupon new and store new: empty submit shows validation", async ({
    browser,
}) => {
    test.setTimeout(120_000);
    await withRole(browser, "seller", async (page) => {
        await gotoOk(page, `${store}/coupons/new`);
        await page
            .getByRole("button", { name: "Create coupon", exact: true })
            .click();
        await expect(
            page.getByText("Discount percentage must be at least 1%")
        ).toBeVisible();
        expect(new URL(page.url()).pathname).toBe(`${store}/coupons/new`);

        await gotoOk(page, "/dashboard/seller/stores/new");
        const form = page.getByRole("form", { name: "Store information" });
        await form
            .getByRole("button", { name: "Create store", exact: true })
            .click();
        await expect(
            form.getByText("Choose a logo image.", { exact: true })
        ).toBeVisible();
        expect(new URL(page.url()).pathname).toBe(
            "/dashboard/seller/stores/new"
        );
    });
});

test("variants: new inherits product and edit loads saved values", async ({
    browser,
}) => {
    test.setTimeout(120_000);
    await withRole(browser, "seller", async (page) => {
        await gotoOk(page, `${product}/new`);
        await expect(
            page.getByRole("heading", { level: 1, name: "Add variant" })
        ).toBeVisible();
        await expect(
            page.getByPlaceholder("Product Name", { exact: true })
        ).toHaveCount(0);

        await gotoOk(page, `${product}/${prepared.variantId}`);
        await expect(
            page.getByRole("heading", { level: 1, name: "Edit variant" })
        ).toBeVisible();
        await expect(
            page.getByPlaceholder("Variant Name", { exact: true })
        ).toHaveValue(prepared.variantName);
    });
});
