# Plan 033: tsvector 全文検索の raw SQL を実 PostgreSQL 統合テストで固定する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 1750ef2..HEAD -- src/app/api/search-products/route.ts src/queries/subCategory.ts tests/integration/`
> If any in-scope/referenced file changed since this plan was written, compare
> the "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **前提チェック（Step 0）**: 本プランは Docker（testcontainers）必須。
> `docker info` が失敗する環境では **STOP**（`plans/README.md` の status 列に
> `BLOCKED (Docker unavailable)` と記録して終了）。

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW（テスト新設のみ。`src/` 本体は 1 行も変更しない）
- **Depends on**: none（他プランと完全独立・並行可）
- **Category**: tests
- **Planned at**: commit `1750ef2`, 2026-07-11
- **出典 finding**: TESTS-17（`plans/audit/findings-13-integration-coverage.md`）

## Why this matters

ストアフロント検索バーの供給経路（`/api/search-products`）は PostgreSQL 固有の
tsvector 全文検索を `$queryRaw` で直接発行するが、unit テストは `@/lib/db` を全モックしており
**SQL 文字列そのものはユニット/統合いずれのテストでも一度も実行されていない**。
この SQL は Elasticsearch → tsvector 移行（`docs/migration/` に記録された技術選定）の中核であり、
構文エラー・`'simple'` トークナイザーの挙動・関連度順ソートの回帰をどのテストも検知できない。
Prisma メジャーアップグレード（DEPS-04 spike 候補）や schema 変更（テーブル名/カラム名の変更は
raw SQL に自動追従しない）で静かに壊れるリスクが高い経路を、実 DB で初めて固定する。

## Current state

- `src/app/api/search-products/route.ts` — 検証対象 1。**変更しない。**
  - 空クエリ早期 return（`:23-27`）: `q` 未指定・空白のみ → `NextResponse.json([])`
  - raw SQL（`:30-44`）:

```typescript
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
return NextResponse.json(rows);
```

  - 戻り型 `ProductSearchRow`（`:7-12`）: `{ id, name, description: string | null, relevance: number }`
  - エラー時（`:47-53`）: 500 + `{ error: "Internal Server Error" }`
- `src/app/api/search-products/route.test.ts` — unit テスト。`jest.mock("@/lib/db")`（`:5`）で
  全モック。**流用するのは GET 呼び出しパターンのみ**（`:19`）:
  `GET(new Request("http://localhost:3000/api/search-products?q=" + encodeURIComponent(query)))`
- `src/queries/subCategory.ts` — 検証対象 2（従属）。**変更しない。**
  `getSubcategories(limit, random)`（`:170-`）は `random === true` のとき raw SQL
  （`:188-190`）を発行する:

```typescript
const subcategories = await db.$queryRaw<SubCategory[]>`
SELECT * FROM "SubCategory" ORDER BY RANDOM() LIMIT ${limit || 10};
`;
```

- **重要なスキーマ事実**: `prisma/schema.prisma` の `Product.description` は
  **必須**（`String @db.Text`）。SQL の `COALESCE(p.description, '')` は防御的コードであり、
  Prisma 経由では NULL 行を作れない。→ 「description のみヒット」シナリオは
  「検索語が description にだけ含まれる行」で検証する（NULL 分岐の実行は不要・不可能）。
- **DB 配線**: `tests/integration/setup/container.ts`（globalSetup）が `DATABASE_URL` を
  testcontainers PostgreSQL に書き換えるため、route が import する `@/lib/db` シングルトンは
  実コンテナ DB に接続する。**`@/lib/db` をモックしないこと。**
- **テスト基盤**: `getTestDb` / `disconnectTestDb`（`tests/integration/setup/db.ts`）、
  `resetDb`（`setup/reset-db.ts` — Product / SubCategory は TRUNCATE 対象済み）、
  `seedUser` / `seedStore` / `seedCategoryWithSubcategory`（`setup/seed.ts`）。
  検索対象 Product は name / description を制御する必要があるため、
  `seedProductWithVariantAndSize`（name 固定 `Product ${suffix}`）ではなく
  **`db.product.create` を直接使う**（variant / size は検索 SQL に不要）。必須フィールド:
  `name` / `description` / `slug`（unique）/ `brand` / `storeId` / `categoryId` / `subCategoryId`。
