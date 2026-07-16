# Plan 051: 国選択セレクタ（Ship to）の cookie 往復 E2E を追加する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 99ede89..HEAD -- src/components/store/layout/header/country-lang-curr-selector.tsx src/components/shared/country-selector.tsx src/app/api/setUserCountryInCookies/ src/lib/utils.ts tests/e2e/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW（認証不要・ゲスト導線・依存プランなし）
- **Depends on**: none（plans 042〜050 と独立に並行着手可能）
- **Category**: tests
- **Planned at**: commit `99ede89`, 2026-07-12

## Why this matters

E2E 残余監査（`plans/audit/findings-17-e2e-coverage-r9.md` TESTS-40）で、ヘッダーの
国選択セレクタ（Ship to）が E2E ゼロであることを確認した。`userCountry` cookie は
配送先表示・配送料計算の入力となる中核状態（`.claude/steering/tech.md` が
`parseUserCountryCookie` の使用を規約化するほど）だが、「hover で開く → 国を選ぶ →
cookie 書き込み → `router.refresh()` → ヘッダー表示更新」というブラウザ往復は
どの層でも検証されていない（unit は API route 単体と cookie パースのみ）。
認証不要のため、認証系 E2E の修復（plan 042）を待たずに常時 green で回る価値がある。

## Current state

- `src/components/store/layout/header/country-lang-curr-selector.tsx` — ヘッダーのトリガーと
  ドロップダウン。トリガーは **CSS `group-hover` で開く**（クリックではない）:

```tsx
// country-lang-curr-selector.tsx:60,84
<div className="group relative inline-block">
    ...
    <div className="absolute top-0 hidden cursor-pointer group-hover:block">
```

  トリガー内の表示テキスト（`:71-75`）: `{userCountry.name}/EN/` と `USD`。
  国選択時のハンドラ（`:30-58`）: `countries.json` から name 一致で検索 →
  `fetch("/api/setUserCountryInCookies", { method: "POST", body: JSON.stringify({ userCountry: data }) })`
  → `response.ok` なら `router.refresh()`。
- `src/components/shared/country-selector.tsx` — ドロップダウン内のコンボボックス。
  操作契約: `role="button"`（`aria-haspopup="listbox"`、選択中の国名を表示）を **click** で
  listbox が開き、`placeholder="Search a country"` の `type="search"` input で先頭一致
  フィルタ（`:129-141`）、`role="option"` の `li` を click で `onChange(value.name)` →
  閉じる（`:150-154`）。国旗画像は外部 URL
  （`purecatamphetamine.github.io/country-flag-icons/...`）の `next/image` — **画像の
  読み込みは assert しないこと**（外部ネットワーク依存のフレーク源）。
- `src/app/api/setUserCountryInCookies/route.ts:14-20` — `userCountry` cookie を
  `httpOnly` / `sameSite: "lax"` で設定して 200 を返す（`userCountry` 欠落時 400）。
- `src/lib/utils.ts:265,298` — cookie 不在・不正時は `DEFAULT_COUNTRY`（United States）に
  フォールバック。つまり**初期表示はヘッダーに `United States/EN/` が出る**のが既定。
- `src/data/countries.json:110` — `{ "name": "Japan", "code": "JP" }` が存在（テストで
  選択する国として使用する）。
- 既存 E2E に国選択 UI の操作はゼロ（`grep -rn "Ship to" tests/e2e/` = 0 件）。
- **E2E の共通パターン**（このリポジトリの規約 — 必ず踏襲）:
  - 構造の手本: `tests/e2e/layout-chrome.spec.ts`（ゲスト・seed 不要のヘッダー検証）と
    `tests/e2e/purchase-flow.spec.ts`（goto → 操作 → expect）。
  - 本プランのテストは DB seed に依存しない（countries.json は静的データ、cookie は
    ブラウザ状態）ため、`buildE2ESeed` / `setupE2ETestState` は不要。
  - 実行は `bash scripts/e2e/run-local.sh <spec> --project=chromium`（:3000 空き前提。
    Docker の `multivendor-app-dev` コンテナが :3000 を占有している場合は
    `docker stop multivendor-app-dev` してから実行し、終了後に再開する）。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| 型チェック / Lint | `bunx tsc --noEmit` / `bun run lint` | exit 0 |
| 新 spec 単体（chromium） | `bash scripts/e2e/run-local.sh tests/e2e/country-selector.spec.ts --project=chromium` | all passed |
| 3 ブラウザ | `bash scripts/e2e/run-local.sh tests/e2e/country-selector.spec.ts` | all passed |
| 既存回帰確認 | `bash scripts/e2e/run-local.sh tests/e2e/layout-chrome.spec.ts --project=chromium` | 既存分 passed |

## Scope

**In scope**:
- `tests/e2e/country-selector.spec.ts`（新規）

**Out of scope**:
- `src/` 配下すべて（セレクタが不足しても src を変更しない — STOP して報告）
- `tests/e2e/seed/`（本プランは seed 非依存）
- 商品ページ・カートの配送料表示が国変更に追随することの検証（配送料は DB の
  Country/ShippingRate 行に依存し、countries.json の静的リストと突合しないため
  ここでは扱わない — Maintenance notes 参照）
- 言語 / 通貨欄（静的表示のみで機能が無い — findings-17 Rejected 節で確認済み）

## Git workflow

- Branch: `advisor/051-e2e-country-selector`
- コミット分割（`.claude/rules/02-tdd-step-commit.md` 準拠）:
  1. `test(e2e): add country selector cookie roundtrip spec`
  2. ドキュメント同期は別コミット（Step 4）
