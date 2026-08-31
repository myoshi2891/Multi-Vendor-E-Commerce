# Plan 069: カテゴリ別属性スキーマの実装（属性定義 CRUD + 動的フォーム + パイロット部門シード）

> **Executor instructions**: 本プランは **未実行**。plan [014](014-spike-category-attributes-facets.md)
> （spike）が確定した設計の実装であり、**1 本で完結する**
> （影響ファイルは新規約 13 + 既存 7 = **約 20**。plan 013 の 82 とは桁が違うため
> 分割していない —— 判断根拠は [`design.md`](../docs/design/category-attributes/design.md) §1）。
>
> **着手前に必ず読むもの**（本プランは設計を再説明しない）:
> - [`docs/design/category-attributes/design.md`](../docs/design/category-attributes/design.md)
>   §0（前提）/ §2（全 7 問の決定）/ §3（目標スキーマ・継承）/ §5（検証シナリオ A-1〜A-8）
> - [ADR-007](../docs/architecture/decisions/007-attribute-storage.md) の Decision D-1〜D-4
>
> **カテゴリツリー（066–068）との関係**: 属性定義は `Category.id` に紐づき、継承は
> ADR-006 の `path` prefix で表現する。**066 が未完了でも本プランは着手できる**が、
> その場合 §3 の継承（祖先パス集合）は使えないため、**属性は選択されたカテゴリノードに
> 直接紐づくものだけが効く**。この縮退を Step 0 で明示的に記録すること
> （黙って「継承を実装した」と書かない）。
>
> **Drift check（着手前に必ず実行）**:
>
> ```bash
> git diff --stat 1130aa4d -- prisma/schema.prisma src/lib/schemas.ts src/queries/product.ts src/components/dashboard/forms/product-details.tsx
> git status --porcelain -- src/ prisma/
> ```
>
> `Spec` モデルが型付き・カテゴリ紐づけへ改修されていたら STOP（design.md §0 の前提が消滅）。

## Status

- **Priority**: P2
- **Effort**: M–L
- **Risk**: MED（商品フォームという販売者の主要導線を動的化する。既存 `Spec` は温存するため可逆性は高い）
- **Depends on**: [014](014-spike-category-attributes-facets.md)（DONE）
- **Soft depends on**: [066](066-implement-category-tree-schema.md)（継承を使う場合のみ。未完了でも着手可 —— 上記の縮退条件）
- **Blocks**: [plan 015](015-spike-faceted-search-and-browse.md) の後続実装（ファセット検索）
- **Category**: direction（実装）
- **Planned at**: 2026-08-31, against HEAD `1130aa4d`（branch `dev`）

## Why this matters

現行の属性は自由記述の `Spec` のみで、**数値比較も許容値の統制もできない**
（design.md 0-1 / 0-3）。実データでは既に数値が文字列へ埋め込まれ
（`"28g (45cm) / 32g (50cm)"` — 0-B）、`Size.size` が汎用軸として濫用されている
（`"90cm x 90cm"` — 0-C）。本プランはその置き場所を作る。

ファセット検索（plan 015）はこの構造の上にしか立たない。また
EXPANSION_BLUEPRINT §3.2 の部門 8/9/17（ヘルスケア・食品・ベビー）では
**必須属性がコンプライアンス要件**であり、UX の話ではない。

## Current state（変更前）

design.md §0 の 0-1〜0-9 と 0-A〜0-E を参照。本プランに直結する要点:

- `Spec` の排他性は DB で強制されておらず、**`createMany` の直書き経路が既に 2 つある**
  （[`product.ts:350-356`](../src/queries/product.ts) / [`product.ts:460-466`](../src/queries/product.ts)）
- `ProductFormSchema` の消費点は
  [`product-details.tsx:177,179`](../src/components/dashboard/forms/product-details.tsx) の **2 箇所のみ**
- 既存 admin CRUD 1 エンティティの構成は `page.tsx` / `columns.tsx` / `new/page.tsx` +
  `forms/*-details.tsx` + `queries/*.ts` + テスト（`admin/offer-tags/` が雛形）

## Commands you will need

