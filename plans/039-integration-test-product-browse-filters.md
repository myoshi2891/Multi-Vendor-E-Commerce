# Plan 039: `getProducts`（browse 主経路）のフィルタ合成・ソート・ページングを実 DB 統合テストで固定する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4ec6b5b..HEAD -- src/queries/product.ts tests/integration/`
> If any in-scope/referenced file changed since this plan was written, compare
> the "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **前提チェック（Step 0）**: 本プランは Docker（testcontainers）必須。
> `docker info` が失敗する環境では **STOP**（`plans/README.md` の status 列に
> `BLOCKED (Docker unavailable)` と記録して終了）。

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW（テスト新設のみ。`src/` 本体は 1 行も変更しない）
- **Depends on**: none（他プランと完全独立・並行可）
- **Category**: tests
- **Planned at**: commit `4ec6b5b`, 2026-07-11
- **出典 finding**: TESTS-23（`plans/audit/findings-14-integration-coverage-r6.md`）

## Why this matters

browse ページ（`/browse`）は検索（tsvector — plan 033 が担当）と並ぶ**商品発見の主経路**で、
その供給源 `getProducts` は category / subCategory / size / offer / search / price / color の
フィルタを `whereClause.AND` に動的合成する。ネストした `variants.some.sizes.some` 句、
`mode: "insensitive"` 検索、`lte: Infinity` を Decimal カラムに渡す価格境界、
「存在しない URL のフィルタは黙って脱落して全件返る」挙動 — いずれも Prisma が実際に
SQL を生成して初めて確定する領域で、unit（db 全モック）では固定されていない。
実 DB で固定すれば、**Prisma 5→6 メジャーアップグレード（VETTED_FINDINGS の DEPS-04 spike）の
回帰網**として直接機能する。

## Current state

- `src/queries/product.ts:601-888` — 検証対象 `getProducts(filters, sortBy, page, pageSize)`。
  **変更しない。** 構造:
  - `:614-616` — `whereClause.AND = []` に以下を push:
    - `:619-629` store（URL → id 解決。**見つからなければ push しない = フィルタ脱落**）
    - `:632-655` category / subCategory（同上）
    - `:658-670` size — `variants: { some: { sizes: { some: { size: { in: filters.size } } } } }`
    - `:673-683` offer（URL 解決・同上）
    - `:687-721` search — name / description / variantName / variantDescription の
      `contains` + `mode: "insensitive"` の OR
    - `:724-739` price — `sizes: { some: { price: { gte: minPrice || 0, lte: maxPrice || Infinity } } }`
      ← **minPrice 単独指定時に `Infinity` が Decimal フィルタへ渡る**（実挙動未確認 —
      シナリオ 4 で characterization する）
    - `:742-757` color — `colors: { some: { name: { in: colorsArray } } }`
  - `:759-772` — orderBy: `most-popular`→views desc / `new-arrivals`→createdAt desc /
    `top-rated`→rating desc / デフォルト views desc
  - `:775-794` — `Promise.all([findMany(take/skip/include variants), count])`
  - `:799-826` — **DB 取得後に JS で** price-low-to-high / price-high-to-low を
    ディスカウント後最安値でソート（ページ内ソートであることに注意 — DB レベルではない）
  - `:873-879` — 戻り値 `{ products, totalPages: Math.ceil(totalCount / pageSize),
    currentPage, pageSize, totalCount }`。products は ProductCardType
    （id / slug / name / rating / sales / numReviews / variants / variantImages）
- **認証**: 不要（Public）。**Clerk mock 自体が不要**（getProducts は currentUser を呼ばない）。
  ただし `variantImages` の生成（`:848-855`）が `variant.images[0].url` にフォールバックする
  ため、seed には画像必須 — `seedProductWithVariantAndSize` は画像を 1 件作るので満たされる。
- **seed 上の注意**: `seedProductWithVariantAndSize`（`tests/integration/setup/seed.ts:160-213`）は
  size 固定 "M"・色なし。**size / color フィルタのシナリオでは** `db.size.create` /
  `db.color.create` で追加の Size（"XL" 等）/ Color（"Red" 等）を対象 variant にぶら下げる。
  検索シナリオでは `db.product.update` で name / description を既知の文字列に上書きする
  （seed 名は `Product <ランダム suffix>` のため）。
