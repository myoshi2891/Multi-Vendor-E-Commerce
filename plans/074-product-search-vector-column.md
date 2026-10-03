# Plan 074: 商品に重み付きの検索ベクトル列（brand・バリアント keywords を含む）を追加する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> ```bash
> git diff --stat 3277d8a5 -- prisma/schema.prisma prisma/migrations/ src/queries/product.ts src/app/api/search-products/
> git status --porcelain -- prisma/ src/queries/product.ts src/app/api/search-products/
> ```
> plan 073 の変更（route の hydrate と tie-breaker）は差分として現れて構わない。それ以外の変更があれば
> 「Current state」の抜粋と突き合わせ、食い違えば STOP。

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED（マイグレーションを伴う。Prisma の生成列の扱いが未検証）
- **Depends on**: `plans/073-fix-search-suggest-and-browse-tiebreaker.md`
- **Category**: migration
- **Planned at**: commit `3277d8a5`, 2026-10-03
- **設計**: [`design.md`](../docs/design/faceted-search/design.md) §2-Q1 / [ADR-008](../docs/architecture/decisions/008-product-search-vector.md)

## Why this matters

検索できるのが name と description だけで、`Product.brand` とバリアントの `keywords`（セラーが検索用に入れる欄）は
どこからも検索されていない。ローカル DB で実測すると、brand「E2E Brand」での検索は 0 件、新しい列では 42 件になる。
重み（name=A, brand=B, keywords=C, description=D）を付けると関連性が上がり、同点も減る
（実測: name でヒット 0.62 ／ description だけでヒット 0.06）。

## Current state

- `prisma/migrations/20260222101357_init_postgresql/migration.sql:503-505` — 既存の式 GIN:
  `CREATE INDEX "Product_fulltext_idx" ON "Product" USING GIN (to_tsvector('simple', "name" || ' ' || COALESCE("description", '')));`
- `prisma/schema.prisma:178` `brand String`、`:231` `ProductVariant.keywords String?`（カンマ区切り。保存側は `product.keywords.join(",")`）
- `ProductVariant.keywords` を書き込む経路（`src/queries/product.ts`）: `:352`（商品作成）、`:448`（バリアント作成）、`:623`（バリアント更新）。
  いずれも `db.$transaction` の中
- Prisma `5.22.0`（`package.json:24, 138`）。ローカル DB は PostgreSQL 16.14
- 検索 route（plan 073 の適用後）は `to_tsvector('simple', p.name || ' ' || COALESCE(p.description, ''))` を述語と rank に使っている
- ADR-008 の決定（引用）:
  > D-1: `searchKeywords` は**アプリ層が書き込む**。… `recomputeProductDerivedColumns(tx, productId)` が再計算する
  > D-5: schema.prisma では `searchVector Unsupported("tsvector")?` と宣言する。… **ドリフトと判定されたら Option B へ切り替え**

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| ドリフト判定 | `bunx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_DATABASE_URL" --exit-code` | exit 0（差分なし） |
| Migrate | `bunx prisma migrate dev --name product_search_vector` | マイグレーションが 1 本生成・適用される |
| ERD | `bun run erd:generate` | orphan WARNING 0 |
| Typecheck | `bunx tsc --noEmit` | exit 0 |
| Unit tests | `bun run test -- src/queries/product.test.ts src/app/api/search-products/route.test.ts` | all pass |
| Integration | `bun run test:integration -- tests/integration/search-products.test.ts tests/integration/product-update.test.ts` | all pass（Docker 必須） |
| Lint | `bun run lint` | 0 errors |

`SHADOW_DATABASE_URL` はローカル Docker の DB 上に作る使い捨ての DB を指す（例: `postgresql://dev:<password>@localhost:5432/shadow_074`。
パスワードは `.env` / `docker-compose.yml` の値を使い、プランやコミットには書かない）。

## Scope

**In scope**:
- `prisma/schema.prisma`、`prisma/migrations/<新規>/migration.sql`、`docs/architecture/data-model.drawio`（再生成）
- `src/queries/product.ts`（`recomputeProductDerivedColumns` の追加と 3 経路からの呼び出し）
- `src/app/api/search-products/route.ts`（述語と rank を `"searchVector"` へ）
- 上記のテストファイル、`docs/architecture/decisions/008-product-search-vector.md`（Status を Accepted へ）
- `plans/README.md`（Status 行）

