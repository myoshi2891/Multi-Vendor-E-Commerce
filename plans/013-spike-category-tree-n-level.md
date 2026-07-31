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
   materialized path のサブツリー検索が tsvector 検索（plan 015）と素直に組み合う。検証して確定せよ。

   > **(b) を採る場合、prefix 境界を必ず定義すること**（素朴な `startsWith("electronics/camera")` は
   > `"electronics/camera-accessories"` のような**兄弟ノードを誤ヒット**する）。サブツリー検索は
   > 「そのノード自身 ＋ 区切り文字境界での子孫」に限定する:
   > - 区切り文字を **path 末尾にも付与**して保存する（例: `"electronics/camera/"`）か、
   >   検索時に境界を明示する。
   > - 自身＋子孫の条件: `path = 'electronics/camera'` **OR** `path LIKE 'electronics/camera/%'`
   >   （SQL の `LIKE` 特殊文字 `%` `_` は path 側でエスケープ、または区切り文字を含まない slug 制約で回避）。
   >   Prisma なら `{ OR: [{ path: p }, { path: { startsWith: p + '/' } }] }`。
   > - 「子のみ（孫を除く）」が要る画面では、深さ（`depth` 列）か「区切り文字数 = 親+1」条件を併用する。
   > spike はこの境界定義を ADR に明記し、誤ヒットしないことを実データ（兄弟 slug 衝突ケース）で検証する。
