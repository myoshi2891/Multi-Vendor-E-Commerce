# Plan 048: 顧客エンゲージメント導線（ウィッシュリスト / ストアフォロー / レビュー投稿）の E2E を追加する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6ad7b05..HEAD -- src/components/store/cards/product/product-card.tsx src/components/store/cards/store-card.tsx src/components/store/forms/review-details.tsx src/queries/review.ts tests/e2e/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED（レビューフォームは複数必須フィールド。select 操作の DOM 契約が薄い）
- **Depends on**: `plans/042-e2e-signin-helper-repair.md`（認証必須）
- **Category**: tests
- **Planned at**: commit `6ad7b05`, 2026-07-11

## Why this matters

ウィッシュリスト・ストアフォロー・レビュー投稿は UI・server action・専用プロフィール
ページがすべて実装済みなのに、E2E がゼロ（findings-16 TESTS-34/35/36）。いずれも
リピート購入を支える顧客エンゲージメントの主要導線で、unit/component テストは存在するが
「ブラウザから実 DB まで」の導線は未固定。認証ヘルパー修復（plan 042）後に最初に足すべき
新規カバレッジ群としてまとめて 1 spec に実装する。

## Current state

- **ウィッシュリスト**（product-card の hover オーバーレイ内）:

```tsx
// src/components/store/cards/product/product-card.tsx:29-36
const handleAddToWishlist = async () => {
    try {
        const res = await addToWishlist(id, variant.variantId);
        if (res) toast.success("Product successfully added to wishlist");
    } catch (error: unknown) { /* toast.error(...) */ }
};
// :119-124 — ボタンに accessible name が無い（Heart アイコンのみ）:
<Button variant="black" size="icon" onClick={() => handleAddToWishlist()}>
    <Heart className="w-5" />
</Button>
```

  → **Step 1 で `aria-label="Add to wishlist"` を 1 行追加する**（隣の compare ボタン
  `:126-135` は `aria-label` 済み — それに合わせる。この 1 行が本プラン唯一の `src/` 変更）。
  カード本体の testid は `product-card-${slug}`（`:70`）。オーバーレイは
  `group-hover:block`（`:103`）のため **hover 必須**。
  一覧ページ: `src/app/(store)/profile/wishlist/[page]/page.tsx` — h1 `Your Wishlist`。
- **ストアフォロー**（`src/components/store/cards/store-card.tsx`）:
  - 描画場所: **商品詳細ページ**（`src/app/(store)/product/[productSlug]/[variantSlug]/page.tsx:141`）
  - ボタン: `<span>{following ? 'Following' : 'Follow'}</span>`（`:96`）— クリック領域は
    `onClick` 付き div（`:82-89`）。`<strong>{storeFollowersCount}</strong><strong> Followers</strong>` 表示（`:75-76`）。
  - 成功 toast: `` `You are now following ${name}` `` / `` `You unfollowed ${name}` ``（`:37,43`）
  - **フォロー一覧の URL 形式（実ルート確認済み・保留事項なし）**:
    - `src/app/(store)/profile/following/page.tsx` は
      **`redirect("/profile/following/1")` のみ**（実体を持たない）
    - `src/app/(store)/profile/following/[page]/page.tsx` が実体。`params.page` を
      `Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1` で正規化して
      `getUserFollowedStores(page)` を呼ぶ（tech.md の URL パラメータ正規化規約に準拠）
    - → **テストからは `/profile/following/1` を直接 goto する**。`/profile/following` でも
      リダイレクトで到達するが、余分な遷移を待つ必要がなく待ち条件が単純になるため。
  - フォロー一覧の表示コンポーネント: `src/components/store/profile/following/container.tsx`
    が同じ StoreCard を描画）
