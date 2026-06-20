import { test } from "@playwright/test";
import { runA11yScan } from "./_helpers";

/**
 * a11y: Seller Apply ページ Step 1 (WCAG 2.1 AA)
 *
 * 未認証で到達可能なマルチステップフォームの最初のステップを対象とする。
 * Step 2-4 はサインインが必要なため Phase 2 で対応する。
 *
 * 既知違反を抑制する場合は runA11yScan の代わりに AxeBuilder を直接呼び、
 * .disableRules([...]) を使用すること。TODO コメントで根拠と issue リンクを残す。
 */

test.describe("a11y: /seller/apply (Step 1)", () => {
    test.skip(
        ({ browserName }) => browserName !== "chromium",
        "a11y スキャンは chromium 限定（レンダリング差を排除）"
    );

    test("WCAG 2.1 AA 違反が無いこと", async ({ page }) => {
        await runA11yScan(page, "/seller/apply", {
            // Step 1 には <form> が無い（form は Step 2 以降）。ページの main
            // ランドマークを準備完了の判定に使う。
            readinessLocator: page.getByRole("main"),
            // TODO(a11y): color-contrast は既知のデザイン負債（#eef4fc 背景の
            // グレー/ブルー系テキストが 4.5:1 未満）。配色是正は別タスクで対応する。
            // 追跡: docs/testing/QA_HANDOFF.md「a11y color-contrast 負債」
            disabledRules: ["color-contrast"],
        });
    });
});
