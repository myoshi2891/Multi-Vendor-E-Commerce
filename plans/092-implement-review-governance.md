# Plan 092: レビューに購入検証・モデレーション・通報・店舗評価集計を入れる（019 の後続実装）

> **Executor 向け指示**: 手順どおりに進め、各 Step の Verify コマンドの期待結果を確認してから次へ進む。
> STOP conditions に当たったら即時に止めて報告する。完了したら `plans/README.md` の本プランの行を更新する。
> 設計の根拠はすべて [`docs/design/review-governance/design.md`](../docs/design/review-governance/design.md)（以下「design」）にある。
> **着手前に design を最後まで読むこと。** 本プランと design が食い違ったら design を正とし、差分を報告する。
>
> **ドリフトチェック（最初に実行）**:
> ```bash
> git diff --stat 1f5d3927 -- prisma/schema.prisma src/queries/review.ts src/queries/product.ts src/lib/schemas.ts src/app/api/index-products/route.ts src/queries/profile.ts
> git status --porcelain -- prisma/schema.prisma src/queries/review.ts src/queries/product.ts src/lib/schemas.ts
> ```
> plan 091（`product.ts` の投稿者 select）以外の差分があれば「Current state」と突き合わせる。

## Status

- **Priority**: P3（マーケットプレイスの信頼 — Phase C）
- **Effort**: L（スキーマ + backfill + 4 つの Server Action + 表示 4 経路 + admin UI）
- **Risk**: MED（評価集計の変更が商品・店舗の表示と並び順に波及する。マイグレーションに backfill と CHECK 制約を含む）
- **Depends on**: 091（公開経路の投稿者 select。本プランの表示経路の変更はその上に重ねる）
- **Category**: direction
- **Planned at**: commit `1f5d3927`, 2026-10-18

## Why this matters

レビューは購入の判断材料だが、現状は誰でも任意の商品にレビューを書け、審査も通報もできず、
**店舗の評価（`Store.averageRating`）はどこからも更新されない**ため、店舗ページには常に初期値の 0 が出る。
加えて `upsertReview` はサーバー側で入力を検証しておらず、範囲外の rating を保存すると平均が汚れる。
このプランで、購入者バッジ・ポリシーで厳しさを切り替えられる審査・通報・正しい店舗評価をそろえる。
セラー品質指標（plan 022）はここで作る店舗評価を入力に使う。

## Current state

- `prisma/schema.prisma:541-565` `model Review` — `rating Float`、`likes Int @default(0)`（未使用）、
  `@@unique([userId, productId])`。状態・購入検証の列は無い
- `prisma/schema.prisma:138-139` `Store.averageRating Float @default(0)` / `numReviews Int @default(0)` — 書き込み経路 0 件
- `src/queries/review.ts:15-192` `upsertReview`:
  - `:22` `const user = await requireUser()`（try の外 — 維持する）
  - `:46-57` User 行のオンデマンド作成（`createMany` + `skipDuplicates`。**`upsert` に戻さない** — `:32-42` のコメントのとおり実測で P2002 が出る）
  - `:83-178` `db.$transaction(async (tx) => { … })`:
    ```ts
    await tx.$queryRaw`
        SELECT "id" FROM "Product" WHERE "id" = ${productId} FOR UPDATE
    `
    const existingReview = await tx.review.findFirst({ where: { productId, userId: user.id } })
    // … update / create …
    const productReviews = await tx.review.findMany({ where: { productId }, select: { rating: true } })
    const totalRating = productReviews.reduce((acc, review) => acc + review.rating, 0)
    await tx.product.update({ where: { id: productId },
        data: { rating: totalRating / productReviews.length, numReviews: productReviews.length } })
    ```
  - `:77-79` のコメント「`Review` には (productId, userId) の unique 制約が無い」は**事実と異なる**（制約はある）
