import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * a11y: Seller Apply ページ Step 1 (WCAG 2.1 AA)
 *
 * 未認証で到達可能なマルチステップフォームの最初のステップを対象とする。
 * Step 2-4 はサインインが必要なため Phase 2 で対応する。
 *
 * 既知違反を抑制する場合は AxeBuilder.disableRules([...]) を使用し、
 * TODO コメントで根拠と issue リンクを残すこと。
 */

test.describe("a11y: /seller/apply (Step 1)", () => {
    test.skip(
        ({ browserName }) => browserName !== "chromium",
        "a11y スキャンは chromium 限定（レンダリング差を排除）"
    );

    test("WCAG 2.1 AA 違反が無いこと", async ({ page }) => {
        await page.goto("/seller/apply", { waitUntil: "domcontentloaded" });

        // フォームが描画されるまで待機
        await page.waitForLoadState("networkidle", { timeout: 15000 });

        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
            .analyze();

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
