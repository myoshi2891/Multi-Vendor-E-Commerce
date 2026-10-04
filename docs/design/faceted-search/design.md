# ファセット検索・ブラウズ基盤 — 設計（design.md）

> plan [015](../../../plans/015-spike-faceted-search-and-browse.md) の spike 成果物。
> 検索ベクトルの持ち方の選定根拠は [ADR-008](../../architecture/decisions/008-product-search-vector.md)。
> 属性の格納方式は [ADR-007](../../architecture/decisions/007-attribute-storage.md)、
> カテゴリのサブツリー表現は [ADR-006](../../architecture/decisions/006-category-tree-representation.md) に従う。
>
> - **調査時点**: commit `3277d8a5`（2026-10-03）
> - **実測環境**: ローカル Docker の PostgreSQL 16.14（`make up` → `docker compose exec db psql -U dev -d multivendor_dev`）。
>   行数は `Product` 80 / `ProductVariant` 100 / `Size` 202 / `Category` 50 /
>   `AttributeDefinition` 16（うち facetable 16）/ `ProductAttributeValue` 44 / `VariantAttributeValue` 4。
>   **EXPLAIN の結果はすべて「この行数でのプラン」**であり、本番規模の性能を示すものではない。
> - **DB への書き込みは行っていない**。試作した列やインデックスは `BEGIN … ROLLBACK` の中でだけ作成し、
>   ロールバック後に `information_schema.columns` で残っていないこと（0 件）を確認した。

---

## 0. 現状（実コードと実測で確認した事実）

plan 015 の「Current state」（commit `a17e2cc` 時点）から、次の点が変わっている、または誤っていた。

| # | 事実 | 根拠 |
|---|---|---|
| 0-1 | **tsvector の GIN インデックスは既にある**。plan 015 の「生成列も GIN も無い式評価」という記述は誤り | `prisma/migrations/20260222101357_init_postgresql/migration.sql:503` の `Product_fulltext_idx` |
| 0-2 | このインデックスの式は search route の式と完全に一致しており、**インデックスは使える** | 下記 §0-A の EXPLAIN |
| 0-3 | **ヘッダー検索のサジェストは常に空**。UI は `?search=` で問い合わせるが route は `?q=` しか読まない。さらに route は `id/name/description/relevance` を返すが、UI は `link && name && image` を必須として絞り込む | `src/components/store/layout/header/search/search.tsx:56-84` / `src/app/api/search-products/route.ts:23` / `src/lib/types.ts:379`。dev サーバーへの実測: `?search=product` → `[]`、`?q=product` → 行は返るが UI の絞り込みで全件落ちる |
| 0-4 | したがって**ユーザーが実際に使っている検索は `/browse?search=`（ILIKE）だけ**。Enter はここへ遷移する | `search.tsx:25-26` |
| 0-5 | `getProducts` は書き換えではなく拡張された。カテゴリ絞り込みは `categoryNode` のサブツリー（ADR-006 の `subtreeOf`）、配列入力は fail-closed で 0 件、存在しない slug は `noMatchResult` を返す | `src/queries/product.ts:950-1165` |
| 0-6 | `filters: any` はまだ残っている | `product.ts:951` |
| 0-7 | **価格ソートはページ内でしか効いていない**（既存バグ）。`findMany` が `views desc` で `skip/take` した**後**に、メモリ上で `products.sort` している | `product.ts:1167-1200` と `:1268-1280` |
| 0-8 | **並び順に tie-breaker が無い**（既存バグ）。`orderBy` は `views` / `createdAt` / `rating` の単一キーで、ローカル DB では `views = 0` が 80 件中 73 件、`rating = 0` が 77 件ある。既定の並びでは**ほぼ全件が同点のまま OFFSET でページングされている** | `product.ts:1167-1180`。実測は §0-B |
| 0-9 | 価格の絞り込みは**定価**（`Size.price`）、カードの表示とメモリ上のソートは**割引後の価格**（`price * (1 - discount/100)` の最小値）を使っている。意味が食い違っている | `product.ts:1115-1145` / `:1220-1240`、`src/components/store/cards/product/clean-card.tsx:26-28` |
| 0-10 | slug から ID への解決（store → category/subCategory → offer）はまだ逐次 `await` | `product.ts:986-1070` |
| 0-11 | Size の `price` / `discount` を書き込むのは `product.ts` の 3 経路だけ（商品作成 :365、バリアント作成 :461/:483、バリアント更新 :614 と :659-663 のサイズ置換）。`inventory.ts:108` / `order.ts:32` / `user.ts:1056` が変えるのは `quantity` だけ | `src/queries/` 配下の `size.create*` / `size.update*` / `productVariant.*` 呼び出しを grep で列挙 |
| 0-12 | ADR-007 の属性ファセット集計の雛形は、実データでそのまま動く | §3 の実行ログ |
| 0-13 | 生 SQL でサブツリーを `LIKE $1 \|\| '/%'` と書くと、slug 中の `_` / `%` がワイルドカードとして解釈される。Prisma の `startsWith` は自動でエスケープするが、生 SQL にその保護は無い | §3 の実測（`lux_women` が `lux-women` 配下 5 件を誤って拾う） |
| 0-14 | 既存の式 GIN は、その後 19 本のマイグレーションを経ても削除されていない。Prisma 5.22 の `migrate` は、schema.prisma に記述の無い式インデックスを消さない | `grep -rn fulltext_idx prisma/migrations/` が init の 1 件のみ |

