# Plan 066: カテゴリツリー Phase A — スキーマ拡張・SubCategory 統合・互換レイヤー投入

> **Executor instructions**: 本プランは **実行済み**（migration
> `20260831102943_category_tree_phase_a`。以降 [067](067-implement-category-tree-queries.md) →
> [068](068-implement-category-tree-admin-cutover.md) まで完了済み）。
> **以下は着手当時の記述であり、再実行の指示ではない**（履歴として残す）。
> 本番適用の手順は [`docs/migration/07-category-tree-phase-a-production.md`](../docs/migration/07-category-tree-phase-a-production.md) を参照。
> **実行時の実測値と、未達のまま残った Done criteria 1 件（逆移行の実行検証）は
> 「実施結果」節にまとめてある。**
>
> plan [013](013-spike-category-tree-n-level.md)
> （spike）が確定した設計の**実装 3 本のうち 1 本目**であり、
> [ADR-006](../docs/architecture/decisions/006-category-tree-representation.md) の
> **Phase A** に対応する。
>
> **着手前に必ず読むもの**（本プランは設計を再説明しない）:
> - [`docs/design/category-tree/design.md`](../docs/design/category-tree/design.md) §0（前提）/ §2-Q2（統合と slug）/ §4（migration SQL）
> - [ADR-006](../docs/architecture/decisions/006-category-tree-representation.md) の Decision D-1〜D-3
>
> **本プランは読み取り経路を一切切り替えない。** 既存の `categoryId` / `subCategoryId` は
> 生き続け、storefront の挙動は**変化しない**。読み替えは plan 067 の担当である。
> この境界を越えないこと —— Phase A が「既存挙動は無傷・ロールバックは新列 drop と
> 複製行の削除で閉じる」ことが、3 分割の唯一の意味だからである。
>
> **ただし「無変更」は自動では成立しない。** A-3 は SubCategory 全行を `Category` の
> **子行として複製**するため、`Category` を無条件に全件読む既存経路は、Phase A 適用後に
> 旧サブカテゴリを**トップレベルのカテゴリとして露出させてしまう**（件数も並びも変わる）。
> よって Phase A では、旧 `Category` 読み取りを **`parentId` が null の行に限定する**こと
> （`where: { parentId: null }`）。これは読み替えではなく**既存挙動の保存**であり、
> 067 の境界を越えない。複製行は `SubCategory` と**同じ id** を持つ（A-3）ので、
> ロールバック時もこの id 一致で複製行だけを特定・削除できる。
>
> **同期方針（Phase A は「一度きりの backfill」である）**: A-6 の backfill は移行時点の
> スナップショットにすぎず、Phase A の書き込み経路は `categoryNodeId` を**書かない**
> （`grep -rn categoryNodeId src/` が 0 件であることが、本プランが読み取り経路に
> 触れていないことの裏返しでもある）。よって 066 適用後に作成・カテゴリ変更された
> `Product`、および追加された `SubCategory` は**新旧参照がずれたまま蓄積する**。
> これは Phase A の欠陥ではなく設計上の帰結であり、
> **Phase B の読み取り切替の直前に再同期する**ことで閉じる。再同期 SQL と
> 「切替と同一トランザクションで行う」順序制約は plan
> [067](067-implement-category-tree-queries.md) の Done criteria に置いた
> （A-6 の UPDATE は冪等なのでそのまま再実行できる）。
>
> **Drift check（着手前に必ず実行）**:
>
> ```bash
> git diff --stat 257b7873 -- prisma/schema.prisma prisma/seed tests/integration/setup tests/e2e/seed
> git status --porcelain -- prisma/ tests/
> ```
>
> `prisma/schema.prisma` の `Category` / `SubCategory` / `Product` に構造変更が入っていれば
> STOP して報告する（design.md §0 の前提が崩れる）。

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED（マイグレーションとデータ移行を伴う。ただし既存列は温存するため可逆）
- **Depends on**: [013](013-spike-category-tree-n-level.md)（DONE）
- **Blocks**: [067](067-implement-category-tree-queries.md) / [068](068-implement-category-tree-admin-cutover.md)
- **Category**: direction（実装）
- **Planned at**: 2026-08-31, against HEAD `257b7873`（branch `dev`）
- **State**: DONE（2026-08-31。migration `20260831102943_category_tree_phase_a` を適用し、
  `tests/integration/category-tree-migration.test.ts` を新設）。
  **ただし Done criteria 1 件が未達** —— 逆移行は手順のみ整備で**実行検証なし**
  （「実施結果」節）。後続 [067](067-implement-category-tree-queries.md) /
  [068](068-implement-category-tree-admin-cutover.md) は完了済みで Phase C まで進んでいるため、
  この未達は「066 単体へのロールバック可能性が実測されていない」という限定的な残課題である

