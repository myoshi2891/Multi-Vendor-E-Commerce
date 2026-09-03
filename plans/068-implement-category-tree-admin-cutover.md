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
>
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
   > **移行前の `url` は新しい slug 規則を満たさない可能性がある。** plan 066 の
   > 移行は既存 `url` を書き換えず温存する（`CategorySlugAlias` に旧 slug を記録する
   > だけ）ので、大文字・`_`・空白を含む既存 URL は
   > [`schemas.ts`](../src/lib/schemas.ts) の `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` を通らず、
   > **その行の編集（featured の切り替え等）ごと保存できない**。フォーム側で正準 slug へ
   > 正規化し、旧 `url` を alias として残す経路を本ステップに含めること
   > （既存マイグレーションは編集しない —— [`tech.md`](../.claude/steering/tech.md) 禁止事項）。
2. **商品フォームをツリー選択へ**。**子を持つノードは選択不可**にする（UI 側）。
3. **リーフ強制をサーバー側に実装**（V-5）。`upsertProduct` の `$transaction` 内で
   対象 Category 行を **`SELECT … FOR UPDATE` でロックしてから** `childCount === 0` を
   確認する。
   > **ロック無しの `childCount` 読みは TOCTOU である。** 「商品をリーフ L に紐づける」と
   > 「L の子を作る」が並行すると、前者は `childCount = 0` を読み、後者は L の子を
   > INSERT して `childCount` を 1 にする —— どちらも成功し、**非リーフに商品が
   > 紐づいた状態**が残る。DB CHECK では担保できない（下記）以上、行ロックによる
   > 直列化が唯一の砦である。本リポジトリの先例は `updateStoreStatus`（tx 内
   > `SELECT "status" … FOR UPDATE`）と `upsertReview` の集計。**検証は「カテゴリを新規設定した / 変更した」場合のみ**
   走らせる —— create は常に検証対象、update は送信された**リーフ FK（`subCategoryId`
   / Phase C 以降は `categoryNodeId`）または `categoryId` のいずれかが既存値と異なる**
   ときだけ検証する。**`categoryId` の一致だけを条件にしないこと** —— 移行期の商品は
   root（`categoryId`）とリーフ（`subCategoryId`）の二重 FK を持つため、同一 root 内で
   リーフだけを非リーフノードへ差し替える更新が**検証をすり抜ける**（V-5c）。
   カテゴリを一切変えない既存商品の更新（在庫・価格・説明の編集）は通す。移行時に強制付け替えをしていない以上、既存の非リーフ紐づけは経過措置として
   残っており、無条件検証にすると**それらの商品が一切編集できなくなる**（Step 8 の
   「既存の非リーフ紐づけが壊されていないこと」と正面から矛盾する）。
   > **DB CHECK では担保できない。** リーフ性は*他の行*に子があるかで決まる関係的な
   > 性質であり、CHECK は同一行の値しか参照できない（design.md §2-Q5）。
   > 「CHECK 制約で担保した」と書かないこと。UI の選択不可は**表示上の親切**であって
   > 強制ではない —— サーバー側の検証が本体である。
4. **深さ上限と循環を実装**（V-7 / V-7b）。`upsertCategory` で `parent.depth + 1 ≤ 4`
   を検証する（深さ上限は現行どおり維持）。**子を作る（または親を付け替える）際は、
   Step 3 と同じ親行を `SELECT … FOR UPDATE` でロックしてから**書き込むこと ——
   ロック対象が両経路で一致して初めて、Step 3 の `childCount` 検証と直列化される
   （別々の行を掴んだのでは競合が検出できない）。加えて **循環を作る再親子化を拒否**する:
   - **自己参照**: `parentId === id` を拒否する。
   - **子孫への再親子化**: 対象ノードの**子孫**を `parentId` に指定することを拒否する。
     判定は **`parent.path` が `` `${targetPath}/` `` で始まる場合のみ**とし、
     **区切り文字 `/` まで含めて前置一致**させる（`path` は末尾に区切りを付けない ——
     design.md §2-Q1 の `subtreeOf` と同じ形）。素の `startsWith(targetPath)` だと
     `electronics/camera` に対して**兄弟の** `electronics/camera-accessories` まで
     子孫と誤判定し、正当な再親子化を拒否してしまう。自己参照（`parent.path === targetPath`）は
     上の**自己参照ルールで別途拒否**するので、この条件には含めない（判定を 1 本に
     畳まず、2 つの拒否理由を分離したまま維持する）。
   > **深さ上限だけでは循環を防げない。** 自己参照や子孫への付け替えは、切り離された
   > 環の中で `depth` を再計算しても上限に触れないまま成立しうる（環はルートに到達しない）。
   > また循環が成立すると `path` 前置一致で回る**サブツリー走査が停止しない**ため、
   > これは表示上の不整合ではなく可用性の問題である。検証は既存の深さ検証と同じ
   > `$transaction` 内で、`parent` を読んだ直後に行う。
   >
   > **再親子化は対象ノードだけでは終わらない —— 全子孫の `path` / `depth` を
   > 同じ `$transaction` で書き換えること。** `path` は materialized path なので、
   > 親を替えたノードの `path` だけを更新すると**子孫の `path` が旧祖先を指したまま
   > 取り残される**。`subtreeOf`（前置一致）で回る検索・ファセット・admin ツリーは
   > すべて `path` を正とするため、子孫は移動先のサブツリー検索に出てこず、
   > 移動元のサブツリー検索には出続ける —— 「商品が消えた」という形でしか
   > 表面化しない静かな破損である。
   >
   > ```ts
   > // 旧サブツリーを 1 クエリで引き、prefix を置換して書き戻す
   > const descendants = await tx.category.findMany({
   >     where: { path: { startsWith: `${oldPath}/` } },
   >     select: { id: true, path: true },
   > });
   > for (const d of descendants) {
   >     const nextPath = `${newPath}/${d.path.slice(oldPath.length + 1)}`;
   >     await tx.category.update({
   >         where: { id: d.id },
   >         data: { path: nextPath, depth: nextPath.split("/").length - 1 },
   >     });
   > }
   > ```
   >
   > **深さ上限は「最深の子孫」で判定する。** `parent.depth + 1 <= 4` は移動する
   > ノード自身しか見ておらず、3 段の子を持つノードを深い親へ移すと**子孫が上限を
   > 突破する**。子孫の書き換え後に `max(depth) <= 4` を検証し、超えるなら
   > トランザクションごと拒否する（部分適用された `path` を残さない）。
   >
   > **`childCount` は旧親と新親の両方を再計算する。** 片側だけ増減させると
   > 「子がいないのに `childCount > 0`」になり、Step 3 のリーフ強制（`childCount === 0`）が
   > 誤判定して正当なリーフへの紐づけを拒否しはじめる。
