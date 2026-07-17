# Findings 03 — Performance（raw・未 vet）

> Explore サブエージェント報告（2026-07-03 / HEAD `f9752c0`）。**Phase 3 の vet 前の生データ**。
> 決定済み（force-dynamic による SSG 放棄・Elasticsearch→tsvector）は報告対象外。C2 の「監視の不在」は再報告せず、具体的な過大バンドル証拠のみ対象。

### [PERF-01] Batch per-item product + shipping lookups in cart/checkout validation (N+1)

- **Evidence**: `src/queries/user.ts:124`（`saveUserCart`）, `:449`（`placeOrder`）, `:799`（`updateCartWithLatest`）, `:996`（`updateCheckoutProductWithLatest`）— 各 `cartProducts.map(async (item) => db.product.findUnique(...))` でアイテム毎 1 クエリ。各反復が `getShippingDetails`（`product.ts:1196`+`:1205`）を呼び、それ自体が `country.findUnique` + `shippingRate.findFirst`。`placeOrder` は同じ `shippingAddress.countryId` に対し `user.ts:503` でアイテム毎に冗長な `country.findUnique` も発行。
- **Impact**: N アイテムのカートで `saveUserCart`/`updateCart*` は約 3N、`placeOrder` は約 4N の DB ラウンドトリップ。`updateCheckoutProductWithLatest` はチェックアウトページ描画で走るためカートサイズ倍化。country lookup は全アイテムで同一なのに N（2N）回再取得。
- **Effort**: M / **Risk**: MED（バリデーション/価格/在庫は金銭クリティカル・per-item セマンティクス保持必須） / **Confidence**: HIGH
- **Fix sketch**: `findMany({ where: { id: { in: productIds } } })` 1 発、country は 1 回に hoist、shippingRate は `(countryId, storeId)` でメモ化。メモリ上で反復。

### [PERF-02] Parallelize the product-page data waterfall

- **Evidence**: `src/queries/product.ts:898-942`（`getProductPageData`）が逐次 await: `currentUser()` → `retrieveProductDetails`（`:949` findUnique + `:988` findMany）→ `getUserCountry()` → `getShippingDetails`（2 クエリ）→ `getStoreFollowersCount` → `checkIfUserFollowingStore` → `incrementProductViews`（書き込み）→ `getRatingStatistics`。呼び出し元 `product/[productSlug]/[variantSlug]/page.tsx:38`。
- **Impact**: 商品詳細ビュー毎に約 8 逐次ラウンドトリップ（最も叩かれる認証済みストアページ）。3〜8 は product row 確定後は概ね独立で並行可能。`incrementProductViews` は fire-and-forget 書き込みがレスポンスをブロック。
- **Effort**: S/M / **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: `retrieveProductDetails` 後に独立呼び出しを `Promise.all` で並行化。
  view increment（`incrementProductViews`）はレスポンスをブロックしないよう非同期化するが、
  **裸の `void` は使わない**。以下のいずれかにすること:
  - **(A) 失敗ハンドラを必ず付ける**:
    ```typescript
    void incrementProductViews(product.id).catch((error: unknown) => {
        // 握り潰さない: 構造化ログ規約（tech.md）に従い境界でログする
        if (error instanceof Error) {
            console.error("[Product:incrementProductViews] Failed to increment views", {
                error: error.message, stack: error.stack,
            });
        } else {
            console.error("[Product:incrementProductViews] Unknown error", { error });
        }
    });
    ```
  - **(B) Next.js のバックグラウンド実行 API を使う**: `after()`（`next/server`）や
    `waitUntil` に載せ、レスポンス後に実行させる。ランタイムが完了を管理するため
    「レスポンスをブロックしない」と「失敗を捨てない」を両立できる。
  > **なぜ裸の `void` が不可か**: `void` は「戻り値を捨てる」だけで **rejection は
  > 握り潰さない**。DB 書き込みが失敗すると unhandled rejection になり、
  > Node 15+ の既定ではプロセスが落ちうる（少なくともログノイズになる）。
  > 「fire-and-forget」は「失敗を無視してよい」という意味ではなく、
  > `.claude/rules/01-engineering-standards.md` の「エラーを握りつぶさない」に反する。
  > 本リポジトリには既に承認済みの前例がある — `.claude/steering/tech.md` の
  > 「Context Provider setter の同期化」節が、`void (async () => { ... })()` に
  > try/catch を伴わせるパターンを規定している（ADR-003）。