### 0-A. 現行の検索クエリの実行計画

```sql
EXPLAIN ANALYZE SELECT p.id FROM "Product" p
WHERE to_tsvector('simple', p.name || ' ' || COALESCE(p.description, '')) @@ plainto_tsquery('simple', 'the');
-- 既定:                Seq Scan on "Product"（80 行。プランナの正しい選択）
-- enable_seqscan=off:  Bitmap Index Scan on "Product_fulltext_idx"
```

**結論**: インデックスは「使えない」のではなく、行数が少ないため使われていないだけ。
plan 015 が想定した「線形劣化」は**検索述語（`@@`）については当たらない**。
ただし `ts_rank` は、ヒットした行ごとに `to_tsvector` を**再計算**する（インデックスは
述語の評価にしか使われない）。ヒット数に比例するこのコストは残る。

### 0-B. 並び順の同点分布

```sql
SELECT views, count(*) FROM "Product" GROUP BY views ORDER BY count(*) DESC LIMIT 5;
-- 0 | 73   ← 既定ソート（most-popular）で 73 件が同点
SELECT rating, count(*) FROM "Product" GROUP BY rating ORDER BY count(*) DESC LIMIT 3;
-- 0 | 77
```

---

## 1. 統合後のアーキテクチャ（全体像）

```text
[ヘッダー入力] ──(2文字以上)──▶ GET /api/search-products?q=…   … サジェスト（上位 8 件、SearchResult 形）
        │                                │
        └──(Enter)──▶ /browse?search=…  │
                          │              ▼
                          ▼        searchProductIds()  ←── 両者で共有する 1 本の ID 検索
                   getProducts(filters: ProductFilters, sort, page)
                          │
          ① normalizeProductFilters(searchParams)  … URL → 型付きフィルタ（fail-closed）
          ② resolveFilterSlugs()  … store/category/offer の slug を Promise.all で並列解決
          ③ 母集合の確定と順位付け（生 SQL・1 クエリ）
               WHERE: 検索語 @@ searchVector AND サブツリー AND 店舗 AND オファー
                      AND 価格帯 AND サイズ/色 AND 属性ファセット（選択値）
               ORDER BY <ソートキー>, id ASC   ← フィルタ → ソート → ページングの順
               LIMIT/OFFSET（またはシーク）+ count(*) OVER () で totalCount
          ④ hydrate: db.product.findMany({ where: { id: { in: ids } }, include })
               → ③の順序に並べ直す（Map で O(n)）
          ⑤ ファセット件数（生 SQL）… ③と同じ WHERE から「その属性自身の選択」だけを外して集計
```

