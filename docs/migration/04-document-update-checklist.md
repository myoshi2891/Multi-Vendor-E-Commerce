# 既存ドキュメント更新チェックリスト

## ドキュメントガイド

- 本書は MySQL → PostgreSQL 移行に伴い更新が必要な既存ドキュメントの一覧
- 移行実装フェーズでコード変更と合わせて更新すること

---

## 1. Specs ドキュメント

### `specs/multi-vendor-ecommerce/00-overview.md`

- [x] L14: `MySQL + Prisma persistence.` → `PostgreSQL + Prisma persistence.`
- [x] L31: `Prisma ORM with a MySQL database.` → `Prisma ORM with a PostgreSQL database.`

### `specs/multi-vendor-ecommerce/02-architecture.md`

- [x] L7: `Prisma ORM + MySQL` → `Prisma ORM + PostgreSQL`
- [x] L25: `MySQL fulltext search used in product search with a fallback to contains.`
  → `PostgreSQL fulltext search (tsvector/tsquery) used in product search with a fallback to contains.`

### `specs/multi-vendor-ecommerce/04-interfaces.md`

- [x] L55: `MySQL as primary datastore.` → `PostgreSQL as primary datastore.`

### `specs/multi-vendor-ecommerce/06-quality.md`

- [x] L15: `MySQL fulltext search with a fallback to contains queries.`
  → `PostgreSQL fulltext search (GIN + tsvector) with a fallback to contains queries.`

### `specs/multi-vendor-ecommerce/07-testing.md`

- [x] L12: `Integration: Prisma + MySQL with reset and seed per suite.`
  → `Integration: Prisma + PostgreSQL with reset and seed per suite.`

### `specs/multi-vendor-ecommerce/03-data-model.md`

- [ ] L31: `Fulltext: Product(name, brand)` → GIN インデックス使用の記述に更新
  （`to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,''))` ベース）
  ※ schema から `@@fulltext([name, brand])` は削除済みのためドキュメントとの整合が必要

### `specs/multi-vendor-ecommerce/04-interfaces.md` <!-- noqa: MD024 -->

- [x] L55: `MySQL as primary datastore.` → `PostgreSQL as primary datastore.`
- [x] 環境変数リストに `DIRECT_URL` を追加（Neon Direct connection 用）

---

## 2. README.md（設計書）

### Mermaid 図内のデータベース表記

- [x] L63: `DB[(MySQL データベース)]` → `DB[(PostgreSQL データベース)]`
- [x] L266: `MYSQL[(MySQL)]` → `PGSQL[(PostgreSQL)]`
- [x] L301: `PRISMA_CLIENT --> MYSQL` → `PRISMA_CLIENT --> PGSQL`
- [x] L424: `DATABASE[(MySQL)]` → `DATABASE[(PostgreSQL)]`

---

## 3. TESTING_DESIGN.md

- [x] L40: `DB: MySQL test database using Docker Compose`
  → `DB: PostgreSQL test database using Docker Compose`
- [x] L111: `Use a dedicated MySQL schema for tests.`
  → `Use a dedicated PostgreSQL database for tests.`
- [x] L123: `E2E_DATABASE_URL="mysql://user:pass@localhost:3306/app_test"`
  → `E2E_DATABASE_URL="postgresql://user:pass@localhost:5432/app_test"`

---

## 4. PROGRESS.md

- [x] L36, L47: MySQL 固有の記述あり（`brew services start mysql` 等）。
  過去の経緯として残しても良いが、PostgreSQL 移行後の追記セクションを追加する。

例:

```markdown
## 追記 (移行日付)
- MySQL → PostgreSQL 移行完了
- 接続方式: PostgreSQL 16 (Homebrew)
- フルテキスト検索: GIN + tsvector に移行済み
```

---

## 5. ソースコード内のコメント

| ファイル | 行 | 内容 |
|---|---|---|
| `src/app/api/search-products/route.ts` | L21 | `// Prisma.sql + $queryRaw で型安全 & SQLインジェクション防止` — コメント自体は変更不要だが SQL 文の変更に合わせて更新推奨 |
| `src/queries/subCategory.ts` | L188 | `// If random selection is required, use a raw query to randomize` — コメントは変更不要 |

---

## 6. 環境設定ファイル

- [x] `.env` — `DATABASE_URL` を Accelerate 形式に変更、`DIRECT_URL` を追加（`02-environment-setup.md` 参照）
- [x] `.env.example`（存在する場合）— 同様に更新
- [x] `schema.prisma` — `directUrl = env("DIRECT_URL")` を追加
- [x] `prisma/migrations/migration_lock.toml` — `provider = "postgresql"` に更新（またはマイグレーション再生成）
- [x] `CLAUDE.md` — プロジェクト概要と既知の制約を PostgreSQL 用に更新

---

## 更新順序の推奨

1. **Prisma スキーマ** → マイグレーション生成
2. **ソースコード** → 生SQL・`contains` モード変更・`db.ts` Accelerate 対応
3. **テスト設計書** → `TESTING_DESIGN.md`
4. **Specs ドキュメント** → `specs/` 配下 5 ファイル
5. **README.md** → Mermaid 図の更新
6. **PROGRESS.md** → 移行完了の追記
7. **`neon_prisma_accelerate.md`** → `docs/migration/` に統合済み、ルートから削除済み ✅

---

## 更新漏れ検索コマンド

移行後に MySQL 関連の表記が残っていないかを確認するには、以下の ripgrep コマンドを使用してください。
`docs/migration/` は移行用ドキュメント自体のため除外しています。

```bash
# specs/, README.md, TESTING_DESIGN.md の MySQL 表記を一括検索（大文字小文字不問）
# ※ PROGRESS.md は移行経緯の履歴として意図的に MySQL の記述を含むため除外しています
rg -i "mysql" specs/ README.md TESTING_DESIGN.md
```

ヒットした行が残っている場合は、本チェックリストの各項目に従って更新してください。

> **PROGRESS.md の手動確認:**  PROGRESS.md には L36-L47 付近に MySQL 移行前の履歴記述が残っています。
> これらは意図的なものですが、移行後の新規記述に MySQL が混入していないか確認したい場合は
> `rg -i "mysql" PROGRESS.md` で個別に確認してください。
