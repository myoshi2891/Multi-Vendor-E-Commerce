# Plan 068: カテゴリツリー — admin UI 統合 + Phase C カットオーバー（**不可逆**）

> **Executor instructions**: 本プランは **未実行**。plan [013](013-spike-category-tree-n-level.md)
> が確定した設計の実装 3 本のうち **3 本目（最終）**で、
> [ADR-006](../docs/architecture/decisions/006-category-tree-representation.md) の
> **Phase C** を含む。
>
> **⚠️ Phase C（Step 5 以降）は不可逆である。** 旧 `subCategoryId` 列と `SubCategory`
> テーブルを drop するため、実行後は Phase B の状態へ戻れない。
> **Step 5 の前に、plan 067 の状態で本番相当の実測期間を置いたことをオペレーターに
> 確認すること。** 確認が取れないまま Step 5 へ進まない。
>
> **着手前に必ず読むもの**:
> - [`docs/design/category-tree/design.md`](../docs/design/category-tree/design.md)
>   §2-Q3（Phase 表）/ §2-Q5（リーフ強制）/ §2-Q6（admin UI と sortOrder）
>
> **Drift check（着手前に必ず実行）**:
> ```bash
> git diff --stat <067 の完了コミット> -- src/app/dashboard prisma/schema.prisma
> git status --porcelain -- src/ prisma/
> ```

## Status

- **Priority**: P2
- **Effort**: M–L
- **Risk**: **HIGH**（Phase C は不可逆。admin のルートを 1 本廃止する）
- **Depends on**: [067](067-implement-category-tree-queries.md)（**hard 依存**）
- **Category**: direction（実装）
- **Planned at**: 2026-08-31, against HEAD `257b7873`（branch `dev`）

## Why this matters

067 まででストアフロントはツリーで動くが、**管理者はまだ 2 階層のフォームしか持たない**
（`admin/categories` と `admin/subCategories` の別ルート — design.md 0-11）。
3 階層目のノードを作る手段が無いため、ツリーは**データ投入経路が塞がったまま**である。

また旧列が残っている限り、商品は `categoryId` + `subCategoryId` の二重 FK を書き続ける
必要があり（dual-write）、新規開発はどちらが正なのかを毎回判断させられる。
Phase C はその曖昧さを閉じる。

## Current state（変更前）

- admin は Category / SubCategory で**別ルート・別フォーム**（フラットテーブル）——
  [`admin/categories/`](../src/app/dashboard/admin/categories/) /
  [`admin/subCategories/`](../src/app/dashboard/admin/subCategories/)（design.md 0-11）
- 商品フォームはカテゴリ選択が **2 つの select**
  （[`forms/product-details.tsx`](../src/components/dashboard/forms/product-details.tsx)）
- `deleteCategory` は**ハード delete** で配下商品の付け替えガードが無く、
  FK 違反で失敗する挙動に依存（[`category.ts:189`](../src/queries/category.ts)・design.md 0-8）
- 067 時点で `Product.categoryNodeId` は nullable のまま、旧 2 列と dual-write

## Commands you will need

| 目的 | コマンド |
|---|---|
| マイグレーション | `bunx prisma migrate dev --name category_tree_phase_c`（**`db push` 禁止**） |
| ER 図再生成 | `bun run erd:generate` |
| 型 / lint | `bunx tsc --noEmit` / `bun run lint` |
| 統合（Docker 必須） | `bun run test -- tests/integration` |
| E2E | `bunx playwright test` |

## Scope

**In scope**:
- admin UI の統合: `admin/subCategories/*`（3 ファイル）を**廃止**し
  `admin/categories/*` へ統合（**親カラム + インデント表示**の 1 テーブル）
- `forms/category-details.tsx`: 親ノード選択・`sortOrder` の入力を追加。
  `forms/subCategory-details.tsx` は削除
- `forms/product-details.tsx`: 2 つの select → **ツリー選択 1 つ（リーフのみ選択可）**
- seller の商品ページ 4 件の追随
- **リーフ強制**（V-5）と**深さ上限**（V-7）の実装 —— `upsertProduct` の
  トランザクション内で `childCount === 0` を確認、`upsertCategory` で `depth ≤ 4` を検証
- **Phase C**: `categoryNodeId` 必須化 → 旧 `categoryId` / `subCategoryId` drop →
  `categoryNodeId` を `categoryId` へ rename → `SubCategory` テーブル drop →
  `bun run erd:generate`

**Out of scope**:
- **DnD ツリーエディタ**（design.md §2-Q6 で明示的に範囲外）
- 参照タクソノミー 20 部門の実データ投入（別プランで起票する）
- `deleteCategory` の「無効化 + 付け替え」化（design.md §6-4 —— 別プラン）
- `?subCategory=` の受理停止（067 の Maintenance notes のとおり恒久受理）

## Steps

