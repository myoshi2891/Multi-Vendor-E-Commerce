import { expect, test } from "@playwright/test";
import { runA11yScan } from "./_helpers";
import {
    createCustomerSession,
    requiresClerkAdmin,
} from "../helpers/auth";

/**
 * a11y: /profile ページ (WCAG 2.1 AA)
 *
 * Clerk テストモードで USER ロールの顧客アカウントを動的作成し、
 * 認証済み状態で /profile を Axe スキャンする。
 *
 * CLERK_SECRET_KEY 未設定の環境では自動スキップ。
 */

test.describe("a11y: /profile", () => {
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

    test("WCAG 2.1 AA 違反が無いこと", async ({ page }) => {
        await session.signIn(page);
        await runA11yScan(page, "/profile", {
            // /profile はリダイレクトで /profile/orders などに飛ぶ可能性があるため、
            // 共通レイアウトに含まれるサイドバーの存在で「準備完了」と判定
            readinessLocator: page.getByRole("main"),
        });
    });
});
