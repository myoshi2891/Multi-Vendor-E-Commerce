# Plan 030: money-path クライアントコンポーネント 6 ファイル（0%）に component テストを追加する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat b6591f9..HEAD -- src/components/store/cards/payment src/components/store/checkout-page/container.tsx src/components/store/cart-page/container.tsx src/components/store/cart-page/summary.tsx src/components/store/layout/footer/newsletter.tsx`
> 対象コンポーネントに変更があれば "Current state" の抜粋と突合し、不一致なら STOP。

## Status

- **Priority**: P3
- **Effort**: M（6 テストファイル・各 3〜6 ケース。**1 ファイル = 1 コミット**で段階実行）
- **Risk**: LOW-MED（テスト追加のみだが、Stripe/PayPal SDK のモックに調整余地あり）
- **Depends on**: none。ただし **plan 005/006/007 と同じファイル近傍**を読む（Out of scope 参照）
- **Category**: tests
- **Planned at**: commit `b6591f9`, 2026-07-10
- **出典 finding**: TESTS-01 残余（Round 1 `findings-04-test-coverage.md` → Round 4
  `findings-12-test-coverage.md` で部分解消を確認済み。`place-order-card` / `apply-coupon-form` /
  `cart-product` / `shipping-fee` は既にテスト済みで、**本プランは残余 6 ファイルのみ**）

## Why this matters

チェックアウト完了率はこのプロダクトの最重要 KPI（`.claude/steering/product.md`）だが、
その動線を構成するクライアントコンポーネントのうち 6 ファイルが lcov **0%**:
決済実行（stripe-payment / paypal-payment）、チェックアウト画面のオーケストレーション
（checkout-page/container）、カート集計と保存（cart-page/container, summary）、
そして `.claude/steering/tech.md` が**リエントランシーガードの実装例として指名している**
newsletter。server action をいつ呼ぶか・失敗時に何を表示するか・二重送信を防げているかが
すべて回帰無検出である。同型のテスト資産（`place-order-card.test.tsx` 等）が確立済みで、
パターンの横展開で閉じられる。

## Current state

対象 6 ファイルと検証すべきロジック（lcov 2026-07-10 実測で全て 0%）:

| # | ファイル | 行/分岐 | 中身（自分で読んで確認済み） |
|---|---|---|---|
| 1 | `src/components/store/layout/footer/newsletter.tsx` | 72L / B12 | フォーム submit → `/api/newsletter` へ fetch。**⚠ `src/app/api/newsletter/` は存在しない**（本番では 404 する既知の不整合。別 finding として記録し本プランでは本体を直さない）。`isSubmittingRef` 二重送信ガード・8s AbortController・AbortError と一般失敗で別 toast・成功で `form.reset()` |
| 2 | `src/components/store/cart-page/summary.tsx` | 97L / B4 | `cartItems.reduce` で subTotal/total 集計・`saveUserCart` 成功で `router.push("/checkout")`・失敗で `toast.error`。**`catch (error: any)` あり（後述）** |
| 3 | `src/components/store/checkout-page/container.tsx` | 98L / B16 | `useEffect` で `updateCheckoutProductWithLatest` により cart を hydrate（`cartItems.length > 0` 時のみ）・住所選択で `activeCountry` 導出・`isCouponCurrentlyValid` でクーポン検証 |
| 4 | `src/components/store/cards/payment/stripe/stripe-payment.tsx` | 98L / B35 | mount 時 `createStripePaymentIntent` → clientSecret 取得・submit で `elements.submit()` → `stripe.confirmPayment` → 成功時 `createStripePayment` → `router.refresh()`。submitError / confirm error で `errorMessage` 表示。**`catch (error: any)` あり** |
| 5 | `src/components/store/cards/payment/paypal/paypal-payment.tsx` | 46L / B2 | `PayPalButtons` に `createOrder`（`createPayPalPayment` → `paymentIdRef` 保存）と `onApprove`（`capturePayPalPayment` → `router.refresh()`）を配線。`onError` で構造化 console.error |
| 6 | `src/components/store/cart-page/container.tsx` | 116L / B18 | カートページのオーケストレーション（useCartStore 連携・選択状態・console.log デバッグ残置 = plan 007 の対象） |

paypal-payment.tsx の全文は 46 行（`createOrder` が `response.id` を ref に保存して返す、
`onApprove` が `captureResponse.id` 存在時のみ `router.refresh()`）。
stripe-payment.tsx の要点（`:19-31`）:

```typescript
useEffect(() => {
    getClientSecret();
}, [orderId]);

const getClientSecret = async () => {
    try {
        const res = await createStripePaymentIntent(orderId);
        if (res.clientSecret) setClientSecret(res.clientSecret);
    } catch (error: any) {
        setErrorMessage(error.message);
    }
};
```

