# カテゴリツリー（N 階層化） — 設計（design.md）

> plan [013](../../../plans/013-spike-category-tree-n-level.md)（design/spike）の成果物。
> **本ドキュメントは設計のみで、`src/` / `prisma/schema.prisma` は 1 行も変更しない。**
> 表現方式の選定根拠は [ADR-006](../../architecture/decisions/006-category-tree-representation.md)、
> 実装手順は後続実装プランが持つ。
>
> - 調査日: 2026-08-31 / 対象 HEAD: `bb780b99`（branch `dev`）
> - ドリフトチェック結果: `schema.prisma`・`category.ts`・`subCategory.ts` は plan 起票時
>   （`a17e2cc`）から**無変更**。`product.ts`（+58/−17）と `schemas.ts`（+30）は動いているが、
>   いずれも本設計が依存する契約（slug を `findUnique` で解決 / `categoryId`・`subCategoryId` の
>   必須 UUID 検証）は健在で、STOP 条件には非該当。

---

## 0. 設計の前提（実コードで確認済みの事実）

| #   | 事実 | 出典 |
| --- | ---- | ---- |
| 0-1 | `Category` は self-relation を持たない。`SubCategory` は `Category` と同型 + 親 FK で、**自身の子を持てない** | [`schema.prisma:42-73`](../../../prisma/schema.prisma) |
| 0-2 | `Category.url` と `SubCategory.url` は**別テーブル上の別 `@unique`**。同一 slug の共存は**現在合法** | [`schema.prisma:46`](../../../prisma/schema.prisma) / [`schema.prisma:62`](../../../prisma/schema.prisma) |
| 0-3 | `Product` は `categoryId`・`subCategoryId` を**両方必須**で持つ | [`schema.prisma:157-161`](../../../prisma/schema.prisma) |
| 0-4 | browse の絞り込みは slug 単体を **`findUnique`** で解決（不一致時は 0 件返却に修正済み） | [`product.ts:643-664`](../../../src/queries/product.ts) |
| 0-5 | home の動的セクションは slug を**リレーションフィルタ** `{ category: { url } }` で解決する | [`home.ts:136-141`](../../../src/queries/home.ts) |
| 0-6 | サイズフィルタも同じくリレーションフィルタで slug 解決する | [`size.ts:57-58`](../../../src/queries/size.ts) |
| 0-7 | `getAllCategories` は `include: { subCategories: true }` の**1 段 include**、並びは `updatedAt desc`（**表示順カラムが無い**） | [`category.ts:109-110`](../../../src/queries/category.ts) |
| 0-8 | `deleteCategory` は**ハード delete**。配下商品の付け替えガードは無く、FK 違反で失敗する挙動に依存 | [`category.ts:189`](../../../src/queries/category.ts) |
| 0-9 | Zod は `categoryId` / `subCategoryId` を**両方必須 UUID** で検証 | [`schemas.ts:202-214`](../../../src/lib/schemas.ts) |
| 0-10 | 現行 URL は**クエリ形**（`/browse?category=…` / `/browse?subCategory=…`）。パス形ルートは存在しない | [`browse/page.tsx`](../../../src/app/(store)/browse/page.tsx) / [`category-card.tsx:12,25`](../../../src/components/store/home/category-card.tsx) / [`categories-menu.tsx:129`](../../../src/components/store/layout/categories-header/categories-menu.tsx) / [`footer/links.tsx:13`](../../../src/components/store/layout/footer/links.tsx) |
| 0-11 | admin は Category / SubCategory で**別ルート・別フォーム**（フラットテーブル） | [`admin/categories/`](../../../src/app/dashboard/admin/categories/) / [`admin/subCategories/`](../../../src/app/dashboard/admin/subCategories/) |
| 0-12 | シードの slug は `lux-women` / `lux-women-dresses` の**前置命名**で、**偶然**衝突しない | [`prisma/seed/constants/categories.ts`](../../../prisma/seed/constants/categories.ts) |
| 0-13 | admin ダッシュボードは `category.count()` と `subCategory.count()` を**別々に**集計している | [`dashboard.ts:64-65`](../../../src/queries/dashboard.ts) |

### 0-A. slug 解決の 2 経路は「壊れ方」が非対称である（本設計の分岐点）

同じ「slug からカテゴリを引く」でも、実装が 2 系統ある:

