---
name: safe-migration
description: >
  Prismaマイグレーションを安全に実行する。
  「マイグレーション実行」「schema変更」「DB変更」「migrate実行」
  「Prismaマイグレーション」などのキーワードで使用。
  db push禁止、migrate dev必須。
  ユーザーが明示的に実行を指示した場合のみ動作。
invocation: explicit
allowed-tools: [Read, Bash, Grep]
---

# Safe Prisma Migration

## 目的

Prismaスキーマ変更を安全にマイグレーションする。

このプロジェクトでは `.agent/rules/core.md` で **`bunx prisma db push` は絶対禁止**、**`bunx prisma migrate dev` 必須**と明記されています。マイグレーション履歴（`prisma/migrations/`）の管理が必須です。

## トリガー条件

ユーザーが以下のいずれかを明示した場合のみ実行されます（`invocation: explicit`）：

- 「マイグレーション実行」「migrate実行」「Prismaマイグレーション」
- 「schema変更」「DB変更」「スキーマ更新」
- `/safe-migration` コマンドの直接実行

**重要**: このスキルは破壊的操作を含むため、ユーザーの明示的な指示なしには実行されません。

## 実行手順（必須順序）

### 1. 事前確認

#### A. スキーマ変更内容の読み込み

`prisma/schema.prisma` を読み込み、変更内容を理解します：

```typescript
// Read tool で以下のファイルを読み込む
prisma/schema.prisma
```

以下の変更タイプを特定：
- **追加**: 新しいモデル、フィールド、リレーション
- **変更**: フィールドの型変更、制約変更、インデックス変更
- **削除**: モデル、フィールド、リレーションの削除

#### B. 仕様書との整合性確認

`specs/multi-vendor-ecommerce/03-data-model.md` を読み込み、変更が仕様書に記載されているか確認：

- 新しいモデルが仕様書のER図に含まれているか
- フィールドの変更が仕様書のエンティティ定義に記載されているか
- 仕様書との乖離があれば警告

#### C. 既存マイグレーション履歴の確認

```bash
ls -la prisma/migrations/
```

マイグレーション履歴を確認し、以下をチェック：
- 最新のマイグレーション名とタイムスタンプ
- マイグレーション履歴の連続性
- `migration_lock.toml` の存在確認

### 2. バックアップ確認（必須）

**必ず**ユーザーに以下を確認します：

```
⚠️ データベースのバックアップは取得済みですか？

マイグレーションは破壊的操作を含む可能性があります。
以下の確認をお願いします：

1. データベースのバックアップが取得されている
2. 本番環境ではない、またはメンテナンスウィンドウ内である
3. マイグレーション内容を理解している

続行しますか？ (yes/no)
```

**明示的な「yes」が得られるまで次に進まない**。

### 3. 環境変数の確認

環境変数が本番DBを指していないか確認：

```bash
# DATABASE_URL をチェック（値は表示しない、存在確認のみ）
env | grep DATABASE_URL > /dev/null && echo "DATABASE_URL is set" || echo "DATABASE_URL is not set"
```

`DATABASE_URL` に `production`, `prod`, `prd` などのキーワードが含まれている場合、警告：

```
⚠️ 警告: 環境変数が本番環境を指している可能性があります。
本当に続行しますか？
```

### 4. マイグレーション実行

#### A. マイグレーション名の決定

変更内容に基づいて、説明的なマイグレーション名を提案：

- 新規モデル追加: `add_[model_name]` （例: `add_user_favorite`）
- フィールド追加: `add_[model]_[field]` （例: `add_product_is_featured`）
- フィールド変更: `modify_[model]_[field]` （例: `modify_user_email_unique`）
- フィールド削除: `remove_[model]_[field]` （例: `remove_product_old_price`）
- モデル削除: `remove_[model]` （例: `remove_legacy_cart`）

#### B. migrate dev コマンド実行

**絶対に `bunx prisma db push` を使わない**。必ず以下のコマンドを使用：

```bash
bunx prisma migrate dev --name <descriptive-name>
```

例:

```bash
bunx prisma migrate dev --name add_product_is_featured
```

#### C. 実行ログの確認

コマンドの出力を確認し、以下をチェック：
- マイグレーションファイルが生成されたか
- エラーが発生していないか
- データベースへの適用が成功したか

### 5. 生成されたマイグレーションの確認

#### A. 新しいマイグレーションディレクトリの確認

```bash
ls -la prisma/migrations/
```

最新のマイグレーションディレクトリ（タイムスタンプ付き）が生成されていることを確認。

#### B. migration.sql の内容確認

生成された `migration.sql` を読み込み、破壊的操作がないかチェック：