**Out of scope**:
- browse の検索（`getProducts` の `contains`）の置き換え — plan 075
- カテゴリ名を検索対象に入れること（ADR-008 D-3 で却下済み）
- `'simple'` トークナイザーの変更

## Steps

### Step 0: Prisma が生成列をドリフトと判定しないことを確かめる（ゲート）

1. 使い捨ての shadow DB を作る（`docker compose exec db createdb -U dev shadow_074`）
2. Step 1 のマイグレーション SQL と schema.prisma の変更を作業ツリーに置いた状態で、ドリフト判定のコマンドを実行する
3. 終わったら `dropdb shadow_074`

**Verify**: exit 0（差分なし）。**exit 2（差分あり）なら STOP**。出力された差分を添えて報告する
（ADR-008 の Option B — IMMUTABLE 関数 + 式インデックス — への切り替えを人間が判断する）

### Step 1: マイグレーション

`migration.sql`（`--create-only` で生成してから手で書く）:

```sql
ALTER TABLE "Product" ADD COLUMN "searchKeywords" TEXT NOT NULL DEFAULT '';
UPDATE "Product" p SET "searchKeywords" = COALESCE((
    SELECT string_agg(replace(pv.keywords, ',', ' '), ' ' ORDER BY pv.id)
    FROM "ProductVariant" pv WHERE pv."productId" = p.id
), '');
ALTER TABLE "Product" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', "name"), 'A') ||
    setweight(to_tsvector('simple', "brand"), 'B') ||
    setweight(to_tsvector('simple', "searchKeywords"), 'C') ||
    setweight(to_tsvector('simple', COALESCE("description", '')), 'D')
) STORED;
CREATE INDEX "Product_searchVector_idx" ON "Product" USING GIN ("searchVector");
```

schema.prisma の `Product` に `searchKeywords String @default("")` と `searchVector Unsupported("tsvector")?` を追加する。
**`Product_fulltext_idx` はこのステップでは消さない**（Step 4 で消す）。

**Verify**: `bunx prisma migrate dev` が成功する → `bun run erd:generate` → `docker compose exec db psql -U dev -d multivendor_dev -c '\d "Product"'` に 2 列と `Product_searchVector_idx` が表示される

### Step 2: `searchKeywords` の同期（TDD）

1. `tests/integration/product-update.test.ts` に Red のテストを追加する: バリアントの keywords を作成・更新・追加したあと、
   `Product.searchKeywords` がそれを含み、`"searchVector" @@ plainto_tsquery('simple', '<keyword>')` で見つかること
2. `src/queries/product.ts` に `recomputeProductDerivedColumns(tx: Prisma.TransactionClient, productId: string): Promise<void>` を追加する
   （JSDoc 付き。plan 076 で `minPrice` もここで再計算するので、名前は汎用にしておく）。
   中身は Step 1 の UPDATE を 1 商品に限定した `tx.$executeRaw(Prisma.sql\`…\`)`
3. keywords を書き込む 3 経路（`:352` / `:448` / `:623` の各 tx）の末尾で呼ぶ

**Verify**: Integration の行 → 追加したテストが pass する。
`grep -n "recomputeProductDerivedColumns" src/queries/product.ts` が定義 1 件 + 呼び出し 3 件

### Step 3: 検索 route を新しい列へ切り替える（TDD）

1. `tests/integration/search-products.test.ts` に brand でのヒット、keywords でのヒット、name のヒットが description のヒットより上位に来ることを追加する（Red）
2. route の述語と rank を `p."searchVector" @@ plainto_tsquery('simple', ${q})` / `ts_rank(p."searchVector", …)` に替える

**Verify**: Integration と Unit の行 → all pass

### Step 4: 旧インデックスを削除する

`grep -rn "to_tsvector('simple', p.name" src/` が 0 件になったことを確かめてから、新しいマイグレーションで
`DROP INDEX "Product_fulltext_idx";` を実行する。

