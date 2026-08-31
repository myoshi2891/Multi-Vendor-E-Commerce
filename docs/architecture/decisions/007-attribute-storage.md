# 007. カテゴリ別属性値の格納方式 — 正規化テーブル（型別カラム）

- **Status**: Accepted
- **Date**: 2026-08-31
- **Deciders**: project team（plan [014](../../../plans/014-spike-category-attributes-facets.md) の spike として起票）

---

## Context

現行の商品属性は `Spec`（`name` / `value` とも**自由記述文字列**）のみで、型・単位・
許容値・必須性の概念が無い（[`prisma/schema.prisma:256-272`](../../../prisma/schema.prisma)）。
そのため plan [015](../../../plans/015-spike-faceted-search-and-browse.md)（ファセット検索）が
**構造的に成立しない** —— 「画面サイズ 55 インチ以上」のような数値範囲条件を書く先が無い。

本 ADR は、カテゴリ別属性を導入するにあたり**属性値をどこにどう置くか**を決める。
属性**定義**（名前・型・単位・許容値）が正規化テーブルになること自体は 3 案とも共通で、
争点は**値**の格納方式である。

### 決定に効いた実測（すべて本リポジトリの現物）

| # | 事実 | 出典 |
|---|------|------|
| C-1 | `Spec` は `name` / `value` とも自由記述。所有先の排他性（`productId` xor `variantId`）は**DB で強制されていない** —— 両 FK が nullable で CHECK も部分 unique index も無い | [`schema.prisma:256-272`](../../../prisma/schema.prisma) |
| C-2 | **`createMany` による直書き経路が既に 2 つある**（`updateProduct` の「削除 + 再作成」）。排他性はもはやネスト `create` の構文的性質ではなく、**4 箇所の呼び出し規律**に依存している | [`product.ts:350-356`](../../../src/queries/product.ts) / [`product.ts:460-466`](../../../src/queries/product.ts) |
| C-3 | Zod 検証は「非空」のみ。型・単位・許容値の検証は存在しない | [`schemas.ts:291-322`](../../../src/lib/schemas.ts) |
| C-4 | **数値が文字列に埋め込まれている**: `Dimensions: "200cm x 70cm"` / `Weight: "28g (45cm) / 32g (50cm)"` / `Heel Height: "100mm with concealed 10mm platform"` / `Pearl Size: "10-11mm diameter"` | [`prisma/seed/constants/products/`](../../../prisma/seed/constants/products/) 実測 |
| C-5 | **`Size.size` は既に汎用軸として濫用されている**: `S` / `M` / `L` に混じって `"90cm x 90cm"` `"95cm"` `"S (15cm)"` `"One Size"` が入っている | 同上（`grep -hoE 'size: "[^"]+"'` の実測） |
| C-6 | `Spec` は検索に一切使われていない（`getProducts` のフィルタは store/category/subCategory/offer/size/search/price/color のみ） | [`product.ts:601-772`](../../../src/queries/product.ts) |
| C-7 | **本リポジトリに `Json` / `Jsonb` 列の先行事例はゼロ** | `grep -niE "json" prisma/schema.prisma` → 0 件 |
| C-8 | Prisma / `@prisma/client` は **`5.22.0`**。DB は PostgreSQL (Neon) + **Prisma Accelerate** 経由 | [`package.json`](../../../package.json) / [`schema.prisma:9`](../../../prisma/schema.prisma) |
| C-9 | 属性定義の FK 先は `Category.id` の単一ノードに確定済み。継承は `path` の prefix で表現する | [ADR-006](006-category-tree-representation.md) / [`docs/design/category-tree/design.md`](../../design/category-tree/design.md) §3 |

**C-4 と C-5 が本 ADR の出発点である。** 数値属性も第 3 のバリアント軸も、
「将来必要になる」のではなく**既に存在していて、置き場所が無いので文字列へ押し込まれている**。

---

## Decision

**(a) 正規化テーブル + 型別カラム**を採用する。

