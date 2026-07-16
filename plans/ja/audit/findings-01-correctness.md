# Findings 01 — Correctness / Bugs（raw・未 vet）

> 原本: [../../audit/findings-01-correctness.md](../../audit/findings-01-correctness.md)

> Explore サブエージェント報告（2026-07-03 / HEAD `f9752c0`）。**Phase 3 の vet 前の生データ**。
> 行番号・帰属は leads であり facts ではない。プラン化前に必ず本体が再読・確認する。
> 除外済み: 既知の追跡課題（applyCoupon total ロストアップデート / OI-9 / OI-11 / E2E フレーク）。

### [CORRECTNESS-01] Stripe `charge.refunded` webhook が注文を相関できず、返金が静かに未記録になる

- **Evidence**: `src/app/api/webhooks/stripe/route.ts:47-55` — `charge.refunded` の場合、`extractCorrelationIds` は `charge.metadata?.orderId` を読む。`orderId` が Stripe metadata に書き込まれる唯一の箇所は `src/queries/stripe.ts:45`（`paymentIntents.create({ metadata: { orderId } })`）。Stripe は PaymentIntent レベルの metadata を Charge オブジェクトへ**コピーしない**ため、本番では `charge.metadata.orderId` が空になり、ハンドラは注文を更新する前に `400 "Missing metadata.orderId"`（`route.ts:128-130`）を返す。
- **Evidence**: `tests/fixtures/webhooks/stripe/charge-refunded-full.json:17-19` — テスト fixture が手動で `metadata.orderId` を追加しているため、通過しているテスト（`route.test.ts:245-259`）は実際の返金が相関することの誤った確証を与えている。
- **Impact**: 実際の Stripe 返金は webhook 経由で `Order.paymentStatus` を `Refunded`/`PartiallyRefunded` に反転させることが決してない。「Refunded」enum 分岐（`route.ts:29-34`）は実トラフィックに対して事実上デッドコード化している。
- **Effort**: M / **Risk**: LOW / **Confidence**: MED（Stripe の metadata 伝播仕様の確認が必要）
- **Fix sketch**: 既に抽出済みの `paymentIntentId`（`route.ts:52-54`）を fallback として返金を相関する、または intent 作成時点で charge に `orderId` を付与する。charge metadata を持たない fixture を追加する。

### [CORRECTNESS-02] カートストアの手動 `localStorage.setItem` が Zustand persist 形式を破壊 — アイテム削除後リロードでカート消失

- **Evidence**: `src/cart-store/useCartStore.ts:206`, `:231` — `removeFromCart` / `removeMultipleFromCart` が `localStorage.setItem('cart', JSON.stringify(updatedCart))` で**裸配列**を書く。`persist` middleware（`:256`, `{ name: 'cart' }`）は同一キーに `{"state":{...},"version":0}` ラッパー形式を書くため、手動書き込みが直後に上書き破壊する。
- **Evidence**: `src/cart-store/useCartStore.ts:240` — `emptyCart` も `localStorage.removeItem('cart')` で middleware と競合。
- **Impact**: アイテム削除後にリロードすると persist の rehydrate が壊れ、カートがリセット/破損。セッション中は正常に見えるため気づきにくい。
- **Effort**: S / **Risk**: LOW / **Confidence**: MED（破損は確実。rehydrate の失敗モードはブラウザで要確認）
- **Fix sketch**: 手動 localStorage 操作 3 箇所を削除し、persist middleware に一本化。

### [CORRECTNESS-03] `placeOrder` が冪等でなく「注文を確定」ボタンも disabled 化されていない — 二重送信で注文が重複作成され在庫も二重減算される

- **Evidence**: `src/components/store/cards/place-order.tsx:142` — `<Button onClick={() => handlePlaceOrder()}>` に `disabled={loading}` なし（spinner は装飾のみ `:143-147`）。
- **Evidence**: `src/queries/user.ts:422-750` — `placeOrder` は同一 `cartId` の既存注文ガードなし。呼び出しごとに `Order` 作成（`:611`）+ `Size.quantity` 減算（`:720-727`）。並行 2 呼び出しは双方ともカートを読めて各自のトランザクションで注文作成 + 在庫減算する。
- **Impact**: 1 回のチェックアウトで N 重注文・N 重在庫減算（実質オーバーセル + 重複フルフィルメント）。
- **Effort**: M / **Risk**: MED（カートのライフサイクルと決済ステップの orderId 依存に注意） / **Confidence**: MED
- **Fix sketch**: `disabled={loading}` 付与 + サーバー側の冪等化（cart 単位の一意ガード、またはトランザクション内でカート消費）。

### [CORRECTNESS-04] `saveUserCart` が既存カートを削除してから新規作成する処理をトランザクション外で行っている — 部分失敗でカート消失

- **Evidence**: `src/queries/user.ts:251-285` — `db.cart.delete({ where: { userId } })`（`:252`）と `db.cart.create({...})`（`:260`）が別々の await で `db.$transaction` なし。create 失敗時、delete は既にコミット済みでカート消失。
- **Impact**: 一時的な DB 障害でユーザーのサーバー側カートが消える。規約「複数テーブル更新は `db.$transaction`」違反。
- **Effort**: S / **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: delete + create を単一 `db.$transaction` に包む。