1. **admin を統合**。`admin/categories/*` を親カラム + インデント表示の 1 テーブルにし、
   `admin/subCategories/*` を削除する。`forms/category-details.tsx` に親選択と
   `sortOrder` を追加。
2. **商品フォームをツリー選択へ**。**子を持つノードは選択不可**にする（UI 側）。
3. **リーフ強制をサーバー側に実装**（V-5）。`upsertProduct` の `$transaction` 内で
   `childCount === 0` を確認する。
   > **DB CHECK では担保できない。** リーフ性は*他の行*に子があるかで決まる関係的な
   > 性質であり、CHECK は同一行の値しか参照できない（design.md §2-Q5）。
   > 「CHECK 制約で担保した」と書かないこと。UI の選択不可は**表示上の親切**であって
   > 強制ではない —— サーバー側の検証が本体である。
4. **深さ上限を実装**（V-7）。`upsertCategory` で `parent.depth + 1 ≤ 4` を検証。
5. **⚠️ ここから不可逆。オペレーター確認を取ること。**
   `bunx prisma migrate dev --name category_tree_phase_c` で
   `categoryNodeId` 必須化 → 旧 2 列 drop → `categoryId` へ rename → `SubCategory` drop。
6. **ER 図を再生成**（`bun run erd:generate`）—— `SubCategory` の消滅を反映し、
   orphan WARNING が 0 件であることを確認。スキーマ差分と同一コミットに入れる。
7. **`subCategory.ts` の互換 re-export を削除**し、`src/` から `SubCategory` 参照を一掃する。
8. **テスト**:
   - **V-5**: 子を持つノードへの商品紐づけが create / update **両方**で拒否される
   - **V-7**: `depth = 5` の作成が拒否される
   - 既存の非リーフ紐づけ（経過措置）が**壊されていない**こと —— 移行時に強制付け替えを
     していないので、既存商品は読み取れ続ける
9. `bun run lint` / `bunx tsc --noEmit` / `bun run test` / 統合 / E2E 3 ブラウザ。
10. **docs 同期**: `spec-sync-after-test` skill。別コミット。
11. `plans/README.md` の 068 ステータス行を更新し、**カテゴリツリー 3 本の完了**を記録する。

## Done criteria

ALL を満たすこと:

- [ ] `grep -rn "subCategory" src/ -il` の結果が **0 件**（互換レイヤーも含め一掃）
- [ ] `prisma/schema.prisma` に `model SubCategory` が存在しない。`Product.categoryId` が
      単一必須 FK
- [ ] `bun run erd:generate` の stderr に orphan WARNING が 0 件、`.drawio` が
      スキーマ変更と同一コミット
- [ ] V-5（リーフ強制・create と update の両方）/ V-7（深さ上限）が緑
- [ ] 既存の非リーフ紐づけ商品が読み取れる回帰テストが緑（経過措置の確認）
- [ ] admin から **3 階層目のノードを作成できる** E2E が緑（ツリー化の実利用可能性）
- [ ] `bunx tsc --noEmit` 0 件 / `bun run lint` 0 errors / `bun run test` 緑
- [ ] E2E が 3 ブラウザで緑（flaky 0）
- [ ] `spec-sync-after-test` によるドキュメント同期コミットが存在する

## STOP conditions

- **Step 5 の前にオペレーター確認が取れない → STOP**（不可逆操作の承認は省略できない）。
- `Product.categoryNodeId` に **NULL が残っている**状態で必須化しようとした → STOP。
  066 の backfill か 067 の dual-write が漏れている。件数を計測して報告する。
- リーフ強制を入れたら**既存商品の更新が広範に落ちる** —— 非リーフ紐づけの経過措置が
  効いていない。「既存は保持・検証は create/update 時のみ」という設計
  （design.md §2-Q5）から実装が逸れている。
- DnD ツリーエディタを作りたくなった → STOP（範囲外。別プランで起票する）。
- `docker info` / `CLERK_SECRET_KEY` が無く実測できない → **BLOCKED として記録**。
  **Phase C は実測なしに進めないこと。**

## Maintenance notes

- 本プラン完了後、[plan 014](014-spike-category-attributes-facets.md)（カテゴリ別属性）は
  `AttributeDefinition.categoryId → Category.id` の単一 FK を前提にできる。
  属性の継承は `path` の prefix（067 の `subtreeOf`）でそのまま表現できるため、
  014 側に継承専用の構造は要らない（design.md §3）。
- ツリー化後の `deleteCategory` は `onDelete: Restrict` の self-relation により
  **子を持つノードの削除も失敗する**ようになる。EXPANSION_BLUEPRINT §3.3 の
  「無効化 + 付け替え」方式への移行は別プランで起票すること。
- `CategorySlugAlias` は Phase C 後も**残す**。旧 URL の到達性はこの表に依存しており、
  外部被リンクは消えない。
