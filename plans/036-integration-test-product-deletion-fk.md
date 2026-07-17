# Plan 036: `deleteProduct` の FK Restrict / カスケード削除の実挙動を実 DB 統合テストで固定する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4ec6b5b..HEAD -- src/queries/product.ts prisma/schema.prisma tests/integration/`
> If any in-scope/referenced file changed since this plan was written, compare
> the "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **前提チェック（Step 0）**: 本プランは Docker（testcontainers）必須。
> `docker info` が失敗する環境では **STOP**（`plans/README.md` の status 列に
> `BLOCKED (Docker unavailable)` と記録して終了）。

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW（テスト新設のみ。`src/` 本体は 1 行も変更しない）
- **Depends on**: none（他プランと完全独立・並行可）
- **Category**: tests
- **Planned at**: commit `4ec6b5b`, 2026-07-11
- **出典 finding**: TESTS-20（`plans/audit/findings-14-integration-coverage-r6.md`）

## Why this matters

`deleteProduct` は `db.product.delete` の**ハード削除**だが、`Review.productId → Product` の
FK は **`ON DELETE RESTRICT`**（migration SQL で確認済み）。つまり**レビューが 1 件でも付いた
商品はセラーが削除できず、未処理の P2003 がダッシュボードに 500 として露出する**。一方で
variants / sizes / images / colors / specs / questions / wishlist は **CASCADE** で連鎖消滅する。
「何が消え、何が削除を阻止するか」というこの境界は、`db.product.delete` をモックする unit
テスト（`src/queries/product.test.ts`）では原理的に検証できない。実 DB でこの境界を
characterization として固定すれば、将来の schema 変更（onDelete の変更・ソフト削除化）や
Prisma メジャーアップグレードの回帰網になる。

## Current state

- `src/queries/product.ts:557-589` — 検証対象。**変更しない。** 構造:

```typescript
export const deleteProduct = async (productId: string) => {
    try {
        // 認証 + SELLER ロールを集約検証 (auth-guards に統一)
        const user = await requireSeller();
        if (!productId) throw new Error("Please provide product ID.");

        // 所有権検証: 商品のストアが現在のユーザーに属するか確認（IDOR防止）
        const product = await db.product.findUnique({
            where: { id: productId },
            include: { store: { select: { userId: true } } },
        });
        if (!product) throw new Error("Product not found.");
        if (product.store.userId !== user.id)
            throw new Error("You can only delete your own products.");

        // Delete the product and its variants
        const response = await db.product.delete({
            where: { id: productId },
        });
        return response;
    } catch (error: unknown) {
        // console.error 後にそのまま re-throw（P2003 は握りつぶされずテストで観測できる）
        ...
        throw error;
    }
};
```

- **FK セマンティクス（`prisma/migrations/20260222101357_init_postgresql/migration.sql`）**:
  - `:694` — `Review.productId → Product` **ON DELETE RESTRICT**（削除を阻止する側）
  - CASCADE で連鎖消滅する側（**本プランはこの全件を Arrange で生成し assert する** —
    列挙と検証範囲を一致させること）:
    | テーブル | 親 | 定義 |
    |---|---|---|
    | ProductVariant | Product | schema.prisma:186 |
    | Size | ProductVariant | :210 |
    | ProductVariantImage | ProductVariant | :224 |
    | Color | ProductVariant | :237 |
    | Spec（product 紐付け） | Product | :262 |
    | Spec（variant 紐付け） | ProductVariant | :265 |
    | Question | Product | :280 |
    | FreeShipping | Product | :330 |
    | FreeShippingCountry | FreeShipping | :341（**多段連鎖**: Product → FreeShipping → 本表） |
    | Wishlist | Product / ProductVariant | :648 / :651 |
  - `FreeShippingCountry` は Product の**孫**であり、`Product 削除 → FreeShipping CASCADE →
    FreeShippingCountry CASCADE` の 2 段連鎖でのみ消える。1 段目だけ検証すると多段連鎖の
    回帰を取り逃すため、本プランでは孫まで assert する（`seedCountry` で Country を用意し
    `db.freeShipping.create` → `db.freeShippingCountry.create` の順に作成）
  - `Spec` は `productId` / `variantId` の**両方**が任意 FK（`:262` / `:265`）。どちらの経路でも
    CASCADE するため、Arrange では **2 行**（product 紐付け・variant 紐付け）を作り、
    両方が消えることを assert する
  - `Wishlist.sizeId → Size` は SET NULL（`:745`）だが、product 削除時は Wishlist 行自体が
    productId CASCADE で消えるため本プランでは SET NULL は観測されない（plan 038 の領分）
