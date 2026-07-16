# Plan 052: a11y スキャンをストアフロント主要ページ（browse / 商品詳細 / cart）へ拡大する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 99ede89..HEAD -- tests/e2e/a11y/ src/components/store/icons/ src/components/store/layout/footer/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition。**例外**: `src/components/store/icons/` の
> `aria-label` 追加差分は plan 042 Step 4 の成果（本プランの前提）なので STOP 不要。

## Status

- **Priority**: P2
- **Effort**: S〜M
- **Risk**: LOW〜MED（初回スキャンで未知の違反が出る可能性）
- **Depends on**: `plans/042-e2e-signin-helper-repair.md` — **Step 4（`send.tsx` 等への
  `aria-label` 追加 = TESTS-27 修正）が完了していること**。未完了だと browse / 商品詳細 /
  cart はフッター由来の `svg-img-alt`（serious）で全滅する。042 の他ステップ（signIn 修復）
  には依存しない。
- **Category**: tests
- **Planned at**: commit `99ede89`, 2026-07-12

## Why this matters

E2E 残余監査（`plans/audit/findings-17-e2e-coverage-r9.md` TESTS-43）で、axe スキャンの
対象が sign-in / checkout / profile / seller-apply の 4 ページのみで、**顧客が最も長く
滞在するゲストページ（browse / 商品詳細 / cart）が未スキャン**であることを確認した。
R8 実測では認証不要ページの `/sign-in` から serious 違反（svg-img-alt）が実際に検出されて
おり、主要ページに同種の違反が潜在していても検出経路が無い。3 ページとも認証不要のため、
認証系 E2E の修復を待たず安定して回る。

## Current state

- `tests/e2e/a11y/` の既存 4 spec: `sign-in.spec.ts` / `checkout.spec.ts` / `profile.spec.ts` /
  `seller-apply.spec.ts`。共通ヘルパー `_helpers.ts` の `runA11yScan(page, url, opts)` が
  WCAG 2.1 AA タグでスキャンし、violations 0 を assert する（readinessLocator で
  ページ準備完了を待ち、`disabledRules` で既知負債を抑制できる）。
- **ゲストページの手本**は `seller-apply.spec.ts`（認証不要・chromium 限定ゲート付き）:

```ts
// tests/e2e/a11y/seller-apply.spec.ts:14-30
test.describe("a11y: /seller/apply (Step 1)", () => {
    test.skip(
        ({ browserName }) => browserName !== "chromium",
        "a11y スキャンは chromium 限定（レンダリング差を排除）"
    );
    test("WCAG 2.1 AA 違反が無いこと", async ({ page }) => {
        await runA11yScan(page, "/seller/apply", {
            readinessLocator: page.getByRole("main"),
            // TODO(a11y): color-contrast は既知のデザイン負債（...）
            disabledRules: ["color-contrast"],
        });
    });
});
```

- **`color-contrast` は既知負債として全 spec で disable する**（追跡:
  `docs/testing/QA_HANDOFF.md`「a11y color-contrast 負債」。disable には上記の TODO
  コメント形式で根拠を書く — `_helpers.ts` の docstring が規定する規約）。
- **フッター由来の svg-img-alt**: `src/components/store/icons/send.tsx` 等の
  `role="img"` な `<svg>` に `aria-label` が無い違反は plan 042 Step 4 が修正する。
  本プラン着手前に `grep -n "aria-label" src/components/store/icons/send.tsx` で
  修正済みであることを確認する（Step 0）。
- **home（`/`）は対象外**: `featured.tsx:13` の `window` 初期化子で本番ビルド SSR が
  500 になる既知バグ（OI-9 — `docs/testing/QA_HANDOFF.md` 参照）が未解消。E2E は
  `next build && next start` で走るため、OI-9 解消後に追加する（Maintenance notes 参照）。
- 商品詳細ページの URL は seed 依存: `/product/${seed.product.slug}/${seed.variant.slug}`。
  seed 値は `buildE2ESeed({ parallelIndex, projectName })`（`tests/e2e/seed/constants.ts`）
  から取得する（slug はワーカー毎サフィックス付き — ハードコードしない）。
  事前に `bun run seed:e2e` で DB に投入されている前提（`scripts/e2e/run-local.sh` が実行する）。
