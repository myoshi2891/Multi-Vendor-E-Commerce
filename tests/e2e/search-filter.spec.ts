import { expect, test } from "@playwright/test";
import { buildE2ESeed } from "./seed/constants";
import { setupE2ETestState } from "@/config/test-helpers";

test.describe("検索・フィルタ", () => {
  let seed: ReturnType<typeof buildE2ESeed>;
  let productName: string;

  test.beforeEach(async ({ page }, testInfo) => {
    seed = buildE2ESeed({
      parallelIndex: testInfo.parallelIndex,
      projectName: testInfo.project.name,
    });
    await setupE2ETestState(page, seed);
    productName = process.env.E2E_PRODUCT_NAME || seed.product.name;
    await page.goto("/");
  });

  test("商品名で検索し結果が表示される", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search|What are you looking for/i).first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill(productName);
    await searchInput.press("Enter");

    await page.waitForURL(/.*search=.*/);
    await expect(page.getByText(productName).first()).toBeVisible({ timeout: 10000 });
  });

  test("カテゴリフィルタで絞り込まれる", async ({ page }) => {
    await page.goto("/browse");
    // seed:e2e は全プロジェクト分の同名カテゴリを作成するため .first() で限定
    const categoryLabel = page.locator("label").filter({ hasText: seed.category.name }).first();
    await expect(categoryLabel).toBeVisible();
    await categoryLabel.click();
    // カテゴリパラメータが URL に反映されることを確認
    await page.waitForURL(/[?&]category=/, { timeout: 5000 });
    await expect(page.getByText(productName).first()).toBeVisible({ timeout: 10000 });
  });

  test("フィルタ条件が URL パラメータに反映される", async ({ page }) => {
    await page.goto(`/browse?search=${encodeURIComponent(productName)}&category=${encodeURIComponent(seed.category.url)}`);
    const searchInput = page.getByPlaceholder(/Search|What are you looking for/i).first();
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveValue(productName);

    // カテゴリが選択されていることを、アクティブインジケータ（内側ドット）の存在で確認
    // 同名カテゴリが複数存在するため、アクティブインジケータを持つラベルで限定
    const activeCategory = page.locator("label")
      .filter({ hasText: seed.category.name })
      .filter({ has: page.locator("div.rounded-full.bg-black") });
    await expect(activeCategory).toBeVisible({ timeout: 10000 });
  });

  test("検索結果 0 件で適切なメッセージ表示される", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Search|What are you looking for/i).first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("NonExistentProductxyz123");
    await searchInput.press("Enter");
    await expect(page.getByText(/No Products/i)).toBeVisible({ timeout: 10000 });
  });

  test("旧 ?subCategory= が 308 で正準ノードへ着地する", async ({ page }) => {
    // plan 067 V-2。旧 URL は**恒久的に受理し続ける**（外部被リンクを切らない）が、
    // 正準 URL へ 308 で寄せる。307 では検索エンジンに正準 URL が伝わらない。
    const canonical = seed.subCategory.url;

    for (const slug of [canonical, seed.subCategory.legacyUrl]) {
      // maxRedirects: 0 で自動追従を止め、ステータスと Location を直接見る。
      // page.goto では最終 URL しか見えず、308 と 302 の区別が付かない。
      const response = await page.request.get(
        `/browse?subCategory=${encodeURIComponent(slug)}`,
        { maxRedirects: 0 }
      );
      expect(response.status()).toBe(308);
      // 行き先は**正準 slug**。legacyUrl は Category.url に存在せず
      // CategorySlugAlias 経由でしか解決できないので、別名表を引く経路の検証になる。
      expect(response.headers()["location"]).toContain(
        `category=${encodeURIComponent(canonical)}`
      );
    }

    // 追従後に商品が実際に表示されること（308 の行き先が 0 件に化けていない）。
    await page.goto(`/browse?subCategory=${encodeURIComponent(seed.subCategory.legacyUrl)}`);
    await expect(page).toHaveURL(new RegExp(`[?&]category=${canonical}(&|$)`));
    await expect(page.getByText(productName).first()).toBeVisible({ timeout: 10000 });
  });

  test("ページネーションで次ページに遷移できる", async ({ page }) => {
    // 専用カテゴリ（12 商品 > pageSize 10）を使い、2 ページ構成を決定的にする。
    // 既存の共有カテゴリでは他 spec の seed 追加で件数が動くため件数 assert が壊れる。
    const category = seed.paginationCategory.url;

    // 商品カードのカウントに `[data-testid^="product-card-"]` を使わないこと。
    // この prefix はカード内の価格 `data-testid="product-card-price"`
    // （product-page/product-info/product-price.tsx:112）にも一致し、件数が二重に数えられる。
    // seed slug まで含めた prefix ならカードのリンクだけに一致する。
    const cards = page.locator('[data-testid^="product-card-e2e-page-item-"]');

    await page.goto(`/browse?category=${category}`);
    await expect(cards).toHaveCount(10);

    // Next は共有 Pagination の `<div><p>Next</p></div>`（button ロールではない）。
    await page.getByText("Next", { exact: true }).click();
    await page.waitForURL(/[?&]page=2/);

    // page=2 になったことだけでなく、**既存の category クエリが保持されている**ことを検証する。
    // BrowsePagination は「既存クエリを保持したまま page だけ差し替える」実装であり、
    // これを検証しないと category を落とす実装（全商品の 2 ページ目へ飛ぶ）でも green になる。
    // その場合 1 ページ目 10 件 / 2 ページ目 2 件という件数も偶然一致しうるため、
    // 件数 assert だけでは category 脱落を検出できない。
    await expect(page).toHaveURL(new RegExp(`[?&]category=${category}(&|$)`));
    await expect(cards).toHaveCount(2);

    // 不正な page 値は 1 ページ目に正規化される（tech.md の URL パラメータ正規化規約）。
    await page.goto(`/browse?category=${category}&page=abc`);
    await expect(cards).toHaveCount(10);
  });
});