```prisma
enum AttributeType  { TEXT  NUMBER  BOOLEAN  ENUM }
enum AttributeScope { PRODUCT  VARIANT }

model AttributeDefinition {
  id         String         @id @default(uuid())
  categoryId String                              // C-9: 単一ノード。継承は path prefix
  category   Category       @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  key        String                              // 機械キー（不変）例 "screen_size"
  name       String                              // 表示名（可変）
  type       AttributeType
  scope      AttributeScope                      // C-5: 第 3 のバリアント軸をここで表現する
  unit       String?                             // "cm" / "inch" / "g"
  required   Boolean        @default(false)
  facetable  Boolean        @default(false)      // plan 015 が消費するメタデータ
  sortOrder  Int            @default(0)
  archivedAt DateTime?                           // 論理削除（既定）
  options    AttributeOption[]
  @@unique([categoryId, key])
  @@index([categoryId, facetable])
}

model AttributeOption {
  id           String    @id @default(uuid())
  definitionId String
  definition   AttributeDefinition @relation(fields: [definitionId], references: [id], onDelete: Cascade)
  value        String                            // 機械値（不変）
  label        String                            // 表示名（可変）
  sortOrder    Int       @default(0)
  archivedAt   DateTime?
  @@unique([definitionId, value])
  @@unique([id, definitionId])      // 複合 FK の参照先（値テーブルの定義一致を DB で強制）
}

model ProductAttributeValue {
  id           String  @id @default(uuid())
  productId    String                            // NOT NULL —— 排他性が型で保証される
  product      Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  definitionId String
  definition   AttributeDefinition @relation(fields: [definitionId], references: [id], onDelete: Restrict)

  valueText   String?
  valueNumber Decimal? @db.Decimal(18, 6)        // 金額規約に倣い Float を使わない
  valueBool   Boolean?
  optionId    String?
  // 複合 FK: optionId 単体ではなく (optionId, definitionId) で参照する。
  // 単一 FK だと「別定義の許容値」を保存できてしまい、D-3 の参照整合性が成立しない。
  option      AttributeOption? @relation(fields: [optionId, definitionId], references: [id, definitionId], onDelete: Restrict)

  @@unique([productId, definitionId])
  @@index([definitionId, valueNumber])
  @@index([definitionId, optionId])
}

model VariantAttributeValue {
  id           String  @id @default(uuid())
  variantId    String                            // NOT NULL —— 排他性が型で保証される
  variant      ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)
  definitionId String
  definition   AttributeDefinition @relation(fields: [definitionId], references: [id], onDelete: Restrict)

  valueText   String?
  valueNumber Decimal? @db.Decimal(18, 6)
  valueBool   Boolean?
  optionId    String?
  option      AttributeOption? @relation(fields: [optionId, definitionId], references: [id, definitionId], onDelete: Restrict)

  @@unique([variantId, definitionId])
  @@index([definitionId, valueNumber])
  @@index([definitionId, optionId])
}
```

### D-1. 値テーブルを Product 用 / Variant 用に**分離**する（単一テーブル + 2 nullable FK にしない）

C-1 の設計上の欠陥（排他性が DB で強制されていない）を新モデルへ持ち込まない。
テーブルを分ければ**各 FK を `NOT NULL` にでき、排他性が型で保証される** ——
CHECK 制約も呼び出し規律も要らない。

> **これは理論上の懸念ではない。** C-2 のとおり `createMany` の直書き経路が既に 2 つあり、
> 排他性を守っているのは「4 箇所の呼び出しが片方の FK しか埋めない」という**規律**だけである。
> 規律は 5 箇所目で破れる。単一テーブル案を採る場合は
> `CHECK (("productId" IS NULL) <> ("variantId" IS NULL))` が**必須**だが
> （Prisma の camelCase 列は PostgreSQL で二重引用符必須 —— 無引用だと小文字畳み込みで
> 存在しない列を参照する）、そもそも分ければこの制約自体が不要になる。

### D-2. 型別カラム（`valueText` / `valueNumber` / `valueBool` / `optionId`）

`NUMBER` を `Decimal(18,6)` にするのは、本リポジトリが `Float` を禁じ精度の要る値を
`Decimal` で持つ規約（[`tech.md`](../../steering/tech.md)）に倣うため。
属性は金額ではないが、`55.5 インチ` と `0.1 + 0.2` の同型の事故を避ける理由は同じである。

### D-3. `ENUM` 型の値は `optionId` の **FK** で持つ（文字列で持たない）

表記揺れ（本設計が解こうとしている問題そのもの）は、値が**参照**であって初めて構造的に消える。
文字列で持つと「許容値を admin で改名しても既存商品が追随しない」「削除したら
どの商品が影響を受けるか分からない」が残る。

### D-4. 定義・許容値の削除は**論理削除（`archivedAt`）を既定**とする

物理削除すると plan 015 のファセットから履歴が消え、過去の商品が何を主張していたかが
辿れなくなる。`onDelete: Restrict` と併せ、値が紐づいた定義は消せない。

---

## Alternatives Considered