### [PERF-03] Home page: sequential fetches, unbounded offer query, and 100-product deep fetch

- **Evidence**: `src/app/(store)/page.tsx:26-38` が `getProducts({}, "", 1, 100)` → `getHomeDataDynamic([...])` → `getHomeFeaturedCategories()` を逐次 await。`getProducts` は page size **100** で `variants → sizes, images, colors` を include（`product.ts:776-790`）。`getHomeDataDynamic`（`home.ts:145`）は `db.product.findMany` を **`take` なし**で発行（`new-product`/`seasonal` の全商品を全 variants/sizes/images 付きで返す）。
- **Impact**: 最高トラフィックページ（force-dynamic で毎リクエスト）で 3 逐次ウォーターフォール。無制限 offer クエリはタグに商品が溜まるほど無限成長。100 件 deep include はカードのみ描画のグリッドに大きなペイロードを送る。
- **Effort**: S/M / **Risk**: LOW/MED / **Confidence**: HIGH（ウォーターフォール + take 欠如）/ MED（ペイロード影響は要計測）
- **Fix sketch**: 3 呼び出しを `Promise.all`、`getHomeDataDynamic` に `take: N`、ホームグリッドの page size 縮小 or card フィールドのみ select。

### [PERF-04] Paginate the seller store-orders list (unbounded findMany)

- **Evidence**: `src/queries/store.ts:361-393`（`getStoreOrders`）— `db.orderGroup.findMany({ where: { storeId }, include: { items, coupon, order{...} } })` が **`take`/`skip` なし**。`orders/page.tsx:25` が直接消費。ページ化済み兄弟 `store-dashboard.ts:188 getStoreRecentOrders`（`take` あり）が既存パターン。
- **Impact**: 1 ページ描画で店舗の全注文履歴（全アイテム + ネストした order/address/payment）をロード。店舗成熟とともに無制限成長。
- **Effort**: S / **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: `getAllOrders`（`order.ts:326`）を踏襲し `Promise.all([findMany({skip,take}), count()])`。

### [PERF-05] Cache stable reference data (categories / countries / offer tags) and parallelize the header

- **Evidence**: `cacheStrategy`（Accelerate）は `src/` に **0 回**、`unstable_cache` はダッシュボード統計のみ。`getAllCategories`（`category.ts:99`）/ `getAllCountries`（`country.ts:7`）/ `getAllOfferTags`（`offer-tag.ts:98`）が毎リクエスト uncached。`CategoriesHeader`（`categories-header.tsx:6-8`）が `getAllCategories()` → `getAllOfferTags()` を**逐次** await、home/product ページで描画。`getAllOfferTags` は `_count` 順のためだけに `include: { products: { select: { id: true } } }`（タグ毎の全 product id）を over-fetch。
- **Impact**: 全 force-dynamic ストアページがほぼ静的なカタログメタデータを再クエリ、ヘッダーで逐次 2 回、offer タグ毎に全 product id を引きずる。Accelerate `cacheStrategy`/`unstable_cache` の最適候補。
- **Effort**: S/M / **Risk**: LOW/MED（カテゴリ/offer 編集時の staleness・admin mutation 経路に tag revalidation） / **Confidence**: HIGH
- **Fix sketch**: 3 クエリを `unstable_cache`（or `cacheStrategy: { ttl, swr }`）で包み、ヘッダーを `Promise.all`、未使用 `products` include を除去。

### [PERF-06] Remove the discarded `getFilteredSizes` query on the browse page

- **Evidence**: `src/app/(store)/browse/page.tsx:32` — `await getFilteredSizes({});` の結果がどのコンポーネントにも代入/渡されない（`ProductFilters` `:59` は `queries` のみ受領）。`getProducts`（`:33`）より先に await されブロック。
- **Impact**: browse/search 描画毎に無駄な DB ラウンドトリップ 1 発（`size.findMany` + グルーピング `size.ts:71`）、実際の商品取得の前に直列化。
- **Effort**: S / **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: この行を削除（or フィルタ UI に供給する意図なら結果を代入して渡す。現状は dead）。