## Why this matters

現行カテゴリは固定 2 階層で、`SubCategory` は自身の子を持てない
（[`schema.prisma:42-73`](../prisma/schema.prisma)）。参照タクソノミー
（[EXPANSION_BLUEPRINT](direction/EXPANSION_BLUEPRINT.md) §3.2）が要求する 3〜4 階層を
載せられず、plan [014](014-spike-category-attributes-facets.md)（カテゴリ別属性）も
「属性は Category と SubCategory のどちらに付くのか」が決まらないため着手できない。

本プランは**構造だけを先に置く**。読み取りを切り替えないので storefront の見た目も挙動も
変わらないが、これ以降 014 の設計は `Category.id` 単一 FK を前提にできる。

## Current state（変更前）

design.md §0 の 0-1 / 0-2 / 0-3 / 0-12 を参照。要点のみ再掲:

- `Category.url` と `SubCategory.url` は**別テーブル上の別 `@unique`** ——
  同一 slug の共存は**現在合法**（[`schema.prisma:46,62`](../prisma/schema.prisma)）。
- `Product` は `categoryId` / `subCategoryId` を**両方必須**で持つ
  （[`schema.prisma:157-161`](../prisma/schema.prisma)）。
- シードは **3 系統**あり、カテゴリ形状を変えると 3 つとも同時に赤くなる:
  [`prisma/seed/`](../prisma/seed/) / [`tests/integration/setup/seed.ts`](../tests/integration/setup/seed.ts) /
  [`tests/e2e/seed/`](../tests/e2e/seed/)。

## Commands you will need

| 目的 | コマンド |
|---|---|
| 衝突の事前計測 | design.md §2-Q2-4 の `count(*)` クエリを `bunx prisma studio` か psql で実行 |
| マイグレーション | `bunx prisma migrate dev --name category_tree_phase_a`（**`db push` 禁止**） |
| Prisma クライアント再生成 | `bunx prisma generate` |
| ER 図の再生成 | `bun run erd:generate` |
| 型チェック / lint | `bunx tsc --noEmit` / `bun run lint` |
| ユニット | `bun run test` |
| 統合（Docker 必須） | `docker info` で疎通確認後 `bun run test:integration` |

## Scope

**In scope**:
- `prisma/schema.prisma`: `Category` へ `parentId` / `path` / `depth` / `sortOrder` /
  `childCount` を追加、`CategorySlugAlias` + `CategoryAliasSource` enum を新設、
  `Product.categoryNodeId`（**nullable**）を追加
- マイグレーション 1 本（`migrate dev`）+ データ移行 SQL（design.md §4 の A-1〜A-6）
- `docs/architecture/data-model.drawio` の再生成 + `scripts/erd/generate-erd.ts` の
  `PAGES` へ `CategorySlugAlias` を追記
- シード 3 系統をツリー形状へ更新
- 移行の冪等性（V-3）と `childCount` 整合（V-4）の統合テスト

**Out of scope**（越えないこと）:
- **読み取り経路の切り替え**（`src/queries/**` の変更）→ plan 067
- **admin / seller UI**・Zod スキーマの変更 → plan 067 / 068
- **旧列の削除**（`subCategoryId` / `SubCategory` テーブル）→ plan 068（Phase C）

## Steps

1. **事前計測（slug 衝突のみ）を先に走らせる**。design.md §2-Q2-4 の衝突計測クエリを
   実行し、結果を本プランの「実施結果」節に記録する。
   > **この時点で計測できるのは slug 衝突だけである。** 非リーフに紐づく商品の件数
   > （design.md Q3 が参照する計測）は `Product.categoryNodeId` を読むが、その列は
   > Step 3 のマイグレーションで**初めて追加**され Step 4 の A-6 で backfill される。
   > 移行前に走らせても `column does not exist` で落ちるため、Step 4 へ送る。
   > **シードで 0 件でも規則は実装する。** `bun run seed:luxury` は
   > `lux-women` / `lux-women-dresses` の**前置命名**で**偶然**衝突しない
   > （design.md 0-12）。シードが通ったことを衝突ゼロの証拠にしないこと。
2. **シード 3 系統を先に書き換える**。`SeedSubCategory` を廃し、`SeedCategory` に
   `parentUrl?` を持たせた単一の木にする。商品側は `categoryUrl`（リーフ）1 本。
   > **シードを最後に回さない。** 3 系統が同時に赤くなるため、スキーマを先に変えると
   > 以降の全ステップで「どのテストが本当に壊れたのか」が読めなくなる。
3. **スキーマを変更**し `bunx prisma migrate dev --name category_tree_phase_a`。
   目標形は design.md §3。**既存マイグレーションは編集しない**
   （[`tech.md`](../.claude/steering/tech.md) 禁止事項）。
