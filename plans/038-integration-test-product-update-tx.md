# Plan 038: `updateProduct`（handleProductAndVariantUpdate）の全置換 tx・slug 一意性・SetNull 連鎖を実 DB 統合テストで固定する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4ec6b5b..HEAD -- src/queries/product.ts src/lib/types.ts prisma/schema.prisma tests/integration/`
> If any in-scope/referenced file changed since this plan was written, compare
> the "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **前提チェック（Step 0）**: 本プランは Docker（testcontainers）必須。
> `docker info` が失敗する環境では **STOP**（`plans/README.md` の status 列に
> `BLOCKED (Docker unavailable)` と記録して終了）。

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW（テスト新設のみ。`src/` 本体は 1 行も変更しない）
- **Depends on**: none（他プランと完全独立・並行可）
- **Category**: tests
- **Planned at**: commit `4ec6b5b`, 2026-07-11
- **出典 finding**: TESTS-22（`plans/audit/findings-14-integration-coverage-r6.md` —
  Round 5 findings-13 の「次点候補」の昇格）

## Why this matters

セラーの商品編集（`upsertProduct` の更新分岐 → `handleProductAndVariantUpdate`）は
`db.$transaction` 内で specs / questions / freeShipping / images / colors / **sizes** を
**deleteMany → createMany の全置換**で更新する。この設計には実 DB でしか観測できない
3 つの帰結がある: ①tx が途中で失敗したとき子テーブルが半置換で残らないこと（原子性）、
②名前変更時の slug 再生成が unique 制約と衝突したら suffix（`-1`）で解決されること、
③**sizes の全置換で `Size.id` が変わるため、`Wishlist.sizeId`（FK / SET NULL）が NULL 化し、
`CartItem.sizeId`（FK なし平文字列）は古い id のまま残る**こと。unit テスト
（`src/queries/product.test.ts`）は全モックでこのいずれも実行しない。実 DB で固定すれば、
編集フローの回帰網かつ「編集がカート/ウィッシュリストへ及ぼす副作用」の仕様書になる。

## Current state

- `src/queries/product.ts:71-122` — エントリポイント `upsertProduct(product, storeUrl)`。
  `requireStoreOwner(storeUrl)` → 既存 product/variant を findUnique/findFirst →
  **両方存在すれば `handleProductAndVariantUpdate`（更新分岐）**。
- `src/queries/product.ts:297-469` — 検証対象 `handleProductAndVariantUpdate`。**変更しない。**
  - `:302-325` — **名前が変わった場合のみ** `generateUniqueSlug(slugify(name), "product")` /
    variantName も同様に `"productVariant"` で再生成。名前不変なら既存 slug 維持
  - `:327-468` — `db.$transaction(async (tx) => { ... })` 内で:
    product.update（category/subCategory connect、offerTag connect/disconnect）→
    Spec 全置換（`:348-357` product 分・`:458-467` variant 分）→ Question 全置換（`:360-371`）→
    FreeShipping 全置換（`:374-394`）→ productVariant.update → 画像全置換（`:416-426`）→
    Color 全置換（`:429-439`）→ **Size 全置換（`:442-455`）**
- `src/queries/product.ts:28-55` — `generateUniqueSlug(baseSlug, model)`:
  findFirst ループで `base`, `base-1`, `base-2`… と採番（100 回で throw）。
- **FK セマンティクス（`prisma/migrations/20260222101357_init_postgresql/migration.sql`）**:
  - `:745` — `Wishlist.sizeId → Size` **ON DELETE SET NULL**（sizes 全置換で NULL 化する）
  - `CartItem.productId/variantId/sizeId`（`prisma/schema.prisma:414-416`）は **FK なしの
    平文字列** → sizes 全置換後も古い sizeId を保持したまま残存する
- **入力型 `ProductWithVariantType`**（`src/lib/types.ts:64-`）— 全フィールド必須
  （`offerTagId`/`saleEndDate` と各配列要素の `id` のみ optional）:

