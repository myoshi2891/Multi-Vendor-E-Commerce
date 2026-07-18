# Plan 049: プロフィール系 E2E（住所管理 UI + 注文履歴一覧）を追加する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6ad7b05..HEAD -- src/app/\(store\)/profile src/components/store/profile src/components/store/shared/shipping-addresses tests/e2e/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED（住所フォームは項目数が多く、国 select 等のカスタム UI 操作を含む）
- **Depends on**: `plans/042-e2e-signin-helper-repair.md`（認証必須）
- **Category**: tests
- **Planned at**: commit `6ad7b05`, 2026-07-11

## Why this matters

購入後の顧客体験（注文の確認）と購入前の必須データ（配送先住所）を扱う `/profile` 配下は、
a11y スキャン 1 本（それも Round 8 実測まで認証破損で fail）しか E2E が無い
（findings-16 TESTS-37）。住所管理はチェックアウト成立の前提データであり、注文履歴は
「注文した → 後から確認できる」という取引の基本保証。どちらもブラウザ導線で固定する。

## Current state

- **住所管理**: `src/app/(store)/profile/addresses/page.tsx` →
  `AddressContainer`（`src/components/store/profile/addresses/container.tsx`）→
  共有 `UserShippingAddresses`（`src/components/store/shared/shipping-addresses/shipping-addresses.tsx`）。
  契約:
  - 追加トリガー: `<span className="text-sm">Add new address</span>`（`shipping-addresses.tsx:40`）
  - フォーム `address-details.tsx` の placeholder: `First name` / `Last name` / `Phone number` /
    `Street, house/apartment/unit` / `Apt, suite, unit, etc (optional)` / `City` /
    `State/Province` / `Zip code`（`:161-309`）+ 国 select（`name="countryId"`、`:211`）
  - 送信ボタン: `Save Address information`（`:318-328`。保存中は別文言 — 実装を確認）
  - このフォームは **/checkout でも同じ共有コンポーネント**として使われる
- **注文履歴**: `src/app/(store)/profile/orders/page.tsx` → `getUserOrders()` →
  `OrdersTable`（`src/components/store/profile/orders/orders-table.tsx`）。契約:
  - 行に `#{order.id}` 表示（`:115` 付近）と `View` リンク → `/order/${order.id}`（`:170-173`）
  - フィルタ付きルート `/profile/orders/[filter]` もあるが本プランは無指定（全件）のみ
- **注文を作る手段**（注文履歴のテスト前提）: `tests/e2e/stock-decrement.spec.ts` が前例。
  - beforeAll で Prisma から直接 `shippingAddress.create`（`:80-85` — `address1: "123 Test St"` 等）
  - UI で 商品 → サイズ選択 → カート → checkout → `Place order` → `/order/` 到達（`:155-176`）
  - afterAll で shippingAddress 削除 → Order 系へカスケード（`:98-99` のコメント参照）
- **認証**: `createCustomerSession()` + `session.signIn(page)`（plan 042 完了後の
  `tests/e2e/helpers/auth.ts`）。describe ゲート・beforeAll/afterAll は
  `tests/e2e/a11y/checkout.spec.ts:22-40` の形。
- 実行前提: `CLERK_SECRET_KEY` / :3000 空き / `workers: 1`。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| 型 / Lint | `bunx tsc --noEmit` / `bun run lint` | exit 0 |
| 新 spec（chromium） | `bash scripts/e2e/run-local.sh tests/e2e/profile.spec.ts --project=chromium` | 2 passed |
| 3 ブラウザ | `bash scripts/e2e/run-local.sh tests/e2e/profile.spec.ts` | 6 passed |

## Scope

**In scope**:
- `tests/e2e/profile.spec.ts`（新規・2 テスト）

**Out of scope**:
- `src/` 配下（セレクタ不足なら STOP。plan 048 のような 1 行許可は本プランには無い —
  住所フォームは placeholder 契約が既に十分）
- `/profile/orders/[filter]` のフィルタ・ページング検証（注文を大量に作る必要があり
  wall-clock コスト過大。初版は「作った注文が一覧に出る」まで）
- 住所の編集・削除 UI（初版は追加 + 表示のみ）
- `/profile/history`（localStorage ベースの閲覧履歴 — 注文履歴とは別物。対象外）

## Git workflow

- Branch: `advisor/049-e2e-profile-orders-addresses`
- コミット: `test(e2e): add profile addresses and order history spec` + ドキュメント同期
- push / PR はオペレーター指示があるときのみ。

## Steps

### Step 1: profile.spec.ts を作成する

`tests/e2e/profile.spec.ts` を新規作成。a11y/checkout と同じ認証セットアップ
（`requiresClerkAdmin` ゲート / `createCustomerSession` / beforeAll create / afterAll cleanup /
各テスト冒頭 `session.signIn(page)` + `setupE2ETestState(page, seed)` +
`test.setTimeout(90000)`）で 2 テスト:

1. **住所管理: フォームから追加 → 一覧表示**
   - `/profile/addresses` へ goto → `Add new address` を click
   - placeholder 契約でフォームを埋める: First name `E2E` / Last name `Tester` /
     Phone number `+15550001111` / Street は**この実行に固有の値**（下記参照） / City `Testville` /
     State `CA` / Zip `90210`。国 select は seed の国（`seed.country.name`）を選択
     （select 要素なら `selectOption`、カスタムコンボボックスなら実 DOM を確認して操作）
   - `Save Address information` を click
   - 一覧に**その固有の Street** が表示される（`toHaveCount(1)` で 1 件であることまで確認する）
2. **注文履歴: 注文が一覧に載り、詳細へ遷移できる**
   - 住所を Prisma で直接作成する（stock-decrement `:80-85` のパターンを踏襲）。
     **テスト 1 が作った住所に依存しない**（下記参照）
   - 商品 → サイズ選択 → カート → checkout → `Place order` → `/order/` 到達
     （stock-decrement `:155-176` の手順を流用。`gotoStable` 等の安定化ヘルパーも同 spec から
     コピーではなく import できるなら import、できなければ最小限の再実装）
   - 到達した URL から orderId を取得（`page.url()` の `/order/` 以降）
   - `/profile/orders` へ goto → **`#<orderId>` を含む行**を特定し、**その行内の
     `View`** を click → `/order/<orderId>` に遷移する。
     実装（`orders-table.tsx:111-175` の構造に基づく — 各注文は `<tr key={order.id}>` で、
     同じ行内に `#{order.id}`（`:119`）と `/order/${order.id}` への `View` リンク
     （`:169-173`）が並ぶ）:

> **住所の状態をテスト間・実行間で共有しないこと**（注文について本プランが既に払っている
> 注意と同じ規律を、住所にも適用する）。
>
> - **テスト 1 の住所は UI 経由で作られ、放置すると残り続ける**。DB は worker をまたいで
>   共有され（本プラン自身が注文について「workers:1 でも DB は共有」と明記）、
>   実行のたびに同じ Street の住所が**累積**する。すると テスト 1 の
>   「一覧に表示される」assert は 2 回目以降 **strict mode violation**（複数ヒット）になる。
>   → **Street はこの実行に固有の値**にする（例: `123 Profile St ${Date.now()}` を
>   テスト内で 1 度だけ生成して変数に保持し、入力と assert の両方で使う）。
> - **テスト 2 はテスト 1 の住所に依存しないこと**。テスト 1 の住所が残っていると、
>   チェックアウトの住所選択がどれを拾うかが**テスト実行順に依存**する
>   （テスト 2 単体を `--grep` で走らせた場合と結果が変わる）。テスト 2 は自分で作った
>   住所を明示的に選択し、「1 件しか無いはず」を前提にしない。
> - **後始末は `afterAll` で `shippingAddress.deleteMany({ where: { userId } })` を明示的に行う**
>   （テスト 1・テスト 2 が作った分を両方まとめて消せる）。実績のあるパターンは
>   `tests/e2e/stock-decrement.spec.ts:96-106`。
>   **必ず `session.cleanup()` より前に実行すること。順序が正しさを決める。**
>   `cleanup()`（`tests/e2e/helpers/auth.ts:124-138`）は 2 つの理由で「後」だと壊れる:
>
>   1. `prisma.user.delete(...).catch(() => {})` — 住所が残っていると FK RESTRICT で
>      P2003 になり、その失敗が握り潰されて **User 行が黙って残る**。
>   2. `finally { await prisma?.$disconnect(); }` — `cleanup()` は**抜ける際に接続を切る**。
>      後ろに置いた `deleteMany` は「遅い」だけでなく、**切断済みクライアントに対して
>      発行される**ことになる。
>
>   ```typescript
>   test.afterAll(async () => {
>       // 1. 子（住所）を先に消す —— これが無いと 2. が P2003 で黙って失敗する
>       await prisma.shippingAddress
>           .deleteMany({ where: { userId } })
>           .catch(() => {});
>       // 2. そのあとに親（User）と Clerk を消し、最後に切断する
>       await session.cleanup();
>   });
>   ```
>
>   `stock-decrement.spec.ts:96-106` はこの順序（住所 → User → Clerk → `$disconnect()` が最後）を
>   そのまま体現している。**引用しているのは deleteMany の書き方だけでなく、この並び順である。**
>   **「ユーザーを消せばカスケードで住所も消える」は誤り** —— `ShippingAddress.userId` は
>   **RESTRICT**（`prisma/schema.prisma` / plan 040 の FK 表）であり、カスケードは存在しない。
>   むしろ住所が残っていると `user.delete` 自体が P2003 で失敗する。しかも
>   `createCustomerSession` の `cleanup()`（`tests/e2e/helpers/auth.ts:124-138`）は
>   `prisma.user.delete(...).catch(() => {})` で**その失敗を握り潰す**ため、
>   **片付いていないのに片付いた顔をする**。住所は自分で消すこと。

