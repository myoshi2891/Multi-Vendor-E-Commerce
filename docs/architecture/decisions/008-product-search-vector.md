# 008. 商品検索ベクトルの持ち方 — 非正規化キーワード列 + 重み付き生成列

- **Status**: Accepted（2026-10-03・[plan 074](../../../plans/074-product-search-vector-column.md) の Step 0 ゲートを通過）
- **Date**: 2026-10-03
- **Deciders**: project team（plan [015](../../../plans/015-spike-faceted-search-and-browse.md) の spike として起票）

---

## Context

商品の全文検索は、`'simple'` トークナイザーの tsvector（[`docs/migration/`](../../migration/) の決定）を、
次の式インデックスで支えている。

```sql
-- prisma/migrations/20260222101357_init_postgresql/migration.sql:503
CREATE INDEX "Product_fulltext_idx" ON "Product" USING GIN (
    to_tsvector('simple', "name" || ' ' || COALESCE("description", ''))
);
```

このインデックスは機能している（`enable_seqscan=off` で `Bitmap Index Scan` が選ばれることを実測した）。
問題は**検索対象が name と description に限られる**ことである。

- `Product.brand` で検索できない（ローカル DB の実測: brand「E2E Brand」で **0 件**）
- バリアントの `keywords`（セラーが検索用に入力する欄）が**どこからも検索されていない**
- 式インデックスの式は、クエリ側に**一字一句同じ形**で書かれていなければ使われない。
  式に 1 列足すと、検索 route と browse の全クエリを同時に書き換える必要がある
- `ts_rank` は、ヒットした行ごとに `to_tsvector` を再計算する
- name でのヒットと description でのヒットが同じ重みで扱われるため、同点が大量に出る
  （語 `product` で 42 件中 36 件が同点）

`keywords` は `ProductVariant` にあり、`Product` から見ると**別テーブル**である。
PostgreSQL の生成列（`GENERATED ALWAYS AS … STORED`）は**同じ行の列しか参照できない**ので、
別テーブルの値を含めるには何らかの非正規化が必要になる。

## Decision

**(α) 非正規化キーワード列 + 重み付き生成列 + GIN** を採用する。

```sql
ALTER TABLE "Product" ADD COLUMN "searchKeywords" text NOT NULL DEFAULT '';
ALTER TABLE "Product" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', "name"), 'A') ||
    setweight(to_tsvector('simple', "brand"), 'B') ||
    setweight(to_tsvector('simple', "searchKeywords"), 'C') ||
    setweight(to_tsvector('simple', COALESCE("description", '')), 'D')
) STORED;
CREATE INDEX "Product_searchVector_idx" ON "Product" USING GIN ("searchVector");
```

- **D-1**: `searchKeywords` は**アプリ層が書き込む**。商品配下の全バリアントの `keywords` を連結した値で、
  バリアントを作成・更新する `src/queries/product.ts` の tx の中で、
  `recomputeProductDerivedColumns(tx, productId)` が再計算する
- **D-2**: 検索述語は `"searchVector" @@ plainto_tsquery('simple', $q)` の**1 種類だけ**にする。
  式を複数箇所に書く運用をやめる
- **D-3**: カテゴリ名は `searchVector` に**含めない**。カテゴリ名を変えるとサブツリー配下の全商品を書き直すことになり、
  同期のコストがカテゴリの規模に比例するため。カテゴリ候補はサジェストに別クエリで出す
- **D-4**: 移行が終わったら `Product_fulltext_idx` を DROP する（同時に 2 本の GIN を保守しない）
- **D-5**: schema.prisma では、Prisma が実 DB から読み取る形を**そのまま宣言**する。

  ```prisma
  searchVector Unsupported("tsvector")? @default(dbgenerated("<pg_get_expr が返す生成式>"))
  @@index([searchVector], type: Gin)
  ```

  Prisma 5.22 は生成列の式を「default」として、`searchVector` 上の GIN を通常のインデックスとして読み取る。
  `Unsupported("tsvector")?` だけを宣言した初回のゲートでは `prisma migrate diff --exit-code` が **exit 2** になり、
  「GIN の削除」と「default の削除」を差分として出した（次に誰かが `migrate dev` を実行すると、
  インデックスと生成式を消すマイグレーションが作られる状態）。上の 2 行を足すと **exit 0（差分なし）** になり、
  適用後の実 DB との比較（`--from-schema-datasource`）も exit 0 だった。
  **生成式を変えるときは、マイグレーション SQL と `dbgenerated(...)` の文字列を同時に更新すること**
  （後者は PostgreSQL が正規化した形 —— `'simple'::regconfig` や `'A'::"char"` のキャスト付き —— で書く。
  適用後に `prisma migrate diff --from-schema-datasource … --exit-code` で一致を確かめる）。
  なお、このスキーマから `migrate diff --from-empty` などで SQL を**新規生成**すると、生成列ではなく
  `DEFAULT (式)` として出力される。マイグレーション履歴が正なので通常の運用では問題にならないが、
  スキーマから DDL を起こす使い方はしないこと