```typescript
export type ProductWithVariantType = {
    productId: string; variantId: string;
    name: string; description: string;
    variantName: string; variantDescription: string;
    images: { id?: string; url: string }[];
    variantImage: string;
    categoryId: string; subCategoryId: string; offerTagId?: string;
    isSale: boolean; saleEndDate?: string | null;
    brand: string; sku: string; weight: number;
    colors: { id?: string; color: string }[];
    sizes: { id?: string; size: string; quantity: number; price: number; discount: number }[];
    product_specs: { id?: string; name: string; value: string }[];
    variant_specs: { id?: string; name: string; value: string }[];
    keywords: string[];
    questions: { id?: string; question: string; answer: string }[];
    freeShippingForAllCountries: boolean;
    freeShippingCountriesIds: { id?: string; label: string; value: string }[];
    shippingFeeMethod: ShippingFeeMethod;
    createdAt: Date; updatedAt: Date;
};
```

- **認可ガード**: `requireStoreOwner`（`src/lib/auth-guards.ts:87-111`）は
  `requireSeller`（`privateMetadata.role === "SELLER"`）→ `db.store.findUnique({ where:
  { url: storeUrl, userId: user.id } })`。Clerk mock は
  `{ id: ownerUserId, privateMetadata: { role: "SELLER" } }`、store は seed 時の `url` を
  `upsertProduct` の第 2 引数に渡す。
- **テスト基盤**: `getTestDb` / `disconnectTestDb`（`tests/integration/setup/db.ts`）、
  `resetDb`（`setup/reset-db.ts`）、`seedUser` / `seedStore` / `seedCategoryWithSubcategory` /
  `seedProductWithVariantAndSize` / `seedCart` / `seedCartItem`（`setup/seed.ts`）。
  Wishlist 行は `db.wishlist.create`（userId / productId / variantId / sizeId）で直接作成。
- **構造の手本**: `tests/integration/order-placement.test.ts`。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Docker 確認 | `docker info` | exit 0（失敗なら STOP） |
| 統合テスト全体 | `bun run test:integration` | 全 pass |
| 単一ファイル | `bun run test:integration -- tests/integration/product-update.test.ts` | all pass |
| 型チェック | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| unit 回帰 | `bun run test` | 全 pass |

## Scope

**In scope**（変更してよいファイル）:
- `tests/integration/product-update.test.ts` — **新規作成**

**Out of scope**（触らない）:
- `src/queries/product.ts` — 検証対象本体。**全置換 → 差分更新への改善・
  `generateUniqueSlug` の tx 内移動などのリファクタは行わない**
- `prisma/schema.prisma` / `prisma/migrations/` — FK 定義の変更は絶対にしない
- `tests/integration/setup/seed.ts`（ヘルパー追加は不要）
- `handleProductCreate` / `handleVariantCreate`（新規作成分岐）— 更新分岐のみが対象。
  作成分岐の slug 検証はシナリオ 2 の衝突相手 seed で間接的に触れるのみ

## Git workflow

- 現行ブランチ `dev` 上で作業してよい。コミット規律は `.claude/rules/02-tdd-step-commit.md`:
  テストファイル新設で 1 コミット（例: `test(integration): add product update replace-children and slug scenarios`）、
  docs 同期は別コミット。push / PR はオペレーターの指示があるまで行わない。

## Steps

### Step 1: drift check とベースライン確認

冒頭の Drift check 実行 → `bun run test:integration` 全 pass 確認。

**Verify**: `bun run test:integration` → 全 pass

### Step 2: `tests/integration/product-update.test.ts` を新設

ファイル冒頭 JSDoc に検証境界（全置換の正確性・tx 原子性・slug suffix・SetNull 連鎖）と
ADR-004 参照を記載。Clerk mock（import より前）+ `mockAuthAsSeller` ヘルパー
（plan 036 と同形 — `{ id, privateMetadata: { role: "SELLER" } }`）。