**従うべきパターンの exemplar**: `tests/component/store/place-order-card.test.tsx`
— server action モジュールを `jest.mock`、`next/navigation` の `useRouter`、`react-hot-toast`、
重い子コンポーネントは stub に差し替える構成（`:14-41`）。配置は `tests/component/store/`
（既存のチェックアウト系テストと同居）。newsletter のみ layout 配下だが同ディレクトリでよい。

SDK モックの指針:
- `@stripe/react-stripe-js`: `useStripe` / `useElements` / `PaymentElement` を `jest.mock` で差し替え
  （`useStripe()` → `{ confirmPayment: jest.fn() }`、`useElements()` → `{ submit: jest.fn() }`、
  `PaymentElement` → `() => <div data-testid="payment-element" />`）
- `@paypal/react-paypal-js`: `PayPalButtons` を「`createOrder` / `onApprove` / `onError` props を
  受け取り、それぞれを発火させるテスト用ボタンを描画する」stub にする:
  `Function` 型は `.claude/steering/tech.md`（`any` 禁止）の趣旨に反するため使わない。
  各コールバックを実シグネチャで型付けする（`@paypal/react-paypal-js` の
  `PayPalButtonsComponentProps` から必要な型を借用してもよい）:
  ```tsx
  import type {
      CreateOrderActions,
      OnApproveActions,
      OnApproveData,
  } from "@paypal/paypal-js";

  type PayPalButtonsStubProps = {
      createOrder: (data: Record<string, never>, actions: CreateOrderActions) => Promise<string>;
      onApprove: (data: OnApproveData, actions: OnApproveActions) => Promise<void>;
      onError: (err: unknown) => void;
  };

  jest.mock("@paypal/react-paypal-js", () => ({
      PayPalButtons: ({ createOrder, onApprove, onError }: PayPalButtonsStubProps) => (
          <div>
              <button onClick={() => void createOrder({}, {} as CreateOrderActions)}>pp-create</button>
              <button onClick={() => void onApprove({} as OnApproveData, {} as OnApproveActions)}>pp-approve</button>
              <button onClick={() => onError(new Error("pp boom"))}>pp-error</button>
          </div>
      ),
  }));
  ```
  > 実際の props 型が上記と細部で異なる場合は、`@paypal/react-paypal-js` の
  > `PayPalButtonsComponentProps` から該当プロパティ型を pick して使う。いずれにせよ
  > `Function` / `any` は使わない。
- fetch（newsletter）: `global.fetch = jest.fn()`（`src/queries/paypal.test.ts:24-26` と同じ形）

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| 単一テスト | `bun run test -- tests/component/store/<file>.test.tsx` | all pass |
| 型チェック | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| フルスイート | `bun run test` | 全 pass・スイート数 +6 |

## Scope

**In scope — テスト（すべて新規作成。1 ファイル = 1 コミット）**:
- `tests/component/store/newsletter.test.tsx`
- `tests/component/store/cart-summary.test.tsx`
- `tests/component/store/checkout-container.test.tsx`
- `tests/component/store/stripe-payment.test.tsx`
- `tests/component/store/paypal-payment.test.tsx`
- `tests/component/store/cart-container.test.tsx`

**In scope — ドキュメント同期（後続の別コミット）**:
- `spec-sync-after-test` の成果物一式（Step 7）— スイート数 +6 でテスト統計が変動するため必須。
  SSOT は `docs/testing/QA_HANDOFF.md`、伝播先 `07-testing.md` / `COVERAGE_REPORT.md` /
  `docs/PROGRESS.md` + `bun run coverage:dashboard` 再生成の `docs/coverage-dashboard.html`。
- `plans/README.md` の 030 行を DONE に更新。**テストとは別コミット**。

**必須テストユーティリティ**（新規モック値を手書きせず共通基盤を使う）:
- カートアイテムは `src/config/test-fixtures.ts` の `createMockCartItem`（型安全ファクトリ）を使う。
  他の型付きモックデータも `src/config/`（test-fixtures / test-helpers / test-scenarios）から取得する。
  アドホックなオブジェクトリテラルで代用しない（型のドリフトと重複を防ぐ）。

**Out of scope**（触らない）:
- 対象コンポーネント本体 6 ファイル — **`catch (error: any)`（summary.tsx:30 /
  stripe-payment.tsx:28）を直したくなっても本プランでは直さない**（no-any 規約違反として
  README の次点候補に記録済み。テストは現挙動を仕様として固定する）
- `src/components/store/cards/place-order.tsx`（テスト済み）/ `apply-coupon.tsx`（同）
- plan 005（cart persist）/ 006（二重送信ガード）/ 007（console.log 除去）が変更予定の**本体側**。
  これらが先に実行されていたら drift check で検出し、抜粋と突合してからテストを現行実装に合わせる

