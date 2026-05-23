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
        const seed = buildE2ESeed({
            workerIndex: testInfo.workerIndex,
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

        // /checkout の Axe スキャン
        await runA11yScan(page, "/checkout", {
            readinessLocator: page.getByRole("main"),
        });
    });
});