### [PERF-07] Code-split heavyweight client-only deps (react-pdf, jodit, tremor) — `next/dynamic` is unused

- **Evidence**: `next/dynamic` は `src/` に **0 回**。`@react-pdf/renderer` は `order-page/pdf-invoice.tsx:10` が静的 import、`order-page/header.tsx:7` のトップレベル import 経由で注文ページに引き込まれる（「請求書ダウンロード」クリック時のみ必要）。`jodit-react`（`JoditEditor`）は 1382 行の `'use client'` フォーム `product-details.tsx:59` で静的 import、`@tremor/react`（`:82`）/ `react-tag-input`（`:56`）/ `react-multi-select-component`（`:46`）/ `react-datetime-picker` + CSS 3 本（`:77-80`）と同居。`@tremor/react` は `NumberInput` のためだけに非チャートフォーム（`shippingRate-details.tsx` 等）にも import。
- **Impact**: 販売者商品フォームと注文ページの first-load JS がリッチテキストエディタと PDF レンダラ（マニフェスト最重量級）を、インタラクション/稀ルート時のみ必要なのに搭載。
- **Effort**: M / **Risk**: MED（`ssr: false` は loading fallback 必要・jodit は元々 client-only） / **Confidence**: HIGH（静的 import 確認）/ MED（正確な KB は analyzer で要確認）
- **Fix sketch**: `const JoditEditor = dynamic(() => import('jodit-react'), { ssr: false })`、PDF はダウンロードハンドラ内で遅延 import、plain フォームの tremor `NumberInput` を既存 `ui/input` に置換。

### [PERF-08] Move `colorthief` out of the shared `lib/utils` barrel

- **Evidence**: `src/lib/utils.ts:2` — トップレベル `import ColorThief from "colorthief"`、`getDominantColors`（`:63-70`）内でのみ使用。`lib/utils.ts` は directive なしで **106** モジュールから import（`cn`・整形・`parseUserCountryCookie` 等）、`getDominantColors` の consumer は `images-preview-grid.tsx:9` の 1 箇所のみ。
- **Impact**: canvas/browser lib の `colorthief` が `cn` を import する全所で共通クライアントバンドルに引き込まれるリスク（barrel の default-import CJS はしばしば tree-shake されない）。高 fan-in モジュール × 単一利用 dep。
- **Effort**: S / **Risk**: LOW / **Confidence**: MED（tree-shaking で既に落ちている可能性・analyzer で前後確認）
- **Fix sketch**: `getDominantColors` を専用モジュール（`src/lib/color.ts`）へ抽出、
  or 関数内で `const ColorThief = (await import("colorthief")).default`。
- **副作用（見落としやすい）**: **動的 import 方式（後者）を採ると `getDominantColors` は
  同期関数から `async` 関数へ変わる**。したがって**唯一の consumer である
  `src/components/store/shared/images-preview-grid.tsx:9` の呼び出し側も
  `await` 対応（および呼び出し文脈の非同期化）が必要**になる。
  > 修正を `lib/utils.ts` 内で完結すると思い込むと、呼び出し側が
  > `Promise<string[]>` を色配列として扱い、**型エラーにならないまま**
  > 実行時に壊れる経路（例: そのまま style に渡す）が生じうる。
  > **副作用のない選択肢は前者（専用モジュールへの抽出）**で、こちらは
  > 関数シグネチャを変えずに barrel からの巻き込みだけを解消できる。
  > バンドルサイズの実測（analyzer での前後比較）で前者が十分なら、
  > 呼び出し側を巻き込まない前者を優先すること。

### [PERF-09] Add dependency and build caching to CI

- **Evidence**: `.github/workflows/ci.yml` — 全ジョブ（lint`:47`/test`:62`/build`:129`/integration`:150`/seed-idempotency`:194`/visual-baselines`:258`）が `bun install --frozen-lockfile` を **`actions/cache` なし**で実行（`setup-bun` は既定で dep キャッシュしない）。build ジョブ（`:119-134`）は `.next/cache` も未永続化。
- **Impact**: 6 ジョブが毎回コールド install、build 毎に Next.js 増分コンパイラキャッシュ破棄 — 回避容易な CI 時間の支配的コスト。
- **Effort**: S / **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: `~/.bun/install/cache`（key: `bun-${{ hashFiles('bun.lock') }}`）と build の `.next/cache` をキャッシュ。

