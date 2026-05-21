import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * a11y: Sign-in ページ (WCAG 2.1 AA)
 *
 * Clerk の <SignIn /> コンポーネントを直接埋め込んだページの
 * アクセシビリティ違反を検出する。
 *
 * 既知違反を抑制する場合は AxeBuilder.disableRules([...]) を使用し、
 * TODO コメントで根拠と issue リンクを残すこと。
 */

test.describe("a11y: /sign-in", () => {
    test.skip(
        ({ browserName }) => browserName !== "chromium",
        "a11y スキャンは chromium 限定（レンダリング差を排除）"
    );

    test("WCAG 2.1 AA 違反が無いこと", async ({ page }) => {
        await page.goto("/sign-in", { waitUntil: "domcontentloaded" });

        // Clerk のフォームが描画されるまで待機
        await page.waitForLoadState("networkidle", { timeout: 15000 });

        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze();

        // 違反内容をテストレポートに含めるためログ出力
        if (results.violations.length > 0) {
            console.log(
                "[a11y violations]",
                JSON.stringify(
                    results.violations.map((v) => ({
                        id: v.id,
                        impact: v.impact,
                        help: v.help,
                        nodes: v.nodes.length,
                    })),
                    null,
                    2
                )
            );
        }

        expect(results.violations).toEqual([]);
    });
});