**入力ビルダー**を最初に書く（これが本プランの実装量の中心）:

```typescript
/** seed 済み product/variant/size から「変更なし」の更新入力を組み立てる */
function buildUpdateInput(
    seeded: { product: Product; variant: ProductVariant; size: Size },
    overrides: Partial<ProductWithVariantType> = {}
): ProductWithVariantType {
    return {
        productId: seeded.product.id,
        variantId: seeded.variant.id,
        name: seeded.product.name,
        description: seeded.product.description,
        variantName: seeded.variant.variantName,
        variantDescription: seeded.variant.variantDescription ?? "",
        images: [{ url: "https://example.test/updated.png" }],
        variantImage: seeded.variant.variantImage,
        categoryId: seeded.product.categoryId,
        subCategoryId: seeded.product.subCategoryId,
        isSale: false,
        brand: seeded.product.brand,
        sku: seeded.variant.sku,
        weight: seeded.variant.weight ?? 1,
        colors: [{ color: "Black" }],
        sizes: [{ size: "L", quantity: 5, price: 120, discount: 0 }],
        product_specs: [{ name: "material", value: "cotton" }],
        variant_specs: [{ name: "fit", value: "regular" }],
        keywords: ["test"],
        questions: [{ question: "Q1?", answer: "A1" }],
        freeShippingForAllCountries: false,
        freeShippingCountriesIds: [],
        shippingFeeMethod: seeded.product.shippingFeeMethod,
        createdAt: seeded.product.createdAt,
        updatedAt: new Date(),
        ...overrides,
    };
}
```

（フィールド名・optional 性は `src/lib/types.ts:64-` の現物と突合すること。型エラーが出たら
現物に合わせる — shape が上記と大きく違う場合は STOP。）

共通 Arrange: `seedUser` → `seedStore({ userId })` → `seedCategoryWithSubcategory` →
`seedProductWithVariantAndSize`。既存の子レコード（旧 spec / 旧 question）は
`db.spec.create` / `db.question.create` で事前投入して「置換前」の状態を作る。

> `seedProductWithVariantAndSize` の戻り値 `{ product, variant, size }` は
> `buildUpdateInput` の第 1 引数 `seeded` の型とそのまま一致するため、
> **`const seeded = await seedProductWithVariantAndSize(db, {...})` と受けて
> 各シナリオで `buildUpdateInput(seeded, overrides)` の形で渡す**
> （分割代入して個別変数にすると呼び出しごとに再構築が必要になる）。

シナリオ:

1. **specs / questions / sizes の全置換が正確（旧行消滅・新行のみ）**:
   旧 spec（name: "old-spec"）/ 旧 question を事前投入 → `upsertProduct(buildUpdateInput(...), store.url)` →
   `db.spec.findMany({ where: { productId } })` が新 spec のみ（"material" 1 件）、
   question も同様、`db.size.findMany` が新 size（"L"）のみで **旧 Size.id と異なる id** を持つ
2. **名前変更で slug 再生成 + 衝突時は `-1` suffix**:
   先に別商品を `seedProductWithVariantAndSize` し、その slug を
   `db.product.update` で `renamed-product` に変更しておく（衝突相手）→
   対象商品を `buildUpdateInput(..., { name: "Renamed Product" })` で更新 →
   `db.product.findUnique(productId).slug === "renamed-product-1"`
   （slugify は lower + `-` 区切り。`generateUniqueSlug` が findFirst で衝突を検知し suffix）
3. **名前不変なら slug 不変**: シナリオ 1 の入力（name 同一）→ slug が seed 時の値のまま
4. **sizes 全置換の下流副作用: Wishlist は SetNull・CartItem は stale**:
   旧 size を参照する `db.wishlist.create`（sizeId: 旧 size.id）と
   `seedCart` + `seedCartItem`（sizeId 内包）を投入 → 更新実行 →
   `db.wishlist.findFirst().sizeId === null`（SET NULL 発火）、
   `db.cartItem.findFirst().sizeId === 旧 size.id`（FK なしのため残存 — checkout 再検証で
   弾かれる経路の前提を固定）
