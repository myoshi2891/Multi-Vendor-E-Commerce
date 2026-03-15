---
name: safe-migration
description: >
  Safely executes Prisma schema migrations using migrate dev (db push is strictly forbidden).
  Verifies spec alignment, confirms backup, detects destructive operations, regenerates
  the Prisma client, and proposes related code updates.
  Only runs when the user explicitly requests it.
  Triggered by: "マイグレーション実行", "migrate実行", "Prismaマイグレーション",
  "schema変更", "DB変更", "スキーマ更新", "run migration", "apply migration",
  "prisma migrate", "/safe-migration".
invocation: explicit
allowed-tools: [Read, Bash, Grep]
---

# Safe Prisma Migration スキル

## 目的

`.agent/rules/core.md` の原則「`bunx prisma db push` は絶対禁止、`bunx prisma migrate dev` 必須」を徹底し、スキーマ変更を安全に適用するスキル。

> ⚠️ このスキルは破壊的操作を含むため `invocation: explicit` に設定されています。
> ユーザーの明示的な指示（「マイグレーション実行」等）がない限り、自動実行されません。

---

## 実行手順（この順番を厳守すること）

### Step 1｜スキーマ変更内容を読み込む

```
Read: prisma/schema.prisma
```

以下の変更タイプを特定する：

| 変更タイプ | 内容 |
|-----------|------|
| **追加** | 新しいモデル・フィールド・リレーション |
| **変更** | 型変更・制約変更・インデックス変更 |
| **削除** | モデル・フィールド・リレーションの削除 |

---

### Step 2｜仕様書との整合性を確認する

```
Read: specs/multi-vendor-ecommerce/03-data-model.md
```

確認ポイント：

- 新規モデルが仕様書の ER 図に含まれているか
- フィールド変更が仕様書のエンティティ定義に記載されているか
- 乖離がある場合は警告をユーザーに提示する

---

### Step 3｜既存マイグレーション履歴を確認する

```bash
ls -la prisma/migrations/
```

確認ポイント：

- 最新のマイグレーション名とタイムスタンプ
- 履歴の連続性
- `migration_lock.toml` の存在

---

### Step 4｜バックアップ確認（必須・ブロッキング）

ユーザーに以下を表示し、**明示的な「yes」が得られるまで次に進まない**：

```
⚠️ データベースのバックアップは取得済みですか？

マイグレーションは破壊的操作を含む可能性があります。
以下を確認してください：

1. データベースのバックアップが取得されている
2. 本番環境ではない、またはメンテナンスウィンドウ内である
3. マイグレーション内容を理解している

続行しますか？ (yes/no)
```

---

### Step 5｜接続先環境を確認する

認証情報を露出しないよう、ホスト名と DB 名のみを抽出して確認する：

```bash
if [ -n "$DATABASE_URL" ]; then
  DB_INFO=$(echo "$DATABASE_URL" | sed -E 's/.*@([^\/]+)\/([^?]+).*/host=\1 db=\2/')
  echo "データベース接続先: $DB_INFO"

  IS_PROD=false
  if [ "$NODE_ENV" = "production" ]; then IS_PROD=true; fi
  if [ "$MIGRATION_TARGET" = "production" ] || [ "$MIGRATION_TARGET" = "prod" ]; then IS_PROD=true; fi
  if echo "$DATABASE_URL" | grep -qiE '(production|prod|prd)'; then IS_PROD=true; fi

  if [ "$IS_PROD" = true ]; then
    echo "⚠️ 警告: 本番環境を指している可能性があります。本当に続行しますか？ (yes/no)"
  fi
else
  echo "DATABASE_URL が設定されていません"
fi
```

本番環境と判定された場合は**追加の明示的確認**を求める。

---

### Step 6｜マイグレーションを実行する

#### マイグレーション名の命名規則

| 変更内容 | 命名パターン | 例 |
|---------|------------|---|
| モデル追加 | `add_[model]` | `add_user_favorite` |
| フィールド追加 | `add_[model]_[field]` | `add_product_is_featured` |
| フィールド変更 | `modify_[model]_[field]` | `modify_user_email_unique` |
| フィールド削除 | `remove_[model]_[field]` | `remove_product_old_price` |
| モデル削除 | `remove_[model]` | `remove_legacy_cart` |

#### 実行コマンド（`db push` は絶対使用禁止）

```bash
bunx prisma migrate dev --name <add_descriptive_name>
```

