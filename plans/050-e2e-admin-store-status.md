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

- **非 ACTIVE 店舗の `/store/[storeUrl]` 実挙動（実装読解で確定済み — 調査不要）**:
  - `src/queries/store.ts:698-736` の `getStorePageDetails` は上記のとおり
    `where: { url, status: "ACTIVE" }` で検索し、**見つからなければ
    `throw new Error(\`Store with URL ${storeUrl} not found.\`)`**（`:725`）。
    catch 節は `console.error` した後そのまま **re-throw**（`:734`）する。
  - `src/app/(store)/store/[storeUrl]/page.tsx` は
    `const store = await getStorePageDetails(storeUrl);` を**そのまま `StoreDetails` へ渡す**。
    **`notFound()` の呼び出しも null ハンドリングも存在しない**。
  - → 非 ACTIVE 店舗の URL は **404 ではなく、未処理例外による HTTP 500**
    （Server Component の throw が error boundary に到達する）になる。

  > **これは「あるべき挙動」ではない**。BANNED / PENDING の店舗ページは本来
  > **404（`notFound()`）** を返すべきで、500 は
  > (a) 存在しない店舗と非公開店舗を区別できず、
  > (b) 監視上は「バグ」として計上され、
  > (c) ユーザーにエラー画面を見せる。
  > 本プランはこの**現挙動を記録**するが、**assert で 500 を固定はしない**
  > （`toBe(500)` は notFound() 修正で落ちるため、修正を罰するテストになる。
  > 詳細は Step 4 の blockquote）。テストコードには
  > `TODO: 非 ACTIVE 店舗は notFound() による 404 が正。現実装は未処理例外で 500 になるため
  > not.toBe(200) で両対応にしている` をコメントで書くこと。
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
2. **（control — 必須。任意のベースラインではない）** `/store/<使い捨て店舗url>` へ goto →
   **HTTP 200** かつ店舗名が表示される（ACTIVE 時は公開）。
   これを省くと手順 4 の「非公開」assert が、ページが最初から壊れていても緑になる（手順 4 の blockquote 参照）。
3. `/dashboard/admin/stores` へ goto → 使い捨て店舗の行を特定
   （店舗名テキストで locator）→ status タグを click → ドロップダウンから
   `Banned` のタグを click（`StoreStatusTag` の表示文言は
   `src/components/shared/order-status` 系ではなく store 用タグ — 実文言を
   `StoreStatusTag` の実装から確認して合わせる）→ 成功 toast を確認。
4. `/store/<使い捨て店舗url>` へ goto → **非公開になったことを assert** する。
   ただし **HTTP 500 を期待値として固定しない**（理由は下記 blockquote）:

```typescript
// --- 手順 2 の control（BAN 前 / 再掲）: これが通ることが手順 4 の前提 ---
// const before = await page.goto(`/store/${storeUrl}`);
// expect(before?.status()).toBe(200);
// await expect(page.getByText(store.name)).toBeVisible();

// --- 手順 4（BAN 後）: 公開されていないこと ---
// 現実装は notFound() を持たず getStorePageDetails の throw が素通りするため 500 になる。
// 本来は 404 が正しい。どちらでも通る形で「公開されていない」ことだけを契約にする
// （notFound() 導入時にこのテストが落ちないようにするため）。
// 参照: src/queries/store.ts:729（throw）/ src/app/(store)/store/[storeUrl]/page.tsx（null 未処理）
const response = await page.goto(`/store/${storeUrl}`);
expect(response?.status()).not.toBe(200);

// 店舗情報が描画されていないこと（本質的な契約）。
await expect(page.getByText(store.name)).toHaveCount(0);
```

   > **なぜ `toBe(500)` にしないか** — 2 つの理由がある。
   >
   > 1. **誘因が反転する**。500 は未処理エラーであって仕様ではない。これを期待値に据えると
   >    **バグがある間は緑・`notFound()` で 404 へ直した瞬間に赤**になる。修正を罰するテストは
   >    回帰検知点ではなく欠陥のロックであり、次の担当者は「直したらテストが壊れた」と受け取る。
   >    `not.toBe(200)` なら 500（現在）でも 404（修正後）でも通り、
   >    「BANNED の店舗ページは正常表示されない」という**修正後も生き残る契約**だけを主張できる。
   > 2. **500 は「何かが壊れた」としか言っていない**。DB 断・無関係なリグレッションでも 500 になり、
   >    そのときエラーページには店舗名が無いので **`toHaveCount(0)` も一緒に通る**。
   >    つまり 2 つの assert が揃って緑でも「BANNED にしたから見えない」ことを何も証明しない
   >    （偽の安心）。だから **BAN 前の control（200 + 店舗名 visible）が必須**になる ——
   >    これが通って初めて「土台は健全で、状態を変えたから見えなくなった」と言える。
   >    control を欠いた「非表示の assert」は、ページが最初から壊れていても緑になる。
   >
   > 現実装が 500 であるという**事実の記録**は、この blockquote と上のコメントで残す。
   > テストの assert で固定する必要はない（記録と契約を混同しない）。
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
- [ ] 非公開の assert が **`response.status()).not.toBe(200)`**（500 でも 404 でも通る耐久契約）と
      **店舗名の非表示**（`toHaveCount(0)`）の両方を含む。**`toBe(500)` で固定していないこと**