- cart ページの空状態には `data-testid="cart-empty-message"` がある
  （`tests/e2e/visual/cart.spec.ts:53` が使用中）。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| 前提確認（042 Step 4 済み） | `grep -n "aria-label" src/components/store/icons/send.tsx` | 1 件以上ヒット |
| 型チェック / Lint | `bunx tsc --noEmit` / `bun run lint` | exit 0 |
| 新 spec 実行（chromium） | `bash scripts/e2e/run-local.sh tests/e2e/a11y --project=chromium` | 042 完了時 **7 passed** / 042 未完了時 **5 passed + 2 failed**（checkout・profile のみ。Step 3 の表を参照） |
| 既存回帰確認 | `bash scripts/e2e/run-local.sh tests/e2e/a11y/seller-apply.spec.ts --project=chromium` | passed |

## Scope

**In scope**:
- `tests/e2e/a11y/browse.spec.ts`（新規）
- `tests/e2e/a11y/product.spec.ts`（新規）
- `tests/e2e/a11y/cart.spec.ts`（新規）

**Out of scope**:
- `src/` 配下すべて（**違反が見つかっても本プランでは修正しない** — STOP 節の手順で報告）
- home（`/`）のスキャン（OI-9 先行依存）
- 既存 4 spec の変更（disabledRules の増減を含む）
- firefox / webkit への拡大（既存方針: a11y は chromium 限定）

## Git workflow

- Branch: `advisor/052-e2e-a11y-storefront-expansion`
- コミット分割（`.claude/rules/02-tdd-step-commit.md` 準拠）: 3 spec は同一カテゴリ
  （a11y スイート）・各 30 行前後・`runA11yScan` を共有（インポート共有 50% 超）のため
  **1 コミットに同梱可**（3 ファイル・計 200 行未満の基準内）:
  1. `test(e2e): add a11y scans for browse / product detail / cart`
  2. ドキュメント同期は別コミット（Step 4）
- push / PR はオペレーター指示があるときのみ。

## Steps

### Step 0: 前提を確認する

`grep -n "aria-label" src/components/store/icons/send.tsx` → 1 件以上。
0 件なら plan 042 Step 4 が未完了 — **STOP**（本プランは着手不可。042 の完了を依頼する）。

### Step 1: 3 つの a11y spec を作成する

`seller-apply.spec.ts` の構造（chromium 限定ゲート + `runA11yScan` + color-contrast
disable + TODO コメント）をそのまま踏襲して 3 ファイルを作る:

1. **`tests/e2e/a11y/browse.spec.ts`** — `runA11yScan(page, "/browse", {...})`。
   readinessLocator は商品カード（`page.locator('[data-testid^="product-card-"]').first()`）。
2. **`tests/e2e/a11y/product.spec.ts`** — seed から URL を組む:

```ts
import { buildE2ESeed } from "../seed/constants";
// テスト内:
const seed = buildE2ESeed({
    parallelIndex: testInfo.parallelIndex,
    projectName: testInfo.project.name,
});
await runA11yScan(page, `/product/${seed.product.slug}/${seed.variant.slug}`, {
    readinessLocator: page.getByTestId("add-to-cart"),
    disabledRules: ["color-contrast"],
});
```

   （`testInfo` は `test("...", async ({ page }, testInfo) => {...})` の第 2 引数で受ける）
3. **`tests/e2e/a11y/cart.spec.ts`** — 空カート状態のスキャン。
   readinessLocator は `page.getByTestId("cart-empty-message")`。
   （商品入りカートのスキャンは checkout.spec.ts のセットアップと重複が生じるため
   空状態のみとする）

3 ファイルとも `disabledRules: ["color-contrast"]` + seller-apply.spec.ts と同形式の
TODO コメント（根拠 + 追跡先 `docs/testing/QA_HANDOFF.md`「a11y color-contrast 負債」）を
付けること。

**Verify**: `bunx tsc --noEmit` / `bun run lint` → exit 0

### Step 2: chromium で実行し、違反をトリアージする

`bash scripts/e2e/run-local.sh tests/e2e/a11y/browse.spec.ts tests/e2e/a11y/product.spec.ts tests/e2e/a11y/cart.spec.ts --project=chromium`

- **3 passed** → Step 3 へ。
- **違反が検出された場合**（`_helpers.ts` が violations の JSON サマリを出力する）:
  違反の `id` / `impact` / `nodes` を記録して **STOP し報告する**。勝手に
  `disabledRules` へ追加して黙らせない（既存で許可されている disable は
  `color-contrast` のみ）。報告には「どのコンポーネントの何が原因か」を axe の
  target セレクタから特定して添える。