- **レビュー投稿**（`src/components/store/forms/review-details.tsx`・商品詳細ページの
  `product-reviews.tsx:161` から描画）:
  - 見出し `Add a review`（`:279`）、星: `data-testid={"star-wrapper-${index}"}`（`:114`、
    index 0〜4、内部の `<button>` を click）、送信: `Submit Review` ボタン（`:442-448`）
  - 成功 toast: `Review added successfully.`（`:226`）
  - 入力スキーマ（`src/lib/schemas.ts:433-446`）— **必須**: `variantName` / `rating >= 1` /
    `size` / `review`（10 文字以上）/ `color`。`images` は 0 枚で可（**Cloudinary は操作しない**）。
    variant/size/color の入力 UI（select か radio か）は `review-details.tsx` の
    FormField 群を読んで確認すること。
  - サーバー側 `src/queries/review.ts:15-` は認証のみ要求（**購入履歴は不要** —
    `upsertReview` に購入チェックは無い。既存レビューがあれば update になる点に注意）。
- **共通パターン**: 認証は `createCustomerSession()`（`tests/e2e/helpers/auth.ts`）。
  describe 冒頭の `requiresClerkAdmin` skip ゲート・beforeAll create / afterAll cleanup は
  `tests/e2e/a11y/checkout.spec.ts:22-40` の形を踏襲。seed は
  `buildE2ESeed({ parallelIndex, projectName })` + `setupE2ETestState(page, seed)`。
  `workers: 1` 前提（並列間の DB 競合を考えない）。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| 型 / Lint | `bunx tsc --noEmit` / `bun run lint` | exit 0 |
| 新 spec（chromium） | `bash scripts/e2e/run-local.sh tests/e2e/engagement.spec.ts --project=chromium` | 3 passed |
| 3 ブラウザ | `bash scripts/e2e/run-local.sh tests/e2e/engagement.spec.ts` | 9 passed |
| component 回帰 | `bun run test -- src/components/store/cards/product/product-card.test.tsx` | pass |

## Scope

**In scope**:
- `tests/e2e/engagement.spec.ts`（新規・3 テスト）
- `src/components/store/cards/product/product-card.tsx` — wishlist ボタンへの
  `aria-label="Add to wishlist"` **1 行のみ**

**Out of scope**:
- store-card の「未サインイン時に `router.push('/sign-in')` 後も followStore を呼び続ける」
  分岐漏れ（`store-card.tsx:31` — return が無い）: アプリの潜在バグだが本プランでは
  修正しない。発見事項としてコミットメッセージに記録するだけにする。
- レビューの画像アップロード（Cloudinary ウィジェット操作はフレーク源）。
- レビュー編集（既存レビューの update 経路）・削除。
- wishlist / following の**ページング**検証（plan 049 のプロフィール系と統合判断）。

## Git workflow

- Branch: `advisor/048-e2e-engagement-flows`
- コミット分割: (1) `fix(store): add aria-label to wishlist button on product card`
  (2) `test(e2e): add engagement flows spec (wishlist / follow / review)`
  (3) ドキュメント同期
- push / PR はオペレーター指示があるときのみ。

## Steps

### Step 1: wishlist ボタンに accessible name を付ける

`src/components/store/cards/product/product-card.tsx:119-124` の wishlist ボタンに
`aria-label="Add to wishlist"` を追加（compare ボタン `:126-135` の形式に合わせる）。

**Verify**: `bunx tsc --noEmit` → exit 0、
`bun run test -- src/components/store/cards/product/product-card.test.tsx` → pass

### Step 2: engagement.spec.ts を作成する

`tests/e2e/engagement.spec.ts` を新規作成し、a11y/checkout と同じ認証セットアップ
（describe-level `requiresClerkAdmin` skip / `createCustomerSession` / beforeAll create /
afterAll cleanup / 各テスト冒頭 `session.signIn(page)` + `setupE2ETestState(page, seed)` +
`test.setTimeout(90000)`）で 3 テストを書く:

1. **ウィッシュリスト: 追加 → 一覧反映**
   - `/browse` → `getByTestId(`product-card-${seed.product.slug}`).hover()` →
     カード内 `getByRole("button", { name: "Add to wishlist" })` click
   - `expect(page.getByText("Product successfully added to wishlist")).toBeVisible()`
   - `/profile/wishlist/1` → h1 `Your Wishlist` と `seed.product.name` が visible