---

## 2. Open questions への決定

### Q1. 検索ベクトルの持ち方 → **非正規化キーワード列 + 重み付き生成列 + GIN**（ADR-008）

**問いの再定義**: GIN は既にある（0-1）。本当の問いは「**brand とバリアント keywords を
検索対象に入れる**とき、インデックスが効く状態をどう保つか」である。

- `brand` は `Product` の列なので、同じ行から合成できる
- バリアントの `keywords` は**別テーブル**（`ProductVariant.keywords`、カンマ区切り文字列）。
  生成列からは参照できない
- カテゴリ名は**入れない**（後述）

**決定**:

```sql
ALTER TABLE "Product" ADD COLUMN "searchKeywords" text NOT NULL DEFAULT '';
ALTER TABLE "Product" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', "name"), 'A') ||
    setweight(to_tsvector('simple', "brand"), 'B') ||
    setweight(to_tsvector('simple', "searchKeywords"), 'C') ||
    setweight(to_tsvector('simple', COALESCE("description", '')), 'D')
) STORED;
CREATE INDEX "Product_searchVector_idx" ON "Product" USING GIN ("searchVector");
DROP INDEX "Product_fulltext_idx";   -- 置き換え後（全参照の切り替えが済んでから）
```

- `searchKeywords` は、商品配下の全バリアントの keywords をスペースで連結した値。
  **アプリ層で書き込む**。書き込み経路はバリアントを作成・更新する `product.ts` の tx の中だけで（0-11）、
  同じ tx 内で `searchKeywords` を再計算すれば整合が保たれる
- schema.prisma 側は `searchKeywords String @default("")` と `searchVector Unsupported("tsvector")?` を宣言する。
  生成列を Prisma 5.22 の `migrate` がドリフト扱いするかどうかは**未検証**なので、
  実装プラン [074](../../../plans/074-product-search-vector-column.md) の Step 0 で `prisma migrate diff` を使って確認する。
  ドリフトと判定されたら、ADR-008 の代替案 B（IMMUTABLE 関数 + 式インデックス）へ切り替える

**実測（`BEGIN … ROLLBACK` 内での試作）**:

| 確認項目 | 結果 |
|---|---|
| brand「E2E Brand」での検索ヒット | 現行の式: **0 件** → 新しい列: **42 件** |
| keywords にしか出ない語での検索ヒット | 新しい列で **1 件** 増えた |
| 重み付けの効果（語 `product`） | name でヒット: 平均 rank **0.6231**（6 件）／description だけでヒット: **0.0608**（36 件） |
| GIN の使用（`enable_seqscan=off`） | `Bitmap Index Scan on "Product_searchVector_idx"` |
| name 更新への追随 | `UPDATE name = name \|\| ' zzqtoken'` の直後に `zzqtoken` で 1 件ヒット |

**カテゴリ名を入れない理由**: カテゴリ名を変えると、**サブツリー配下の全商品**の
`searchKeywords` を書き直すことになる（同期コストがカテゴリの規模に比例する）。
しかもカテゴリの絞り込み自体はファセット / ナビゲーションで提供される。
「カテゴリ名で検索したい」という要求が実際に出たら、サジェストに**カテゴリ候補**を並べる
（`Category.name` を別クエリで引く）方式で対応し、`searchVector` には入れない。

### Q2. 2 系統の統合 → **`getProducts` 側へ寄せ、ID 検索を 1 本に共有する**

0-3 / 0-4 のとおり、今ユーザーに届いているのは browse 側だけで、tsvector 側は**事実上の死にコード**である。
統合の向きはこれで決まる。

- 検索述語は `searchVector @@ plainto_tsquery('simple', $q)` の 1 種類にそろえる（ILIKE を廃止）
- `/api/search-products` は**サジェスト専用**にする。`?q=` を正とし、UI 側を `q` へ直す。
  レスポンスは `SearchResult`（`name / link / image`）の形で返す