```typescript
const orderId = new URL(page.url()).pathname.split("/order/")[1];
expect(orderId).toBeTruthy();

await page.goto("/profile/orders");

// 行を #<orderId> で特定する。ここを page 直下の getByText で済ませ、
// View も page 直下で取ると、一覧に注文が複数ある場合に
// strict mode violation になるか、別の注文の View を押してしまう
// （このテストは他テストが作った注文と同居しうる — workers:1 でも DB は共有）。
const orderRow = page.locator("tr", { hasText: `#${orderId}` });
await expect(orderRow).toBeVisible();

// View は必ず行スコープで取得する
await orderRow.getByRole("link", { name: "View" }).click();
await page.waitForURL(`**/order/${orderId}`);
```

     > `View` は各行に 1 つずつあるため、行を先に絞り込むことが必須。
     > 「#<orderId> が visible」だけを見て別の locator から View を押すと、
     > 「一覧に載っている」ことと「その注文の詳細へ行ける」ことの対応が切れる。

**Verify**: `bunx tsc --noEmit` / `bun run lint` → exit 0

### Step 2: chromium → 3 ブラウザ

**Verify**:
- `bash scripts/e2e/run-local.sh tests/e2e/profile.spec.ts --project=chromium` → 2 passed
- `bash scripts/e2e/run-local.sh tests/e2e/profile.spec.ts` → 6 passed
  （firefox 固有問題は purchase-flow 前例の `!process.env.CI` ローカルゲートで対応し、
  判断をコミットメッセージに記録）

### Step 3: ドキュメント同期

`spec-sync-after-test` skill を起動（テスト数 +2 ×3 ブラウザ）。

**Verify**: 同期コミットに QA_HANDOFF.md / coverage-dashboard.html が含まれる

## Test plan

- 新規 2 テスト（住所追加・注文履歴）× 3 ブラウザ。
- 認証部の手本: `tests/e2e/a11y/checkout.spec.ts`。注文作成部の手本:
  `tests/e2e/stock-decrement.spec.ts`。
- クリーンアップ: 動的ユーザーは `session.cleanup()`、Prisma 直作成の住所は afterAll 削除。

## Done criteria

- [ ] `bunx tsc --noEmit` / `bun run lint` exit 0
- [ ] chromium 2 passed / 3 ブラウザ 6 passed（正当なローカルゲート skip を除く）
- [ ] 注文履歴テストが `#<orderId>` で**行を特定**し、**その行スコープ**で `View` を
      click している（`page` 直下で `View` を取得していないこと — 一覧に複数注文が
      あると別の注文へ遷移しうるため）
- [ ] **コードコミットの直前**で、`git status` に in-scope 外の変更がない（`src/` 無変更。プラン index の更新と `spec-sync-after-test` の docs 同期は、後続の別コミット）
- [ ] `plans/README.md` の 049 行を DONE に更新

## STOP conditions

- plan 042 未完了（signIn 不能）。
- 住所フォームの国選択がカスタム UI で、`seed.country.name` の選択が placeholder/role 契約
  だけでは操作できない（実 DOM を添えて報告）。
- `Save Address information` 送信後に一覧へ反映されない（server action エラー —
  toast / コンソールのエラー内容を添えて報告）。
- 注文作成フロー（checkout → Place order）が plan 042 完了後も失敗する
  （チェックアウト自体の退行の可能性 — 本プランの範囲外）。

## Maintenance notes

- テスト 2 の注文作成は stock-decrement と実行時間が同程度（サインイン + 購入フローで
  約 40s×3 ブラウザ）。フルランの wall-clock が伸びるため、plan 044 の globalTimeout
  見積りに含めること。
- 住所フォームの共有コンポーネント（`shipping-addresses.tsx`）は /checkout でも使われる。
  本 spec が green なら checkout 側の住所追加 UI の大部分も間接的に検証されている —
  将来 payment-error 系（plan 047 の後続）で住所追加をチェックアウト画面から行う
  テストを足す場合は、この spec の操作手順を流用できる。
- 注文履歴のフィルタ（`/profile/orders/[filter]`）とページングは、注文データを
  複数作るコストとの見合いで意図的に見送った。必要になったら Prisma 直 insert で
  注文を量産する方式（UI 経由ではなく）を検討すること。