- **認可ガード**: `requireSeller`（`src/lib/auth-guards.ts:69-75`）は
  `user.privateMetadata?.role !== "SELLER"` で判定する。Clerk mock は
  `{ id, privateMetadata: { role: "SELLER" } }` の形にすること。
- **テスト基盤**: `getTestDb` / `disconnectTestDb`（`tests/integration/setup/db.ts`）、
  `resetDb`（`setup/reset-db.ts` — Review / Wishlist / Question / Spec / Product 系すべて
  TRUNCATE 対象済み）、`seedUser` / `seedStore` / `seedCategoryWithSubcategory` /
  `seedProductWithVariantAndSize`（`setup/seed.ts`）。
- **seed ヘルパーにないレコード**は テストファイル内で `db.review.create` / `db.spec.create` /
  `db.question.create` / `db.wishlist.create` を直接呼んで作成する（seed.ts への追加は不要）。
  Review の必須フィールド（`prisma/schema.prisma:353-377`）: `variant` / `review` / `rating` /
  `color` / `size` / `quantity`（すべて文字列 or Float）+ `userId` / `productId`。
- **構造の手本**: `tests/integration/order-placement.test.ts` — Clerk mock の宣言位置
  （import より前）、`beforeEach` の `resetDb` + `mockReset`、S5「拒否 + 副作用なし」パターン。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Docker 確認 | `docker info` | exit 0（失敗なら STOP） |
| 統合テスト全体 | `bun run test:integration` | 全 pass |
| 単一ファイル | `bun run test:integration -- tests/integration/product-deletion.test.ts` | all pass |
| 型チェック | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| unit 回帰 | `bun run test` | 全 pass |

## Scope

**In scope**（変更してよいファイル）:
- `tests/integration/product-deletion.test.ts` — **新規作成**

**Out of scope**（触らない）:
- `src/queries/product.ts` — 検証対象本体。**「レビュー付き商品を削除可能にする」修正
  （P2003 の事前チェック・ソフト削除化・onDelete 変更）は行わない**（コード修正は
  将来の correctness プランの領分。本プランは現挙動の characterization）
- `prisma/schema.prisma` / `prisma/migrations/` — FK 定義の変更は絶対にしない
- `tests/integration/setup/seed.ts`（ヘルパー追加は不要 — 直接 create で足りる）
- `src/queries/store.ts` の `deleteStore` — ソフト削除（isDeleted フラグ）のため FK 衝突が
  発生せず、本プランの対象外（by-design として findings-14 に記録済み）

## Git workflow

- 現行ブランチ `dev` 上で作業してよい。コミット規律は `.claude/rules/02-tdd-step-commit.md`:
  テストファイル新設で 1 コミット（例: `test(integration): add deleteProduct FK restrict and cascade scenarios`）、
  docs 同期は別コミット。push / PR はオペレーターの指示があるまで行わない。

## Steps

### Step 1: drift check とベースライン確認

冒頭の Drift check 実行 → `bun run test:integration` 全 pass 確認。

**Verify**: `bun run test:integration` → 全 pass（17 テスト以上。他プラン実行済みなら増えていてよい）

### Step 2: `tests/integration/product-deletion.test.ts` を新設

ファイル冒頭 JSDoc に検証境界（FK RESTRICT による削除阻止・CASCADE 連鎖・所有権ガード）と
ADR-004 参照を記載。Clerk mock は import より前に宣言:

```typescript
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));
```

認証ヘルパー（`requireSeller` が privateMetadata.role を見る点が order-placement と異なる）:

```typescript
function mockAuthAsSeller(userId: string): void {
    (currentUser as unknown as jest.Mock).mockResolvedValue({
        id: userId,
        privateMetadata: { role: "SELLER" },
    });
}
```

共通 Arrange ヘルパー: `seedUser` → `seedStore({ userId })` →
`seedCategoryWithSubcategory` → `seedProductWithVariantAndSize`
（product / variant / size / **ProductVariantImage 1 件**を作る — `seed.ts:160-212`）の後、
Current state の CASCADE 表に挙げた**残り全ての子テーブル**を直接 create して揃える:

