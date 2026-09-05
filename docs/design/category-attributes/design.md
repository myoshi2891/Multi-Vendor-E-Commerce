# カテゴリ別属性スキーマ（ファセット基盤） — 設計（design.md）

> plan [014](../../../plans/014-spike-category-attributes-facets.md)（design/spike）の成果物。
> **本ドキュメントは設計のみで、`src/` / `prisma/schema.prisma` は 1 行も変更しない。**
> 格納方式の選定根拠は [ADR-007](../../architecture/decisions/007-attribute-storage.md)、
> 実装手順は [plan 069](../../../plans/069-implement-category-attributes.md) が持つ。
>
> - 調査日: 2026-08-31 / 対象 HEAD: `8b08bf5f`（branch `dev`）
> - ドリフトチェック結果: `prisma/schema.prisma` は plan 起票時（`a17e2cc`）から**無変更**
>   （`Spec` は `schema.prisma:256-272` のまま）。`schemas.ts`(+30) / `product.ts`(+58/−17) は
>   動いているが、`product_specs` / `variant_specs` の Zod 検証は**構造的に無変更**。
>   → **STOP 条件（`Spec` が型付き・カテゴリ紐づけへ改修済み）には非該当**。

---

## 0. 設計の前提（実コードで確認済みの事実）

| #   | 事実 | 出典 |
| --- | ---- | ---- |
| 0-1 | `Spec` は `name` / `value` とも自由記述文字列。型・単位・許容値・必須性の概念が無い | [`schema.prisma:256-272`](../../../prisma/schema.prisma) |
| 0-2 | 所有先の排他性（`productId` xor `variantId`）は**DB で強制されていない** —— 両 FK が nullable で CHECK も部分 unique index も無く、「両方セット」と「どちらも NULL（孤児）」の 2 つの不正状態を許容する | 同上 |
| 0-3 | Zod 検証は「非空」のみ | [`schemas.ts:291-322`](../../../src/lib/schemas.ts) |
| 0-4 | `Spec` は検索に一切使われていない（`getProducts` のフィルタは store/category/subCategory/offer/size/search/price/color のみ） | [`product.ts:601-772`](../../../src/queries/product.ts) |
| 0-5 | `Size` は `size String` に加えて **price / quantity / discount を保持する販売単位の実体**。第 3 軸を足す場合もこの「価格・在庫は最下層」構造は壊せない | [`schema.prisma:200-216`](../../../prisma/schema.prisma) |
| 0-6 | `Color` は `name String` のみ | [`schema.prisma:232-243`](../../../prisma/schema.prisma) |
| 0-7 | `ProductFormSchema` は**モジュールレベルの静的 Zod スキーマ** | [`schemas.ts:146`](../../../src/lib/schemas.ts) |
| 0-8 | 属性定義の FK 先は `Category.id` の単一ノードに確定済み。継承は `path` の prefix で表現する | [ADR-006](../../architecture/decisions/006-category-tree-representation.md) / [`category-tree/design.md`](../category-tree/design.md) §3 |
| 0-9 | 本リポジトリに `Json` / `Jsonb` 列の先行事例は**ゼロ**。Prisma は `5.22.0`、DB は PostgreSQL (Neon) + **Prisma Accelerate** 経由 | `grep -niE "json" prisma/schema.prisma` → 0 件 / [`package.json`](../../../package.json) / [`schema.prisma:9`](../../../prisma/schema.prisma) |

### 0-A. `createMany` の直書き経路は「将来の懸念」ではなく**既に存在する**

plan 014 本文は「現状のアプリケーションコードは安全である（[`product.ts:159`](../../../src/queries/product.ts) /
[`product.ts:203`](../../../src/queries/product.ts) はいずれもネスト `create`）…
**`createMany` 等の直書き経路が 1 つ増えれば破れる**」と仮定法で書いている。
**実際には既に 2 経路ある**（`updateProduct` の「削除 + 再作成」。plan 038 で入ったもの）:

- [`product.ts:350-356`](../../../src/queries/product.ts) — `tx.spec.createMany({ data: [...{ productId }] })`
- [`product.ts:460-466`](../../../src/queries/product.ts) — `tx.spec.createMany({ data: [...{ variantId }] })`

現時点でも各呼び出しは片方の FK しか埋めないため不正行は生まれない。
しかし**排他性を守る責任は、ネスト `create` の構文的性質から 4 箇所の呼び出し規律へ移っている**。
規律は 5 箇所目で破れる。これは Q1（テーブル分離）の決定を支える一次証拠である。

### 0-B. 数値属性は**文字列に埋め込まれている**（実測）

`prisma/seed/constants/products/*.ts` の実測値:

```
Dimensions:  "200cm x 70cm" / "20cm x 14cm x 6cm" / "40cm x 30cm x 8cm"
Heel Height: "100mm with concealed 10mm platform" / "65mm block heel"
Weight:      "28g (45cm) / 32g (50cm)"
Pearl Size:  "10-11mm diameter"
Case:        "316L Stainless Steel, 42mm, 100m WR"
```