| 経路 | 実装 | 一意性スコープを変えたときの挙動 |
|------|------|--------------------------------|
| **A: `findUnique`** — [`product.ts:644,656`](../../../src/queries/product.ts) | `db.category.findUnique({ where: { url } })` | **型エラーで落ちる。** Prisma は一意と認識した列でしか `findUnique` を許さないため、`url @unique` を外した瞬間にコンパイルが通らない |
| **B: リレーションフィルタ** — [`home.ts:138-140`](../../../src/queries/home.ts) / [`size.ts:57-58`](../../../src/queries/size.ts) | `where: { category: { url: value } }` | **コンパイルは通る。** 一意性を要求しないため、親をまたぐ同名 slug があると**実行時に静かに別ノードへ一致し得る** |

経路 B の存在が、`@@unique([parentId, url])`（親内一意）を却下した決め手である。
詳細は [ADR-006 Option 4](../../architecture/decisions/006-category-tree-representation.md)。

---

## 1. 影響マトリクス（Step 1 の棚卸し結果）

**調査コマンド**:

```bash
grep -rn "subCategoryId\|categoryId" src/ --include="*.ts" --include="*.tsx" -l   # 11 files
grep -rli "subcategory" src/                                                       # 32 files
grep -rli "category" src/ prisma/seed/ tests/ --include="*.ts" --include="*.tsx"   # 94 files（粗集合）
```

粗集合 94 件のうち **12 件は偽陽性**で、実質の影響ファイルは **82 件**:

- **SupportForm クラスタ（8 件）**: `category` は問い合わせ種別の enum
  （`CONTACT` / `DISPUTE` / `RETURN_REQUEST` / `PROBLEM_REPORT`）であり、カタログのカテゴリとは無関係 —
  `support.ts` / `support.test.ts` / `support-form.tsx` / `support-form.test.tsx` /
  `contact` / `dispute` / `report-problem` / `returns-exchange` の各 `page.tsx`
- **コピペコメントのみ（4 件）**: `// Upserting category data` という**別フォームから複製された
  コメント**だけがヒット — `offer-tag-details.tsx` / `shippingRate-details.tsx` /
  `store-default-shipping-details.tsx` / `store-details.tsx`

