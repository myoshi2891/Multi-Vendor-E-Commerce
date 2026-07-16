# Plan 043: 現行 UI と乖離した VRT ベースラインを再撮影し、Visual Regression を差分検出器として復旧する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6ad7b05..HEAD -- tests/e2e/visual/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED（意図しない UI 破壊を「正」として固定してしまうリスク — 目視ゲートで防ぐ）
- **Depends on**: none（plan 042 と独立。ただし 042 完了後に実行すると
  フルラン検証の期待値が単純になる）
- **Category**: tests
- **Planned at**: commit `6ad7b05`, 2026-07-11

## Why this matters

2026-07-11 の 3 ブラウザフル実測（`plans/audit/findings-16-e2e-coverage.md` TESTS-28）で、
VRT がベースラインとの乖離で fail していることが判明した。**実測ログに失敗内訳が
採取されているのは 2 件**:
`cart-empty.png` は **ページ高さ 1280x720 → 1280x1071（+351px）** の构造的乖離、
`checkout-redirect-signin.png` は差分 19%（リダイレクト先 /sign-in に描画される Clerk
ウィジェット自体の UI が 2 ステップ型 → 1 画面統合型へ変わったため）。
**`cart-with-item` については実測の失敗出力が残っておらず、乖離しているかは未確定**
（cart-empty と同じレイアウト増分を受けている可能性は高いが、推測で更新しない）。
VRT が常時 red のままでは真の視覚リグレッションが混入してもノイズと区別できず、
差分検出器として機能しない。現行 UI が意図どおりであることを**目視確認した上で**
ベースラインを再撮影する。

## Current state

- ベースライン画像（VRT スペックは 3 件。うち**実測で乖離が確認できているのは 2 枚**）:
  | ベースライン | 実測の乖離 | 更新見込み |
  |---|---|---|
  | `tests/e2e/visual/cart.spec.ts-snapshots/cart-empty-chromium-darwin.png` | **あり**（+351px / 差分 9%） | 更新される |
  | `tests/e2e/visual/cart.spec.ts-snapshots/cart-with-item-chromium-darwin.png` | **未確定**（失敗出力なし） | Step 1 の実測で判断 |
  | `tests/e2e/visual/checkout.spec.ts-snapshots/checkout-redirect-signin-chromium-darwin.png` | **あり**（差分 19%） | 更新される |

- **fail 数と更新枚数の関係（本プランの前提）**: `--update-snapshots` は
  **比較に失敗したスナップショットだけを書き換える**。ベースラインが現行 UI と一致して
  いるテストは pass し、そのファイルは**書き換わらない**（mtime も変わらない）。
  したがって:
  - **更新後に `git status` に現れる .png の枚数 = 更新前に fail していた VRT テスト数**
  - 実測どおり 2 件 fail なら **2 枚**、`cart-with-item` も乖離していれば **3 枚**
  - **4 枚以上、あるいは 0 枚は前提の破綻**（前者は想定外の対象混入、後者は
    そもそも fail していない = 本プランが不要）→ いずれも STOP して報告
- スペック（**変更しない** — 撮影対象の定義として引用）:

```typescript
// tests/e2e/visual/cart.spec.ts:51-69（抜粋）
test("空カートの表示", async ({ page, seed: _seed }) => {
    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("cart-empty-message")).toBeVisible();
    await expect(page).toHaveScreenshot("cart-empty.png", { fullPage: true });
});
// 「商品追加後のカート表示」は cart-item-image を mask 済み（:64-67）
```

```typescript
// tests/e2e/visual/checkout.spec.ts:25-30（抜粋）
await page.goto("/checkout", { waitUntil: "domcontentloaded" });
await page.waitForURL(/\/sign-in/, { timeout: 10000 });
await expect(page).toHaveScreenshot("checkout-redirect-signin.png", { fullPage: true });
```

- 更新コマンドは spec ヘッダーコメント（`cart.spec.ts:11-12`）に記載済み:
  `bunx playwright test tests/e2e/visual --update-snapshots --project=chromium`
- 実測時の失敗出力（2026-07-11・findings-16 実測 #2）:
  - `cart-empty`: `Expected an image 1280px by 720px, received 1280px by 1071px.
    113641 pixels (ratio 0.09 ...) are different.`
  - `checkout-redirect-signin`: `171001 pixels (ratio 0.19 ...) are different.`
- 許容差分は `playwright.config.ts:16` の `toHaveScreenshot: { maxDiffPixelRatio: 0.01 }`。
- E2E 実行の前提: :3000 が空いていること（`multivendor-app-dev` コンテナが動いていたら
  `docker compose stop app`）。VRT は seed 依存（`_fixtures` が seed を注入）のため
  `run-local.sh` 経由での実行が安全。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| 現状確認（fail 再現） | `bash scripts/e2e/run-local.sh tests/e2e/visual --project=chromium` | 3 failed |
| 差分画像の確認 | `open test-results/*/cart-empty-diff.png`（actual/expected/diff の 3 枚が保存される） | 目視 |
| ベースライン更新 | `bash scripts/e2e/run-local.sh tests/e2e/visual --update-snapshots --project=chromium` | 3 枚再撮影 |
| 更新後の green 確認 | `bash scripts/e2e/run-local.sh tests/e2e/visual --project=chromium` | `3 passed` |

## Scope

**In scope** (the only files you should modify):
- `tests/e2e/visual/cart.spec.ts-snapshots/*.png`（再撮影による置き換えのみ）
- `tests/e2e/visual/checkout.spec.ts-snapshots/*.png`（同上）