### [PERF-10] Batch OrderItem creation inside the placeOrder transaction

- **Evidence**: `src/queries/user.ts:696-728` — `db.$transaction` 内で `for (const item of items) { await tx.orderItem.create(...); await tx.size.updateMany(...) }`（店舗グループ毎にアイテム毎 2 逐次書き込み）。
- **Impact**: N アイテム注文で row lock 保持中に約 2N 逐次ラウンドトリップ、トランザクションウィンドウ長期化 + 並行チェックアウト時の `Size` ロック競合。
- **Effort**: M / **Risk**: MED（原子的 stock check-and-decrement の `count===0` ガードを正確に保持必須） / **Confidence**: HIGH
- **Fix sketch**: 全 `size.updateMany`（ガード付き）を先に実行、その後グループのアイテムを 1 発 `tx.orderItem.createMany`。

### [PERF-11] (investigate) Unindexed full-text path in `index-products` search route

- **Evidence**: `src/app/api/index-products/route.ts:35-54, 80-119, 179-293` が `name`/`brand`/`variantName`/`keywords` に Prisma `{ search }` + `name`/`brand`/`description`/`variantName`/`keywords` に ILIKE `contains` フォールバック。DB の FTS インデックスは `to_tsvector('simple', name || ' ' || description)` の GIN のみ（`prisma/migrations/20260222101357_init_postgresql/migration.sql:503`）で、これは**別ルート**の raw SQL（`search-products/route.ts:33`・正しくインデックス済み）に一致するが、Prisma の per-column `to_tsvector` にも `brand/variantName/keywords` にも一致しない。ILIKE フォールバック（先頭ワイルドカード）はインデックス不使用（pg_trgm なし）。
- **Impact**: このルートの search/count（+ 相関 `variants.some` サブクエリ）がリクエスト毎に `Product`/`ProductVariant` の seq scan にフォールバック、count がスキャンを倍化。ユーザー到達性は呼び出し元次第（ヘッダーボックスは indexed `search-products` を使用・このルートの実使用は未確認）。
- **Effort**: M / **Risk**: MED / **Confidence**: LOW/MED（インデックス不一致は migration から証拠あり・ランタイム到達性と Prisma 発行 SQL は EXPLAIN で要検証）
- **Fix sketch**: 呼び出し元を確認後、検索対象カラムを一致する GIN インデックス（or contains 用 pg_trgm GIN）で裏打ちし直接クエリ。

### [PERF-12] (low) In-app revenue bucketing scans all rows in window

- **Evidence**: `src/queries/dashboard.ts:118`（`getSalesOverTime`）/ `store-dashboard.ts:139`（`getStoreSalesOverTime`）が 30 日/12 ヶ月ウィンドウの全 `Paid` order/orderGroup を `findMany`（`select createdAt,total`）し JS でバケット化。両者に「規模拡大時は SQL date_trunc + groupBy へ移行」コメント既存。
- **Impact**: ダッシュボード描画毎にウィンドウ内全注文行をアプリメモリにロード、ボリュームに線形成長。時間ウィンドウで有界 + admin 経路は `unstable_cache` 緩和のため低緊急。
- **Effort**: M / **Risk**: MED（Decimal 合計が現行丸めと一致必須 NFR-3） / **Confidence**: HIGH
- **Fix sketch**: `$queryRaw` で `date_trunc(...) ... SUM(total) GROUP BY 1`。

---

**Areas checked and found clean**: Zustand cart/compare は細粒度セレクタ（whole-store 購読なし）; raw `<img>` 0 件（next/image 使用）; `slug`/`url` は `@unique`・`storeId`/`userId`/`categoryId`/`orderGroupId`/`conversationId` は `@@index` 済み; 主 FTS `search-products` GET は `Product_fulltext_idx` GIN で正しく裏打ち; `getProducts`/`getAllOrders`/profile リスト/store-dashboard recent/top は `take`/`skip` ページ化済み; `getHomeDataDynamic` はパラメータ横断で `Promise.all` を正しく使用。