1 セルに**複数の数値と単位が同居**している。含意は 2 つ:

1. 数値比較・範囲検索が**今日まったくできない**（plan 015 の動機そのもの）。
2. **Q7 の「型変更 `TEXT → NUMBER` で変換不能な既存値」は仮想例ではなく多数派**であり、
   機械変換は原理的に不可能。→ **Q3 の決定を実質的に決める**（§2-Q3）。

### 0-C. `Size.size` は**既に汎用軸として濫用されている**（実測）

同シードの `size` 値の分布:

```
S(16) / M(16) / L(16) / One Size(13) / XS(9) / 40(7) / 38(7) / 36(7) / 52(6) / 50(6) / 48(6) …
… "S (15cm)" / "M (17cm)" / "L (19cm)" / "95cm" / "90cm x 90cm" / "90cm"
```

スカーフの `"90cm x 90cm"` は**寸法**であってサイズではない。`"S (15cm)"` は
サイズ表記と寸法の**混載**である。つまり「第 3 のバリアント軸が必要」は将来の要件ではなく、
**既に破綻している現状の記述**である。Q1 の `AttributeScope.VARIANT` はこの穴を塞ぐ。

### 0-D. シードは表記揺れを**示さない**（証拠として使ってはならない）

同シードの spec name 実測: **153 行 / 24 種**。
`Material`(47) / `Origin`(35) / `Care`(12) / `Hardware`(10) / `Dimensions`(10) / `Lining`(7) …
で、**大小・同義の揺れは 1 件も無い**。

これは「表記揺れが問題にならない」ことの証拠では**ない**。シードは単一の作者が手で
書いたものであり、複数の販売者が自由入力する本番とは母集団が違う。
plan [013](../../../plans/013-spike-category-tree-n-level.md) で
`lux-` 前置命名が slug 衝突を偶然隠していたのと**同型の罠**である。
揺れのリスクは実データではなく**構造**（自由記述・制約なし・書き込み 4 経路 = 0-A）に由来する。

> **実 DB での実測は行えていない。** `psql` が未インストールで、`DATABASE_URL` は
> Prisma Accelerate の `prisma://` URL のため psql から接続できない
> （素の接続文字列は `DIRECT_URL`）。**BLOCKED として記録**し、上記シード実測を
> 代替根拠として明示する。plan 069 の実装時に実 DB で再計測すること。

### 0-E. `ProductFormSchema` の消費点は**1 コンポーネント・2 箇所だけ**

```
src/components/dashboard/forms/product-details.tsx:177  useForm<z.infer<typeof ProductFormSchema>>
src/components/dashboard/forms/product-details.tsx:179  resolver: zodResolver(ProductFormSchema)
```

`schemas.ts:146` の定義以外に消費点は無い（`grep -rn "ProductFormSchema" src/`）。
i18n 設計（[`i18n-localization/design.md`](../i18n-localization/design.md) §5）は
Zod ファクトリ化について「schema 利用箇所すべてに波及するため段階導入」と警告しているが、
**`ProductFormSchema` に関してはその波及が事実上ゼロ**である。→ Q4 の実装コストは
plan 014 が想定するより小さい。

---

## 1. 影響マトリクス（Step 1 の棚卸し結果）

**調査コマンド**:

```bash
grep -rnE "product_specs|variant_specs|\bSpec\b|specs:" src/ --include="*.ts" --include="*.tsx" -l
```

既存の `Spec` 参照は **7 ファイル**のみ:

| # | 分類 | ファイル | 方針 |
|---|------|---------|------|
| 1 | サーバーアクション | [`queries/product.ts`](../../../src/queries/product.ts) | `Spec` の読み書きは**そのまま温存**（Q3）。属性値の読み書きを追加 |
| 2 | Zod / 型 | [`lib/schemas.ts`](../../../src/lib/schemas.ts) / [`lib/types.ts`](../../../src/lib/types.ts) | `ProductFormSchema` をファクトリ化（Q4）。属性値の Zod を動的生成 |
| 3 | 商品フォーム | [`forms/product-details.tsx`](../../../src/components/dashboard/forms/product-details.tsx) | resolver 差し替え（`:179`）+ 属性入力セクション追加 |
| 4 | 商品詳細表示 | [`store/product-page/product-specs.tsx`](../../../src/components/store/product-page/product-specs.tsx) | 「仕様」= 構造化属性、「その他仕様」= `Spec` の 2 セクション表示（Q3） |
| 5 | テスト | `queries/product.test.ts` / `lib/schemas.test.ts` | 追随 |

**新規に生まれるファイル**（既存 admin CRUD 1 エンティティ = `offer-tags` の構成に倣う ——
`page.tsx` / `columns.tsx` / `new/page.tsx` + `forms/*-details.tsx` + `queries/*.ts` + テスト）:

