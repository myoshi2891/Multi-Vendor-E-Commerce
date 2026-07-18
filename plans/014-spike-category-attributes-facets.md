# プラン 014（design/spike）: カテゴリ別の商品属性スキーマ（ファセット基盤）を設計する

> **Executor 向け指示**: これは **design/spike** プランであり、ビルドプランでは**ない**。
> 成果物は設計ドキュメントと後続実装プランであり、本プランで機能を出荷**しない**。
> 読み取り専用の調査を行い、未解決の問いにエビデンス付きで答え、設計ドキュメントを書き、STOP する。
> 完了したら `plans/README.md` のこのプランのステータス行を更新する。
>
> **ドリフトチェック（最初に実行）**:
> `git diff --stat a17e2cc..HEAD -- prisma/schema.prisma src/lib/schemas.ts src/queries/product.ts`
> いずれかが変更されていれば「Current state」の抜粋と現行コードを突き合わせる。
> `Spec` モデルまたは `product_specs`/`variant_specs` の Zod 検証が構造的に変わっていたら
> STOP して報告する。
>
> **前提プラン**: plan 013（カテゴリツリー設計）の `docs/design/category-tree/design.md` が
> 存在すればその「新スキーマ案」節を必ず読み、属性定義の FK 先をそのツリー設計に一致させる。
> 013 が未実施の場合は本 spike を進めてよいが、「属性はカテゴリノード（将来のツリーの任意
> ノード）に紐づく」ことを前提として設計し、その旨を design doc に明記する。

## Status

- **Priority**: P2（ファセット検索 plan 015 の前提。拡張ラウンドの土台その2）
- **Effort**: M（spike + 設計ドキュメント。実装は後続プラン）
- **Risk**: MED（商品フォームの動的化と既存 Spec データの移行が本体実装の難所）
- **Depends on**: plans/013-spike-category-tree-n-level.md（設計消費。013 未実施でも進行可 — 上記前提参照）
- **Category**: direction
- **Planned at**: commit `a17e2cc`, 2026-07-09
- **背景ドキュメント**: `plans/direction/EXPANSION_BLUEPRINT.md` §4-② / `plans/audit/findings-09-direction-expansion.md` E-2

## Why this matters

現行の商品属性は `Spec`（name/value とも**自由記述文字列**）のみで、カテゴリごとの必須属性・
許容値・単位の概念がない。このため (1) ファセット検索（「画面サイズ 55 インチ以上」等）が
構造的に不可能、(2) 「素材 / Material / material」の表記揺れが蓄積、(3) 食品・ベビー用品等の
表示義務項目（アレルゲン・対象月齢）を強制できない、(4) バリアント軸が Size/Color の 2 軸に
固定され「容量」「判型」「規格」を持つ部門（家電・書籍・自動車用品など参照タクソノミー
20 部門の約半数）を正しく扱えない。カテゴリ横断の汎用カタログ（EXPANSION_BLUEPRINT §1.1）
には**カテゴリ別属性スキーマ**が土台として必要であり、その格納方式・フォーム動的生成・
既存データ移行の設計を本 spike で確定する。

## Current state（設計前に必ず読む）

### 自由記述の Spec モデル — `prisma/schema.prisma:256-272`

```prisma
model Spec {                  // schema.prisma:256
  id    String @id @default(uuid())
  name  String                // 自由記述 — 表記揺れを防ぐ機構なし
  value String                // すべて文字列 — 数値比較・範囲検索は不可能
  productId String?           // Product レベル or
  variantId String?           // Variant レベル（どちらも optional）
}
```

