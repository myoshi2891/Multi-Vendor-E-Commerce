# PostgreSQL 移行 実装ガイド（Claude CLI 引継ぎ用）

> 作成日: 2026-02-22
> 対象プロジェクト: `Multi-Vendor-E-Commerce`
> 移行先: Neon PostgreSQL 16 + Prisma Accelerate
> 参照ドキュメント: `docs/migration/` 配下の手順書群

このファイルは Claude CLI がゼロから読んで PostgreSQL 移行を完遂できるよう、
現時点の**コードの実態**と**残作業**をすべて記述したハンドオフ資料です。

---

## 現在の状態（開始点）

| ファイル | 状態 |
|---|---|
| `prisma/schema.prisma` | **PostgreSQL 設定済み**（provider = postgresql, directUrl 追加済み） |
| `prisma/migrations/` | PostgreSQL 用初期マイグレーション（`20260222101357_init_postgresql/`）が存在 |
| `prisma/migrations/migration_lock.toml` | `provider = "postgresql"` |
| `src/app/api/search-products/route.ts` | MySQL 専用の `MATCH ... AGAINST` Raw SQL を使用中（これから修正） |
| `src/queries/subCategory.ts` L191 | MySQL 専用の `RAND()` を Raw SQL で使用中（これから修正） |
| `package.json` | `mysql2` が削除済み |
| `.env` | `DATABASE_URL=prisma://...`, `DIRECT_URL=postgresql://...` 設定済み |
| `docs/migration/` | 手順書・スクリプト群（`pgloader.conf`, `rename-tables.sql` 等）準備完了 |

---

## Step 1: Neon プロジェクト準備（手動作業・事前に完了させること）

Claude CLI が実行する前に人間が行う作業:

1. [neon.tech](https://neon.tech/) にログインし、新規プロジェクト作成
2. `main` ブランチの **Direct connection URL** を取得
   - 形式: `postgresql://user:pass@ep-xxxx.neon.tech/multivendor_ecommerce?sslmode=require`
3. [Prisma Console](https://console.prisma.io/) にログインし、Accelerate 用 API キーを取得
   - 形式: `prisma://accelerate.prisma-data.net/?api_key=...`
4. 上記 2 つの URL を人間がメモしておく

---

## Step 2: `schema.prisma` の更新

**ファイル:** `prisma/schema.prisma`

### 2-1. datasource ブロックの変更

```diff
 generator client {
   provider        = "prisma-client-js"
-  previewFeatures = ["fullTextSearch", "fullTextIndex"]
+  previewFeatures = ["fullTextSearch"]
 }

 datasource db {
-  provider     = "mysql"
+  provider     = "postgresql"
   url          = env("DATABASE_URL")
-  relationMode = "prisma"
+  directUrl    = env("DIRECT_URL")
 }
```

> **⚠️ `relationMode = "prisma"` 削除による FK 振る舞い変化について**
>
> MySQL 環境では `relationMode = "prisma"` により Prisma アプリケーション側で FK をエミュレートしていましたが、
> PostgreSQL ネイティブの外部キー制約に切り替わります。
> **方式 B（pgloader）でデータ移行する場合**: MySQL 側に DB レベルの FK 制約がない場合、
> 孤立レコードや NULL 参照が存在すると移行後に **FK 違反エラー**が発生する可能性があります。
>
> **事前チェック（pgloader 実行前に MySQL 側で実行）:**
>
> ```sql
> -- 孤立レコード診断例（定義側 Store がない Product）
> SELECT id FROM Product WHERE storeId NOT IN (SELECT id FROM Store);
> -- 上記が 0 件または完全に修正されてから移行を進めてください。
> ```

### 2-2. MySQL 固有の型を変更

```diff
-  description       String  @db.LongText           # Product model L128
+  description       String  @db.Text

-  variantDescription String? @db.LongText           # ProductVariant model L171
+  variantDescription String? @db.Text
```

### 2-3. `@@fulltext` インデックスを削除

```diff
-  @@fulltext([name, brand])                         # Product model L165
-  @@fulltext([variantName, keywords])               # ProductVariant model L194
```

### 2-4. 冗長インデックス削除（推奨）

`PaymentDetails` モデルに `@unique` と `@@index` が両方存在するため `@@index([orderId])` を削除。

---

## Step 3: `.env` の接続文字列変更

**ファイル:** `.env`（git ignore 対象のため手動で編集）

```bash
# 変更前（MySQL）
DATABASE_URL="mysql://..."

# 変更後（Prisma Accelerate + Neon Direct）
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=<Step1で取得したAPIキー>"
DIRECT_URL="postgresql://<user>:<pass>@ep-xxxx.neon.tech/multivendor_ecommerce?sslmode=require"
```

> `.env` は gitignore 対象なので、このファイルを直接編集してください。

---

## Step 4: MySQL バックアップ取得

```bash
# <DB_USER> は実際のユーザー名に置き換えてください
mysqldump -u <DB_USER> -p --single-transaction --routines --triggers \
  multivendor_ecommerce > backup_$(date +%Y%m%d).sql
```

---

## Step 5: マイグレーション履歴のリセット

```bash
# 1. MySQL 用マイグレーションをバックアップ
cp -r prisma/migrations prisma/migrations_mysql_backup

# 2. 削除
rm -rf prisma/migrations
```

**方式 A（Prisma Reset + 再シード）の場合:**

```bash
# DATABASE_URL を DIRECT_URL（Neon Direct connection）に一時的に変更してから実行
bunx prisma migrate dev --name init_postgresql
```

**方式 B（pgloader でデータ移行）の場合:**

```bash
# スキーマファイルのみ生成（DB への適用はしない）
bunx prisma migrate dev --name init_postgresql --create-only
```

> 詳細手順: `docs/migration/01-data-migration-guide.md` セクション 4

---

## Step 6: データ移行（方式 B: pgloader を使う場合）

```bash
# ドライラン（接続確認のみ）
pgloader --dry-run docs/migration/pgloader.conf

# 本番実行（MySQL → Neon への転送）
pgloader docs/migration/pgloader.conf

# テーブル名リネーム（Neon に直接接続）
psql "$DIRECT_URL" -f docs/migration/rename-tables.sql

# Prisma に「このマイグレーションは適用済み」と記録
# <exact_timestamped_folder_name> は Step 5 で生成されたフォルダ名を使用（下記のコマンドで確認）
ls prisma/migrations/
bunx prisma migrate resolve --applied <exact_timestamped_folder_name>
```

> 詳細: `docs/migration/rename-tables.sql`（BEGIN/COMMIT, 結合テーブルリネーム含む）

---

## Step 7: Raw SQL の PostgreSQL 対応

### 7-1. `MATCH ... AGAINST` の置き換え

**ファイル:** `src/app/api/search-products/route.ts` (L22-28)

現在のコード（MySQL 専用、**動作しない**）:

```ts
const rows = await db.$queryRaw<ProductSearchRow[]>(Prisma.sql`
  SELECT p.id, p.name, p.description,
         MATCH(p.name, p.description) AGAINST(${q} IN NATURAL LANGUAGE MODE) AS relevance
  FROM products p
  WHERE MATCH(p.name, p.description) AGAINST(${q} IN NATURAL LANGUAGE MODE)
  ORDER BY relevance DESC
  LIMIT 50
`);
```

置き換え案（PostgreSQL `tsvector`）:

```ts
const rows = await db.$queryRaw<ProductSearchRow[]>(Prisma.sql`
  SELECT p.id, p.name, p.description,
         ts_rank(
           to_tsvector('simple', p.name || ' ' || COALESCE(p.description, '')),
           plainto_tsquery('simple', ${q})
         ) AS relevance
  FROM "Product" p
  WHERE to_tsvector('simple', p.name || ' ' || COALESCE(p.description, ''))
        @@ plainto_tsquery('simple', ${q})
  ORDER BY relevance DESC
  LIMIT 50
`);
```

### 7-2. `RAND()` の置き換え

**ファイル:** `src/queries/subCategory.ts` (L191)

```diff
-  SELECT * FROM SubCategory ORDER BY RAND() LIMIT ${limit || 10};
+  SELECT * FROM "SubCategory" ORDER BY RANDOM() LIMIT ${limit || 10};
```

---

## Step 8: `contains` 検索の大文字小文字対応

MySQL ではデフォルトで大文字小文字を区別しませんが、PostgreSQL では**区別します**。
以下のファイルの `contains` フィルタに `mode: "insensitive"` を追加してください。

```ts
// 変更前
{ name: { contains: searchQuery } }

// 変更後
{ name: { contains: searchQuery, mode: "insensitive" } }
```

**該当ファイル:**
- `src/app/api/index-products/route.ts` — contains フォールバック（複数箇所）
- `src/queries/profile.ts` — 注文・決済・レビュー検索（L88, L94, L104, L221, L224, L327）
- `src/queries/product.ts` — 商品フィルタ（L469, L472, L477, L478）

---

## Step 9: `db.ts` の Accelerate 対応（Accelerate 使用時のみ）

Prisma Accelerate (`prisma://` URL) を使う場合のみ必要。Direct connection のみなら変更不要。

**ファイル:** `src/lib/db.ts`

```diff
-import { PrismaClient } from "@prisma/client";
+import { PrismaClient } from "@prisma/client/edge";
+import { withAccelerate } from "@prisma/extension-accelerate";
+
+function createPrisma() {
+  return new PrismaClient().$extends(withAccelerate());
+}

 declare global {
-  var prisma: PrismaClient | undefined;
+  var prisma: ReturnType<typeof createPrisma> | undefined;
 }

-export const db = globalThis.prisma || new PrismaClient();
+export const db = globalThis.prisma || createPrisma();

 if (process.env.NODE_ENV !== "production") globalThis.prisma = db;
```

インストールが必要:

```bash
bun add @prisma/extension-accelerate
```

---

## Step 10: クリーンアップ

```bash
# MySQL ドライバ削除
bun remove mysql2

# Prisma Client 再生成
bunx prisma generate

# TypeScript ビルド確認
bun run build
```

---

## Step 11: 動作確認

```bash
# 接続確認
psql "$DIRECT_URL" -c '\dt'

# 開発サーバー起動
bun run dev

# ユニットテスト
bun run test

# E2Eテスト
bunx playwright test
```

---

## チェックリスト

```
[ ] Step 1: Neon プロジェクト作成・URL 取得（手動）
[ ] Step 2: schema.prisma 更新（provider, @@fulltext, @db.LongText 削除）
[ ] Step 3: .env 更新（DATABASE_URL, DIRECT_URL）
[ ] Step 4: MySQL バックアップ取得
[ ] Step 5: prisma/migrations 削除・再生成
[ ] Step 6: pgloader でデータ移行（方式 B の場合）
[ ] Step 7: Raw SQL 修正（MATCH AGAINST → tsvector, RAND() → RANDOM()）
[ ] Step 8: contains に mode: "insensitive" 追加
[ ] Step 9: db.ts の Accelerate 対応（Accelerate 使用時のみ）
[ ] Step 10: bun remove mysql2, bunx prisma generate, bun run build
[ ] Step 11: 動作確認（psql, bun run dev, テスト）
```

---

## 補足: 既に完了している作業

- `docs/migration/pgloader.conf` — 設定ファイル準備済み
- `docs/migration/rename-tables.sql` — 結合テーブル含むリネームスクリプト準備済み
- `docs/migration/01-data-migration-guide.md` — 詳細手順書
- `docs/migration/02-environment-setup.md` — 環境変数ガイド
- `docs/migration/04-document-update-checklist.md` — ドキュメント更新チェックリスト
