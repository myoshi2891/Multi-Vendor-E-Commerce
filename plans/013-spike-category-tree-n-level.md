# プラン 013（design/spike）: カテゴリ体系を固定2階層から N 階層ツリーへ拡張する設計を確定する

> **Executor 向け指示**: これは **design/spike** プランであり、ビルドプランでは**ない**。
> 成果物は設計ドキュメントと後続実装プランであり、本プランで機能を出荷**しない**。
> 読み取り専用の調査を行い、未解決の問いにエビデンス付きで答え、設計ドキュメントを書き、STOP する。
> 完了したら `plans/README.md` のこのプランのステータス行を更新する。
>
> **ドリフトチェック（最初に実行）**:
> `git diff --stat a17e2cc..HEAD -- prisma/schema.prisma src/queries/category.ts src/queries/subCategory.ts src/queries/product.ts src/lib/schemas.ts`
> いずれかがこのプラン作成後に変更されていれば、「Current state」の抜粋と現行コードを
> 突き合わせてから進める。大きな構造変更（特に Category/SubCategory モデルの変更）が
> あれば STOP して報告する。

## Status

- **Priority**: P2（拡張ラウンドの土台。ただし Round 1 の security 001–004 より後）
- **Effort**: M（spike + 設計ドキュメント。実装は後続プラン）
- **Risk**: MED（本体実装は広範囲マイグレーション — だからこそ spike が先）
- **Depends on**: なし（ただし plan 014 の属性設計が本プランの決定を消費する）
- **Category**: direction
- **Planned at**: commit `a17e2cc`, 2026-07-09
- **背景ドキュメント**: `plans/direction/EXPANSION_BLUEPRINT.md` §4-① / `plans/audit/findings-09-direction-expansion.md` E-1

## Why this matters

現行のカテゴリは `Category → SubCategory` の**固定2階層**で、self-relation を持たないため
「家電 > カメラ > レンズ > 単焦点」のような 3 階層以上の部門構造が表現できない。
Amazon 型の総合カタログ（参照タクソノミー: EXPANSION_BLUEPRINT §3.2 の 20 部門）は実運用
3〜4 階層を要求する。さらに `Product` が `categoryId` と `subCategoryId` の**両方を必須**で
持つ二重 FK 構造のため、階層化はスキーマ・Zod・フォーム・URL・admin UI・シーダーに波及する
本リポジトリ最大級の構造変更になる。**移行戦略を決めずに実装に入ると手戻りが確定する** —
本 spike はその決定を確定させる。

## Current state（設計前に必ず読む）

### 固定2階層のスキーマ — `prisma/schema.prisma:42-74`

```prisma
model Category {              // schema.prisma:42
  id       String  @id @default(uuid())
  name     String
  image    String
  url      String  @unique   // ← URL slug（ストアフロントのフィルタキー）
  featured Boolean @default(false)
  subCategories SubCategory[] @relation("CategoryToSubcategory")
  products      Product[]     @relation("CategoryToProduct")
  @@index([name])
}

model SubCategory {           // schema.prisma:58 — Category と同型 + 親 FK。子を持てない
  categoryId String
  category   Category @relation("CategoryToSubcategory", fields: [categoryId], references: [id])
  products Product[] @relation("SubCategoryToProduct")
}
```

### Product の二重 FK（両方必須） — `prisma/schema.prisma:157-161`

```prisma
  categoryId String
  category   Category @relation("CategoryToProduct", fields: [categoryId], references: [id])
  subCategoryId String
  subCategory   SubCategory @relation("SubCategoryToProduct", fields: [subCategoryId], references: [id])
```

Zod 側も両方必須 UUID: `src/lib/schemas.ts:202`（categoryId）/ `:208`（subCategoryId）。

### カテゴリ CRUD（フラット前提） — `src/queries/category.ts` / `subCategory.ts`

- `getAllCategories`（`category.ts:81-121`）— `include: { subCategories: true }` の1段 include。
  `orderBy: { updatedAt: "desc" }` — **表示順カラム（sortOrder）が存在しない**
- `deleteCategory`（`category.ts:181-203`）— **ハード delete**。配下商品の付け替えガードなし
  （FK 制約違反で失敗する挙動に依存）
- `getAllSubCategoriesFotCategory`（`category.ts:128`）— 関数名 typo（`Fot`）が既存
- admin UI: `src/app/dashboard/admin/categories/`（フラットテーブル + `new/` フォーム）