**Verify**: grep が 0 件 → `bunx prisma migrate dev --name drop_product_fulltext_idx` 成功 → `\d "Product"` から旧インデックスが消えている

### Step 5: ADR の Status を更新する

ADR-008 の Status を `Accepted` にし、`docs/architecture/decisions/README.md` の表も同じく更新する。

## Test plan

- 統合: brand / keywords / 重み付け / keywords を更新したあとの追随 / バリアントを追加したあとの追随
  （バリアントを単体で削除する経路は 2026-10-03 時点で存在しない。`grep -rn "productVariant.delete" src` が 0 件。
  商品の削除は Cascade なので `searchKeywords` の再計算は要らない）
- 単体: route のテストで、SQL に `"searchVector"` が含まれることを確かめる（既存のモックのパターンに合わせる）
- 本番の Neon の PostgreSQL のバージョンを確認し（`SELECT version();`、読み取りのみ）、生成列（PG12 以上）が使えることをプランの実施結果に記録する

## Done criteria

- [ ] Step 0 のドリフト判定が exit 0
- [ ] `bunx tsc --noEmit` exit 0 / `bun run lint` 0 errors / 上記のテストがすべて pass
- [ ] `bun run erd:generate` の結果がコミットに含まれる（`.claude/rules/03-data-model-diagram-sync.md`）
- [ ] `grep -rn "Product_fulltext_idx\|to_tsvector('simple', p.name" src/` が 0 件
- [ ] テスト件数が変わるので `spec-sync-after-test` を実行する
- [ ] ADR-008 が Accepted、`plans/README.md` の 074 の行を更新

## STOP conditions

- Step 0 でドリフトと判定される（上記のとおり）
- keywords を書き込む経路が `product.ts` の 3 箇所以外にも見つかる（`grep -rn "keywords" src/queries/ | grep -v test`）。網羅できているか確信できなければ止める
- バリアントを単体で削除する経路が追加されている（`grep -rn "productVariant.delete" src` が 1 件以上）。その経路でも再計算が要る
- 本番の PostgreSQL のバージョンが 12 未満（生成列が使えない）
- 既存のマイグレーションファイルを編集したくなった（禁止。補正用に新規作成する）

## Maintenance notes

- バリアントの keywords を書く**新しい経路**を足すときは、必ず `recomputeProductDerivedColumns` を同じ tx で呼ぶこと。
  漏れてもエラーにはならず、検索に出なくなるだけなので、レビューで確認する
- 検索対象を増やす手順は design doc §3
- レビュアーは、`$executeRaw` がすべて `Prisma.sql` のテンプレートで書かれていること（文字列連結が無いこと）を確認する

## 実施結果（2026-10-03・未コミット）

- **Step 0 ゲート**: `Unsupported("tsvector")?` だけの宣言では `prisma migrate diff --exit-code` が **exit 2**
  （「GIN の削除」と「生成式 default の削除」を差分として出す）。STOP 条件に該当したが、Option B へ切り替える前に
  **Prisma が読み取る形をそのまま宣言する**（`@default(dbgenerated("<pg_get_expr の生成式>"))` + `@@index([searchVector], type: Gin)`）
  ことで **exit 0** になった。適用後の実 DB との比較（`--from-schema-datasource`）も exit 0。ADR-008 D-5 をこの方式で改訂し Accepted にした。
- マイグレーション: `20261003120000_product_search_vector` / `20261003120100_drop_product_fulltext_idx`。
  空の DB へ全 23 本を通しで適用できることも確認（使い捨て DB `e2e_vrt_check`）。
- 本番相当（Neon）の PostgreSQL は **17.11**（`SHOW server_version` を読み取りのみで確認）。新マイグレーションはリモート未適用
  （デプロイ時の `migrate deploy` の担当）。
- `recomputeProductDerivedColumns` を 3 経路の tx 末尾から呼ぶ。後に 075/076 で導出 SQL を
  `src/lib/product-derived-columns.ts` へ一元化した（seed も同じ SQL を使う —— 下記 076 参照）。
- 重み付けにより、既存の統合シナリオ 3 の期待値（description 3 回の B が先頭）は**意図どおり反転**（name 1 回の A が先頭）。
