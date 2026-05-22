import { test } from "@playwright/test";
import { runA11yScan } from "./_helpers";

/**
 * a11y: Sign-in ページ (WCAG 2.1 AA)
 *
 * Clerk の <SignIn /> コンポーネントを直接埋め込んだページの
 * アクセシビリティ違反を検出する。
 *
 * 既知違反を抑制する場合は runA11yScan の代わりに AxeBuilder を直接呼び、
 * .disableRules([...]) を使用すること。TODO コメントで根拠と issue リンクを残す。
 */

test.describe("a11y: /sign-in", () => {
    test.skip(
        ({ browserName }) => browserName !== "chromium",
        "a11y スキャンは chromium 限定（レンダリング差を排除）"
    );

    test("WCAG 2.1 AA 違反が無いこと", async ({ page }) => {
        // Clerk のフォームは shadow DOM 風の構造になる場合があるため、
        // data-clerk-component または素の form のどちらかが可視になれば準備完了とみなす。
        await runA11yScan(page, "/sign-in", {
            readinessLocator: page
                .locator("[data-clerk-component], form")
                .first(),
        });
    });
});
