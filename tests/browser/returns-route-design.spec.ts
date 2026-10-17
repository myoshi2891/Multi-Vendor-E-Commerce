import {
    test,
    expect,
    type Browser,
    type Page,
    type TestInfo,
} from "@playwright/test";
import {
    clerk,
    clerkSetup,
    setupClerkTestingToken,
} from "@clerk/testing/playwright";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";

/**
 * 返品 RMA 画面の認証後実ルート受け入れ（plans/layout-design/returns-real-route-acceptance-plan.md）。
 * 実行前に scripts/design/prepare-returns-route.ts で専用DBと Clerk テスト利用者を用意し、
 * その出力 JSON を DESIGN_RETURNS_ROUTE に渡す。表示の確認だけで、保存操作はしない
 * （申請 → 承認 → 受け取り → 解決の往復は tests/e2e/returns-rma.spec.ts が担保する）。
 */
type Prepared = {
    sellerEmail: string;
    customerEmail: string;
    storeUrl: string;
    orderId: string;
    requestCount: number;
    eligibleItemName: string;
};
const preparedPath = process.env.DESIGN_RETURNS_ROUTE;
if (!preparedPath)
    throw new Error(
        "Set DESIGN_RETURNS_ROUTE to the JSON written by prepare-returns-route.ts."
    );
const prepared: Prepared = JSON.parse(readFileSync(preparedPath, "utf8"));
const sellerPath = `/dashboard/seller/stores/${prepared.storeUrl}/returns`;
const orderPath = `/order/${prepared.orderId}`;
const WIDTHS = [1440, 768, 390] as const;

test.beforeAll(async () => {
    await clerkSetup();
});

// セッションは保存せず、テストごとにサインインする（短命トークンの期限切れを避ける。seller-eight-route と同じ）
const withUser = async (
    browser: Browser,
    email: string,
    options: { width: number; colorScheme: "light" | "dark" },
    run: (page: Page) => Promise<void>
) => {
    const context = await browser.newContext({
        viewport: { width: options.width, height: 1000 },
        colorScheme: options.colorScheme,
        reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    try {
        await setupClerkTestingToken({ page });
        await page.goto("/", { waitUntil: "load", timeout: 90_000 });
        await clerk.signIn({ page, emailAddress: email });
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
    // リダイレクトや失敗応答を後続の表示待ちのタイムアウトに埋もれさせないため、先に判定する
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL((url) => url.pathname === path);
    await expect(
        page.getByText(/Application error|Unhandled Runtime Error/)
    ).toHaveCount(0);
};

// 全条件の結果を集めるため soft で判定し、違反の有無にかかわらず証跡を残す
const expectAccessible = async (page: Page, info: TestInfo, scope?: string) => {
    expect
        .soft(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth
            ),
            "no horizontal overflow"
        )
        .toBe(true);
    const builder = new AxeBuilder({ page }).withTags([
        "wcag2a",
        "wcag2aa",
        "wcag21a",
        "wcag21aa",
    ]);
    const { violations } = await (scope ? builder.include(scope) : builder)
        .exclude("iframe")
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
};

const sellerCard = (page: Page, status: string) =>
    page.locator(`article[data-return-state="${status}"]`);

for (const width of WIDTHS)
    for (const colorScheme of ["light", "dark"] as const)
        test(`DS-PAGE-068 seller returns ${width} ${colorScheme}`, async ({
            browser,
        }, info) => {
            test.setTimeout(180_000);
            await withUser(
                browser,
                prepared.sellerEmail,
                { width, colorScheme },
                async (page) => {
                    await gotoRoute(page, sellerPath);
                    await expect(page.locator("html")).toHaveClass(
                        colorScheme === "dark" ? /dark/ : /^(?!.*dark)/
                    );
                    await expect(
                        page.getByRole("article", { name: /^Return / })
                    ).toHaveCount(prepared.requestCount);
                    await expect(
                        page.locator("option", {
                            hasText: `All (${prepared.requestCount})`,
                        })
                    ).toHaveCount(1);
                    // 状態ごとに正しい操作だけが出る
                    await expect(
                        sellerCard(page, "REQUESTED").getByRole("button", {
                            name: "Approve",
                        })
                    ).toBeVisible();
                    await expect(
                        sellerCard(page, "APPROVED").getByRole("button", {
                            name: "Mark as received",
                        })
                    ).toBeVisible();
                    await expect(
                        sellerCard(page, "RECEIVED").getByRole("button", {
                            name: "Resolve return",
                        })
                    ).toBeVisible();
                    // カードが無くてもボタン 0 件で通ってしまうため、先に存在を確かめる
                    await expect(sellerCard(page, "RESOLVED")).toHaveCount(1);
                    await expect(
                        sellerCard(page, "RESOLVED").getByRole("button")
                    ).toHaveCount(0);
                    await expect(sellerCard(page, "REJECTED")).toContainText(
                        "Rejection reason:"
                    );
                    await expectAccessible(page, info);
                    await page.screenshot({
                        path: info.outputPath(
                            `seller-returns-${width}-${colorScheme}.png`
                        ),
                        fullPage: true,
                    });
                }
            );
        });

for (const width of WIDTHS)
    test(`DS-COMP-248 seller input states ${width}`, async ({
        browser,
    }, info) => {
        test.setTimeout(180_000);
        await withUser(
            browser,
            prepared.sellerEmail,
            { width, colorScheme: "light" },
            async (page) => {
                await gotoRoute(page, sellerPath);
                // 却下理由欄を開く（保存はしない）
                const requested = sellerCard(page, "REQUESTED");
                // exact: 部分一致だと展開後に出る「Confirm rejection」も拾う
                const reject = requested.getByRole("button", {
                    name: "Reject",
                    exact: true,
                });
                await reject.click();
                await expect(reject).toHaveAttribute("aria-expanded", "true");
                await expect(
                    requested.getByLabel("Reason for rejection")
                ).toBeVisible();
                // 受け取りの状態を選ぶ（保存はしない）
                const condition = sellerCard(page, "APPROVED").getByRole(
                    "combobox",
                    { name: /^Condition: / }
                );
                await condition.selectOption("RESELLABLE");
                await expect(condition).toHaveValue("RESELLABLE");
                await expectAccessible(page, info);
                await page.screenshot({
                    path: info.outputPath(`seller-inputs-${width}.png`),
                    fullPage: true,
                });
            }
        );
    });

for (const width of WIDTHS)
    test(`DS-COMP-247 order returns panel ${width}`, async ({
        browser,
    }, info) => {
        test.setTimeout(180_000);
        await withUser(
            browser,
            prepared.customerEmail,
            { width, colorScheme: "light" },
            async (page) => {
                await gotoRoute(page, orderPath);
                await expect(
                    page.getByRole("heading", { name: "Returns", level: 4 })
                ).toBeVisible();
                await expect(
                    page.getByRole("article", { name: /^Return request from / })
                ).toHaveCount(prepared.requestCount);
                // キーボードで申請フォームを開く
                const open = page.getByRole("button", {
                    name: "Request a return",
                });
                await open.focus();
                await page.keyboard.press("Enter");
                await expect(open).toHaveAttribute("aria-expanded", "true");
                await expect(
                    page.getByLabel(
                        `Quantity to return: ${prepared.eligibleItemName} (M)`
                    )
                ).toBeVisible();
                await expect(
                    page.getByRole("button", { name: "Submit return request" })
                ).toBeVisible();
                await expectAccessible(page, info, "main");
                await page.screenshot({
                    path: info.outputPath(`order-returns-${width}.png`),
                    fullPage: true,
                });
            }
        );
    });