- ランキングと絞り込みの合成は**生 SQL 1 本**で行う。Prisma の `where` との 2 段構えにはしない
  （**絞り込みを LIMIT より前**に置くには、すべての述語が同じ SQL の中にある必要がある）

**anti-pattern（禁止）**: 「① `$queryRaw` で ts_rank の上位 N 件を `LIMIT N` で確定 → ② Prisma でカテゴリや価格の絞り込み」。
②で件数が N を割り込み、rank が N+1 位以下の適合商品を取りこぼす。
**現行の価格ソート（0-7）はまさにこの形**（ページング → 後段で並べ替え）であり、実害が出ている。

**順位付けクエリの雛形**（`Prisma.sql` でパラメータ化する。条件の有無は `Prisma.sql` の断片を `Prisma.join` で組み立てる）:

```sql
WITH ranked AS (
    SELECT p.id,
           ts_rank(p."searchVector", plainto_tsquery('simple', $q)) AS rank
    FROM "Product" p
    JOIN "Category" c ON c.id = p."categoryNodeId"
    WHERE p."searchVector" @@ plainto_tsquery('simple', $q)
      AND (c.path = $path OR starts_with(c.path, $path || '/'))   -- LIKE は使わない（0-13）
      AND ($storeId::text IS NULL OR p."storeId" = $storeId)
      -- 価格帯 / サイズ / 色 / 属性ファセットの述語もすべてここ（LIMIT より前）
)
SELECT id, rank, count(*) OVER () AS total_count
FROM ranked
WHERE $cursorRank::real IS NULL
   OR rank < $cursorRank
   OR (rank = $cursorRank AND id > $cursorId)
ORDER BY rank DESC, id ASC
LIMIT $limit;
```

- **tie-breaker は `id ASC`**（主キーなので一意。`createdAt` は同時刻があり得るので不可）
- 混合方向（`rank DESC, id ASC`）では行値比較 `(rank, id) < (…)` を**使わない**。述語を展開して書く
- seek 述語は、`ranked` CTE の**外側**で書く。出力列の別名は同じクエリブロックの `WHERE` からは参照できない
- `count(*) OVER ()` を使うと totalCount も 1 往復で取れる。ただし seek 述語より**前**に数える必要がある
  （`ranked` 側で `count(*) OVER ()` を出し、外側では受け渡すだけにする）。
  実装では OFFSET ページングを維持する（下記）ので、`ranked` の内側で数えれば足りる

**ページング方式の決定**: `/browse` は**ページ番号の UI**（`?page=N` と正準 URL へのリダイレクト）を
既に持っているので、**OFFSET を維持**し、そのうえで tie-breaker で全順序にする。
キーセット（seek）は「ページ番号へ飛べない」制約が UI と衝突する。採用はサジェストや無限スクロールなど、
カーソルで足りる経路に限る。seek の雛形は、将来の無限スクロール用として上に残す。

**実行ログ（seek を実 PostgreSQL で検証）**: 現行の式（生成列の導入前）で、語 `product` について
`PREPARE` した雛形を 1 ページ目から最後まで、カーソルを引き継ぎながら実行した。

```text
同点の分布: rank 0.075990885 が 6 件 / rank 0.06079271 が 36 件（42 件中 36 件が同点）
ページサイズ 10 で走査: 5 ページ・42 行・重複のない id 42 件（期待値 42 件と一致）
2〜5 ページ目はすべて rank 0.06079271 の同点行 → id ASC の tie-breaker だけで区切られている
```

`PREPARE seek(text, real, text, int, text)` は、出力別名を外側の `WHERE` で参照する形のまま、
エラーなく実行できた（別名を内側の `WHERE` に書く誤りが無いことの確認）。

### Q3. ファセット件数の集計方式 → **リクエストごとの GROUP BY。キャッシュするのは定義だけ**