**Verify**: 上記コマンド → 3 passed（違反ゼロ）

### Step 3: a11y スイート全体の回帰を確認する

**Verify**: `bash scripts/e2e/run-local.sh tests/e2e/a11y --project=chromium`

a11y スイートは **既存 4 spec（各 1 テスト）+ 本プランの新 3 spec = 7 テスト**
（`checkout` / `profile` / `seller-apply` / `sign-in` + `browse` / `product` / `cart`）。
**plan 042 の完了状況で期待値が変わる**ので、下表のどちらに当てはまるかを明示して記録すること:

| 前提 | 期待（chromium） | 内訳 |
|---|---|---|
| **plan 042 が完了している** | **7 passed / 0 failed** | 全 spec が green |
| **plan 042 が未完了**（Step 4 の `aria-label` のみ適用済み） | **5 passed / 2 failed** | fail は `checkout` / `profile` の 2 件のみ。これは `signIn()` ヘルパー未修復による**既知の失敗**であり、本プランの回帰ではない |

**042 未完了で fail が 2 件を超える**、または fail に `browse` / `product` / `cart` /
`seller-apply` / `sign-in` が含まれる場合は**本プランの回帰**なので STOP して報告する。

> 3 ブラウザ実行時は、a11y spec が全て chromium 限定ゲート（`test.skip(({ browserName }) =>
> browserName !== "chromium", ...)`）を持つため、**firefox / webkit の 14 テストは
> すべて skipped** になる（7 × 2）。これは正当な skip でありゼロにする対象ではない。

### Step 4: ドキュメント同期

テスト数が増えるため `spec-sync-after-test` skill を起動する
（`.claude/rules/02-tdd-step-commit.md` の MUST）。E2E 統計は
`docs/testing/QA_HANDOFF.md` が SSOT。

**Verify**: 同期コミットに QA_HANDOFF.md / coverage-dashboard.html が含まれる

## Test plan

- 新規: a11y spec 3 本（browse / product / cart、各 1 テスト）。
- 構造の手本: `tests/e2e/a11y/seller-apply.spec.ts`。
- 回帰: 既存 a11y spec（seller-apply / sign-in）が引き続き passed。
- **期待テスト数**: chromium で **7**（既存 4 + 新 3）。
  042 完了時 **7 passed**、042 未完了時 **5 passed / 2 failed**（checkout / profile の
  既知失敗）。3 ブラウザ実行では firefox / webkit の 14 テストが chromium 限定ゲートで
  skipped（正当）。

## Done criteria

- [ ] `bunx tsc --noEmit` / `bun run lint` exit 0
- [ ] 新 3 spec が chromium で passed（違反ゼロ、`disabledRules` への追加なし。
      許容は既存規約どおり `color-contrast` のみ）
- [ ] a11y スイート全体の結果が上表と一致する（042 完了時 7 passed /
      042 未完了時 5 passed + checkout・profile の 2 failed のみ）
- [ ] `git status` で in-scope 外の変更なし
- [ ] `plans/README.md` の 052 行を DONE に更新

## STOP conditions

- Step 0 の前提（042 Step 4 完了）が満たされていない。
- Step 2 で `color-contrast` 以外の違反が検出された（修正は `src/` 変更 = out of scope。
  違反サマリを添えて報告し、修正プランの起票を依頼する）。
- `/browse` に商品カードが表示されない（seed 未投入 — `bun run seed:e2e` を実行しても
  解消しない場合は報告）。
- 商品詳細ページが 404 になる（seed の slug サフィックス不一致の可能性 —
  `buildE2ESeed` に渡した `parallelIndex` / `projectName` を確認して報告）。

## Maintenance notes

- **OI-9（home SSR 500）解消後**、`tests/e2e/a11y/home.spec.ts` を同形式で追加すること
  （findings-17 の Deferred 節に記録済み）。
- 新ページ（例: 今後の RMA / 通知系 UI）追加時は、このスイートに同形式の spec を
  足すのが低コストな a11y ガードになる。
- `color-contrast` 負債が解消されたら、既存 4 spec + 本プランの 3 spec から一括で
  `disabledRules` を外す（片方だけ外すと基準が割れる）。