| 新規 | 内訳 |
|------|------|
| 属性定義 CRUD | `admin/attributes/{page,columns,new/page}.tsx` + `forms/attribute-details.tsx` + `queries/attribute.ts` + `queries/attribute.test.ts` = **6** |
| 許容値管理（Q6） | `admin/attributes/[id]/options/page.tsx` + `forms/attribute-option-details.tsx` = **2** |
| 動的スキーマ / 属性入力 | `lib/attribute-schema.ts`（ファクトリ）+ `forms/attribute-inputs.tsx` + テスト 2 = **4** |
| 統合テスト | `tests/integration/category-attributes.test.ts` = **1** |
| **合計** | **約 13 新規 + 7 既存変更 = 約 20 ファイル** |

> **plan 013 の 82 ファイルとは桁が違う（約 20）。** したがって
> **後続実装プランは分割せず 1 本（[069](../../../plans/069-implement-category-attributes.md)）とする**
> —— 013 と同じ 60 ファイル基準を適用した結果である。

---

## 2. Open questions への決定

### Q1. 属性定義のデータモデル → **2 層 + 値テーブルの分離**

`AttributeDefinition`（定義）+ `AttributeOption`（enum 許容値）+
`ProductAttributeValue` / `VariantAttributeValue`（値）。**スキーマ案は §3**。

**値テーブルを Product 用 / Variant 用に分離する**（単一テーブル + 2 nullable FK にしない）。
分離すれば各 FK を `NOT NULL` にでき、**排他性が型で保証される** —— CHECK 制約も
呼び出し規律も要らない。0-2 の欠陥を新モデルへ持ち込まないための決定であり、
0-A（規律頼みの状態が既に 4 経路へ広がっている）がその必要性を裏づける。

> 単一テーブル案を採る場合は
> `CHECK (("productId" IS NULL) <> ("variantId" IS NULL))` が**必須**になる
> （Prisma の camelCase 列は PostgreSQL で二重引用符が必須 —— 無引用だと
> 小文字畳み込みで存在しない列を参照する）。「アプリ層で守る」は不可。
> **分ければこの制約自体が不要になる**ので分ける。

**バリアントレベル属性（容量・判型 = 第 3 の軸）は `AttributeScope.VARIANT` で表現し、
`Size.size` の一般化では吸収しない。** 理由は 0-5 —— `Size` は price / quantity / discount を
持つ**販売単位の実体**であり、ここに任意の属性軸を載せると「価格・在庫は最下層」という
構造が壊れる。0-C が示すとおり `Size.size` への詰め込みは既に起きており、
これ以上進めるべきではない。

### Q2. 格納方式 → **正規化テーブル + 型別カラム**

[ADR-007](../../architecture/decisions/007-attribute-storage.md) で確定。
3 方式（正規化 / JSONB+GIN / ハイブリッド）のファセット集計 SQL を書き下して比較した。

**JSONB を採らない決定的な理由**（要約 —— 詳細は ADR）:
GIN インデックスが効くのは包含条件による**絞り込み**であり、`jsonb_each_text` の展開 +
`GROUP BY`（= ファセットの本命）は絞り込み後の集合を**全走査**する。
さらに全値が `text` になって数値ファセットが型を失い、ENUM の参照整合性が無いため
**本設計が解こうとしている表記揺れが JSON の中で再発する**。

### Q3. 既存 `Spec` の処遇 → **温存し「その他仕様」へ降格**

一括移行して廃止する案は**採らない**。

**0-B が決定的である。** 既存値は `"200cm x 70cm"` `"28g (45cm) / 32g (50cm)"` のように
1 セルに複数の数値と単位が同居しており、`valueNumber` への機械変換は原理的に不可能。
移行を試みれば「大半が変換不能」という結果にしかならない。
[EXPANSION_BLUEPRINT](../../../plans/direction/EXPANSION_BLUEPRINT.md) §4-② の初期案とも一致する。

**併存ルール（二重入力の防止）**:

1. **表示**: 商品詳細は「仕様」（構造化属性）と「その他仕様」（`Spec`）の**2 セクション**に分ける
   （[`product-specs.tsx`](../../../src/components/store/product-page/product-specs.tsx)）。
2. **入力**: 商品フォームで、そのカテゴリに `AttributeDefinition` が存在する `name` を
   `Spec` に入力しようとしたら**警告する**（ブロックはしない —— 販売者が
   「単位違いの補足」を書きたい正当なケースがある）。
3. **ファセット対象は構造化属性のみ**。`Spec` は 0-4 のとおり元々検索に使われておらず、
   この境界は現状を追認するだけで新たな制約を課さない。
4. `Spec` を**新規に必須化しない**。現行の Zod は `min(1)` で最低 1 件を要求しているが
   （0-3）、構造化属性が主役になった後もこの必須を残すかは 069 で判断する
   （残すと「その他仕様」が空の商品を保存できない）。

### Q4. フォームの動的生成 → **ファクトリ関数化（i18n 案A と同形）**

```ts
// src/lib/attribute-schema.ts（新規）
export const makeProductSchema = (defs: AttributeDefinitionDTO[]) =>
    ProductFormSchema.extend({ attributes: buildAttributeShape(defs) });
```