- push / PR はオペレーター指示があるときのみ。

## Steps

### Step 1: country-selector.spec.ts を作成する

`tests/e2e/country-selector.spec.ts` を新規作成し、以下の 3 テストを書く:

1. **初期表示は DEFAULT_COUNTRY（United States）** — `/` ではなく **`/browse` へ goto**
   （home `/` は OI-9 の SSR 500 が未解消 — `docs/testing/QA_HANDOFF.md` の OI-9 参照）→
   ヘッダー内に `United States/EN/` テキストが visible。
   ロケータ例: `page.getByText("United States/EN/")`（ヘッダーは全ページ共通）。
2. **国を変更するとヘッダー表示が更新される** —
   - `page.getByText("United States/EN/").hover()` でドロップダウンを開く
     （`group-hover` 制御のため hover 必須。hover 後 `Ship to` 見出しが visible になるのを待つ）
   - `CountrySelector` のトリガーボタン（`getByRole("button", { name: /United States/ })`）を click
   - `getByPlaceholder("Search a country")` に `Japan` を入力
   - `getByRole("option")` のうち `Japan` テキストを持つものを click
     （`page.getByRole("option").filter({ hasText: "Japan" }).first()`）
   - `/api/setUserCountryInCookies` への POST 200 を待つ:
     `page.waitForResponse((r) => r.url().includes("/api/setUserCountryInCookies") && r.status() === 200)`
   - `router.refresh()` 後にヘッダーが `Japan/EN/` になる:
     `await expect(page.getByText("Japan/EN/")).toBeVisible({ timeout: 10000 })`
3. **リロード後も選択が永続する（httpOnly cookie）** — テスト 2 の続きで
   `page.reload()` → `Japan/EN/` が引き続き visible。
   （テスト 2 と 3 は 1 つの `test()` にまとめてよい — cookie 状態を引き継ぐ必要があるため、
   独立させる場合は `test.describe.serial` ではなく同一テスト内の連続 assert とする）

注意:
- 国旗 `<img>` の src / 読み込み完了は assert しない（外部 CDN 依存）。
- listbox は `framer-motion` の `AnimatePresence` で opacity アニメーションする。
  `playwright.config.ts:32` で `reducedMotion: "reduce"` 設定済みだが、option click は
  `toBeVisible()` を待ってから行うこと。
- hover が外れて dropdown が閉じる事故を防ぐため、hover 後の操作は dropdown 内の要素に
  対して連続して行う（間に `page.mouse.move(0, 0)` 等を挟まない）。

**Verify**: `bunx tsc --noEmit` / `bun run lint` → exit 0

### Step 2: chromium で green にする

**Verify**: `bash scripts/e2e/run-local.sh tests/e2e/country-selector.spec.ts --project=chromium`
→ 2〜3 passed（テスト構成による）

### Step 3: 3 ブラウザで確認する

**Verify**: `bash scripts/e2e/run-local.sh tests/e2e/country-selector.spec.ts` → all passed
（firefox で hover 由来のフレークが出た場合のみ、purchase-flow の前例
`test.skip(testInfo.project.name === "firefox" && !process.env.CI, ...)` に合わせた
ローカルゲートを検討し、判断をコミットメッセージに記録する）

### Step 4: ドキュメント同期

テスト数が増えるため `spec-sync-after-test` skill を起動する
（`.claude/rules/02-tdd-step-commit.md` の MUST）。E2E 統計は
`docs/testing/QA_HANDOFF.md` が SSOT。

**Verify**: 同期コミットに QA_HANDOFF.md / coverage-dashboard.html が含まれる

## Test plan

- 新規: `tests/e2e/country-selector.spec.ts` に 2〜3 テスト（初期表示 / 変更 + 永続）。
- 構造の手本: `tests/e2e/layout-chrome.spec.ts`（ゲスト・seed 不要）。
- 回帰: layout-chrome が引き続き passed。

## Done criteria

- [ ] `bunx tsc --noEmit` / `bun run lint` exit 0
- [ ] chromium で新テスト all passed、3 ブラウザで all passed（正当なローカルゲート skip を除く）
- [ ] `bash scripts/e2e/run-local.sh tests/e2e/layout-chrome.spec.ts --project=chromium` 既存分 passed
- [ ] `git status` で in-scope 外の変更なし
- [ ] `plans/README.md` の 051 行を DONE に更新

## STOP conditions

- ヘッダーの表示テキストが `United States/EN/` 形式でない（`country-lang-curr-selector.tsx:71-75`
  の表示ロジックがドリフトしている）。
- hover してもドロップダウン（`Ship to` 見出し）が出現しない（CSS 構造変更の可能性 —
  error-context の DOM スナップショットを添えて報告）。
- 初期表示が `United States` にならない（サーバー側で geolocation 等による cookie 事前設定が
  入った可能性 — その場合は初期値 assert を「いずれかの国名/EN/ が表示される」に緩めてよいか
  判断を仰ぐ）。
- テスト 2 の POST が 200 を返すのにヘッダーが更新されない（`router.refresh()` の SSR 再取得
  問題 — src 側の調査が必要なため報告）。

## Maintenance notes

- 将来「国変更 → 商品ページの配送料表示が変わる」まで検証を伸ばす場合は、DB の Country /
  ShippingRate 行と countries.json の name 突合が前提になる（E2E seed の country は
  suffix 付き名で DB に入るため、静的リストの `Japan` とは別物であることに注意）。
- 多通貨・多言語対応（現状スコープ外 — `.claude/steering/product.md`）が入ると
  `/EN/` `USD` のハードコード表示が変わり、本テストの表示 assert も更新が必要。
