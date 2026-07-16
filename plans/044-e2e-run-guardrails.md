# Plan 044: E2E ローカル実測の運用ガードを機械化する（:3000 占有チェック + globalTimeout 引き上げ）

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6ad7b05..HEAD -- scripts/e2e/run-local.sh playwright.config.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `6ad7b05`, 2026-07-11

## Why this matters

2026-07-11 の Round 8 実測で、初回のフル実測が**2 つの運用罠により無効化**された
（`plans/audit/findings-16-e2e-coverage.md` TESTS-29・実測 #1）:

1. `multivendor-app-dev` コンテナが :3000 を公開したまま実測され、`playwright.config.ts` の
   `reuseExistingServer: !process.env.CI` により**別環境のサーバー**（Clerk キー不一致の
   Docker dev アプリ）が無警告で使われかけた。`run-local.sh` はこの前提をコメントで
   注意喚起するのみで機械検証しない。
2. `globalTimeout: 1200s`（20 分）は「概ね pass する」前提の値で、失敗リトライを含む実測
   25.5 分に不足し、`did not run` 打ち切りが発生した。

どちらも「手順を知らない実行者が踏むと、無効なベースラインを実測値として記録する」種類の
罠であり、スクリプトと config で機械的に防ぐ。

## Current state

- `scripts/e2e/run-local.sh` — ローカル Postgres E2E の opt-in ラッパー。
  :3000 の注意はコメントのみ（24-26 行目）:

```bash
# scripts/e2e/run-local.sh:24-26
# 注意:
#   playwright.config.ts は reuseExistingServer:!CI のため、:3000 に Neon 向き dev サーバーが
#   起動中だと再利用される。本スクリプト実行前に :3000 の既存サーバーを停止すること。
```

  末尾（67-68 行目）が実行本体:

```bash
# scripts/e2e/run-local.sh:67-68
echo "==> Playwright E2E 実行 (ローカル Postgres, retries=2 で CI と同じ flake 吸収)..."
bunx playwright test --retries=2 "$@"
```

- `playwright.config.ts:7-10` — globalTimeout の現状（コメントの想定が実測と乖離）:

```typescript
// playwright.config.ts:7-10
// 全体タイムアウト（ハング防止の安全ネット）。本番ビルド起動（next build）と
// 3ブラウザ分の全スイートを 1 worker で直列実行する wall-clock を含むため 20 分とする。
// 600s では build + 全テストが収まらず途中で "did not run" 打ち切りが発生していた。
globalTimeout: 1200 * 1000,
```

- 実測の根拠値（2026-07-11・findings-16）: 認証系 13 件が fail（各 3 リトライ）した
  ランで **25.5 分**。全 green 時はこれより短いが、リトライ吸収を含む安全ネットとしては
  20 分では不足。
- `run-local.sh` は `set -euo pipefail`・`readonly` 変数・日本語コメントのスタイル。
  既存の DB healthcheck ループ（41-54 行目）が「前提を機械検証してから進む」パターンの
  実装例なので、それに合わせる。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| シェル構文チェック | `bash -n scripts/e2e/run-local.sh` | exit 0 |
| 型チェック | `bunx tsc --noEmit` | exit 0 |
| ガード発火の確認 | `docker compose up -d app && bash scripts/e2e/run-local.sh tests/e2e/layout-chrome.spec.ts --project=chromium` | :3000 占有エラーで exit 1 |
| ガード通過の確認 | `docker compose stop app && bash scripts/e2e/run-local.sh tests/e2e/layout-chrome.spec.ts --project=chromium` | テスト実行に到達し passed |

## Scope

**In scope** (the only files you should modify):
- `scripts/e2e/run-local.sh`
- `playwright.config.ts`（`globalTimeout` の値とコメントのみ）

**Out of scope**:
- `reuseExistingServer` の値変更（ローカルの高速反復用途を壊す。ガードは run-local.sh 側で行う）
- `workers` / `retries` / `timeout` 等 config の他項目
- `.github/workflows/` — CI への E2E 導入は別判断（findings-16 Rejected 節参照）

## Git workflow

- Branch: `advisor/044-e2e-run-guardrails`
- コミット 2 つ: `fix(e2e): guard run-local.sh against occupied port 3000` /
  `fix(e2e): raise globalTimeout to cover full 3-browser run with retries`