| # | 分類 | 件数 | ファイル | 後続実装での書き換え方針 |
|---|------|------|---------|------------------------|
| 1 | **スキーマ / マイグレーション** | 1 | `prisma/schema.prisma` | `Category` に `parentId`/`path`/`depth`/`sortOrder`/`childCount` を追加、`CategorySlugAlias` 新設、`SubCategory` を段階的に drop（Phase A→C） |
| 2 | **サーバーアクション（queries）** | 6 | `category.ts` / `subCategory.ts` / `product.ts` / `home.ts` / `size.ts` / `dashboard.ts` | slug → ノード解決は据え置き（`url @unique` 維持）。商品絞り込みを**サブツリー prefix** へ拡張。`subCategory.ts` は `category.ts` へ吸収し薄い互換 re-export を残す。`dashboard.ts` の 2 系統カウントは depth 別集計へ |
| 3 | **Zod / 型** | 2 | `schemas.ts` / `types.ts` | `ProductFormSchema` の `subCategoryId` を撤去し `categoryId`（リーフ）1 本へ。`slug` の文字集合制約（`/` 禁止）を追加。`SubCategoryWithCategoryType` 等を `CategoryNode` 系へ再定義 |
| 4 | **ルーティング / API** | 4 | `browse/page.tsx` / `product/[productSlug]/[variantSlug]/page.tsx` / `store/[storeUrl]/page.tsx` / `api/index-products/route.ts` | URL の形は**変えない**。`?subCategory=` を受理し続けたうえで正準 `?category=` へ 308。index API の 2 系統 include をツリー 1 系統へ |
| 5 | **ストアフロント UI** | 12 | `category-card.tsx` / `featured-categories.tsx` / `categories-header.tsx` / `categories-menu.tsx` / `categories-header/container.tsx` / `browse-page/filters.tsx` / `filters/category/category-filter.tsx` / `filters/category/category-link.tsx` / `filters/size/size-filter.tsx` / `footer/footer.tsx` / `footer/links.tsx` / `store-page/store-products.tsx` | 2 段固定の `category.subCategories` 描画を**再帰コンポーネント**へ。リンク生成は `?category=<slug>` に一本化 |
| 6 | **admin / seller UI** | 13 | `admin/categories/{page,columns,new/page}.tsx` / `admin/subCategories/{page,columns,new/page}.tsx` / `forms/{category-details,subCategory-details,product-details}.tsx` / seller `products/{page,columns,new/page}.tsx` / `products/[productId]/variants/new/page.tsx` | `admin/subCategories/*` を**廃止**し `admin/categories/*` へ統合（親カラム + インデント表示）。商品フォームのカテゴリ選択を「2 つの select」→「ツリー選択 1 つ（リーフのみ選択可）」へ |
| 7 | **シーダー** | 17 | `prisma/seed/constants/categories.ts` / `constants/products/*.ts`（6）/ `helpers.ts` / `types.ts` / `seeders/{index,base-seeder,product-seeder}.ts` / `__tests__/*`（5） | `SeedSubCategory` を廃止し、`SeedCategory` に `parentUrl?` を持たせた**単一の木**へ。商品側は `categoryUrl`（リーフ）1 本 |
| 8 | **ユニット / コンポーネントテスト（src 内）** | 10 | `queries/{category,subCategory,product,home,size,dashboard}.test.ts` / `lib/schemas.test.ts` / `config/test-fixtures.ts` / `admin/categories/columns.test.tsx` / `browse/page.test.tsx` | フィクスチャを `createMockCategoryNode`（`parentId`/`path`/`depth` 付き）へ。`subCategory.test.ts` は互換レイヤーのテストとして縮退 |
| 9 | **コンポーネントテスト（tests/component）** | 3 | `browse-pagination.test.tsx` / `categories-menu.test.tsx` / `product-sort.test.tsx` | ツリー props への追随。`categories-menu` は 3 階層のレンダリングケースを追加 |
| 10 | **統合テスト** | 11 | `tests/integration/{cart-checkout,order-lifecycle,order-placement,product-browse,product-deletion,product-update,review-aggregation,search-products,user-deletion-webhook}.test.ts` / `setup/{seed,reset-db}.ts` | `setup/seed.ts` のカテゴリ投入をツリー化（**全統合テストの共通基盤なので最初に触る**）。`product-browse` に**サブツリー prefix の兄弟誤ヒット**シナリオを追加 |
| 11 | **E2E** | 4 | `tests/e2e/{engagement,search-filter}.spec.ts` / `seed/{constants,seed-e2e}.ts` | 旧 slug URL の**到達性テスト**を新設（`?subCategory=<旧slug>` が 308 で正しいノードへ着地すること） |
| | **合計** | **82** | | |

> **`setup/seed.ts`（分類 10）と `prisma/seed/`（分類 7）と `tests/e2e/seed/`（分類 11）は
> 3 系統の独立したシードである。** カテゴリ形状を変えると 3 つとも同時に赤くなるため、
> 実装プランでは**シードを最初のステップに置く**こと。

---

## 2. Open questions への決定

### Q1. ツリー表現方式 → **隣接リスト + materialized path のハイブリッド**

決定と 3 方式の比較は [ADR-006](../../architecture/decisions/006-category-tree-representation.md)
（Option 1 隣接リスト単独 / Option 2 採用案 / Option 3 closure table）。

**根拠の要約**: サブツリー検索は本リポジトリの**最頻クエリ**（browse の絞り込み・0-4）で
リクエスト毎に走る。隣接リスト単独では再帰 CTE = `$queryRaw` が storefront のホットパスに
必要になる。closure table は移動コストが O(子孫×祖先) で、かつ本リポジトリがほぼ使わない
「祖先方向の検索」に最適化された方式である。materialized path は
`{ path: { startsWith } }` として **Prisma の型付き API のまま書ける**点で 0-4 の書き換え先が最も素直。

**prefix 境界の定義（誤ヒット防止）**:

```ts
// path は区切り文字を末尾に付けずに保存する（例 "electronics/camera"）
const subtreeOf = (p: string) => ({ OR: [{ path: p }, { path: { startsWith: `${p}/` } }] });
```

- `subtreeOf("electronics/camera")` は `electronics/camera-accessories` に**一致しない**
  （`startsWith` の対象が `"electronics/camera/"` であるため）。