## Git workflow

- ブランチ: `dev`
- **1 テストファイル = 1 コミット**（rule 02 の基本単位。6 コミット + docs 同期 1 コミット）
- コミット例: `test(store): add newsletter reentrancy-guard component tests`
- 各コミット時点で `bunx tsc --noEmit` が通ること（rule 02 MUST）

## Steps

順序は易 → 難。各 Step の終わりに: 対象テスト実行 → 緑 → `bunx tsc --noEmit` → コミット。

### Step 1: newsletter.test.tsx（4 ケース）

1. 配線の特性化（成功パスの「モック上の」再現）: email 入力 → submit → `fetch` が
   `/api/newsletter` へ `POST`（body に email）で呼ばれることを assert し、`fetch` モックが
   `{ ok: true }` を返したときに `toast.success` + `form.reset()` になることを確認する。
   > 注: これは**コンポーネントの配線**の特性化であって、`/api/newsletter` が実在する成功経路である
   > ことの証明ではない（上表のとおり当該ルートは未実装）。「エンドポイントが動く」とは書かない。
   > ルート実装/削除は別 finding として扱い、本テストは現行 fetch 先を固定するだけ。
2. リエントランシーガード: `fetch` を pending のまま保持（`new Promise(() => {})` ではなく
   解決可能な deferred で）→ 連続 2 回 submit → `fetch` は **1 回だけ**呼ばれる
3. 失敗系: `fetch` が `{ ok: false }` を resolve → `toast.error("Failed to subscribe.")`
4. タイムアウト系: `fetch` が `AbortError`（`Object.assign(new Error("x"), { name: "AbortError" })`）
   で reject → `toast.error("Request timed out. Please try again.")`

**Verify**: 4 pass → コミット。

### Step 2: cart-summary.test.tsx（3 ケース）

1. 集計表示: cartItems 2 件（price×quantity 既知）+ shippingFees → subTotal / total が
   期待値で描画される（`createMockCartItem` を利用）
2. 保存成功: ボタン押下 → `saveUserCart` が cartItems で呼ばれ、resolve 後
   `router.push("/checkout")`
3. 保存失敗: `saveUserCart` reject → `toast.error` が呼ばれ、push されない

**Verify**: 3 pass → コミット。

### Step 3: paypal-payment.test.tsx（4 ケース）

PayPalButtons stub（Current state のモック指針）を使用。

1. `pp-create` クリック → `createPayPalPayment(orderId)` が呼ばれる
2. `pp-create` → `pp-approve` の順にクリック → `capturePayPalPayment(orderId, <createOrder が
   返した id>)` が呼ばれ、`captureResponse.id` **あり**で `router.refresh()` が呼ばれる
3. **`captureResponse.id` なし分岐**: `capturePayPalPayment` が `id` を持たない結果
   （例: `{}` や `{ id: undefined }`）を resolve → `router.refresh()` が**呼ばれない**ことを assert
   （`onApprove` の `if (captureResponse.id)` 分岐の false 側を固定する）
4. `pp-error` クリック → `console.error` が `"[PaypalPayment] PayPal Button Error:"` で呼ばれる

**Verify**: 4 pass → コミット。

### Step 4: stripe-payment.test.tsx（5 ケース）

`@stripe/react-stripe-js` モック（Current state の指針）を使用。

1. mount で `createStripePaymentIntent(orderId)` が呼ばれ、clientSecret 取得後に
   PaymentElement と submit ボタンが描画される
2. intent 取得失敗: `createStripePaymentIntent` reject → `error.message` が画面に表示される
3. `elements.submit()` が `{ error: { message: "bad card" } }` を返す → エラーメッセージ表示・
   `confirmPayment` は呼ばれない
4. `confirmPayment` 成功（`{ error: undefined, paymentIntent: { id: "pi_123", ... } }`）→
   **`createStripePayment(orderId, paymentIntent.id)`**（第 2 引数は intent **オブジェクトではなく
   `id`（string）**。`src/queries/stripe.ts:70-73` の現行契約 `createStripePayment(orderId: string,
   paymentIntentId: string)` に一致させる）→ `router.refresh()`。
   > server action 側は `paymentIntentId` から Stripe に `retrieve` して amount/currency/metadata を
   > **サーバ権威で**検証する（commit `4b13ce1` / plan 003）。クライアントは金額を渡さないため、
   > このコンポーネントテストでは「渡す引数が `paymentIntent.id` であること」のみを固定し、
   > 金額・通貨の検証は server action のユニットテスト（`stripe.test.ts`）の領分とする。