```sql
-- 破壊的操作の例（警告が必要）
DROP TABLE ...;
DROP COLUMN ...;
DELETE FROM ...;
ALTER TABLE ... DROP COLUMN ...;
ALTER TABLE ... DROP CONSTRAINT ...;
TRUNCATE TABLE ...;
```

**破壊的操作が含まれる場合**、ユーザーに以下の警告を表示：

```
⚠️ 破壊的操作が検出されました:

以下のSQL文が含まれています:
- DROP TABLE ...
- ALTER TABLE ... DROP COLUMN ...

これらの操作は元に戻せません。本当に続行しますか？

既にマイグレーションは生成されていますが、適用前に以下を実行できます:
1. migration.sql の内容を手動で確認・編集
2. bunx prisma migrate deploy でステージング環境にテスト適用
3. 問題があれば prisma/migrations/ の該当ディレクトリを削除して再生成
```

### 6. Prismaクライアント再生成

マイグレーション成功後、Prismaクライアントを再生成：

```bash
bunx prisma generate
```

`@prisma/client` が最新のスキーマに基づいて再生成されます。

### 7. 関連コードの更新提案

スキーマ変更に伴って更新が必要なコードを特定し、提案します：

#### A. サーバーアクションの影響範囲

`src/queries/` で影響を受けるファイルを特定：

```bash
# 変更されたモデル名でgrepして影響ファイルを特定
grep -r "db.[ModelName]" src/queries/
```

影響を受けるサーバーアクションをリストアップし、更新が必要な箇所を報告。

#### B. 型定義の更新

`src/lib/types.ts` で以下をチェック：
- Prismaの生成型を使用している箇所
- カスタム型定義が必要な箇所

#### C. Zodスキーマの更新

`src/lib/schemas.ts` で以下をチェック：
- フォームバリデーションスキーマ
- サーバーアクションの入力バリデーション

更新が必要なスキーマをリストアップ。

### 8. 仕様書更新の提案

`specs/multi-vendor-ecommerce/03-data-model.md` の更新案を提示：

```markdown
## 仕様書更新案

以下のセクションの更新が必要です:

### specs/multi-vendor-ecommerce/03-data-model.md

**セクション 3.2: エンティティ定義**

追加する内容:
- モデル `Product` にフィールド `isFeatured: Boolean` を追加
  - 用途: 特集商品としてホームページに表示するかを管理
  - デフォルト値: `false`

**セクション 3.4: ER図**

- `Product` エンティティに `isFeatured` フィールドを追加
```

### 9. 最終確認とレポート

以下の形式で実行結果をレポート：

```markdown
## Safe Migration 実行結果

### マイグレーション詳細

- **マイグレーション名**: `20240115120000_add_product_is_featured`
- **実行日時**: 2024-01-15 12:00:00
- **ステータス**: ✅ 成功 / ⚠️ 警告あり / ❌ 失敗

### 実行内容

1. スキーマ変更: `Product` モデルに `isFeatured` フィールド追加
2. マイグレーションファイル生成: `prisma/migrations/20240115120000_add_product_is_featured/`
3. データベースへの適用: 成功
4. Prismaクライアント再生成: 成功

### 破壊的操作の有無

- ✅ 破壊的操作なし
または
- ⚠️ 破壊的操作あり: DROP COLUMN ...

### 影響を受けるファイル

以下のファイルの更新が必要です:

1. **src/queries/product.ts**
   - `getProducts()` で `isFeatured` フィルタリングを追加

2. **src/lib/schemas.ts**
   - `ProductSchema` に `isFeatured` フィールド追加

3. **specs/multi-vendor-ecommerce/03-data-model.md**
   - セクション 3.2, 3.4 を更新

### 次のアクション

- [ ] 影響を受けるサーバーアクションを更新
- [ ] Zodスキーマを更新
- [ ] 仕様書を更新
- [ ] テストを追加・更新
- [ ] コミットして変更を確定
```

## 重要なルール（Critical Rules）

### 絶対禁止

1. **`bunx prisma db push` の使用**
   - このコマンドはマイグレーション履歴を残さない
   - `.agent/rules/core.md` で明示的に禁止されている
   - 必ず `bunx prisma migrate dev` を使用

2. **バックアップ確認なしのマイグレーション実行**
   - ユーザーの明示的な「yes」が必要
   - 曖昧な返答（「たぶん」「多分」）では進まない

3. **本番DB への直接マイグレーション**
   - 環境変数が本番を指している場合は警告
   - メンテナンスウィンドウ外の実行は禁止

### 必須事項

