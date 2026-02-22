# データ移行手順書

## ドキュメントガイド

- 本書は MySQL から PostgreSQL へのデータ移行手順を定義する
- 関連: `00-compatibility-matrix.md`, `02-environment-setup.md`
- 前提: 移行先の PostgreSQL インスタンスが起動済みであること

---

## 1. 移行戦略の選択

### 方式比較

| 方式 | 概要 | メリット | デメリット |
|---|---|---|---|
| **A. Prisma reset + 再シード** | 新規 DB をゼロから構築 | 最もクリーン。型の不一致リスクなし | 既存データが失われる |
| **B. pgloader** | MySQL → PostgreSQL 直接転送ツール | 自動型変換・高速 | テーブル名等の調整が必要 |
| **C. mysqldump + 手動変換** | SQL ダンプを PostgreSQL 互換に変換 | 細かい制御が可能 | 手動作業が多い |
| **D. Prisma seed スクリプト** | アプリ層でデータ移行 | Prisma バリデーション通過が保証 | 大量データでは低速 |

### 推奨方式

- **開発環境**: 方式 A（Prisma reset + 再シード）
- **ステージング/本番**: 方式 B（pgloader）または D（Prisma seed）

---

## 2. 事前準備

### 2-1. PostgreSQL インストール

```bash
# macOS (Homebrew)
brew install postgresql@16
brew services start postgresql@16

# データベース作成
createdb multivendor_ecommerce
```

### 2-2. Prisma スキーマの更新

互換性対応表（`00-compatibility-matrix.md`）に従い `schema.prisma` を更新する。
**注意: この手順書ではコード変更は行わない。対応表を参照すること。**

### 2-3. 新規マイグレーションの生成

```bash
# 既存マイグレーション履歴をリセット（新DB へのベースライン）
rm -rf prisma/migrations

# 新しい初期マイグレーションを生成
npx prisma migrate dev --name init_postgresql

# GIN インデックスの追加（マイグレーション SQL に手動追記）
# → 生成された migration.sql の末尾に以下を追加:
#
# CREATE INDEX idx_product_fulltext
#   ON "Product"
#   USING GIN (to_tsvector('simple', coalesce("name", '') || ' ' || coalesce("brand", '')));
#
# CREATE INDEX idx_variant_fulltext
#   ON "ProductVariant"
#   USING GIN (to_tsvector('simple', coalesce("variantName", '') || ' ' || coalesce("keywords", '')));
```

---

## 3. 方式 A: Prisma Reset + 再シード（開発環境向け）

### 手順

```bash
# 1. DATABASE_URL を PostgreSQL に変更（.env を編集）
# 2. マイグレーション実行
npx prisma migrate dev

# 3. Prisma Client 再生成
npx prisma generate

# 4. シードデータ投入
npx prisma db seed
```

### 検証

```bash
# テーブル一覧確認
npx prisma studio

# または psql で直接確認
psql -d multivendor_ecommerce -c '\dt'
```

---

## 4. 方式 B: pgloader（本番データ移行向け）

### 4-1. pgloader インストール

```bash
# macOS
brew install pgloader
```

### 4-2. 設定ファイル作成

`docs/migration/pgloader.conf`:

```
LOAD DATABASE
  FROM mysql://DB_USER:password@localhost:3306/multivendor_ecommerce
  INTO postgresql://DB_USER:password@localhost:5432/multivendor_ecommerce

WITH include drop, create tables, create indexes,
     reset sequences, downcase identifiers

ALTER SCHEMA 'multivendor_ecommerce' RENAME TO 'public'

CAST type text     to text,
     type longtext to text,
     type tinyint  to boolean using tinyint-to-boolean

BEFORE LOAD DO
  $$ DROP SCHEMA IF EXISTS public CASCADE; $$,
  $$ CREATE SCHEMA public; $$
;
```

> **注意**: pgloader はテーブル名を小文字に変換する（`downcase identifiers`）ため、
> Prisma の期待するテーブル名（PascalCase）と一致しない。
> 方式 B を使用する場合、以下の追加手順が必要:

### 4-3. テーブル名リネーム

pgloader 実行後、テーブル名を Prisma の期待する PascalCase に変更する。