### ストアフロントの URL slug 依存 — `src/queries/product.ts:632-655`

`getProducts` は `filters.category` / `filters.subCategory` を **URL slug** で受けて
`findUnique({ where: { url } })` で ID 解決する。階層化しても既存 slug URL を壊せない
（SEO・ブックマーク互換）。

### 遵守すべきリポジトリ規約

- スキーマ変更時は `bun run erd:generate` で ER 図を同一 PR 内で再生成
  （`.claude/rules/03-data-model-diagram-sync.md`）
- マイグレーションは `bunx prisma migrate dev`（`db push` 禁止）、既存 migration ファイルの
  編集禁止（`.claude/steering/tech.md` 禁止事項）
- 恒久的な表現方式の決定は ADR 化（`docs/architecture/decisions/`、MADR 形式 — 代替案比較を
  伴う技術選定のため `documentation-guide.md` の必須条件を満たす）

## Commands you will need（読み取り専用調査）

| 目的 | コマンド | 期待 |
|---|---|---|
| カテゴリ参照箇所の全列挙 | `grep -rn "subCategoryId\|categoryId" src/ --include="*.ts" --include="*.tsx" -l` | 影響ファイル一覧 |
| SubCategory 依存の全列挙 | `grep -rn "subCategory" src/ -il` | 〃 |
| シーダーのカテゴリ投入箇所 | `grep -rn "category" prisma/seed/ -il` | シーダー影響範囲 |
| 型チェック（現状確認） | `bunx tsc --noEmit` | exit 0 |

（本プランでは production コードの編集なし — 調査 + 設計ドキュメントのみ。）

## Scope

**In scope**（本 spike が生成するもの）:
- 設計ドキュメント `docs/design/category-tree/design.md`（ディレクトリ新規作成。既存
  `docs/design/*/design.md` の構成に倣う）— 下記 Open questions 全てに決定 + 根拠 + 証拠
- ADR `docs/architecture/decisions/006-category-tree-representation.md`（または次の空き番号。
  ツリー表現方式の選定 — 代替案比較つき）
- 後続**実装**プラン `plans/0NN-implement-category-tree.md`（NN = 実行時の次の空き番号。
  `plan-template.md` 準拠、zero-context executor 向け）

**Out of scope**（本プランでやらないこと）:
- `prisma/schema.prisma`・`src/` 配下のあらゆる変更。設計のみ
- カテゴリ別属性（ファセット）の設計 — plan 014 の領分。ただし「属性はカテゴリノードに
  紐づく」前提が成り立つツリー設計にすること（014 が消費する）
- 参照タクソノミー20部門のシードデータ作成 — 後続実装プランの領分

## Open questions（spike が証拠付きで必ず答える）

1. **ツリー表現方式の選定**（ADR 化）: 以下から選び、Prisma/PostgreSQL での実装容易性・
   サブツリー取得性能・移動（親付け替え）コストで比較する:
   - (a) 隣接リスト（`parentId` self-relation）+ アプリ側再帰
   - (b) 隣接リスト + materialized path（`path: "electronics/camera/lens"` 文字列列）
   - (c) closure table（別テーブルで祖先-子孫全ペア）
   推奨の初期仮説: (b) — URL slug 互換（既存 `url @unique` を path の末尾要素として温存）と
   `startsWith` によるサブツリー検索が tsvector 検索（plan 015）と素直に組み合う。検証して確定せよ。
2. **SubCategory の処遇**: `Category` へ統合して `SubCategory` テーブルを廃止するか、
   ビュー/互換レイヤーとして残すか。統合する場合の data migration 手順
   （SubCategory 行 → Category 行 + parentId 設定、id 衝突の扱い）を具体化する。
3. **Product FK の移行**: `categoryId`（必須）+ `subCategoryId`（必須）→ 「リーフノード 1 FK」へ
   どう移すか。中間段階（旧 FK と新 FK の並走期間）を設けるか、一括切替か。
   既存クエリ（`getProducts` の category/subCategory フィルタ、`getAllCategories` の
   storeUrl フィルタ）の書き換え形を示す。
4. **URL 後方互換**: 既存の `Category.url` / `SubCategory.url`（ともに `@unique`）で届く
   ストアフロント URL を 301/リライトなしで生かせるか。パス全体（`/browse/electronics/camera`）
   方式に変える場合のリダイレクト戦略。
