# 006. カテゴリ階層の表現方式 — 隣接リスト + materialized path（ハイブリッド）

- **Status**: Accepted
- **Date**: 2026-08-31
- **Deciders**: project team（plan [013](../../../plans/013-spike-category-tree-n-level.md) の spike として起票）

---

## Context

現行カテゴリは `Category → SubCategory` の**固定 2 階層**で、self-relation を持たない
（[`prisma/schema.prisma:42-73`](../../../prisma/schema.prisma)）。`SubCategory` は
`Category` と同型 + 親 FK を持つだけで、**自身の子を持てない**。したがって
「Electronics > Camera > Lens > Prime」のような 3 階層以上を表現できず、
[`plans/direction/EXPANSION_BLUEPRINT.md`](../../../plans/direction/EXPANSION_BLUEPRINT.md) §3.2 の
参照タクソノミー（20 部門・実運用 3〜4 階層）を載せられない。

構造変更の波及が大きいため、**表現方式を決めずに実装へ入ると手戻りが確定する**。
本 ADR は表現方式と、それに連動する slug 一意性スコープ・URL 互換戦略を確定する。

### 決定に効いた既存コードの事実（実測）

| # | 事実 | 出典 |
|---|------|------|
| C-1 | `Category.url` / `SubCategory.url` は**別テーブル上の別 `@unique`**。したがって Category `camera` と SubCategory `camera` は**現在まったく合法に共存できる** | [`schema.prisma:46`](../../../prisma/schema.prisma) / [`schema.prisma:62`](../../../prisma/schema.prisma) |
| C-2 | `Product` は `categoryId`・`subCategoryId` を**両方必須**で持つ二重 FK | [`schema.prisma:157-161`](../../../prisma/schema.prisma) |
| C-3 | browse の絞り込みは slug 単体を **`findUnique`** で ID 解決する（category / subCategory とも） | [`product.ts:644`](../../../src/queries/product.ts) / [`product.ts:656`](../../../src/queries/product.ts) |
| C-4 | home の動的セクションは slug を**リレーションフィルタ** `{ category: { url: value } }` で引く。`findUnique` と違い**一意性を要求しない** | [`home.ts:138-140`](../../../src/queries/home.ts) |
| C-5 | `getAllCategories` は `include: { subCategories: true }` の **1 段 include**、並び順は `updatedAt desc` で**表示順カラムが無い** | [`category.ts:109-110`](../../../src/queries/category.ts) |
| C-6 | 現行 URL は**クエリ形**（`/browse?category=…` / `/browse?subCategory=…`）。`/browse/{category}/{subCategory}` のパス形ルートは**存在しない** | [`browse/page.tsx`](../../../src/app/(store)/browse/page.tsx) / [`category-card.tsx:12,25`](../../../src/components/store/home/category-card.tsx) / [`categories-menu.tsx:129`](../../../src/components/store/layout/categories-header/categories-menu.tsx) / [`footer/links.tsx:13`](../../../src/components/store/layout/footer/links.tsx) |
| C-7 | Zod は `categoryId` / `subCategoryId` を**両方必須 UUID** で検証 | [`schemas.ts:202,208`](../../../src/lib/schemas.ts) |
| C-8 | 全文検索は既に `$queryRaw` の tsvector を使っており、raw SQL 面が 1 つ存在する | [`src/app/api/search-products/route.ts`](../../../src/app/api/search-products/route.ts)（tsvector/tsquery の `$queryRawUnsafe`） |

**C-3 と C-4 の非対称が本 ADR の分岐点である。** slug の一意性スコープを変えると、
C-3 は **Prisma の型エラーで強制的に露見**する（`findUnique` は一意と認識された列でしか呼べない）
のに対し、C-4 は**コンパイルが通ったまま実行時に別ノードへ一致し得る**。
「壊れたことに気づけない経路」が存在する以上、一意性スコープの変更は無条件には選べない。

---

## Decision

### D-1. 構造は「隣接リスト（`parentId`）+ materialized path（`path`）」のハイブリッド

`Category` に self-relation を追加し、`SubCategory` テーブルは**廃止して `Category` へ統合**する。
構造の SSOT は `parentId`、探索の高速路として `path` / `depth` を**同一トランザクション内で維持する
非正規化列**として持つ。