### [CORRECTNESS-05] 同一 `Decimal(12,2)` カラムに Stripe は cents、PayPal は dollars を格納している（`PaymentDetails.amount`）

- **Evidence**: `src/queries/stripe.ts:98,109` / `src/app/api/webhooks/stripe/route.ts:166` — Stripe は **cents**（`paymentIntent.amount`）を書く。`src/queries/paypal.ts:232,250` / `src/app/api/webhooks/paypal/route.ts:254` — PayPal は **dollars** を書く。
- **Evidence**: `src/components/store/profile/payments/payments-table.tsx:133-138` — 唯一の補正が `paymentMethod === "Stripe"` のときのみ `/100` する UI 分岐。他の consumer（`order.ts:336,382` の `paymentDetails` include 等）は 100 倍ズレる。
- **Evidence（副次）**: 通貨コードの大文字小文字も不統一（`"usd"` vs `"USD"` @ `paypal.ts:254`）。
- **Impact**: カラムの単位がプロバイダ依存。新規 consumer・分析・エクスポートが確実に誤る。
- **Effort**: M（書き込み 4 箇所の正規化 + バックフィル） / **Risk**: MED / **Confidence**: MED
- **Fix sketch**: 単位を一つに統一（minor units 推奨）、全書き込み箇所で変換、通貨ケース正規化、バックフィル、UI の per-provider `/100` 分岐撤去。

### [CORRECTNESS-06] 未ガードの `variant.images[0]` / `variants[0]` 配列インデックスアクセス

- **Evidence**: `src/queries/user.ts:227, 567, 885, 1086` — `image: variant.images[0].url` ガードなし。`src/queries/home.ts:77-79, 107` — `product.variants[0]` / `variant.images[0]` / `getCheapestSize(variant.sizes)` が非空前提。`src/queries/product.ts:853` — 同様。対照的に `product.ts:1575` は安全な `images[0]?.url ?? ""` を使用（コードベース自身が空の可能性を認知）。
- **Impact**: 画像 0 枚の variant（またはホーム経路の variants/sizes 空）で TypeError → カート保存・注文確定・ホーム SSR が 500。
- **Effort**: S / **Risk**: LOW / **Confidence**: MED（「全 variant に画像 ≥1」不変条件の強制有無を要調査）
- **Fix sketch**: `images[0]?.url ?? ""` パターンへ統一。不変条件なら商品作成時にバリデーション。

### [CORRECTNESS-07] 型エスケープハッチの集積: `catch (error: any)`（11箇所）+ 二重 `as unknown as` キャスト

- **Evidence**: `catch (error: any)`: `src/app/api/index-products/route.ts:132,401` / `src/components/store/cards/payment/stripe/stripe-payment.tsx:28,63` / `src/components/store/forms/apply-coupon.tsx:52` / `src/components/store/cart-page/summary.tsx:30` / `src/components/store/cards/cart-product.tsx:176` / `src/components/store/shared/shipping-addresses/address-details.tsx:131` / `src/components/dashboard/forms/product-status-select.tsx:42` / `src/components/dashboard/forms/store-status-select.tsx:35` / `src/components/store/forms/apply-seller/steps/step-3/step-3.tsx:76`
- **Evidence**: `src/queries/home.ts:165` — `})) as unknown as ProductWithVariants[]`
- **Impact**: `any` 型 catch はランタイム形状が異なっても `error.message` 等がコンパイルを通る（決済/クーポン経路含む）。`no-any` 規約（リポジトリ全体ルール）にも違反。
- **Effort**: S / **Risk**: LOW / **Confidence**: MED
- **Fix sketch**: `error: unknown` + `instanceof Error` narrowing（`src/queries/*` の既存パターン）へ置換。`home.ts` は Prisma payload 型から導出。

### [CORRECTNESS-08] `StripePayment.handleSubmit` の early-return で `loading` が固着したまま残る；effect にキャンセル処理がない

- **Evidence**: `src/components/store/cards/payment/stripe/stripe-payment.tsx:35-39` — `setLoading(true)` 後の `if (!stripe || !elements) return` で `setLoading(false)` なし。
- **Evidence**: 同 `:19-22` — `useEffect(() => { getClientSecret() }, [orderId])` にキャンセルなし。
- **Impact**: 決済フォームのスタック UX（narrow path）+ アンマウント後の stale 状態更新。
- **Effort**: S / **Risk**: LOW / **Confidence**: LOW（`!stripe` early-return の到達可能性は disabled ゲートに依存 — investigate）
- **Fix sketch**: early-return 前に `setLoading(false)`、effect にキャンセルフラグ（recon 規約のパターン）。

---

**Areas checked and found clean**: Stripe/PayPal webhook idempotency（`db.$transaction` + orderId-unique upsert・未対応イベントは 200 no-op・署名検証の 400/5xx 区別）; `order.ts` の restock/status 遷移（条件付き `updateMany` による二重 restock 防止・親子 status 整合）; `inventory.ts::updateSizeStock`（所有権スコープの原子的 `updateMany`）; `coupon.ts` の couponId CAS と admin scope; `message.ts`（参加者チェック・$transaction・冪等既読化）; `placeOrder`/`applyCoupon` の Decimal 演算（集計ループ内 `.toNumber()` なし）。