比較は **plan 015 が要求するファセット集計**（「このカテゴリ配下の商品を、属性ごと・値ごとに
件数集計する」）の SQL を**実際に書き下して**行う。カテゴリのサブツリー条件は
ADR-006 の path prefix（`c.path = $1 OR c.path LIKE $1 || '/%'`）を使う。

### Option 1: 正規化テーブル + 型別カラム（**採用**）

```sql
-- ファセット集計: 属性 × 値 × 件数
SELECT d.key,
       COALESCE(o.label, v."valueText", v."valueBool"::text, v."valueNumber"::text) AS facet_value,
       count(DISTINCT p.id) AS product_count
FROM "Product" p
JOIN "Category" c ON c.id = p."categoryNodeId"   -- 商品のリーフノード（Phase C で categoryId へ rename）
JOIN "ProductAttributeValue" v ON v."productId" = p.id
JOIN "AttributeDefinition" d ON d.id = v."definitionId"
                            AND d.facetable AND d."archivedAt" IS NULL
LEFT JOIN "AttributeOption" o ON o.id = v."optionId"
WHERE c.path = $1 OR c.path LIKE $1 || '/%'
GROUP BY d.key, facet_value
ORDER BY d.key, product_count DESC;

-- 数値ファセット（範囲バケット）— 型別カラムがあるので素直に書ける
-- 直前の集計と同じ商品・カテゴリ条件と定義条件を課す（でないとサブツリー外の商品まで数える）
SELECT d.key, width_bucket(v."valueNumber", 0, 100, 10) AS bucket, count(DISTINCT p.id)
FROM "Product" p
JOIN "Category" c ON c.id = p."categoryNodeId"
JOIN "ProductAttributeValue" v ON v."productId" = p.id
JOIN "AttributeDefinition" d ON d.id = v."definitionId"
                            AND d.type = 'NUMBER'
                            AND d.facetable AND d."archivedAt" IS NULL
WHERE c.path = $1 OR c.path LIKE $1 || '/%'
GROUP BY d.key, bucket;
```

> **`COALESCE` に `valueNumber` を含めること。** `facetable` は型に依らず立てられる
> （`AttributeType.NUMBER` でも `true` にできる）ので、`label` / `valueText` /
> `valueBool` だけを並べると **NUMBER 属性の facet_value が全行 NULL に潰れ**、
> 「値ごとの件数」が 1 グループに畳まれる。範囲バケットを使いたい NUMBER 属性は
> 上の `width_bucket` 側で扱い、離散値として数えたい場合はこの `COALESCE` が受ける。

**メリット**:
- 集計が**素の `GROUP BY`**。`@@index([definitionId, valueNumber])` がそのまま効く。
- 絞り込み（`valueNumber >= 55`）が **Prisma の型付き API で書ける** ——
  `where: { attributeValues: { some: { definitionId, valueNumber: { gte: 55 } } } }`。
  `any` 禁止規約（[`tech.md`](../../steering/tech.md)）と衝突しない。
- ENUM 値が FK なので**参照整合性が効く**（D-3）。
- C-7 の未知（本リポジトリ初の JSONB + Accelerate 経由の JSON フィルタ）を持ち込まない。

**デメリット**:
- 商品 1 件の属性を読むのに JOIN が要る（N 属性 = N 行）。
- 属性が増えると値テーブルの行数が商品数 × 属性数で伸びる。
- 型別カラムが 4 つあり、「どれが埋まっているか」は `type` を見ないと決まらない
  （アプリ層の判別が必要）。

### Option 2: 商品側 JSONB 列 + GIN インデックス

```sql
-- ファセット集計: JSONB を展開して数える
SELECT kv.key, kv.value, count(*) AS product_count
FROM "Product" p
JOIN "Category" c ON c.id = p."categoryNodeId"   -- 商品のリーフノード（Phase C で categoryId へ rename）
CROSS JOIN LATERAL jsonb_each_text(p.attributes) AS kv(key, value)
WHERE c.path = $1 OR c.path LIKE $1 || '/%'
GROUP BY kv.key, kv.value
ORDER BY kv.key, product_count DESC;
```

**メリット**: 属性追加に DDL が不要。商品 1 件の属性が 1 行で読める（JOIN 無し）。

**デメリット（決定的なもの）**:
- **GIN インデックスは集計を助けない。** `jsonb_path_ops` の GIN が効くのは
  包含条件（`@>`）による**絞り込み**であって、`jsonb_each_text` の展開 + `GROUP BY` は
  絞り込み後の集合を**全走査**する。ファセットは「絞り込みと同時に全属性の件数を出す」
  操作なので、最も効かせたいところで効かない。
