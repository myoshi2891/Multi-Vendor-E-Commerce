# Plan 046: /browse に最小のページネーションを配線し、search-filter のページネーション E2E を実データで有効化する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6ad7b05..HEAD -- src/app/\(store\)/browse src/components/store/browse-page src/components/store/shared/pagination.tsx src/queries/product.ts tests/e2e/search-filter.spec.ts tests/e2e/seed/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED（`src/` の feature 配線を含む。UI 追加が既存 browse スペックへ波及し得る）
- **Depends on**: none（plan 045 と同じ seed ファイルを触るため、両方実行する場合は
  先行プランの diff を取り込むこと）
- **Category**: tests（+ 最小の feature 配線）
- **Planned at**: commit `6ad7b05`, 2026-07-11

## Why this matters

`tests/e2e/search-filter.spec.ts:62` のページネーションテストは skip されたまま放置されて
いるが、Round 8 の再監査（findings-16 TESTS-32・訂正版）で skip の真因が判明した:
**/browse にはページネーション UI 自体が実装されていない**。`getProducts` は
`page`/`pageSize`/`totalPages` を実装済み（`src/queries/product.ts:601-605,870`）なのに、
browse ページが `page` searchParam を読まず、ページャも描画しないため、
**商品が 11 件以上あっても先頭 10 件しか表示できない**。カタログが成長すると顧客が
商品に到達できなくなる dormant バグであり、最小の配線（searchParams 読み取り + ページャ
描画）を入れた上で、実データの E2E で固定する。

## Current state

- `src/app/(store)/browse/page.tsx:20-33` — searchParams から category/offer/search 等を
  分解するが **`page` を読んでいない**。`getProducts(filters, sort)` と 2 引数で呼ぶ:

```typescript
// src/app/(store)/browse/page.tsx:33-52（抜粋）
const products_data = await getProducts(
    { search, category, subCategory, offer, size: ..., minPrice: ..., maxPrice: ..., color: ... },
    sort
);
const { products } = products_data;
```

- `src/queries/product.ts:601-606` — シグネチャは配線を待っている:

```typescript
export const getProducts = async (
    filters: any = {},
    sortBy = "",
    page: number = 1,
    pageSize: number = 10
) => {
```

  返却値に `totalPages` / `currentPage` / `totalCount` を含む（`:870-877`）。
- `src/components/store/shared/pagination.tsx` — 既存の共有ページャ。props は
  `{ page, totalPages, setPage }` の**クライアント state 型**（Previous / Next / 番号）。
  URL 遷移型ではないため、/browse で使うには URL 同期の薄いラッパーが必要。
- **URL パラメータ正規化の repo 規約**（`.claude/steering/tech.md`）:
  「ページ番号など数値パラメータは `Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1`
  で正規化すること（`Infinity` / `NaN` / 小数を排除）」— Step 1 で必ず適用する。
- `tests/e2e/search-filter.spec.ts:62-87` — 現 skip テスト。`page.route("**/api/index-products*")`
  の route-mock は SSR ページに効かないため**全面書き換え**（findings-16 Rejected 節も参照）。
- E2E seed: `tests/e2e/seed/constants.ts`（`buildE2ESeed` がワーカー毎サフィックスを付与）+
  `tests/e2e/seed/seed-e2e.ts`（upsert 冪等）。現状商品 2 種のみで 2 ページ目が発生しない。
- **`tests/e2e/search-filter.spec.ts` のテスト構成（実ファイル突合済み）**— 期待 passed 数の根拠:
  | 行 | テスト | 状態 |
  |---|---|---|
  | `:19` | 商品名で検索し結果が表示される | active |
  | `:29` | カテゴリフィルタで絞り込まれる | active |
  | `:40` | フィルタ条件が URL パラメータに反映される | active |
  | `:54` | 検索結果 0 件で適切なメッセージ表示される | active |
  | `:62` | ページネーションで次ページに遷移できる | **skip（本プランで有効化）** |

  **合計 5 テスト**（active 4 + skip 1）。本プランは skip を active に変えるだけで
  テスト**数は増えない**ため、期待値は **chromium 単体 5 passed / 3 ブラウザ 15 passed
  （5 × 3）**、skip 0。既存 active 4 件は実データ方式のため、追加 seed が件数 assert を
  壊さないか Step 4 / Step 5 で回帰確認する。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| 型 / Lint | `bunx tsc --noEmit` / `bun run lint` | exit 0 |
| seed 再投入（冪等） | `bun run seed:e2e` | exit 0 ×2 回 |
| 対象 spec（chromium） | `bash scripts/e2e/run-local.sh tests/e2e/search-filter.spec.ts --project=chromium` | skip 0 で all passed |
| 3 ブラウザ | `bash scripts/e2e/run-local.sh tests/e2e/search-filter.spec.ts` | all passed |
| ユニット回帰 | `bun run test -- src/queries/product.test.ts` | pass（存在する場合） |

## Scope