- **テスト基盤**: `getTestDb` / `disconnectTestDb`（`setup/db.ts`）、`resetDb`
  （`setup/reset-db.ts`）、`seedUser` / `seedStore` / `seedCategoryWithSubcategory` /
  `seedProductWithVariantAndSize`（`setup/seed.ts`）。
- **構造の手本**: `tests/integration/order-placement.test.ts`（lifecycle）。認証 mock が
  不要な分、本ファイルはよりシンプルになる。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Docker 確認 | `docker info` | exit 0（失敗なら STOP） |
| 統合テスト全体 | `bun run test:integration` | 全 pass |
| 単一ファイル | `bun run test:integration -- tests/integration/product-browse.test.ts` | all pass |
| 型チェック | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| unit 回帰 | `bun run test` | 全 pass |

## Scope

**In scope**（変更してよいファイル）:
- `tests/integration/product-browse.test.ts` — **新規作成**

**Out of scope**（触らない）:
- `src/queries/product.ts` — 検証対象本体。**`filters: any` の型付け・`Infinity` 境界の修正・
  ページ内 price ソートの DB 移動などの改善は行わない**（シナリオ 4 で問題が観測されたら
  STOP して所見として報告）
- `src/app/api/search-products/route.ts` — tsvector 検索は plan 033 の領分（重複させない）
- `tests/integration/setup/seed.ts`（追加 Size/Color はテストファイル内で直接 create）

## Git workflow

- 現行ブランチ `dev` 上で作業してよい。コミット規律は `.claude/rules/02-tdd-step-commit.md`:
  テストファイル新設で 1 コミット（例: `test(integration): add getProducts filter/sort/pagination scenarios`）、
  docs 同期は別コミット。push / PR はオペレーターの指示があるまで行わない。

## Steps

### Step 1: drift check とベースライン確認

冒頭の Drift check 実行 → `bun run test:integration` 全 pass 確認。

**Verify**: `bun run test:integration` → 全 pass

### Step 2: `tests/integration/product-browse.test.ts` を新設

ファイル冒頭 JSDoc に検証境界（where 合成・URL 脱落・Decimal 境界・ページング）と
ADR-004 参照を記載。Clerk mock 不要。

共通 Arrange（describe 冒頭の beforeEach で構築するか、各テストで最小構成にする）:
`seedUser` → `seedStore` → カテゴリ 2 系統（`seedCategoryWithSubcategory` × 2）→
商品 3 件以上を属性を変えて seed:
- 商品 A: カテゴリ 1 / 価格 50 / 追加 Size "XL" / Color "Red"（`db.size.create` / `db.color.create`）
- 商品 B: カテゴリ 1 / 価格 150
- 商品 C: カテゴリ 2 / 価格 300 / name を `db.product.update` で "Aurora Lamp" に、
  description を "handmade walnut base" に上書き（検索シナリオ用）

シナリオ:

1. **category / subCategory フィルタの絞り込み**:
   `getProducts({ category: カテゴリ1.url })` → 商品 A・B のみ（totalCount === 2）。
   `getProducts({ subCategory: サブカテゴリ2.url })` → 商品 C のみ
2. **存在しない category URL はフィルタ脱落 → 全件返る（現挙動の characterization）**:
   `getProducts({ category: "no-such-category" })` → totalCount === 3（**0 件ではない**）。
   テストコメントに「絞り込み失敗を空結果でなく全件で返す現仕様の固定」と明記
3. **size / color のネスト some フィルタ**:
   `getProducts({ size: ["XL"] })` → 商品 A のみ。
   `getProducts({ color: "Red" })`（単一文字列 → 配列化経路 `:743-745`）→ 商品 A のみ