- **数値ファセットが型を失う。** `jsonb_each_text` は全値が `text` になり、
  `55` と `"55 inch"` と `"5.5"` が同じ土俵に乗る。範囲集計には
  属性ごとの式インデックス（`((attributes->>'screen_size')::numeric)`）が必要で、
  「DDL 不要」という利点が**属性を増やすたびに崩れる**。
- **集計が必ず `$queryRaw`。** Prisma は `jsonb_each_text` を型付き API で表現できないため、
  ファセットは raw SQL になる。読み取り側も `Prisma.JsonValue` からの絞り込みに
  ランタイム型ガードが要る。
- **ENUM の参照整合性が無い**（D-3）。許容値の改名・削除が既存値に伝わらず、
  **本設計が解こうとしている表記揺れが JSON の中で再発する**。
- C-7 のとおり本リポジトリに先行事例が無く、C-8 の Accelerate 経由での
  JSON フィルタ挙動を別途検証する必要がある（未知の追加）。

**なぜ選ばなかったか**: 「スキーマレスで柔軟」という利点は、**ファセット集計という
本命ユースケースでちょうど効かない**。柔軟性の代償として型安全と参照整合性の両方を失う。

### Option 3: ハイブリッド（定義は正規化・値は JSONB）

**メリット**: 定義側（型・単位・許容値・facetable）は正規化されるため admin UI と
バリデーションは Option 1 と同等に書ける。値の追加は DDL 不要。

**デメリット**: 集計・数値ファセット・参照整合性の問題は **Option 2 とまったく同じ**まま。
定義が正規化されている分、「定義上は `ENUM` なのに値は自由文字列」という
**乖離しうる 2 系統**を抱える（定義側の `AttributeOption` と JSON 内の実値が一致する保証が無い）。

**なぜ選ばなかったか**: Option 2 の欠点を引き継いだ上で、整合性の検査点を 1 つ増やす。
「両方の良いとこ取り」に見えて、**責任の所在が二重になる**。

### 変更コスト比較（plan 014 Q7 — 定義が変更される運用は必ず起きる）

| 変更 | Option 1（採用） | Option 2 / 3 |
|------|------------------|--------------|
| 型変更 `TEXT → NUMBER` | `valueText` → `valueNumber` の UPDATE。**変換不能行は `valueText` に残したまま検出できる**（`WHERE valueNumber IS NULL`） | 全ドキュメントの書き換え + 「旧形式も読む」互換コードをロールアウト期間中ずっと維持 |
| enum 許容値の改名 | `AttributeOption.label` を更新するだけ。**既存値は FK なので自動追随** | JSON 内の文字列を全件書き換え。取りこぼしは静かに残る |
| enum 許容値の削除 | `archivedAt` を立てる。`onDelete: Restrict` で**参照中は消せない** | 参照整合性が無く、**孤児文字列が黙って残る** |
| 任意 → 必須 | 値が無い商品を `SELECT` で列挙できる | 同左（JSON のキー欠落を探す。可能だが raw SQL） |
| facetable の切替 | インデックスは `definitionId` 単位で既にある。**再構築不要** | 属性ごとの式インデックスを**新規作成**（属性が増えるほどインデックスが増える） |
| 定義の所属カテゴリ変更 | FK の付け替え 1 行 | 同左（定義側は正規化されているため Option 3 は同等） |
| 定義の削除 | 論理削除（D-4）。物理削除は `Restrict` で阻止される | 論理削除の概念を JSON 側に持てず、値だけ残る |

**C-4 が示すとおり、既存 `Spec` の値は 1 セルに複数の数値と単位が同居している**
（`"28g (45cm) / 32g (50cm)"`）。したがって「型変更で既存値が変換不能」は仮想例ではなく
**多数派**であり、変換不能行を安全に残せる Option 1 の性質が実運用上で効く。

---

## Consequences

### Positive

- **ファセット集計が素の SQL / Prisma で書ける** —— plan 015 の設計自由度が最大になる。
- **排他性が型で保証される**（D-1）。C-1 の欠陥を新モデルへ持ち込まず、
  C-2 の「規律頼み」の状態も再生産しない。
- **表記揺れが参照整合性で構造的に消える**（D-3）。これは本設計の主目的そのもの。
- `any` 禁止規約・`Float` 禁止規約と衝突しない。
- C-7 の未知（JSONB + Accelerate）を導入しない —— 本リポジトリで検証済みの
  リレーショナル機能だけで構成される。

### Negative