| 目的 | コマンド |
|---|---|
| マイグレーション | `bunx prisma migrate dev --name category_attributes`（**`db push` 禁止**） |
| Prisma クライアント再生成 | `bunx prisma generate` |
| ER 図の再生成 | `bun run erd:generate` |
| 型 / lint | `bunx tsc --noEmit` / `bun run lint` |
| ユニット | `bun run test -- src/queries/attribute.test.ts` / `src/lib/schemas.test.ts` |
| 統合（Docker 必須） | `docker info` 後 `bun run test -- tests/integration/category-attributes.test.ts` |
| 実 DB 計測（Step 1） | `psql "$DIRECT_URL" -c '...'`（**`$DATABASE_URL` は不可** —— Accelerate の `prisma://`） |

## Scope

**In scope**:
- スキーマ: `AttributeDefinition` / `AttributeOption` / `ProductAttributeValue` /
  `VariantAttributeValue` + `AttributeType` / `AttributeScope` enum（design.md §3）
- マイグレーション 1 本 + `bun run erd:generate`
- 属性定義 CRUD（`src/queries/attribute.ts`・**`requireAdmin`** で保護）
- 許容値管理 UI（`AttributeOption` の CRUD — design.md Q6）
- 動的 Zod（`src/lib/attribute-schema.ts` の `makeProductSchema(defs)`）+
  [`product-details.tsx:179`](../src/components/dashboard/forms/product-details.tsx) の resolver 差し替え
- 商品詳細の 2 セクション表示（「仕様」= 構造化属性 /「その他仕様」= `Spec`）
- パイロット部門 **2〜3 部門**の属性定義シード（design.md §4 の家電・ファッション・食品）
- 検証シナリオ A-1〜A-8 のテスト

**Out of scope**（越えないこと）:
- **`Spec` の廃止・一括移行** —— design.md Q3 で**温存**と決定済み。0-B により機械変換は不可能
- **ファセット検索の実装** —— plan 015 の領分。本プランは `facetable` フラグと
  集計可能な構造を用意するところまで
- 20 部門の属性シード網羅（パイロット後は運用タスク）
- カテゴリツリーの実装（066–068）

## Steps

0. **前提の記録**。066 の完了状況を確認し、継承（design.md §3 の祖先パス集合）を
   実装できるか判断する。できない場合は**縮退した旨をプランの実施結果に明記**する。
1. **実 DB で 3 本の計測を先に走らせる**（`$DIRECT_URL` 経由）。結果を実施結果に記録する:

   ```sql
   SELECT name, COUNT(*) FROM "Spec" GROUP BY name ORDER BY 2 DESC LIMIT 50;   -- 表記揺れの実測
   SELECT count(*) FROM "Spec" WHERE "productId" IS NOT NULL AND "variantId" IS NOT NULL;  -- 不正: 両方
   SELECT count(*) FROM "Spec" WHERE "productId" IS NULL AND "variantId" IS NULL;          -- 不正: 孤児
   ```

   > **design.md 0-D の BLOCKED を解消する機会である。** spike ではシード実測しか
   > できなかった（`psql` 未インストール）。シードは表記揺れを示さないが、
   > **それは揺れが無い証拠ではない**。本番/開発 DB の実測値を必ず記録すること。
   > 不正行の件数が 0 でも、**扱いを決めてから**移行を書く（黙って落とすのは不可）。
2. **スキーマ + マイグレーション**。design.md §3 / ADR-007 の Decision 節どおり。
   `bunx prisma migrate dev --name category_attributes`。**既存マイグレーションは編集しない**。
3. **ER 図を再生成**。`scripts/erd/generate-erd.ts` の `PAGES` に新 4 モデルを追記 →
   `bun run erd:generate` → **stderr の orphan WARNING が 0 件**であることを確認
   （[`03-data-model-diagram-sync.md`](../.claude/rules/03-data-model-diagram-sync.md)）。
   スキーマ差分と `.drawio` 差分は**同一コミット**に入れる。
4. **属性値の読み書きヘルパーを 1 箇所に作る**（`src/lib/attribute-value.ts` 等）。
   `AttributeType` による判別で `valueText` / `valueNumber` / `valueBool` / `optionId` の
   どれを使うかを決める。
   > **散らさないこと。** ADR-007 の Risks が挙げるとおり、`type` と実際に埋まった列の
   > 不整合は**書き込みが複数箇所にあると検出できなくなる**。0-A で見たように、
   > 本リポジトリでは「規律で守る」が既に 4 経路へ広がった前例がある。