**Out of scope**:
- `tests/e2e/visual/*.spec.ts` — テストロジック・mask・fullPage 設定は変更しない。
- `playwright.config.ts` の `maxDiffPixelRatio` — 閾値緩和で「解決」しない。
- `src/` 配下 — 目視で UI 破壊を発見した場合も自分で直さず STOP（下記）。

## Git workflow

- Branch: `advisor/043-e2e-vrt-rebaseline`
- 1 コミット: `test(e2e): re-baseline VRT snapshots for current UI`
  （コミット本文に、目視確認した差分の内訳 — 高さ増の原因・Clerk UI 変化 — を 2〜3 行で記録）
- push / PR はオペレーター指示があるときのみ。

## Steps

### Step 1: fail を再現し、diff 画像を保存させる

`bash scripts/e2e/run-local.sh tests/e2e/visual --project=chromium` を実行。

**Verify**: **2 failed / 1 passed**（実測どおり `cart-empty` と
`checkout-redirect-signin` が fail）または **3 failed**（`cart-with-item` も
乖離していた場合）。fail した各テストについて `test-results/` 配下に
`*-actual.png` / `*-expected.png` / `*-diff.png` が生成されている。
**ここで観測した failed 数を記録すること** — Step 3 で更新される .png の枚数と
一致しなければならない。0 failed なら本プランは不要（STOP して報告）。

### Step 2: 差分を目視確認する（本プランの安全ゲート）

**Step 1 で fail した**テストの actual/expected/diff を開き、次を確認する
（pass したテストは diff が生成されず、確認対象にもならない）:

1. **cart-empty**（fail 確定）: 高さ +351px の増分が「フッター/コンテンツの追加」等の
   意図的変更で説明できるか。レイアウト崩れ（要素の重なり・見切れ・空白の異常）が**無い**こと。
2. **cart-with-item**（fail した場合のみ）: 商品行の表示が正常（名前・価格・数量
   コントロールが揃っている）こと。pass していれば現行 UI と一致しており確認不要。
3. **checkout-redirect-signin**（fail 確定）: 差分の主因が Clerk ウィジェットの現行 UI
   （"Email address or username" + Password 同一画面、findings-16 TESTS-26 参照）であること。

**Verify**: fail した全テストについて「意図的変更で説明できる」— 1 つでも UI 破壊に
見えるものがあれば STOP（スクリーンショットを添えて報告）。

### Step 3: ベースラインを再撮影する

`bash scripts/e2e/run-local.sh tests/e2e/visual --update-snapshots --project=chromium`

**Verify**: `git status` で変更が `tests/e2e/visual/*-snapshots/*.png` のみであり、
その**枚数が Step 1 の failed 数と一致**すること（実測どおりなら 2 枚）。
`--update-snapshots` は fail したものだけを書き換えるため、この一致が
「想定外のスナップショットを巻き込んでいない」ことの機械的な証拠になる。
枚数が Step 1 の failed 数を超える場合は STOP。

### Step 4: green を確認しコミットする

**Verify**: `bash scripts/e2e/run-local.sh tests/e2e/visual --project=chromium` → `3 passed`
（**VRT スペックは 3 件なので、更新枚数が 2 枚でも最終的な pass 数は 3**。
更新した 2 枚 + もともと一致していた 1 枚。連続 2 回実行してもフレークしないことを確認）

## Test plan

- 新規テストは無し。既存 VRT 3 テストが green に戻ることが成果物。
- **数の対応関係**（混同しやすいので明示）: VRT スペック **3 件** /
  更新前の failed **2 件（実測）** / 更新される .png **= failed 件数** /
  更新後の passed **3 件**。
- 再現性確認: Step 4 の 2 回連続 green。

## Done criteria

- [ ] `bash scripts/e2e/run-local.sh tests/e2e/visual --project=chromium` が 2 回連続 `3 passed`
- [ ] 変更ファイルが `tests/e2e/visual/*-snapshots/*.png` のみで、**枚数が Step 1 の
      failed 数と一致**（実測どおりなら 2 枚。`cart-with-item` も乖離していれば 3 枚）
- [ ] 最終の VRT 実行が `3 passed`（スペック件数であり、更新枚数とは別の数）
- [ ] コミット本文に目視確認の内訳が記録されている
- [ ] `plans/README.md` の 043 行を DONE に更新

## STOP conditions

- Step 2 の目視でレイアウト崩れ・要素欠落が見つかった（UI バグの可能性 —
  再撮影で固定してはならない。findings への追記対象）。
- `--update-snapshots` 後も fail する（環境非決定性 — フォント/デバイススケール差の疑い）。
- 生成された diff が `darwin` 以外のスナップショット名を要求する
  （実行環境が macOS でない — ベースラインの互換性方針の判断が必要）。

## Maintenance notes

- ベースラインは `*-chromium-darwin.png` で macOS ローカル前提。CI で VRT を回す場合は
  Linux 用ベースラインの別撮りが必要になる（現状 CI に Playwright ジョブは無い）。
- 意図的な UI 変更を入れた PR では、影響を受けるベースラインの再撮影を同一 PR に含めること
  （`--update-snapshots` は fail したものだけを書き換えるので、変更枚数はそのまま
  「視覚的に影響を受けた画面数」を意味する）
  （今回のような「別の変更に紛れた陳腐化」を防ぐ）。
- plan 042 の svg `aria-label` 追加は描画に影響しないため、042 と本プランの実行順は問わない。