1. **マイグレーション名は説明的に**
   - プレフィックス: `add_`, `modify_`, `remove_`
   - モデル名とフィールド名を含める
   - 例: `add_product_is_featured`, `remove_user_legacy_field`

2. **破壊的操作の警告**
   - DROP, DELETE, ALTER ... DROP が含まれる場合は明示的に警告
   - 元に戻せない操作であることを強調

3. **仕様書との整合性確認**
   - `specs/multi-vendor-ecommerce/03-data-model.md` との比較
   - 乖離があれば報告

4. **関連コード更新の提案**
   - `src/queries/`, `src/lib/types.ts`, `src/lib/schemas.ts` への影響を分析
   - 更新が必要なファイルをリストアップ

### 推奨事項

1. **ステージング環境でのテスト**
   - 本番適用前に `bunx prisma migrate deploy` でステージングテスト
   - データの整合性を確認

2. **マイグレーション履歴の保持**
   - `prisma/migrations/` をGitにコミット
   - `migration_lock.toml` も含める

3. **ロールバック計画**
   - 問題が発生した場合の戻し方を事前に検討
   - バックアップからのリストア手順を確認

## 禁止操作の具体例

### ❌ 絶対にやってはいけないこと

```bash
# 禁止: db push（マイグレーション履歴が残らない）
bunx prisma db push

# 禁止: migration_lock.toml の削除
rm prisma/migrations/migration_lock.toml

# 禁止: マイグレーション履歴の手動編集（既に適用済みの場合）
vim prisma/migrations/20240115120000_*/migration.sql
```

### ✅ 正しい手順

```bash
# 正しい: migrate dev（マイグレーション履歴を作成）
bunx prisma migrate dev --name add_product_is_featured

# 正しい: Prismaクライアント再生成
bunx prisma generate

# 正しい: ステージング環境でのテスト
bunx prisma migrate deploy
```

## 参考: 主要ファイルパス

### Prisma関連

- `prisma/schema.prisma` - データモデル定義
- `prisma/migrations/` - マイグレーション履歴
- `prisma/migrations/migration_lock.toml` - マイグレーションロックファイル

### 仕様書

- `specs/multi-vendor-ecommerce/03-data-model.md` - データモデル仕様

### 実装

- `src/queries/*.ts` - サーバーアクション
- `src/lib/types.ts` - 型定義
- `src/lib/schemas.ts` - Zodスキーマ
- `src/lib/db.ts` - Prismaシングルトン

### ルール

- `.agent/rules/core.md` - migrate dev必須ルール
- `CLAUDE.md` - プロジェクト概要

## 使用例

### 例1: 新しいフィールド追加

```
ユーザー: 「/safe-migration」

Claude:
1. prisma/schema.prisma を読み込み
   → Product モデルに `isFeatured: Boolean @default(false)` 追加を確認

2. specs/multi-vendor-ecommerce/03-data-model.md を読み込み
   → 仕様書に記載なし（警告）

3. バックアップ確認:
   「⚠️ データベースのバックアップは取得済みですか？ (yes/no)」

4. ユーザーが「yes」と回答

5. マイグレーション実行:
   bunx prisma migrate dev --name add_product_is_featured

6. migration.sql 確認:
   ALTER TABLE "Product" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;
   → 破壊的操作なし ✅

7. Prismaクライアント再生成:
   bunx prisma generate

8. レポート生成と関連ファイル更新提案
```

### 例2: フィールド削除（破壊的操作）

```
ユーザー: 「マイグレーション実行」

Claude:
1. prisma/schema.prisma を読み込み
   → Product モデルから `oldPrice: Float?` 削除を確認

2. バックアップ確認:
   「⚠️ データベースのバックアップは取得済みですか？ (yes/no)」

3. ユーザーが「yes」と回答

4. マイグレーション実行:
   bunx prisma migrate dev --name remove_product_old_price

5. migration.sql 確認:
   ALTER TABLE "Product" DROP COLUMN "oldPrice";
   → ⚠️ 破壊的操作検出: DROP COLUMN

6. 警告表示:
   「⚠️ 破壊的操作が検出されました:
    - ALTER TABLE "Product" DROP COLUMN "oldPrice"

    この操作は元に戻せません。続行しますか？」

7. ユーザーが確認後、Prismaクライアント再生成

8. レポート生成
```

## まとめ

このスキルは、Prismaマイグレーションの安全性を最大化します：

- ✅ `migrate dev` 必須、`db push` 禁止の徹底
- ✅ バックアップ確認の強制
- ✅ 破壊的操作の事前警告
- ✅ 仕様書との整合性確認
- ✅ 関連コード更新の提案

データベースの整合性とマイグレーション履歴の管理を確実に行い、安全なスキーマ変更をサポートします。