5. **tx 原子性: 全置換が済んだ後段での失敗で、子テーブルが置換前へ巻き戻る**:

   > **失敗注入は tx の「後段」でなければならない。**
   > 当初案の `categoryId: "nonexistent-category-id"`（`category: { connect }` の P2025）は
   > tx の**最初の操作**である `product.update`（`:327-346`）で失敗する。この場合
   > Spec / Question / Size の置換は**そもそも一度も実行されない**ため、旧行が残るのは
   > ロールバックの結果ではなく**単に未実行**なだけであり、
   > 「実行したが巻き戻った」と「最初から実行していない」を区別できない。
   > つまり原子性の証拠にならない（この経路では tx が無くてもテストは green になる）。
   > よって失敗注入は **Size 全置換（`:442-455`）より後**の操作へ置く。

   **注入手段**: tx 内の最終操作は variant 分の Spec 置換（`:458-467`）。`Size` には
   複合 unique 制約が無く（`prisma/schema.prisma:205-216`）重複 size では失敗しないため、
   plan 035 と同型の**テスト内 DDL による一時 CHECK 制約**で Spec の create のみを
   決定論的に落とす:

```typescript
// 旧 spec("old-spec") / 旧 question / 旧 size を Arrange 済みの状態から開始する
await db.$executeRawUnsafe(
    `ALTER TABLE "Spec" ADD CONSTRAINT "tmp_block_boom" CHECK ("value" <> 'BOOM')`
);
try {
    // buildUpdateInput(seeded, overrides) — 第 1 引数に seed 済みの状態を渡す（必須）
    const input = buildUpdateInput(seeded, {
        product_specs: [{ name: "material", value: "cotton" }], // 置換は成功する
        variant_specs: [{ name: "trigger", value: "BOOM" }],    // tx 最終段でここが落ちる
    });
    await expect(upsertProduct(input, store.url)).rejects.toThrow();

    // Assert: 後段の失敗で「既に実行された」前段の置換がすべて巻き戻る = 原子性の実証
    const specs = await db.spec.findMany({ where: { productId: product.id } });
    expect(specs).toHaveLength(1);
    expect(specs[0].name).toBe("old-spec");            // 旧 spec が復活している
    expect(await db.spec.count({ where: { name: "material" } })).toBe(0); // 新 spec は残らない

    const sizes = await db.size.findMany({ where: { productVariantId: variant.id } });
    expect(sizes).toHaveLength(1);
    expect(sizes[0].id).toBe(size.id);                 // 旧 Size.id のまま（置換が巻き戻った）
    expect(sizes[0].size).toBe("M");

    const questions = await db.question.findMany({ where: { productId: product.id } });
    expect(questions[0].question).toBe(oldQuestion.question);
} finally {
    await db.$executeRawUnsafe(`ALTER TABLE "Spec" DROP CONSTRAINT "tmp_block_boom"`);
}
```

   > **旧 Size.id が保たれている**ことが決定的な証拠になる。シナリオ 1 で確認したとおり、
   > Size 置換が実行されれば id は必ず新しくなる。失敗後に**旧 id のまま**なら、
   > 「Size 置換は実行されたが tx のロールバックで取り消された」ことを意味する。
   > 制約の DROP は `finally` で必ず行う（`resetDb` は TRUNCATE であり制約を落とさない）。

**Verify**: `bun run test:integration -- tests/integration/product-update.test.ts` → all pass（5 テスト以上）

### Step 3: 全体回帰

**Verify**:
1. `bun run test:integration` → 既存 + 新規 全 pass
2. `bunx tsc --noEmit` → exit 0
3. `bun run lint` → exit 0
4. `bun run test` → unit 全 pass

## Test plan

