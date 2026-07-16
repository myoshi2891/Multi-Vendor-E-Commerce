# プラン 015（design/spike）: ファセット検索・ブラウズ基盤（2系統検索の統合 + tsvector 高速化）を設計する

> **Executor 向け指示**: これは **design/spike** プランであり、ビルドプランでは**ない**。
> 成果物は設計ドキュメントと後続実装プランであり、本プランで機能を出荷**しない**。
> 読み取り専用の調査を行い、未解決の問いにエビデンス付きで答え、設計ドキュメントを書き、STOP する。
> 完了したら `plans/README.md` のこのプランのステータス行を更新する。
>
> **ドリフトチェック（最初に実行）**:
> `git diff --stat a17e2cc..HEAD -- src/queries/product.ts src/app/api/search-products/route.ts prisma/schema.prisma`
> いずれかが変更されていれば「Current state」の抜粋と現行コードを突き合わせる。
> `getProducts` のフィルタ構造または search-products route が書き換わっていたら STOP して報告する。
>
> **前提プラン**: plan 014 の `docs/design/category-attributes/design.md` が存在すれば
> 「格納方式（ADR）」と「ファセット対象フラグ」の決定を必ず読み、本設計のファセット集計は
> その格納方式の上に設計する。014 未実施の場合、本 spike のうち「tsvector 高速化」と
> 「2系統統合」は独立に設計してよいが、属性ファセット部分は方式候補の併記に留め、
> その旨を design doc に明記する。

## Status

- **Priority**: P2（発見性 — Phase B の中核）
- **Effort**: M（spike + 設計ドキュメント。実装は後続プラン）
- **Risk**: LOW-MED（読み取り系のみだが、検索 UX とクエリ性能に直結）
- **Depends on**: plans/014-spike-category-attributes-facets.md（属性ファセット部分のみ。tsvector/統合部分は独立）
- **Category**: direction
- **Planned at**: commit `a17e2cc`, 2026-07-09
- **背景ドキュメント**: `plans/direction/EXPANSION_BLUEPRINT.md` §4-③ / `plans/audit/findings-09-direction-expansion.md` E-3

## Why this matters

検索が **2系統に分裂**している: ヘッダー検索は tsvector（`search-products` route）、
ブラウズページのフィルタは Prisma `contains`（ILIKE 相当）で、**ランキングも対象範囲も
挙動も食い違う**。しかも tsvector 側は `Product.name + description` のみが対象
（brand・バリアント keywords・カテゴリ名は検索不能）で、**生成列も GIN インデックスも
無い式評価**のため商品数の増加に対して線形に劣化する。ブラウズ側はファセット件数集計
（「この条件でカラー赤は12件」）が無く、価格ソートも無い。SKU が数万を超える総合カタログ
（EXPANSION_BLUEPRINT §1.1）では「探せない・絞れない」が最初に露呈するボトルネックであり、
検索体験は USER KPI（チェックアウト完了率・カート離脱率）の最上流にある。

## Current state（設計前に必ず読む）

### 系統1: tsvector 全文検索 — `src/app/api/search-products/route.ts:33-44`

```sql
SELECT p.id, p.name, p.description,
       ts_rank(to_tsvector('simple', p.name || ' ' || COALESCE(p.description, '')), ...) AS relevance
FROM "Product" p
WHERE to_tsvector('simple', p.name || ' ' || COALESCE(p.description, ''))
      @@ plainto_tsquery('simple', ${q})
ORDER BY relevance DESC LIMIT 50
```

- 対象は name + description のみ。`Product.brand`（`schema.prisma:135`）、
  `ProductVariant.keywords`（`schema.prisma:179`）、カテゴリ名、属性（plan 014）は対象外
- `to_tsvector` を**行ごとに実行時評価** — 生成列（`GENERATED ALWAYS AS ... STORED`）+
  GIN インデックスが無い
- `'simple'` トークナイザーは決定済みトレードオフ（言語別ステミングなし — `docs/migration/` 参照）。
  本 spike で変更しない

