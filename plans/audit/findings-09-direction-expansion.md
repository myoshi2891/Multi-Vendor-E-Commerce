# Findings 09 — Direction 拡張 recon（Round 2 / direction-expansion）

> **Round 2**（improve スキル `next` バリアント / 2026-07-09 / HEAD `a17e2cc`）の recon エビデンス集。
> 目的: 「Amazon 級マーケットプレイスへの拡張」を検討するブループリント
> （[`../direction/EXPANSION_BLUEPRINT.md`](../direction/EXPANSION_BLUEPRINT.md)）と
> spike プラン 013〜017 が引用する**現行コードの事実**を1箇所に集約する。
> 引用はすべて本体ファイルの再読から転記（HEAD `a17e2cc` 時点）。
> Round 1 の全体 recon は [`recon.md`](recon.md)、既存 direction 発見（DIRECTION-01〜05）は
> [`findings-08-direction.md`](findings-08-direction.md) を参照 — 本ファイルはそれらと重複しない
> **拡張観点（カタログ構造・発見性・ガバナンス・成長基盤）**のみを扱う。

---

## E-1: カテゴリ体系 — 固定2階層（N 階層ツリーではない）

**スキーマ** — `prisma/schema.prisma:42-74`:

```prisma
model Category {              // schema.prisma:42
  id       String  @id @default(uuid())
  name     String
  image    String
  url      String  @unique
  featured Boolean @default(false)
  subCategories SubCategory[] @relation("CategoryToSubcategory")
  products      Product[]     @relation("CategoryToProduct")
  // ...
  @@index([name])
}

model SubCategory {           // schema.prisma:58
  // Category と同型 + categoryId 外部キー。子を持てない（末端固定）
  categoryId String
  category   Category @relation("CategoryToSubcategory", fields: [categoryId], references: [id])
  products Product[] @relation("SubCategoryToProduct")
}
```

- 親子は `Category → SubCategory` の1段のみ。**self-relation（`parentId`）は存在せず、3階層目は表現不能**。
- `Product` は `categoryId` と `subCategoryId` の**両方が必須**（`schema.prisma:157-161`）。
  Zod 側も同様に必須 UUID（`src/lib/schemas.ts:202,208`）。
- カテゴリ CRUD は `src/queries/category.ts` / `subCategory.ts` にあり、いずれもフラットな
  `findMany` / `upsert` / `delete`（ツリー走査なし）:
  - `getAllCategories`（`category.ts:81-121`）— `include: { subCategories: true }` の1段 include、
    `orderBy: { updatedAt: "desc" }`。**表示順制御のカラム（sortOrder 等）が無く更新日時順**。
  - `deleteCategory`（`category.ts:181-203`）— **ハード delete**。配下に商品がある場合の
    ガード・付け替え処理なし（FK 制約違反で失敗する挙動に依存）。
  - `getAllSubCategoriesFotCategory`（`category.ts:128`）— 関数名に typo（`Fot`）が既存。
- 管理 UI は `src/app/dashboard/admin/categories/`（`page.tsx` + `columns.tsx` + `new/`）の
  フラットテーブル。ツリーエディタなし。

**含意（spike 013 の出発点)**: Amazon 型の browse node（部門 > カテゴリ > サブカテゴリ > リーフ、
実運用 3〜5 階層）を扱うには self-relation 化が必要。`Product.categoryId/subCategoryId` 必須の
二重 FK が全 queries・Zod・フォーム・URL 構造（`filters.category`/`filters.subCategory` が
URL slug ベース — E-3 参照）に波及するため、移行戦略が本丸。

## E-2: 商品属性 — 自由記述 key-value（カテゴリ非依存・型なし）

**スキーマ** — `prisma/schema.prisma:256-272`:

```prisma
model Spec {                  // schema.prisma:256
  id    String @id @default(uuid())
  name  String                // 自由記述（"素材" / "Material" 等の表記揺れを防ぐ機構なし）
  value String                // すべて文字列（数値・enum・単位の型制約なし）
  productId String?           // Product レベル or
  variantId String?           // Variant レベル（どちらも optional）
}
```

- 入力は `ProductFormSchema` の `product_specs` / `variant_specs`（`src/lib/schemas.ts:290,306`）。
  name/value の非空チェックのみで、**カテゴリごとの必須属性・許容値・単位の定義は存在しない**。
- `Spec` は表示専用で、**検索・フィルタリングのどこからも参照されていない**（E-3 の
  `getProducts` は size/color/price/offer のみ。`grep -rn "specs" src/queries/product.ts` は
  upsert と include のみ）。