実行後、出力ログで以下を確認する：

- マイグレーションファイルが生成されたか
- エラーが発生していないか
- DB への適用が成功したか

---

### Step 7｜生成された migration.sql を確認する

```bash
ls -la prisma/migrations/
# → 最新ディレクトリの migration.sql を Read する
```

以下の破壊的操作が含まれる場合はユーザーに警告を表示する：

```sql
DROP TABLE ...
DROP COLUMN ...
DELETE FROM ...
ALTER TABLE ... DROP COLUMN ...
ALTER TABLE ... DROP CONSTRAINT ...
TRUNCATE TABLE ...
```

**破壊的操作が検出された場合の警告テンプレート：**

```
⚠️ 破壊的操作が検出されました:

以下の SQL 文が含まれています:
- [検出されたSQL文]

この操作は元に戻せません。続行する前に以下を検討してください:
1. migration.sql を手動で確認・編集する
2. ステージング環境に先行適用する（bunx prisma migrate deploy）
3. ロールバックが必要な場合は、ディレクトリを削除せず補正マイグレーションを作成する
```

---

### Step 8｜Prisma クライアントを再生成する

```bash
bunx prisma generate
```

---

### Step 9｜関連コードの更新箇所を提案する

変更されたモデル名で影響範囲を特定する：

```bash
grep -rE "db\.[A-Za-z_][A-Za-z0-9_]*" src/queries/
```

```
Read: src/lib/types.ts
Read: src/lib/schemas.ts
```

更新が必要なファイルをリストアップして報告する。

---

### Step 10｜仕様書更新案を提示する

`specs/multi-vendor-ecommerce/03-data-model.md` の更新が必要なセクションと内容を提示する。

---

### Step 11｜実行結果レポートを出力する

```markdown
## Safe Migration 実行結果

### マイグレーション詳細
- **マイグレーション名**: `YYYYMMDDHHMMSS_[name]`
- **実行日時**: YYYY-MM-DD HH:MM:SS
- **ステータス**: ✅ 成功 / ⚠️ 警告あり / ❌ 失敗

### 実行内容
1. スキーマ変更: [内容]
2. マイグレーションファイル生成: `prisma/migrations/[name]/`
3. DB への適用: 成功
4. Prisma クライアント再生成: 成功

### 破壊的操作
- ✅ なし / ⚠️ あり（[SQL文]）

### 影響を受けるファイル（要更新）
1. `src/queries/XXX.ts` — [更新内容]
2. `src/lib/schemas.ts` — [更新内容]
3. `specs/multi-vendor-ecommerce/03-data-model.md` — [更新セクション]

### 次のアクション
- [ ] 影響するサーバーアクションを更新
- [ ] Zod スキーマを更新
- [ ] 仕様書を更新
- [ ] テストを追加・更新
- [ ] コミットして変更を確定
```

---

## 重要ルール

### ❌ 絶対禁止

- `bunx prisma db push` の使用（マイグレーション履歴が残らないため）
- `migration_lock.toml` の削除
- バックアップ確認なしのマイグレーション実行
- 適用済みマイグレーションの `migration.sql` 手動編集

### ✅ 必須

- `bunx prisma migrate dev --name [説明的な名前]` を使用する
- バックアップ確認でユーザーの明示的な「yes」を得る
- 破壊的操作（DROP / DELETE / TRUNCATE）は必ず警告する
- 仕様書 `03-data-model.md` との整合性を確認する
- マイグレーション名は `add_` / `modify_` / `remove_` プレフィックスを使用する

### 💡 推奨

- 本番適用前に `bunx prisma migrate deploy` でステージング環境テストを行う
- `prisma/migrations/` と `migration_lock.toml` を必ず Git にコミットする
- 破壊的変更がある場合はロールバック計画を事前に確認する

---

## 参考: 主要ファイルパス

```
# Prisma 関連
prisma/schema.prisma                    データモデル定義
prisma/migrations/                      マイグレーション履歴
prisma/migrations/migration_lock.toml  マイグレーションロックファイル

# 仕様書
specs/multi-vendor-ecommerce/03-data-model.md  データモデル仕様

# 実装
src/queries/*.ts      サーバーアクション
src/lib/types.ts      型定義
src/lib/schemas.ts    Zod スキーマ
src/lib/db.ts         Prisma シングルトン

# ルール
.agent/rules/core.md  migrate dev 必須ルール
CLAUDE.md             プロジェクト設定
```
