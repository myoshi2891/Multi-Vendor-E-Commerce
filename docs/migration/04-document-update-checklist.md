# 既存ドキュメント更新チェックリスト

## ドキュメントガイド

- 本書は MySQL → PostgreSQL 移行に伴い更新が必要な既存ドキュメントの一覧
- 移行実装フェーズでコード変更と合わせて更新すること

---

## 1. Specs ドキュメント

### `specs/multi-vendor-ecommerce/00-overview.md`

- [ ] L14: `MySQL + Prisma persistence.` → `PostgreSQL + Prisma persistence.`
- [ ] L31: `Prisma ORM with a MySQL database.` → `Prisma ORM with a PostgreSQL database.`

### `specs/multi-vendor-ecommerce/02-architecture.md`

- [ ] L7: `Prisma ORM + MySQL` → `Prisma ORM + PostgreSQL`
- [ ] L25: `MySQL fulltext search used in product search with a fallback to contains.`
  → `PostgreSQL fulltext search (tsvector/tsquery) used in product search with a fallback to contains.`

### `specs/multi-vendor-ecommerce/04-interfaces.md`

- [ ] L55: `MySQL as primary datastore.` → `PostgreSQL as primary datastore.`

### `specs/multi-vendor-ecommerce/06-quality.md`

- [ ] L15: `MySQL fulltext search with a fallback to contains queries.`
  → `PostgreSQL fulltext search (GIN + tsvector) with a fallback to contains queries.`

### `specs/multi-vendor-ecommerce/07-testing.md`

- [ ] L12: `Integration: Prisma + MySQL with reset and seed per suite.`
  → `Integration: Prisma + PostgreSQL with reset and seed per suite.`

---

## 2. README.md（設計書）

### Mermaid 図内のデータベース表記

- [ ] L63: `DB[(MySQL データベース)]` → `DB[(PostgreSQL データベース)]`
- [ ] L266: `MYSQL[(MySQL)]` → `PGSQL[(PostgreSQL)]`
- [ ] L301: `PRISMA_CLIENT --> MYSQL` → `PRISMA_CLIENT --> PGSQL`
- [ ] L424: `DATABASE[(MySQL)]` → `DATABASE[(PostgreSQL)]`

---

## 3. TESTING_DESIGN.md

- [ ] L40: `DB: MySQL test database using Docker Compose`
  → `DB: PostgreSQL test database using Docker Compose`
- [ ] L111: `Use a dedicated MySQL schema for tests.`
  → `Use a dedicated PostgreSQL database for tests.`
- [ ] L123: `E2E_DATABASE_URL="mysql://user:pass@localhost:3306/app_test"`
  → `E2E_DATABASE_URL="postgresql://user:pass@localhost:5432/app_test"`

---

## 4. PROGRESS.md

- [ ] L36, L47: MySQL 固有の記述あり（`brew services start mysql` 等）。
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

- [ ] `.env` — `DATABASE_URL` を Accelerate 形式に変更、`DIRECT_URL` を追加（`02-environment-setup.md` 参照）
- [ ] `.env.example`（存在する場合）— 同様に更新
- [ ] `schema.prisma` — `directUrl = env("DIRECT_URL")` を追加

---

## 更新順序の推奨

1. **Prisma スキーマ** → マイグレーション生成
2. **ソースコード** → 生SQL・`contains` モード変更・`db.ts` Accelerate 対応
3. **テスト設計書** → `TESTING_DESIGN.md`
4. **Specs ドキュメント** → `specs/` 配下 5 ファイル
5. **README.md** → Mermaid 図の更新
6. **PROGRESS.md** → 移行完了の追記
7. **`neon_prisma_accelerate.md`** → `docs/migration/` に統合済み、ルートから削除済み ✅