- **`.extend()` で合成する**（`z.intersection` ではない）。`intersection` は
  両側を独立に検証してマージするため、RHF のエラーパスが二重になり
  `errors.attributes.<key>` の対応が崩れる。`extend` なら単一の `ZodObject` のままで
  `zodResolver` のエラーパスが素直に対応する。
- 差し替え位置は
  [`product-details.tsx:179`](../../../src/components/dashboard/forms/product-details.tsx)
  の `resolver: zodResolver(ProductFormSchema)` **1 箇所**（0-E）。
  カテゴリ選択の変更で `defs` を再取得し、`useMemo` でスキーマを再生成する。
- **i18n 設計との整合**: [`i18n-localization/design.md`](../i18n-localization/design.md) §5 の
  案A（ファクトリ関数化）と**同じ形**なので、将来 i18n が入ったら
  `makeProductSchema(t, defs)` へ引数を 1 つ足すだけで合流できる。
  案B（メッセージにキー文字列を入れる）を採っても衝突しない。
- **`any` を通さない**。`buildAttributeShape` は `AttributeType` による判別で
  `z.string()` / `z.coerce.number()` / `z.boolean()` / `z.enum([...])` を返す
  discriminated な構築にすること。
  [`click-to-add.tsx`](../../../src/components/dashboard/forms/click-to-add.tsx) の
  `Detail<T>` はインデックスシグネチャの緩い型なので、属性入力には**流用しない**。
- **`NUMBER` は数値変換の前に空入力を `undefined` へ正規化する**。HTML の
  `<input type="number">` は未入力を `""` で返し、`z.coerce.number()` は `Number("")`
  すなわち **`0`** を通してしまう。任意属性が未入力のまま `0` として保存されると、
  「値なし」と「0 と入力した」が DB 上で区別できなくなり、ファセット集計にも
  偽の `0` が現れる。したがって:

  ```ts
  // 空文字・空白のみ・null は「未入力」に畳んでから数値へ落とす
  const emptyToUndefined = (v: unknown) =>
      typeof v === "string" && v.trim() === "" ? undefined : (v ?? undefined);

  const numberField = (required: boolean) =>
      // `.optional()` は preprocess の **内側**に置く。外側に付けると
      // `ZodOptional` が先に走るが、入力は `""`（undefined ではない）なので
      // そのまま内側へ渡り、正規化された undefined が `z.coerce.number()` に
      // 入って `NaN` で落ちる —— 任意属性の未入力が保存できなくなる。
      z.preprocess(
          emptyToUndefined,
          required ? z.coerce.number() : z.coerce.number().optional()
      );
  ```

  **`required: false` のときだけ `.optional()` を付ける**こと（`required: true` で
  optional にすると Q5 の hard 検証が骨抜きになる）。`required: true` では
  正規化後の `undefined` が `z.coerce.number()` に渡り `NaN` として弾かれる ——
  保存はブロックされるがメッセージは「数値ではない」になるので、必須である旨を
  出したい場合は `invalid_type_error` を明示すること。検証シナリオには
  「任意 `NUMBER` を空のまま保存 → 再読込しても `0` にならず未入力のまま」という
  **ラウンドトリップ**を必ず含める（A-1 の「`type` と埋まっている列が一致する」だけでは
  この事故を検出できない —— `valueNumber = 0` は列の一致条件を満たしてしまう）。

### Q5. 必須属性の強制レベル → **hard（保存ブロック）を既定**、審査モードで soft へ落とせる構造

EXPANSION_BLUEPRINT §3.2 の部門 8（ヘルスケア・OTC）/ 9（食品 —— アレルゲン）/
17（ベビー —— 対象月齢・安全基準）は**法規・表示義務**が絡む。soft（警告のみ）では担保できない。

ただし plan [016](../../../plans/016-spike-seller-onboarding-catalog-approval.md)（出品審査）は
「審査モードをポリシーとして選べる」ことを要件にしている。したがって、

- **入口検証（Zod + サーバーアクション）は常に hard** —— 必須属性が欠けた商品は保存できない。
- **審査ワークフローは「必須属性欠落」を差し戻し理由の 1 つとして扱う**が、
  入口が hard である以上、通常経路でその状態は生まれない。差し戻しが効くのは
  **定義が後から必須化された既存商品**（Q7）に対してである。
- 016 との矛盾を避けるため、この分担を両プランで相互参照する。

### Q6. 表記揺れ解消の運用 → **enum 許容値の admin 管理 UI を初期スコープに含める**

`AttributeOption` を CRUD できないと `ENUM` 型が実質使えず、Q1 で型を導入した意味が消える。
既存 admin CRUD（`offer-tags` 等）と同じ TanStack table パターンを再利用する。

**シード運用ルール**: パイロット部門（069 で 2〜3 部門）の許容値はシードで投入し、
以降は admin から追加する。シードは**冪等**にすること（`@@unique([definitionId, value])` で upsert）。

### Q7. 定義の変更互換性（スキーマ進化）

