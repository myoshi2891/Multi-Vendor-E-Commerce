# Plan 076: 属性ファセット（件数つき）と全件に効く価格ソートを実装する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> ```bash
> git diff --stat 3277d8a5 -- prisma/schema.prisma src/queries/product.ts "src/app/(store)/browse/" src/components/store/browse-page/
> git status --porcelain -- prisma/ src/queries/product.ts "src/app/(store)/browse/"
> ```
> plan 073〜075 の変更は差分として現れて構わない。`searchProductIds` / `buildProductPredicates`（plan 075）が無ければ STOP。

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED（マイグレーション + ブラウズ UI の追加）
- **Depends on**: `plans/075-unify-browse-search-and-type-filters.md`
- **Category**: direction
- **Planned at**: commit `3277d8a5`, 2026-10-03
- **設計**: [`design.md`](../docs/design/faceted-search/design.md) §2-Q3・Q4 / [ADR-007](../docs/architecture/decisions/007-attribute-storage.md)

## Why this matters

1. **価格ソートが壊れている**（既存バグ）。`getProducts` は `views desc` で `skip/take` した**後**に、メモリ上で価格順に並べ替えている
   （`product.ts:1268-1280`）。そのため「安い順」は表示中の 1 ページを並べ替えているだけで、カタログ全体では安い順にならない。
2. 属性の定義（`AttributeDefinition.facetable`）と値（plan 069）は揃ったが、ブラウズでそれを使って絞り込む手段も、件数の表示も無い。

## Current state

- 価格ソート: `product.ts:1220-1240` の `minDiscountedPrice`（`Prisma.Decimal` で `price * (1 - discount/100)` の最小値を計算）と、`:1268-1280` の `products.sort(...)`。
  findMany（`:1183-1200`）の**後**に実行される
- `Size.price Decimal(12,2)`、`Size.discount Float`（百分率）— `prisma/schema.prisma:253-258`
- Size の price / discount を書き込むのは `product.ts` の 3 経路のみ（design §0-11）。plan 074 の `recomputeProductDerivedColumns` がその 3 経路の tx から呼ばれている
- ファセット集計の雛形: design §2-Q3（実データで実行済み。ADR-007 の雛形の母集合を `base` CTE に差し替えたもの）
- 属性値: `ProductAttributeValue` / `VariantAttributeValue`（`schema.prisma:393-437`）、索引 `@@index([definitionId, optionId])` / `([definitionId, valueNumber])`
- キャッシュの前例: `src/queries/store-dashboard.ts:55`（`unstable_cache`）
- 価格の絞り込みは定価（`Size.price`）、表示は割引後 — 意味が食い違っている（design §0-9）。**このプランでは絞り込みの意味を変えない**

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Migrate | `bunx prisma migrate dev --name product_min_price` | 1 本生成・適用 |
| ERD | `bun run erd:generate` | orphan WARNING 0 |
| Typecheck | `bunx tsc --noEmit` | exit 0 |
| Unit tests | `bun run test -- src/queries/product.test.ts` | all pass |
| Component tests | `bun run test -- tests/component/store/product-filters.test.tsx` | all pass |
| Integration | `bun run test:integration -- tests/integration/product-browse.test.ts tests/integration/product-update.test.ts tests/integration/category-attributes.test.ts` | all pass（Docker 必須） |
| E2E | `bunx playwright test tests/e2e/search-filter.spec.ts` | all pass |
| Lint | `bun run lint` | 0 errors |

## Scope

**In scope**:
- `prisma/schema.prisma`、新規マイグレーション、`docs/architecture/data-model.drawio`（再生成）
- `src/queries/product.ts`（`recomputeProductDerivedColumns` の拡張、`searchProductIds` の価格ソート、`getProductFacets` の新設）
- `src/lib/types.ts`（`ProductFacet` 型）、`src/lib/utils.ts`（`?attr.<key>=` の正規化）
- ブラウズのフィルタ UI（`src/components/store/browse-page/` 配下のフィルタ部品）とそのテスト
- `specs/multi-vendor-ecommerce/08-open-questions.md`（価格の絞り込みの意味を起票）
- UI を変更するので `.agent/skills/design-system-workflow/SKILL.md` に従い、`docs/design/design-system/PROGRESS.md` も同期する
- `plans/README.md`（Status 行）

**Out of scope**:
- 価格の絞り込みを割引後に変えること（open question の結論を待つ）
- 数値属性の範囲バケット UI（ADR-007 の `width_bucket` の雛形）— 離散値のファセットだけを実装する
- マテビュー（design §2-Q3 で却下）

## Steps

### Step 1: `Product.minPrice` を追加して backfill する

```sql
ALTER TABLE "Product" ADD COLUMN "minPrice" DECIMAL(12,2);
UPDATE "Product" p SET "minPrice" = (
    SELECT round(min(s.price * (1 - s.discount::numeric / 100)), 2)
    FROM "ProductVariant" pv JOIN "Size" s ON s."productVariantId" = pv.id
    WHERE pv."productId" = p.id
);
CREATE INDEX "Product_minPrice_id_idx" ON "Product" ("minPrice", "id");
```

`discount` は Float なので、**掛ける前に `::numeric`** へ寄せる（`numeric * double` は double になる。design §2-Q4 で実測済み）。

**Verify**: migrate 成功 → `erd:generate` → `SELECT count(*) FROM "Product" WHERE "minPrice" IS NULL` が「サイズを持たない商品の数」と一致する

### Step 2: `minPrice` の同期（TDD）

`recomputeProductDerivedColumns` に `minPrice` の再計算を加える（同じ UPDATE 文の中で `searchKeywords` と一緒に）。
統合テスト: サイズの価格・割引の作成と更新のあとで `minPrice` が追随し、値が `minDiscountedPrice` と同じ（小数 2 桁に丸めた値）であること。

**Verify**: Integration の行 → pass

### Step 3: 価格ソートを母集合全体に効かせる（TDD）

1. 統合テストで Red を作る: 価格がばらばらの商品をページサイズより多く用意し、`price-low-to-high` の 1 ページ目が**全体の**最安値から始まること
2. `searchProductIds` のソートキーに `price-low-to-high` → `"minPrice" ASC NULLS LAST, id ASC`、
   `price-high-to-low` → `"minPrice" DESC NULLS LAST, id ASC` を加え、価格ソートのときは検索語が無くても生 SQL の経路を通す
3. `product.ts` のメモリ上の `products.sort(...)` と、ソートにしか使っていない `minDiscountedPrice` を削除する（カード表示に使っている箇所は残す）

**Verify**: Integration → pass。`grep -n "products.sort" src/queries/product.ts` が 0 件

### Step 4: ファセット件数 `getProductFacets`（TDD）

1. `getProductFacets(filters: ProductFilters): Promise<ProductFacet[]>` を新設する。design §2-Q3 の雛形を使い、`base` CTE は plan 075 の `buildProductPredicates` で作る
2. **disjunctive**: 選択中の属性ごとに、その属性の選択だけを外した母集合で 1 クエリずつ数える（クエリ数は「選択中の属性数 + 1」）
3. 「カテゴリに効く facetable 定義と option のラベル」は `unstable_cache`（キーはカテゴリの path、タグは `attribute-definitions`）に載せる。
   属性定義の CRUD（plan 069 の admin 操作）で `revalidateTag("attribute-definitions")` を呼ぶ
4. 統合テスト: 件数が検索語・カテゴリ・他の属性の選択に追随すること、**自分自身の選択では件数が 0 にならない**こと、
   VARIANT スコープの属性も数えられること（ADR-007 の注意書き）、`count(DISTINCT)` で重複計上しないこと

**Verify**: Integration → pass

### Step 5: 属性による絞り込みと UI

1. `?attr.<key>=<value>` を `normalizeProductFilters` で `attributes` に正規化する。存在しない key / value は 0 件（fail-closed）
2. `buildProductPredicates` に属性の述語を加える（同じ定義内は OR、定義間は AND）
3. ブラウズのフィルタ UI に、件数つきのファセットを追加する（design-system-workflow に従い、コンポーネントテスト → 実装 → 実装後の検証）

**Verify**: Component tests と E2E → pass

### Step 6: open question を起票する

`specs/multi-vendor-ecommerce/08-open-questions.md` に「価格の絞り込みは定価か、割引後の価格か」を起票する
（現状: 絞り込みは定価、表示とソートは割引後。根拠は design §0-9）。

**Verify**: `grep -n "割引後" specs/multi-vendor-ecommerce/08-open-questions.md` が 1 件以上

## Test plan

- 統合: Step 2〜4 のケース
- コンポーネント: ファセットの描画、件数の表示、選択の切り替えで URL が変わること
- E2E: カテゴリ → ファセットの選択 → 件数と一覧が一致する、のスモークを `tests/e2e/search-filter.spec.ts` に追加する

## Done criteria

- [ ] `bunx tsc --noEmit` exit 0 / `bun run lint` 0 errors / 上記のテストがすべて pass
- [ ] `grep -n "products.sort" src/queries/product.ts` が 0 件
- [ ] `erd:generate` の結果をコミットに含める
- [ ] `spec-sync-after-test` を実行し、`docs/design/design-system/PROGRESS.md` を同期する
- [ ] 08-open-questions に起票し、`plans/README.md` の 076 の行を更新する

## STOP conditions

- `recomputeProductDerivedColumns` が存在しない（plan 074 が未完了）
- Size の price / discount を書き込む経路が `product.ts` の 3 箇所以外に見つかる（`grep -rnE "price|discount" src/queries/*.ts` で `size` の書き込みを再確認する）
- ファセットのクエリが 1 リクエストで「選択中の属性数 + 1」本を超える
- `minPrice` と `minDiscountedPrice` の値が、丸め以外の理由で一致しない

## Maintenance notes

- Size の price / discount を書く新しい経路を足すときは、`recomputeProductDerivedColumns` を同じ tx で呼ぶこと
- 価格の絞り込みの意味が決まったら（08-open-questions）、`minPrice` で絞るのか、サイズ単位の述語を残すのかを決めて別プランにする
- plan 017（レコメンド）の「同カテゴリの人気商品」は `buildProductPredicates` を再利用できる

## 実施結果（2026-10-03・未コミット）

- `Product.minPrice`（`Decimal(12,2)`・`@@index([minPrice, id])`）を `20261003120300_product_min_price` で追加し backfill。
  価格ソートは `ORDER BY p."minPrice" ASC|DESC NULLS LAST, p.id ASC` に移し、メモリ上の `products.sort` を削除。
  統合テストで「高い順の 1 ページ目が [B, A] になり C が 2 ページ目へ押し出される」旧挙動が Red になることを確認。
- **プランに無かった重要な追加**: E2E seed と luxury seed は `upsertProduct` を通さず行を直接作るため、seed した商品は
  `searchKeywords` が空・`minPrice` が NULL のままになる（バックフィルは適用時点の行にしか効かない）。導出 SQL を
  `src/lib/product-derived-columns.ts` に一元化し、アプリの tx（1 商品）と両 seed の末尾（全商品）から同じ SQL を流す。
- `getProductFacets`: **カテゴリ指定時のみ**返す。disjunctive（選択中 key は自分の選択を外して集計・クエリ数は選択 key 数 + 1）。
  **選択中なのに母集合に無い key も件数 0 で返す**（カテゴリを切り替えて残った `attr.*` を解除できなくなるのを防ぐ）。
  件数はキャッシュしない。ラベルは集計と同じクエリで引くので、定義キャッシュ（Step 4.3 の `unstable_cache`）は不要と判断して実装していない。
- URL は `?attr.<key>=<value>`。key は属性定義と同じ snake_case（`src/lib/attribute-key.ts` に切り出して `schemas.ts` と共有）、key 10・値 20 の上限。
- UI: `filters/attribute/attribute-facet-filter.tsx`（DS-COMP-203）。ファセットは `/browse` の Server Component で
  `getProducts` と並列に取得し props で渡す（失敗時はログを残して空にフォールバック）。値の選択でページ番号は外す。
- E2E: seed に `e2e_finish`（facetable ENUM）を追加し、`search-filter.spec.ts` にファセット選択のスモークを追加。
  a11y の `/browse` スキャンは seed カテゴリで絞った URL に変更（素の /browse は tie-breaker で seed 商品が 1 ページ目に来る保証が無いため）。
- 価格の絞り込みの意味（定価か割引後か）は変えず、`specs/multi-vendor-ecommerce/08-open-questions.md` に起票。
- 残課題: 属性の選択はフィルタ見出しの「Filter (n)」件数と選択中チップに含まれるが（`225e8d76` で `attr.<key>` を `FiltersHeader` の `queries` へ渡すよう修正）、チップのラベルは option の表示名ではなく生の値を表示する。