> **所有先の排他性が DB で強制されていない。** コメントの「or」は**意図**であって制約ではない。
> 両 FK が nullable で CHECK 制約も部分 unique index も無いため、スキーマは以下 2 つの不正状態を
> 許容する:
>
> - **両方セット**: Product にも Variant にも属する Spec 行
> - **どちらも NULL**: どの Product からも到達できない孤児行
>
> 現状のアプリケーションコードは安全である（[`product.ts:159`](../src/queries/product.ts) /
> [`product.ts:203`](../src/queries/product.ts) はいずれも product / variant 配下の**ネスト
> `create`** で書くため、片方の FK しか埋まらない）。ただしこれは**アプリ層の性質であって
> 不変条件ではない**。`createMany` 等の直書き経路が 1 つ増えれば破れる。
>
> **本 spike はこの排他性を新モデルで明示的に扱うこと**:
>
> 1. 新しい属性値モデル（`ProductAttributeValue` / `VariantAttributeValue`）で所有先を
>    **一方に限定**する。問い 1 のようにテーブル自体を分ければ、各テーブルの FK を
>    `NOT NULL` にできて排他性が型で保証される（推奨仮説）。単一テーブルに両 FK を持たせる
>    設計を採る場合は、**CHECK 制約でちょうど一方のみ非 NULL を強制すること**
>    （例: `CHECK ((productId IS NULL) <> (variantId IS NULL))`）。「アプリ層で守る」は不可。
> 2. 問い 3 の Spec データ移行では、**上記 2 つの不正状態が実データに存在する前提で**
>    移行手順を書くこと。移行前の計測クエリを ADR に載せる:
>
>    ```sql
>    -- 両方セット（不正）
>    SELECT count(*) FROM "Spec" WHERE "productId" IS NOT NULL AND "variantId" IS NOT NULL;
>    -- どちらも NULL（孤児）
>    SELECT count(*) FROM "Spec" WHERE "productId" IS NULL AND "variantId" IS NULL;
>    ```
>
>    件数が 0 でも、移行スクリプトは両ケースの扱い（どちらの所有先を優先するか / 孤児は
>    破棄かログして保留か）を明示的に決めておくこと。黙って落とすのは不可。

### Zod 検証は「非空」のみ — `src/lib/schemas.ts:290-322`

```ts
product_specs: z
    .object({ name: z.string(), value: z.string() })
    .array()
    .min(1, "Product must have at least one product spec.")
    .refine((product_specs) =>
        product_specs.every((s) => s.name.length > 0 && s.value.length > 0), ...)
// variant_specs も同型（schemas.ts:306-322）
```

カテゴリに応じた必須属性・型・許容値の検証は存在しない。

### バリアント軸は Size/Color の2軸固定 — `prisma/schema.prisma:200-243`

- `Size`（`schema.prisma:200`）: `size String` + **price/quantity/discount を保持**
  （= 販売単位の実体。第3軸を足す場合もこの「価格・在庫は最下層」構造は壊せない）
- `Color`（`schema.prisma:232`）: `name String` のみ

### Spec は検索から参照されていない — findings-09 E-2

`getProducts`（`src/queries/product.ts:601-772`）のフィルタは store/category/subCategory/
offer/size/search/price/color のみ。`Spec` を where に使う箇所は無い。

### 商品フォームの現状

`ProductFormSchema`（`src/lib/schemas.ts:145`）は**モジュールレベルの静的 Zod スキーマ**。
カテゴリ選択に応じて必須属性が変わる動的スキーマは、React Hook Form + zodResolver の
resolver 差し替え（またはスキーマファクトリ）を要する — i18n 設計（`docs/design/
i18n-localization/`）が同じ「Zod スキーマのファクトリ化」論点を持つため整合させること。

### 遵守すべきリポジトリ規約

- スキーマ変更時は ERD 再生成（`.claude/rules/03-data-model-diagram-sync.md`）
- `any` 禁止・Zod による入力検証は `src/lib/schemas.ts` に集約（`.claude/steering/structure.md`）
- 格納方式の選定（正規化 vs JSONB）は代替案比較を伴う技術選定 → ADR 化対象

## Commands you will need（読み取り専用調査）

> すべて**副作用なしの読み取り専用**コマンド（`grep` / `SELECT` のみ）。実行して結果を得られる形に
> 統一する（インタラクティブな `prisma studio` や不安定な正規表現は使わない）。

| 目的 | コマンド | 期待 |
|---|---|---|
| Spec の全参照箇所 | `grep -rniE "Spec" src/ --include="*.ts" --include="*.tsx" -l` | 影響ファイル一覧（`-l` でファイル名のみ。`\b` 等の非移植正規表現は使わない） |
| 既存 Spec データの傾向（seed 定義から） | `grep -rniE "spec" prisma/seed/` | name の表記揺れ実態（seed の宣言値から把握） |
| 既存 Spec データの傾向（DB から・任意） | `psql "$DIRECT_URL" -c 'SELECT name, COUNT(*) FROM "Spec" GROUP BY name ORDER BY 2 DESC LIMIT 50;'` | 読み取り専用 SELECT で表記揺れを実測（`prisma studio` の目視は使わない）。**`$DATABASE_URL` は不可** — 本リポジトリの `DATABASE_URL` は Prisma Accelerate の `prisma://` URL であり psql は接続できない。素の PostgreSQL 接続文字列は `DIRECT_URL`（`prisma/schema.prisma:9` の `directUrl`。前例: `docs/migration/05-postgres-migration-steps.md:168`） |
| JSONB/GIN の先行事例 | `grep -rniE "Json\|Jsonb" prisma/schema.prisma` | 現状の Json 利用有無 |
| 型チェック（副作用なし） | `bunx tsc --noEmit` | exit 0 |