- `db.color.create`（`productVariantId`）— seed ヘルパーは Color を作らないため必須
- `db.spec.create` × **2**（1 件は `productId` 紐付け、1 件は `variantId` 紐付け）
- `db.question.create`（`productId`）
- `db.wishlist.create`（`userId` / `productId` / `variantId` / `sizeId`）
- `seedCountry` → `db.freeShipping.create`（`productId`）→ `db.freeShippingCountry.create`
  （`freeShippingId` / `countryId`）— 孫までの多段連鎖を作る

> Arrange の網羅性がこのプランの肝。Current state の表に挙げた行のうち 1 つでも
> 生成を省くと、そのテーブルの CASCADE は**未検証のまま「消えた」ことになってしまう**
> （0 件のものを数えて 0 件だったと言っているだけになる）。そのため下記シナリオ 1 では
> **削除前に各テーブルが厳密に期待件数ある**ことを先に assert する。件数は Arrange が
> 決定論的に作るため既知であり、「1 件以上」のような下限で緩める理由がない
> （下限で書くと、Arrange の二重生成や取りこぼしを検出できない）。

再利用のため、全子テーブルの件数をまとめて取る小ヘルパーを置く:

```typescript
async function countProductChildren() {
    const [variant, size, image, color, spec, question, wishlist, freeShipping, fsCountry] =
        await Promise.all([
            db.productVariant.count(),
            db.size.count(),
            db.productVariantImage.count(),
            db.color.count(),
            db.spec.count(),
            db.question.count(),
            db.wishlist.count(),
            db.freeShipping.count(),
            db.freeShippingCountry.count(),
        ]);
    return { variant, size, image, color, spec, question, wishlist, freeShipping, fsCountry };
}
```

シナリオ:

1. **レビューなし商品の削除で子テーブルが連鎖消滅する（CASCADE の実挙動）**:
   Arrange 直後に `countProductChildren()` が**厳密な期待件数**であることを
   1 度の `toEqual` で assert する（削除後の assert と同じ形式に揃える）:

```typescript
// 削除前: Arrange が作った件数と厳密に一致すること。
// spec が 2 なのは productId 紐付け 1 件 + variantId 紐付け 1 件を作るため
// （Spec は両方の FK 経路を持つので、片方だけでは CASCADE の半分しか検証できない）。
expect(await countProductChildren()).toEqual({
    variant: 1, size: 1, image: 1, color: 1, spec: 2,
    question: 1, wishlist: 1, freeShipping: 1, fsCountry: 1,
});
```

   オーナーとして `deleteProduct(product.id)` → resolve。
   `db.product.count` === 0 に加え、`countProductChildren()` が
   **全フィールド 0** であることを 1 度の `toEqual` で assert:

```typescript
expect(await countProductChildren()).toEqual({
    variant: 0, size: 0, image: 0, color: 0, spec: 0,
    question: 0, wishlist: 0, freeShipping: 0, fsCountry: 0,
});
```

   > `toEqual` でオブジェクト全体を比較することで、子テーブルを 1 つ追加したのに
   > assert を足し忘れる漏れが型・差分の両面で顕在化する。
   > `fsCountry: 0` が **Product → FreeShipping → FreeShippingCountry の 2 段連鎖**の証拠。
2. **レビュー付き商品の削除は P2003 で失敗し、商品・子テーブルとも無傷（RESTRICT の実挙動）**:
   別ユーザー（購入者）を `seedUser` し `db.review.create` で rating 4 のレビューを付与 →
   削除前に `const before = await countProductChildren();` を取得 →
   オーナーとして `deleteProduct(product.id)` → **reject**。
   エラーが Prisma FK 違反であること（`rejects.toMatchObject({ code: "P2003" })`、
   合わなければ `rejects.toThrow()` + 捕捉したエラーの `code` を個別 assert）。
   **副作用なしは子テーブル全件で確認する**（シナリオ 1 と検証範囲を揃える）:
   `db.product.count` === 1、`db.review.count` === 1、かつ
   `expect(await countProductChildren()).toEqual(before)`。
   > 商品と variant だけを数えると「RESTRICT で削除が止まった」ことは分かっても、
   > **部分的に子だけ消えていない**ことは示せない。DB は tx 内で子の CASCADE を
   > 実行してから RESTRICT に到達しうるため、全件不変の assert が原子性の証拠になる。
