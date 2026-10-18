# Plan 091: 公開レビュー経路が投稿者の email / role を返さないようにする

> **Executor 向け指示**: 手順どおりに進め、各 Step の Verify コマンドの期待結果を確認してから次へ進む。
> STOP conditions に当たったら即時に止めて報告する。完了したら `plans/README.md` の本プランの行を更新する。
>
> **ドリフトチェック（最初に実行）**:
> ```bash
> git diff --stat 1f5d3927 -- src/queries/product.ts src/lib/types.ts src/queries/product.test.ts
> git status --porcelain -- src/queries/product.ts src/lib/types.ts src/queries/product.test.ts
> ```
> 差分があれば「Current state」の抜粋と現行コードを突き合わせる。

## Status

- **Priority**: P1（認証なしで全レビュー投稿者のメールアドレスを列挙できる）
- **Effort**: S
- **Risk**: LOW（返却フィールドを減らすだけ。表示に使うのは `name` / `picture` のみ）
- **Depends on**: なし
- **Category**: security
- **Planned at**: commit `1f5d3927`, 2026-10-18
- **発見経緯**: spike [019](019-spike-review-ugc-governance.md) の Step 1（レビュー表示経路の棚卸し）で発見。019 の STOP 条件「即時悪用可能な欠陥 → P1 として先に報告」に従い独立プラン化した

## Why this matters

商品ページのレビュー取得 2 経路が `include: { user: true }` で `User` 行を丸ごと返している。
`User` は `email`（`@unique`）と `role` を持つ（`prisma/schema.prisma:18-23`）。どちらの経路も認証なしで到達でき、
結果はブラウザへ直列化されるため、**任意の訪問者がレビュー投稿者のメールアドレスと権限ロールを収集できる**。
表示に使っているのは `name` と `picture` だけで、残りは不要な露出である。

## Current state

- `src/queries/product.ts`（`"use server"`）:
  - `getProductPageData` 内の `db.product.findUnique` の include（`:1628-1634`）:
    ```ts
    reviews: {
        include: {
            images: true,
            user: true,          // ← User 全列
        },
        take: 4,
    },
    ```
    返り値の `reviews` は `src/app/(store)/product/[productSlug]/[variantSlug]/page.tsx:139` から
    `'use client'` の `ProductReviews` に props として渡る（RSC ペイロードに載る）。
  - `getProductFilteredReviews`（`:2011-2064`、コメント `Access Level: Public`、認証なし）:
    ```ts
    const reviews = await db.review.findMany({
        where: reviewFilter,
        include: {
            images: true,
            user: true,          // ← User 全列
        },
        ...
    ```
    `src/components/store/product-page/reviews/product-reviews.tsx:59` がクライアントから直接呼ぶ Server Action。
- 表示側の消費: `src/components/store/cards/review.tsx:15-27` は `user.name` と `user.picture` だけを読む。
- 型: `src/lib/types.ts:246-249`
  ```ts
  export type ReviewWithImageType = Review & {
      images: ReviewImage[];
      user: User;
  };
  ```
- **前例（合わせる形）**: 公開検索 API `src/app/api/index-products/route.ts:257-261` は
  `user: { select: { name: true } }`、`src/queries/message.ts:348-351` は `{ name, picture }` だけを返す。
- 対象外の確認済み経路（変更しない）: `review.ts:123,145`（投稿者本人への返却）、
  `profile.ts:455`（本人のレビュー一覧）、`user.ts:497`（本人の住所）、`order.ts` / `dashboard.ts` / `store.ts`（seller / admin の認可済み経路）。

## Commands you will need

| 目的 | コマンド | 期待 |
|---|---|---|
| 単体テスト | `bunx jest src/queries/product.test.ts` | all pass |
| 関連コンポーネントテスト | `bunx jest src/components/store/forms/review-details.test.tsx src/components/store/product-page/reviews` | all pass |
| 型チェック | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run lint` | エラー 0 |

## Scope

**In scope**:
- `src/queries/product.ts` — 2 経路の `user` を `select: { name: true, picture: true }` にする
- `src/lib/types.ts` — `ReviewWithImageType.user` を `Pick<User, "name" | "picture">` に絞る
- `src/queries/product.test.ts` — 回帰テスト追加
- `plans/README.md` — 本プランの行の更新（docs として別コミット）

**Out of scope**:
- `upsertReview` の返却（本人のデータのみ。019 の後続実装で扱う）
- レビューのモデレーション・購入検証（spike 019）

## Steps

### Step 1: Red — 回帰テストを書く

`src/queries/product.test.ts` に以下を追加する（`mockDb` の呼び出し引数を検証する where/include 構造検証）:
1. `getProductFilteredReviews` が `db.review.findMany` に渡す `include.user` が
   `{ select: { name: true, picture: true } }` であること（`email` / `role` を含まないこと）
2. `getProductPageData` が `db.product.findUnique` に渡す `include.reviews.include.user` が同じであること

**Verify**: `bunx jest src/queries/product.test.ts` → 追加した 2 件が**期待値の不一致で** fail（環境エラーではないこと）

### Step 2: Green — select へ置き換える

`product.ts` の 2 か所を `user: { select: { name: true, picture: true } }` に置換し、
`types.ts` の `ReviewWithImageType` を `user: Pick<User, "name" | "picture">` にする。

**Verify**: `bunx jest src/queries/product.test.ts` → all pass / `bunx tsc --noEmit` → exit 0

### Step 3: 周辺確認

**Verify**: 関連コンポーネントテストが pass、`bun run lint` エラー 0、
`grep -n "user: true" src/queries/product.ts` → 0 件

## Test plan

- 追加: `product.test.ts` に 2 件（Step 1）。構造は同ファイルの `getProductPageData` describe（`:1902` 付近）のモックに合わせる
- 回帰: 既存の `product.test.ts` 全件、`review-details.test.tsx`

## Done criteria

- [ ] `bunx tsc --noEmit` exit 0
- [ ] `bunx jest src/queries/product.test.ts` all pass（新規 2 件を含む）
- [ ] `grep -n "user: true" src/queries/product.ts` が 0 件
- [ ] 変更が In scope のファイルに限られる（`git status`）
- [ ] テスト数の変動を `spec-sync-after-test` で同期した
- [ ] `plans/README.md` の本プランの行を更新した

## STOP conditions

- 表示側で `user.email` / `user.role` / `user.id` を使っている箇所が見つかった場合（表示仕様の確認が必要）
- 型の絞り込みで `src/` の他ファイルに 3 件以上の型エラーが出た場合（影響範囲の再評価が必要）

## Maintenance notes

- 新しく公開経路で `User` を返すときは、`include: { user: true }` ではなく必ず `select` で allowlist にする
- 将来 `Review` に「投稿者表示名の匿名化」等を入れる場合は、本プランの select を起点にする