```prisma
model Category {
  id       String  @id @default(uuid())
  name     String
  image    String
  url      String  @unique          // ← グローバル一意を維持（D-2）
  featured Boolean @default(false)

  parentId String?
  parent   Category?  @relation("CategoryTree", fields: [parentId], references: [id], onDelete: Restrict)
  children Category[] @relation("CategoryTree")

  path       String  // 例 "electronics/camera/lens"（末尾に区切り無し・D-3）
  depth      Int     @default(0)   // ルート = 0、最大 4（= 5 階層・D-5）
  sortOrder  Int     @default(0)
  childCount Int     @default(0)   // リーフ判定の非正規化（D-5）

  products Product[] @relation("CategoryToProduct")

  @@index([parentId, sortOrder])
  @@index([path])
  @@index([name])
}
```

### D-2. slug の一意性は**グローバル一意（`url @unique`）を維持**する

親内一意（`@@unique([parentId, url])`）は採らない。

### D-3. サブツリー検索の prefix 境界

`path` は**区切り文字を末尾に付けずに**保存し、検索時に境界を明示する。

```ts
// ノード自身 + 全子孫
const subtree = { OR: [{ path: p }, { path: { startsWith: `${p}/` } }] };
// 直下の子のみ
const directChildren = { parentId: node.id };
```