| 変更 | 決定 | 既存値の扱い |
|------|------|-------------|
| **表示名の変更** | **許可**。`key`（機械キー）と `name`（表示名）を分離しているため表示名だけ変えられる | 影響なし |
| **`key` の変更** | **禁止**。`key` は不変の機械キーとして扱う（一意性は `archivedAt IS NULL` の行だけに掛かる部分一意インデックスで担保する —— 下記「経路 2 と一意制約」）。変えたい場合は新規定義 + 旧定義の `archivedAt`。アーカイブ済み定義は一意判定の対象外なので、同じ `key` の新旧定義が共存できる | 旧定義に紐づいた値はそのまま残る（履歴） |
| **単位の変更** | **許可するが値の再計算はしない**。`cm → mm` のような換算は**新規定義を作って移行**する | 旧単位のまま旧定義に残る。混在を避けるため旧定義は archive する |
| **型の変更** | **`TEXT → NUMBER` のみ許可**。逆方向と `ENUM ⇄ NUMBER` は禁止（新規定義を作る）。さらに **in-place の型変更は「全行が変換可能」と確認できた場合に限る**（下記「型変更の 2 経路」） | **経路 1（全行変換可能）**: `valueText` → `valueNumber` へ UPDATE してから `type` を変更。`valueText` は NULL に戻す。**経路 2（変換不能な行が 1 行でもある）**: 旧定義の `type` は `TEXT` のまま `archivedAt` を付け、変換可能な値だけを新しい `NUMBER` 定義へ移す。**変換不能な値は旧定義（`TEXT`）側に残り、黙って NULL 化しない**（0-B のとおり変換不能が多数派になる前提）。新旧定義は `key` を共有するため、**一意制約はアーカイブ済みを対象外にする**（下記「経路 2 と一意制約」） |
| **enum 許容値の改名** | **許可**。`AttributeOption.label` を更新する | **FK なので既存値は自動追随**（ADR-007 D-3） |
| **enum 許容値の削除** | **論理削除のみ**（`archivedAt`）。物理削除は `onDelete: Restrict` で阻止 | 既存値は参照を保つ。新規入力の選択肢からは消える |
| **必須/任意の切替** | **許可**。任意 → 必須にしても既存商品を無効化しない | 値が無い既存商品は `SELECT` で列挙でき、Q5 のとおり**審査の差し戻し対象**として扱う。次回編集時に入口検証で hard に要求される |
| **facetable の切替** | **許可・無停止**。インデックスは `definitionId` 単位で既に存在するため再構築不要 | 影響なし。**ただし `TEXT` 型の facetable 化は禁止/警告**（distinct 値が発散しファセット UI が破綻する） |
| **所属カテゴリノードの変更** | **許可**。FK 付け替え 1 行 | 移動先カテゴリに属さない商品の値は残るが、ファセットには出なくなる。移動前に影響件数を計測すること |
| **定義の削除** | **論理削除を既定**（`archivedAt`）。物理削除は `Restrict` で阻止 | **値は保持されるが、ファセットには出なくなる**。継承クエリが `archivedAt: null` で絞る（下記スキーマ §）ため、アーカイブ済み定義とその値は plan 015 のファセットから外れる（検証シナリオ A-6）。値が残るのは履歴・再有効化・エクスポートのためであって、ファセットに出し続けるためではない |

