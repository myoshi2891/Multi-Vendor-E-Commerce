# Plan 075: ブラウズ検索を検索ベクトルへ統合し、`getProducts` のフィルタを型付けする

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> ```bash
> git diff --stat 3277d8a5 -- src/queries/product.ts src/lib/types.ts src/lib/utils.ts "src/app/(store)/browse/page.tsx"
> git status --porcelain -- src/queries/product.ts src/lib/ "src/app/(store)/browse/"
> ```
> plan 073 / 074 の変更は差分として現れて構わない。`getProducts` のフィルタ構造（`andConditions` に Prisma の where を積む形）が
> 別の形に書き換わっていたら STOP。

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED（ブラウズの主経路を生 SQL に移す）
- **Depends on**: `plans/074-product-search-vector-column.md`
- **Category**: direction
- **Planned at**: commit `3277d8a5`, 2026-10-03
- **設計**: [`design.md`](../docs/design/faceted-search/design.md) §1 / §2-Q2・Q5・Q6

## Why this matters

ユーザーが実際に使っている検索は `/browse?search=` だけで、これは `contains`（ILIKE）による別実装である。
ランキングが無く、brand や keywords にも当たらず、インデックスも使えない。
plan 074 で作った `searchVector` に寄せれば、検索・サジェスト・ファセット（plan 076）が同じ母集合を共有できる。
同時に、規約違反のまま残っている `filters: any`（`product.ts:951`）を型付けし、
slug の逐次解決（4 往復の直列）を並列化する。

## Current state

- `src/queries/product.ts:950-955` — `export const getProducts = async (filters: any = {}, sortBy = "", page = 1, pageSize = 10)`
- `:968-971` — `andConditions: Prisma.ProductWhereInput[]` を `whereClause.AND` に載せる
- `:977-983` — `noMatchResult`（存在しない slug や配列入力は 0 件）
- `:986-1070` — store → category/subCategory（`subtreeOf(node.path)`、`src/lib/category-path.ts:28`）→ size → offer を**逐次** `await`
- `:1073-1113` — 検索: `name` / variant の `variantName` / `keywords` などを `contains` + `mode: "insensitive"`
- `:1115-1145` — 価格: `variants.some.sizes.some.price { gte, lte? }`（`hasPriceBound` で 0 を有効な境界として扱う）
- `:1150-1165` — 色: `variants.some.colors.some.name in`
- `:1183-1200` — `Promise.all([findMany({ where, orderBy, take, skip, include }), count({ where })])`
- `src/app/(store)/browse/page.tsx:79-97` — `normalizePriceParam`（ローカル関数）、`:186-198` — `getProducts` の呼び出し
- 呼び出し元（すべて対応が必要）: `browse/page.tsx:186`、`product/[productSlug]/[variantSlug]/page.tsx:88`、
  `src/components/store/home-luxury-selection`（`components/store` 配下 selection: `:22,28,41`）、`src/components/store/product-page/store-products.tsx:23`、
  `src/components/store/store-page/store-products.tsx:10`
- 規約: `normalizePageParam` / `normalizePositiveIntParam`（`src/lib/utils.ts`）を使うこと。`any` 禁止。
  生 SQL は `Prisma.sql` / `Prisma.join` でパラメータ化。生 SQL でのサブツリーは `LIKE` ではなく
  `starts_with(c.path, $path || '/')`（design §0-13: `LIKE` は slug 中の `_` をワイルドカードとして扱う）

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `bunx tsc --noEmit` | exit 0 |
| Unit tests | `bun run test -- src/queries/product.test.ts src/lib/utils.test.ts` | all pass |
| Integration | `bun run test:integration -- tests/integration/product-browse.test.ts` | all pass（Docker 必須） |
| E2E | `bunx playwright test tests/e2e/search-filter.spec.ts` | all pass |
| Lint | `bun run lint` | 0 errors |

## Scope

**In scope**:
- `src/lib/types.ts`（`ProductFilters`）、`src/lib/utils.ts`（`normalizeProductFilters`、`normalizePriceParam` の移設）と各テスト
- `src/queries/product.ts`（`getProducts` と新設する `searchProductIds`）/ `product.test.ts`
- `src/app/(store)/browse/page.tsx` と上記の呼び出し元
- `tests/integration/product-browse.test.ts`
- `plans/README.md`（Status 行）

**Out of scope**:
- ファセット件数・属性フィルタ・`minPrice`（plan 076）
- 価格の絞り込みの意味（定価か割引後か）の変更（design §2-Q4。plan 076 で open question として起票する）
- サジェスト API（plan 073 / 074 で完了済み）

## Steps

### Step 1: `ProductFilters` と `normalizeProductFilters`（TDD）

design §2-Q5 の型を `src/lib/types.ts` に追加する。`src/lib/utils.ts` に
`normalizeProductFilters(sp: FiltersQueryType): { kind: "ok"; filters: ProductFilters } | { kind: "invalid" }` を追加し、
`browse/page.tsx` の `normalizePriceParam` と `toArrayParam` をここへ移す。
単一値のパラメータ（`search` / `store` / `category` / `subCategory` / `offer`）に配列が来たら `invalid` を返す（現行の fail-closed を維持する）。

**Verify**: `bun run test -- src/lib/utils.test.ts` → 追加したケース（配列入力・空白だけ・`maxPrice=0`・負値）が pass

### Step 2: `getProducts` のシグネチャを型付けする

`filters: any` を `filters: ProductFilters = {}` にする。呼び出し元を 1 つずつ型に合わせる（`browse/page.tsx` は `normalizeProductFilters` を通す）。
**このステップでは挙動を変えない**（既存の単体テストが無修正で通ること）。