2. **SubCategory の処遇**: `Category` へ統合して `SubCategory` テーブルを廃止するか、
   ビュー/互換レイヤーとして残すか。統合する場合の data migration 手順
   （SubCategory 行 → Category 行 + parentId 設定、id 衝突の扱い）を具体化する。

   > **統合を採る場合、`url`（slug）衝突の解決方式を設計上の必須論点として決めること。**
   > これは「移行時に気をつける」レベルの話ではなく、**制約の意味が変わる**ことによる構造的な問題:
   >
   > - **現状**: `Category.url @unique` と `SubCategory.url @unique` は**別テーブル上の別制約**。
   >   したがって Category `camera` と SubCategory `camera` は**現在まったく合法に共存できる**。
   > - **統合後**: 単一の `Category.url @unique` が両者の**和集合**を覆う。共存していたペアは
   >   そのまま P2002 となり、**data migration が途中で落ちる**。
   >
   > `id` 衝突（上記の括弧内）は `@default(uuid())` のため実質起こらない。**実際に起きるのは
   > slug 衝突**であり、現状の問い立てはあり得ない衝突を挙げてあり得る衝突を落としている。
   >
   > spike で決めるべきこと:
   >
   > 1. **一意性のスコープ**: グローバル一意（`url @unique` を維持）か、親内一意
   >    （`@@unique([parentId, url])`）か。後者は `?category=electronics/camera` のような
   >    **親パス込みの slug 解決**（問い 4）と整合し、**将来の**衝突自体が消える。前者を採るなら 2. が必須。
   >    **ただし親内一意を採る場合、ルートカテゴリの一意性戦略を別途明記すること** ——
   >    ルートは `parentId = NULL` であり、PostgreSQL は NULL 同士を「区別される」と扱うため
   >    `@@unique([parentId, url])` は**ルート同士の `url` 重複を防げない**（`electronics` を
   >    2 つ作れてしまう）。ルート一意性は別手段で担保する: 部分ユニークインデックス
   >    （`CREATE UNIQUE INDEX ... ON "Category"(url) WHERE "parentId" IS NULL`）か、
   >    番兵ルート parentId（NULL を使わず固定 UUID の仮想ルートを親にする）のいずれか。
   >    **ただし親内一意を採っても、既存の slug 解決契約（3. の URL 後方互換）は完了条件から
   >    外せない** —— 既存 URL は現行のグローバル一意な slug で届いており、親内スコープへ移した
   >    瞬間に「どの親配下の slug か」を旧 URL から解決する規則が必要になる。「衝突が消える」のは
   >    新規入力の話であって、既存 URL の後方互換は依然として設計・完了条件に含めること。
   > 2. **衝突時のリネーム規則**: 決定論的で冪等な規則を定めること（例: 子側に親 slug を
   >    前置して `electronics-camera`、それでも衝突する場合の連番付与規則）。移行を再実行しても
   >    同じ結果になることを要件に含める。
   > 3. **URL 後方互換（対応表）**: 既存 URL を壊す変更は、問い 4 のリダイレクト戦略と
   >    **同じ表**で管理する（対応表を移行の成果物とする）。**これは 1. でどちらを選んでも
   >    必須の完了条件**であり、リネームが起きる場合に限った話ではない:
   >
   >    - **グローバル一意を採る場合**: 衝突ペアの片方が 2. の規則でリネームされ、その slug の
   >      旧 URL が壊れる。
   >    - **親内一意を採る場合**: リネームは起きないが、URL の**解決規則そのもの**が
   >      「フラットな slug」から「親コンテキスト付き slug」へ変わる。旧 URL
   >      `/browse?category=camera` がどの親配下の `camera` を指すのかを決める規則が要り、
   >      それを書き下したものが結局この対応表になる。
   >
   >    **対応表のキーは「旧 slug」単体にしないこと。** 上で確認したとおり、統合前は
   >    Category `camera` と SubCategory `camera` が**合法に共存し得る**。旧 slug だけを
   >    キーにすると、まさに衝突してリネームが必要になったペア —— つまり表が存在する理由
   >    そのもの —— が 1 つのキーに 2 行ぶつかり、引けなくなる。キーには
   >    **エンティティ種別または親コンテキストを含める**:
   >
   >    - `(entityType, oldSlug)` — 例 `("Category", "camera")` / `("SubCategory", "camera")`
   >    - または `(parentSlug, oldSlug)` — 例 `(null, "camera")` / `("electronics", "camera")`
   >
   >    どちらでもよいが、**旧 URL の形からキーを一意に構成できること**を要件にする。
   >    現行 URL は **クエリパラメータ**で種別を区別する ——
   >    `/browse?category={category}`（種別 = Category・親なし）と
   >    `/browse?subCategory={subCategory}`（種別 = SubCategory）で、
   >    **どちらのキーで届いたかが URL 上に明示されている**ため、両案とも旧 URL からキーが決まる。
   >    （`/browse` はパスセグメントを取らない単一ルート
   >    〔[`src/app/(store)/browse/page.tsx`](../src/app/(store)/browse/page.tsx) の `searchParams`〕
   >    で、リンク生成側も一貫して `/browse?category=…` / `/browse?subCategory=…` を組み立てる
   >    〔`category-card.tsx` / `footer/links.tsx` / `categories-menu.tsx`〕。
   >    **`/browse/{category}/{subCategory}` というパス形のルートは存在しない**ので、
   >    この spike で「パス全体方式へ移す」判断をする場合は URL 形式の変更そのものが
   >    移行対象になる。）この「旧 URL → キー → 新 slug」の
   >    経路が閉じていることを ADR に明記し、完了条件に含めること。
   > 4. **事前計測**: 移行を書く前に、実データで衝突件数を数えるクエリを ADR に載せる:
   >    `SELECT count(*) FROM (SELECT url FROM "Category" INTERSECT SELECT url FROM "SubCategory") AS collisions;`
   >    （**件数を返すこと** — 素の `INTERSECT` は衝突 slug の一覧を返すだけで「何件か」を答えない。
   >    移行前の意思決定に必要なのは件数なので `count(*)` で畳む。）
   >    件数 0 でも規則は決めておくこと（将来の admin 入力で発生し得るため）。
   >
   > **ローカル開発では再現しない点に注意**: `bun run seed:luxury` の生成データは
   > `lux-<category>-<subcategory>` という前置命名（例: `lux-watches` / `lux-watches-sport`）を
   > 採っており、**偶然**衝突しない。シードで通ったことを衝突が無い証拠として扱わないこと。
3. **Product FK の移行**: `categoryId`（必須）+ `subCategoryId`（必須）→ 「リーフノード 1 FK」へ
   どう移すか。中間段階（旧 FK と新 FK の並走期間）を設けるか、一括切替か。
   既存クエリ（`getProducts` の category/subCategory フィルタ、`getAllCategories` の
   storeUrl フィルタ）の書き換え形を示す。
