---
name: spec-sync-check
description: >
  Detects and reports divergences between implementation code and spec documents
  in specs/multi-vendor-ecommerce/. Never auto-fixes — always reports to the human
  for judgment. Follows SDD (Spec-Driven Development) principles where specs are
  the single source of truth.
  Triggered by: "仕様確認", "仕様同期", "spec確認", "仕様書チェック",
  "仕様と実装の整合性", "仕様乖離", "spec check", "sync check",
  "check spec", "verify spec alignment", "仕様乖離をチェック".
invocation: automatic
allowed-tools: [Read, Grep, Bash]
---

# Spec Sync Checker スキル

## 目的

実装コードと仕様書（`specs/multi-vendor-ecommerce/`）の乖離を検出し、人間に報告するスキル。

このプロジェクトは **SDD（仕様駆動開発）** を採用しており、`specs/multi-vendor-ecommerce/` が **Single Source of Truth** です。乖離の自動修正は絶対に行わない。実装・仕様書どちらが正しいかは人間が判断する。

---

## 実行手順（この順番を厳守すること）

### Step 1｜変更ファイルを特定する

```bash
git status
git diff --name-only HEAD
git log --oneline -5
```

変更されたファイルの種類（`prisma/schema.prisma` / `src/queries/` / `src/app/` 等）によって、次のステップで読み込む仕様書を絞り込む。

---

### Step 2｜関連する仕様書を読み込む

変更内容に応じて必要な仕様書を選んで読み込む（全件読み込みは不要）：

| 変更ファイル | 読み込む仕様書 |
|------------|--------------|
| `prisma/schema.prisma` | `03-data-model.md` |
| `src/queries/*.ts` | `04-interfaces.md` |
| `src/app/` / `src/middleware.ts` | `05-workflows.md` |
| 全般的な確認 | `00-overview.md` → `01-requirements.md` → `02-architecture.md` の順 |

必要に応じて追加参照：

```text
Read: specs/multi-vendor-ecommerce/07-testing.md     テスト方針・カバレッジ要件
Read: specs/multi-vendor-ecommerce/08-open-questions.md  未解決事項
```

---

### Step 3｜乖離を検出する

以下の4つの観点で実装と仕様書を比較する。

#### A. データモデルの乖離

```text
比較: prisma/schema.prisma ↔ 03-data-model.md
```

チェック項目：

- 新しいモデル（テーブル）の追加
- フィールドの追加・削除・型変更
- リレーション（1:N / N:M）の変更
- インデックス・制約の変更

#### B. サーバーアクション（API）の乖離

```text
比較: src/queries/*.ts ↔ 04-interfaces.md
```

チェック項目：

- 新しいサーバーアクションの追加
- 関数シグネチャ（引数・戻り値型）の変更
- 認証・認可ロジックの変更
- エラーハンドリングの変更

#### C. ワークフロー・ルートの乖離

```text
比較: src/app/ + src/middleware.ts ↔ 05-workflows.md
```

チェック項目：

- 新しいページ・ルートの追加
- ユーザーフローの順序変更
- 認証保護ルートの変更
- ロール別アクセス制御の変更

#### D. その他の重要な変更

- 外部サービス統合（Clerk / Stripe / PayPal / Cloudinary）の変更
- `CLAUDE.md` / `.agent/rules/core.md` で定義された技術制約の遵守状況
- テストカバレッジ要件（`07-testing.md`）との乖離

---

### Step 4｜未解決事項を確認する

```text
Read: specs/multi-vendor-ecommerce/08-open-questions.md
```

現在の実装に影響する未解決事項があればレポートに含める。

---

### Step 5｜レポートを出力する

優先度の高い順（データモデル → API → ワークフロー → その他）で報告する：

```markdown
## 仕様同期チェック結果

### 検出された乖離

#### 🔴 [優先度: 高] データモデルの乖離

**乖離 1: [内容]**
- 実装: [実際のコードの状態]
- 仕様書: [仕様書に記載されている内容]
- 該当箇所: `specs/multi-vendor-ecommerce/03-data-model.md` — セクション [番号・見出し]
- 推奨対応: [仕様書を更新すべき内容 or 実装を修正すべき内容]

#### 🟡 [優先度: 中] API の乖離

**乖離 2: [内容]**
- 実装: ...
- 仕様書: ...
- 該当箇所: `specs/multi-vendor-ecommerce/04-interfaces.md` — セクション [番号・見出し]
- 推奨対応: ...

---

### 更新が必要な仕様書

1. `specs/multi-vendor-ecommerce/03-data-model.md`
   - セクション 3.2 に新モデル `XXX` を追加
   - セクション 3.4 の ER 図を更新

2. `specs/multi-vendor-ecommerce/04-interfaces.md`
   - セクション 4.1 に `createXXX()` のシグネチャを追加

---

### 未解決事項（08-open-questions.md より）

以下が今回の実装に影響する可能性があります：
- [ ] [未解決事項の内容]

---

### 乖離なし ✅

（乖離が検出されなかった場合はこのセクションのみ表示）
```

---

## 重要ルール

### ❌ 絶対禁止

- 仕様書の自動修正・自動更新
- 実装コードの自動修正
- 「たぶん問題ない」という判断による乖離の隠蔽
- 乖離の重要度を無断で低く見積もること

### ✅ 必須

- 乖離を検出したら必ず人間に報告する（規模の大小にかかわらず）
- 仕様書の該当箇所はファイル名だけでなくセクション番号・見出しも明示する
- `08-open-questions.md` を必ず確認し、関連する未解決事項を報告に含める
- 報告の優先順位はデータモデル → API → ワークフロー → その他の順に従う

### 💡 推奨

- 変更ファイルの種類で読み込む仕様書を絞り込み、不要な仕様書の読み込みを避ける
- 乖離がない場合も「乖離なし ✅」と明示し、チェックが完了したことを伝える

---

## 参考: 主要ファイルパス

```text
# 仕様書
specs/multi-vendor-ecommerce/
  00-overview.md        プロダクトスコープ・システム概要
  01-requirements.md    機能・非機能要件
  02-architecture.md    技術制約・アーキテクチャ
  03-data-model.md      エンティティ定義・ER 図
  04-interfaces.md      API・UI 定義
  05-workflows.md       ユーザーフロー・業務フロー
  06-quality.md         品質基準
  07-testing.md         テスト方針・カバレッジ要件
  08-open-questions.md  未解決事項

# 実装
prisma/schema.prisma    データモデル定義
src/queries/*.ts        サーバーアクション
src/app/                ルート構造・ページ
src/middleware.ts       認証保護ルート

# ルール
.agent/rules/core.md    AI エージェント動作制約
CLAUDE.md               プロジェクト設定
```
