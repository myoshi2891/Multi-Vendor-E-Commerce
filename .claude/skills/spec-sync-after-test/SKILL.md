---
name: spec-sync-after-test
description: >
  Keeps spec documents and coverage reports in sync after test implementation,
  feature implementation, or phase completion.
  Updates quantitative metrics (test count, suite count, type error count),
  regenerates coverage-dashboard.html, and syncs functional specs
  (04-interfaces.md, 05-workflows.md, 08-open-questions.md) and progress
  trackers (docs/design/*/PROGRESS.md, docs/PROGRESS.md next-actions) when
  new server actions, pages, or workflows were implemented.
  Triggered by: "仕様書更新", "ドキュメント更新", "テスト後の仕様同期",
  "spec sync after test", "update docs after test", "テスト実装後の更新",
  "カバレッジダッシュボード更新", "update coverage dashboard",
  "フェーズ完了", "機能実装後の仕様同期", "phase complete", "feature sync".
invocation: automatic
allowed-tools: [Read, Grep, Glob, Bash, Edit, Write]
---

# Spec Sync After Test スキル

## 目的

テスト実装・機能実装・フェーズ完了の後、関連するすべての仕様書・ドキュメントを**漏れなく一貫した状態**に保つスキル。
テスト統計の同期だけでなく、**新しいサーバーアクション / ページ / ワークフローを実装した場合は機能仕様書の同期も必須**。

> **このスキルは `test-gen` / `test-complete` の直後に必ず起動するのが正規ルート**です。
> テスト数 / スイート数 / スナップショット数が変動した場合は省略不可
> （[`.claude/rules/02-tdd-step-commit.md`](../../rules/02-tdd-step-commit.md) 参照）。
> **テスト数が変動しなくても、フェーズ完了・機能実装・新規 query 追加があった場合は必ず起動すること。**

---

## 同期モードの判定（Step 0 で決定）

| モード | 条件 | 追加で更新するドキュメント |
|--------|------|--------------------------|
| **A: テスト統計同期** | テスト数 / スイート数 / スナップショット数が変動した | 統計 5 ファイル（下表）|
| **B: 機能仕様同期** | `src/queries/*.ts` に新規関数追加 / `src/app/**` に新規ページ追加 | `04-interfaces.md`, `05-workflows.md`, `08-open-questions.md` |
| **C: フェーズ進捗同期** | Phase / Task の完了・着手状況が変化した | `docs/design/*/PROGRESS.md`, `docs/PROGRESS.md` 次アクションセクション |
| **D: コミット履歴同期** | 新しいコミットが積まれた（常時） | `QA_HANDOFF.md` HEAD + コミット履歴テーブル |

> モードは **複数同時に適用される**。今回の変更内容から該当するモードをすべて起動すること。
> モード B / C は**テスト数が変動しなくても必須**（UI 実装完了後などテスト追加なしのフェーズ完了が典型）。

---

## 更新対象ドキュメント（documentation-guide.md の Layer 1・3・4 に対応）

### モード A（テスト統計同期）— テスト数変動時

| 層 | ファイル | 更新内容 |
|----|---------|---------|
| Layer 1 (SSOT) | `docs/testing/QA_HANDOFF.md` | テスト統計テーブル (**統計の正本**) + HEAD ハッシュ + コミット履歴 |
| Layer 3 (SDD) | `specs/multi-vendor-ecommerce/07-testing.md` | テスト数・スイート数・テスト配置パス |
| Layer 4 | `docs/testing/COVERAGE_REPORT.md` | Executive Summary の定量指標・履歴テーブル |
| Layer 4 | `docs/PROGRESS.md` | 作業履歴エントリ追加 + テスト統計テーブル (QA_HANDOFF.md から同期) |
| Layer 4 (生成物) | `docs/coverage-dashboard.html` | `bun run coverage:dashboard` で再生成 |

### モード B（機能仕様同期）— 新規 query / ページ / ワークフロー追加時

| 層 | ファイル | 更新内容 |
|----|---------|---------|
| Layer 3 (SDD) | `specs/multi-vendor-ecommerce/04-interfaces.md` | 新しいサーバーアクション・モジュール・API ルートを追記 |
| Layer 3 (SDD) | `specs/multi-vendor-ecommerce/05-workflows.md` | ワークフローの追加・変更を反映 |
| Layer 3 (SDD) | `specs/multi-vendor-ecommerce/08-open-questions.md` | 実装で解決した Open Question を「Partially/Fully resolved」に更新 |

### モード C（フェーズ進捗同期）— Phase / Task 完了時

| 層 | ファイル | 更新内容 |
|----|---------|---------|
| Layer 1 | `docs/design/*/PROGRESS.md` | 完了タスクを `⬜` → `✅` に更新、現在地・次着手を書き換え |
| Layer 1 | `docs/PROGRESS.md` 「次アクション」 | 完了した依頼プロンプトを削除し、次フェーズの依頼プロンプトに置換 |

### モード D（コミット履歴同期）— 常時

| 層 | ファイル | 更新内容 |
|----|---------|---------|
| Layer 1 (SSOT) | `docs/testing/QA_HANDOFF.md` | `> **最終更新**: YYYY-MM-DD / **HEAD**: \`xxxxxxx\`` と主要コミット履歴テーブル末尾を更新 |

> `docs/coverage-dashboard.html` は**手動編集禁止**。必ず再生成コマンドを使う。
> **同期順序**: `QA_HANDOFF.md` を最初に更新（SSOT 確定）→ 他のファイルへ伝播。

---

## 実行手順（この順番を厳守すること）

### Step 0｜変更スコープを確認し、起動するモードを決定する

```bash
git diff --name-only HEAD~1..HEAD 2>/dev/null || git diff --name-only HEAD
git log --oneline -3
```

出力から以下を判定する：

| 検出パターン | 起動するモード |
|-------------|--------------|
| `src/queries/*.ts` に新規関数追加（`export const get*/update*/create*` が増加） | **B: 機能仕様同期** |
| `src/app/**/*.tsx` に新規ページ追加 / `src/components/**` に新規コンポーネント追加 | **B: 機能仕様同期**（ワークフロー変更を伴う場合）|
| Phase / Task の完了（プラン・PROGRESS.md の状態変化） | **C: フェーズ進捗同期** |
| テスト数 / スイート数 / スナップショット数の変動 | **A: テスト統計同期** |
| 上記に関わらず新しいコミットが存在する | **D: コミット履歴同期**（常時）|

> **UI のみの実装（テスト数変動なし）でもモード B / C / D は必須。**
> 「テスト数が変わっていないので `spec-sync-after-test` は不要」という判断は誤り。

---

### Step 1｜最新テスト統計を取得する

```bash
bun run test -- --no-coverage 2>&1 | tail -6
```

出力から以下を記録する：
- `Tests: X passed, Y total` → **テスト総数 Y、スキップ数**
- `Test Suites: X passed, Y total` → **スイート数 Y**

> ⚠️ `docs/` 内の古い数値は参考値。**必ず実行結果で上書きすること**。

### Step 2｜型エラー件数を確認する

```bash
bunx tsc --noEmit 2>&1 | grep "error TS" | wc -l
```

0件であれば「型エラー 0 件 (解消済み)」と記載。

### Step 3｜`docs/testing/QA_HANDOFF.md` を SSOT として更新する（最優先・モード A/D）

> **このステップを Step 4 以降より先に実行する。** QA_HANDOFF.md は
> [documentation-guide.md](../../steering/documentation-guide.md) で
> 「テスト数・統計の SSOT」と規定されており、他ファイルはここから同期する。

**モード D（常時）— HEAD とコミット履歴の更新:**
- `> **最終更新**: YYYY-MM-DD / **HEAD**: \`xxxxxxx\`` を `git log -1 --format=%h` の値で更新
- 主要コミット履歴テーブル末尾に新コミットを追加（テスト数変動の有無にかかわらず）
  - テスト数変動なし・UI 実装のみの場合でも「機能完成コミット」として記録する

**モード A（テスト数変動時）— 統計の更新:**
- `### テスト統計（YYYY-MM-DD 時点）` 見出しの日付を更新
- テスト統計テーブル (Jest テスト総数 / スイート / スナップショット / 型エラー / Skipped) を Step 1〜2 の実測値で上書き
- 該当する `### フェーズ別実施状況` のエントリにステータス変化を反映
- 「次回着手用 依頼プロンプト」セクションが影響を受ける場合 (タスク完了 / 新規追加) は **`scripts/coverage-dashboard/render-html.ts` の `NEXT_ACTIONS` 配列と同期して更新する**。詳細は QA_HANDOFF.md 内 "依頼プロンプト" セクションの更新規約を参照

**禁止**: テスト統計テーブルを Step 1〜2 の出力なしに**推測値で更新する**こと。

### Step 4｜`specs/multi-vendor-ecommerce/07-testing.md` を更新する

更新箇所：
- `Current State` セクションの `XXX unit tests across YY suites` 行
  → `ZZZ tests across WW suites (N skipped), as of YYYY-MM-DD.` に書き換え
- テスト配置パスに新しい場所が追加された場合は `Existing unit tests live under` の行を更新
- Phase や大きな変更があった場合は 1–2 行のコンテキストを追記

**禁止**: セクション全体の書き直し・無関係な記述の削除。

### Step 5｜`docs/testing/COVERAGE_REPORT.md` を更新する

**4.1 Executive Summary テーブル**

| 更新が必要な行 | 条件 |
|--------------|------|
| `テスト総数` 行（なければ追加） | 常に更新 |
| `テストファイル総数` 行 | テストファイルを追加/削除した場合のみ |
| `型エラー` 行（なければ追加） | 常に更新 |

**4.2 ヒートマップ (`## 2. Current State Heatmap`)**

`✦` / `◐` / `◯` の更新基準：
- `✦` : テスト存在 & `.skip` なし & 重大なギャップなし
- `◐` : `.skip` 含む or 部分カバー
- `◯` : テストなし

新しいドメイン列 (`hooks`, `lib` など) がカバーされた場合のみ更新。
ヒートマップは**自動生成物 (`bun run coverage:dashboard`) の補完**ではなく
人間が読むための概要なので、明らかな変化がなければ編集しない。

**4.3 履歴テーブル (`## 7. 履歴`)**

```markdown
| YYYY-MM-DD | 作業内容の要約 (commits `abc1234`–`def5678`) |
```

直近のコミットハッシュは `git log --oneline -5` で確認。

### Step 6｜`docs/PROGRESS.md` に作業履歴を追記する

最終エントリの直後（ファイル末尾付近）に以下の構造で追記：

```markdown
---

### [作業タイトル] (YYYY-MM-DD)

#### 概要

[1-2文で何をしたか]

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `path/to/file.ts` | 変更概要 | `abc1234` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 前回値 | **最新値** |
| スイート数 | 前回値 | **最新値** |
| 型エラー | 前回値 | **0 件** |
```

> コミットハッシュは `git log --oneline` で正確な値を確認すること。推測禁止。

### Step 7｜`docs/coverage-dashboard.html` を再生成する

```bash
bun run coverage:dashboard
```

出力例の確認：

```
[coverage-dashboard] found XX test file(s)
[coverage-dashboard] wrote docs/coverage-dashboard.html (XXX KB)
```

> ⚠️ lcov.info が古い場合（2025-03-16 のまま）は、先に `bun run test -- --coverage` を
> 実行して更新してから再生成すると精度が上がる。ただし CI 未整備のため任意。

### Step 7b｜機能仕様書を更新する（モード B — 新規 query / ページ追加時）

> テスト数が変動しなくても、新しいサーバーアクションやページを追加した場合は必ず実行する。

**`specs/multi-vendor-ecommerce/04-interfaces.md`**（新規 query 追加時）:
- `## Server Actions (Queries)` の `Notable modules:` リストに新モジュール名を追加
- 追加したモジュールの関数・引数・戻り値型・キャッシュ戦略を表形式で追記

  ```markdown
  ### dashboard module (`src/queries/dashboard.ts`)
  | Function | Description | Cache |
  |----------|-------------|-------|
  | `getFoo()` | 概要 | `unstable_cache` N min |
  ```

- 新規 API ルートを追加した場合は `## API Routes` セクションを更新

**`specs/multi-vendor-ecommerce/05-workflows.md`**（新規ページ / フロー追加時）:
- 対象ユーザーフロー（Admin / Seller / Customer / Auth）の該当セクションにステップを追加
- 既存ステップが繰り下がる場合は番号を更新

**`specs/multi-vendor-ecommerce/08-open-questions.md`**（実装で解決した質問がある場合）:
- 該当する Open Question に `*(Partially/Fully resolved — Phase N: ...)` 注記を追加
- フルに解決した場合は質問自体を `## Resolved Issues` セクションへ移動

---

### Step 7c｜フェーズ進捗トラッカを更新する（モード C — Phase / Task 完了時）

**`docs/design/*/PROGRESS.md`**（フェーズ別 PROGRESS.md が存在する場合）:
- `## 🧭 現在地` の日付を今日の日付に更新
- 完了した Phase / Task の状態を `⬜` → `✅` に変更し、コミットハッシュを記入
- 次着手の `👈 次はここ` ポインタを次フェーズへ移動

**`docs/PROGRESS.md` 「次アクション」セクション**:
- 完了したフェーズの依頼プロンプト（`### N. 【最優先】...`）を**削除または完了マーク化**
- 次フェーズの依頼プロンプトを新規追加（コピペ可能な形式で）
- 「完了」エントリは削除するのではなく `docs/PROGRESS.md` の「フェーズ別サマリ」へ記録する

---

### Step 8｜全変更をコミットする

```bash
git add specs/multi-vendor-ecommerce/07-testing.md \
        docs/testing/QA_HANDOFF.md \
        docs/testing/COVERAGE_REPORT.md \
        docs/PROGRESS.md \
        docs/coverage-dashboard.html
# (Optional: If NEXT_ACTIONS was modified in scripts/coverage-dashboard/render-html.ts)
# git add scripts/coverage-dashboard/render-html.ts
git commit -m "docs: sync spec and coverage docs after test implementation

- specs/07-testing.md: update test count (XXX tests / XX suites)
- COVERAGE_REPORT.md: add test total row, update history
- PROGRESS.md: add Phase N work log
- coverage-dashboard.html: regenerated (bun run coverage:dashboard)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## 判断基準：何を更新すべきか（Step 0 の詳細フロー）

```
作業が完了した（テスト実装 / 機能実装 / フェーズ完了 を問わず）
  │
  ├─ [モード D] 新しいコミットが積まれた？（常時 YES）
  │   └─ YES → QA_HANDOFF.md の HEAD ハッシュ + コミット履歴テーブルを更新（Step 3）
  │
  ├─ [モード A] テスト数 / スイート数 / スナップショット数が変わった？
  │   └─ YES → Step 1〜2 で実測値を取得
  │             → QA_HANDOFF.md 統計テーブル (Step 3, SSOT)
  │             → 07-testing.md + COVERAGE_REPORT.md を更新（Step 4〜5）
  │             → coverage-dashboard.html を再生成（Step 7）
  │
  ├─ [モード B] src/queries/*.ts に新規関数追加 / src/app/** に新規ページ追加？
  │   └─ YES → 04-interfaces.md にモジュール・関数を追記（Step 7b）
  │             → 05-workflows.md にワークフローを追記（Step 7b）
  │             → 08-open-questions.md の解決済み質問を更新（Step 7b）
  │   ※ テスト数が変動しない UI 実装完了後も必須
  │
  ├─ [モード C] Phase / Task が完了した？
  │   └─ YES → docs/design/*/PROGRESS.md の状態を ⬜→✅ に更新（Step 7c）
  │             → docs/PROGRESS.md の「次アクション」依頼プロンプトを次フェーズへ置換（Step 7c）
  │
  ├─ 型エラー件数が変わった？
  │   └─ YES → QA_HANDOFF.md + COVERAGE_REPORT.md Executive Summary を更新
  │
  ├─ scripts/coverage-dashboard/render-html.ts の NEXT_ACTIONS を編集した？
  │   └─ YES → Step 7 (dashboard 再生成) 必須 + QA_HANDOFF.md の
  │              「次回着手用 依頼プロンプト」セクションを同期
  │
  └─ 小さな修正（ラベル追加・コメント修正のみ）？
      └─ PROGRESS.md は任意。モード D（HEAD 更新）は常に実施する。
```

---

## ❌ 禁止事項

| 禁止 | 理由 |
|------|------|
| `docs/coverage-dashboard.html` を手動編集 | 次回 `bun run coverage:dashboard` で上書きされる |
| `git log` を使わずコミットハッシュを推測 | 誤ったハッシュが履歴に残る |
| テスト数を実行せず「増えたはず」で更新 | 乖離が次回更新時の混乱を招く |
| `specs/07-testing.md` の他セクションを編集 | SDD は最小変更原則。テスト数と配置パスのみ対象 |
| `lcov.info` を手動編集 | 生成物のため。更新するなら `bun run test -- --coverage` のみ |

---

## 💡 推奨事項

- 更新は **テストが全パスした直後**に実施する（失敗したまま更新しない）
- `PROGRESS.md` の日付は `YYYY-MM-DD` 形式で相対表現（「先週」等）を避ける
- 更新差分は小さく保つ。テスト数・日付・コミットハッシュ以外を変える場合は
  別 PR として分離するか、変更理由をコミットメッセージに明記する
- `COVERAGE_REPORT.md` のヒートマップは **手動管理**。
  `bun run coverage:dashboard` が自動生成するマトリクスとは別物なので
  重複して管理していることを意識する

---

## 関連スキル

| スキル | 関係 |
|--------|------|
| `test-gen` | テスト追加 → **本スキル**で仕様書を同期 |
| `test-complete` | テスト実行・品質チェック → **本スキル**で結果を記録 |
| `spec-sync-check` | 仕様と実装の乖離検出（読み取りのみ） |
| `safe-migration` | DB 変更後に `specs/03-data-model.md` を更新（本スキルと同じ思想） |

---

## 関連ドキュメント

- [`specs/multi-vendor-ecommerce/07-testing.md`](../../specs/multi-vendor-ecommerce/07-testing.md) — テスト要件 SDD
- [`docs/testing/COVERAGE_REPORT.md`](../../docs/testing/COVERAGE_REPORT.md) — カバレッジレポート
- [`docs/PROGRESS.md`](../../docs/PROGRESS.md) — 作業ログ
- [`docs/coverage-dashboard.html`](../../docs/coverage-dashboard.html) — 視覚的ダッシュボード
- [`scripts/coverage-dashboard/`](../../scripts/coverage-dashboard/) — ダッシュボード生成スクリプト
- [`.claude/steering/documentation-guide.md`](../../steering/documentation-guide.md) — ドキュメント配置ルール
