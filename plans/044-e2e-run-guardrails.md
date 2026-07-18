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

   > **TODO(needs-detail)**: 本プランの `lsof` 事前チェックは **TOCTOU（Time-of-check to
   > Time-of-use）を残す**。チェック時点で :3000 が空いていても、Playwright が webServer を
   > 起動するまでの間に別プロセス（`docker compose up` の遅延起動、エディタの dev サーバー等）が
   > :3000 を掴めば、結局 `reuseExistingServer: !CI` が他人のサーバーを再利用してしまう。
   > チェックは**窓を狭めるだけで塞がない**。
   >
   > **解決（2026-07-18 確定）**: 当初は (A) 残存許容 / (B) `reuseExistingServer: false`
   > で根治、の二択としてユーザー判断待ちにしていたが、**(A) は採らない**。
   > TOCTOU が残ると、テストが pass しても「意図したアプリ・環境を検証した」保証が
   > 得られない — グリーンの意味が壊れるため、これは既知リスクとして許容できる
   > 種類のものではない。一方 (B) を無条件に適用すると素の
   > `bunx playwright test` でも毎回 build/起動が走り、ローカル反復の利便を失う。
   >
   > 二択に見えたのは「設定が実行経路を区別できない」ことが原因なので、
   > **(C) 実行経路ごとに再利用可否を切り替える**を採用する:
   >
   > ```ts
   > // playwright.config.ts:47
   > reuseExistingServer: !process.env.CI && !process.env.E2E_NO_REUSE,
   > ```
   >
   > `scripts/e2e/run-local.sh` は `export E2E_NO_REUSE=1` してから Playwright を
   > 起動する。これにより:
   >
   > - **実測を行う run-local.sh 経由では再利用が構造的に不可能**になる。:3000 が
   >   誰かに掴まれていれば webServer の起動自体が失敗するので、TOCTOU の窓は
   >   「狭まる」のではなく**閉じる**。事前 `lsof` チェックは、失敗をより読みやすい
   >   メッセージに変えるための UX 改善として残す（安全性の根拠ではなくなる）。
   > - **素の `bunx playwright test` は従来どおり**既存 dev サーバーを再利用でき、
   >   ローカル反復の速度が落ちない。
   >
   > これは現 Out of scope の「`reuseExistingServer` の値変更」に触れるため、
   > Scope を更新すること（値の固定変更ではなく、環境変数による条件化）。
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

- **実測の根拠値（2026-07-11・findings-16 実測 #2）— 本プランはこの数値で統一する**:
  | 項目 | 値 | 備考 |
  |---|---|---|
  | 失敗した認証系テスト | **13 件** | 各 3 リトライ込みで wall-clock を押し上げた主因 |
  | `did not run` 打ち切り | **3 件** | globalTimeout 到達により未実行 |
  | findings-16 の「16 instance」 | **13 + 3** | 上 2 行の合計。**別の母数ではない** |
  | 実測 wall-clock | **25.5 分** | 打ち切りまでの経過を含むラン全体の所要 |

  `globalTimeout: 1200s`（20 分）はこのランを収容できず、残り 3 件が `did not run` に
  なった。**タイムアウト値の根拠として引用する件数は「認証系 13 件が fail」に統一する**
  （「16 件」は 13 + 3 の合計であり、リトライ時間を生んだのは 13 件の方。両者を
  混在させると見積りの前提が読めなくなる）。plan 042 の「16 instance」も同じ内訳を指す。
- `run-local.sh` は `set -euo pipefail`・`readonly` 変数・日本語コメントのスタイル。
  既存の DB healthcheck ループ（41-54 行目）が「前提を機械検証してから進む」パターンの
  実装例なので、それに合わせる。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| シェル構文チェック | `bash -n scripts/e2e/run-local.sh` | exit 0 |
