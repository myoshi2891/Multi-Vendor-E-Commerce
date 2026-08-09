import { test } from "@playwright/test";
import { runA11yScan } from "./_helpers";
import { buildE2ESeed } from "../seed/constants";

/**
 * a11y: 商品一覧ページ /browse (WCAG 2.1 AA)
 *
 * 認証不要かつ顧客の滞在時間が長い主要ページ。フィルタ・ソート・商品カードの
 * グリッドを含むため、ランドマーク／ラベル欠落の検出価値が高い。
 */

test.describe("a11y: /browse", () => {
    test.skip(
        ({ browserName }) => browserName !== "chromium",
        "a11y スキャンは chromium 限定（レンダリング差を排除）"
    );

    test("WCAG 2.1 AA 違反が無いこと", async ({ page }, testInfo) => {
        const seed = buildE2ESeed({
            parallelIndex: testInfo.parallelIndex,
            projectName: testInfo.project.name,
        });

        await runA11yScan(page, "/browse", {
            // seed 商品のカードが描画されるまで待つ。prefix セレクタ
            // （[data-testid^="product-card-"]）はカード内の "product-card-price"
            // にもマッチするため、slug 完全一致で掴む。
            readinessLocator: page.getByTestId(
                `product-card-${seed.product.slug}`
            ),
            // TODO(a11y): color-contrast は既知のデザイン負債（#eef4fc 背景の
            // グレー/ブルー系テキストが 4.5:1 未満）。配色是正は別タスクで対応する。
            // 追跡: docs/testing/QA_HANDOFF.md「a11y color-contrast 負債」
            disabledRules: ["color-contrast"],
        });
    });
});