- **値テーブルの行数が商品数 × 属性数で伸びる。** 20 部門 × 平均 8 属性 × 商品数の規模感で
  設計されており、パーティショニングは当面不要と判断するが、監視対象ではある。
- **商品 1 件の属性取得に JOIN が必要**（現行の `include: { specs: true }` と同じ形なので
  新しい負担ではない）。
- **型別 4 カラムのうち 1 つだけが埋まる**疎な表現になる。どれを読むかは
  `AttributeDefinition.type` から決まるため、読み出しヘルパーを 1 箇所に集約すること
  （散らすと `type` と実際に埋まった列の不一致が検出できなくなる）。
- 属性の追加が**マイグレーションではなくデータ投入**で済む点は Option 2 と同じだが、
  **型別カラムの追加**（将来 `DATE` 型を足す等）は DDL になる。

### Risks

- **`type` と埋まっている列の不整合** —— `type = NUMBER` なのに `valueText` だけ埋まっている行。
  → 書き込みを 1 つのヘルパーに集約し、整合性を検査する統合テストを置く
  （C-2 の教訓: 規律だけに頼らない）。
- **`archivedAt` の付いた定義がファセットに漏れる** → 集計クエリの
  `d."archivedAt" IS NULL` を共通ヘルパーに閉じ込める。
- **属性が facetable のまま大量の distinct 値を持つ**（例: 自由記述 TEXT を facetable にする）
  → ファセット UI が破綻する。`TEXT` 型の facetable 化を admin で禁止するか警告する。

---

## Implementation

実装は後続プラン [069](../../../plans/069-implement-category-attributes.md) が行う。

### 既存 `Spec` は廃止しない

**C-4 により、既存 `Spec` から構造化属性への機械的な一括移行は原理的に不可能である**
（`"200cm x 70cm"` を `valueNumber` にできない）。`Spec` は
**「その他仕様」として温存**し、構造化属性を主役に据える
（[EXPANSION_BLUEPRINT](../../../plans/direction/EXPANSION_BLUEPRINT.md) §4-② の初期案と一致）。
併存ルールと二重入力の防止は
[`docs/design/category-attributes/design.md`](../../design/category-attributes/design.md) §2-Q3 が持つ。

### 移行前の計測クエリ（C-1 の不正状態は「無い前提」にしない）

```sql
-- 両方セット（不正）
SELECT count(*) FROM "Spec" WHERE "productId" IS NOT NULL AND "variantId" IS NOT NULL;
-- どちらも NULL（孤児）
SELECT count(*) FROM "Spec" WHERE "productId" IS NULL AND "variantId" IS NULL;
```

**件数が 0 でも、移行スクリプトは両ケースの扱いを明示的に決めること**
（どちらの所有先を優先するか / 孤児は破棄かログして保留か）。黙って落とすのは不可。

---

## Related

- 設計ドキュメント: [`docs/design/category-attributes/design.md`](../../design/category-attributes/design.md)
- 起票プラン: [`plans/014-spike-category-attributes-facets.md`](../../../plans/014-spike-category-attributes-facets.md)
- 前提 ADR: [ADR-006（カテゴリツリー表現方式）](006-category-tree-representation.md) —— 属性定義の FK 先と継承方式
- 消費する後続 spike: [plan 015（ファセット検索）](../../../plans/015-spike-faceted-search-and-browse.md)
- 接続する spike: [plan 016（出品審査）](../../../plans/016-spike-seller-onboarding-catalog-approval.md) —— 必須属性の強制レベル
- 背景: [EXPANSION_BLUEPRINT](../../../plans/direction/EXPANSION_BLUEPRINT.md) §3.2 / §4-②

---

## Notes

- **本 ADR が主張しないこと**: (1) 性能ベンチマークは取っていない —— 比較はクエリの
  **書ける / 書けない**とインデックスの効き方の構造に基づく。(2) ファセット集計の
  実行方式（GROUP BY vs マテビュー vs キャッシュ）は plan 015 の領分で、本 ADR は
  「どの方式でも素の SQL で書ける」ところまでを保証する。
- **実 DB での表記揺れ実測は行えていない**（`psql` 未インストール・`DATABASE_URL` は
  Accelerate の `prisma://` で psql から接続不可）。根拠はシード実測に基づく ——
  ただし**シードは表記揺れを示さない**（24 種の name すべて表記が揃っている）。
  これは「揺れが無い」ことの証拠ではなく、シードが単一の作者による手書きだからである。
  揺れのリスクは実データではなく**構造**（自由記述・制約なし・書き込み 4 経路）に由来する。