### 系統2: ブラウズフィルタ — `src/queries/product.ts:601-772`（`getProducts`）

```ts
export const getProducts = async (
    filters: any = {},        // ← product.ts:602 — any（規約違反の既存箇所）
    sortBy = "",
    page: number = 1,
    pageSize: number = 10
) => {
```

- 検索語は `contains`/`mode: "insensitive"`（`product.ts:687-721`）— tsvector と**別実装・別挙動**
- store/category/subCategory/offer フィルタは slug → ID の**逐次 await**（`:619-683`、
  ウォーターフォール — Round 1 deferred PERF-01 と同族の直列化）
- 価格は `variants.some.sizes.some.price gte/lte`（`:724-739`）、色は
  `variants.some.colors.some.name IN`（`:742-757`）、サイズは `:658-670`
- ソートは views / createdAt / rating の3種のみ（`:758-772`）— **価格順ソートが無い**
  （価格がバリアント配下 `Size.price` にあるため単純な orderBy が書けない構造的理由）
- ファセット件数集計は存在しない

### 関連する Round 1 の deferred 事項（`plans/audit/VETTED_FINDINGS.md` / `plans/README.md` 参照）

- **PERF-05**: カテゴリ・国・オファータグ等の参照データを `unstable_cache`/Accelerate で
  キャッシュ — 本設計のファセット集計キャッシュと同じ層の話であり、統合を検討する
- **PERF-01**: カート/チェックアウトの per-item N+1（batch 化）— 本プランのスコープ外だが
  「逐次 await を排す」方針は共通

### 遵守すべきリポジトリ規約

- `any` 禁止 — `filters: any` の型付けは後続実装プランに必ず含める
- 生 SQL は `Prisma.sql` + `$queryRaw`（パラメータ化 — search route の既存パターン）
- URL 数値パラメータの正規化規約（`Number.isFinite` — `.claude/steering/tech.md`）
- マイグレーション（生成列・インデックス追加）は `migrate dev` + ERD 再生成

## Commands you will need（読み取り専用調査）

| 目的 | コマンド | 期待 |
|---|---|---|
| 既存インデックスの確認（スキーマ） | `grep -n "@@index\|@@fulltext" prisma/schema.prisma` | 宣言済み index 一覧 |
| **既存 GIN の確認（マイグレーション）** | `grep -rniE "USING gin\|to_tsvector\|tsvector\|CREATE INDEX" prisma/migrations/` | 生 SQL で追加済みの GIN/tsvector が無いことを確認（**schema.prisma だけ見て「GIN なし」と断定しない** — tsvector GIN は Prisma スキーマに宣言できず、生 SQL マイグレーションでしか入らないため） |
| 検索 UI の呼び出し元 | `grep -rn "search-products" src/ -il` | ヘッダー検索コンポーネント |
| ブラウズページの filters 生成元 | `grep -rn "getProducts(" src/ -l` | 呼び出しサイト一覧 |
| EXPLAIN の実測（任意・ローカルDB） | `bunx prisma studio` 等でデータ量確認後、psql で `EXPLAIN ANALYZE` | 式評価のコスト実測 |

## Scope

**In scope**（本 spike が生成するもの）:
- 設計ドキュメント `docs/design/faceted-search/design.md`（新規） — Open questions 全てに決定 + 根拠
- 後続**実装**プラン `plans/0NN-implement-faceted-search.md`（次の空き番号、plan-template 準拠。
  規模次第で「①生成列+GIN ②統合+型付け ③ファセット集計」の分割プランを提案してよい）

**Out of scope**（本プランでやらないこと）:
- `src/`・スキーマの変更（設計のみ）
- Elasticsearch 等の外部検索エンジン導入の再検討（決定済みトレードオフ — tsvector の延長線で設計）
- `'simple'` トークナイザーの変更（言語対応は DIRECTION-04 i18n と同期すべき別論点）
- カート/チェックアウトの N+1（PERF-01）— 別プラン候補

## Open questions（spike が証拠付きで必ず答える）