| 方式 | 判定 | 理由 |
|---|---|---|
| (a) リクエストごとの GROUP BY | **採用** | 件数は検索語と全フィルタの組み合わせに依存するので、事前計算しても当たらない。ADR-007 の型別カラムと `@@index([definitionId, optionId])` / `([definitionId, valueNumber])` がそのまま使える |
| (b) マテビュー + 定期 refresh | 不採用 | 母集合が検索語によって変わるので、「カテゴリ × 値」の件数を事前計算しても検索中は使えない。セラーの編集から反映までのタイムラグと、refresh のロックも生じる |
| (c) `unstable_cache` / Accelerate | **定義だけに適用** | キャッシュするのは件数ではなく、「このカテゴリに効く facetable 定義と option のラベル」（参照データ）。PERF-05 と同じ層に置く。キーはカテゴリの path、タグは `attribute-definitions` |

**選択中のファセットの扱い（disjunctive faceting）**: 属性 X の件数は、
「**X 自身の選択だけを外し**、他のすべての条件を課した母集合」で数える
（色で「赤」を選んでも、色ファセットの「青」の件数は 0 にならない）。
クエリ数は「選択中の属性数 + 1」が上限。

**集計の雛形**（ADR-007 の雛形を基本に、母集合を `base` CTE として外から差し込める形にしたもの）:

```sql
WITH base AS (
    SELECT p.id
    FROM "Product" p
    JOIN "Category" c ON c.id = p."categoryNodeId"
    WHERE (c.path = $path OR starts_with(c.path, $path || '/'))
      AND ($q::text IS NULL OR p."searchVector" @@ plainto_tsquery('simple', $q))
      -- X 以外の選択済みファセット・価格帯・店舗など
), attr_value AS (
    SELECT v."productId" AS product_id, v."definitionId", v."optionId", v."valueText", v."valueBool", v."valueNumber"
    FROM "ProductAttributeValue" v
    UNION ALL
    SELECT pv."productId", v."definitionId", v."optionId", v."valueText", v."valueBool", v."valueNumber"
    FROM "VariantAttributeValue" v JOIN "ProductVariant" pv ON pv.id = v."variantId"
)
SELECT d.key,
       COALESCE(o.label, v."valueText", v."valueBool"::text, v."valueNumber"::text) AS facet_value,
       count(DISTINCT b.id) AS product_count
FROM base b
JOIN attr_value v ON v.product_id = b.id
JOIN "AttributeDefinition" d ON d.id = v."definitionId" AND d.facetable AND d."archivedAt" IS NULL
LEFT JOIN "AttributeOption" o ON o.id = v."optionId"
GROUP BY d.key, facet_value
ORDER BY d.key, product_count DESC, facet_value;
```

**実行ログ**（検索語は生成列の導入前なので現行の式で代用。サブツリーは `LIKE` 版で実行し、
`starts_with` への置き換えは別途検証した — 下記）:

```text
EXECUTE facets('lux-women', NULL):
  material: Silk 4 / Wool 2 / Cashmere 1 / Polyester 1
  pattern:  Solid 8
  season:   All season 3 / Autumn / Winter 3 / Spring / Summer 2
EXECUTE facets('lux-women', 'coat'):
  material: Cashmere 1 / pattern: Solid 1 / season: Autumn / Winter 1   ← 検索語で母集合が絞られ、件数が追随する
境界: path 'lux-wo' は lux-women を拾わない（0 件）
LIKE 'lux_women' || '/%' → 5 件（誤ヒット） / starts_with(path, 'lux_women/') → 0 件 / starts_with(path, 'lux-women/') → 5 件
```

### Q4. 価格ソートと価格ファセット → **`Product.minPrice` を非正規化する**

**サブクエリ方式を採らない根拠（実測）**:

```text
EXPLAIN ANALYZE … LEFT JOIN LATERAL (SELECT min(s.price) … WHERE pv."productId" = p.id) … ORDER BY min_price, p.id LIMIT 10
→ Seq Scan on "Product"（80 行）→ 商品ごとに Aggregate（loops=80）→ Sort（top-N heapsort）→ Limit
```

LIMIT 10 であっても、**全商品の最小価格を計算し終えてからでないと並べ替えられない**。
商品数に比例するこのコストはインデックスでは消せない。非正規化した列に
btree インデックスを張れば、`ORDER BY "minPrice", id LIMIT n` はインデックス順に読める。