## Scope

**In scope**（本 spike が生成するもの）:
- 設計ドキュメント `docs/design/category-attributes/design.md`（新規） — Open questions 全てに決定 + 根拠
- ADR `docs/architecture/decisions/0NN-attribute-storage.md`（属性値の格納方式: 正規化テーブル vs JSONB+GIN — 代替案比較つき）
- 後続**実装**プラン `plans/0NN-implement-category-attributes.md`（次の空き番号、plan-template 準拠）

**Out of scope**（本プランでやらないこと）:
- スキーマ・`src/` の変更（設計のみ）
- ファセット検索の実装設計 — plan 015 の領分（ただし 015 が消費できる「ファセット対象属性」の
  メタデータ設計は本 spike に含む）
- 参照タクソノミー各部門の属性シード値の網羅作成 — 後続実装プランで部門 2〜3 個分のみ
  パイロット投入し、残りは運用タスクとする

## Open questions（spike が証拠付きで必ず答える）

1. **属性定義のデータモデル**: `AttributeDefinition`（名前・型 [text/number/enum/boolean]・
   単位・許容値・必須/任意・ファセット対象フラグ・カテゴリノード FK）+ `ProductAttributeValue`
   の2層で足りるか。バリアントレベル属性（容量・判型 = 第3のバリアント軸）を
   `VariantAttributeValue` として分けるか、`Size.size` の一般化で吸収するか。
   **価格・在庫を保持する `Size` の役割を壊さない**制約下で決定する。
2. **格納方式**（ADR 化）: (a) 正規化テーブル（値ごとに1行 + 型別カラム）vs
   (b) 商品側 JSONB 列 + GIN インデックス vs (c) ハイブリッド（定義は正規化・値は JSONB）。
   ファセット集計（plan 015 の GROUP BY / 件数集計）と Prisma からの型安全なアクセスの
   両立で比較する。
3. **既存 Spec の処遇**: 「その他仕様」として温存（EXPANSION_BLUEPRINT §4-② の初期案）か、
   構造化属性へデータ移行して廃止か。温存する場合の UI 上の位置づけと、二重入力を防ぐ
   ガイドライン。
4. **フォームの動的生成**: カテゴリ選択 → 属性定義 fetch → 動的 Zod スキーマ生成 →
   zodResolver 差し替え、の実装方式。静的 `ProductFormSchema` との合成方法
   （`.extend()` / `z.intersection` / スキーマファクトリ）。i18n 設計の Zod ファクトリ論点
   （`docs/design/i18n-localization/design.md`）と衝突しない形を選ぶ。
5. **必須属性の強制レベル**: 保存ブロック（hard）か警告のみ（soft）か。審査ワークフロー
   （plan 016）と連動させ「必須属性欠落 = 審査差し戻し」とする案の評価。
6. **表記揺れの解消運用**: enum 型属性の許容値管理 UI（admin）を初期スコープに含めるか。
   含めない場合のシード運用ルール。
7. **属性定義の変更互換性（スキーマ進化）**: `AttributeDefinition` は**一度作って終わりではない**。
   値が既に大量に紐づいた後で定義が変更される運用が必ず発生するため、各変更が既存値・
   ファセット（plan 015）・商品フォームに与える影響と移行手順を設計に含めること。
   最低限、以下の変更種別それぞれについて「許可するか」「既存値をどう扱うか」を決める:

   | 変更 | 決めること |
   |---|---|
   | 名前・単位の変更 | 表示名のみ変えるか、キーも変えるか（キー変更は既存値の再紐付けが必要）。単位変更（cm→mm 等）は**既存値の再計算**が要るか、旧単位のまま残すか |
   | 型の変更（text→number 等） | 許可するか。許可する場合、変換不能な既存値（`"約 20cm"`）の扱い — 拒否 / NULL 化 / 隔離列へ退避 |
   | enum 許容値の削除・改名 | その値を持つ既存商品をどうするか（無効値として残す / 近い値へ寄せる / 再入力を要求）。問い 6 の許容値管理 UI の要件に直結 |
   | 必須/任意の切り替え | 任意→必須にしたとき、値が無い既存商品を無効扱いにするか。問い 5 の hard/soft と審査ワークフロー（plan 016）への波及 |
   | ファセット対象フラグの切り替え | インデックス（GIN 等）の再構築が要るか、無停止で切り替えられるか |
   | 定義の所属カテゴリノード変更 | 移動先で不要になった値の扱い。ツリー再編（plan 013）と同時に起きうる |
   | 定義の削除 | 既存値を物理削除するか、論理削除（`archivedAt`）で参照を保つか。**論理削除を既定とする案を評価すること** |

   > 格納方式（問い 2）の選択はこの問いと**強く結合する**。(a) 正規化テーブルなら型変更は
   > DDL + データ移行、(b) JSONB なら DDL は不要だが既存ドキュメントの一括書き換えと
   > 「読み取り時に旧形式も解釈する」互換コードが要る。**問い 2 の ADR は、この問い 7 の
   > 変更コストを比較軸に含めること**（現状の比較軸はファセット集計と型安全アクセスのみ）。