- `src/lib/schemas.ts:457-470` `AddReviewSchema` — `rating: z.number().min(1, …)`（上限・刻みなし）。`upsertReview` からは呼ばれていない
- UI は 0.5 刻みの星（`src/components/store/forms/review-details.tsx:25-31`）
- 公開の表示経路（すべて `status` 条件なし）: `src/queries/product.ts:1628-1635`（商品ページ先頭 4 件）、
  `:2011-2066` `getProductFilteredReviews`、`:1829-1866` `getRatingStatistics`、
  `src/app/api/index-products/route.ts:250-262` と同ファイルのもう 1 か所（最新 5 件）
- 本人向け: `src/queries/profile.ts:451-465` `getUserReviews`
- 規約:
  - 認可は `src/lib/auth-guards.ts` の `requireUser` / `requireAdmin` を **try の外**で呼ぶ（tech.md「認可ガード」）
  - 外部呼び出しは try/catch、`console.error("[Module:Function] …", { error: error.message, stack: error.stack })`
  - スキーマ変更は `bunx prisma migrate dev`（`db push` 禁止）、既存マイグレーションは編集しない
  - スキーマ変更後は `bun run erd:generate`（`.claude/rules/03-data-model-diagram-sync.md`）
  - IDOR テストは 3 階層（(a) throw / (b) where 構造 / (c) 副作用なし — `docs/testing/SECURITY_GAP_REPORT.md` §5.2）
  - UI の変更は `.agent/skills/design-system-workflow/SKILL.md` に従う

## Commands you will need

| 目的 | コマンド | 期待 |
|---|---|---|
| マイグレーション作成 | `bunx prisma migrate dev --create-only --name review_governance` | SQL ファイルが生成される（適用しない） |
| マイグレーション適用（ローカル） | `bunx prisma migrate dev` | 適用成功 |
| クライアント再生成 | `bunx prisma generate` | exit 0 |
| ERD 再生成 | `bun run erd:generate` | stderr に orphan WARNING なし |
| 単体テスト | `bunx jest src/queries/review.test.ts src/queries/product.test.ts` | all pass |
| 統合テスト | `bun run test:integration -- tests/integration/review-aggregation.test.ts` | all pass |
| 型チェック | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run lint` | エラー 0 |
| デザイン検証（admin 画面） | `DESIGN_SUITE=<suite> bun run test:design` | pass（suite は `playwright.design.config.ts` に 1 行追加） |

## Suggested executor toolkit

- `safe-migration` スキル（Step 1 のマイグレーション）
- `server-action-scaffold` スキル（Step 5・6 の新規 Server Action）
- `erd-diagram-adjust` スキル（ERD 再生成後に線が重なった場合）
- `spec-sync-after-test` スキル（最後のドキュメント同期）

## Scope

**In scope**:
- `prisma/schema.prisma`、`prisma/migrations/<new>/migration.sql`（新規）、`docs/architecture/data-model.drawio`（再生成）
- `src/lib/review-visibility.ts`（新規: `PUBLIC_REVIEW_STATUSES` / `publicReviewWhere()`）
- `src/lib/schemas.ts`（`AddReviewSchema.rating`、`ReportReviewSchema` / `ModerateReviewSchema` の追加）
- `src/queries/review.ts`（`upsertReview` の改修、`reportReview` / `moderateReview` / `getReviewModerationQueue` の追加）
- `src/queries/product.ts`、`src/app/api/index-products/route.ts`（公開集合の条件）
- `src/queries/profile.ts`（本人向けに `status` / `isVerifiedPurchase` を返す）
- 表示: `src/components/store/cards/review.tsx`（購入者バッジ・通報ボタン）、プロフィールのレビュー一覧（状態バッジ）
- admin: `src/app/dashboard/admin/reviews/page.tsx`（新規）と `src/components/dashboard/` 配下の表
- テスト: `src/queries/review.test.ts`、`src/queries/product.test.ts`、`tests/integration/review-aggregation.test.ts`、該当コンポーネントのテスト
- `plans/DEFERRED.md`（`likes` 削除と `ReviewVote` の先送りを記録）、`plans/README.md`

**Out of scope**:
- `likes` 列の削除・helpful 投票（design §7）
- 返金後のバッジ再判定、却下・削除の通知（design §8）
- `ModerationPolicy` の管理画面での編集（SQL / Prisma Studio で運用）
- 顧客 Q&A（design §7.2）

## Git workflow

- ブランチ: `dev` から作業ブランチを切る（例: `feat/review-governance`）
- 1 論理単位 = 1 コミット、TDD は Red / Green / Refactor でコミットを分ける（`.claude/rules/02-tdd-step-commit.md`）。
  例: `feat(db): add review moderation schema and backfill store ratings`
- コミット・push・PR はユーザーの依頼があったときだけ

## Steps

### Step 0: データの事前確認（読み取りのみ）

ローカルの DB と、適用予定の各環境で、CHECK 制約に違反する行と現在の集計を記録する:

```sql
SELECT COUNT(*) FROM "Review" WHERE NOT ("rating" >= 1 AND "rating" <= 5 AND "rating" * 2 = trunc("rating" * 2));
SELECT SUM("numReviews") FROM "Product";
SELECT COUNT(*) FROM "Review";
```

**Verify**: 1 本目が `0`。0 でなければ **STOP**（データ修正の方針はユーザーが決める）。2 本目と 3 本目を記録する。

### Step 1: スキーマとマイグレーション

design §3.1・§3.3・§4.1 のとおりに追加する:
- `enum ReviewStatus`、`Review.status ReviewStatus @default(PUBLISHED)`、`Review.isVerifiedPurchase Boolean @default(false)`、
  `@@index([productId, status])`
- `enum ModerationSubject` / `enum ModerationMode` / `model ModerationPolicy`（**行は作らない** — コードの既定値で動く）
- `enum ReviewReportReason` / `model ReviewReport`（`User` と `Review` に逆リレーションを追加）
- `likes` に `/// 未使用（helpful 投票は未実装・design review-governance §7）`

