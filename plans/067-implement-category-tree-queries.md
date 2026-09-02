# Plan 067: カテゴリツリー Phase B — 読み取りをサブツリー prefix へ切替（storefront）

> **Executor instructions**: 本プランは **未実行**。plan [013](013-spike-category-tree-n-level.md)
> が確定した設計の実装 3 本のうち **2 本目**で、
> [ADR-006](../docs/architecture/decisions/006-category-tree-representation.md) の
> **Phase B** に対応する。
>
> **着手前に必ず読むもの**:
> - [`docs/design/category-tree/design.md`](../docs/design/category-tree/design.md)
>   §0-A（slug 解決の 2 経路の非対称）/ §2-Q1（prefix 境界）/ §2-Q3（書き換え形）/ §2-Q4（URL 互換）
>
> **本プランは書き込みを dual-write に保つ。** 旧 `categoryId` / `subCategoryId` は
> 書き続け、旧列の削除は plan 068（Phase C・不可逆）の担当である。
> **admin / seller UI にも触れない**（068）。
>
> **Drift check（着手前に必ず実行）**:
>
> ```bash
> git diff --stat <066 の完了コミット> -- src/queries src/components/store "src/app/(store)" src/lib
> git status --porcelain -- src/
> ```
>
> `src/queries/product.ts` の browse フィルタが `findUnique({ where: { url } })` の形から
> 変わっていれば STOP して報告する（design.md §2-Q3 の書き換え形が前提を失う）。

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED（storefront の商品絞り込みという最頻経路を書き換える）
- **Depends on**: [066](066-implement-category-tree-schema.md)（**hard 依存** — `path` 列が無いと prefix 検索が書けない）
- **Blocks**: [068](068-implement-category-tree-admin-cutover.md)
- **Category**: direction（実装）
- **Planned at**: 2026-08-31, against HEAD `257b7873`（branch `dev`）

## Why this matters

066 が構造を置いても、読み取りが 2 階層のままでは 3 階層目以降の商品が
**どのフィルタにも掛からない**（`electronics > camera > lens` の商品が
`?category=electronics` で出てこない）。ツリーが利用者に見えるのは本プランからである。

同時に、本プランは URL 互換の実装点でもある。既存の被リンク・ブックマークは
`?subCategory=<slug>` の形で届いており（design.md 0-10）、ここを取りこぼすと
**SEO と既存導線を同時に落とす**。

## Current state（変更前）

design.md §0 の 0-4 / 0-5 / 0-6 / 0-7 を参照。本プランに直結する要点:

| 経路 | 実装 | 本プランでの扱い |
|------|------|-----------------|
| **A: `findUnique`** — [`product.ts:643-664`](../src/queries/product.ts) | `db.category.findUnique({ where: { url } })` | **書き換える**（サブツリー prefix へ） |
| **B: リレーションフィルタ** — [`home.ts:136-141`](../src/queries/home.ts) / [`size.ts:57-58`](../src/queries/size.ts) | `where: { category: { url: value } }` | **書き換え不要**。066 で `url @unique` を維持したため意味が変わらない |

> 経路 B が無変更で済むのが Q2-1（グローバル一意の維持）で得た最大の節約である
> （design.md §2-Q3 の注記）。**「ついでに」経路 B を触らないこと** —— 触ると
> 本プランの回帰面が不必要に広がる。

## Commands you will need

| 目的 | コマンド |
|---|---|
| 型 / lint | `bunx tsc --noEmit` / `bun run lint` |
| 対象ユニット | `bun run test -- src/queries/product.test.ts` / `src/queries/category.test.ts` / `src/queries/home.test.ts` |
| 統合（Docker 必須） | `bun run test -- tests/integration/product-browse.test.ts` |
| E2E（`CLERK_SECRET_KEY` 必要） | `bunx playwright test tests/e2e/search-filter.spec.ts` |

## Scope

**In scope**:
- `src/queries/`: `product.ts`（browse フィルタ）/ `category.ts`（`getAllCategories` の
  ツリー組み立て・並び順）/ `subCategory.ts`（`category.ts` へ吸収し薄い互換 re-export）/
  `dashboard.ts`（2 系統カウント → depth 別集計）