`LIKE` 特殊文字（`%` `_`）と区切り文字 `/` は **slug 側の文字集合制約で排除**する
（Zod: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`）。エスケープ処理を書かずに済ませるための制約であり、
**この制約は D-3 の前提**なので緩めてはならない。

### D-4. URL は**クエリ形・フラット slug のまま**（形を変えない）

`?category=electronics/camera` のような親パス込みの値にも、`/browse/electronics/camera` の
パス形ルートにも**移さない**。D-2 によりフラット slug で一意に解決できるためである。
旧 URL のうち移行時にリネームされた分だけを、エイリアス表で 308 恒久リダイレクトする。

```prisma
model CategorySlugAlias {
  entityType CategoryAliasSource   // CATEGORY | SUB_CATEGORY
  oldSlug    String
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  @@id([entityType, oldSlug])
}
```

キーを `(entityType, oldSlug)` にするのは C-1 の帰結である。**旧 slug 単体をキーにすると、
まさに衝突してリネームが必要になったペア（＝この表が存在する理由そのもの）が
1 つのキーに 2 行ぶつかり引けなくなる**。現行 URL は `?category=` / `?subCategory=` の
**パラメータ名で種別が明示されている**（C-6）ため、旧 URL からキーを一意に構成できる。

### D-5. 深さ上限 5・リーフのみ紐づけ

- 最大深度 5（`depth ≤ 4`）。Zod と `upsertCategory` の両方で検証する。
- 「商品はリーフにのみ紐づく」は**アプリ層で強制**する（`childCount === 0` を
  `upsertProduct` のトランザクション内で確認）。**素の DB CHECK では表現できない** —
  リーフ性は*他の行*に子があるかで決まる関係的性質であり、CHECK は同一行の値しか参照できない。
- 既存の非リーフ紐づけは**経過措置として保持**し、検証は create/update 時のみ適用する。

### D-6. 表示順 `sortOrder` を追加し、admin は既存フラットテーブルの拡張で始める

`getAllCategories` の `orderBy` を `updatedAt desc`（C-5）から
`[{ depth: asc }, { sortOrder: asc }, { name: asc }]` へ変える。
ツリーエディタ（DnD）は**本ラウンドでは作らない** — 親カラム + インデント表示で足りる。

---

## Alternatives Considered

### Option 1: 隣接リストのみ（`parentId` + アプリ側再帰）

**メリット**: 列が 1 つ増えるだけ。移動（親付け替え）が 1 行 UPDATE で済む。非正規化列の
維持コストがゼロなので、path/depth が構造と食い違う「腐り」が原理的に起きない。

**デメリット**: サブツリー取得が **N+1 か再帰 CTE の二択**になる。Prisma は再帰 CTE を
型付き API で表現できないため `$queryRaw` が必須で、C-8 の raw SQL 面が browse の
ホットパスにもう 1 つ増える。browse の絞り込み（C-3）は**リクエストごとに**サブツリーを
必要とするため、ここが再帰 CTE になるのは割に合わない。

**なぜ選ばなかったか**: サブツリー検索が本リポジトリの**最頻クエリ**（browse フィルタ）であり、
そこに raw SQL を持ち込むコストが、非正規化列の維持コストを上回ると判断した。

### Option 2: 隣接リスト + materialized path（**採用**）

**メリット**:
- サブツリー検索が `path` の prefix 一致 1 本になり、**Prisma の型付き API のまま書ける**
  （`{ path: { startsWith } }`）。C-3 の書き換え先が素直。
- `path` が「slug の連なり」そのものなので、URL 互換（D-4）とパンくず表示の両方に再利用できる。
- 全文検索（[plan 015](../../../plans/015-spike-faceted-search-and-browse.md)）で
  「この部門配下に絞る」を tsvector 条件と AND するとき、prefix 条件は素の SQL でも
  Prisma でも同じ形で書ける。

**デメリット**:
- `path` は非正規化であり、**親付け替え時にサブツリー全行の UPDATE が必要**。
- prefix 境界を誤ると**兄弟ノードを誤ヒット**する（`electronics/camera` の素朴な
  `startsWith` が `electronics/camera-accessories` を拾う）→ D-3 で境界を定義して回避。
- slug に `/` を含められない制約が付く。

**なぜ選んだか**: 移動コストの懸念は**規模で消える**。カテゴリは実運用でも
O(10^2〜10^3) 行であり（現行シードは 7 + 25 = 32 行）、サブツリー UPDATE は
admin の低頻度操作である。一方で読み取りは storefront の毎リクエストに乗る。
**低頻度の書き込みを重くして高頻度の読み取りを軽くする**トレードオフとして正しい。

### Option 3: closure table（祖先-子孫の全ペアを別テーブルに保持）

**メリット**: サブツリー・祖先の両方向が単純な JOIN で引ける。深さ制限が実質不要。
移動時に path のような文字列書き換えが要らない。

**デメリット**:
- 行数が O(ノード数 × 平均深さ) に膨らみ、移動は
  **O(子孫数 × 祖先数) の DELETE + INSERT**。Option 2 の UPDATE より重い。
- Prisma で「ancestor 経由の Product 絞り込み」を書くと**関係を 2 段跨ぐ**ため、
  C-3 の書き換えが `findUnique` 1 本 → JOIN 前提のクエリへ大きく変わる。
- 整合性の維持点が**別テーブル**になるため、`$transaction` の対象が増え、
  「行が 1 本欠けても誰も気づかない」故障モードを持つ。

**なぜ選ばなかったか**: 本リポジトリのクエリは「祖先方向」をほぼ使わない
（パンくずは path の分解で足りる）。closure table の主な利点が活きず、
維持コストだけが残る。

### Option 4（D-2 の対抗案）: 親内一意 `@@unique([parentId, url])`

**メリット**: 「Electronics > Camera」と「Toys > Camera」を**両方 `camera` のまま置ける**。
将来の admin 入力で slug 衝突が原理的に起きない。

**デメリット（採用しなかった理由）**:
1. **既存 URL の解決規則そのものが変わる。** 現行 URL はフラット slug で届いており
   （C-6）、親内スコープでは「どの親配下の `camera` か」が決まらない。結局
   `?category=electronics/camera` への移行が必要になり、**D-4 の「URL の形を変えない」が崩れる**。
2. **C-3 が型エラーで落ちる。** `url @unique` を外すと `findUnique` が呼べず、
   [`product.ts:644,656`](../../../src/queries/product.ts) は書き換え必須になる。
   ここで `findFirst` へ落として黙らせると、**異なる親配下の同名 slug から任意の 1 件を拾う**
   ——404 ではなく静かに誤ったカテゴリの商品を返す——実装になる。
3. **C-4 は型エラーにすらならない。** `{ category: { url: value } }` はリレーションフィルタで
   一意性を要求しないため、**コンパイルは通ったまま home が誤ノードに一致し得る**。
   「壊れても気づけない」経路を新設することになる。
4. **ルート同士の重複を防げない。** `parentId = NULL` のルートでは PostgreSQL が
   NULL 同士を区別するため、`@@unique([parentId, url])` は `electronics` を 2 つ作ることを
   **止められない**。部分ユニークインデックス
   （`CREATE UNIQUE INDEX ... ON "Category"(url) WHERE "parentId" IS NULL`）か
   番兵ルートの追加が別途必要で、複雑性がさらに増える。

グローバル一意を維持する代わりに、衝突は D-2 の**リネーム規則 + エイリアス表**で処理する。
衝突は移行時の一度きりの有限集合であり、恒久的な解決規則の複雑化より安い。

---

## Consequences

### Positive

- **storefront の読み取りコードがほぼ無変更で済む。** `url @unique` が残るため C-3 の
  `findUnique` も C-4 のリレーションフィルタも**そのままコンパイルし、同じ意味で動く**。
  変わるのは「一致したノードの**サブツリー**で商品を絞る」部分だけ。
- **URL が壊れない。** リネーム対象以外の既存 URL は 1 件も変わらない（D-4）。
  リネームされた分もエイリアス表で 308 で拾える。
- **plan 014（カテゴリ別属性）の FK 先が単一になる。** 属性定義は `Category.id` を
  参照すればよく、「Category か SubCategory か」の分岐が消える。属性の継承は
  `path` の prefix で表現できる。
- `sortOrder` の追加で、`updatedAt desc`（C-5）という**編集するたびに並びが変わる**
  現行挙動が解消する。

### Negative

- **`path` / `depth` / `childCount` は非正規化であり、構造変更と同一 `$transaction` で
  更新しなければ腐る。** 更新経路を `upsertCategory` / `deleteCategory` に閉じ込め、
  整合性を検査する統合テストを必須とする。
- **移行が 3 フェーズに分かれ、期間中は二重 FK と新 FK が並走する**（Product の
  `categoryId` + `subCategoryId` → 単一 `categoryId`）。並走期間の dual-write が必要。
- slug に `/` を使えない制約が恒久化する（D-3 の前提）。
- リーフ強制が**アプリ層のみ**であり、DB 単体では担保されない（D-5）。
  直接 SQL でデータを入れる経路（シーダー）は自前で守る必要がある。

### Risks

- **エイリアス表の取りこぼし** → 移行後に旧 slug 全件で到達性を確認する E2E を
  完了条件に含める。
- **サブツリー prefix の誤ヒット** → 兄弟 slug 衝突ケース
  （`camera` / `camera-accessories`）を統合テストの必須シナリオにする。
- **`childCount` のドリフト** → `SELECT` による再計算と突き合わせる整合性テストを置く。

---

## Implementation

### 移行時に必ず実行する計測（件数を返すこと）

1) と 2) は移行 SQL を書く前に、3) は **A-6 の backfill 完了後**に実行する。

> **本番の `Product` が大きい場合、Phase A のマイグレーションを 1 トランザクションで
> 流さないこと。** `prisma migrate deploy` はファイル 1 本を 1 トランザクションで
> 適用するため、`Product` への索引作成と FK の検証スキャンが取ったロックが区間の
> 最後まで解放されず、商品の書き込みが止まる。ロックを最小化する別経路
> （`CREATE INDEX CONCURRENTLY` / FK は `NOT VALID` 追加 → 別手順で `VALIDATE`）は
> [`docs/migration/07-category-tree-phase-a-production.md`](../../migration/07-category-tree-phase-a-production.md)
> に手順化してある。**マイグレーションファイル自体は編集しない**（適用済みファイルの
> 改変禁止・空 DB / CI / 統合テストでは現行のままが正しい）。

```sql
-- 1) Category と SubCategory の slug 衝突件数（D-2 のリネーム規則が発火する件数）
SELECT count(*) FROM (
  SELECT url FROM "Category" INTERSECT SELECT url FROM "SubCategory"
) AS collisions;

