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

### 2-0. MySQL データのバックアップ（必須）

移行方式にかかわらず、必ず事前にバックアップを取得してください。

```bash
# <DB_USER> は実際のユーザー名に置き換えてください
mysqldump -u <DB_USER> -p --single-transaction --routines --triggers \
  multivendor_ecommerce > backup_$(date +%Y%m%d).sql
```

> バックアップファイルは安全な場所に保管すること。
>
> **MySQL 9（Homebrew）を使用している場合**: `mysql2` ドライバとの認証互換のため、
> `.env` の `DATABASE_URL` に `?allowPublicKeyRetrieval=true` を付与してください（詳細: `02-environment-setup.md` セクション7）。

### 2-1. Neon プロジェクト作成

1. [Neon](https://neon.tech/) にログインし、「New Project」を作成。
2. Production ブランチを作成。
3. 接続URL（ステータスが `Active` なもの）を取得。
   - `postgresql://user:password@ep-xxxx.neon.tech/db?sslmode=require`

### 2-2. Prisma スキーマの更新

互換性対応表（`00-compatibility-matrix.md`）に従い `schema.prisma` を更新する。

### 2-3. Migration のリセット（重要）

MySQL 用のマイグレーション履歴は PostgreSQL では利用できないため、一度削除して初期化します。

> [!CAUTION]
> `rm -rf prisma/migrations` はマイグレーション履歴を**完全に削除**します。実行前に以下を確認してください：
> 1. 変更がコミット済みであること（または `git stash` で退避済み）
> 2. バックアップを取得済みであること

```bash
# 1. 内容確認
ls prisma/migrations/

# 2. バックアップ作成（安全策）
cp -r prisma/migrations prisma/migrations_mysql_backup

# 3. 削除
rm -rf prisma/migrations
```

**方式 A（Prisma Reset + 再シード）の場合:**

```bash
# DATABASE_URL を Neon Direct connection URL に設定した状態で実行
bunx prisma migrate dev --name init_postgresql
```

**方式 B（pgloader）の場合:**

```bash
# --create-only でスキーマファイルのみ生成（DB への適用はしない）
# DATABASE_URL を Neon Direct connection URL に設定した状態で実行
bunx prisma migrate dev --name init_postgresql --create-only
```

> ℹ️ この後の手順（pgloader 実行 → `rename-tables.sql` 実行 → `bunx prisma migrate resolve --applied <タイムスタンプ付きフォルダ名>`）は **セクション 4** を参照してください。
> `bunx prisma migrate dev` を実行する際は、Accelerate 経由の URL ではなく、Neon の **Direct connection** URL を `DATABASE_URL` に設定する必要があります。

---

## 3. 方式 A: Prisma Reset + 再シード（開発環境向け）

> **前提**: このセクションは方式 A（セクション 2-3）を完了していることを前提とします。
> `bunx prisma migrate dev --name init_postgresql`（セクション 2-3 の方式 A 手順）を実行済みの場合、
> 以下のステップ 2（migrate dev）はスキップ可能です。
> 方式 B から切り替える場合は、マイグレーション名 `init_postgresql` が方式 B 側と一致する必要があるため、
> `bunx prisma migrate resolve --applied init_postgresql` を実行済みか確認してください。

### 手順

```bash
# 1. DATABASE_URL を PostgreSQL に変更（.env を編集）
# 2. マイグレーション実行
bunx prisma migrate dev

# 3. Prisma Client 再生成
bunx prisma generate

# 4. シードデータ投入
bunx prisma db seed
```

### 検証

```bash
# テーブル一覧確認
bunx prisma studio

# または psql で直接確認（Neon 接続の場合は $DIRECT_URL を使用）
psql "$DIRECT_URL" -c '\dt'
```

---

## 4. 方式 B: pgloader（本番データ移行向け）

### 4-1. pgloader インストール

```bash
# macOS
brew install pgloader
```

### 4-2. 設定ファイル作成

> [!WARNING]
> pgloader の `include drop` オプションは、`FROM` 側の MySQL に存在する各テーブルに対して
> `DROP TABLE IF EXISTS "<tablename>" CASCADE` を接続先 PostgreSQL で実行します。
> これにより、移行先に既存テーブルがある場合はデータが失われます。
> （`DROP SCHEMA IF EXISTS public CASCADE` は `pgloader.conf` には含まれていません。）
> 実行前に必ず：
> 1. `INTO` 句の接続先 DB 名が移行対象であることを二重確認
> 2. バックアップを取得済みであることを確認
> 3. まず `--dry-run` でドライランを実行して接続文字列を確認
> 4. 本番環境の DB を `INTO` 句に直接指定しないこと

`docs/migration/pgloader.conf`:

```
LOAD DATABASE
  FROM mysql://<YOUR_MYSQL_USER>:<YOUR_MYSQL_PASSWORD>@localhost:3306/multivendor_ecommerce
  INTO postgresql://<YOUR_NEON_USER>:<YOUR_NEON_PASSWORD>@ep-xxxx.neon.tech/multivendor_ecommerce?sslmode=require

WITH include drop, create tables, create indexes,
     reset sequences, downcase identifiers

CAST type longtext to text,
     type tinyint  to boolean using tinyint-to-boolean
;
```

> **注意**: pgloader はテーブル名を小文字に変換する（`downcase identifiers`）ため、
> Prisma の期待するテーブル名（PascalCase）と一致しない。
> 方式 B を使用する場合、以下の追加手順が必要:

### 4-3. テーブル名リネーム

pgloader 実行後、テーブル名を Prisma の期待する PascalCase に変更する。

> **以下は `docs/migration/rename-tables.sql` の内容のサマリーです。**
> 実際に実行する際は、`BEGIN`/`COMMIT` トランザクション・`_prisma_migrations` の
> TRUNCATE DO ブロック・Enum 検証クエリを含む **スクリプトファイルを直接使用**してください（セクション 4-4 参照）。

```sql
-- ⚠ このスニペットはサマリーです。実際のコマンドは 4-4 の psql ... -f docs/migration/rename-tables.sql を使用してください。
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
-- Prisma 内部結合テーブル（多対多）
ALTER TABLE "_userfollowingstore"   RENAME TO "_UserFollowingStore";
ALTER TABLE "_coupontouser"         RENAME TO "_CouponToUser";
-- ※ 実際のスクリプトにはこの後に:
--   - _prisma_migrations TRUNCATE DO ブロック（public スキーマ限定）
--   - Enum 検証クエリ（SELECT typname FROM pg_type WHERE typtype = 'e'）
--   - COMMIT
-- が含まれます。
```

### 4-4. 実行

```bash
# ドライラン（接続文字列の検証のみ。スキーマやデータの変換シミュレーションは行われません）
pgloader --dry-run docs/migration/pgloader.conf

# 本番実行
pgloader docs/migration/pgloader.conf

# テーブル名リネーム（Neon に直接接続）
psql "$DIRECT_URL" -f docs/migration/rename-tables.sql

# マイグレーション履歴のベースライン設定
bunx prisma migrate resolve --applied init_postgresql
```

---

## 5. 方式 D: Prisma Seed スクリプト（小〜中規模データ向け）

### 手順概要

1. MySQL から JSON データをエクスポートするスクリプトを作成
2. PostgreSQL 環境で Prisma seed を使ってインポート

```bash
# 1. MySQL からデータをエクスポート（Node.js スクリプト）
bunx tsx docs/migration/export-mysql-data.ts

# 2. DATABASE_URL を PostgreSQL に切替
# 3. マイグレーション実行
bunx prisma migrate dev

# 4. エクスポートしたデータをインポート
bunx tsx docs/migration/import-postgres-data.ts
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
bunx prisma studio
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

## 7. 本番切替フロー（Neon ブランチ活用）

Neon のブランチング機能を活用し、安全に本番切替を行います。

1. Neon で staging 用 branch を作成
2. staging 環境（Vercel Preview）で接続確認・動作検証
3. MySQL からの最終データ同期（pgloader または seed）
4. Vercel の環境変数を Neon Production branch + Accelerate URL に切替
5. 再デプロイ
6. 本番動作確認

---

## 8. ロールバック計画

移行に失敗した場合の復旧手順：

1. **ローカル**: `.env` の `DATABASE_URL` を MySQL の接続文字列に戻す
2. **Vercel**: 環境変数 `DATABASE_URL` を MySQL 用に戻し、再デプロイ
3. `schema.prisma` を MySQL 版に `git checkout` で復元
4. `bunx prisma generate` で Prisma Client を再生成
5. アプリケーションを再起動

> MySQL 側のデータは移行中も変更しない前提。
> 本番移行時はメンテナンスウィンドウを設けること。

---

## 9. 依存パッケージの変更

MySQL 固有のドライバを削除し、PostgreSQL ドライバを追加します。

```bash
bun remove mysql2
bun add pg
```

> `mysql2` パッケージは `package.json` に direct dependency として含まれている場合のみ削除が必要です。
> Prisma は内部的にドライバを管理するため、通常は明示的な `pg` インストールは不要ですが、
> 生 SQL で `pg` を直接使用する場合は追加してください。

---

## 10. Prisma Migration 事故例とその対処

移行時・運用時によくある事故パターンを理解し、事前に回避してください。

### 事故1：カラム削除によるデータ消失

```prisma
// 変更前
model User {
  name String
}

// 変更後（nameを削除）
model User {
  // name削除
}
```

`bunx prisma migrate dev` → `name` カラムが**物理削除**され、データが完全に消失。

**✅ 安全手順**: まず `nullable` に変更 → データ退避 → カラム削除の3ステップで実施。

### 事故2：型変更による Migration 停止

`Int` → `String` 等の互換性のない型変更は PostgreSQL が変換に失敗し Migration が停止します。

**✅ 安全手順**: 新カラム作成 → データコピー → 旧カラム削除の3ステップで実施。

### 事故3：Enum 変更によるエラー

既存データが持つ enum 値を削除すると、DB が制約違反を起こします。

**✅ 対策**: Enum は追加のみ。削除は既存データの修正後に段階的に実施。

### 事故4：`prisma migrate dev` を本番で実行

shadow database の作成・スキーマ比較処理が走り、意図しない変更や破壊が起こります。

**✅ 本番では必ず**: `bunx prisma migrate deploy` を使用。

---

## 11. 本番で絶対やってはいけないこと

| 禁止事項 | 理由 |
|---|---|
| `bunx prisma migrate dev` を本番実行 | shadow DB 作成・意図しない変更が発生 |
| `bunx prisma db push` を本番実行 | Migration 履歴なしにスキーマが変更される |
| main ブランチへ直接 push して自動デプロイ | レビューなしの本番反映が起こる |
| 本番 DB に直接 SQL を実行 | 誤爆・ロールバック不可 |
| Preview 環境を本番 DB に接続 | 環境変数ミスで本番データが汚染される |
| バックアップなしで Migration | 失敗時の復旧手段がなくなる |

---

## 12. 将来の SaaS 化を見据えた設計メモ

現時点では不要ですが、将来のマルチテナント対応を見据えて以下を記録します。

### マルチテナント Prisma テンプレート

全ビジネステーブルに `orgId` を持たせる設計：

```prisma
model Organization {
  id    String @id @default(uuid())
  name  String
  users User[]
}

model User {
  id           String       @id @default(uuid())
  orgId        String
  organization Organization @relation(fields: [orgId], references: [id])
}
```

**クエリでは必ず `orgId` を条件に含めること**（漏洩防止）：

```ts
await db.product.findMany({
  where: { orgId: session.orgId }
})
```

### Stripe / PayPal 対応 DB 設計

```prisma
model Subscription {
  id                   String  @id @default(uuid())
  orgId                String
  stripeCustomerId     String?
  paypalSubscriptionId String?
  status               String
}
```

設計ポイント：provider 固有カラムは nullable、Webhook ログを別テーブルで保存。

### Row Level Security（RLS）— フェーズ2以降

PostgreSQL の RLS で DB レベルのテナント分離を実現：

```sql
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation
ON "Product"
USING (org_id = current_setting('app.current_org')::uuid);
```

> **個人開発の現フェーズでは不要。** SaaS化・マルチテナント対応時に検討。

### SaaS 化ロードマップ

| フェーズ | 内容 |
|---|---|
| Phase 1 | 単一 DB / 単一テナント（現状） |
| Phase 2 | `orgId` 分離 + RLS 導入 |
| Phase 3 | Stripe / PayPal 課金連携 |
| Phase 4 | Prisma Accelerate 有料化 + Read Replica |
| Phase 5 | 監視 + ログ基盤（Sentry 等） |