1. **tsvector の恒久化**: `Product` に `searchVector tsvector` 列 + GIN インデックスを追加する
   マイグレーション設計。Prisma は tsvector 型を直接サポートしないため
   `Unsupported("tsvector")` 列 + 生 SQL マイグレーションの型安全な扱い方を確定する。

   > **重要な設計上の分離**: PostgreSQL の `GENERATED ALWAYS AS (...) STORED` 列は
   > **同一行の列しか参照できない**。したがって:
   > - `Product` 自身の列（`name` + `brand` + `description`）だけなら **生成列**で合成可能。
   > - **カテゴリ名 / SubCategory 名 / バリアント keywords など「別テーブルの値」は生成列に
   >   直接含められない**。これらを検索対象に含めるには、
   >   (α) それらの値を **`Product` 上の非正規化列に先に落とし込み**（トリガー or アプリ層で
   >       upsert 時に書き込む）、その非正規化列を生成列に含める、または
   >   (β) 生成列をやめ、**トリガー保守の `tsvector` 列**（`BEFORE INSERT/UPDATE` で
   >       関連テーブルを引いて `to_tsvector(...)` を組み立てる）にする、
   >   のどちらかを選ぶ。spike は (α)/(β) を「同期の複雑さ・関連行変更時の再計算コスト・
   >   整合性」で比較し ADR で確定する。
   > 「関連テーブルの値をそのまま生成列に組み込む」案は**成立しない**ので選択肢から外すこと。
2. **2系統の統合**: ブラウズの `filters.search`（ILIKE）を tsvector 経路に寄せるか、
   逆にヘッダー検索を `getProducts` に寄せるか。ランキング（ts_rank）とフィルタ（Prisma where）
   の合成方法（`$queryRaw` で ID + rank を取り Prisma で hydrate する2段構え等）を設計する。
3. **ファセット集計の実行方式**: (a) リクエスト毎 GROUP BY（属性値×件数）、(b) マテビュー +
   定期 refresh、(c) `unstable_cache`/Accelerate キャッシュ（PERF-05 と統合）。
   カテゴリページの想定クエリ数と鮮度要件で選定する。014 の格納方式（正規化 vs JSONB）
   ごとに集計 SQL の雛形を書き比較する（014 の ADR に同雛形があれば再利用）。
4. **価格ソート・価格ファセット**: 価格が `Size.price`（バリアント配下）にある構造で
   「代表価格」（最安値）をどう出すか — `Product` への非正規化列（minPrice）vs サブクエリ。
   非正規化する場合の更新タイミング（upsertProduct 時）と既存データの backfill。
5. **`filters: any` の型付け**: `ProductFilters` 型の定義場所（`src/lib/types.ts`）と、
   URL searchParams → filters の正規化関数（数値正規化規約準拠）の設計。
6. **slug → ID 解決の並列化**: `:619-683` の逐次 await を `Promise.all` 化 or 単一クエリ化
   する形。PERF-05 のキャッシュに載せる場合の整合。

## Steps

### Step 1: 呼び出しサイトと実測の調査

「Commands」で検索 UI・`getProducts` 呼び出しサイトを列挙し、フィルタとして実際に流入する
searchParams の形を確認する。ローカル DB があれば現行 tsvector クエリの `EXPLAIN ANALYZE` を
採取する（無ければ式評価 + Seq Scan になることをプランナ仕様から論証で代替）。

**Verify**: 呼び出しサイト一覧と、現行検索の実行計画（実測または論証）が調査ノートにある。

### Step 2: 統合アーキテクチャの設計

Open questions 1・2・6 に答える: 生成列 + GIN の DDL、検索とブラウズの合成経路
（推奨初期仮説: `$queryRaw` で「ID + ts_rank」を取得 → Prisma `findMany({ where: { id: { in } } })`
で hydrate → rank 順に並べ替え、の2段構え）、slug 解決の並列化。

