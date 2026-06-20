import { expect, test } from "@playwright/test";
import { runA11yScan } from "./_helpers";
import {
    createCustomerSession,
    requiresClerkAdmin,
} from "../helpers/auth";
import { buildE2ESeed } from "../seed/constants";
import {
    setupE2ETestState,
    waitForCartPersist,
} from "@/config/test-helpers";

/**
 * a11y: /checkout ページ (WCAG 2.1 AA)
 *
 * Clerk テストモードで USER ロールの顧客アカウントを動的作成し、
 * カートに商品を1つ投入してから /checkout を Axe スキャンする。
 *
 * CLERK_SECRET_KEY 未設定の環境では自動スキップ。
 */

test.describe("a11y: /checkout", () => {
    test.skip(
        () => requiresClerkAdmin,
        "Requires CLERK_SECRET_KEY for Clerk admin operations."
    );
    test.skip(
        ({ browserName }) => browserName !== "chromium",
        "a11y スキャンは chromium 限定（レンダリング差を排除）"
    );

    const session = createCustomerSession();

    test.beforeAll(async () => {
        await session.create({ role: "USER" });
    });

    test.afterAll(async () => {
        await session.cleanup();
    });

    test("WCAG 2.1 AA 違反が無いこと", async ({ page }, testInfo) => {
        // signIn + 商品ページ + カート投入 + Axe スキャンを含む重いフロー。
        // 本番ビルドでの認証フローに既定 30s では不足するため拡張する。
        test.setTimeout(90000);
        const seed = buildE2ESeed({
            parallelIndex: testInfo.parallelIndex,
            projectName: testInfo.project.name,
        });

        await session.signIn(page);
        await setupE2ETestState(page, seed);

        // カートに商品を1つ投入
        await page.goto(`/product/${seed.product.slug}/${seed.variant.slug}`);
        await page
            .locator('[data-testid^="size-option-"]')
            .first()
            .click();
        await page.waitForURL(/.*\?size=.*/, { timeout: 5000 });
        await page.getByTestId("add-to-cart").click();
        await expect(page.getByText(/Product added to cart/i)).toBeVisible({
            timeout: 5000,
        });
        await waitForCartPersist(page);

        // /cart 経由で Checkout を押し DB Cart に同期する。
        // /checkout は DB Cart が空だと /cart にリダイレクトするため、
        // 直接 goto では到達できない（saveUserCart は /cart の Checkout で発火）。
        await page.goto("/cart", { waitUntil: "commit" });
        await page.waitForLoadState("domcontentloaded", { timeout: 10000 });
        await page.getByTestId("checkout").click();
        await page.waitForURL(/\/checkout/, { timeout: 10000 });

        // /checkout の Axe スキャン（DB Cart 同期済みでリダイレクトされない）
        await runA11yScan(page, "/checkout", {
            readinessLocator: page.getByRole("main"),
            // color-contrast は既知のデザイン負債。配色是正は別タスク。
            // 追跡: docs/testing/QA_HANDOFF.md「a11y color-contrast 負債」
            disabledRules: ["color-contrast"],
        });
    });
});
