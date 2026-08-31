# Plan 066: カテゴリツリー Phase A — スキーマ拡張・SubCategory 統合・互換レイヤー投入

> **Executor instructions**: 本プランは **未実行**。plan [013](013-spike-category-tree-n-level.md)
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
> この境界を越えないこと —— Phase A が「既存挙動は無傷・ロールバックは新列 drop のみ」で
> あることが、3 分割の唯一の意味だからである。
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
| 統合（Docker 必須） | `docker info` で疎通確認後 `bun run test -- tests/integration` |

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

1. **事前計測を先に走らせる**。design.md §2-Q2-4 の 3 本のクエリを実行し、
   結果を本プランの「実施結果」節に記録する。
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
7. `bun run lint` / `bunx tsc --noEmit` / `bun run test` / `bun run test -- tests/integration`。
8. **docs 同期**: `spec-sync-after-test` skill を起動（テスト数が変わるため rule 02 の必須手順）。
   ダッシュボード再生成と統計同期は**テストコードとは別コミット**にする。
9. `plans/README.md` の 066 ステータス行を更新し、実施結果（衝突件数の実測値を含む）を記録する。

## Done criteria

ALL を満たすこと:

- [ ] `bunx prisma migrate dev` が新規マイグレーション 1 本を生成し、
      `prisma/migrations/` に履歴が残っている（`db push` を使っていない）
- [ ] `bun run erd:generate` の **stderr に orphan WARNING が 0 件**、
      `docs/architecture/data-model.drawio` がスキーマ変更と同一コミットに含まれる
- [ ] **既存挙動が無変更であることの実測**: `bun run test` と
      `bun run test -- tests/integration` の passed 数が、シード形状変更に伴う
      追随を除いて**移行前と同一**（storefront の読み取り経路を触っていないため）
- [ ] V-3（冪等性）/ V-4（`childCount` 整合）/ 衝突リネームの 3 シナリオが緑
- [ ] `bunx tsc --noEmit` 0 件 / `bun run lint` 0 errors
- [ ] `src/queries/**` と `src/components/**` の差分が **0 行**
      （`git diff --stat <base> -- src/queries src/components` が空 —— Phase A の境界）
- [ ] 事前計測（Step 1）の実測値がプランの「実施結果」節に記録されている
- [ ] `spec-sync-after-test` によるドキュメント同期コミットが存在する

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

- **Phase A は可逆である**。ロールバックは新列・新テーブルの drop のみで、
  既存の読み書きは無傷。この性質を壊す変更（旧列の drop・NOT NULL 化）を
  本プランに持ち込まないこと。
- `Product.categoryNodeId` を **nullable** にしているのは意図的。必須化は Phase C（068）。
- 移行 SQL の A-3 が `s.id` を新 Category 行の `id` として流用しているため、
  A-6 の backfill が**単純な列コピー**で済む（design.md §4 の注記）。
  この流用をやめると対応表を引く必要が生じ、移行が一段複雑になる。