**In scope**:
- `src/app/(store)/browse/page.tsx` — `page` searchParam の読取・正規化・`getProducts` への配線・ページャ描画
- `src/components/store/browse-page/browse-pagination.tsx`（新規・client component）—
  共有 `Pagination` を URL 遷移に橋渡しする薄いラッパー
- `tests/e2e/search-filter.spec.ts` — skip テストの実データ書き換え
- `tests/e2e/seed/constants.ts` / `tests/e2e/seed/seed-e2e.ts` — ページネーション専用カテゴリ +
  商品 12 件の追加

**Out of scope**:
- `src/components/store/shared/pagination.tsx` 本体の改変（他 3 箇所で使用中。ラッパーで吸収する）
- `src/queries/product.ts`（`getProducts` は変更不要。`filters: any` の型改善も別件）
- `/api/index-products`（別経路。本プランは SSR ページのみ）
- ソート・フィルタとページングの組合せ網羅（初版は素の `?page=` 遷移のみ）

## Git workflow

- Branch: `advisor/046-browse-pagination-e2e`
- コミット分割: (1) `feat(store): wire page param and pagination into /browse`
  (2) `test(e2e): seed pagination category with 12 products`
  (3) `test(e2e): enable pagination spec against real data`
  (4) ドキュメント同期（Step 6）
- push / PR はオペレーター指示があるときのみ。

## Steps

### Step 1: /browse に page パラメータを配線する

`src/app/(store)/browse/page.tsx` で:

1. searchParams の分解に `page` を追加。
2. tech.md 規約どおり正規化する:

```typescript
const rawPage = Number(Array.isArray(page) ? page[0] : page);
const currentPage =
    Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
```

3. `getProducts(filters, sort, currentPage)` と 3 引数で呼び、返却の `totalPages` を受け取る。
4. `<ProductList products={products} />` の直後に、`totalPages > 1` のときだけ
   `<BrowsePagination page={currentPage} totalPages={totalPages} />` を描画する。

**Verify**: `bunx tsc --noEmit` → exit 0

### Step 2: BrowsePagination ラッパーを作る（client）

`src/components/store/browse-page/browse-pagination.tsx` を新規作成。要件:

- `"use client"`。props は `{ page: number; totalPages: number }`。
- `useRouter` + `useSearchParams`（`next/navigation`）で、共有 `Pagination` の `setPage`
  相当を「既存クエリを保持したまま `page` だけ差し替えて `router.push`」に変換する:

```typescript
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import Pagination from "@/components/store/shared/pagination";

export default function BrowsePagination({ page, totalPages }: { page: number; totalPages: number }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const goTo = (next: number | ((prev: number) => number)) => {
        const value = typeof next === "function" ? next(page) : next;
        const params = new URLSearchParams(searchParams.toString());
        params.set("page", String(value));
        router.push(`/browse?${params.toString()}`);
    };
    return <Pagination page={page} totalPages={totalPages} setPage={goTo} />;
}
```

※ 共有 `Pagination` の `setPage` は `Dispatch<SetStateAction<number>>` 型のため、
関数形式（`(prev) => prev + 1`）呼び出しの両対応が必要（上記 `goTo` が吸収する）。

**Verify**: `bunx tsc --noEmit` / `bun run lint` → exit 0

### Step 3: ページネーション専用カテゴリと商品 12 件を seed に追加する

1. `tests/e2e/seed/constants.ts` — `BASE_E2E_SEED` に専用カテゴリ
   （name: `E2E Pagination`, url: `e2e-pagination`）を追加し、既存 `category` と同じ
   `withSuffix` 適用パターンに従う。
2. `tests/e2e/seed/seed-e2e.ts` — 専用カテゴリ + サブカテゴリを upsert 後、ループで
   商品 12 件（slug: `e2e-page-item-01` 〜 `-12` に suffix 適用、最小構成: variant 1 +
   size 1 + image 1）を既存 product upsert と同じ形で upsert する。価格・在庫は一定で良い。
3. **既存カテゴリには追加しない**（search-filter `:37` のカテゴリフィルタ assert と
  purchase-flow の件数前提を壊さないため）。

**Verify**: `bun run seed:e2e` を 2 回実行しどちらも exit 0（冪等）。
`bunx tsc --noEmit` → exit 0

### Step 4: skip テストを実データ方式に書き換える

`tests/e2e/search-filter.spec.ts:62` の `test.skip(...)` を `test(...)` に変え、本文を
route-mock から実データ検証へ全面書き換え:

