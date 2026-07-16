# Plan 050: 管理者の店舗ステータス変更 E2E（admin UI → ストアフロント反映）を追加する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6ad7b05..HEAD -- src/app/dashboard/admin src/components/dashboard/forms/store-status-select.tsx src/queries/store.ts tests/e2e/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2（§20 P1「管理者が店舗停止 → 非表示」の実装済み半分を固定する）
- **Effort**: M
- **Risk**: MED（ADMIN セッションの Clerk metadata 設定・共有 seed 店舗を汚さないための
  使い捨て店舗設計が必要）
- **Depends on**: `plans/042-e2e-signin-helper-repair.md`（認証必須）
- **Category**: tests
- **Planned at**: commit `6ad7b05`, 2026-07-11

## Why this matters

店舗の BAN / 無効化は運営の主要オペレーションだが、admin UI からの操作 → ストアフロント
反映の E2E はゼロ。既存の隣接テスト（`seller-onboarding.spec.ts:143`）はステータスを
**Prisma 直更新**しており admin UI を通らない上、Round 8 実測では serial 連鎖で
一度も実行されていない（findings-16 TESTS-38）。

**重要な前提（監査で確定済み）**: ストアフロント反映は現状「半分だけ」実装されている。
store ページは `getStorePageDetails` の `status: "ACTIVE"` フィルタで非表示になるが、
`getProducts` に store status 条件が無いため **BANNED 店舗の商品は /browse に出続ける**。
本プランは**実装済みの契約（store ページ非表示）のみ**を E2E で固定し、商品露出ギャップは
アプリ側課題として記録済み（findings-16 TESTS-38 追記参照）— このプランで直さない。

## Current state

- **admin stores テーブル**: `src/app/dashboard/admin/stores/page.tsx` + `columns.tsx:140-146` —
  status 列が `StoreStatusSelect` を描画。**Cloudinary（CldUploadWidget）非依存**のため
  OI-11（本番ビルド SSR エラー）の影響を受けない。
- **ステータス変更 UI**（`src/components/dashboard/forms/store-status-select.tsx:43-66`）:
  現在ステータスのタグ（`StoreStatusTag`）を click → ドロップダウンが開き、選択肢
  （PENDING / ACTIVE / BANNED / DISABLED の `StoreStatusTag`）を click →
  `updateStoreStatus(storeId, selectedStatus)` server action → 成功 toast。
- **認可**:
  - admin ページ: `src/app/dashboard/admin/layout.tsx:21` —
    `if (!user || user.privateMetadata.role !== "ADMIN") redirect("/")`。
    **判定は Clerk privateMetadata**（DB の User.role ではない）。
  - `createCustomerSession().create({ role: "ADMIN" })`（`tests/e2e/helpers/auth.ts`）は
    **DB の role しか設定しない** — Clerk metadata の設定を追加で行う必要がある。
    前例: `tests/e2e/seller-onboarding.spec.ts:158-160`
    `await clerk.users.updateUserMetadata(userId, { privateMetadata: { role: "SELLER" } })`
    （`clerk` は `@clerk/backend` の `createClerkClient` インスタンス — 同 spec 冒頭参照）。
- **ストアフロント側の現行契約**:

```typescript
// src/queries/store.ts:659-663 — store ページは ACTIVE のみ取得
const store = await db.store.findFirst({
    where: {
        url: storeUrl,
        status: "ACTIVE",
    },
```

  非 ACTIVE の場合の `/store/[storeUrl]` の実挙動（notFound() か error か）は
  `src/app/(store)/store/[storeUrl]/page.tsx` の null ハンドリングを読んで確定すること。
- **テスト用店舗の設計**: seed の `E2E Store` / `E2E Store B` は purchase-flow /
  platform-coupon 等が使う**共有リソース** — ステータスを変えると（workers:1 でも
  リトライ順により）他 spec を壊す。**使い捨て店舗を Prisma で直接作成**する
  （`tests/e2e/stock-decrement.spec.ts:80-99` の「beforeAll で Prisma 直作成 →
  afterAll で削除」パターンを踏襲。Store の必須フィールドは `prisma/schema.prisma` の
  `model Store` を確認して埋める。owner は本 spec が作る ADMIN ユーザーで良い）。
- 実行前提: `CLERK_SECRET_KEY` / :3000 空き / `workers: 1`。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| 型 / Lint | `bunx tsc --noEmit` / `bun run lint` | exit 0 |
| 新 spec（chromium） | `bash scripts/e2e/run-local.sh tests/e2e/admin-store-status.spec.ts --project=chromium` | 1 passed |
| 3 ブラウザ | `bash scripts/e2e/run-local.sh tests/e2e/admin-store-status.spec.ts` | 3 passed |
| 影響確認 | `bash scripts/e2e/run-local.sh tests/e2e/platform-coupon.spec.ts --project=chromium` | passed（共有店舗が無傷） |

## Scope

**In scope**:
- `tests/e2e/admin-store-status.spec.ts`（新規・1 テスト）
- `tests/e2e/helpers/auth.ts` — `create()` の `role` オプションが ADMIN/SELLER のとき
  Clerk privateMetadata も同期する拡張（**任意**。spec 内で seller-onboarding 前例どおり
  直接 `clerk.users.updateUserMetadata` を呼ぶ実装でも可 — どちらを選んだか
  コミットメッセージに記録）