- **構造の手本**: `tests/integration/cart-checkout.test.ts`（route/page を直接呼ぶ統合の前例・
  lifecycle 管理）とファイル冒頭 JSDoc の書式。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Docker 確認 | `docker info` | exit 0（失敗なら STOP） |
| 統合テスト全体 | `bun run test:integration` | 全 pass |
| 単一ファイル | `bun run test:integration -- tests/integration/search-products.test.ts` | all pass |
| 型チェック | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| unit 回帰 | `bun run test` | 全 pass（集計不変のはず） |

## Scope

**In scope**（変更してよいファイル）:
- `tests/integration/search-products.test.ts` — **新規作成**

**Out of scope**（触らない）:
- `src/app/api/search-products/route.ts` / `src/queries/subCategory.ts` — 検証対象本体。
  バグ発見時は STOP して報告
- `src/app/api/search-products/route.test.ts` / `src/queries/subCategory.test.ts`（unit テスト）
- `tests/integration/setup/`（seed ヘルパー追加も不要 — Product 直接 create で足りる）
- Product テーブルへの GIN インデックス追加等の性能改善（別プラン候補 — Maintenance notes 参照）

## Git workflow

- 現行ブランチ `dev` 上で作業してよい。コミット規律は `.claude/rules/02-tdd-step-commit.md`:
  テストファイル新設で 1 コミット（例: `test(integration): add tsvector full-text search scenarios`）、
  docs 同期は別コミット。push / PR はオペレーターの指示があるまで行わない。

## Steps

### Step 1: drift check とベースライン確認

冒頭の Drift check 実行 → `bun run test:integration` 全 pass 確認。

**Verify**: `bun run test:integration` → 全 pass

### Step 2: `tests/integration/search-products.test.ts` を新設

ファイル冒頭 JSDoc に検証境界（raw SQL の実行・トークナイザー挙動・関連度順・
パラメータ化の安全性）と ADR-004 参照を記載。モックは**不要**（route は db 以外の
外部依存なし。認証も不要な公開 API）。

**テスト間の DB リセット（必須・明示）**: 各シナリオは「結果が正確に N 件」「`db.product.count()` が
seed 数のまま」等、**DB が各テスト開始時にクリーンであること**に依存する。よって
`beforeEach` で `resetDb(db)`（`tests/integration/setup/reset-db.ts`。TRUNCATE 系）を呼び、
その後に基盤エンティティ（`seedUser` / `seedStore` / `seedCategoryWithSubcategory`）を
**毎テスト再 seed** する。商品はシナリオごとに Arrange 内で seed する。

```typescript
let db: PrismaClient;
let base: { storeId: string; categoryId: string; subCategoryId: string };

beforeAll(() => { db = getTestDb(); });
afterAll(async () => { await disconnectTestDb(); });

beforeEach(async () => {
    await resetDb(db);                       // ← 各テスト前にクリーン化（accumulation を防ぐ）
    const user = await seedUser(db);
    const store = await seedStore(db, { userId: user.id });
    const { category, subCategory } = await seedCategoryWithSubcategory(db);
    base = { storeId: store.id, categoryId: category.id, subCategoryId: subCategory.id };
});
```

> 根拠: リセットが無いと前テストの商品が残り、「1 件ヒット」「count === seed 数」「関連度で B が先頭」
> といった assert が実行順に依存して壊れる（フレークの温床）。`Product` / `SubCategory` /
> `Store` 等は `resetDb` の TRUNCATE 対象であることを確認してから使う。

共通 Arrange ヘルパー: 上記 `base`（`storeId` / `categoryId` / `subCategoryId`）を使い、

