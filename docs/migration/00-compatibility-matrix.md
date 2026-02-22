# MySQL → PostgreSQL 互換性対応表

## ドキュメントガイド

- 本書は MySQL 固有の機能と PostgreSQL での対応方法を一覧化する
- 関連: `01-data-migration-guide.md`, `02-environment-setup.md`
- 対象 Prisma バージョン: `^5.15.0`

---

## 1. Prisma スキーマ設定

### 1-1. `datasource` ブロック

| 項目 | MySQL（現在） | PostgreSQL（変更後） | 備考 |
|---|---|---|---|
| `provider` | `"mysql"` | `"postgresql"` | 必須変更 |
| `url` | `env("DATABASE_URL")` | `env("DATABASE_URL")` | 接続文字列の形式が異なる（後述） |
| `relationMode` | `"prisma"`（アプリ層FK） | `"foreignKeys"`（DB層FK） | PostgreSQL はネイティブ FK をサポート。`"prisma"` も使用可能だが推奨されない |

**変更前:**

```prisma
datasource db {
  provider     = "mysql"
  url          = env("DATABASE_URL")
  relationMode = "prisma"
}
```

**変更後:**

```prisma
datasource db {
  provider     = "postgresql"
  url          = env("DATABASE_URL")
  directUrl    = env("DIRECT_URL")
  relationMode = "foreignKeys"
}
```

> `directUrl` は Prisma Accelerate 使用時に必須。マイグレーション等の直接接続に使用されます。
>
> [!CAUTION]
> **`relationMode` を `"prisma"` → `"foreignKeys"` に変更する際の注意:**
> この変更により、DB レベルの外部キー制約が有効になります。MySQL で `relationMode = "prisma"` を使用していた場合、孤立レコード（参照先が存在しない行）があると `prisma migrate dev` が失敗します。
>
> **移行前の必須手順:**
> 1. 各テーブルで孤立レコードを検出するクエリを実行する
>
>    ```sql
>    -- 例: Product テーブルの categoryId が Category に存在するか確認
>    SELECT p.id FROM Product p LEFT JOIN Category c ON p.categoryId = c.id WHERE c.id IS NULL;
>    ```
>
> 2. 孤立レコードを修正または削除する
> 3. DB のバックアップ/スナップショットを取得する
> 4. `prisma migrate dev` を再実行する
>
> また、`@@index([foreignKeyField])` は `relationMode = "foreignKeys"` では Prisma が自動生成するため冗長になりますが、残しても問題ありません。

### 1-2. `generator` ブロック

| 項目 | MySQL（現在） | PostgreSQL（変更後） | 備考 |
|---|---|---|---|
| `previewFeatures` | `["fullTextSearch", "fullTextIndex"]` | `["fullTextSearch"]` | `fullTextIndex` は MySQL 専用。PostgreSQL では不要 |
| `accelerate` | *(未設定)* | `@prisma/extension-accelerate` を導入 | `DATABASE_URL` が `prisma://` スキームなら自動検出 |

**変更前:**

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearch", "fullTextIndex"]
}
```

**変更後:**

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearch"]
}
```

> **Accelerate 有効化**: `--accelerate` フラグは Prisma 5.2.0 で非推奨、7.0.0 で削除されました。Prisma >= 5.2.0 では `DATABASE_URL` に `prisma://` スキームを使用すると自動検出されるため、通常の `bunx prisma generate` で十分です。別途 `@prisma/extension-accelerate` をインストールし、`withAccelerate()` 拡張を適用してください。

### 1-3. Prisma Client 初期化コードの変更（`src/lib/db.ts`）

**変更前（現在）:**

```ts
import { PrismaClient } from "@prisma/client";
export const db = globalThis.prisma || new PrismaClient();
if (process.env.NODE_ENV === "production") globalThis.prisma = db;
```

**変更後（Accelerate 有効時）:**