- `LIKE` メタ文字（`%` `_`）と区切り文字 `/` は **slug の文字集合制約**
  `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` で排除する。エスケープを書かずに済ませるための制約であり、
  **緩めてはならない**。
- 「直下の子のみ」が要る画面（admin のツリー展開）は `{ parentId: node.id }` を使う
  （path の区切り数を数える必要はない）。

### Q2. `SubCategory` の処遇 → **`Category` へ統合してテーブルを廃止する**

#### Q2-1. slug 一意性のスコープ → **グローバル一意（`url @unique`）を維持**

親内一意（`@@unique([parentId, url])`）を採らない理由は 4 点（[ADR-006 Option 4](../../architecture/decisions/006-category-tree-representation.md)）:
経路 B が静かに壊れる（0-A）/ `findUnique` の書き換えが強制され `findFirst` で黙らせる誘惑が生じる /
URL の形が変わり 0-10 の互換が崩れる / **`parentId = NULL` のルート同士の重複を防げない**
（PostgreSQL は NULL を区別するため部分ユニークインデックスか番兵ルートが別途必要）。

#### Q2-2. 決定論的・冪等なリネーム規則

0-2 のとおり同一 slug の共存は現在**合法**なので、統合時に P2002 で移行が落ち得る。

1. 衝突組のうち **SubCategory 由来の側**をリネームする（上位 URL を温存）。
2. 新 slug = `${親slug}-${旧slug}`。なお衝突する場合は `-2`, `-3`, … と**最初の空き番号**を昇順採用。
3. 処理順は `ORDER BY "createdAt" ASC, "id" ASC` に固定（決定論性）。
4. `CategorySlugAlias` 行は `(entityType, oldSlug)` で **upsert**（冪等性 — 再実行で同結果）。

> **`id` 衝突は考えなくてよい。** 両テーブルとも `@default(uuid())` であり実質起こらない。
> 実際に起きるのは **slug 衝突**である。

#### Q2-3. 旧 → 新 URL 対応表

```prisma
enum CategoryAliasSource { CATEGORY  SUB_CATEGORY }

model CategorySlugAlias {
  entityType CategoryAliasSource
  oldSlug    String
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())
  @@id([entityType, oldSlug])
  @@index([categoryId])
}
```

**キーを `oldSlug` 単体にしない。** 0-2 より Category `camera` と SubCategory `camera` は
共存し得るので、旧 slug だけをキーにすると**まさにリネームが必要になったペア（＝この表が
存在する理由そのもの）が 1 キーに 2 行ぶつかり引けなくなる**。
0-10 のとおり現行 URL は `?category=` / `?subCategory=` の**パラメータ名で種別が明示**
されているため、旧 URL からキー `(entityType, oldSlug)` を一意に構成できる。

**解決順序**（`/browse` のサーバー側）:

1. `Category.url` の完全一致を引く → ヒットすればそれが正準。
2. 外れたら `CategorySlugAlias` を `(entityType, oldSlug)` で引く → ヒットすれば
   **正準 URL へ 308 リダイレクト**。
3. どちらも外れたら 0 件を返す（0-4 の fail-closed 挙動を維持する。**フィルタを黙って
   捨てて全件表示に化けさせない**）。

**移行成果物として、対応表の CSV を `docs/design/category-tree/slug-migration-map.csv`
に出力する**（実装プランの完了条件）。リネームが 0 件だった場合は
「空の表 + 事前計測クエリの結果」で足りる。

#### Q2-4. 事前計測クエリ（**移行を書く前に実行する**）

```sql
SELECT count(*) FROM (
  SELECT url FROM "Category" INTERSECT SELECT url FROM "SubCategory"
) AS collisions;
```

> `count(*)` で畳むこと。素の `INTERSECT` は一覧を返すだけで「何件か」を答えない。
> **件数 0 でも規則は決めておく**（将来の admin 入力で発生し得る）。
> 0-12 のとおり `bun run seed:luxury` は前置命名で**偶然**衝突しないため、
> シードが通ったことを衝突ゼロの証拠として扱わないこと。

### Q3. `Product` FK の移行 → **3 フェーズの並走（一括切替はしない）**