> **型変更の 2 経路（A-1 の不変条件を壊さないため）。** `NUMBER` 定義の下に
> `valueText` だけが埋まった行を残すことは**禁止**する —— それは検証シナリオ A-1
> （`type` と実際に埋まっている列が一致する）を定義そのものが破る状態であり、
> 入口検証・ファセット集計・表示のいずれもどちらの列を正とするか判断できなくなる。
> したがって型変更の前に必ず変換可能性を計測する:
>
> ```sql
> -- 値は定義の scope 側の 1 テーブルにしか入らない（複合 FK (definitionId, scope)、
> -- ADR-007 D-5）が、計測 SQL を PRODUCT 側だけにすると VARIANT 定義では
> -- 常に 0 件が返り、変換不能な値を抱えたまま経路 1 を選んでしまう。
> -- 反対側は必ず 0 行なので、両テーブルを UNION ALL で合算して数える。
> SELECT count(*) FROM (
>     SELECT "valueText" FROM "ProductAttributeValue" WHERE "definitionId" = $1
>     UNION ALL
>     SELECT "valueText" FROM "VariantAttributeValue" WHERE "definitionId" = $1
> ) v
> WHERE v."valueText" !~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$';
> ```
>
> 0 件なら経路 1（in-place 変更）、1 件以上なら経路 2（archive + 新定義）を採る。
> **経路 1 の UPDATE も同じ理由で scope 側のテーブルに当てること**（数え方と
> 書き換え先がずれると、計測は緑なのに変換されない値が残る）。
> **不変条件は「定義ごと」に閉じている**ため、経路 2 なら変換不能な値は
> `TEXT` のままの旧定義に残り、履歴を失わずに A-1 を満たせる。
>
> **これらの決定は Q2（格納方式）と強く結合している。** 「enum 改名が自動追随する」
> 「変換不能行を安全に残せる」「論理削除で履歴が残る」はいずれも**正規化 + FK** の
> 帰結であり、JSONB を選んでいたらどれも成立しない（ADR-007 の変更コスト比較表）。
>
> **経路 2 と一意制約（`key` は据え置き、制約側をアーカイブ対象外にする）。**
> 経路 2 は「旧 `TEXT` 定義を archive」＋「同じ `key` の新 `NUMBER` 定義を作成」なので、
> `@@unique([categoryId, key])` を素のまま掛けると**同一ノードに同じ `key` が 2 行**現れて
> **INSERT が落ちる**。ここで `key` を `size_v2` のように改名して逃げてはならない ——
> Q7 が `key` を**不変の機械キー**と定めており（読み取り・エクスポート・plan 015 の
> ファセット定義がこのキーで結び付いている）、改名は経路 2 を「型変更」ではなく
> 「別属性への移行」に変えてしまう。したがって**制約の側を狭める**:
>
> ```prisma
> // アーカイブ済みは一意性の対象外にする（部分ユニークインデックス）
> // Prisma スキーマでは表現できないため、migration の SQL に直接書く。
> @@unique([categoryId, key])  ← これを外し、下の raw SQL へ置き換える
> ```
>
> ```sql
> CREATE UNIQUE INDEX "AttributeDefinition_categoryId_key_active_key"
>   ON "AttributeDefinition" ("categoryId", "key")
>   WHERE "archivedAt" IS NULL;
> ```
>
> **これに伴う読み書き規則**（1 ノード 1 `key` につき**アクティブは高々 1 件**）:
>
> - **書き込み**: upsert のキーは `(categoryId, key, archivedAt IS NULL)`。
>   Prisma の `upsert` は部分インデックスを複合キーとして扱えないため、
>   **`INSERT ... ON CONFLICT` を raw SQL で書き、部分インデックスを推論させる**:
>
>   ```sql
>   INSERT INTO "AttributeDefinition" ("id", "categoryId", "key", "name", "type", "scope", ...)
>   VALUES ($1, $2, $3, $4, $5, $6, ...)
>   ON CONFLICT ("categoryId", "key") WHERE "archivedAt" IS NULL
>   DO UPDATE SET "name" = EXCLUDED."name", "type" = EXCLUDED."type", ...
>   RETURNING *;
>   ```
>
>   `ON CONFLICT` の推論句に**インデックスと同じ述語 `WHERE "archivedAt" IS NULL` を
>   書くこと**（部分インデックスは述語を与えないと推論対象にならない）。
>
>   **`findFirst` → `create` / `update` に分けてはならない。`$transaction` で包んでも
>   race は消えない** —— PostgreSQL の既定分離レベル READ COMMITTED では、同時に走る
>   2 つのトランザクションが**どちらも `findFirst` で 0 件を見て、どちらも `create` に
>   進む**。整合性は部分ユニークインデックスが最後に守るが、敗者は
>   `P2002`（unique violation）で**エラーとして落ちる** —— 利用者から見れば
>   「保存を押したら失敗した」であり、upsert の意味論を満たしていない。
>   `ON CONFLICT` はこれを 1 文のアトミックな操作に畳む。
>
>   raw SQL を避けたい場合の代替は**リトライ**（`P2002` / serialization failure を
>   捕捉して 1 度だけ再実行する）だが、`ON CONFLICT` を第一候補とすること。
>
>   **テスト要件**: 同一 `categoryId` + 同一 `key` の書き込みを**並行に発火**させ、
>   片方が update、もう片方が create として成立し（順序は問わない）**アクティブ行が
>   最終的に 1 件**であること、かつ**どちらの呼び出しも例外を投げない**ことを
>   `tests/integration/` で固定する。単体のモックでは READ COMMITTED の
>   ふるまいを再現できないため、実 DB の統合テストで検証すること。
> - **読み取り（入口検証・フォーム生成・ファセット）**: 既存の継承クエリと同じく
>   `archivedAt: null` で絞るため、アクティブな 1 件だけが見え、**呼び出し側の
>   コードは経路 2 の前後で変わらない**。
> - **読み取り（履歴・エクスポート）**: `archivedAt` を外して引くと同じ `key` が
>   複数返る。**`key` だけで一意と仮定しないこと** —— 行の識別は `definitionId` で行う。

---

## 3. 目標スキーマ案

完全な Prisma 定義は [ADR-007 の Decision 節](../../architecture/decisions/007-attribute-storage.md)を参照。
要点のみ:

```prisma
enum AttributeType  { TEXT  NUMBER  BOOLEAN  ENUM }
enum AttributeScope { PRODUCT  VARIANT }          // 0-C: 第 3 のバリアント軸

model AttributeDefinition {
  categoryId String                                // 0-8: Category.id 単一ノード
  key        String                                // 不変の機械キー（Q7）
  name       String                                // 可変の表示名（Q7）
  type       AttributeType
  scope      AttributeScope
  unit       String?
  required   Boolean   @default(false)             // Q5
  facetable  Boolean   @default(false)             // plan 015 が消費
  archivedAt DateTime?                             // Q7: 論理削除
  // Q7 の型変更 経路 2 は「同じ key の旧定義を archive して新定義を作る」ため、
  // 素の複合ユニークだと衝突する。アクティブ行のみを対象にした
  // 部分ユニークインデックスを migration の raw SQL で張る（上記「経路 2 と一意制約」）。
  // @@unique([categoryId, key])   ← 採用しない
}

model ProductAttributeValue {
  productId    String                              // NOT NULL = 排他性が型で保証（Q1）
  definitionId String
  scope        AttributeScope @default(PRODUCT)    // CHECK で PRODUCT 固定。
                                                   // (definitionId, scope) の複合 FK で
                                                   // VARIANT 定義の混入を DB が拒否（ADR-007 D-5）
  valueText    String?
  valueNumber  Decimal? @db.Decimal(18, 6)         // Float 禁止規約に倣う
  valueBool    Boolean?
  optionId     String?                             // ENUM は FK（Q7 の自動追随）
  @@unique([productId, definitionId])
}
// VariantAttributeValue は同型（FK は variantId・NOT NULL・scope は VARIANT 固定）。
// 完全な定義（複合 FK (optionId, definitionId) / (definitionId, scope) を含む）は
// ADR-007 §Decision と D-5 を参照。
```

### 継承（plan 013 との接続）

属性は `Category` ノードに紐づき、**子孫カテゴリへ継承される**。継承の実装に専用構造は不要 ——
ADR-006 の materialized path を使い、「このノードに効く属性定義」は
**祖先パスの集合**で引ける:

```ts
// path = "electronics/camera/lens" → ["electronics", "electronics/camera", "electronics/camera/lens"]
const ancestorPaths = node.path.split("/").map((_, i, a) => a.slice(0, i + 1).join("/"));
const defs = await db.attributeDefinition.findMany({
    where: { category: { path: { in: ancestorPaths } }, archivedAt: null },
    // 後段の重複 key 解決規則が d.category.path を読むため、リレーションを明示的に含める。
    // Prisma はデフォルトでスカラーのみ返すので、include が無いと d.category は undefined。
    include: { category: { select: { path: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
});
```

これは 013 の design.md §3 が約束した「014 側に継承専用の構造は要らない」の具体形である。

#### 継承チェーン上の `key` 重複の解決規則

`@@unique([categoryId, key])` が禁じるのは**同一ノード内**の重複だけで、祖先と子孫が
同じ `key`（例 `color`）を定義することは防げない。したがって `ancestorPaths` で引いた定義集合には
同一 `key` が複数現れうる。

**規則: 同一 `key` は最も深いノード（`path` が最長）の定義が勝つ（子孫が祖先を上書きする）。**

定義作成時に拒否する案は採らない。ADR-006 のカテゴリ移動（再親付け）で**既存の定義同士が
後から衝突しうる**ため、作成時チェックでは不変条件として成立しないからである。

この規則は**読み取り・書き込み・Zod 検証のすべてで同一に適用する**:

```ts
// ancestorPaths は浅い→深い順。後勝ちで Map に詰めれば最深ノードの定義が残る。
const effective = new Map<string, AttributeDefinition>();
for (const d of defs.sort((a, b) => a.category.path.length - b.category.path.length)) {
    effective.set(d.key, d);
}
```

- **読み取り**: 解決後の集合のみを DTO / フォームに出す（影に隠れた定義は出さない）。
- **書き込み**: 送信された値の `definitionId` が解決後の集合に含まれることを検証し、
  上書きされた祖先定義への値は拒否する（既存値は残るが読み取りには現れない）。
- **Zod 検証**: 動的スキーマは解決後の集合から組み立てる（`key` が一意なので衝突しない）。

テストは重複 `key` の継承ケース（祖先・子孫が同一 `key` を定義した状態での
読み取り・保存・拒否）を必ず含めること。

---

## 4. 属性定義例（EXPANSION_BLUEPRINT §3.2 の 3 部門）

目標スキーマで表現できることの確認。

### 部門 1: 家電・カメラ（`electronics`）

| key | name | type | scope | unit | required | facetable | 備考 |
|-----|------|------|-------|------|----------|-----------|------|
| `screen_size` | 画面サイズ | NUMBER | PRODUCT | `inch` | false | **true** | 範囲ファセット（`width_bucket`） |
| `resolution` | 解像度 | ENUM | PRODUCT | — | false | **true** | 許容値: `4K` / `8K` / `FHD` |
| `connectivity` | 接続規格 | ENUM | PRODUCT | — | false | **true** | `HDMI2.1` / `USB-C` / `Wi-Fi6` |
| `storage_capacity` | 容量 | NUMBER | **VARIANT** | `GB` | false | true | **0-C の第 3 軸**。`Size` に詰め込まない |