> **フィルタは LIMIT より前に適用すること**（順序の誤りを禁止する）。素朴な2段構えで
> 「①`$queryRaw` が ts_rank 上位 50 件を先に `LIMIT 50` で確定 → ②Prisma でカテゴリ/価格/属性
> フィルタを適用」とすると、②が 50 件を間引いて **50 件未満**になり、かつ rank 51 位以降の
> **フィルタ適合商品を取りこぼす**（正しくない結果）。対策:
> - カテゴリ/価格/属性フィルタを **①の `$queryRaw` の `WHERE` に押し込み**、フィルタ適用**後**に
>   `ORDER BY ts_rank ... LIMIT/OFFSET` する（フィルタ → ソート → ページング の順）。
> - フィルタ条件が Prisma 側にしか表現できない場合は、少なくとも **LIMIT を最終段（フィルタ後）
>   にのみ置く**設計にする（先頭段での早期 LIMIT を禁止）。
> - ページングは「フィルタ済み母集合」に対して行い、`totalCount` もフィルタ後で数える。
> spike はこの「フィルタ → LIMIT」順序を SQL 雛形で明示し、誤順序を anti-pattern として記録する。

**Verify**: 統合後の「検索語 + カテゴリ + 価格帯 + 属性ファセット」を1リクエストで処理する
シーケンス図（テキストで可）と各段の SQL/Prisma 雛形が design doc 案にあり、**フィルタが LIMIT より
前に適用される**ことが雛形上で確認できる。

### Step 3: ファセット集計と価格ソートの設計

Open questions 3・4 に答える。014 の格納方式決定（あれば）の上に集計方式を確定し、
価格の非正規化可否を決める。

**Verify**: 集計方式の選定理由と、minPrice 非正規化を選んだ場合の更新経路
（`upsertProduct` — `product.ts:71` — への追記点）が明記されている。

### Step 4: 設計ドキュメントと後続実装プランの執筆

`docs/design/faceted-search/design.md` を書き、`plans/0NN-implement-faceted-search.md`
（分割する場合は複数）を plan-template 準拠で書く。`filters: any` の型付け（question 5）は
後続プランの必須ステップに含める。

**Verify**: 後続プランの各ステップに検証コマンド（`bunx tsc --noEmit` / `bun run test -- <path>` /
検索 E2E の追加方針）が付き、マイグレーションステップに ERD 再生成が含まれる。

## Done criteria

ALL を満たすこと:

- [ ] `docs/design/faceted-search/design.md` が存在し、Open questions 全6問に決定 + 証拠がある
- [ ] 統合後アーキテクチャのシーケンスと SQL/Prisma 雛形が design doc にある
- [ ] `plans/0NN-implement-faceted-search.md`（または分割プラン群）が存在し、テンプレート準拠
- [ ] ソースコード・スキーマは未変更（`git status` が新規ドキュメント/プランのみ）
- [ ] `plans/README.md` の 015 ステータス行を更新した

## STOP conditions

以下の場合は STOP して報告する:

- `searchVector` 生成列や GIN インデックスが既にスキーマに導入済み（前提消滅）
- Prisma Accelerate 経由で `$queryRaw` + `Unsupported("tsvector")` に重大な制約
  （コネクションプーリングとの非互換等）が一次情報で確認された場合 — Round 1 deferred の
  Prisma 6.x アップグレード spike（DEPS-04）との統合要否を添えて報告
- 014 の格納方式が未確定のままファセット集計方式を1つに絞れない場合 — 併記で design doc を
  完成させ、確定を 014 側の完了条件に委ねる（これは STOP でなく明記事項）

## Maintenance notes

- 検索対象列（brand・keywords 等）を増やすたびに生成列の定義とマイグレーションが必要になる —
  design doc に「検索対象の追加手順」を運用手順として残すこと
- plan 017（レコメンド）の「同カテゴリ人気商品」クエリは本設計のカテゴリスコープ済み
  ブラウズクエリを再利用できる — 実装時に query の共有を検討
- レビュアーが後続実装 PR で最も精査すべき点: 生 SQL とPrisma where の合成部分の
  SQL インジェクション安全性（必ず `Prisma.sql` パラメータ化 — 既存 route の規約）と、
  2段構え hydrate の N+1 化の回避