```typescript
async function seedSearchableProduct(input: {
    name: string;
    description: string;
    storeId: string;
    categoryId: string;
    subCategoryId: string;
}): Promise<Product> {
    return db.product.create({
        data: {
            ...input,
            slug: `search-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            brand: "TestBrand",
        },
    });
}
```

GET 呼び出しヘルパー（unit テストの `:19` と同じ形）:

```typescript
const search = async (q: string) => {
    const res = await GET(
        new Request(`http://localhost:3000/api/search-products?q=${encodeURIComponent(q)}`)
    );
    return { status: res.status, body: await res.json() };
};
```

シナリオ（Arrange は各テストで 3 商品程度を seed する。例:
A = name "Alpha Widget" / desc "a portable gadget"、
B = name "Beta Gadget" / desc "widget widget widget accessories"、
C = name "Gamma Case" / desc "unrelated leather case"）:

1. **name ヒット**: `search("alpha")` → 200・結果 1 件・`id === A.id`。
   `'simple'` トークナイザーは小文字化するため大文字小文字は無視される（"Alpha" が
   "alpha" でヒットすること自体がトークナイザー挙動の固定）
2. **description のみヒット**: `search("portable")` → A のみ（name に含まれない語）
3. **関連度順**: `search("widget")` → A と B の両方がヒットし、**B が先頭**
   （B は "widget" の出現頻度が高く ts_rank が大きい）。`relevance` フィールドが
   number で降順であることも assert
4. **ヒットなし**: `search("nonexistentterm12345")` → 200・空配列
5. **空クエリ早期 return**: `search("   ")` → 200・空配列（DB 到達前に return —
   商品を 1 件も seed しない状態でも成立）
6. **パラメータ化の安全性**: `search("'; DROP TABLE \"Product\"; --")` → 200
   （500 でない = SQL として解釈されない）+ 直後に `db.product.count()` が seed 数のまま
7. **複数語 plainto_tsquery（AND 意味論）**: `search("beta gadget")` → B のみ
   （plainto_tsquery は語を AND 連結する — A の "gadget" だけではヒットしない）
8. **`getSubcategories(limit, random=true)` の raw SQL**（従属シナリオ）:
   SubCategory を 3 件 seed（`seedCategoryWithSubcategory` を 3 回）→
   `getSubcategories(2, true)` が **throw せず** 2 件返し、返却行が seed した id 集合の
   部分集合であること（順序は RANDOM のため assert しない）

**Verify**: `bun run test:integration -- tests/integration/search-products.test.ts` → all pass

### Step 3: 全体回帰

**Verify**:
1. `bun run test:integration` → 既存 + 新規（8 テスト目安）全 pass
2. `bunx tsc --noEmit` → exit 0
3. `bun run lint` → exit 0
4. `bun run test` → unit 全 pass（集計不変）

## Test plan

Step 2 のシナリオ 1〜8 が本体。構造の手本は `tests/integration/cart-checkout.test.ts`。
完了後、テスト統計が変わるため **`spec-sync-after-test` skill を必ず起動**
（`.claude/rules/02-tdd-step-commit.md` の MUST）。

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run test:integration` exits 0; `search-products.test.ts` の新規テストが全 pass
- [ ] シナリオ 3（関連度順）と 6（パラメータ化）の assert が存在する
- [ ] `bunx tsc --noEmit` exits 0 / `bun run lint` exits 0 / `bun run test` exits 0（集計不変）
- [ ] `git status` で in-scope 外のファイルに変更がない
- [ ] docs 同期（QA_HANDOFF 統計 + ダッシュボード再生成）が別コミットで完了
- [ ] `plans/README.md` の 033 行が DONE に更新済み

## STOP conditions

Stop and report back (do not improvise) if:

- `docker info` が失敗する（→ `BLOCKED (Docker unavailable)`）
- Drift check で raw SQL 部分が本プランの抜粋と一致しない
- シナリオ 3 の関連度順、または 7 の AND 意味論が期待と異なる —
  **仕様理解のズレか本体バグ**。期待値を書き換えて緑にせず、実測の返却順・件数を添えて報告
- シナリオ 6 で 500 が返る、または Product テーブルに影響が出る（重大バグ — 即報告）
- 検証コマンドが 2 回の修正試行後も失敗する

## Maintenance notes

- この SQL は毎クエリ `to_tsvector` を計算する（式インデックスなし）。商品数が増えたら
  GIN 式インデックス（`CREATE INDEX ... USING gin(to_tsvector('simple', name || ' ' || description))`）
  の追加が性能課題になる — その migration を入れる際、本テストが「式とインデックスの定義ズレ」の
  回帰検知になる（式が 1 文字でも違うとインデックスが使われない）。
- `'simple'` トークナイザーは語幹処理なし（英語 "widgets" は "widget" にステミングされない）。
  多言語検索を強化する場合はこの前提が変わるため、シナリオ 1/7 の期待値を見直すこと
  （移行経緯: `docs/migration/` 参照）。
- LIMIT 50 の境界（51 件以上 seed）は実行コストに対して増分価値が薄いため意図的に省略した。