4. **データ移行 SQL**（design.md §4 の A-1〜A-6）を同マイグレーションに含める。
   リネーム規則は §2-Q2-2 の 4 点（SubCategory 側をリネーム / `${親slug}-${旧slug}` /
   衝突時は最初の空き番号 / `ORDER BY createdAt ASC, id ASC` で決定論化）。
   **A-6 の backfill 完了直後に、非リーフに紐づく商品の件数を計測**し、Step 1 の
   衝突件数と同じ「実施結果」節に記録する（design.md Q3 が規模の事前把握を求めている
   計測。`childCount` は A-5 で初期化済みなのでこの時点で正しく読める）:

   ```sql
   -- 非リーフノードに紐づいたままの商品（Phase B の付け替え対象規模）
   SELECT count(*) FROM "Product" p
     JOIN "Category" c ON c.id = p."categoryNodeId"
    WHERE c."childCount" > 0;
   ```

5. **ER 図を再生成**: `scripts/erd/generate-erd.ts` の `PAGES` に `CategorySlugAlias` を
   追記 → `bun run erd:generate` → **stderr の orphan WARNING がゼロ**であることを確認
   （[`03-data-model-diagram-sync.md`](../.claude/rules/03-data-model-diagram-sync.md)）。
   スキーマ差分と `.drawio` 差分は**同一コミット**に入れる。
6. **統合テストを追加**（`tests/integration/category-tree-migration.test.ts`・新規）:
   - **V-3**: 移行スクリプトの 2 回実行で結果が同一（冪等性）
   - **V-4**: `childCount` が `SELECT count(*)` の再計算と一致
   - 衝突ケース: Category `camera` と SubCategory `camera` を投入した状態で移行を走らせ、
     SubCategory 側が `<親slug>-camera` にリネームされ、`CategorySlugAlias` に
     `(SUB_CATEGORY, "camera")` と `(CATEGORY, "camera")` の**2 行が共存**すること
     （キーを `oldSlug` 単体にしていたら引けない組み合わせ — design.md §2-Q2-3）
7. `bun run lint` / `bunx tsc --noEmit` / `bun run test` / `bun run test:integration`。
8. **docs 同期**: `spec-sync-after-test` skill を起動（テスト数が変わるため rule 02 の必須手順）。
   ダッシュボード再生成と統計同期は**テストコードとは別コミット**にする。
9. `plans/README.md` の 066 ステータス行を更新し、実施結果（衝突件数の実測値を含む）を記録する。

## 実施結果（2026-08-31 実行時の実測。証拠: [`plans/README.md`](README.md) の「066 の実行記録」/ コミット `0f0fa400`〜`868ccf82`）

### 事前計測（Step 1 / Step 4）

| 計測 | 実測値 | 取得方法・根拠 |
|------|--------|---------------|
| slug 衝突（`Category.url` ∩ `SubCategory.url`）— Step 1 | **0 件** | 実 DB（Neon dev）に対し `PrismaClient.$queryRaw` で実行（`psql` 未導入のため）。STOP 条件の 20 件を大きく下回る。シードでの代替ではない |
| 非リーフに紐づく `Product` — Step 4（A-6 直後） | **0 件** | A-6 は `subCategoryId` の列コピーなので `categoryNodeId` は必ず depth 1 の葉を指す。移行時計測でも「SubCategory を持たない `Category`」**0**・`categoryNodeId` 未 backfill **0**・`childCount` ドリフト **0** |
| 移行前の規模（参考） | Category **40** / SubCategory **58** / Product **105** | 同上 |
| 移行後の形状（参考） | ルート **40** / 子 **58** / alias **98** / リネーム **0** | 対応表は [`slug-migration-map.csv`](../docs/design/category-tree/slug-migration-map.csv)（衝突 0 のためヘッダ + 計測値のみ） |

いずれの STOP 条件にも該当しなかった。

### 未達の Done criteria

- **逆移行の実行検証は未実施**。手順は
  [`docs/migration/07-category-tree-phase-a-production.md`](../docs/migration/07-category-tree-phase-a-production.md) §4 と
  [design.md §4](../docs/design/category-tree/design.md) に整備済みだが、実 DB で走らせて
  `Category` 件数が移行前へ戻ることを確認した記録は残っていない。
  `tests/integration/category-tree-migration.test.ts` も順方向（A-1〜A-6）のみを覆っており、
  逆移行のケースを持たない。**Phase A の可逆性は「手順として用意されている」段階であり、
  「実行して検証済み」ではない**。

## Done criteria

ALL を満たすこと:

- [x] `bunx prisma migrate dev` が新規マイグレーション 1 本を生成し、
      `prisma/migrations/` に履歴が残っている（`db push` を使っていない）
      —— `prisma/migrations/20260831102943_category_tree_phase_a/`
