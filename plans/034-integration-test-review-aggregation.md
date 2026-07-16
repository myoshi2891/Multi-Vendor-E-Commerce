# Plan 034: `upsertReview` の評価集計（rating / numReviews）を実 DB 統合テストで固定する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 1750ef2..HEAD -- src/queries/review.ts tests/integration/`
> If any in-scope/referenced file changed since this plan was written, compare
> the "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **前提チェック（Step 0）**: 本プランは Docker（testcontainers）必須。
> `docker info` が失敗する環境では **STOP**（`plans/README.md` の status 列に
> `BLOCKED (Docker unavailable)` と記録して終了）。

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW（テスト新設のみ。`src/` 本体は 1 行も変更しない）
- **Depends on**: none（他プランと完全独立・並行可）
- **Category**: tests
- **Planned at**: commit `1750ef2`, 2026-07-11
- **出典 finding**: TESTS-18（`plans/audit/findings-13-integration-coverage.md`）

## Why this matters

商品の `rating` / `numReviews` はストアフロントの商品カード・商品詳細・プロフィールに広く表示される
**信頼シグナル**だが、その集計（レビュー投稿のたびに全レビューを読み直して平均を再計算し
`product.update` する）は実 DB で一度も検証されていない。unit テスト
（`src/queries/review.test.ts`・16 テスト・全モック）は呼び出し構造しか固定できず、
「同一ユーザーの再投稿が create でなく update になる（numReviews が増えない）」
「複数ユーザーの平均が実データから正しく導出される」という集計の本体は無検証。
集計ドリフトは静かに蓄積し、表示上の平均と実レビューの乖離として顧客に露出する。

## Current state

- `src/queries/review.ts` — 検証対象。**変更しない。** 構造（`:15-144`）:
  1. `currentUser()` で認証（null なら `'Unauthorized.'` throw — `:21-24`）
  2. **User フォールバック upsert**（`:26-41`）: Clerk Webhook 同期漏れに備え
     `db.user.upsert` で DB ユーザーをオンデマンド作成。email は
     `user.emailAddresses[0]?.emailAddress`（無ければ `'User email not found in Clerk.'` throw）
  3. 既存レビュー検索（`:48-53`）: `db.review.findFirst({ where: { productId, userId } })`
  4. 分岐（`:56-104`）: 既存あり → `db.review.update`（images は `deleteMany: {}` + create で
     総入れ替え）/ 既存なし → `db.review.create`
  5. **集計（`:106-131`）— 本プランの主検証対象**:

```typescript
const productReviews = await db.review.findMany({
    where: { productId },
    select: { rating: true },
})
const totalRating = productReviews.reduce((acc, review) => acc + review.rating, 0)
const newAverageRating = totalRating / productReviews.length

const updatedProduct = await db.product.update({
    where: { id: productId },
    data: {
        rating: newAverageRating,
        numReviews: productReviews.length,
    },
})
return reviewDetails
```

  ※ `Product.rating` は `Float`（`prisma/schema.prisma` — レビュー評価であり金額ではないため
  Decimal 規約の対象外）。集計は**非トランザクション**（create → findMany → update の 3 往復）。
- **`ReviewDetailsType`**（`src/lib/types.ts`）: `review` / `rating` / `size` / `quantity` /
  `variant` / `color` / `images: { url: string }[]` を持つ。テストでは全フィールドを埋めた
  fixture を作る（既存 unit テスト `src/queries/review.test.ts` の fixture を参考にしてよい）。
- **認証モック**: `jest.mock("@clerk/nextjs/server", () => ({ currentUser: jest.fn() }))`。
  User フォールバック upsert が通るよう、mock user は最低限
  `{ id, emailAddresses: [{ emailAddress: "x@example.test" }], firstName: "Test",
  lastName: "User", imageUrl: "" }` の形にする（`review.ts:28-38` が参照するフィールド）。
  **DB 側の User seed は不要**（フォールバック upsert 自体が作成する — これも検証対象）。
- **テスト基盤**: `getTestDb` / `disconnectTestDb`（`tests/integration/setup/db.ts`）、
  `resetDb`（`setup/reset-db.ts` — Review / ReviewImage / Product は TRUNCATE 対象済み）、
  `seedUser` / `seedStore` / `seedCategoryWithSubcategory` /
  `seedProductWithVariantAndSize`（`setup/seed.ts`）。
- **構造の手本**: `tests/integration/order-placement.test.ts`（mock 差し替え + lifecycle）。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Docker 確認 | `docker info` | exit 0（失敗なら STOP） |
| 統合テスト全体 | `bun run test:integration` | 全 pass |
| 単一ファイル | `bun run test:integration -- tests/integration/review-aggregation.test.ts` | all pass |
| 型チェック | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| unit 回帰 | `bun run test` | 全 pass（集計不変のはず） |

## Scope

**In scope**（変更してよいファイル）:
- `tests/integration/review-aggregation.test.ts` — **新規作成**

**Out of scope**（触らない）:
- `src/queries/review.ts` — 検証対象本体。**非トランザクション集計の `$transaction` 化などの
  改善も行わない**（コード改善は別プランの領分。バグ発見時は STOP して報告）
- `src/queries/review.test.ts`（unit テスト）
- `tests/integration/setup/`（seed ヘルパー追加は不要）
- `Store.averageRating` の集計（本関数は Product の rating のみ更新する。Store 側の
  評価集計は Round 3 spike 022 の設計対象 — 本プランでは扱わない）

## Git workflow