3. **非所有商品の削除は拒否 + 副作用なし（IDOR ガードの実 DB 検証）**:
   別セラー（store 非所有）として mock →
   `rejects.toThrow("You can only delete your own products.")`、`db.product.count` 不変
4. **存在しない productId は "Product not found."**: `rejects.toThrow("Product not found.")`

**Verify**: `bun run test:integration -- tests/integration/product-deletion.test.ts` → all pass（4 テスト以上）

### Step 3: 全体回帰

**Verify**:
1. `bun run test:integration` → 既存 + 新規 全 pass
2. `bunx tsc --noEmit` → exit 0
3. `bun run lint` → exit 0
4. `bun run test` → unit 全 pass（本プランは unit に触れないため不変のはず）

## Test plan

Step 2 のシナリオ 1〜4 が本体。構造の手本は `tests/integration/order-placement.test.ts`。
完了後、テスト統計が変わるため **`spec-sync-after-test` skill を必ず起動**
（`.claude/rules/02-tdd-step-commit.md` の MUST。Integration 統計の SSOT は
`docs/testing/QA_HANDOFF.md`）。

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run test:integration` exits 0; `product-deletion.test.ts` の新規テストが全 pass
- [ ] Arrange が Current state の CASCADE 表の**全行**（Color / Spec×2 / Question / Wishlist /
      FreeShipping / FreeShippingCountry を含む）を生成し、シナリオ 1 で削除前に
      **厳密な期待件数**（Spec は 2、他は 1）を 1 度の `toEqual` で assert している
      （`>= 1` のような下限では Arrange の二重生成・取りこぼしを検出できない）
- [ ] シナリオ 1 が子テーブル**全件** 0 を assert している（`fsCountry` = 多段連鎖を含む）
- [ ] シナリオ 2 に「reject + 商品/レビュー残存」に加え、**子テーブル全件不変**の assert が存在する
- [ ] `bunx tsc --noEmit` exits 0 / `bun run lint` exits 0 / `bun run test` exits 0
- [ ] **コードコミットの直前**で、`git status` に in-scope 外の変更がない（プラン index の更新と `spec-sync-after-test` の docs 同期は、後続の別コミット）
- [ ] docs 同期（QA_HANDOFF 統計 + ダッシュボード再生成）が別コミットで完了
- [ ] `plans/README.md` の 036 行が DONE に更新済み

## STOP conditions

Stop and report back (do not improvise) if:

- `docker info` が失敗する（→ `BLOCKED (Docker unavailable)`）
- Drift check で `deleteProduct` が本プランの抜粋と一致しない（特にソフト削除化・
  P2003 事前チェックが既に入っている場合 — 本プランの前提が消えている）
- **シナリオ 2 で削除が成功してしまう** — FK が RESTRICT でなくなっている
  （schema/migration が変わった）。characterization の前提が崩れているので、
  実際の FK 定義を添えて報告
- シナリオ 1 でいずれかの子テーブルが残存する — CASCADE 定義のドリフト。実測の残存
  テーブル名を添えて報告
- シナリオ 2 で子テーブルの件数が Arrange 前後で変化する（＝ RESTRICT で失敗したのに
  一部の子だけ消えている）— FK 制約の評価順序・原子性の問題。実測の差分を添えて報告
- Current state の CASCADE 表と `prisma/schema.prisma` の `onDelete` 定義が一致しない
  （`grep -nE "onDelete" prisma/schema.prisma` で突合すること）— 表を実態に合わせて
  更新してよいか判断が要るため STOP
- 検証コマンドが 2 回の修正試行後も失敗する

## Maintenance notes

- 本テストは「レビュー付き商品は削除できない」という**現挙動を固定**するもの。プロダクト
  判断として削除可能にする場合（レビュー先行削除・ソフト削除化・onDelete 変更のいずれか）、
  シナリオ 2 の期待値を意図的に反転させること — その際は migration が必要になる
  （`.claude/rules/03-data-model-diagram-sync.md` の ERD 再生成義務にも注意）。
- `deleteStore` がソフト削除である一方 `deleteProduct` がハード削除である非対称は、
  将来の RMA / 注文履歴表示（OrderItem.productId は FK なし平文字列のため削除後も残る）
  との整合で再考されうる。その設計変更時に本テストが境界の仕様書代わりになる。