| Phase | スキーマ | 読み取り | 書き込み | ロールバック |
|-------|---------|---------|---------|-------------|
| **A** | `Category` に木の列を追加 / `CategorySlugAlias` 新設 / `Product.categoryNodeId`（**nullable**）追加 | 旧 FK | 旧 FK のみ | 新列 drop のみ。既存挙動は無傷 |
| **B** | 変更なし | **新 FK + サブツリー prefix** | **新旧 dual-write** | 読み取りを旧 FK へ戻す |
| **C** | `categoryNodeId` 必須化 → `subCategoryId` / 旧 `categoryId` drop → `categoryNodeId` を `categoryId` へ rename → `SubCategory` drop | 新 FK | 新 FK | **不可逆**。C の前に B の実測期間を置く |

一括切替を採らない理由: 0-3 のとおり**両方が必須 FK** であり、商品の付け替えを一度に
行うと戻せない。リポジトリ規約上も既存マイグレーションの編集は禁止で、補正は
新規マイグレーションでしか打てない（[`tech.md`](../../../.claude/steering/tech.md)）。

**クエリの書き換え形**（Phase B）:

```ts
// Before — product.ts:643-664（2 系統・完全一致）
if (filters.category) {
    const category = await db.category.findUnique({ where: { url: filters.category }, select: { id: true } });
    if (!category) return noMatchResult;
    whereClause.AND.push({ categoryId: category.id });
}

// After — 1 系統・サブツリー。slug 解決は url @unique のまま変わらない
const slug = filters.category ?? filters.subCategory;   // ?subCategory= は互換受理
if (slug) {
    const node = await db.category.findUnique({ where: { url: slug }, select: { id: true, path: true } })
        ?? await resolveAlias(slug, filters.category ? "CATEGORY" : "SUB_CATEGORY");
    if (!node) return noMatchResult;                     // fail-closed を維持
    whereClause.AND.push({ category: subtreeOf(node.path) });
}
```

```ts
// getAllCategories — category.ts:99-111
// Before: include: { subCategories: true } / orderBy: { updatedAt: "desc" }
// After:  ルートのみ取得し、path 昇順の 1 クエリでフラットに引いてアプリ側で木へ組む
const nodes = await db.category.findMany({
    where: storeId ? { products: { some: { storeId } } } : {},
    orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
});
return buildTree(nodes);   // path でネストを復元（再帰クエリ不要）
```

> **経路 B（0-A）は書き換え不要。** `home.ts:138-140` と `size.ts:57-58` の
> `{ category: { url: value } }` は `url @unique` を維持したので**意味が変わらない**。
> これが Q2-1 の決定によって得られた最大の節約である。

### Q4. URL 後方互換 → **クエリ形・フラット slug のまま（形を変えない）**

plan 本文が挙げた (a) 値に親パスを入れる / (b) パス形ルート新設 の**いずれも採らない**。
Q2-1 でグローバル一意を維持したため、**フラット slug のままで一意に解決できる**からである。
これは「第 3 の選択肢」であり、選べる条件が Q2-1 の決定に依存している点を明記しておく。

| 旧 URL | 移行後 | 手当て |
|--------|--------|-------|
| `/browse?category=lux-women` | **そのまま 200**（正準） | 不要 |
| `/browse?subCategory=lux-women-dresses` | `/browse?category=lux-women-dresses` へ **308** | パラメータ名の正準化のみ。slug は不変 |
| `/browse?subCategory=camera`（**リネームされた slug**） | `/browse?category=electronics-camera` へ **308** | `CategorySlugAlias` 経由 |

308（Permanent Redirect）を使うのは、メソッドとボディを保持する恒久リダイレクトであり
検索エンジンに正準 URL を伝えられるため。`?subCategory=` の受理は**恒久的に残す**
（外部被リンクを切らない）。

### Q5. 深さ制限と運用ルール → **最大 5 階層・リーフ強制はアプリ層**

- **最大深度 5**（`depth ≤ 4`）。`upsertCategory` の親指定時に `parent.depth + 1 ≤ 4` を検証し、
  Zod でも `depth` の範囲を持つ。
- **リーフのみ紐づけの強制は `upsertProduct` のトランザクション内**で
  `childCount === 0` を確認する。

> **素の DB CHECK ではリーフ強制はできない。** 「リーフか否か」は*他の行*に子があるかで
> 決まる**関係的な性質**であり、CHECK は同一行の値しか参照できない。取り得る手段は
> (a) アプリ層検証 / (b) トリガー / (c) `childCount` 非正規化列への CHECK の 3 つで、
> 本設計は **(a) + `childCount` の維持**を採る。(b) はリポジトリに既存のトリガーが無く
> 運用知識の面で高くつき、(c) 単体では「`childCount` が正しい」ことを別途担保する必要があるため。
> `childCount` の整合性は統合テスト（再計算との突き合わせ）で守る。

