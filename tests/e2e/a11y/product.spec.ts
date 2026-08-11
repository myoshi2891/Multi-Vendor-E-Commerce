import { test } from "@playwright/test";
import { runA11yScan } from "./_helpers";
import { buildE2ESeed } from "../seed/constants";

/**
 * a11y: 商品詳細ページ /product/[productSlug]/[variantSlug] (WCAG 2.1 AA)
 *
 * 認証不要かつ購入導線の起点。サイズ／カラーのバリアント選択、数量セレクタ、
 * ギャラリーなどインタラクティブ要素が集中するため優先度が高い。
 *
 * URL は seed 依存（slug はワーカー毎サフィックス付き）のためハードコードしない。
 */

test.describe("a11y: /product/[productSlug]/[variantSlug]", () => {
    test.skip(
        ({ browserName }) => browserName !== "chromium",
        "a11y スキャンは chromium 限定（レンダリング差を排除）"
    );

    test("WCAG 2.1 AA 違反が無いこと", async ({ page }, testInfo) => {
        const seed = buildE2ESeed({
            parallelIndex: testInfo.parallelIndex,
            projectName: testInfo.project.name,
        });

        await runA11yScan(
            page,
            `/product/${seed.product.slug}/${seed.variant.slug}`,
            {
                // "add-to-cart" はサイズ未選択でも常に描画される（container.tsx）。
                // サイズ選択を経由せずページ準備完了を判定できる。
                readinessLocator: page.getByTestId("add-to-cart"),
                // TODO(OI-10): color-contrast は既知のデザイン負債（#eef4fc 背景の
                // グレー/ブルー系テキストが 4.5:1 未満）。配色是正は別タスクで対応する。
                // 追跡: docs/testing/QA_HANDOFF.md の OI-10（残課題表・§OI-10 是正手順）
                disabledRules: ["color-contrast"],
            }
        );
    });
});