4. **価格境界（Decimal + `Infinity` 経路の characterization）**:
   `getProducts({ minPrice: 100, maxPrice: 200 })` → 商品 B のみ。
   `getProducts({ minPrice: 200 })`（**maxPrice なし → `lte: Infinity` が Prisma に渡る**）→
   商品 C のみ、を期待。**この呼び出しが throw する場合は STOP**（`Infinity` を Decimal
   フィルタが受理しない実挙動の発見 — エラー全文を添えて所見報告）
5. **insensitive 検索**: `getProducts({ search: "aurora" })`（小文字）→ 商品 C のみ。
   `getProducts({ search: "WALNUT" })`（description・大文字）→ 商品 C のみ
6. **ページング**: `getProducts({}, "", 1, 2)` → products.length === 2 /
   totalCount === 3 / totalPages === 2 / currentPage === 1。
   `getProducts({}, "", 2, 2)` → products.length === 1。
   1 ページ目と 2 ページ目の商品 id が重複しないこと
7. **複合フィルタ（AND 合成）**: `getProducts({ category: カテゴリ1.url, minPrice: 100 })` →
   商品 B のみ（category ∧ price の交差）

**Verify**: `bun run test:integration -- tests/integration/product-browse.test.ts` → all pass（7 テスト以上）

### Step 3: 全体回帰

**Verify**:
1. `bun run test:integration` → 既存 + 新規 全 pass
2. `bunx tsc --noEmit` → exit 0
3. `bun run lint` → exit 0
4. `bun run test` → unit 全 pass

## Test plan

Step 2 のシナリオ 1〜7 が本体。構造の手本は `tests/integration/order-placement.test.ts`。
完了後、テスト統計が変わるため **`spec-sync-after-test` skill を必ず起動**
（`.claude/rules/02-tdd-step-commit.md` の MUST。Integration 統計の SSOT は
`docs/testing/QA_HANDOFF.md`）。

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run test:integration` exits 0; `product-browse.test.ts` の新規テストが全 pass
- [ ] シナリオ 2 に「存在しない URL → 全件」の characterization assert とコメントが存在する
- [ ] シナリオ 4 に minPrice 単独（`Infinity` 経路)の assert が存在する
- [ ] `bunx tsc --noEmit` exits 0 / `bun run lint` exits 0 / `bun run test` exits 0
- [ ] `git status` で in-scope 外のファイルに変更がない
- [ ] docs 同期（QA_HANDOFF 統計 + ダッシュボード再生成）が別コミットで完了
- [ ] `plans/README.md` の 039 行が DONE に更新済み

## STOP conditions

Stop and report back (do not improvise) if:

- `docker info` が失敗する（→ `BLOCKED (Docker unavailable)`）
- Drift check で `getProducts` の where 合成が本プランの抜粋と一致しない
- **シナリオ 4 の minPrice 単独指定が throw する** — `Infinity` を Prisma の Decimal フィルタが
  受理しない実挙動。エラー全文と Prisma バージョンを添えて**所見として報告**
  （期待値の合わせ込み・`src/` の修正はしない）
- シナリオ 2 で 0 件が返る（フィルタ脱落仕様が変わっている）— 変更コミットを特定して報告
- seed した商品が返らず、原因が `variant.images[0]` の undefined 参照（`:853`）にある —
  seed 構成の問題なので Arrange を見直す（`seedProductWithVariantAndSize` は画像を作るため
  通常は起きない。直接 `db.product.create` で seed した場合のみ起きうる）
- 検証コマンドが 2 回の修正試行後も失敗する

## Maintenance notes

- **price-low-to-high / price-high-to-low はページ内 JS ソート**（`:799-826`）であり、
  ページを跨いだ全体ソートにはなっていない。本プランではこの並び自体を assert しない
  （ページング済み配列への安定ソートの検証は脆い）。DB レベルソートへ改善する際は
  シナリオ 6 に順序 assert を追加すること。
- `filters: any`（`:602`）の型付けリファクタが将来入る場合、本テストが入力互換性の回帰網。
- Prisma 5→6 アップグレード（DEPS-04 spike）の際は、本ファイルと plan 033
  （tsvector raw SQL）を最初に回すことで browse/search 両経路の互換性が即判定できる。