```sql
-- pgloader が生成する小文字テーブル名を Prisma の PascalCase に変換
ALTER TABLE "user"                  RENAME TO "User";
ALTER TABLE "category"              RENAME TO "Category";
ALTER TABLE "subcategory"           RENAME TO "SubCategory";
ALTER TABLE "store"                 RENAME TO "Store";
ALTER TABLE "product"               RENAME TO "Product";
ALTER TABLE "productvariant"        RENAME TO "ProductVariant";
ALTER TABLE "size"                  RENAME TO "Size";
ALTER TABLE "productvariantimage"   RENAME TO "ProductVariantImage";
ALTER TABLE "color"                 RENAME TO "Color";
ALTER TABLE "offertag"              RENAME TO "OfferTag";
ALTER TABLE "spec"                  RENAME TO "Spec";
ALTER TABLE "question"              RENAME TO "Question";
ALTER TABLE "country"               RENAME TO "Country";
ALTER TABLE "shippingrate"          RENAME TO "ShippingRate";
ALTER TABLE "freeshipping"          RENAME TO "FreeShipping";
ALTER TABLE "freeshippingcountry"   RENAME TO "FreeShippingCountry";
ALTER TABLE "review"                RENAME TO "Review";
ALTER TABLE "reviewimage"           RENAME TO "ReviewImage";
ALTER TABLE "cart"                  RENAME TO "Cart";
ALTER TABLE "cartitem"              RENAME TO "CartItem";
ALTER TABLE "shippingaddress"       RENAME TO "ShippingAddress";
ALTER TABLE "order"                 RENAME TO "Order";
ALTER TABLE "ordergroup"            RENAME TO "OrderGroup";
ALTER TABLE "orderitem"             RENAME TO "OrderItem";
ALTER TABLE "wishlist"              RENAME TO "Wishlist";
ALTER TABLE "coupon"                RENAME TO "Coupon";
ALTER TABLE "paymentdetails"        RENAME TO "PaymentDetails";
-- Enum テーブルも確認すること
```

### 4-4. 実行

```bash
# ドライラン（実際の変更なし）
pgloader --dry-run docs/migration/pgloader.conf

# 本番実行
pgloader docs/migration/pgloader.conf

# テーブル名リネーム
psql -d multivendor_ecommerce -f docs/migration/rename-tables.sql

# マイグレーション履歴のベースライン設定
npx prisma migrate resolve --applied init_postgresql
```

---

## 5. 方式 D: Prisma Seed スクリプト（小〜中規模データ向け）

### 手順概要

1. MySQL から JSON データをエクスポートするスクリプトを作成
2. PostgreSQL 環境で Prisma seed を使ってインポート

```bash
# 1. MySQL からデータをエクスポート（Node.js スクリプト）
npx tsx docs/migration/export-mysql-data.ts

# 2. DATABASE_URL を PostgreSQL に切替
# 3. マイグレーション実行
npx prisma migrate dev

# 4. エクスポートしたデータをインポート
npx tsx docs/migration/import-postgres-data.ts
```

> スクリプトの実装は本ドキュメント範囲外。実装フェーズで作成する。

---

## 6. データ整合性検証

### 6-1. レコード数の比較

```sql
-- MySQL 側
SELECT
  (SELECT COUNT(*) FROM User) as users,
  (SELECT COUNT(*) FROM Store) as stores,
  (SELECT COUNT(*) FROM Product) as products,
  (SELECT COUNT(*) FROM ProductVariant) as variants,
  (SELECT COUNT(*) FROM `Order`) as orders;

-- PostgreSQL 側
SELECT
  (SELECT COUNT(*) FROM "User") as users,
  (SELECT COUNT(*) FROM "Store") as stores,
  (SELECT COUNT(*) FROM "Product") as products,
  (SELECT COUNT(*) FROM "ProductVariant") as variants,
  (SELECT COUNT(*) FROM "Order") as orders;
```

### 6-2. サンプルデータの目視確認

```bash
# Prisma Studio で確認
npx prisma studio
```

### 6-3. アプリケーション動作確認

```bash
# 開発サーバー起動
bun run dev

# 以下を手動で確認:
# - トップページの商品表示
# - 商品検索（フルテキスト）
# - カート追加・更新
# - ダッシュボードの表示
```

---

## 7. ロールバック計画

移行に失敗した場合の復旧手順：

1. `DATABASE_URL` を MySQL の接続文字列に戻す
2. `schema.prisma` を MySQL 版に `git checkout` で復元
3. `npx prisma generate` で Prisma Client を再生成
4. アプリケーションを再起動

> MySQL 側のデータは移行中も変更しない前提。
> 本番移行時はメンテナンスウィンドウを設けること。