```typescript
test("ページネーションで次ページに遷移できる", async ({ page }) => {
    // 専用カテゴリ（12 商品 > pageSize 10）で決定的に 2 ページ構成にする
    const category = seed.paginationCategory.url;
    await page.goto(`/browse?category=${category}`);
    // 1 ページ目: 10 件
    await expect(page.locator('[data-testid^="product-card-"]')).toHaveCount(10);
    // Next で 2 ページ目へ（BrowsePagination が ?page=2 を push する）
    await page.getByText("Next", { exact: true }).click();

    // page=2 になっただけでなく、**既存の category クエリが保持されている**ことを assert する。
    // Step 2 の goTo() は「既存クエリを保持したまま page だけ差し替える」実装であり、
    // それを検証しないと category を落とす実装（全件 2 ページ目へ飛ぶ）でも green になる。
    // この場合 1 ページ目 10 件 / 2 ページ目 2 件という件数も偶然一致しうるため、
    // 件数 assert では category 脱落を検出できない。
    await expect(page).toHaveURL(new RegExp(`[?&]category=${category}(&|$)`));
    await expect(page).toHaveURL(/[?&]page=2/);
    await expect(page.locator('[data-testid^="product-card-"]')).toHaveCount(2);

    // 不正 page 値は 1 に正規化される（tech.md URL 正規化規約の固定）
    await page.goto(`/browse?category=${category}&page=abc`);
    await expect(page.locator('[data-testid^="product-card-"]')).toHaveCount(10);
});
```

（`seed.paginationCategory` は Step 3 で constants に追加した名前に合わせる。
product-card の testid 契約は `src/components/store/cards/product/product-card.tsx:70`
`data-testid={`product-card-${slug}`}`。）

**Verify**: `bash scripts/e2e/run-local.sh tests/e2e/search-filter.spec.ts --project=chromium`
→ **5 passed / skip 0**（Current state の内訳表のとおり active 4 + 有効化した 1。
本プランでテスト数は増えない）

### Step 5: 3 ブラウザ + 回帰確認

**Verify**:
- `bash scripts/e2e/run-local.sh tests/e2e/search-filter.spec.ts` → **15 passed**（5 × 3 ブラウザ）
- `bash scripts/e2e/run-local.sh tests/e2e/purchase-flow.spec.ts tests/e2e/layout-chrome.spec.ts --project=chromium` → 既存分 passed（seed 追加の波及なし）

### Step 6: ドキュメント同期

テスト数変動のため `spec-sync-after-test` skill を起動（`.claude/rules/02-tdd-step-commit.md`
の MUST）。あわせて機能追加（/browse ページネーション）なので
`specs/multi-vendor-ecommerce/` の該当（04-interfaces / 05-workflows）への反映有無を
skill の手順に従い確認する。

**Verify**: 同期コミットに QA_HANDOFF.md / coverage-dashboard.html が含まれる

## Test plan

- E2E: 書き換えた 1 テスト（1 ページ目 10 件 → Next → **category 保持 +** page=2 →
  2 ページ目 2 件 → 不正値正規化）。
- 既存 search-filter の active 4 テスト + purchase-flow / layout-chrome の回帰 green。
- 期待 passed 数: chromium 5 / 3 ブラウザ 15（内訳は Current state の表）。
- （任意・推奨）`BrowsePagination` の RTL component テスト: `router.push` が既存クエリを
  保持して `page` を差し替えることを 1 ケース。手本: `src/components/store/shared/pagination.test.tsx`。

## Done criteria

- [ ] `bunx tsc --noEmit` / `bun run lint` exit 0
- [ ] search-filter spec が skip 0・chromium 5 passed / 3 ブラウザ 15 passed
      （active 4 + 有効化した 1 = 5。本プランでテスト数は増えない）
- [ ] ページ送り後の URL assert に **`category` の保持**が含まれている
      （`page=2` だけの assert では、既存クエリを落とす実装でも green になる）
- [ ] `/browse?category=<専用>&page=abc` が 1 ページ目扱い（テストで固定済み）
- [ ] `bun run seed:e2e` 冪等（2 回連続 exit 0）
- [ ] `git status` で in-scope 外の変更なし
- [ ] `plans/README.md` の 046 行を DONE に更新

## STOP conditions

- `getProducts` の返却形が「Current state」の記述（`totalPages` 含む）と異なる。
- 共有 `Pagination` の props 型が `{ page, totalPages, setPage }` から変わっている。
- seed 追加後に search-filter / purchase-flow の既存テストが fail した（波及の設計見直しが必要）。
- ページャ描画で browse ページの既存レイアウト（フィルタサイドバー等）が崩れる
  （スクリーンショットを添えて報告 — デザイン判断はオペレーターに委ねる）。

## Maintenance notes

- **plan 045 と同じ seed ファイルを編集する**。両方実行する場合は後発が先発の diff を
  取り込むこと（衝突箇所は constants.ts / seed-e2e.ts の末尾追加部）。
- 今後 `/browse` にソートとページングの組合せテストを足す場合、`BrowsePagination` が
  クエリを保持する設計（Step 2）が前提になる — ラッパーを迂回して `<Link href>` 直書きに
  変えるとソート維持が壊れる。
- `Pagination` 共有コンポーネントの番号ボタンは `totalPages` 分を全描画する実装
  （`pagination.tsx:37-52`）。カタログが数百ページ規模になったら省略表示（`…`）の改修が
  必要になるが、それは本プランのスコープ外として意図的に見送った。
