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

        // seed のカテゴリで絞った /browse をスキャンする（plans 073 / 076）。
        // - 素の /browse は views=0 の同点が大半で、並び順は id の tie-breaker で決まる。
        //   seed 商品が 1 ページ目に来る保証は無い（以前は物理順で偶然 1 ページ目に出ていた）。
        //   カテゴリで絞れば seed 商品は必ず含まれ、件数も 1 ページに収まる。
        // - このカテゴリには属性ファセット（e2e_finish）があるので、ファセット UI も検査対象に入る。
        await runA11yScan(page, `/browse?category=${seed.category.url}`, {
            // seed 商品のカードが描画されるまで待つ。prefix セレクタ
            // （[data-testid^="product-card-"]）はカード内の "product-card-price"
            // にもマッチするため、slug 完全一致で掴む。
            readinessLocator: page.getByTestId(
                `product-card-${seed.product.slug}`
            ),
        });
    });
});