- バリアント軸は `Size`（`schema.prisma:200`、price/quantity/discount を保持）と
  `Color`（`schema.prisma:232`、name のみ）の**2軸に固定**。書籍の「判型」、家電の「容量」の
  ような第3の軸は `Size.size` 文字列への読み替えでしか表現できない。

**含意（spike 014 の出発点)**: カテゴリ別属性スキーマ（属性定義テーブル + 商品側の属性値）が
ないと、カテゴリ横断の汎用カタログでファセット検索・商品比較・構造化データ（schema.org）が
成立しない。既存 `Spec` からの移行パスと「属性定義 vs JSONB」の選定が spike の中心論点。

## E-3: 検索・ブラウズ — tsvector 単純検索 + variants 経由の限定フィルタ

**全文検索 API** — `src/app/api/search-products/route.ts:33-44`:

```sql
SELECT p.id, p.name, p.description,
       ts_rank(to_tsvector('simple', p.name || ' ' || COALESCE(p.description, '')), ...) AS relevance
FROM "Product" p
WHERE to_tsvector('simple', p.name || ' ' || COALESCE(p.description, ''))
      @@ plainto_tsquery('simple', ${q})
ORDER BY relevance DESC LIMIT 50
```

- 対象は **`Product.name` + `description` のみ**。`ProductVariant.keywords`（`schema.prisma:179`）・
  `brand`（`schema.prisma:135`）・カテゴリ名・`Spec` は検索対象外。
- インデックスなしの式評価（`to_tsvector` を行ごとに計算）。生成列 + GIN インデックス未導入。
- カテゴリ絞り込み・ファセット集計（件数付きフィルタ）・サジェストは無い。

**ブラウズ側フィルタ** — `src/queries/product.ts:601-772`（`getProducts`）:

- シグネチャが `filters: any = {}`（`product.ts:602`）— **`any` 使用**（規約違反の既存箇所）。
- フィルタ実装: store/category/subCategory/offer は URL slug → ID 解決の**逐次 await**
  （`product.ts:619-683`）、size は `variants.some.sizes.some.size IN`（`:658-670`）、
  検索語は `contains`/`insensitive` の ILIKE 相当（`:687-721`、tsvector 経路とは別実装）、
  価格は `variants.some.sizes.some.price gte/lte`（`:724-739`）、color は
  `variants.some.colors.some.name IN`（`:742-757`）。
- ソートは views / createdAt / rating の3種のみ（`:758-772`）。価格順ソートは無い。
- ファセット件数（「この条件でカラー赤は12件」）を返す集計は存在しない。

**含意（spike 015 の出発点)**: E-2 の属性基盤の上に、①生成列 + GIN での tsvector 高速化と
対象拡大、②属性ファセットの集計/フィルタ、③2系統ある検索実装（tsvector と ILIKE）の統合、
を設計する。Round 1 deferred の **PERF-05**（カテゴリ等参照データのキャッシュ）と直交せず
統合検討する。

## E-4: カタログガバナンス — 店舗承認のみ・商品承認なし

- `StoreStatus` enum: `PENDING / ACTIVE / BANNED / DISABLED`（`schema.prisma:76-81`）、
  `Store.status @default(PENDING)`（`schema.prisma:91`）。
- 出店申請 `applySeller`（`src/queries/store.ts:416-478`）→ ADMIN が `updateStoreStatus`
  （`store.ts:531-602`）で承認。PENDING→ACTIVE 遷移で `$transaction` 内ロール昇格 +
  Clerk metadata 同期（`store.ts:559-591`）。**店舗レベルの審査フローは既に存在する**。
- 一方、**商品レベルの審査は皆無**: `upsertProduct`（`src/queries/product.ts:71`）は
  SELLER が保存すると即公開される。`Product` に status/公開フラグに相当するカラムが無い
  （`schema.prisma:130-170`）。
- **`ProductStatus` enum は商品公開ゲートに転用できない（実スキーマ照合済み）** —
  名前が紛らわしいため、spike 016 の設計で最初に潰しておくべき誤解:
  - `enum ProductStatus`（`schema.prisma:560-573`）の値は
    **`Pending` / `Processing` / `ReadyForShipment` / `Shipped` / `Delivered` / `Canceled`**。
    各値には「Product has been shipped」「Product has been delivered to the customer」等の
    コメントが付いており、**注文された商品の配送・フルフィルメント状態**を表す。
  - 実際の用途も `OrderItem.status`（`updateOrderItemStatusAsAdmin` の戻り値型が
    `ProductStatus` — `src/queries/order.ts`）であり、**カタログ上の商品の公開/非公開とは
    無関係**。`Pending` は「審査待ち」ではなく「注文されたがまだ着手していない」の意。
  - → **商品公開ゲートを実装するには、`Product` に別カラム（例: `Product.status`）と
    別 enum（例: `ProductApprovalStatus { DRAFT / PENDING_REVIEW / APPROVED / REJECTED }`）を
    新設する必要がある**。既存 `ProductStatus` の値を増やして流用すると、
    OrderItem の配送状態に「審査中」のような無意味な値が混入し、
    両ドメインが 1 つの enum に癒着する（後から分離するのは migration を伴い高コスト）。
  > 命名の紛らわしさは既知の負債。spike 016 で新 enum を足す際は、
  > 既存 `ProductStatus` の**改名**（例: `OrderItemStatus`）を同時に検討すること
  > （`.claude/rules/03-data-model-diagram-sync.md` の ERD 再生成義務にも注意）。