`--create-only` で生成した SQL の末尾に、design §5.4 の Store backfill、同じ形の Product 再計算、
§6.2 (ii) の CHECK 制約（`ALTER TABLE "Review" ADD CONSTRAINT "Review_rating_range" CHECK (…)`）を手で追記してから適用する。

**Verify**: `bunx prisma migrate dev` 成功 → `SELECT SUM("numReviews") FROM "Product"` が Step 0 と同じ値 →
`SELECT SUM("numReviews") FROM "Store"` が `SELECT COUNT(*) FROM "Review"` と等しい → `bun run erd:generate` で WARNING なし

### Step 2: 公開集合のヘルパーと Zod

- `src/lib/review-visibility.ts`: `export const PUBLIC_REVIEW_STATUSES = [ReviewStatus.PUBLISHED, ReviewStatus.FLAGGED] as const` と
  `export const publicReviewWhere = (where: Prisma.ReviewWhereInput = {}): Prisma.ReviewWhereInput => ({ ...where, status: { in: [...PUBLIC_REVIEW_STATUSES] } })`
- `src/lib/schemas.ts`: `rating: z.number().min(1, …).max(5, "Rating must be at most 5.").multipleOf(0.5, "Rating must be in 0.5 steps.")`。
  `ReportReviewSchema`（`reviewId` / `reason` / `note` は 500 字以下）と `ModerateReviewSchema`（`reviewId` / `action: "approve" | "reject" | "remove" | "restore"` / `reason`。`reject` と `remove` は reason 必須）を追加

**Verify**: `bunx jest src/lib` → pass（新規: `multipleOf` の境界 1 / 5 / 4.5 / 0.5 / 5.5 / 2.25 / NaN）

### Step 3: `upsertReview` の改修（TDD）