- [x] `bun run erd:generate` の **stderr に orphan WARNING が 0 件**、
      `docs/architecture/data-model.drawio` がスキーマ変更と同一コミットに含まれる
      —— `0f0fa400` に `schema.prisma` / `generate-erd.ts` / `data-model.drawio` が同梱。
      2026-09-05 の再実行でも WARNING 0 件・`.drawio` の差分 0（決定論性も確認）
- [x] **既存挙動が無変更であることの実測**: `bun run test` と
      `bun run test:integration` の passed 数が、シード形状変更に伴う
      追随を除いて**移行前と同一**（storefront の読み取り経路を触っていないため）
      —— Jest 2026 → **2025**（シードのツリー統合に伴う置き換えで −1 / スイート 191 不変）、
      Integration 108 → **117** / 13 → **14 スイート**（本プランで追加した移行テスト分）
- [x] V-3（冪等性）/ V-4（`childCount` 整合）/ 衝突リネームの 3 シナリオが緑
      —— `tests/integration/category-tree-migration.test.ts`（`9fc80ce3`）
- [x] `bunx tsc --noEmit` 0 件 / `bun run lint` 0 errors
      （2026-09-05 の HEAD 実測でも tsc 0 件 / lint 0 errors・14 warnings）
- [x] `src/queries/**` の差分が **`src/queries/category.ts` のルート絞り込み
      （`where: { parentId: null }`）のみ**で、`src/components/**` の差分は **0 行**
      （`git diff --stat <base> -- src/components` が空 かつ
      `git diff --name-only <base> -- src/queries` が `src/queries/category.ts` のみ ——
      Phase A の境界）。この 1 箇所だけは**既存挙動の保存**であり、読み替え（plan 067）
      ではない: A-3 が複製した子行を除外しないと、既存の全件読み取りが旧サブカテゴリを
      トップレベルとして露出させてしまう（本プラン冒頭の注記）。
      **逸脱 1 点（オペレーター承認済み）**: 型の連鎖により `category.test.ts`（+4/−1）も
      同時に変わったため、実差分は `category.ts`（+17/−2）+ `category.test.ts` の 2 ファイル。
      `src/components/**` は 0 差分を維持（詳細は [`plans/README.md`](README.md) の実行記録）
- [x] 事前計測の実測値がプランの「実施結果」節に記録されている
      （Step 1 の slug 衝突件数 **と** Step 4 の A-6 直後に測る非リーフ紐づけ商品件数の 2 本）
      —— 上記「実施結果」節（衝突 **0 件** / 非リーフ紐づけ **0 件**）
- [ ] **逆移行が用意され、実行して検証済み** ⚠️ **未達**（手順のみ整備・実行検証なし。「実施結果」節参照）: 新列・新テーブルの drop に加えて、
      **`SubCategory` と同じ id を持つ複製 `Category` 行を削除**する
      （`DELETE FROM "Category" c USING "SubCategory" s WHERE c.id = s.id;`）。
      列を drop するだけでは複製行が残り、旧読み取りにトップレベルのカテゴリとして
      現れ続けるため、ロールバックが完了しない。実行後に `Category` の件数が
      移行前と一致することを確認する
- [x] `spec-sync-after-test` によるドキュメント同期コミットが存在する —— `868ccf82`

## STOP conditions

以下は improvise せず STOP して報告する:

- 事前計測で **slug 衝突が 20 件を超えた** —— リネームが大量に発生し、
  URL 互換の影響範囲が design.md の想定（「移行時の一度きりの有限集合」）を外れる。
  対応表の扱いを含めて判断を仰ぐ。
- 非リーフに紐づく既存 `Product` が存在する（design.md §2-Q2-4 の 3 本目が > 0）——
  Phase A では移行しない方針だが、件数によっては 068 のリーフ強制の経過措置設計が変わる。
- `SubCategory` に子テーブルや FK が本プラン起票後に追加されている。
- `docker info` が失敗し統合テストを実測できない → **BLOCKED として記録**し、
  Step 6 以降を保留する（他ステップは先行可）。

## Maintenance notes

- **Phase A は可逆である**。ロールバックは新列・新テーブルの drop **と、
  `SubCategory` と同じ id を持つ複製 `Category` 行の削除**で閉じる（drop だけでは
  複製行が残る）。既存の読み書きは無傷。この性質を壊す変更（旧列の drop・NOT NULL 化）を
  本プランに持ち込まないこと。
- `Product.categoryNodeId` を **nullable** にしているのは意図的。必須化は Phase C（068）。
- 移行 SQL の A-3 が `s.id` を新 Category 行の `id` として流用しているため、
  A-6 の backfill が**単純な列コピー**で済む（design.md §4 の注記）。
  この流用をやめると対応表を引く必要が生じ、移行が一段複雑になる。