- `src/lib/`: `types.ts`（`CategoryNode` 系の型）/ `schemas.ts`（slug の文字集合制約追加）
- storefront UI 12 件: 2 段固定の `category.subCategories` 描画を**再帰コンポーネント**へ。
  リンク生成を `?category=<slug>` に一本化
- ルーティング 4 件: `?subCategory=` を受理し正準 `?category=` へ **308**、
  `CategorySlugAlias` 経由の解決
- **書き込みは dual-write**（新 `categoryNodeId` と旧 2 列の両方を更新）

**Out of scope**:
- `home.ts` / `size.ts` の経路 B（上記のとおり意味が変わらない）
- admin / seller UI・商品フォーム → plan 068
- 旧列の削除・`SubCategory` テーブル drop → plan 068（Phase C）

## Steps

1. **`subtreeOf` ヘルパーを 1 箇所に置く**（`src/lib/` 配下）。

   ```ts
   export const subtreeOf = (path: string) =>
       ({ OR: [{ path }, { path: { startsWith: `${path}/` } }] }) as const;
   ```

   > **prefix 境界を各呼び出し側で書かないこと。** 素の `startsWith(p)` は
   > `electronics/camera` が `electronics/camera-accessories` を拾う。境界の定義が
   > 複数箇所に散ると、1 箇所直しても他が誤ヒットしたままになる。
2. **slug の文字集合制約を Zod に追加**（`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`）。
   これは Step 1 の前提 —— `/` と `LIKE` メタ文字（`%` `_`）を slug から排除することで
   エスケープ処理を不要にしている（design.md §2-Q1）。**この制約を緩めないこと**。
3. **browse フィルタを書き換える**（design.md §2-Q3 の After 形）。
   `?category=` / `?subCategory=` の両方を受理し、どちらも外れたら **0 件を返す**。
   **解決順序は entityType で非対称にすること**:
   - `?category=` → `Category.url` 完全一致 → `CategorySlugAlias` の `(CATEGORY, slug)`。
     ルートの正準 slug は移行で温存されているので url が先で良い。
   - `?subCategory=` → `CategorySlugAlias` の `(SUB_CATEGORY, slug)` **完全一致が先**、
     その後に `Category.url`。
   > **旧サブカテゴリ slug は他ノードの正準 slug になっている可能性がある。** 移行 A-3 は
   > 衝突組の SubCategory 側をリネームして上位 URL を温存する（`prisma/migrations/
   > 20260831102943_category_tree_phase_a`）ので、旧 slug `camera` が別ノードの現 `url`
   > として生き残る。url を先に引くと**無関係なノードへ着地する**。
   > **fail-closed を維持すること。** 現行実装は不一致時に `noMatchResult` を返す
   > （[`product.ts:618-627`](../src/queries/product.ts)）。フィルタを黙って捨てる実装に
   > 戻すと「該当なし」が「全カタログ表示」に化ける。
4. **`getAllCategories` をツリー組み立てへ**。`[{ depth: asc }, { sortOrder: asc },
   { name: asc }]` の 1 クエリでフラットに引き、`path` でネストを復元する
   （再帰クエリ不要）。現行の `updatedAt desc`（= 編集のたびに並びが変わる）を置き換える。
5. **storefront UI を再帰描画へ**。`categories-menu.tsx` / `category-filter.tsx` /
   `footer/links.tsx` / `category-card.tsx` の 2 段固定を、深さに依らないコンポーネントにする。
6. **308 リダイレクトを実装**（`/browse`）。`?subCategory=` は**恒久的に受理し続ける**
   （外部被リンクを切らないため）が、正準 URL へ 308 で寄せる。
7. **テストを追加**:
   - **V-1**（統合・`product-browse.test.ts`）: `subtreeOf("electronics/camera")` が
     `electronics/camera-accessories` を**含まない**
   - **V-6**（統合）: 存在しない slug で 0 件（全件表示に化けない）
   - **V-2**（E2E・`search-filter.spec.ts`）: 旧 URL `?subCategory=<旧slug>` が 308 で
     正準ノードへ着地する（**066 でリネームされた slug を含む**）
   - 3 階層目の商品が祖先カテゴリのフィルタでヒットする（ツリー化の本題）