5. **属性定義 CRUD**（`src/queries/attribute.ts`）。認可は
   [`src/lib/auth-guards.ts`](../src/lib/auth-guards.ts) の **`requireAdmin`** を使う
   （インライン展開は禁止 — [`tech.md`](../.claude/steering/tech.md)）。
   外部呼び出しは `try/catch` + 構造化ログ 2 引数形式。
6. **admin UI**。`admin/attributes/{page,columns,new/page}.tsx` +
   `forms/attribute-details.tsx`。既存 `admin/offer-tags/` の TanStack table パターンを再利用。
   許容値管理は `admin/attributes/[id]/options/`。
7. **動的 Zod + 商品フォーム**。`makeProductSchema(defs)` は
   **`ProductFormSchema.extend()`** で合成する（`z.intersection` は使わない ——
   RHF のエラーパスが二重になる。design.md Q4）。
   `product-details.tsx` はカテゴリ選択の変更で `defs` を再取得し `useMemo` で再生成。
   > **`any` を通さないこと。** `buildAttributeShape` は `AttributeType` の判別で
   > `z.string()` / `z.coerce.number()` / `z.boolean()` / `z.enum([...])` を返す。
   > [`click-to-add.tsx`](../src/components/dashboard/forms/click-to-add.tsx) の
   > `Detail<T>`（インデックスシグネチャの緩い型）は**流用しない**。

   **属性値の保存契約（スキーマ生成だけでは往復が閉じない）**。動的スキーマを足しただけでは
   入力値は DB に届かない。`attributes` を**フォームから読み取りまで一本の経路**として通すこと:
   - `product-details.tsx` の `useForm<z.infer<typeof schema>>` と submit ハンドラの引数型を
     `makeProductSchema(defs)` の**戻り値から導出**する（`ProductFormSchema` 固定のままにしない）。
     `defs` の再取得で型が変わるので、`z.infer<ReturnType<typeof makeProductSchema>>` を基準にする。
   - `upsertProduct` の payload に `attributes: { definitionId, value }[]` を追加し、
     保存 `$transaction` 内で `ProductAttributeValue` / `VariantAttributeValue` を
     `@@unique([productId, definitionId])` に対する upsert + 送信されなかった定義の delete で
     同期する（部分更新でゴースト値が残らないこと）。
   - 読み取り DTO（商品編集フォームの初期値と `product-specs.tsx`）にも `attributes` を載せ、
     **保存直後に同じ値が再読込できる**状態にする。
   - Step 11 に**往復テスト**を足す: 属性値を入力 → 保存 → 再読込して同値、
     値を空にして保存 → 行が消える、の 2 本。型別カラム（`valueText` / `valueNumber` /
     `valueBool` / `optionId`）のどれに入ったかも A-1 と同じ基準で検証する。
8. **商品詳細の 2 セクション表示**
   （[`product-specs.tsx`](../src/components/store/product-page/product-specs.tsx)）。
   「仕様」= 構造化属性 /「その他仕様」= `Spec`。
9. **多値属性の扱いを決める**（design.md §4 の未決事項）。`allergens` のような複数値は
   `@@unique([productId, definitionId])` と衝突する。制約を
   `@@unique([productId, definitionId, optionId])` へ緩めるか、
   `multiValued Boolean` を定義側に持たせるかを選び、**決定を design.md へ追記する**。
   > **これは spike の見落としではなく、明示的に 069 へ送られた未決事項である**
   > （design.md §6-4）。勝手に単値前提で進めて食品部門で詰まらないこと。
10. **パイロット部門シード**（2〜3 部門）。`@@unique([definitionId, value])` で upsert し
    **冪等**にする。
11. **テスト**（design.md §5 の A-1〜A-8）。特に:
    - **A-1**: `type` と埋まった列の一致（Step 4 のヘルパー集約の実効性）
    - **A-3**: 必須属性欠落で create / update **両方**が拒否される
    - **A-4**: `AttributeOption.label` の改名が既存商品の表示に自動追随する
    - **A-7**: `TEXT → NUMBER` の型変更で変換不能値が `valueText` に残り **NULL 化されない**
    - **A-8**: `Spec` の読み書きが壊れていない（温存の回帰ガード）