5. **深さ制限と運用ルール**: バリデーション上の最大深度（推奨: 5）、「新規商品はリーフのみに
   紐づけ可」の強制方法（Zod refine か DB CHECK か）、非リーフへの既存紐づけの経過措置。
6. **表示順とツリー UI**: `sortOrder` カラム追加の要否、admin のツリーエディタ
   （既存フラットテーブルの拡張 vs ツリービュー新設）の方針。工数見積に含める。

## Steps

### Step 1: 影響範囲の完全な棚卸し

「Commands」の grep で `categoryId` / `subCategoryId` / `subCategory` の全参照ファイルを列挙し、
（queries / Zod / フォーム / URL ルーティング / admin UI / シーダー / テスト / E2E）に分類した
影響マトリクスを作る。

**Verify**: 影響マトリクスに全ヒットファイルが分類済みで、各分類に「後続実装プランでの
書き換え方針」が1行ずつ付いている。

### Step 2: ツリー表現方式の比較と ADR 起草

Open question 1 の3方式を、このリポジトリの実クエリパターン（`getProducts` のフィルタ、
`getAllCategories` の include、ホームの featured 取得）に対して比較し、ADR（MADR 形式、
`docs/architecture/decisions/template.md` 使用）として起草する。

**Verify**: ADR に3方式の比較表・決定・Consequences（Positive/Negative）が揃っている。

### Step 3: 設計ドキュメントの執筆

`docs/design/category-tree/design.md` に Open questions 全6問の決定・新スキーマ案（Prisma
モデル定義の目標形）・data migration 手順（SQL レベルの概略）・URL 互換戦略を書く。
EXPANSION_BLUEPRINT §3.3 の運用ルール（リーフのみ紐づけ・無効化 delete・sortOrder）を
設計に反映する。

**Verify**: 全6問に決定 + 根拠 + `file:line` 証拠。新スキーマ案が plan 014 の「属性はカテゴリ
ノードに紐づく」前提を満たすことを明記。

### Step 4: 後続実装プランの執筆

`plans/0NN-implement-category-tree.md`（次の空き番号）を plan-template 準拠で書く。
スキーマ変更 → `migrate dev` → ERD 再生成 → queries 書き換え → Zod/フォーム → admin UI →
シーダー → テストの順で、各ステップに検証コマンド（`bunx tsc --noEmit` / `bun run lint` /
`bun run test -- src/queries/category.test.ts` 等）を付ける。

**Verify**: 後続プランが drift check・STOP 条件・machine-checkable done criteria を備え、
ERD 再生成（`bun run erd:generate`）と `03-data-model-diagram-sync` 遵守がステップに含まれる。

## Done criteria

ALL を満たすこと:

- [ ] `docs/design/category-tree/design.md` が存在し、Open questions 全6問に決定 + 証拠がある
- [ ] ADR（ツリー表現方式）が MADR 形式で存在し、3方式の比較を含む
- [ ] `plans/0NN-implement-category-tree.md` が存在し、テンプレート準拠で zero-context executor が実行可能
- [ ] ソースコード・スキーマは未変更（`git status` が新規ドキュメント/プランのみを示す）
- [ ] `plans/README.md` の 013 ステータス行を更新し、後続プランを索引に追加した

## STOP conditions

以下の場合は STOP して報告する（improvise しない）:

- `Category` に既に `parentId` 等の self-relation が追加されている（このプランの前提が消滅）
- `SubCategory` が既に廃止・統合済み
- ドリフトチェックで `src/lib/schemas.ts` の categoryId/subCategoryId 検証が大きく変わっている
- 影響ファイルが 60 を超え、単一の後続実装プランでは非現実的と判明した場合 —
  分割案（スキーマ+互換レイヤー / queries / UI の 3 プラン等）を提示して判断を仰ぐ

## Maintenance notes

- 本設計は plan 014（カテゴリ別属性）の前提。014 の設計者は本 spike の design.md の
  「新スキーマ案」節を必ず読み、属性定義テーブルの FK 先（カテゴリノード）を一致させること
- ツリー化後の `deleteCategory` は「無効化 + 付け替え」方式（EXPANSION_BLUEPRINT §3.3）に
  変わる — Round 1 plan 001-004 の auth-guards 規約（`requireAdmin`）を維持したまま拡張する
- レビュアーが後続実装 PR で最も精査すべき点: data migration の可逆性（ロールバック手順）と
  既存ストアフロント URL の互換性テスト（E2E での旧 URL 到達性）