8. `bun run lint` / `bunx tsc --noEmit` / `bun run test` / 統合 / E2E。
9. **docs 同期**: `spec-sync-after-test` skill（テスト数が変わる）。別コミット。
10. `plans/README.md` の 067 ステータス行を更新。

## Done criteria

ALL を満たすこと:

- [x] V-1（兄弟 prefix 誤ヒットしない）/ V-2（旧 URL 308 到達性）/ V-6（fail-closed）が緑
- [x] 3 階層目の商品が祖先カテゴリのフィルタでヒットする統合テストが緑
- [x] **`grep -rn "startsWith" src/lib src/queries src/components | grep path` の結果が
      `src/lib` の `subtreeOf` 定義 1 箇所のみ**（prefix 境界が散っていないことの機械的確認）
      —— Step 1 でヘルパーを `src/lib/` に置くため、検索対象に `src/lib` を含めないと
      定義そのものを取りこぼし、「0 件」を誤って合格と読んでしまう
- [x] `home.ts` / `size.ts` の差分が **0 行**（経路 B に触っていないこと）
- [x] `src/app/dashboard/**` の差分が **0 行**（068 の領分に踏み込んでいないこと）
- [x] 書き込み経路が dual-write であること —— 商品作成後に旧 `subCategoryId` と
      新 `categoryNodeId` の両方が埋まる統合テストが緑
- [x] **読み取り切替の前に、未同期の `Product` / `SubCategory` を再同期していること。**
      066 の backfill は一度きりで、Phase A の書き込み経路は `categoryNodeId` を
      **一切書かない**（`grep -rn categoryNodeId src/` が 0 件）。したがって 066 適用後に
      作成・カテゴリ変更された商品は `categoryNodeId` が NULL / 旧値のまま残る。
      dual-write を有効化する変更と**同一トランザクション**で以下を実行し、
      再同期 → 切替の順序が逆転しないことを保証する:
      **新規行の追加だけでは足りない。** 066 適用後には「SubCategory の rename」
      「親 Category の付け替え」「`featured` 等の表示属性の変更」も起きており、
      `WHERE NOT EXISTS` の INSERT はそれらを**一切拾わない**。stale な `path` を
      残したまま読み取りを切り替えると、その枝の商品が祖先フィルタから静かに落ちる
      （`path` は全サブツリー検索の prefix キーであるため）。したがって再同期は
      **A-3 と同じ規則で新規行と既存行の双方に適用する**:
      ```sql
      BEGIN;
      -- 066 の A-3 と同一の規則（衝突回避・属性同期）を新規行と既存行の双方へ適用する。
      DO $$
      DECLARE
          r      RECORD;
          v_url  TEXT;
          v_base TEXT;
          v_n    INT;
      BEGIN
          FOR r IN
              SELECT s.id, s.name, s.image, s.url, s.featured, s."categoryId",
                     s."createdAt", s."updatedAt",
                     p.url AS parent_url, p.path AS parent_path
              FROM "SubCategory" s JOIN "Category" p ON p.id = s."categoryId"
              ORDER BY s."createdAt" ASC, s.id ASC   -- A-3 と同じ決定論性
          LOOP
              -- slug 候補の決定。既存行の再計算では**自分自身を衝突相手から除く**。
              IF NOT EXISTS (SELECT 1 FROM "Category" c
                              WHERE c.url = r.url AND c.id <> r.id) THEN
                  v_url := r.url;
              ELSE
                  v_base := r.parent_url || '-' || r.url;
                  v_url  := v_base;
                  v_n    := 1;
                  WHILE EXISTS (SELECT 1 FROM "Category" c
                                 WHERE c.url = v_url AND c.id <> r.id) LOOP
                      v_n   := v_n + 1;
                      v_url := v_base || '-' || v_n;
                  END LOOP;
              END IF;
              INSERT INTO "Category" (id, name, image, url, featured, "parentId",
                                      path, depth, "sortOrder", "childCount",
                                      "createdAt", "updatedAt")
              VALUES (r.id, r.name, r.image, v_url, r.featured, r."categoryId",
                      r.parent_path || '/' || v_url, 1, 0, 0,
                      r."createdAt", r."updatedAt")
              -- 既存行は rename / 親付け替え / 表示属性の変更を追随させる。
              -- sortOrder と childCount は Category 側が正なので上書きしない。
              ON CONFLICT (id) DO UPDATE SET
                  name        = EXCLUDED.name,
                  image       = EXCLUDED.image,
                  url         = EXCLUDED.url,
                  featured    = EXCLUDED.featured,
                  "parentId"  = EXCLUDED."parentId",
                  path        = EXCLUDED.path,     -- 親変更・rename の両方を反映
                  depth       = EXCLUDED.depth,
                  "updatedAt" = EXCLUDED."updatedAt";
          END LOOP;
      END
      $$;
      -- A-4 と同一の冪等エイリアス投入。rename 後も**旧 slug の行は消さない**ので
      -- 旧 URL の 308 到達性（V-2）が保たれる。
      INSERT INTO "CategorySlugAlias" ("entityType", "oldSlug", "categoryId")
      SELECT 'SUB_CATEGORY', s.url, s.id FROM "SubCategory" s
      ON CONFLICT ("entityType", "oldSlug") DO UPDATE SET "categoryId" = EXCLUDED."categoryId";
      INSERT INTO "CategorySlugAlias" ("entityType", "oldSlug", "categoryId")
      SELECT 'CATEGORY', c.url, c.id FROM "Category" c WHERE c."parentId" IS NULL
      ON CONFLICT ("entityType", "oldSlug") DO UPDATE SET "categoryId" = EXCLUDED."categoryId";
      -- A-5 と同一（親付け替えで両側の childCount が動くため全件再計算する）
      UPDATE "Category" p
      SET "childCount" = (SELECT count(*) FROM "Category" ch WHERE ch."parentId" = p.id);
      -- 066 の A-6 と同一の冪等 UPDATE
      UPDATE "Product" SET "categoryNodeId" = "subCategoryId"
      WHERE "categoryNodeId" IS DISTINCT FROM "subCategoryId";
      COMMIT;
      ```
      再同期の検証は**新規行だけで合格にしない** —— rename / 親付け替え /
      `featured` 変更を 066 適用後に起こした既存行が、それぞれ `url` / `path` /
      `featured` に反映されることを確認する。