- [ ] **BAN 前の control**（`toBe(200)` + 店舗名 `toBeVisible()`）が BAN の assert より前にある
      — これが無いと、ページが最初から壊れていても非表示 assert が緑になる（Step 4 の blockquote 参照）
- [ ] platform-coupon（chromium）が引き続き passed（共有店舗無傷）
- [ ] **コードコミットの直前**で、`git status` に in-scope 外の変更がない（`src/` 無変更。プラン index の更新と `spec-sync-after-test` の docs 同期は、後続の別コミット）
- [ ] `plans/README.md` の 050 行を DONE に更新

## STOP conditions

- plan 042 未完了（signIn 不能）。
- Clerk privateMetadata を ADMIN にしても `/dashboard/admin` から redirect される
  （認可経路が Current state の記述から変わっている）。
- `Store` モデルの必須フィールドが多く、使い捨て店舗の Prisma 作成が
  30 行を超える複雑さになる（seed ヘルパー側に共通化すべきか判断が要る — 報告）。
- 非 ACTIVE store ページで**店舗名が描画されて公開されたまま**（`toHaveCount(0)` が赤）—
  **ステータスフィルタが効いていない重大所見**として即報告。

  > **404 は STOP 条件ではない**（旧版はここに「既に `notFound()` が導入されて 404」を
  > STOP として挙げていたが、下の blockquote および Step 4 の設計と矛盾していたため削除した）。
  > 本プランの契約は `not.toBe(200)` であり、**404 はアサーションにとって非事象**で、
  > そのまま緑になる。404 が無効化するのは*アサーション*ではなく*記述*（Current state と
  > Maintenance notes が「500」と書いている点）なので、対応は **STOP でも期待値の変更でもなく、
  > 記述の更新 + 報告**である。

> **500 は STOP 条件ではない。** 未処理例外が error boundary へ到達する現実装は
> **既知のアプリバグ**（本来は `notFound()` で 404 が正しい）だが、本プランは
> characterization テストであり、**現挙動を記録した上でテストは pass させる**。
> 500 を観測しても止まらず、Step 4 のとおり `expect(response?.status()).not.toBe(200)` +
> `toHaveCount(0)` で「公開されていない」ことだけを契約にし、500 である事実は
> コメントと Maintenance notes に記録する（**assert では固定しない** —
> 理由は Step 4 の blockquote）。
> **ただし `response?.status()` の `?.` を「成功」扱いしないこと。** `page.goto()` は
> ナビゲーションが発生しない場合などに `null` を返し、そのとき `response?.status()` は
> `undefined` になって `undefined !== 200` で**アサーションが空振り（vacuously pass）**する。
> これは「公開されていない」の証明にならない。まず `expect(response).not.toBeNull()` で
> レスポンス取得自体を保証してから、`expect(response!.status()).not.toBe(200)` を評価すること
> （null を非事象として素通りさせない）。
> **404 を観測した場合も STOP しない** —— `not.toBe(200)` はそのまま通る。
> `notFound()` が導入済みだったということなので、Current state の記述と
> Maintenance notes を現状に合わせて更新し、報告する。

## Maintenance notes

- **アプリ側ギャップ（500 — 本 spec が characterization で固定する現挙動）**:
  非 ACTIVE store ページは `getStorePageDetails` の throw（`src/queries/store.ts:725`）が
  未処理のまま error boundary へ到達し **HTTP 500** になる。**本来は `notFound()` で 404**
  が正しく、500 は顧客に無用なエラー画面を見せるアプリバグ。本 spec は
  「BANNED にしたら顧客から見えなくなる」ことの保証が目的のため、**500 を現挙動として
  記録しつつ pass させる**（`toHaveCount(0)` が本質的な保証を担う）。
  `notFound()` が導入されたら、**Step 4 の assert は変更しない**（`not.toBe(200)` は 404 でも
  そのまま通る。これが耐久契約を選んだ理由であり、`toBe(404)` へ書き換えることは
  Step 4 の blockquote が退けた「修正を罰するテスト」へ逆戻りする）。更新するのは
  **記述のみ** —— 本節と Current state の「500」を 404 に直し、`TODO(characterization)`
  コメント（目印）を削除する。次回 correctness 監査ラウンドの候補。
- **アプリ側ギャップ（重要）**: `getProducts` に store status フィルタが無く、BANNED 店舗の
  商品が /browse に出続ける。§20 P1 の完全な達成には `src/queries/product.ts` の
  whereClause への store status 条件追加（+ Integration/E2E の拡張）が必要。
  次回 correctness 監査ラウンドの P1 候補として findings-16 TESTS-38 追記に記録済み。
  実装されたら本 spec に「/browse から商品が消える」assert を追加すること。
- ADMIN セッションを auth.ts 拡張で実装した場合、他プラン（047〜049）の USER セッションに
  影響しないこと（role 未指定時の既定動作が不変であること）をレビューで確認する。