Red を先に書く（`src/queries/review.test.ts`）:
- 範囲外・刻み違いの rating は DB に触れずに拒否される
- `requireVerifiedPurchase=true` かつ未購入なら拒否、`false` なら `isVerifiedPurchase=false` で保存
- 購入判定の `orderItem.count` の where が design §2.1 と一致する（(b) 構造検証）
- mode=`PRE` の新規投稿は `PENDING_REVIEW`、`REMOVED` の編集は拒否、`FLAGGED` の編集は `FLAGGED` のまま（design §3.2）
- 集計の `aggregate` が `status in 公開集合` で呼ばれ、`product.update` と `store.update` の両方が呼ばれる

Green の形（`$transaction` の中、design §5.2 の順序を守る）:
1. 認可の後、try の外で `AddReviewSchema` 相当を `safeParse`（失敗は `"Invalid review data."` 等で throw）
2. Product を `FOR UPDATE` → `tx.product.findUnique({ select: { storeId } })` → Store を `FOR UPDATE`
3. ポリシー読み込み（`tx.moderationPolicy.findUnique({ where: { subject: "REVIEW" } })`、無ければ既定値）
4. 購入判定 → 既存レビューの状態で分岐 → create / update（`status` / `isVerifiedPurchase` を書く）
5. `tx.review.aggregate({ where: publicReviewWhere({ productId }), _avg: { rating: true }, _count: { _all: true } })` → `product.update`
6. 同じく `publicReviewWhere({ product: { storeId } })` で → `store.update`（`_avg` が null なら 0）
7. `:77-79` のコメントを事実に合わせて直す（unique 制約はあり、FOR UPDATE は同時の二重送信で P2002 を出さないためのもの）

集計の 5〜6 は Step 5 でも使うので、ファイル内の非 export 関数 `recomputeRatings(tx, productId, storeId)` にまとめる。

**Verify**: `bunx jest src/queries/review.test.ts` → pass

### Step 4: 並行性の統合テスト

`tests/integration/review-aggregation.test.ts` に追加する:
- 同じ店舗の**別商品**へ 2 ユーザーが同時投稿 → `Store.numReviews` = 2、`averageRating` = 2 件の平均（デッドロックしない）
- 同じ商品へ同時投稿（既存シナリオ）で `Store` 側も正しい
- `REMOVED` にしたレビューが Product と Store の両方の集計から外れる

**Verify**: `bun run test:integration -- tests/integration/review-aggregation.test.ts` → pass

### Step 5: 通報とモデレーションの Server Action（TDD・IDOR 3 階層）

`src/queries/review.ts` に追加する:
- `reportReview(input)`: `requireUser`（try の外）→ `ReportReviewSchema` → tx の中で Review を `FOR UPDATE`、
  公開集合でなければ / 自分のレビューなら拒否 → `reviewReport.create`（P2002 は成功扱い）→
  mode=`POST` かつ未解決の通報数 ≥ `flagThreshold` なら `PUBLISHED → FLAGGED`
- `moderateReview(input)`: `requireAdmin`（try の外）→ `ModerateReviewSchema` → tx の中で Product → Store → Review の順にロック →
  design §3.2 の遷移表にない遷移は `"Invalid moderation transition."` で拒否 → 状態を更新 →
  公開集合への出入りがあれば `recomputeRatings` → `restore` / `remove` なら未解決の通報に `resolvedAt` を入れる
- `getReviewModerationQueue({ status, page })`: `requireAdmin`、`normalizePageParam` を使う

テスト（`review.test.ts`）:
- (a) USER が `moderateReview` を呼ぶと `"Only admins can perform this action."`、未認証の `reportReview` は `"Unauthenticated."`
- (b) `reportReview` の更新 where が `reviewId` とサーバー側で判定した状態に限定されている
- (c) 拒否された場合に `review.update` / `reviewReport.create` / 集計が呼ばれない
- 遷移表の全行（許可 / 拒否）

**Verify**: `bunx jest src/queries/review.test.ts` → pass