- 現行ブランチ `dev` 上で作業してよい。コミット規律は `.claude/rules/02-tdd-step-commit.md`:
  テストファイル新設で 1 コミット（例: `test(integration): add review rating aggregation scenarios`）、
  docs 同期は別コミット。push / PR はオペレーターの指示があるまで行わない。

## Steps

### Step 1: drift check とベースライン確認

冒頭の Drift check 実行 → `bun run test:integration` 全 pass 確認。
`src/queries/review.test.ts` の `ReviewDetailsType` fixture の形を確認する。

**Verify**: `bun run test:integration` → 全 pass

### Step 2: `tests/integration/review-aggregation.test.ts` を新設

ファイル冒頭 JSDoc に検証境界（集計の実データ導出・upsert 分岐・User フォールバック）と
ADR-004 参照を記載。共通 Arrange: `seedUser`（store オーナー用）→ `seedStore` →
`seedCategoryWithSubcategory` → `seedProductWithVariantAndSize`。

Clerk mock ヘルパー:

```typescript
function mockAuthAsClerkUser(id: string): void {
    (currentUser as unknown as jest.Mock).mockResolvedValue({
        id,
        emailAddresses: [{ emailAddress: `${id}@example.test` }],
        firstName: "Test",
        lastName: "User",
        imageUrl: "",
    });
}
```

review fixture ビルダー（rating を引数に、他フィールドはダミー固定値）。

シナリオ:

1. **初回投稿で rating / numReviews が設定される**:
   Clerk user "reviewer-1" で `upsertReview(product.id, buildReview({ rating: 4 }))` →
   `db.product.findUnique` で `rating === 4` / `numReviews === 1`。
   加えて **User フォールバック**の検証: `db.user.findUnique({ where: { id: "reviewer-1" } })`
   が存在する（seed していないのに upsert で作成された）
2. **複数ユーザーの平均**: "reviewer-1" が rating 4、"reviewer-2" が rating 2 を投稿 →
   `rating === 3` / `numReviews === 2`（`toBeCloseTo(3, 5)` で assert）
3. **同一ユーザーの再投稿は update（件数不変・平均のみ変動）**:
   シナリオ 2 の状態から "reviewer-1" が rating 5 で再投稿 →
   `db.review.count({ where: { productId } })` === **2**（増えない）、
   `rating === 3.5`（(5+2)/2）、numReviews === 2。
   images 総入れ替えの検証: 再投稿の images が新 URL 1 件なら
   `db.reviewImage.count()` が旧画像ぶん増殖していないこと
4. **商品間の独立性**: 別 Product B を seed し、B へのレビュー投稿が
   Product A の rating / numReviews を変えないこと
5. **未認証は reject + 副作用なし**: `currentUser` を null に →
   `/Unauthorized/` で reject、`db.review.count()` 不変

**Verify**: `bun run test:integration -- tests/integration/review-aggregation.test.ts` → all pass

### Step 3: 全体回帰

**Verify**:
1. `bun run test:integration` → 既存 + 新規（5〜7 テスト目安）全 pass
2. `bunx tsc --noEmit` → exit 0
3. `bun run lint` → exit 0
4. `bun run test` → unit 全 pass（集計不変）

## Test plan

Step 2 のシナリオ 1〜5 が本体。構造の手本は `tests/integration/order-placement.test.ts`。
完了後、テスト統計が変わるため **`spec-sync-after-test` skill を必ず起動**
（`.claude/rules/02-tdd-step-commit.md` の MUST）。

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run test:integration` exits 0; `review-aggregation.test.ts` の新規テストが全 pass
- [ ] シナリオ 3 で `review.count === 2`（再投稿で増えない）の assert が存在する
- [ ] `bunx tsc --noEmit` exits 0 / `bun run lint` exits 0 / `bun run test` exits 0（集計不変）
- [ ] `git status` で in-scope 外のファイルに変更がない
- [ ] docs 同期（QA_HANDOFF 統計 + ダッシュボード再生成）が別コミットで完了
- [ ] `plans/README.md` の 034 行が DONE に更新済み

## STOP conditions

Stop and report back (do not improvise) if:

- `docker info` が失敗する（→ `BLOCKED (Docker unavailable)`）
- Drift check で `review.ts` の集計部分が本プランの抜粋と一致しない
- シナリオ 3 で件数が増える（upsert 分岐が create に落ちる）、またはシナリオ 2 の平均が
  合わない — **本体バグの発見**。期待値を合わせ込まず実測値を添えて報告
- `ReviewDetailsType` に本プラン記載以外の必須フィールドがあり fixture が型エラーになる
  （`src/lib/types.ts` の現物を確認し、それでも不明なら STOP）
- 検証コマンドが 2 回の修正試行後も失敗する

## Maintenance notes

- 集計は非トランザクション（create → findMany → update）のため、**並行投稿では lost update が
  理論上起こりうる**。本プランは逐次実行の集計正しさのみ固定した。並行性の改善
  （`$transaction` 化 or DB 側集計）を入れる場合、本テストは回帰ガードとしてそのまま有効。
- Round 3 spike 019（レビュー UGC ガバナンス）/ 022（セラー指標）は `Store.averageRating` への
  集計供給を設計対象にしている。実装時は本ファイルに Store 側集計のシナリオを追加するのが低コスト。
- レビュー画像の `deleteMany + create` 総入れ替えはシナリオ 3 で軽く固定済み。画像の
  部分更新 UI が入る場合は期待値の見直しが必要。