Step 2 のシナリオ 1〜5 が本体。構造の手本は `tests/integration/order-placement.test.ts`。
完了後、テスト統計が変わるため **`spec-sync-after-test` skill を必ず起動**
（`.claude/rules/02-tdd-step-commit.md` の MUST。Integration 統計の SSOT は
`docs/testing/QA_HANDOFF.md`）。

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run test:integration` exits 0; `product-update.test.ts` の新規テストが全 pass
- [ ] シナリオ 5 の失敗注入が **Size 全置換（`:442-455`）より後段**で発火している
      （`category: { connect }` 等の tx 冒頭での失敗を使っていないこと。冒頭失敗は
      置換が未実行なだけでロールバックの証拠にならない）
- [ ] シナリオ 5 に「reject + 旧 spec/question/size 残存 + 新行ゼロ」の assert が存在し、
      かつ **旧 Size.id が保たれている**ことを assert している（置換実行後の巻き戻しの証拠）
- [ ] シナリオ 5 の一時 CHECK 制約が `finally` で DROP され、同一ファイルの
      2 回連続実行が 2 回とも pass する
- [ ] シナリオ 4 に Wishlist SetNull と CartItem stale の**両方**の assert が存在する
- [ ] `bunx tsc --noEmit` exits 0 / `bun run lint` exits 0 / `bun run test` exits 0
- [ ] `git status` で in-scope 外のファイルに変更がない
- [ ] docs 同期（QA_HANDOFF 統計 + ダッシュボード再生成）が別コミットで完了
- [ ] `plans/README.md` の 038 行が DONE に更新済み

## STOP conditions

Stop and report back (do not improvise) if:

- `docker info` が失敗する（→ `BLOCKED (Docker unavailable)`）
- Drift check で `handleProductAndVariantUpdate` の全置換構造・`generateUniqueSlug` が
  本プランの抜粋と一致しない（差分更新化などのリファクタ済みの場合 — 本プランの
  前提シナリオが無効）
- `ProductWithVariantType` の shape が本プラン記載と大きく異なり `buildUpdateInput` が
  組めない（`src/lib/types.ts` の現物を確認しても解決しない場合）
- シナリオ 5 で**半置換が観測される**（旧行が消え新行がない等）— `$transaction` の
  ロールバックが機能していない重大所見。実測の残存状態を添えて即報告
- シナリオ 5 で `Spec` への一時 CHECK 制約が付与できない、または DROP に失敗して
  後続テストが汚染される（テスト用 DB ロールの DDL 権限を確認し、それでも不可なら STOP）
- シナリオ 5 で tx が reject **しない**（variant spec の置換に到達していない可能性）—
  `handleProductAndVariantUpdate` の tx 内の操作順序が本プランの抜粋（`:327-468`）と
  変わっていないか確認し、順序が変わっていれば「最後段の操作」を特定し直して報告
- シナリオ 2 の slug が `renamed-product-1` 以外になる（slugify のオプション変更等）—
  実測値を添えて報告（期待値の単純な合わせ込みはしない）
- 検証コマンドが 2 回の修正試行後も失敗する

## Maintenance notes

- **Size.id が編集のたびに変わる**のは既知の設計挙動で、本テストのシナリオ 4 が下流影響
  （Wishlist SetNull / CartItem stale）の仕様書になる。sizes を差分更新（update）に変える
  改善を入れる場合、シナリオ 1 と 4 の期待値を書き換えること。
- plan 012（item-level restock spike）/ plan 027・031（在庫整合）は `Size.quantity` を参照する。
  編集フローが在庫値を上書きする（sizes 全置換で quantity も入力値に置き換わる）ことは
  シナリオ 1 で固定済み — 在庫系プランの実装時にこの相互作用に注意。
- `generateUniqueSlug` は findFirst ループのため**並行作成では理論上 TOCTOU** がある
  （unique 制約が最終防衛線）。並行時の P2002 リトライ化を入れる場合は本テストが回帰網。