### 部門 4: ファッション（`fashion`）— 現行 Size/Color 軸がそのまま効く領域

| key | name | type | scope | unit | required | facetable |
|-----|------|------|-------|------|----------|-----------|
| `material` | 素材 | ENUM | PRODUCT | — | **true** | **true** |
| `pattern` | 柄 | ENUM | PRODUCT | — | false | true |
| `season` | シーズン | ENUM | PRODUCT | — | false | true |
| `length` | 丈 | NUMBER | PRODUCT | `cm` | false | true |

> 現行シードの `Material`(47 件) / `Origin`(35 件) はここに収まる（0-D）。
> `Dimensions: "200cm x 70cm"`（0-B）は **1 属性に収まらない** ——
> `width` / `length` の 2 定義へ分割する必要があり、これが Q3 で
> 「一括移行しない」と決めた理由の具体例である。

### 部門 9: 食品・飲料（`food`）— 必須属性がコンプライアンス要件になる領域

| key | name | type | scope | unit | required | facetable |
|-----|------|------|-------|------|----------|-----------|
| `allergens` | アレルゲン | ENUM | PRODUCT | — | **true**（hard・Q5） | **true** |
| `origin_country` | 産地 | ENUM | PRODUCT | — | **true** | true |
| `net_weight` | 内容量 | NUMBER | **VARIANT** | `g` | **true** | true |
| `best_before_type` | 賞味期限区分 | ENUM | PRODUCT | — | false | true |

> `allergens` は**複数値**を取り得る（小麦 + 卵 + 乳）。本設計の
> `@@unique([productId, definitionId])` は 1 属性 1 値なので、**多値属性は
> 069 で明示的に扱うこと** —— 制約を `@@unique([productId, definitionId, optionId])` に
> 緩めるか、`multiValued Boolean` を定義側に持たせるかを実装時に決める。
> **ただし「制約を緩めるだけ」では閉じない** —— PostgreSQL の一意インデックスは NULL 同士を
> 異なる値として扱うため、`optionId` が NULL になる TEXT / NUMBER / BOOLEAN の行が
> 重複可能になり、単値属性の 1 属性 1 値が失われる。決定は
> `@@unique` / upsert キー / delete の単位 / `optionId` の nullability / NULL 重複の防止策
> の 5 項目を PRODUCT・VARIANT 両スコープについて埋めた形で行うこと
> （チェックリストと推奨解は [plan 069](../../../plans/069-implement-category-attributes.md) Step 2）。
> **本 spike はこの穴を認識したうえで未決として残す**（見落としではない）。

---

## 5. 検証シナリオ（plan 069 の必須項目）

| # | シナリオ | 理由 |
|---|---------|------|
| A-1 | `type` と実際に埋まっている列が一致する（`NUMBER` なのに `valueText` だけ、が起きない） | ADR-007 の Risks。書き込みヘルパーを 1 箇所に集約したことの確認 |
| A-2 | 祖先カテゴリで定義した属性が子孫カテゴリの商品で必須になる（継承の実効性） | §3 の継承実装。013 との接続点 |
| A-3 | 必須属性が欠けた商品を保存できない（create / update **両方**） | Q5 の hard 強制 |
| A-4 | `AttributeOption.label` の改名が既存商品の表示に**自動追随**する | Q7 / ADR-007 D-3。FK で持つことの実利 |
| A-5 | 参照されている `AttributeOption` を物理削除できない（`Restrict` が効く） | Q7 の論理削除既定 |
| A-6 | `archivedAt` の付いた定義がファセット集計に**出てこない** | ADR-007 の Risks |
| A-7 | `TEXT → NUMBER` の型変更で、変換不能な既存値が **NULL 化されない**。経路 1（全行変換可能）では変換後に `NUMBER` 定義下へ `valueText` だけの行が残らない。経路 2（変換不能あり）では旧定義が `TEXT` のまま archive され、変換不能な値がそこに残る | 0-B。黙って落とさないことと、A-1 の不変条件を両立させる担保 |
| A-8 | `Spec` の読み書きが**壊れていない**（「その他仕様」として動作する） | Q3 の温存。回帰ガード |

---

## 6. 本設計が主張しないこと

1. **性能ベンチマークは取っていない** —— 方式選定はクエリの書ける/書けないと
   インデックスの効き方の構造に基づく（ADR-007 Notes）。
2. **実 DB での表記揺れ実測は行えていない**（0-D の BLOCKED）。シード実測が代替根拠であり、
   シードは揺れを示さない —— それは揺れが無い証拠ではない。
3. **ファセット集計の実行方式**（GROUP BY vs マテビュー vs キャッシュ）は plan 015 の領分。
   本設計は「どの方式でも素の SQL で書ける」ところまでを保証する。
4. **多値属性（`allergens` 等）の格納は未決**（§4 の注記）。069 で決める。
5. **参照タクソノミー 20 部門の属性シード網羅**は範囲外。069 でパイロット 2〜3 部門のみ。