**Out of scope**:
- `src/queries/product.ts` への store status フィルタ追加（アプリ側ギャップ —
  findings-16 TESTS-38 追記に記録済み。correctness ラウンドの起票対象であり
  テストプランで黙って直さない）
- admin の taxonomy CRUD（カテゴリ等）E2E — フォームが CldUploadWidget 依存で
  OI-11 の影響圏（findings-16 Deferred）
- seed 店舗（E2E Store / B）のステータス変更 — 共有リソースのため禁止

## Git workflow

- Branch: `advisor/050-e2e-admin-store-status`
- コミット: `test(e2e): add admin store status change spec` + ドキュメント同期
- push / PR はオペレーター指示があるときのみ。

## Steps

### Step 1: ADMIN セッションの成立を単体で確認する

spec の骨組み（describe + `requiresClerkAdmin` ゲート + `createCustomerSession`）を作り、
`create({ role: "ADMIN" })` の後に Clerk privateMetadata を ADMIN に設定
（seller-onboarding `:158` 前例）。`session.signIn(page)` → `/dashboard/admin/stores` へ goto
→ リダイレクトされずテーブルが表示されることを最初のテストの冒頭部分として確認する。

**Verify**: `bash scripts/e2e/run-local.sh tests/e2e/admin-store-status.spec.ts --project=chromium`
→ admin stores ページに到達（`redirect("/")` されない）

### Step 2: 使い捨て店舗 + ステータス変更 → ストアフロント反映のフルシナリオを実装する

テスト本文（1 テスト・`test.setTimeout(90000)`）:

1. beforeAll: Prisma で使い捨て店舗を作成（url 例: `e2e-status-store-${uniqueId}`、
   `status: "ACTIVE"`、owner = ADMIN ユーザー）。afterAll で削除。
2. （ベースライン確認）`/store/<使い捨て店舗url>` へ goto → 店舗名が表示される（ACTIVE 時は公開）。
3. `/dashboard/admin/stores` へ goto → 使い捨て店舗の行を特定
   （店舗名テキストで locator）→ status タグを click → ドロップダウンから
   `Banned` のタグを click（`StoreStatusTag` の表示文言は
   `src/components/shared/order-status` 系ではなく store 用タグ — 実文言を
   `StoreStatusTag` の実装から確認して合わせる）→ 成功 toast を確認。
4. `/store/<使い捨て店舗url>` へ goto →
   **非公開挙動**（Step 0 で確定した notFound/エラーの実挙動）を assert。
5. （復帰確認・任意だが推奨）admin UI で `Active` に戻す → store ページが再表示される。

**Verify**: `bash scripts/e2e/run-local.sh tests/e2e/admin-store-status.spec.ts --project=chromium`
→ 1 passed

### Step 3: 3 ブラウザ + 共有 seed の無傷確認

**Verify**:
- `bash scripts/e2e/run-local.sh tests/e2e/admin-store-status.spec.ts` → 3 passed
- `bash scripts/e2e/run-local.sh tests/e2e/platform-coupon.spec.ts --project=chromium` → passed
  （共有店舗 E2E Store / B に影響が無いこと）

### Step 4: ドキュメント同期

`spec-sync-after-test` skill を起動（テスト数 +1 ×3 ブラウザ）。

**Verify**: 同期コミットに QA_HANDOFF.md / coverage-dashboard.html が含まれる

## Test plan

- 新規 1 テスト（ACTIVE 公開確認 → admin UI で BANNED → store ページ非公開 → 復帰）× 3 ブラウザ。
- 認証部の手本: `tests/e2e/a11y/checkout.spec.ts` + seller-onboarding の Clerk metadata 前例。
- 使い捨てリソースの手本: `tests/e2e/stock-decrement.spec.ts:80-99`。

## Done criteria

- [ ] `bunx tsc --noEmit` / `bun run lint` exit 0
- [ ] chromium 1 passed / 3 ブラウザ 3 passed
- [ ] platform-coupon（chromium）が引き続き passed（共有店舗無傷）
- [ ] `git status` で in-scope 外の変更なし（`src/` 無変更）
- [ ] `plans/README.md` の 050 行を DONE に更新

## STOP conditions

- plan 042 未完了（signIn 不能）。
- Clerk privateMetadata を ADMIN にしても `/dashboard/admin` から redirect される
  （認可経路が Current state の記述から変わっている）。
- `Store` モデルの必須フィールドが多く、使い捨て店舗の Prisma 作成が
  30 行を超える複雑さになる（seed ヘルパー側に共通化すべきか判断が要る — 報告）。
- 非 ACTIVE store ページの実挙動が 500 エラー（notFound ではなく未処理例外 —
  アプリバグとして報告。テストで 500 を「正」として固定しない）。

## Maintenance notes

- **アプリ側ギャップ（重要）**: `getProducts` に store status フィルタが無く、BANNED 店舗の
  商品が /browse に出続ける。§20 P1 の完全な達成には `src/queries/product.ts` の
  whereClause への store status 条件追加（+ Integration/E2E の拡張）が必要。
  次回 correctness 監査ラウンドの P1 候補として findings-16 TESTS-38 追記に記録済み。
  実装されたら本 spec に「/browse から商品が消える」assert を追加すること。
- ADMIN セッションを auth.ts 拡張で実装した場合、他プラン（047〜049）の USER セッションに
  影響しないこと（role 未指定時の既定動作が不変であること）をレビューで確認する。