**決定**:

- `Product.minPrice Decimal(12,2)?`（`@@index([minPrice, id])`）。値は **割引後の価格の最小値**
  （`price * (1 - discount/100)` を **`Prisma.Decimal` で計算**し、小数 2 桁に丸める）。
  カード表示（0-9）と既存のメモリ上ソート（`minDiscountedPrice`）と同じ意味にそろえる。
  サイズが 1 件も無い商品は `NULL`（並び順では最後、`NULLS LAST`）
- **更新経路**: 0-11 の 3 経路の tx の末尾で、`searchKeywords` と一緒に
  `recomputeProductDerivedColumns(tx, productId)` を呼ぶ（1 関数に集約し、呼び忘れの面積を最小にする）
- **backfill**: マイグレーション SQL の中で
  `UPDATE "Product" SET "minPrice" = (SELECT round(min(s.price * (1 - s.discount::numeric / 100)), 2) …)`
  を実行する。`discount` は Float（double precision）なので、**掛ける前に `::numeric` へ寄せる**こと。
  `s.price * (1 - s.discount / 100)` と書くと、`numeric * double` は double に落ちて丸め誤差が乗る
- **価格の絞り込みの意味（0-9）はこのプランでは変えない**。定価で絞るか割引後で絞るかは
  プロダクトとしての判断なので、[`08-open-questions.md`](../../../specs/multi-vendor-ecommerce/08-open-questions.md)
  に起票する（実装プラン 076 の Step に含める）。決まるまでは既存の
  `variants.some.sizes.some.price` の述語を生 SQL に移すだけにする

### Q5. `filters: any` の型付け → **`ProductFilters`（`src/lib/types.ts`）+ `normalizeProductFilters`（`src/lib/utils.ts`）**

```ts
// src/lib/types.ts
export type ProductFilters = {
    search?: string;           // trim 済み・空文字は undefined
    store?: string;
    category?: string;
    subCategory?: string;      // 恒久的に受理する（category-tree design.md §2-Q4）
    offer?: string;
    size?: string[];
    color?: string[];
    minPrice?: number;         // 0 は有効な境界（`hasPriceBound` と同じ判定）
    maxPrice?: number;
    attributes?: Record<string, string[]>;   // definition key → 選択された option.value
};
```

- 正規化関数は、既存の `normalizePriceParam`（`src/app/(store)/browse/page.tsx:79-97`）と
  `toArrayParam` の規約（配列は先頭要素を採る / 空白のみは未指定 / 負値は fallback）を**そのまま `src/lib/utils.ts` へ移設**して共有する。
  ページ番号は既存の `normalizePageParam`、件数は `normalizePositiveIntParam` を使う
- **単一値のパラメータに配列が来たら**、現行の fail-closed（0 件）を維持する。
  正規化の段階で `{ kind: "invalid" }` を返し、`getProducts` が `noMatchResult` を返す（Result 型）
- 属性ファセットの URL 形式は `?attr.<key>=<value>`（複数指定可）。`key` と `value` は
  定義と option で照合し、存在しないものは**黙って捨てずに 0 件**とする（0-5 と同じ方針）

### Q6. slug → ID 解決の並列化 → **`Promise.all` で並列化。カテゴリの path 解決はキャッシュに載せる**

- store / category / subCategory / offer の解決は互いに独立しているので、`Promise.all` にする。
  どれか 1 つでも見つからなければ `noMatchResult`（現行の挙動を維持）
- カテゴリ（slug → `path`）とオファータグ（slug → id）は参照データなので、Q3 の定義キャッシュと同じ
  `unstable_cache` 層に載せる（PERF-05）。店舗は可変なのでキャッシュしない
- 生 SQL に渡すのは**解決済みの `path` / id だけ**にする（slug を SQL に直接渡さない）

---

## 3. 運用手順: 検索対象の列を追加するとき