2. **ストアフォロー: follow → 一覧反映 → unfollow**
   - 商品詳細 `/product/${seed.product.slug}/${seed.variant.slug}` へ goto
   - StoreCard 内の `Follow` テキストを click →
     toast `You are now following ${seed.store.name}` → 表示が `Following` に変わり、
     Followers 数が +1（クリック前に `<strong>` から読んで比較）
   - `/profile/following/1` へ goto → `seed.store.name` が visible
   - 商品詳細に戻り `Following` click → toast `You unfollowed ...` → `Follow` 表示に復帰
3. **レビュー投稿: 星 + 必須フィールド → 成功 → 一覧反映**
   - 商品詳細へ goto → `Add a review` セクションまでスクロール
   - `getByTestId("star-wrapper-4")` 内の button を click（rating=5）
   - variant / size / color の各必須入力を `review-details.tsx` の実 UI に従って選択
     （最初の選択肢で良い）。レビュー本文 textarea に 10 文字以上
     （例: `Great product, works as expected!`）を入力
   - `Submit Review` click → `expect(page.getByText("Review added successfully.")).toBeVisible()`
   - レビュー一覧に本文テキストが表示される

**Verify**: `bunx tsc --noEmit` / `bun run lint` → exit 0

### Step 3: chromium → 3 ブラウザ

**Verify**:
- `bash scripts/e2e/run-local.sh tests/e2e/engagement.spec.ts --project=chromium` → 3 passed
- `bash scripts/e2e/run-local.sh tests/e2e/engagement.spec.ts` → 9 passed
  （firefox 固有問題が出た場合のみ purchase-flow 前例の `!process.env.CI` ローカルゲートを
  適用し、判断をコミットメッセージに記録）

### Step 4: ドキュメント同期

`spec-sync-after-test` skill を起動（テスト数 +3 spec instance ×3 ブラウザ）。

**Verify**: 同期コミットに QA_HANDOFF.md / coverage-dashboard.html が含まれる

## Test plan

- 新規 3 テスト（wishlist / follow / review）× 3 ブラウザ。
- 構造の手本: 認証部は `tests/e2e/a11y/checkout.spec.ts`、操作部は
  `tests/e2e/purchase-flow.spec.ts`。
- 回帰: product-card component テスト（Step 1 の aria-label 追加）。

## Done criteria

- [ ] `bunx tsc --noEmit` / `bun run lint` exit 0
- [ ] `src/` の変更が product-card.tsx の aria-label 1 行のみ（`git diff --stat -- src/`）
- [ ] chromium 3 passed / 3 ブラウザ 9 passed（正当なローカルゲート skip を除く）
- [ ] `bun run test -- src/components/store/cards/product/product-card.test.tsx` pass
- [ ] `plans/README.md` の 048 行を DONE に更新

## STOP conditions

- plan 042 未完了（signIn 不能）。
- レビューフォームの variant / size / color 入力が「最初の選択肢を選ぶ」程度の操作で
  完了できない構造（カスタム UI で Playwright 操作が複雑化）— フォームの実 DOM を添えて報告。
- wishlist / follow / review のいずれかで server action がエラーを返す
  （`Unauthorized.` 等 — 042 の修復漏れか、別の認可問題。エラーメッセージを添えて報告）。
- Step 1 以外に `src/` の変更が必要になった（必要な変更の一覧を添えて STOP）。

## Maintenance notes

- store-card の `if (!user.isSignedIn) router.push('/sign-in')` に return が無い件
  （`store-card.tsx:31`）は将来の correctness 監査ラウンドの候補。未サインインで
  followStore が呼ばれ toast.error 経路に落ちる。
- レビューテストは `upsertReview` の「既存レビューは update」挙動（`review.ts:48-`）により
  同一ユーザーの再実行でも冪等（createCustomerSession はランごとに新規ユーザーを作るため
  実質毎回 create 経路）。
- wishlist の解除（一覧からの削除 UI）は未検証のまま — profile 系の網羅は plan 049 と
  合わせて拡張する。