### Step 6: 表示経路に公開集合を効かせる

`product.ts` の 3 経路（商品ページ・`getProductFilteredReviews`・`getRatingStatistics` の `groupBy` と `count`）と
`index-products/route.ts` の 2 か所の `where` を `publicReviewWhere(...)` で包む。公開経路で `isVerifiedPurchase` を返し、
`cards/review.tsx` にバッジを出す。`profile.ts` の `getUserReviews` は条件を付けずに `status` を返し、本人の一覧に状態バッジを出す。

テスト: `product.test.ts` に各経路の where 構造検証を足す（plan 091 のテストと同じ形）。
「非公開レビューが商品ページと評価集計の両方から除外される」ことを統合テストでも確認する。

**Verify**: `grep -n "db.review.\(findMany\|count\|groupBy\)" src/queries/product.ts src/app/api/index-products/route.ts` の全ヒットで、
同じ呼び出しの中に `publicReviewWhere` がある / `bunx jest src/queries/product.test.ts` → pass

### Step 7: UI（通報ボタンと admin の審査キュー）

`design-system-workflow` に従い、先に計画を `plans/layout-design/` 配下に保存する。
- `cards/review.tsx` に通報ボタン（理由の選択 + 任意のメモ）。ログインしていなければサインインへ誘導する。リエントランシーガードは `useRef`
- `src/app/dashboard/admin/reviews/page.tsx`（`export const dynamic = 'force-dynamic'`、`requireAdmin` で保護）に、
  `src/app/dashboard/admin/orders/` と同じ TanStack table の形で、状態フィルタと承認 / 却下 / 削除 / 復帰の操作を置く。
  列定義は render のたびに作らない（memory: DataTable 列定義の remount）

**Verify**: コンポーネントテストが pass、`DESIGN_SUITE=<suite> bun run test:design` が pass、`bun run check:playwright` が pass

### Step 8: ドキュメント同期

- `plans/DEFERRED.md` に「`Review.likes` の削除と `ReviewVote`（design §7）」を追記
- `specs/multi-vendor-ecommerce/03-data-model.md` / `04-interfaces.md` / `05-workflows.md` に新モデルと Server Action を反映
- `spec-sync-after-test` でテスト統計を同期し、`docs/coverage-dashboard.html` を再生成する

**Verify**: `bun run test` の件数が QA_HANDOFF.md の統計と一致する

## Test plan

- 単体: `review.test.ts`（Step 3・5）、`product.test.ts`（Step 6）、`schemas` の境界（Step 2）
- 統合: `review-aggregation.test.ts`（Step 4・6 — 並行投稿、別商品・同店舗、非公開化の除外）
- コンポーネント: 通報ボタンと審査キュー（Step 7）
- 雛形: `review.test.ts` の既存のモック構成と、`order.test.ts` の IDOR 3 階層テスト

## Done criteria

- [x] `bunx tsc --noEmit` exit 0、`bun run lint` エラー 0
- [x] `bun run test` pass（新規テストを含む）
- [x] `bun run test:integration` pass。**並行投稿で Product と Store の集計が正しいテスト**と、**非公開レビューが表示と集計の両方から除外されるテスト**がある
- [x] `moderateReview` / `reportReview` に IDOR 3 階層のテストがある
- [x] Step 1 の Verify（Product 合計が不変、Store 合計 = 全レビュー数）を満たした（Step 0 の前提が崩れたため置き換えた検証で確認 — 「実施結果」の Step 0 を参照）
- [x] `bun run erd:generate` 済みで、`data-model.drawio` がスキーマの変更と同じコミットにある
- [x] Step 6 の grep で、公開経路の全ヒットに `publicReviewWhere` がある
- [x] `plans/README.md` の本プランの行を更新した
- [ ] マイグレーション 3 本（`review_governance` / `review_moderation_reason` / `moderation_policy_updated_at_default`）をリモート DB（Neon）へ適用した（オペレーター作業）