4. **URL 後方互換**: 既存の `Category.url` / `SubCategory.url`（ともに `@unique`）で届く
   ストアフロント URL を 301/リライトなしで生かせるか。現行は
   `/browse?category=electronics&subCategory=camera` というクエリ形なので、選択肢は
   (a) クエリ形のまま値へ親パスを入れる（`?category=electronics/camera`）か、
   (b) パス形ルート（`/browse/electronics/camera`）を**新設**して現行クエリ形から
   リダイレクトするか。(b) は新しいルートセグメントの追加を伴うため、
   移行コストは (a) より大きい。いずれを採ってもリダイレクト戦略を示すこと。
5. **深さ制限と運用ルール**: バリデーション上の最大深度（推奨: 5）、「新規商品はリーフのみに
   紐づけ可」の強制方法、非リーフへの既存紐づけの経過措置。

   > **素の DB CHECK ではリーフ強制はできない。** 「リーフか否か」は *他の行* に子があるかどうかで
   > 決まる**関係的な性質**であり、単一行の列だけを見る `CHECK` 制約では表現できない
   > （CHECK は同一行の値しか参照できない）。強制手段は次のいずれか: (a) アプリ層で
   > 「子を持つカテゴリには紐づけ不可」を検証（Zod refine + サーバーアクションでの子存在チェック）、
   > (b) トリガー、(c) `isLeaf`/`childCount` を tx 内で維持する非正規化列に対する CHECK。
   > 「DB CHECK で担保」と一言で片付けないこと。
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
- [ ] **統合方式を採る場合**、ADR が slug 一意性のスコープ（グローバル一意 vs
      `@@unique([parentId, url])`）を明示し、**どちらを選んでも** URL 互換性への影響と
      衝突件数の事前計測クエリ、**および決定論的な旧→新 URL 対応表とその生成方針**を含む
      （Open question 2）。
      対応表が**どちらの選択でも必須**なのは、両者とも既存 URL の形を変えるためである:
      グローバル一意はリネーム規則によって **slug 自体**が変わり、親内一意は下記
      sub-bullet 2 の「親パス込みの解決へ移す」方針によって **URL の形状**（`?category=child`
      → `?category=parent/child`）が変わる。**変わり方が違うだけで、旧 URL が壊れる点は同じ**
      であり、リダイレクト・正規 URL・外部被リンクの扱いは対応表なしには決められない。
      「同一 slug を全ツリーで許さない」運用制約側を選んだ場合のみ、対応表は
      「変更 0 件であることを示す空の表 + その根拠となる計測クエリ結果」で足りる。
  - **親内一意（`@@unique([parentId, url])`）も URL 互換性の検討を免れない。** 現行スキーマは
    `Category.url` / `SubCategory.url` がともに `@unique`（`prisma/schema.prisma:46,62`）で、
    **既存の参照は slug 単体で解決している** —— browse の絞り込みは
    `src/queries/product.ts:632-640` が `db.category.findUnique({ where: { url: filters.category } })`
    で category を引き当てている（`subCategory` も直後で同型）。
    **`findUnique` である点が重要**: このメソッドは Prisma が一意と認識する列でしか
    呼べないため、`url @unique` を外して `@@unique([parentId, url])` へ移した瞬間に
    **型エラーで通らなくなる**。つまりこの照合は「親内一意にすると曖昧になる」のではなく
    **書き換えが強制される**（`findFirst` へ落とせば通るが、それは異なる親の下の同一 slug から
    任意の 1 件を拾う実装 —— 404 ではなく静かに誤ったカテゴリの商品を返す —— になる）。
    コンパイルが落ちる箇所は棚卸しで漏れないが、`findFirst` で黙らせる誘惑があるため
    ADR に方針を書き下すこと。
    したがって親内一意を選ぶ場合、ADR は次の 3 点を持つこと:
    1. slug 単体で引いている既存コードパスの棚卸し（最低でも `product.ts` の browse フィルタ）
    2. それらを親パス込みの解決（`/browse?category=parent/child` 等）へ移す方針、または
       「同一 slug を全ツリーで許さない」運用制約を課す方針のいずれか
    3. 現データで親をまたぐ slug 重複が何件出るかの事前計測クエリ（グローバル一意側と同じ計測）
- [ ] `plans/0NN-implement-category-tree.md` が存在し、テンプレート準拠で zero-context executor が実行可能
- [ ] ソースコード・スキーマは未変更（`git status` の変更が新規ドキュメント/プランと、下記の `plans/README.md` 更新のみ）
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