```ts
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const extendedPrisma = () =>
  new PrismaClient().$extends(withAccelerate());

type ExtendedPrisma = ReturnType<typeof extendedPrisma>;

const globalForPrisma = globalThis as unknown as { prisma?: ExtendedPrisma };

export const db = globalForPrisma.prisma ?? extendedPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

> **Runtime 制約**: App Router 使用時は `export const runtime = 'nodejs'` を明示してください。Edge Runtime は Neon の TCP 接続のため使用不可です。

---

## 2. カラム型マッピング

### 2-1. ネイティブ型アノテーション（`@db.*`）

| 場所 | モデル.フィールド | MySQL（現在） | PostgreSQL（変更後） | 理由 |
|---|---|---|---|---|
| schema.prisma:22 | `User.picture` | `@db.Text` | `@db.Text` | 互換あり。変更不要 |
| schema.prisma:83 | `Store.description` | `@db.Text` | `@db.Text` | 互換あり。変更不要 |
| schema.prisma:128 | `Product.description` | `@db.LongText` | `@db.Text` | PostgreSQL に `LongText` 型はない。`Text` は無制限長 |
| schema.prisma:171 | `ProductVariant.variantDescription` | `@db.LongText` | `@db.Text` | 同上 |

### 2-2. Prisma 標準型の対応

| Prisma 型 | MySQL | PostgreSQL | 互換性 |
|---|---|---|---|
| `String` | `VARCHAR(191)` | `TEXT` | ✅ 互換あり |
| `Int` | `INT` | `INTEGER` | ✅ 互換あり |
| `Float` | `DOUBLE` | `DOUBLE PRECISION` | ✅ 互換あり |
| `Boolean` | `TINYINT(1)` | `BOOLEAN` | ✅ 互換あり |
| `DateTime` | `DATETIME(3)` | `TIMESTAMP(3)` | ✅ 互換あり |
| `String @id @default(uuid())` | `VARCHAR(191)` | `TEXT` | ✅ 互換あり |

---

## 3. インデックスと制約

### 3-1. フルテキストインデックス

| 場所 | 現在（MySQL） | PostgreSQL 対応 |
|---|---|---|
| schema.prisma:165 | `@@fulltext([name, brand])` | **削除**。GIN インデックスを別途作成 |
| schema.prisma:194 | `@@fulltext([variantName, keywords])` | **削除**。GIN インデックスを別途作成 |

**PostgreSQL でのフルテキスト検索の代替方法:**

```sql
-- GIN インデックスの作成（マイグレーション SQL として追加）
CREATE INDEX idx_product_fulltext
  ON "Product"
  USING GIN (to_tsvector('simple', coalesce("name", '') || ' ' || coalesce("description", '')));

CREATE INDEX idx_variant_fulltext
  ON "ProductVariant"
  USING GIN (to_tsvector('simple', coalesce("variantName", '') || ' ' || coalesce("keywords", '')));
```

> Prisma マイグレーション後に `prisma migrate diff` または手動 SQL で追加する。

### 3-2. 通常インデックス・ユニーク制約

| 種類 | MySQL | PostgreSQL | 互換性 |
|---|---|---|---|
| `@@index` | ✅ | ✅ | 完全互換 |
| `@unique` | ✅ | ✅ | 完全互換 |
| `@id` | ✅ | ✅ | 完全互換 |
| `onDelete: Cascade` | ✅ | ✅ | 完全互換 |

---

## 4. 生 SQL（Raw Query）の変更

### 4-1. フルテキスト検索クエリ

**ファイル:** `src/app/api/search-products/route.ts`

| | MySQL（現在） | PostgreSQL（変更後） |
|---|---|---|
| 構文 | `MATCH(col) AGAINST(? IN NATURAL LANGUAGE MODE)` | `to_tsvector('simple', col) @@ plainto_tsquery('simple', ?)` |
| ランキング | `MATCH() AGAINST()` のスコア値 | `ts_rank(tsvector, tsquery)` |

**変更前（MySQL）:**

```sql
SELECT p.id, p.name, p.description,
       MATCH(p.name, p.description) AGAINST(${q} IN NATURAL LANGUAGE MODE) AS relevance