**Verify**: `bunx tsc --noEmit` exit 0、`bun run test -- src/queries/product.test.ts` が無修正で pass、`grep -n "filters: any" src/queries/product.ts` が 0 件

### Step 3: slug 解決の並列化

store / category / subCategory / offer の解決を `resolveFilterSlugs()` に切り出して `Promise.all` にする。
どれか 1 つでも見つからなければ `noMatchResult`（現行と同じ）。

**Verify**: 単体テストで `findUnique` 系が並列に呼ばれること（呼び出し順に依存しない期待値）と、1 つが null なら 0 件になることを確かめて pass

### Step 4: 検索語があるときは検索ベクトルで ID を確定する（TDD）

1. `tests/integration/product-browse.test.ts` に Red のテストを追加する:
   - brand / keywords でヒットする（ILIKE では当たらない語を選ぶ）
   - 検索語 + カテゴリ + 価格帯で、**ページサイズより多い**適合商品があるとき、2 ページ目にも適合商品が出る（LIMIT が絞り込みの後に来ていることの確認）
   - 同点を全ページ走査して、重複も欠落も無い
2. `searchProductIds(filters, sort, page, pageSize)` を `product.ts` に新設する。design §2-Q2 の雛形どおり、
   すべての述語を **1 本の生 SQL の `WHERE` に入れ**、`ORDER BY <キー>, id ASC LIMIT/OFFSET`、`count(*) OVER ()` で totalCount を取る。
   ソートキーは `sort` 未指定かつ検索語ありなら `rank DESC`、それ以外は現行の views / createdAt / rating
3. `getProducts` は、検索語があるとき `searchProductIds` で ID を確定し、`findMany({ where: { id: { in: ids } }, include })` で hydrate して、ID の順に並べ直す（`Map` で O(n)）。
   検索語が無いときは、現行の Prisma 経路を維持してよい
4. ILIKE の `contains` ブロック（`:1073-1113`）を削除する

**Verify**: Integration と E2E の行 → all pass。`grep -n 'mode: "insensitive"' src/queries/product.ts` が検索用途で 0 件

## Test plan

- 単体: `normalizeProductFilters` の境界値、`getProducts` の型（`@ts-expect-error` で配列を拒否することを確かめる）
- 統合: 上の Step 4 の 3 ケース + SQL インジェクション文字列（既存の search-products シナリオ 6 と同じ形）
- E2E: `tests/e2e/search-filter.spec.ts` が無修正で通る。通らない場合は、意味の変化（ランキング順）によるものかを切り分けて記録する

## Done criteria

- [ ] `bunx tsc --noEmit` exit 0 / `bun run lint` 0 errors / 上記のテストがすべて pass
- [ ] `grep -n "filters: any" src/queries/product.ts` が 0 件
- [ ] 生 SQL がすべて `Prisma.sql` / `Prisma.join` で組み立てられている（`grep -n '\$queryRawUnsafe' src/queries/product.ts` が 0 件）
- [ ] テスト件数が変わるので `spec-sync-after-test` を実行し、`specs/multi-vendor-ecommerce/04-interfaces.md` の `getProducts` のシグネチャも更新する
- [ ] `plans/README.md` の 075 の行を更新する

## STOP conditions

- plan 074 が未完了（`"searchVector"` 列が存在しない）
- 絞り込みの述語の一部が生 SQL で書けず、Prisma 側に残す必要が出た。LIMIT を最終段に置けない形になるなら止める（design §2-Q2 の anti-pattern）
- hydrate で N+1 が発生する（`findMany` 1 回で済まない）
- E2E が並び順の意味の変化以外の理由で落ちる

## Maintenance notes

- `searchProductIds` は plan 076 のファセット集計の `base` CTE と述語を共有する。述語を組み立てる関数（`buildProductPredicates`）として切り出しておくこと
- レビュアーは `Prisma.sql` の組み立て（条件ごとに `Prisma.empty` / `Prisma.sql` を出し分け、`Prisma.join(…, " AND ")` で連結しているか）を重点的に見る

## 実施結果（2026-10-03・未コミット）

- `getProducts` を「絞り込み → 並び替え → ページングを 1 本の生 SQL で ID と件数を取る → ID で hydrate」に置き換えた
  （`resolveFilterSlugs`（`Promise.all`）/ `buildProductPredicates` / `productOrderBySql`）。`filters: any` は撤去し、
  Server Action への型に反する入力は `parseProductFilters`（`src/lib/utils.ts`）が実行時に検証する（単一値に配列 → 0 件）。
- **プランからの逸脱（退行防止のため）**:
  1. 旧 ILIKE は `variantName` / `variantDescription` も見ていた。`searchKeywords` に入れないと検索できなくなるため、
     補正マイグレーション `20261003120200_search_keywords_variant_text` で取り込んだ（適用済みマイグレーションは編集していない）。
  2. 旧 ILIKE は部分一致（"walnu" → walnut）。`plainto_tsquery` だと単語一致に退行し、サジェストも入力途中の語で出ない。
     **最後の語だけ前方一致**の tsquery を組む `buildPrefixTsQuery`（`src/lib/search-query.ts`）を追加し、サジェストとブラウズで共有。
     トークンは `\p{L}\p{N}` だけに絞るので tsquery 構文の注入は起きない（記号だけの入力は 0 件）。
- 生 SQL のサブツリーは `starts_with`（LIKE 不使用）。値はすべて `Prisma.sql` のパラメータ。
- Step 4 の統合テストは実装後に追加した（Red を経ていない）。うち brand / keywords のケースは旧 ILIKE では当たらない語を選び、退行検知点にしている。
- `normalizePriceParam` / `toArrayParam` を `/browse` から `src/lib/utils.ts` へ移設（テスト追加）。
