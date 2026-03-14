---
name: spec-sync-check
description: >
  実装と仕様書の乖離をチェックし、報告する。
  「仕様確認」「仕様同期」「spec確認」「仕様書チェック」
  「仕様と実装の整合性」「仕様乖離」などのキーワードで使用。
  機能実装後や仕様と実装の整合性を確認したいときに自動的に実行される。
invocation: automatic
allowed-tools: [Read, Grep, Bash]
---

# Spec Sync Checker

## 目的

実装コードと仕様書（`specs/multi-vendor-ecommerce/`）の乖離を検出し、人間に報告する。

このプロジェクトは **SDD（仕様駆動開発）** を採用しており、`specs/multi-vendor-ecommerce/` の仕様書が**単一の真実のソース（Single Source of Truth）**です。実装と仕様の整合性を保つことが品質保証の核心です。

## トリガー条件

以下の場合に自動的に実行されます：

- ユーザーが「仕様確認」「仕様同期」「spec確認」「仕様書チェック」と言った場合
- 「仕様と実装の整合性を確認」「仕様乖離をチェック」などの表現を使った場合
- 新機能実装後、自動的に実行して乖離を報告する場合

## 実行手順

### 1. 対象ファイルの特定

変更されたコードファイルを特定します：

```bash
git status
git diff --name-only HEAD
```

最近のコミットで変更されたファイルを確認：

```bash
git log --oneline -5
```

### 2. 仕様書の読み込み（必須順序）

以下の仕様書を順番に読み込み、プロジェクトの全体像を把握します：

1. **`specs/multi-vendor-ecommerce/00-overview.md`** - プロダクトスコープ・システム概要
2. **`specs/multi-vendor-ecommerce/01-requirements.md`** - 機能・非機能要件・Acceptance Criteria
3. **`specs/multi-vendor-ecommerce/02-architecture.md`** - 技術制約・アーキテクチャ選定理由
4. **`specs/multi-vendor-ecommerce/03-data-model.md`** - エンティティ定義・ER関連
5. 必要に応じて以下も参照：
   - **`specs/multi-vendor-ecommerce/04-interfaces.md`** - API・UI定義
   - **`specs/multi-vendor-ecommerce/05-workflows.md`** - ユーザーフロー・業務フロー
   - **`specs/multi-vendor-ecommerce/07-testing.md`** - テスト方針・カバレッジ要件
   - **`specs/multi-vendor-ecommerce/08-open-questions.md`** - 未解決事項・議論中の課題

### 3. 乖離検出（主要な比較ポイント）

以下の観点で実装と仕様書を比較します：

#### A. データモデル変更の検出

**比較対象**:
- `prisma/schema.prisma` （実装）
- `specs/multi-vendor-ecommerce/03-data-model.md` （仕様書）

**チェック項目**:
- 新しいモデル（table）が追加されているか
- フィールドの追加・削除・型変更があるか
- リレーション（1:N, N:M）の変更があるか
- インデックス・制約の変更があるか

#### B. サーバーアクション（API）の変更検出

**比較対象**:
- `src/queries/*.ts` （実装）
- `specs/multi-vendor-ecommerce/04-interfaces.md` （仕様書）

**チェック項目**:
- 新しいサーバーアクションが追加されているか
- 関数シグネチャ（引数・戻り値）の変更があるか
- 認証・認可ロジックの変更があるか
- エラーハンドリングの変更があるか

#### C. ワークフロー（ユーザーフロー）の変更検出

**比較対象**:
- `src/app/` のルート構造・ページ構成（実装）
- `specs/multi-vendor-ecommerce/05-workflows.md` （仕様書）

**チェック項目**:
- 新しいページ・ルートが追加されているか
- ユーザーフローの順序が変更されているか
- 認証保護ルートの変更があるか（`src/middleware.ts`）
- ロール別アクセス制御の変更があるか

#### D. その他の重要な変更

- **外部サービス統合**: Clerk, Stripe, PayPal, Cloudinary の統合変更
- **技術制約**: `CLAUDE.md`, `.agent/rules/core.md` で定義されたルールの遵守
- **テスト要件**: `specs/multi-vendor-ecommerce/07-testing.md` のカバレッジ要件

### 4. 仕様書の該当セクションを特定

検出された乖離について、どの仕様書のどのセクションに記載されているべきかを明示します。

例:
- データモデル変更 → `03-data-model.md` の「3.2 エンティティ定義」セクション
- サーバーアクション変更 → `04-interfaces.md` の「4.1 サーバーアクション一覧」セクション
- ワークフロー変更 → `05-workflows.md` の該当するフロー図

### 5. レポート生成

以下の形式で乖離をレポートします：