-- 2) 衝突している slug の実体（リネーム対象の一覧）
SELECT c.url, c.id AS category_id, s.id AS sub_category_id, s."categoryId" AS sub_parent_id
FROM "Category" c JOIN "SubCategory" s ON s.url = c.url
ORDER BY c.url;

-- 3) 非リーフに紐づく Product 件数（D-5 の経過措置の規模 / plan 066 の STOP 条件）
--    移行後の商品ノードは A-6 のとおり subCategoryId 由来（categoryNodeId := subCategoryId）。
--    ゆえに数えるべきは「移行先ノードが子を持つ商品」であって、
--    旧 categoryId（Phase C で drop される列）が子を持つかではない。
--    A-6 の backfill 完了後、同じトランザクション内で実行する（backfill 前は
--    categoryNodeId が NULL のままで JOIN が 1 行も返さず、STOP 条件が空振りする）。
SELECT count(*) FROM "Product" p
JOIN "Category" c ON c.id = p."categoryNodeId"
WHERE c."childCount" > 0;
```

> **3 本目は旧 `categoryId` で数えないこと。** `EXISTS (SELECT 1 FROM "SubCategory" s
> WHERE s."categoryId" = p."categoryId")` と書くと「トップレベルのカテゴリが子を持つ商品」
> ＝ **ほぼ全商品**が返る。これは D-5 が言う「非リーフ紐づけ」ではない —— 移行後に
> リーフ強制が掛かるのは新 FK（`categoryNodeId`）の側であり、旧 `categoryId` の
> 非リーフ参照は Phase C の列 drop で自然に消える。この取り違えは STOP 条件
> （> 0 なら停止）を常時発火させ、計測を無意味にする。
>
> **`count(*)` で畳むこと。** 素の `INTERSECT` は衝突 slug の一覧を返すだけで
> 「何件か」を答えない。移行前の意思決定に必要なのは件数である。
>
> **ローカルのシードで 0 件でも規則は必須。** [`prisma/seed/constants/categories.ts`](../../../prisma/seed/constants/categories.ts)
> は `lux-women` / `lux-women-dresses` という**前置命名**を採っており、
> **偶然**衝突しない。シードが通ったことを「衝突が無い」証拠として扱わないこと。

### 決定論的・冪等なリネーム規則（D-2）

1. 衝突した組のうち、**SubCategory 由来の側**をリネームする（Category 由来は温存 =
   より上位の URL を守る）。
2. 新 slug は `${親slug}-${旧slug}`。それも衝突する場合は `-2`, `-3`, … と
   **最初の空き番号**を昇順で採る。
3. 処理順は `ORDER BY "createdAt" ASC, "id" ASC` に固定する（決定論性）。
4. エイリアス行は `(entityType, oldSlug)` で upsert する（冪等性 — 再実行しても同じ結果）。

### 段階移行（Product FK・D-1）

| Phase | 内容 | ロールバック |
|-------|------|-------------|
| **A** | `Category` に `parentId` / `path` / `depth` / `sortOrder` / `childCount` を追加。SubCategory 全行を Category の子として複製し、`CategorySlugAlias` を投入。`Product.categoryNodeId`（**nullable**）を追加し `subCategoryId` 由来の新 id で backfill | 新列・新テーブルを drop し、**`SubCategory` と同じ id を持つ複製 `Category` 行を削除**する（複製行は `SubCategory.id` を流用しているので id 一致で特定できる）。列 drop だけでは複製行が残り、旧読み取りにトップレベルのカテゴリとして現れ続ける |
| **B** | 読み取りを `categoryNodeId` + サブツリー prefix へ切替。書き込みは**新旧 dual-write** | 読み取りを旧列へ戻す |
| **C** | `categoryNodeId` を必須化 → `subCategoryId` / 旧 `categoryId` を drop → `categoryNodeId` を `categoryId` へ rename。`SubCategory` テーブル drop | **不可逆**。C の前に B での実測期間を設ける |

各 Phase は `bunx prisma migrate dev` で個別のマイグレーションにする
（`db push` 禁止・既存マイグレーションの編集禁止 —
[`.claude/steering/tech.md`](../../steering/tech.md)）。Phase ごとに
`bun run erd:generate` で ER 図を同一コミットで再生成する
（[`.claude/rules/03-data-model-diagram-sync.md`](../../../.claude/rules/03-data-model-diagram-sync.md)）。

**関連コミット**: 実装は後続プランで行う（本 ADR は spike の成果物）。

---

## Related

- 設計ドキュメント: [`docs/design/category-tree/design.md`](../../design/category-tree/design.md)
- 起票プラン: [`plans/013-spike-category-tree-n-level.md`](../../../plans/013-spike-category-tree-n-level.md)
- 背景: [`plans/direction/EXPANSION_BLUEPRINT.md`](../../../plans/direction/EXPANSION_BLUEPRINT.md) §3.2 / §3.3 / §4-①
- 消費する後続 spike: [plan 014（カテゴリ別属性）](../../../plans/014-spike-category-attributes-facets.md) /
  [plan 015（ファセット検索）](../../../plans/015-spike-faceted-search-and-browse.md)
- 関連 ADR: [ADR-004（統合テスト DB 戦略）](004-integration-test-db-strategy.md) — 移行の検証は testcontainers 上で行う
- 本番適用手順: [`docs/migration/07-category-tree-phase-a-production.md`](../../migration/07-category-tree-phase-a-production.md) — Phase A のロック最小化ロールアウト

---

## Notes

- **本 ADR が主張しないこと**: (1) ツリー UI（DnD エディタ）の設計 — D-6 のとおり本ラウンドの
  範囲外。(2) 参照タクソノミー 20 部門の実データ投入 — 後続実装プランの領分。
  (3) カテゴリ別属性の格納方式 — plan 014 の領分（本 ADR は FK 先を `Category.id` に
  一本化する前提だけを与える）。
- `deleteCategory` は現在**ハード delete**（[`category.ts:189`](../../../src/queries/category.ts)）で
  配下商品の付け替えガードが無く、FK 制約違反で失敗する挙動に依存している。ツリー化後は
  `onDelete: Restrict` の self-relation により**子を持つノードの削除も失敗する**ようになる。
  EXPANSION_BLUEPRINT §3.3 の「無効化 + 付け替え」方式への移行は後続実装プランで扱う。
