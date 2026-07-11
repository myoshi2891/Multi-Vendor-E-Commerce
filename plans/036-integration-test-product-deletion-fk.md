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
  - CASCADE で連鎖消滅する側: ProductVariant（schema.prisma:186）→ Size（:210）/
    ProductVariantImage（:224）/ Color（:237）、Spec（:262）、Question（:280）、
    FreeShipping（:330）、Wishlist（:648）
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
`seedCategoryWithSubcategory` → `seedProductWithVariantAndSize` の後、
`db.spec.create`（productId 紐付け）・`db.question.create`・`db.wishlist.create`
（userId / productId / variantId / sizeId）を直接作成して子テーブルを揃える。

シナリオ:

1. **レビューなし商品の削除で子テーブルが連鎖消滅する（CASCADE の実挙動）**:
   オーナーとして `deleteProduct(product.id)` → resolve。
   `db.product.count` === 0、`db.productVariant.count` === 0、`db.size.count` === 0、
   `db.productVariantImage.count` === 0、`db.spec.count` === 0、`db.question.count` === 0、
   `db.wishlist.count` === 0 をすべて assert（削除前に各 1 件以上あることも Arrange 直後に確認）
2. **レビュー付き商品の削除は P2003 で失敗し、商品・子テーブルとも無傷（RESTRICT の実挙動）**:
   別ユーザー（購入者）を `seedUser` し `db.review.create` で rating 4 のレビューを付与 →
   オーナーとして `deleteProduct(product.id)` → **reject**。
   エラーが Prisma FK 違反であること（`rejects.toMatchObject({ code: "P2003" })`、
   合わなければ `rejects.toThrow()` + 捕捉したエラーの `code` を個別 assert）。
   副作用なし: `db.product.count` === 1、`db.productVariant.count` === 1、
   `db.review.count` === 1（S5「拒否 + 副作用なし」パターン）
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
- [ ] シナリオ 2 に「reject + 商品/レビュー残存」の両方の assert が存在する
- [ ] `bunx tsc --noEmit` exits 0 / `bun run lint` exits 0 / `bun run test` exits 0
- [ ] `git status` で in-scope 外のファイルに変更がない
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
- 検証コマンドが 2 回の修正試行後も失敗する

## Maintenance notes

- 本テストは「レビュー付き商品は削除できない」という**現挙動を固定**するもの。プロダクト
  判断として削除可能にする場合（レビュー先行削除・ソフト削除化・onDelete 変更のいずれか）、
  シナリオ 2 の期待値を意図的に反転させること — その際は migration が必要になる
  （`.claude/rules/03-data-model-diagram-sync.md` の ERD 再生成義務にも注意）。
- `deleteStore` がソフト削除である一方 `deleteProduct` がハード削除である非対称は、
  将来の RMA / 注文履歴表示（OrderItem.productId は FK なし平文字列のため削除後も残る）
  との整合で再考されうる。その設計変更時に本テストが境界の仕様書代わりになる。