5. **⚠️ ここから不可逆。オペレーター確認を取ること。**
   `bunx prisma migrate dev --name category_tree_phase_c` で
   `categoryNodeId` 必須化 → 旧 2 列 drop → `categoryId` へ rename → `SubCategory` drop。
6. **ER 図を再生成**（`bun run erd:generate`）—— `SubCategory` の消滅を反映し、
   orphan WARNING が 0 件であることを確認。スキーマ差分と同一コミットに入れる。
7. **`subCategory.ts` の互換 re-export を削除**し、`src/` から `SubCategory` 参照を一掃する。
8. **テスト**:
   - **V-7d（再親子化の子孫追随）**: 子・孫を持つノードを別の親へ移した後、
     **全子孫の `path` が新しい親を前置に持ち、`depth` が 1 段ずつ増えている**こと。
     加えて、移動前に子孫のリーフでヒットしていた `?category=<新親>` の商品検索が
     移動後もヒットし、`?category=<旧親>` ではヒットしなくなること（`path` の
     取り残しは検索結果でしか表面化しないため、DB の値だけでなく検索も検算する）。
     上限超過ケース（移動で子孫が `depth > 4` になる）は拒否され、
     **`path` が 1 行も書き換わっていない**ことも確認する。
   - **V-5**: 子を持つノードへの**新規紐づけ**が create / update **両方**で拒否される
     （update 側は「非リーフへカテゴリを変更する」ケース）
   - **V-5b**: 既存の非リーフ紐づけ商品を**カテゴリを変えずに**更新すると成功する
   - **V-5c（同一 root 内のリーフ差し替え）**: `categoryId` は既存値のまま、
     リーフ FK（`subCategoryId` / `categoryNodeId`）だけを**同じ root 配下の
     非リーフノード**へ変更する更新が拒否される（`categoryId` の一致だけを
     スキップ条件にすると通ってしまう経路の回帰ガード）
   - **V-5d（並行リーフ化）**: 「商品を L に紐づける」と「L の子を作る」を
     **同時にディスパッチ**しても、非リーフ紐づけが成立しないこと（統合テスト・
     実 DB）。Step 3 / Step 4 の `SELECT … FOR UPDATE` が同じ行を掴んでいることの
     検証であり、ロックを外すと赤になることを実測で確認する（`store-status.test.ts`
     の並行遷移シナリオと同じ形）。
   - **V-7**: `depth = 5` の作成が拒否される
   - **V-7b（自己参照）**: `parentId` に自分自身の `id` を指定した更新が拒否される
   - **V-7c（子孫への再親子化の拒否）**: 対象ノードの子孫を `parentId` に指定した更新が拒否され、
     **副作用が無い**こと（拒否後に対象ノードの `parentId` / `path` が変わっていない）
   - 既存の非リーフ紐づけ（経過措置）が**壊されていない**こと —— 移行時に強制付け替えを
     していないので、既存商品は読み取れ続ける
9. `bun run lint` / `bunx tsc --noEmit` / `bun run test` / 統合 / E2E 3 ブラウザ。
10. **docs 同期**: `spec-sync-after-test` skill。別コミット。
11. `plans/README.md` の 068 ステータス行を更新し、**カテゴリツリー 3 本の完了**を記録する。

## Done criteria

ALL を満たすこと:

- [ ] `grep -rn "subCategory" src/ -il` の結果が、**`?subCategory=` を受理する
      1 ファイル（browse のクエリーパラメーター解決点）を除いて 0 件**（互換レイヤーは一掃）。
      `?subCategory=` の受理は Out of scope のとおり**恒久要件**なので、参照ゼロにはできない。
      受理点は `CategorySlugAlias` を引いて `path` へ解決するだけの 1 箇所に閉じ込め、
      `SubCategory` **モデル**（Prisma の型・クエリ）への参照は 0 件であること —— こちらは
      `grep -rn "subCategory\." src/ | grep -v searchParams` で機械的に確認する
- [ ] `prisma/schema.prisma` に `model SubCategory` が存在しない。`Product.categoryId` が
      単一必須 FK
- [ ] `bun run erd:generate` の stderr に orphan WARNING が 0 件、`.drawio` が
      スキーマ変更と同一コミット
- [ ] V-5 / V-5b / V-5c（リーフ強制・create と update の両方、同一 root 内のリーフ差し替えを含む）/ V-7（深さ上限）/
      V-7b（自己参照）/ V-7c（子孫への再親子化の拒否）/ V-7d（再親子化の子孫追随）が緑
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