- **既存の非リーフ紐づけは経過措置として保持**する。検証は create / update 時のみ適用し、
  移行時に既存商品を強制的に付け替えない。規模は Q2-4 の 3 番目のクエリで事前計測する。

### Q6. 表示順とツリー UI → **`sortOrder` を追加し、admin はフラットテーブル拡張で始める**

- `sortOrder Int @default(0)` + `@@index([parentId, sortOrder])` を追加。
  0-7 の `updatedAt desc`（= **編集するたびに並びが変わる**）を
  `[{ depth: asc }, { sortOrder: asc }, { name: asc }]` へ置き換える。
- admin は `admin/subCategories/*` を廃止して `admin/categories/*` へ統合し、
  **親カラム + インデント表示**の 1 テーブルにする。DnD ツリーエディタは**作らない**。

**工数見積（後続実装プラン用）**:

| 領域 | 見積 | 根拠 |
|------|------|------|
| スキーマ + マイグレーション 3 本 + ERD 再生成 | M | 分類 1。Phase A/B/C |
| queries（6 ファイル）+ Zod/型 | M | 分類 2・3。経路 B が無変更で済む分だけ軽い |
| storefront UI（再帰描画）+ ルーティング | M | 分類 4・5（16 ファイル） |
| admin/seller UI（統合 + ツリー選択） | M–L | 分類 6（13 ファイル）。ルート 1 本の廃止を含む |
| シード 3 系統 | S–M | 分類 7・10・11 のシード部 |
| テスト追随 + 新規（prefix 誤ヒット / 旧 URL 到達性 / `childCount` 整合） | M | 分類 8〜11 |

---

## 3. 新スキーマ案（目標形）

```prisma
model Category {
  id       String  @id @default(uuid())
  name     String
  image    String
  url      String  @unique          // グローバル一意を維持（Q2-1）
  featured Boolean @default(false)

  parentId String?
  parent   Category?  @relation("CategoryTree", fields: [parentId], references: [id], onDelete: Restrict)
  children Category[] @relation("CategoryTree")

  path       String  // "electronics/camera/lens"（末尾に区切り無し・Q1）
  depth      Int     @default(0)    // ルート = 0、上限 4（Q5）
  sortOrder  Int     @default(0)    // Q6
  childCount Int     @default(0)    // リーフ判定の非正規化（Q5）

  products Product[] @relation("CategoryToProduct")
  aliases  CategorySlugAlias[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([parentId, sortOrder])
  @@index([path])
  @@index([name])
}

model Product {
  // ...
  categoryId String                 // ← リーフノード 1 本（旧 subCategoryId は Phase C で drop）
  category   Category @relation("CategoryToProduct", fields: [categoryId], references: [id])
  @@index([categoryId])
}
```

**plan 014（カテゴリ別属性）の前提を満たすことの明示**:
属性定義テーブルの FK 先は **`Category.id` の単一ノード**である。統合により
「Category か SubCategory か」の分岐が消えるため、014 は `AttributeDefinition.categoryId → Category.id`
を単純に張れる。属性の**継承**（親で定義した属性が子孫にも効く）は
`path` の prefix 条件（Q1 の `subtreeOf`）でそのまま表現できるので、014 側に
継承専用の構造は要らない。

---

## 4. data migration 手順（SQL レベルの概略）

Phase A のデータ移行のみ抜粋（DDL は Prisma のマイグレーションが生成する）。