## Alternatives Considered

### Option 0: 既存の式インデックスの式を拡張する

`to_tsvector('simple', name || ' ' || brand || ' ' || COALESCE(description, ''))` へ作り直す。

- メリット: 列を増やさない。Prisma のスキーマに影響が無い
- デメリット: `keywords` は**含められない**（式インデックスも同じ行しか参照できない）。
  クエリ側に同じ式を書き続ける必要があり、書き換え漏れがあると**黙って Seq Scan に落ちる**（エラーにならない）。
  `ts_rank` の再計算も残る

### Option A（採用）: 非正規化キーワード列 + 生成列

- メリット: keywords を含められる。検索述語は列名 1 つで済み、式のずれが起きない。
  rank は保存済みのベクトルから計算される。`setweight` で関連性を表現できる
- デメリット: `searchKeywords` の同期をアプリ層が担う（書き込み経路は `product.ts` の tx に限られ、
  現時点では 3 経路）。行のサイズが増える。schema.prisma に生成式を `dbgenerated` で二重に持つ必要がある（D-5）

### Option B: IMMUTABLE 関数 + 式インデックス

`CREATE FUNCTION product_search_vector(name text, brand text, kw text, description text) RETURNS tsvector IMMUTABLE …`
を定義し、`USING GIN (product_search_vector(...))` とする。keywords は Option A と同じく `searchKeywords` 列に落とす。

- メリット: 生成列を使わないので、Prisma の生成列サポートに依存しない（この repo では
  schema.prisma に無い式インデックスが 19 本のマイグレーションを経ても残っている実績がある）
- デメリット: 関数本体を変えたら、**REINDEX しない限りインデックスと結果が黙って食い違う**
  （IMMUTABLE の宣言は、「この関数の結果は変わらない」という DB への約束であるため）。
  `ts_rank` の再計算も残る

### Option C: トリガーで保守する tsvector 列

`BEFORE INSERT/UPDATE` トリガーで、関連テーブルを引いてベクトルを組み立てる。

- メリット: カテゴリ名まで含められる。アプリ層の同期が要らない
- デメリット: `ProductVariant` や `Category` の変更で `Product` を書き直すトリガーが**連鎖**する。
  特にカテゴリ名の変更はサブツリー全体の UPDATE になる。Prisma の管理外のロジックが DB に隠れ、
  テストとレビューの目が届きにくい。この repo の「アトミック操作は `db.$transaction` で明示する」方針
  （`.claude/steering/tech.md`）とも噛み合わない

## Consequences

### Positive

- brand と keywords で検索できる（実測: brand で 0 件 → 42 件、keywords にしか出ない語で +1 件）
- 重み付けで関連性が上がり、同点が減る（実測: name でヒット 0.62 ／ description だけでヒット 0.06）
- 検索・browse・ファセットの母集合が、同じ 1 列の述語を共有する

### Negative

- バリアントの keywords を書く新しい経路を足すときは、`recomputeProductDerivedColumns` の呼び出しが必須になる。
  漏れても検索に出ないだけで、エラーにはならない（plan 074 で、全経路を網羅する結合テストを追加する）
- 生成列の式の変更（`ALTER … SET EXPRESSION`）は PostgreSQL 17 からの機能で、ローカル Docker（16.14）では使えない。
  本番（Neon・17.11 —— 2026-10-03 に読み取りで確認）とローカルの両方で動かすため、検索対象を増やすときは
  列の作り直しとインデックスの再作成で行う（手順は design doc §3）
- schema.prisma に生成式の文字列（`dbgenerated`）を二重に持つ（D-5）。式を変えるときの更新漏れは
  `prisma migrate diff --exit-code` で検出する

## Related

- 設計: [`docs/design/faceted-search/design.md`](../../design/faceted-search/design.md) §2-Q1
- 関連 ADR: [ADR-006](006-category-tree-representation.md)（サブツリー）/ [ADR-007](007-attribute-storage.md)（属性の格納）
- 実装: [plan 074](../../../plans/074-product-search-vector-column.md)
