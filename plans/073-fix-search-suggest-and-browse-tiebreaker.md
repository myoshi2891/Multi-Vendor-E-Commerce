# Plan 073: ヘッダー検索のサジェストを復旧し、ブラウズの並び順を全順序にする

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> ```bash
> git diff --stat 3277d8a5 -- src/app/api/search-products/ src/components/store/layout/header/search/ src/queries/product.ts src/queries/product.test.ts tests/integration/search-products.test.ts
> git status --porcelain -- src/app/api/search-products/ src/components/store/layout/header/search/ src/queries/product.ts
> ```
> いずれかに変更があれば「Current state」の抜粋と現行コードを突き合わせ、食い違えば STOP。

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `3277d8a5`, 2026-10-03
- **設計**: [`docs/design/faceted-search/design.md`](../docs/design/faceted-search/design.md) §0（0-3 / 0-8）

## Why this matters

2 つの既存バグを直す。どちらも利用者に見えている。

1. **ヘッダー検索のサジェストが常に空**。UI は `/api/search-products?search=…` で問い合わせるが、route は `q` しか読まないので
   必ず `[]` が返る。仮に `q` で問い合わせても、route は `id/name/description/relevance` を返し、UI は
   `link && name && image` を必須として絞り込むので、全件落ちる。
2. **ブラウズの並び順が全順序でない**。`orderBy` が `views` / `createdAt` / `rating` の単一キーで、
   ローカル DB では `views = 0` が 80 件中 73 件ある。同点の並び順は PostgreSQL が保証しないので、
   OFFSET でページングすると、ある商品が 2 ページに出たり、どのページにも出なかったりする。

## Current state

- `src/components/store/layout/header/search/search.tsx:56-84` — サジェストの取得。`?search=` で問い合わせ、
  `items.filter((item) => item.link && item.name && item.image)` で絞り込む
- `src/app/api/search-products/route.ts:7-12, 22-23, 33-44` — `type ProductSearchRow = { id; name; description; relevance }`、
  `searchParams.get("q")`、`ORDER BY relevance DESC LIMIT 50`
- `src/lib/types.ts:379-383` — `export interface SearchResult { name: string; link: string; image: string; }`
- 商品ページの URL は `/product/<productSlug>/<variantSlug>`（例: `src/components/store/cards/cart-product.tsx:212`）
- `src/queries/product.ts:1167-1180` — 単一キーの `orderBy`:
  ```ts
  let orderBy: Record<string, SortOrder> = {};
  switch (sortBy) {
      case "most-popular": orderBy = { views: "desc" }; break;
      case "new-arrivals": orderBy = { createdAt: "desc" }; break;
      case "top-rated":    orderBy = { rating: "desc" }; break;
      default:             orderBy = { views: "desc" };
  }
  ```
- 既存のテスト: `src/queries/product.test.ts:1564-1595`（`orderBy: { views: "desc" }` などを期待している）、
  `tests/integration/search-products.test.ts`（`?q=` で呼んでいる）
- 規約: 生 SQL は `Prisma.sql` でパラメータ化する（route の既存パターン）。`any` は禁止

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `bunx tsc --noEmit` | exit 0 |
| Unit tests | `bun run test -- src/queries/product.test.ts src/app/api/search-products/route.test.ts` | all pass |
| Component tests | `bun run test -- tests/component/store/header-search.test.tsx` | all pass |
| Integration | `bun run test:integration -- tests/integration/search-products.test.ts tests/integration/product-browse.test.ts` | all pass（Docker 必須） |
| Lint | `bun run lint` | 0 errors |

## Scope

**In scope**:
- `src/app/api/search-products/route.ts` / `route.test.ts`
- `src/components/store/layout/header/search/search.tsx`
- `tests/component/store/header-search.test.tsx`（新規作成）
- `src/queries/product.ts`（`orderBy` の部分だけ）/ `src/queries/product.test.ts`
- `tests/integration/search-products.test.ts` / `tests/integration/product-browse.test.ts`
- `plans/README.md`（Status 行。docs 用の別コミットで更新）

**Out of scope**:
- 検索ベクトル列の追加（plan 074）。tsvector の式はこのプランでは変えない
- 価格ソートがページ内でしか効かない問題（design §0-7）。`minPrice` 列が必要なので plan 076 で直す
- `getProducts` の `filters: any`（plan 075）

## Steps

### Step 1: サジェスト API を `SearchResult` 形で返す（TDD）

1. `tests/integration/search-products.test.ts` に Red のテストを追加する: 応答の各要素が `name` / `link` / `image` を持ち、
   `link` が `/product/<productSlug>/<variantSlug>` の形であること。件数の上限は 8 件
2. route を直す: 検索 SQL で `p.id` を ID 順位として取り（`ORDER BY relevance DESC, p.id ASC LIMIT 8`。**tie-breaker を付ける**）、
   `db.product.findMany({ where: { id: { in } }, select: { name, slug, variants: { take: 1, select: { slug, images: { take: 1, select: { url } } } } } })`
   で hydrate し、SQL の順位どおりに並べ直してから `SearchResult[]` を返す。
   **バリアントや画像の無い商品は応答から除く**（UI が `image` を必須にしているため）