FROM `Product` p
WHERE MATCH(p.name, p.description) AGAINST(${q} IN NATURAL LANGUAGE MODE)
ORDER BY relevance DESC
LIMIT 50
```

**変更後（PostgreSQL）:**

```sql
SELECT p.id, p.name, p.description,
       ts_rank(
         to_tsvector('simple', coalesce(p.name, '') || ' ' || coalesce(p.description, '')),
         plainto_tsquery('simple', ${q})
       ) AS relevance
FROM "Product" p
WHERE to_tsvector('simple', coalesce(p.name, '') || ' ' || coalesce(p.description, ''))
      @@ plainto_tsquery('simple', ${q})
ORDER BY relevance DESC
LIMIT 50
```

> **言語設定**: `'simple'` は言語に依存しないトークナイザー。日本語対応が必要な場合は `pg_bigm` や `pgroonga` 拡張の検討を推奨。

### 4-2. ランダム取得

**ファイル:** `src/queries/subCategory.ts` (L190-192)

| MySQL（現在） | PostgreSQL（変更後） |
|---|---|
| `ORDER BY RAND()` | `ORDER BY RANDOM()` |

**変更前:**

```sql
SELECT * FROM SubCategory ORDER BY RAND() LIMIT ${limit || 10};
```

**変更後:**

```sql
SELECT * FROM "SubCategory" ORDER BY RANDOM() LIMIT ${limit || 10};
```

### 4-3. テーブル名の引用

| | MySQL | PostgreSQL |
|---|---|---|
| テーブル名 | 大文字小文字を区別しない | **大文字小文字を区別する** |
| 引用符 | バッククォート `` ` `` | ダブルクォート `"` |

Prisma はモデル名をそのままテーブル名とするため：
- `SubCategory` → PostgreSQL では `"SubCategory"` と引用する必要がある
- `products` ではなく `"Product"` が正しいテーブル名

---

## 5. Prisma クエリ API の差異

### 5-1. `contains` フィルター

| | MySQL（現行動作） | PostgreSQL |
|---|---|---|
| `contains` のデフォルト | ケースインセンシティブ | **ケースセンシティブ** |
| 大文字小文字無視 | 自動 | `mode: "insensitive"` を明示 |

**影響を受ける箇所:**
- `src/queries/product.ts` — 商品検索フィルター
- `src/queries/profile.ts` — 注文・レビュー検索

**対応:**

```typescript
// 現在（MySQL では大文字小文字を自動的に無視）
{ name: { contains: filters.search } }

// PostgreSQL 対応（明示的に指定）
{ name: { contains: filters.search, mode: "insensitive" } }
```

### 5-2. Prisma のフルテキスト検索 API

MySQL では `previewFeatures = ["fullTextSearch"]` を有効にすると `search` フィルターが使えますが、
現状のコードでは Prisma API の `search` フィルターは使用されていません（生 SQL を使用）。
PostgreSQL でも同様に `search` フィルターが利用可能です。

---

## 6. 互換性サマリ

| カテゴリ | 変更箇所数 | 難易度 | リスク |
|---|:---:|:---:|:---:|
| Prisma datasource/generator 設定 | 3 | 低 | 低 |
| カラム型（`@db.LongText` → `@db.Text`） | 2 | 低 | 低 |
| `@@fulltext` 削除 + GIN インデックス追加 | 2 | 中 | 中 |
| 生SQL 書き換え（`MATCH...AGAINST`） | 1 | 中 | 高 |
| 生SQL 書き換え（`RAND()` → `RANDOM()`） | 1 | 低 | 低 |
| テーブル名引用（生SQL） | 2 | 低 | 中 |
| `contains` の `mode: "insensitive"` 追加 | 複数 | 低 | 中 |