| 型チェック | `bunx tsc --noEmit` | exit 0 |
| :3000 の LISTEN 待ち | `timeout 60 bash -c 'until lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; do sleep 1; done'` | exit 0（占有が確立） |
| ガード発火の確認 | 上の LISTEN 待ちを挟んでから `bash scripts/e2e/run-local.sh tests/e2e/layout-chrome.spec.ts --project=chromium` | :3000 占有エラーで exit 1 |
| ガード通過の確認 | `docker compose stop app && bash scripts/e2e/run-local.sh tests/e2e/layout-chrome.spec.ts --project=chromium` | テスト実行に到達し passed |

## Scope

**In scope** (the only files you should modify):
- `scripts/e2e/run-local.sh`
- `playwright.config.ts`（`globalTimeout` の値とコメントのみ）

**Out of scope**:
- `reuseExistingServer` を**固定値へ**変更すること（`false` 直書きはローカルの高速反復
  用途を壊す）。**ただし環境変数による条件化は in scope**:
  `reuseExistingServer: !process.env.CI && !process.env.E2E_NO_REUSE` へ変更し、
  `run-local.sh` から `E2E_NO_REUSE=1` を立てる（TOCTOU を閉じるための必須変更。
  Why this matters の解決節を参照）。
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

1. `docker compose up -d app` で :3000 を占有させる。
   **`up -d` の完了を占有の完了と見なさないこと**: `up -d` はコンテナの起動要求が
   受理された時点で返り、アプリが実際に :3000 を LISTEN するのはその後。直後に
   run-local.sh を実行すると `lsof` がまだ何も検出せず、**ガードが素通りして
   テストが走り出す**（「ガードが壊れている」と誤診する典型）。
   LISTEN が確立するまでポーリングしてから次へ進む:

```bash
docker compose up -d app
# :3000 が実際に LISTEN されるまで待つ（最大 60s）。ここで待たないと次の検証が
# 「ガード未発火」に見えるフレークになる。
timeout 60 bash -c 'until lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; do sleep 1; done' \
    || { echo "app コンテナが :3000 を LISTEN しませんでした" >&2; exit 1; }
```

   その上で `bash scripts/e2e/run-local.sh tests/e2e/layout-chrome.spec.ts --project=chromium`
   → **ERROR メッセージで exit 1**（Playwright まで到達しない）
2. `docker compose stop app` → **:3000 の LISTEN が消えるまで**同様に待つ
   （`timeout 60 bash -c 'while lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; do sleep 1; done'`）→
   同コマンド → テストが実行され passed

**Verify**: 上記 2 パターンの挙動どおり（1 の「占有待ち」を省略した場合の素通りは
ガードの不具合ではなく検証手順の不備なので、混同しないこと）

### Step 3: globalTimeout を実測ベースへ引き上げる

`playwright.config.ts:7-10` を書き換える:

```typescript
// 全体タイムアウト（ハング防止の安全ネット）。本番ビルド起動（next build）+
// 3ブラウザ 111 テストの 1 worker 直列 + 失敗時 retries=2 の wall-clock を含む。
// 2026-07-11 実測: 認証系 13 件が fail（各 3 リトライ）したランで 25.5 分。
// 1200s では収まらず 3 件が "did not run" で打ち切られた。
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
- **:3000 の TOCTOU は `E2E_NO_REUSE` で閉じてある**（Why this matters の解決節を参照）。
  `run-local.sh` が `E2E_NO_REUSE=1` を立て、`reuseExistingServer` が
  `!CI && !E2E_NO_REUSE` を評価するため、実測経路では再利用が構造的に起こらない。
  事前 `lsof` チェックは**安全性の根拠ではなく**、占有時のエラーを読みやすくする
  ためだけに残している — チェックを消しても安全性は変わらないが、失敗メッセージが
  分かりにくくなる。
- したがって **`reuseExistingServer` を素の `false` へ書き換えないこと**。素の
  `bunx playwright test` で毎回 build/起動が走り、ローカル反復が遅くなる。
  区別すべきは「CI か否か」ではなく「実測経路か反復経路か」であり、それを担うのが
  `E2E_NO_REUSE` である。
- 逆に、`run-local.sh` から `E2E_NO_REUSE` の export を外すと TOCTOU が復活する。
  この 2 つ（config の条件式と run-local.sh の export）は**対で意味を持つ**ので、
  一方だけを変更しないこと。