1. 追加する値が `Product` の列なら → 生成列の式に `setweight(to_tsvector('simple', COALESCE("<col>", '')), '<weight>')` を足す。
   生成列の式は `ALTER … SET EXPRESSION` を使えない（PG16）ので、**列の DROP → ADD** になり、インデックスも作り直す。
   マイグレーションは補正用に新規作成する（既存のマイグレーションは編集しない）
2. 別テーブルの値なら → `recomputeProductDerivedColumns` で `searchKeywords` に連結する。
   その値を書き込む**すべての経路**の tx でこの関数を呼ぶ（経路は `grep` で列挙し、プランに書く）。
   既存データは backfill の UPDATE で埋める
3. `bunx prisma migrate dev` → `bun run erd:generate`（`.claude/rules/03-data-model-diagram-sync.md`）
4. 検索語を固定した結合テストで、追加した列の語でヒットすることを確認する

---

## 4. 後続の実装プラン

| Plan | 内容 | 依存 |
|---|---|---|
| [073](../../../plans/073-fix-search-suggest-and-browse-tiebreaker.md) | 既存バグの修正: ヘッダーサジェストの復旧（0-3）と並び順の tie-breaker（0-8） | — |
| [074](../../../plans/074-product-search-vector-column.md) | `searchKeywords` + `searchVector` 生成列 + GIN（Q1）。サジェストを新しい列へ移す | 073 |
| [075](../../../plans/075-unify-browse-search-and-type-filters.md) | `ProductFilters` の型付け（Q5）、slug 解決の並列化（Q6）、browse 検索の tsvector 化と順位付けクエリ（Q2） | 074 |
| [076](../../../plans/076-facet-counts-and-min-price.md) | ファセット件数（Q3）、`minPrice` の非正規化と価格ソートの全体適用（Q4、0-7 を解消） | 075 |

---

## 5. 実装後の更新（plans 073〜076・2026-10-03）

実装の結果、本文の決定から次の点が変わった・確定した。詳細は各プランの「実施結果」節。

| 項目 | 本文の決定 | 実装 | 理由 |
|---|---|---|---|
| Q1 schema 宣言 | `searchVector Unsupported("tsvector")?` | `@default(dbgenerated("<生成式>"))` + `@@index([searchVector], type: Gin)` も宣言 | 宣言しないと `prisma migrate diff` が GIN と生成式の削除を差分として出す（ADR-008 D-5） |
| Q1 `searchKeywords` の中身 | バリアントの keywords | **variantName / variantDescription / keywords** | 旧 ILIKE はバリアント名・説明も検索しており、外すと退行する（補正マイグレーション `…120200`） |
| Q2 検索語の解釈 | `plainto_tsquery` | **全語 AND + 最後の語だけ前方一致**（`buildPrefixTsQuery`・`to_tsquery`） | 旧 ILIKE の部分一致からの退行と、サジェストが入力途中の語で出ない問題を防ぐ |
| Q2 件数 | `count(*) OVER ()` | 同じ WHERE の別 COUNT クエリ（`Promise.all`） | OFFSET が最終ページを越えても正しい総数を返すため |
| Q3 定義のキャッシュ | `unstable_cache` | 実装しない | 表示名は集計と同じクエリで引くので、定義のための別往復が無い |
| Q3 ファセットを返す条件 | — | カテゴリ指定時のみ。選択中なのに母集合に無い key も件数 0 で返す | カテゴリを切り替えて残った `attr.*` を解除できなくなるのを防ぐ |
| Q4 導出列の同期 | `upsertProduct` の 3 経路 | 導出 SQL を `src/lib/product-derived-columns.ts` に一元化し、**E2E / luxury seed も末尾で全商品に流す** | seed は行を直接作るため、通さないと keywords 検索・価格ソートが seed データで成立しない |

**既存バグの解消**: サジェストが常に空（0-3）・並び順の tie-breaker 欠落（0-8）・価格ソートがページ内のみ（0-7）は解消した。
価格の絞り込みの意味（0-9）は [`08-open-questions.md`](../../../specs/multi-vendor-ecommerce/08-open-questions.md) に起票済み。