- push / PR はオペレーター指示があるときのみ。

## Steps

### Step 1: run-local.sh に :3000 事前チェックを追加する

`scripts/e2e/run-local.sh` の DB healthcheck ブロック（54 行目）の後・
`export DATABASE_URL`（57 行目）の前に以下を追加する（既存スタイルに合わせ日本語コメント）:

```bash
# :3000 が既に LISTEN されていると reuseExistingServer:!CI により別環境のサーバー
# （例: multivendor-app-dev コンテナ = Clerk キー不一致）を無警告で再利用してしまう。
# 2026-07-11 の Round 8 実測 #1 がこれで無効化された（plans/audit/findings-16 TESTS-29）。
if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "ERROR: :3000 が使用中です。Playwright が別環境のサーバーを再利用してしまうため中止します。" >&2
    echo "  対処: 'docker compose stop app' または :3000 の dev サーバーを停止してから再実行してください。" >&2
    exit 1
fi
```

**Verify**: `bash -n scripts/e2e/run-local.sh` → exit 0

### Step 2: ガードの発火と通過を実機確認する

1. `docker compose up -d app` で :3000 を占有 →
   `bash scripts/e2e/run-local.sh tests/e2e/layout-chrome.spec.ts --project=chromium`
   → **ERROR メッセージで exit 1**（Playwright まで到達しない）
2. `docker compose stop app` →
   同コマンド → テストが実行され passed

**Verify**: 上記 2 パターンの挙動どおり

### Step 3: globalTimeout を実測ベースへ引き上げる

`playwright.config.ts:7-10` を書き換える:

```typescript
// 全体タイムアウト（ハング防止の安全ネット）。本番ビルド起動（next build）+
// 3ブラウザ 111 テストの 1 worker 直列 + 失敗時 retries=2 の wall-clock を含む。
// 2026-07-11 実測: 認証系 13 件が全滅したランで 25.5 分（1200s では打ち切りが発生）。
// リトライを含む最悪ケースを吸収するため 60 分とする。
globalTimeout: 3600 * 1000,
```

**Verify**: `bunx tsc --noEmit` → exit 0、`bun run lint` → exit 0

### Step 4: フルランがタイムアウト打ち切りなしで完走することを確認する

`bash scripts/e2e/run-local.sh`（`--global-timeout` の CLI 上書きなし）を実行。

**Verify**: 実行が `did not run` の**タイムアウト起因の打ち切りなし**で最後まで到達する
（pass/fail の内訳は plan 042/043 の進捗に依存するため、本プランでは「timedout に
ならないこと」のみが判定基準。`test-results/.last-run.json` の `status` が
`"timedout"` でないこと）。

## Test plan

- 新規テストは無し（運用スクリプト + config の堅牢化）。
- 実機検証は Step 2（ガード発火/通過）と Step 4（完走）。

## Done criteria

- [ ] `bash -n scripts/e2e/run-local.sh` exit 0
- [ ] :3000 占有時に run-local.sh が exit 1 + 対処メッセージ
- [ ] `bunx tsc --noEmit` / `bun run lint` exit 0
- [ ] フルランで `test-results/.last-run.json` の status が "timedout" でない
- [ ] `plans/README.md` の 044 行を DONE に更新

## STOP conditions

- `lsof` が実行環境に存在しない（代替検出手段の選定はオペレーター判断）。
- Step 4 のフルランが 60 分でも timedout する（別の恒常ハングが発生している —
  タイムアウト値の問題ではない）。
- config 変更が CI（`.github/workflows/ci.yml` の build ジョブ等）に影響した。

## Maintenance notes

- テスト総数が大きく増えた場合（plans 045〜050 の実装後）、`globalTimeout` の再見積りが
  必要になり得る。判断材料はフルラン実測の wall-clock（run-local.sh の出力に表示される）。
- `reuseExistingServer: !CI` は「ローカル反復では既存 dev サーバーを使い回す」利便のための
  設定であり、本プランのガードはそれを **run-local.sh 経由の実測時のみ**禁止する構造。
  素の `bunx playwright test` にはガードが効かない点は既知の制約（実測は必ず
  run-local.sh 経由で行う運用）。
