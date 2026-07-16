# Plan 054: VRT（Visual Regression）対象を商品詳細・browse へ拡大する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 99ede89..HEAD -- tests/e2e/visual/ playwright.config.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition。**例外**: plan 043 によるベースライン PNG の
> 再撮影差分（`*-snapshots/` 配下）は本プランの前提なので STOP 不要。

## Status

- **Priority**: P3
- **Effort**: S〜M
- **Risk**: MED（新規ベースラインの妥当性は目視確認に依存する）
- **Depends on**: `plans/043-e2e-vrt-rebaseline.md` — 既存 3 枚のベースラインが陳腐化で
  常時 red（TESTS-28）のため、**043 で既存スイートを green に戻してから**対象を増やす
  （red なスイートに枚数を足すと差分検出器として機能しない）。
- **Category**: tests
- **Planned at**: commit `99ede89`, 2026-07-12

## Why this matters

E2E 残余監査（`plans/audit/findings-17-e2e-coverage-r9.md` TESTS-44）で、VRT の対象が
cart（2 枚）+ checkout リダイレクト（1 枚）のみで、**購買判断が起きる 2 ページ
（商品詳細・browse）のレイアウト回帰を検出する層が存在しない**ことを確認した。
Tailwind クラス順序の lint はあるが、実際のレイアウト崩れを検出できるのは VRT だけ。
E2E seed の商品画像はローカルアセット（`/assets/images/no_image.png`）で、E2E DB には
seed の 2 商品しか無いため、描画は決定論的でフレークリスクは低い。

## Current state

- `tests/e2e/visual/` の既存構成: `cart.spec.ts`（`cart-empty.png` / `cart-with-item.png`）+
  `checkout.spec.ts`（`checkout-redirect-signin.png`）+ 共通フィクスチャ `_fixtures.ts`
  （決定論的 seed + `setupE2ETestState`）。ベースラインは
  `tests/e2e/visual/*-snapshots/*-chromium-darwin.png`。
- **spec の手本**（chromium 限定ゲート + fullPage + mask — 必ず踏襲）:

```ts
// tests/e2e/visual/cart.spec.ts:45-68（抜粋）
test.describe("Visual: Cart", () => {
    test.skip(
        ({ browserName }) => browserName !== "chromium",
        "Visual Regression は chromium 限定（フォントレンダリング差のため）"
    );
    test("商品追加後のカート表示", async ({ page, seed }) => {
        await addItemToCart(page, seed.product.slug, seed.variant.slug);
        await expect(page.getByTestId("cart-item-name")).toBeVisible();
        await expect(page).toHaveScreenshot("cart-with-item.png", {
            fullPage: true,
            mask: [page.locator("[data-testid='cart-item-image']")],
        });
    });
});
```

- 差分許容は `playwright.config.ts:16` の `toHaveScreenshot: { maxDiffPixelRatio: 0.01 }`。
  アニメーション・ロケール・タイムゾーンは config で固定済み（`:28-33`）。
- ベースライン更新コマンド（cart.spec.ts:12 に記載の運用）:
  `bunx playwright test tests/e2e/visual --update-snapshots --project=chromium`
- seed 値は `_fixtures.ts` の `seed` フィクスチャから取得（slug はワーカー毎サフィックス付き）。
  商品詳細 URL: `/product/${seed.product.slug}/${seed.variant.slug}`。
- **home（`/`）は対象外**: OI-9（本番ビルド SSR 500 — `docs/testing/QA_HANDOFF.md`）が未解消。
- **VRT のベースライン PNG は「意図した見た目」の宣言**であり、撮影時に UI が壊れていると
  壊れた状態を固定してしまう。新規ベースラインは必ず目視確認する（Step 3）。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| 前提確認（043 完了） | `bash scripts/e2e/run-local.sh tests/e2e/visual --project=chromium` | 既存 3 テスト passed |
| 型チェック / Lint | `bunx tsc --noEmit` / `bun run lint` | exit 0 |
| ベースライン撮影 | `bash scripts/e2e/run-local.sh tests/e2e/visual --project=chromium -- --update-snapshots`（run-local.sh が引数をそのまま渡さない場合は `bunx playwright test tests/e2e/visual --update-snapshots --project=chromium` を :3000 でサーバー稼働中に実行） | 新規 PNG が生成される |
| 差分検証 | `bash scripts/e2e/run-local.sh tests/e2e/visual --project=chromium` | all passed |

## Scope

**In scope**:
- `tests/e2e/visual/product.spec.ts`（新規）
- `tests/e2e/visual/browse.spec.ts`（新規）
- `tests/e2e/visual/product.spec.ts-snapshots/`・`browse.spec.ts-snapshots/`（生成物 PNG）

**Out of scope**:
- `src/` 配下すべて
- 既存 `cart.spec.ts` / `checkout.spec.ts` とそのベースライン（plan 043 の担当）
- home（`/`）の VRT（OI-9 先行依存）
- firefox / webkit への拡大（既存方針: VRT は chromium 限定）
- `playwright.config.ts`（maxDiffPixelRatio 等の調整はしない — 必要と感じたら STOP）

## Git workflow

- Branch: `advisor/054-e2e-vrt-expansion`
- コミット分割（`.claude/rules/02-tdd-step-commit.md` 準拠）:
  1. `test(e2e): add product detail VRT spec with baseline`
  2. `test(e2e): add browse VRT spec with baseline`
  3. ドキュメント同期は別コミット（Step 5）