5. `confirmPayment` がエラーを返す → `createStripePayment` は呼ばれない

**Verify**: 5 pass → コミット。

### Step 5: checkout-container.test.tsx（4 ケース）

`updateCheckoutProductWithLatest`（`@/queries/user`）をモック。子コンポーネント
（`UserShippingAddresses` / `CheckoutProductCard` / `PlaceOrderCard` / `CountryNote`）は
place-order-card.test.tsx と同様に stub 化。

1. mount 時 cartItems が非空なら `updateCheckoutProductWithLatest(cartItems, undefined)` が
   呼ばれ、解決後の cart データが子に渡る
2. cartItems が空なら `updateCheckoutProductWithLatest` は**呼ばれない**
3. 住所選択（stub の props 経由で `setSelectedAddress` を発火）→ `activeCountry` が
   選択住所の country になり、hydrate が再実行される
4. **hydrate（`updateCheckoutProductWithLatest`）が reject した場合**: 黙認しない。
   テストで reject を発生させ、次のいずれかを**明示的に assert** する:
   - 望ましい挙動（`useEffect` 内で catch し `toast.error` 等でハンドルする）が実装済みなら、
     それを assert する。
   - 現行実装が **unhandled rejection を起こす**なら、それを**バグとして顕在化**させる:
     `const spy = jest.spyOn(console, "error")` で unhandled を捕捉するか、
     `process.on("unhandledRejection")` を一時登録して**「未ハンドルであること」を assert** し、
     テスト名に `TODO(bug): hydrate rejection is unhandled` を付けて `SECURITY_GAP_REPORT` 等の
     finding に登録する（本体修正は out of scope だが、**テストで検知点を作る**）。

   > 方針: 「unhandled になるならテストを書かない」は不可。回帰無検出を残さないため、
   > 現状の欠陥もテストで固定して可視化する（`.claude/steering` の「エラーを握りつぶさない」に沿う）。

**Verify**: 4 pass → コミット。

### Step 6: cart-container.test.tsx（3〜5 ケース）

`src/components/store/cart-page/container.tsx` を読み、useCartStore 連携
（`tests/component/store/cart-product.test.tsx` の store モックを手本に）で:
描画（アイテム一覧 + summary への props 受け渡し）/ 空カート分岐 / 選択・全選択系の分岐
（実装を読んで 3〜5 ケースに要約）。**console.log 残置（plan 007 対象）には触れない。**

**Verify**: all pass → コミット。

### Step 7: 品質ゲートと docs 同期

`bun run test`（フルスイート・スイート数 172 → 178）/ `bun run lint` / `bunx tsc --noEmit` →
`spec-sync-after-test` skill 起動（統計 + ダッシュボード再生成、別コミット）。

**Verify**: QA_HANDOFF.md 統計が更新済み。

## Test plan

（Step 1〜6 のケース表が仕様。手本: `place-order-card.test.tsx`（モック構成）・
`cart-product.test.tsx`（useCartStore モック）・`apply-coupon-form.test.tsx`（フォーム系））

## Done criteria

- [ ] 新規 6 テストファイルがすべて緑（`bun run test` でスイート数 +6）
- [ ] 対象 6 コンポーネントの lcov Lines が 0% → 60%+（`bun run test -- --coverage` 後に確認）
- [ ] リエントランシーガード（newsletter）と二重呼び出し防止の assert が存在する
- [ ] `bunx tsc --noEmit` / `bun run lint` exit 0・**本体 6 ファイルに diff なし**
- [ ] コミットが 6（テスト）+ 1（docs 同期）に分かれている
- [ ] `plans/README.md` の 030 行を DONE に更新

## STOP conditions

- SDK モック（Stripe/PayPal）が 2 回の調整でも成立しない（モジュール解決エラー等はエラー全文を
  添えて報告）
- テストを通すために本体コンポーネントの変更が必要に見える（`catch (error: any)` の型を
  直したくなった場合を含む — 記録して続行、本体は触らない。**変更が不可避なら STOP**）
- plan 005/006/007 が先に実行されて対象の実装が大きく変わっている（drift check で検出）

## Maintenance notes

- **後続の単独修正候補（本プランで記録済み・実施しない）**: `summary.tsx:30` /
  `stripe-payment.tsx:28` の `catch (error: any)` → `unknown` + 型ガード化
  （前例: `product-card.tsx` の同種修正 `22bb3f3`）。修正時は本プランのテストが回帰検知になる。
- plan 006（place-order 二重送信ガード）のサーバー側冪等化が入っても、本プランの
  クライアント層テストはそのまま有効（層が違う）。
- レビュー観点: SDK モックが「SDK の挙動」ではなく「コンポーネントの配線」を検証しているか
  （モックをテストするテストになっていないか）。