```sql
-- A-1: 既存 Category をルート化
UPDATE "Category" SET "path" = "url", "depth" = 0 WHERE "parentId" IS NULL;

-- A-2: 衝突の事前計測（Q2-4）— 0 でも規則は実装しておく
SELECT count(*) FROM (SELECT url FROM "Category" INTERSECT SELECT url FROM "SubCategory") AS c;

-- A-3: SubCategory を Category の子として複製（衝突分は Q2-2 の規則でリネーム）
INSERT INTO "Category" (id, name, image, url, featured, "parentId", path, depth, "sortOrder", "createdAt", "updatedAt")
SELECT s.id, s.name, s.image,
       CASE WHEN EXISTS (SELECT 1 FROM "Category" c2 WHERE c2.url = s.url)
            THEN p.url || '-' || s.url ELSE s.url END,
       s.featured, s."categoryId",
       p.url || '/' || CASE WHEN EXISTS (SELECT 1 FROM "Category" c2 WHERE c2.url = s.url)
                            THEN p.url || '-' || s.url ELSE s.url END,
       1, 0, s."createdAt", s."updatedAt"
FROM "SubCategory" s JOIN "Category" p ON p.id = s."categoryId"
ORDER BY s."createdAt" ASC, s.id ASC;   -- 決定論性（Q2-2 の 3.）

-- A-4: エイリアス投入（冪等 — Q2-2 の 4.）
INSERT INTO "CategorySlugAlias" ("entityType", "oldSlug", "categoryId")
SELECT 'SUB_CATEGORY', s.url, s.id FROM "SubCategory" s
ON CONFLICT ("entityType", "oldSlug") DO UPDATE SET "categoryId" = EXCLUDED."categoryId";

INSERT INTO "CategorySlugAlias" ("entityType", "oldSlug", "categoryId")
SELECT 'CATEGORY', c.url, c.id FROM "Category" c WHERE c."parentId" IS NULL
ON CONFLICT ("entityType", "oldSlug") DO UPDATE SET "categoryId" = EXCLUDED."categoryId";

-- A-5: childCount の初期化
UPDATE "Category" p SET "childCount" =
  (SELECT count(*) FROM "Category" ch WHERE ch."parentId" = p.id);

-- A-6: Product の新 FK backfill（旧 subCategoryId と id を共有しているのでそのまま入る）
UPDATE "Product" SET "categoryNodeId" = "subCategoryId";
```

> **A-3 が `s.id` をそのまま流用している点が移行を単純にしている。** SubCategory の
> `id` を新 Category 行の `id` として再利用するため、A-6 の backfill が
> **単純な列コピー**で済み、対応表を引く必要がない。`id` は UUID なので
> Category 側との衝突は実質起こらない（Q2-2）。

**ロールバック**: Phase A / B は新列・新テーブルの drop で戻せる。Phase C は不可逆であり、
実施前に B の状態で本番相当の実測期間を置く。

---

## 5. 検証（後続実装プランの必須シナリオ）

| # | シナリオ | 理由 |
|---|---------|------|
| V-1 | `subtreeOf("electronics/camera")` が `electronics/camera-accessories` を**含まない** | Q1 の prefix 境界。兄弟誤ヒットは最も起きやすい欠陥 |
| V-2 | 旧 URL `?subCategory=<旧slug>` が 308 で正準ノードへ着地（リネーム分を含む） | Q2-3 / Q4。E2E で実施 |
| V-3 | 移行スクリプトの**2 回実行**で結果が同一 | Q2-2 の冪等性 |
| V-4 | `childCount` が `SELECT count(*)` の再計算と一致 | Q5 の非正規化列のドリフト検出 |
| V-5 | 子を持つノードへの商品紐づけが拒否される（create / update とも） | Q5 のリーフ強制 |
| V-6 | 存在しない slug で**全件表示に化けない**（0 件が返る） | 0-4 の fail-closed 挙動の回帰 |
| V-7 | `depth = 5` の作成が拒否される | Q5 の深さ上限 |

---

## 6. 本設計が主張しないこと

1. **ツリー UI（DnD エディタ）の設計** — Q6 のとおり範囲外。
2. **参照タクソノミー 20 部門の実データ投入** — 後続実装プランの領分。
3. **カテゴリ別属性の格納方式** — plan 014 の領分。本設計は FK 先を `Category.id` に
   一本化する前提だけを与える（§3）。
4. **`deleteCategory` の「無効化 + 付け替え」化** — 0-8 の現行ハード delete は
   ツリー化後 `onDelete: Restrict` により子を持つノードでも失敗するようになるが、
   EXPANSION_BLUEPRINT §3.3 の方式への移行自体は後続実装プランで扱う。
5. **性能実測** — 本 spike は読み取り専用調査であり、ベンチマークは取っていない。
   方式選定は 0-4〜0-7 のクエリ**形状**と規模見積（カテゴリは O(10^2〜10^3) 行）に基づく。
