---
name: spec-sync-after-test
description: >
  Keeps spec documents and coverage reports in sync after test implementation or fixes.
  Updates quantitative metrics (test count, suite count, type error count) and
  regenerates coverage-dashboard.html.
  Triggered by: "仕様書更新", "ドキュメント更新", "テスト後の仕様同期",
  "spec sync after test", "update docs after test", "テスト実装後の更新",
  "カバレッジダッシュボード更新", "update coverage dashboard".
invocation: automatic
allowed-tools: [Read, Grep, Glob, Bash, Edit, Write]
---

# Spec Sync After Test スキル

## 目的

テスト実装・修正が完了した後、それに関連する仕様書・ドキュメントを**漏れなく一貫した状態**に保つスキル。
テストコードとドキュメントの乖離を防ぎ、次回参照時に古い情報が誤解を招かないようにする。

---

## 更新対象ドキュメント（4層構造）

| 層 | ファイル | 更新内容 |
|----|---------|---------|
| Layer 3 (SDD) | `specs/multi-vendor-ecommerce/07-testing.md` | テスト数・スイート数・テスト配置パス |
| Layer 4 (実装記録) | `docs/testing/COVERAGE_REPORT.md` | Executive Summary の定量指標・履歴テーブル |
| Layer 4 (実装記録) | `docs/PROGRESS.md` | 作業履歴エントリ追加 |
| Layer 4 (生成物) | `docs/coverage-dashboard.html` | `bun run coverage:dashboard` で再生成 |

> `docs/coverage-dashboard.html` は**手動編集禁止**。必ず再生成コマンドを使う。

---

## 実行手順（この順番を厳守すること）

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

### Step 3｜`specs/multi-vendor-ecommerce/07-testing.md` を更新する

更新箇所：
- `Current State` セクションの `XXX unit tests across YY suites` 行
  → `ZZZ tests across WW suites (N skipped), as of YYYY-MM-DD.` に書き換え
- テスト配置パスに新しい場所が追加された場合は `Existing unit tests live under` の行を更新
- Phase や大きな変更があった場合は 1–2 行のコンテキストを追記

**禁止**: セクション全体の書き直し・無関係な記述の削除。

### Step 4｜`docs/testing/COVERAGE_REPORT.md` を更新する

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

### Step 5｜`docs/PROGRESS.md` に作業履歴を追記する

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

### Step 6｜`docs/coverage-dashboard.html` を再生成する

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

### Step 7｜全変更をコミットする

```bash
git add specs/multi-vendor-ecommerce/07-testing.md \
        docs/testing/COVERAGE_REPORT.md \
        docs/PROGRESS.md \
        docs/coverage-dashboard.html
git commit -m "docs: sync spec and coverage docs after test implementation

- specs/07-testing.md: update test count (XXX tests / XX suites)
- COVERAGE_REPORT.md: add test total row, update history
- PROGRESS.md: add Phase N work log
- coverage-dashboard.html: regenerated (bun run coverage:dashboard)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## 判断基準：何を更新すべきか

```
テスト作業が完了した
  │
  ├─ テスト数が変わった？
  │   └─ YES → Step 1 → 07-testing.md + COVERAGE_REPORT.md を更新
  │
  ├─ 型エラー件数が変わった？
  │   └─ YES → COVERAGE_REPORT.md Executive Summary を更新
  │
  ├─ テストファイルを追加/削除した？
  │   └─ YES → Step 6 (dashboard 再生成) 必須
  │
  ├─ 大きな作業（Phase 完了・大量追加・バグ修正）？
  │   └─ YES → docs/PROGRESS.md に作業ログを追記
  │
  └─ 小さな修正（ラベル追加・コメント修正のみ）？
      └─ PROGRESS.md は任意。他の更新は実施する。
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