## Steps

### Step 1: 現状データと参照箇所の棚卸し

「Commands」の grep で Spec 参照箇所を列挙し、シードデータの `specs` 実例から表記揺れの
実態（同義 name の頻度）を採取する。バリアント軸の実利用（`Size.size` にサイズ以外の値が
入っている商品があるか）も確認する。

**Verify**: 参照箇所一覧と「表記揺れ実例 5 件以上（あれば）」が調査ノートに記録されている。

### Step 2: 格納方式の比較と ADR 起草

Open question 2 の3方式を、plan 015 が要求するファセット集計クエリの雛形（部門×属性×値の
件数）を各方式で書き下して比較し、ADR として起草する。

**Verify**: ADR に3方式それぞれの集計 SQL 雛形と、選定理由・Consequences が揃っている。

### Step 3: 設計ドキュメントの執筆

`docs/design/category-attributes/design.md` に Open questions 全7問の決定・目標スキーマ案
（Prisma モデル定義）・既存 Spec 移行手順・フォーム動的生成のコンポーネント構成
（React Hook Form の resolver 差し替え位置）を書く。EXPANSION_BLUEPRINT §3.2 の
「代表ファセット属性」列から家電・ファッション・食品の3部門をサンプルに属性定義例を示す。

**Verify**: 全7問に決定 + 根拠。属性定義例3部門分が目標スキーマで表現できることを確認済み。

### Step 4: 後続実装プランの執筆

`plans/0NN-implement-category-attributes.md`（次の空き番号）を plan-template 準拠で書く。
マイグレーション → ERD 再生成 → 属性 CRUD（`src/queries/` 配置・`requireAdmin`）→
Zod 動的スキーマ → フォーム → パイロット部門シード → テスト、の順。

**Verify**: 後続プランに drift check・STOP 条件・検証コマンド付きステップが揃っている。

## Done criteria

ALL を満たすこと:

- [ ] `docs/design/category-attributes/design.md` が存在し、全7問に決定 + 証拠がある
- [ ] ADR（格納方式）が存在し、3方式の集計 SQL 雛形比較を含む
- [ ] `plans/0NN-implement-category-attributes.md` が存在し、テンプレート準拠
- [ ] ソースコード・スキーマは未変更（`git status` の変更が新規ドキュメント/プランと、下記の `plans/README.md` 更新のみ）
- [ ] `plans/README.md` の 014 ステータス行を更新した

## STOP conditions

以下の場合は STOP して報告する:

- `Spec` モデルが既に型付き・カテゴリ紐づけに改修済み（前提消滅）
- plan 013 の設計が「属性はカテゴリノードに紐づく」前提と両立しない形で確定していた場合 —
  矛盾点を列挙して 013 の設計者判断を仰ぐ
- JSONB 方式を選ぶ場合に Prisma（**現行の宣言値 `5.22.0`** — `package.json` の `prisma` /
  `@prisma/client` に固定。「5.x」等の曖昧な前提を書かず、実行時に
  `grep -E '"@prisma/client"' package.json` で確認した値を使う）+ Accelerate の
  JSONB フィルタ/インデックスサポートに重大な制約が見つかった場合 — 制約の一次情報を添えて報告
  （Round 1 deferred の Prisma 6.x アップグレード spike と統合すべきかの判断材料になる）

## Maintenance notes

- 本設計は plan 015（ファセット検索）の直接の前提。「ファセット対象フラグ」と集計可能な
  格納方式が 015 の設計自由度を決める
- plan 016（審査）と Open question 5 で接続する — 必須属性の強制を審査と入口検証のどちらに
  置くかは両プランで矛盾しないよう相互参照すること
- レビュアーが後続実装 PR で最も精査すべき点: 動的 Zod スキーマの型安全性（`any` の混入）と、
  属性定義変更時の既存商品データの整合（定義の破壊的変更を許すか）