- ストアフロントの商品取得（`getProducts` ほか）は **`store.status` を where で見ていない**
  （`product.ts:614-757` に status 条件なし）— BANNED/DISABLED 店舗の商品が
  ブラウズに出続ける可能性がある（要検証、spike 016 の調査項目）。
- `updateStoreStatus` / `getAllStores` は `currentUser()` + インラインロール検査の**旧パターン**
  （`store.ts:490-497,537-544`）— `requireAdmin` 未使用。Round 1 plan 002（Store フィールド
  allowlist）と隣接するが、承認ワークフロー拡張時に auth-guards へ寄せる同時修正候補。

**含意（spike 016 の出発点)**: Amazon 型の「出品ゲート」（新規販売者の商品を審査してから公開）
は、既存 StoreStatus 機構の商品版として設計できる。ADMIN 運用コスト（product.md KPI:
カタログ維持コストの低減）とのトレードオフで「全商品審査 / 新規店舗のみ審査 / 事後審査」の
選択が中心論点。

## E-5: レコメンド・パーソナライズシグナル — 収集済み・未活用

既存のシグナル（すべて実装済み・保存済み）:

| シグナル | 場所 | 現在の用途 |
|---|---|---|
| `Product.views` | `schema.prisma:140` / `incrementProductViews`（`product.ts:929-931` から呼出） | ソート `most-popular`（`product.ts:761-762`）のみ |
| `Product.sales` / `ProductVariant.sales` | `schema.prisma:137` / `:184` | 表示のみ（ソート・レコメンド未使用） |
| `Product.rating` / `numReviews` | `schema.prisma:136,138` | ソート `top-rated`（`product.ts:767-768`） |
| `Wishlist`（user × product × variant × size?） | `schema.prisma:641-663` | プロフィールの一覧のみ |
| `Store.featured` / `Category.featured` / `SubCategory.featured` | `schema.prisma:101` / `:47` / `:63` | ホーム掲載枠 |
| 注文履歴（`OrderItem` → user） | `schema.prisma:612` | 履歴表示のみ |

- 「関連商品」の**スロットは既に予約済みだが常に空**: 商品ページのレスポンス整形
  `formatProductResponse` が `relatedProducts: []` をハードコードで返す（`product.ts:1080`）。
  これ以外に「この商品を見た人は」「あなたへのおすすめ」に相当する query・UI は存在しない
  （`grep -rni "related|recommend" src/queries/` のヒットはこの1行のみ）。
- product.md はスコープ外に「高度な分析ダッシュボード」を挙げるが、**レコメンドは分析
  ダッシュボードではなく購買動線の機能**であり、スコープ外指定には該当しない（境界は
  spike 017 で明示的に線引きする）。

**含意（spike 017 の出発点)**: 外部基盤（ML・ベクタ DB）を持ち込まずとも、既存シグナルの
ルールベース合成（同カテゴリ×views/sales 上位、共起注文、wishlist 人気）で「関連商品」枠は
成立する。まず SQL で成立する v1 を設計し、将来の協調フィルタリングへの差し替え点を
インターフェイスとして固定するのが spike の狙い。

---

## 決定済みトレードオフ・スコープ外（本ラウンドで提案しないもの）

- `product.md:33-36` スコープ外: **多通貨・税計算エンジン・高度な分析ダッシュボード・
  配送キャリア連携** — ブループリントでは「ゲート付き将来項目」として位置のみ示す。
- `docs/architecture/saas-roadmap.md` Phase 2/3（orgId/RLS・課金）— ロードマップ自身が
  「現時点では不要」とゲート済み（findings-08 DIRECTION-05 の分析どおり）。
- Elasticsearch 再導入 — tsvector 選定は決定済みトレードオフ（`recon.md` 参照）。spike 015 は
  tsvector の延長線で設計し、Elasticsearch 復活は提案しない。
- DIRECTION-01〜05（返金実行・restock・サポートコンソール・i18n・監視）— findings-08 で
  監査済み。本ラウンドはブループリントのロードマップに参照配置するのみで再監査しない。
