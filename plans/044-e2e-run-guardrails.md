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
   > // playwright.config.ts:60（現行行）
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

> **この事前チェックはレースを「縮める」だけで「無くさない」。** `lsof` はスクリプト開始時に
> 一度走るだけなので、(a) チェック通過後〜Playwright が :3000 を bind するまでの間に別プロセスが
> 割り込む TOCTOU 窓が残り、(b) 実行中に立ち上がるサーバーの再利用は止められない。**レースを
> 根絶する**には、根本原因である `reuseExistingServer:!CI` を断つこと。本プランは（2026-07-18 確定）
> `playwright.config.ts` の `webServer.reuseExistingServer` を
> `!process.env.CI && !process.env.E2E_NO_REUSE` へ変更し、`run-local.sh` から `E2E_NO_REUSE=1` を
> 立てる方針を採る（**素の `false` 直書きはローカルの高速反復を壊すため採らない** — Why this matters
> の「解決」節および Maintenance notes を参照。この一点に統一すること）。事前チェックはそれを補う
> 早期失敗であって、単独では保証にならない。

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
- [ ] **TOCTOU を閉じる実装自体が存在する**（機械検証。Scope の必須変更が入っていること）。
      **トークンの出現ではなく実装の形を検証すること** — 素の
      `grep -n "E2E_NO_REUSE" …` は「`E2E_NO_REUSE` を後で導入する」と書いた
      コメントや TODO にもヒットするため、未実装のまま PASS しうる:

  ```bash
  # config 側: reuseExistingServer の判定式に **否定形で** 組み込まれていること。
  # `.*E2E_NO_REUSE` だけでは極性を見ないため、意味が真逆の
  # `reuseExistingServer: !process.env.CI && !!process.env.E2E_NO_REUSE`
  # （= フラグを立てたときだけ再利用する）でも PASS してしまう。
  # `[^!]!` で「直前が `!` でない `!`」を要求し、`!!` を弾く。
  grep -nE 'reuseExistingServer:[^,]*[^!]![[:space:]]*(process\.env\.)?E2E_NO_REUSE' \
      playwright.config.ts

  # run-local.sh 側: 非空値を代入して export していること。
  # `=[^[:space:]]` が必須 — `export E2E_NO_REUSE=` は空文字列を代入するため
  # `process.env.E2E_NO_REUSE` が falsy になり reuse が残る（実装した気になれる無効形）。
  grep -nE '^[[:space:]]*export[[:space:]]+E2E_NO_REUSE=[^[:space:]]' scripts/e2e/run-local.sh

  # かつ export が playwright **起動行** より前にあること（行番号で順序を検証）。
  # 環境変数はプロセス起動時に読まれるので、起動行より後ろの export は無意味。
  #
  # 起動行の検出は「実際に走る行」に限ること。素の /playwright[[:space:]]+test/ は
  # コメント（`# … bunx playwright test を叩く`）や echo にも当たるため、
  # **本物の起動が無いスクリプトでも p が立ち**、順序判定が成立してしまう。
  awk '
    # コメント行・echo 行は実行行として数えない
    /^[[:space:]]*#/ { next }
    /^[[:space:]]*(export[[:space:]]+)?echo[[:space:]]/ { next }
    /^[[:space:]]*export[[:space:]]+E2E_NO_REUSE=[^[:space:]]/ && !e { e = NR }
    # コマンド位置（行頭 / 区切り / コマンド置換の直後）に現れる playwright test のみ
    /(^|[[:space:];&|]|\$\()[[:alnum:]_.\/-]*(playwright)[[:space:]]+test([[:space:]]|$)/ && !p { p = NR }
    END {
      if (!e) { print "FAIL: no non-empty export of E2E_NO_REUSE"; exit 1 }
      if (!p) { print "FAIL: no playwright test invocation found"; exit 1 }
      if (e > p) { printf "FAIL: export at line %d is after the run at line %d\n", e, p; exit 1 }
      printf "PASS: export(%d) precedes playwright test(%d)\n", e, p
    }' scripts/e2e/run-local.sh
  ```

  実測（2026-07-31・合成フィクスチャ。`E2E_NO_REUSE` は未実装のため現物では走らせられない）:
  - config ゲート — `!process.env.CI && !process.env.E2E_NO_REUSE` = **一致** /
    `!process.env.E2E_NO_REUSE` 単独 = **一致** /
    `!!process.env.E2E_NO_REUSE`（極性反転）= **不一致**。
    なお `process.env.E2E_NO_REUSE !== "1"` のような別形も**不一致**になる ——
    本プランは `!CI && !E2E_NO_REUSE` の形を指定しているので意図どおりだが、
    実装形を変えるならゲートも同時に変えること。
  - 順序ゲート — export → 起動 = **exit 0** / コメントで言及するだけの版 = **exit 1**
    （export 不在で落ちる。起動行の誤検出も同時に排除） / 起動の後に export = **exit 1**。

  3 本すべてが PASS すること。**トークンの存在だけを見ると、値が空でも・起動行の後ろに
  あっても緑になる** —— どちらも実行時には何の効果も持たないので、ゲートとしては
  未実装を見逃したのと同じである。現行の `playwright.config.ts:60` は
  `reuseExistingServer: !process.env.CI` で `E2E_NO_REUSE` を一切見ていないため、
  実装前は 1 本目が空で落ちる（＝このゲートが空振りしないことの確認になる）。
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
> **以下は本プラン実装**後**の到達状態を書いたものであり、現状の説明ではない。**
> 実測（2026-07-31）: `playwright.config.ts:60` は `reuseExistingServer: !process.env.CI`
> のみで `E2E_NO_REUSE` を見ておらず、`scripts/e2e/run-local.sh` に該当 export は
> **0 件**。`plans/README.md` の 044 Status も **TODO**。
> つまり **:3000 の TOCTOU は現時点では開いている**。この節を「もう閉じてある」と
> 読んで実装をスキップしないこと。

- **:3000 の TOCTOU は `E2E_NO_REUSE` で閉じる**（Why this matters の解決節を参照）。
  実装後は `run-local.sh` が `E2E_NO_REUSE=1` を立て、`reuseExistingServer` が
  `!CI && !E2E_NO_REUSE` を評価するため、実測経路では再利用が構造的に起こらなくなる。
  事前 `lsof` チェックは**安全性の根拠ではなく**、占有時のエラーを読みやすくする
  ためだけに残す — チェックを消しても安全性は変わらないが、失敗メッセージが
  分かりにくくなる。
- 実装後は **`reuseExistingServer` を素の `false` へ書き換えないこと**。素の
  `bunx playwright test` で毎回 build/起動が走り、ローカル反復が遅くなる。
  区別すべきは「CI か否か」ではなく「実測経路か反復経路か」であり、それを担うのが
  `E2E_NO_REUSE` である。
- 逆に、`run-local.sh` から `E2E_NO_REUSE` の export を外すと TOCTOU が復活する。
  この 2 つ（config の条件式と run-local.sh の export）は**対で意味を持つ**ので、
  一方だけを変更しないこと。