3. パラメータ名は `q` を正とし、互換のため `search` も受け付ける（`get("q") ?? get("search") ?? ""`）

**Verify**: 統合テストを実行 → 追加したテストが pass する。`curl -s 'localhost:3000/api/search-products?q=product'` が `[{"name":…,"link":"/product/…","image":"…"}]` の形を返す

### Step 2: UI を `q` で問い合わせるようにする（TDD）

1. `tests/component/store/header-search.test.tsx` を作成する。`fetch` をモックし、2 文字以上の入力で
   `/api/search-products?q=` が呼ばれること、`SearchResult` の配列がサジェストとして描画されることを確かめる（Red → Green）
2. `search.tsx:57` の `?search=` を `?q=` に変える

**Verify**: `bun run test -- tests/component/store/header-search.test.tsx` → pass

### Step 3: `orderBy` に `id` の tie-breaker を足す（TDD）

1. `src/queries/product.test.ts:1564-1595` の期待値を `orderBy: [{ views: "desc" }, { id: "asc" }]` などに変える（Red）
2. `product.ts` の `orderBy` を `Prisma.ProductOrderByWithRelationInput[]` にし、すべての分岐の末尾に `{ id: "asc" }` を足す
3. `tests/integration/product-browse.test.ts` に、`views` が全件同じ商品群をページサイズ 2 で全ページ走査し、
   **id の重複も欠落も無い**ことを確かめるテストを追加する

**Verify**: Unit tests と Integration の行 → all pass

## Test plan

- 統合: サジェストの応答の形、tie-breaker、0 件、空白だけのクエリ（既存のシナリオ 4/5 を維持する）
- コンポーネント: `q` での問い合わせ、2 文字未満では問い合わせないこと、AbortController によるキャンセル
- 統合: 同点の商品群を全ページ走査して、重複も欠落も無いこと

## Done criteria

- [ ] `bunx tsc --noEmit` exits 0、`bun run lint` 0 errors
- [ ] 上記のテストが pass する（新規のコンポーネントテスト 1 ファイルを含む）
- [ ] `grep -n "search-products?search=" src/` が 0 件
- [ ] `grep -nE "orderBy = \{ (views|createdAt|rating)" src/queries/product.ts` が 0 件
- [ ] テスト件数が変わるので `spec-sync-after-test` を実行する（`.claude/rules/02-tdd-step-commit.md`）
- [ ] `plans/README.md` の 073 の行を更新する

## STOP conditions

- `search.tsx` が既に `q` を使っている、または route が既に `SearchResult` の形を返している（前提が消えている）
- サジェストの hydrate で商品ごとにクエリが発行される（N+1）。`findMany` の 1 回で済まない場合は止めて報告
- tie-breaker を足すと、既存の E2E（`tests/e2e/search-filter.spec.ts` など）の期待する並び順が変わり、修正範囲が Scope の外に及ぶ

## Maintenance notes

- 価格ソート（`price-low-to-high` / `price-high-to-low`）は、このプランの後も**ページ内でしか並べ替えていない**。plan 076 で直す
- plan 074 は、Step 1 の検索 SQL の述語を `"searchVector" @@ …` に差し替える

## 実施結果（2026-10-03・未コミット）

- **Step 1（サジェスト API）**: `route.ts` を「ID を順位付け（`ts_rank DESC, id ASC`・LIMIT 8）→ `findMany` で hydrate →
  順位どおりに並べ直す」形にし、応答を `SearchResult + id` にした。**バリアントの無い商品の除外は SQL の WHERE 段で行う**
  （LIMIT の後で間引くと 8 件に欠ける —— 統合シナリオ 11 で固定）。`?search=` も互換で受理。
- **Step 2（UI）**: `search.tsx` を `?q=` へ。**範囲外の追加修正**: サジェストを復旧すると `suggestions.tsx` の
  `new RegExp(query)` が `(` などで SyntaxError を投げて描画が落ちる潜在バグが表に出るため、メタ文字をエスケープした。
  key も重複しうる `name` から `link` へ。
- **Step 3（tie-breaker）**: `orderBy` を `[主キー, { id: "asc" }]` に。統合テストは「物理順を id 降順にそろえる」Arrange で、
  tie-breaker を外すと確実に落ちることを確認済み（外した状態で Red → 戻して Green）。
- Red: コンポーネント 2 件（`?search=` で呼ぶ / RegExp SyntaxError）、統合 5 件、単体 3 件を期待した理由で確認。
- E2E: `search-filter.spec.ts` chromium 6/6（tie-breaker で並び順が変わっても既存 E2E に影響なし）。
- 後続の 075 で getProducts は生 SQL に移り、tie-breaker は `ORDER BY …, p.id ASC` として引き継いだ。