12. `bun run lint` / `bunx tsc --noEmit` / `bun run test` / 統合。
13. **docs 同期**: `spec-sync-after-test` skill（テスト数が変わる）。**別コミット**。
14. `plans/README.md` の 069 ステータス行を更新し、Step 1 の実測値と Step 9 の決定を記録する。

## Done criteria

ALL を満たすこと:

- [ ] `bunx prisma migrate dev` が新規マイグレーション 1 本を生成（`db push` 未使用）
- [ ] `bun run erd:generate` の **stderr に orphan WARNING が 0 件**、`.drawio` が
      スキーマ変更と同一コミット
- [ ] 検証シナリオ **A-1〜A-8 がすべて緑**
- [ ] **`grep -rn "valueNumber\|valueText\|valueBool" src/ | grep -v attribute-value | grep -v test`
      の結果が 0 件**（Step 4 のヘルパー集約が守られていることの機械的確認）
- [ ] **`bunx eslint src/lib/attribute-schema.ts src/queries/attribute.ts --rule '{"@typescript-eslint/no-explicit-any":"error"}'`
      が 0 error**（`: any` の grep では `any[]` / `Record<string, any>` / `as any` を
      取りこぼすため、明示的 `any` の検出はルール実行で行う。`no-explicit-any` は
      `eslint.config.mjs` では有効化されていないので `--rule` で明示する）
- [ ] `src/queries/attribute.ts` が **`requireAdmin`** を使っている
      （`grep -n "requireAdmin" src/queries/attribute.ts` がヒット）
- [ ] Step 1 の実測 3 本の結果がプランの実施結果に記録されている
      （**「シードで確認した」は不可** —— design.md 0-D）
- [ ] Step 9 の多値属性の決定が design.md へ追記されている
- [ ] パイロット 2〜3 部門のシードが**冪等**（2 回実行して結果同一）
- [ ] `bunx tsc --noEmit` 0 件 / `bun run lint` 0 errors / `bun run test` 緑
- [ ] `spec-sync-after-test` によるドキュメント同期コミットが存在する

## STOP conditions

以下は improvise せず STOP して報告する:

- Step 1 の計測で **`Spec` の不正行（両方セット / 孤児）が 1 件以上見つかった** ——
  design.md は「0 件でも扱いを決める」としているが、**実在する場合は
  どちらの所有先を優先するか / 孤児を破棄するかの判断を仰ぐ**（データ損失に直結する）。
- **`Spec` を廃止したくなった場合は STOP**。design.md Q3 で温存と決定済みであり、
  0-B により機械移行は不可能。廃止するなら設計から見直す。
- 動的 Zod で **`any` を通したくなった場合は STOP**。`AttributeType` の判別で
  型を絞れないなら、スキーマ設計側に問題がある。
- 多値属性（Step 9）で `@@unique` を緩める判断が**食品部門以外にも波及する**と判明した ——
  影響範囲を提示して判断を仰ぐ。
- `docker info` が失敗し統合テストを実測できない → **BLOCKED として記録**（推測で緑と書かない）。
- `psql "$DIRECT_URL"` に接続できない → Step 1 は **BLOCKED として記録**し、
  他ステップは先行してよい。ただし **Done criteria の該当項目は未達のまま残す**
  （シード実測で代替したと書かない）。

## Maintenance notes

- 本プランは **plan 015（ファセット検索）の直接の前提**。`facetable` フラグと
  `@@index([definitionId, valueNumber])` / `@@index([definitionId, optionId])` が
  015 の集計クエリの土台になる（ADR-007 の Option 1 の SQL 雛形がそのまま使える）。
- **plan 016（出品審査）と Q5 で接続する**。入口検証は常に hard、審査は
  「後から必須化された既存商品」の差し戻しを担当する —— この分担を 016 の実装時に
  相互参照すること（両プランで矛盾させない）。
- `TEXT` 型を `facetable` にすると distinct 値が発散しファセット UI が破綻する。
  admin で禁止または警告すること（ADR-007 Risks）。
- 属性定義・許容値の削除は**論理削除（`archivedAt`）が既定**。`onDelete: Restrict` と
  併せ、値が紐づいた定義は物理削除できない。