- [x] 再同期後に `SELECT count(*) FROM "Product" WHERE "categoryNodeId" IS NULL` が **0** であることを確認した
- [x] `bunx tsc --noEmit` 0 件 / `bun run lint` 0 errors / `bun run test` 緑
- [x] E2E が 3 ブラウザで緑（flaky 0）
- [x] `spec-sync-after-test` によるドキュメント同期コミットが存在する

## STOP conditions

- **`findFirst` へ落として型エラーを黙らせたくなった場合は STOP。**
  066 は `url @unique` を維持しているので `findUnique` は通るはずである。
  通らないなら 066 の実装が設計から逸れている（design.md §0-A / ADR-006 Option 4）。
- 旧 URL の到達性テスト（V-2）が、`CategorySlugAlias` に行があるのに失敗する ——
  対応表のキー設計（`(entityType, oldSlug)`）が実装で崩れている可能性がある。
- `?subCategory=` を**削除したくなった場合は STOP**。恒久的に受理する決定である
  （design.md §2-Q4）。
- E2E に `CLERK_SECRET_KEY` が無い / Docker が使えない → **BLOCKED として記録**し、
  実測できなかったレイヤーを明記する（推測で緑と書かない）。

## Maintenance notes

- Phase B は**読み取りを戻せば元に戻る**。旧列が生きているうちに本番相当で実測期間を
  取ること —— Phase C（068）は不可逆であり、戻れる最後の地点が本プランである。
- `?subCategory=` の受理は恒久。将来「もう誰も使っていない」と判断する場合も、
  アクセスログでの実測を根拠にすること（削除は別プランで起票する）。