## STOP conditions

- Step 0 で CHECK 制約に違反する行が見つかった
- Store を `FOR UPDATE` するとデッドロック（`40P01`）が統合テストで再現した（ロックの順序がどこかで逆になっている）
- Step 1 の Verify で Product の `numReviews` 合計が Step 0 から変わった（backfill の SQL が誤っている）
- 表示経路の調査中に、design §1 の表にない公開経路が見つかった（設計の更新が必要）
- `ModerationPolicy` を spike 016 がすでに別の形で実装していた（016 の決定を正とし、差分を報告する）

## Maintenance notes

- 新しい公開経路でレビューを読むときは必ず `publicReviewWhere()` を通すこと（Step 6 の grep をレビューで確認する）
- Store 集計の更新は `recomputeRatings` だけが行う。plan 022（セラー品質指標）はこの値を読むだけにし、別の書き込み経路を作らない
- レビュアーが最も精査すべき点: トランザクション内のロックの順序（Product → Store → Review）、`aggregate` の where の公開集合、backfill の冪等性
- 同じ店舗の投稿が Store ロックで直列になる。ロック待ちが問題になったら design §5.2 のトレードオフ（非同期再計算）を参照

## 実施結果（2026-10-18・コミット済み / リモート DB 適用待ち）

- **環境**: `.env` は Neon（リモート）を指すため、マイグレーションの作成・適用はローカルの Docker 開発 DB
  （`docker compose up -d db`・`localhost:5432/multivendor_dev`）に環境変数を上書きして行った。
  **リモート（Neon・本番）への適用は未実施**（オペレーターが `safe-migration` / `migrate deploy` で行う）。
  対象は `review_governance` / `review_moderation_reason` / `moderation_policy_updated_at_default` の 3 本で、
  3 本すべての適用を確認してから完了とする。
- **Step 0**: CHECK 違反 0 件。`COUNT(Review)=154` に対し `SUM(Product.numReviews)=15`（36 商品が不一致）。
  原因は seeder が集計を更新しないこと（DEFERRED: REVIEW-SEED-AGGREGATES）で、backfill の誤りではない。
  そのため Step 1 の検証は「Product 合計が不変」ではなく、**全商品・全店舗で集計値が実値と一致すること**
  （不一致 0 件・`SUM(Store.numReviews)=154`）に置き換えた。
- **Step 1**: `20261018062043_review_governance`（enum 4・列 2・`ReviewReport`・`ModerationPolicy`・CHECK・backfill）
  と、理由の保存先が無かったため追加した `*_review_moderation_reason`（`moderationReason` / `moderatedAt`）。
  ERD は Customer Activity ページに 2 モデルを追加して再生成（WARNING 0）。
- **Step 2〜6**: `src/lib/review-visibility.ts` / `src/lib/review-moderation.ts`（状態機械を純粋関数化）、
  `schemas.ts`（`ReviewRatingSchema` / `UpsertReviewSchema` / `ReportReviewSchema` / `ModerateReviewSchema`）、
  `review.ts`（`upsertReview` 改修・`reportReview` / `moderateReview` / `getReviewModerationQueue`）、
  表示 5 か所に `publicReviewWhere()`。各 Step は Red（期待値の不一致または未実装）を確認してから Green。
  例外: `index-products/route.test.ts` の 1 件は実装後に書いたため、実装を外すと失敗することを変異テストで確認した。
- **Step 7（UI）**: [UI 計画](layout-design/review-governance-ui-plan.md)。fixture suite `review-governance` 12/12、
  回帰 `purchase` 82/82・`postpurchase` 35/35。認証後の実ルートは保留（専用 DB と ADMIN アカウントが要る）。
- **検証**: 全体 Jest 3462 passed / 3465 total（345 スイート）、統合 262/262（19 スイート）、tsc 0、
  lint エラー 0（既存の警告 8）、`check:playwright` 成功。