- push / PR はオペレーター指示があるときのみ。

## Steps

### Step 0: 前提を確認する

`bash scripts/e2e/run-local.sh tests/e2e/visual --project=chromium` → 既存 3 テストが
**passed** であること。fail する場合は plan 043 が未完了 — **STOP**（043 の完了を依頼する）。

### Step 1: product.spec.ts を作成する

`tests/e2e/visual/product.spec.ts` を新規作成。`cart.spec.ts` と同じ構造
（`./_fixtures` から `test, expect` を import・chromium 限定ゲート・ファイル冒頭に
Baseline 更新コマンドのコメント）で 1 テスト:

- **商品詳細ページの表示** — `/product/${seed.product.slug}/${seed.variant.slug}` へ goto →
  `page.getByTestId("add-to-cart")` が visible になるのを待つ →
  `toHaveScreenshot("product-detail.png", { fullPage: true, mask: [...] })`。
  mask には商品画像領域を入れる（実 DOM で画像コンテナの testid / 構造を確認する。
  testid が無ければ `page.locator("main img")` 等の構造ロケータでよい — mask は
  ロケータ解決失敗でもテストを fail させないため保守的に広く取ってよい）。

**Verify**: `bunx tsc --noEmit` / `bun run lint` → exit 0

### Step 2: browse.spec.ts を作成する

同様に 1 テスト:

- **browse の商品グリッド表示** — `/browse` へ goto →
  `page.locator('[data-testid^="product-card-"]').first()` が visible →
  `toHaveScreenshot("browse-grid.png", { fullPage: true, mask: [商品カード画像領域] })`。

注意: E2E DB には seed 商品 2 種のみのため、グリッドの内容は決定論的。ただし
**表示順**が安定しているか初回撮影後に 2 回連続実行して確認する（Step 4）。

**Verify**: `bunx tsc --noEmit` / `bun run lint` → exit 0

### Step 3: ベースラインを撮影し、目視確認する

1. ベースライン撮影コマンド（Commands 表）を実行 → `product-detail.png` /
   `browse-grid.png` が `*-snapshots/` に生成される。
2. **生成された PNG を開いて目視確認する**: レイアウト崩れ・空白領域・未ロード画像が
   無いこと。壊れた見た目を固定しない（判断に迷う場合はスクリーンショットを添えて報告）。

**Verify**: 2 枚の PNG が存在し、目視で妥当（このステップの確認結果をコミット
メッセージに 1 行で記録する。例: `baseline visually verified: grid renders 2 seed products`）

### Step 4: 再現性を確認する

ベースライン撮影後、**更新フラグなしで 2 回連続実行**して安定して passed になることを確認:

**Verify**: `bash scripts/e2e/run-local.sh tests/e2e/visual --project=chromium` を 2 回 →
2 回とも all passed（既存 3 + 新 2）。fail が出る場合は差分レポート
（`playwright-report/`）で変動領域を特定し、mask に追加して再撮影する（2 回試して
安定しなければ STOP）

### Step 5: ドキュメント同期

テスト数が増えるため `spec-sync-after-test` skill を起動する
（`.claude/rules/02-tdd-step-commit.md` の MUST）。E2E 統計は
`docs/testing/QA_HANDOFF.md` が SSOT。

**Verify**: 同期コミットに QA_HANDOFF.md / coverage-dashboard.html が含まれる

## Test plan

- 新規: VRT 2 テスト（product-detail / browse-grid、各ベースライン 1 枚）。
- 構造の手本: `tests/e2e/visual/cart.spec.ts`。
- 回帰: 既存 visual 3 テストが引き続き passed（Step 4 で同時確認）。

## Done criteria

- [ ] `bunx tsc --noEmit` / `bun run lint` exit 0
- [ ] `bash scripts/e2e/run-local.sh tests/e2e/visual --project=chromium` が 2 回連続 all passed（5 テスト）
- [ ] 新規ベースライン 2 枚が目視確認済み（コミットメッセージに記録）
- [ ] `git status` で in-scope 外の変更なし
- [ ] `plans/README.md` の 054 行を DONE に更新

## STOP conditions

- Step 0 で既存 visual スイートが red（plan 043 未完了）。
- Step 4 で mask 追加後も 2 回連続 passed にならない（変動源が画像以外にある —
  差分レポートを添えて報告。`maxDiffPixelRatio` の引き上げで誤魔化さない）。
- 商品詳細 / browse の描画自体が壊れている（目視確認で崩れを発見 — ベースラインを
  コミットせず、スクリーンショットを添えて報告）。

## Maintenance notes

- **OI-9 解消後**、home の VRT を同形式で追加する（findings-17 Deferred 節に記録済み）。
- ベースラインは `darwin` 環境依存（`*-chromium-darwin.png`）。CI で VRT を回す場合は
  Linux 用ベースラインの再撮影が必要になる（現状 CI に E2E ジョブは無い —
  findings-16 TESTS-29 / plan 044 参照）。
- seed 商品の画像・価格・名前を変更すると本プランのベースラインは意図的に fail する。
  その場合は UI 変更が意図的であることを確認してから再撮影する（plan 043 の運用規律に従う）。