```markdown
## 仕様同期チェック結果

### 検出された乖離

#### 1. [ファイル名]: [乖離内容]

- **実装**: ...（実際のコードの状態）
- **仕様書**: ...（仕様書に記載されている内容）
- **仕様書の該当箇所**: `specs/multi-vendor-ecommerce/XX-YYY.md` の [セクション番号・見出し]
- **推奨対応**: ...（仕様書を更新すべき内容）

#### 2. [次の乖離]

...

### 更新が必要な仕様書

以下の仕様書ファイルの更新が必要です：

1. `specs/multi-vendor-ecommerce/03-data-model.md`
   - セクション 3.2 に新しいモデル `XXX` を追加
   - セクション 3.4 のER図を更新

2. `specs/multi-vendor-ecommerce/04-interfaces.md`
   - セクション 4.1 に新しいサーバーアクション `createXXX()` を追加
   - API仕様表を更新

### 未解決事項の確認

`specs/multi-vendor-ecommerce/08-open-questions.md` に以下の未解決事項があります：

- [未解決事項の内容]

これらが今回の実装に影響する可能性があります。
```

### 6. 未解決事項の確認

`specs/multi-vendor-ecommerce/08-open-questions.md` を確認し、現在の実装に関連する未解決事項があれば報告に含めます。

## 重要なルール（Critical Rules）

### 必須事項

1. **乖離を見つけたら必ず人間に報告する**
   - 自動修正は絶対に行わない
   - 実装と仕様のどちらが正しいかは人間が判断する

2. **仕様書の該当セクションへの参照を明示する**
   - ファイル名だけでなく、セクション番号・見出しも含める
   - 例: `specs/multi-vendor-ecommerce/03-data-model.md` の「3.2 エンティティ定義」

3. **未解決事項（`08-open-questions.md`）を必ず確認する**
   - 実装に影響する未解決事項があれば報告に含める

### 報告の優先順位

以下の順序で乖離を報告します（重要度順）：

1. **データモデルの乖離**（最重要）
   - DBスキーマの変更は影響範囲が大きい
   - マイグレーション履歴との整合性が必要

2. **サーバーアクション（API）の乖離**
   - 外部システムとの契約に影響
   - セキュリティ・認証ロジックの変更

3. **ワークフロー・UIの乖離**
   - ユーザー体験に直接影響
   - 認証保護ルートの変更

### 禁止事項

1. **仕様書の自動修正を行わない**
   - 仕様書の更新は人間が判断・承認する

2. **実装の自動修正を行わない**
   - 実装が正しい場合もあるため、人間が判断する

3. **乖離の存在を隠さない**
   - 小さな乖離でも必ず報告する
   - 「たぶん問題ない」という判断はしない

## 参考: 主要ファイルパス

### 仕様書

- `specs/multi-vendor-ecommerce/00-overview.md`
- `specs/multi-vendor-ecommerce/01-requirements.md`
- `specs/multi-vendor-ecommerce/02-architecture.md`
- `specs/multi-vendor-ecommerce/03-data-model.md`
- `specs/multi-vendor-ecommerce/04-interfaces.md`
- `specs/multi-vendor-ecommerce/05-workflows.md`
- `specs/multi-vendor-ecommerce/06-quality.md`
- `specs/multi-vendor-ecommerce/07-testing.md`
- `specs/multi-vendor-ecommerce/08-open-questions.md`

### 実装

- `prisma/schema.prisma` - データモデル定義
- `src/queries/*.ts` - サーバーアクション
- `src/app/` - ルート構造・ページ
- `src/middleware.ts` - 認証保護ルート
- `.agent/rules/core.md` - AI エージェント動作制約
- `CLAUDE.md` - プロジェクト概要

## 使用例

### 例1: データモデル変更後の確認

```
ユーザー: 「仕様確認して」

Claude:
（このスキルが自動実行される）

1. git statusで変更ファイルを確認
   → prisma/schema.prisma が変更されている

2. specs/multi-vendor-ecommerce/03-data-model.md を読み込み

3. 乖離を検出:
   - 実装: Product モデルに新フィールド `isFeature: Boolean` が追加
   - 仕様書: Product モデルに `isFeatured` フィールドの記載なし

4. レポート生成:
   「prisma/schema.prismaに新フィールド `isFeatured` が追加されていますが、
    specs/multi-vendor-ecommerce/03-data-model.md のセクション3.2には
    記載されていません。仕様書の更新が必要です。」
```

### 例2: サーバーアクション追加後の確認

```
ユーザー: 「仕様と実装の整合性を確認」

Claude:
（このスキルが自動実行される）

1. git statusで変更ファイルを確認
   → src/queries/favorite.ts が新規追加

2. specs/multi-vendor-ecommerce/04-interfaces.md を読み込み

3. 乖離を検出:
   - 実装: favorite.ts に createFavorite(), deleteFavorite() を実装
   - 仕様書: お気に入り機能のAPI定義が存在しない

4. レポート生成:
   「src/queries/favorite.ts に新しいサーバーアクションが追加されていますが、
    specs/multi-vendor-ecommerce/04-interfaces.md のセクション4.1には
    記載されていません。仕様書の更新が必要です。」
```

## まとめ

このスキルは、SDD準拠の品質保証を自動化します。実装と仕様の乖離を早期に検出し、人間が適切な対応（仕様書更新 or 実装修正）を判断できるようにサポートします。
