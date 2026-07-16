# Findings 02 — Security（raw・未 vet）

> Explore サブエージェント報告（2026-07-03 / HEAD `f9752c0`）。**Phase 3 の vet 前の生データ**。
> 防御的メンテナンスのフレーミング。exploit 文字列・手順は含めない。
> 除外/確認済み: SECURITY_GAP_REPORT.md の既修正（PayPal/Stripe userId スコープ・upsertCoupon 所有権・applyCoupon CAS・review IDOR）は**すべて健在で回帰なし**。CSRF トークン不在（ADR-001）・Clerk 勧告 GHSA-vqx2-fgx2-5wq9（依存カテゴリ担当）・applyCoupon total ロストアップデートは再報告しない。

### [SECURITY-01] Scope `updateOrderItemStatus` order-item lookup to the owned store (cross-store IDOR)

- **Evidence**: `src/queries/order.ts:258` — 店舗所有権を `:245` で検証後、対象アイテムを `db.orderItem.findUnique({ where: { id: orderItemId } })` で取得し `:270` で更新するが、**そのアイテムが当該店舗に属する制約がない**。対照的に兄弟 `updateOrderGroupStatus` は `db.orderGroup.findUnique({ where: { id: groupId, storeId } })`（`:193`）で正しくスコープ。
- **Impact**: 何らかの店舗を所有する SELLER が自分の `storeId`（所有権ゲート通過）+ 任意の被害者 `orderItemId` を渡して、他店舗の注文アイテムのフルフィルメントステータス（Shipped/Delivered/Canceled/Refunded）を改変できる。クロステナント整合性破壊。
- **Effort**: S / **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: `updateMany({ where: { id: orderItemId, orderGroup: { storeId } }, data: { status } })` に置換し `count === 0` を forbidden 扱い（`inventory.ts::updateSizeStock` と同パターン）。

### [SECURITY-02] Whitelist mutable Store fields — client controls `status`/`featured` (moderation & feature bypass / mass assignment)

- **Evidence**: `src/queries/store.ts:90` — update 経路が `const { id, userId, ...storeDataToUpdate } = store; db.store.update({ data: storeDataToUpdate })` で SELLER 自身の `store.status`/`store.featured` が素通り。`store.ts:136` — create 経路が `featured: store.featured ?? false`, `status: store.status ?? "PENDING"`（クライアント値尊重）。`store.ts:459` — `applySeller` が `db.store.create({ data: { ...store, …, userId } })` でクライアントフィールドを spread。schema: Store `status @default(PENDING)`, `featured @default(false)`（＝特権フィールド）。
- **Impact**: SELLER が自店舗を `status:"ACTIVE"` に upsert（admin の BANNED/DISABLED を再有効化＝モデレーションバイパス）、`featured:true`（ホームページ注目枠への自己昇格）できる。`applySeller` 経由で未承認 USER が ACTIVE/featured 店舗を作成し admin レビューをスキップ。`averageRating`/`numReviews` も mass assignment で露出。
- **Effort**: S–M / **Risk**: LOW / **Confidence**: HIGH
- **Fix sketch**: create/update ペイロードを SELLER 編集可能フィールドの明示的 allowlist から構築。`status`/`featured`/`averageRating`/`numReviews` をクライアントから読まない。applicant 作成時は `status:"PENDING"`/`featured:false` を強制。status/featured 遷移は admin 専用アクション（`updateStoreStatus`）に限定。

### [SECURITY-03] Derive Stripe payment status/amount server-side, not from the client-supplied PaymentIntent

- **Evidence**: `src/queries/stripe.ts:71` — `createStripePayment(orderId, paymentIntent)` がクライアントから PaymentIntent 全体を受け取り、`paymentStatus: paymentIntent.status === "succeeded" ? "Paid" : "Failed"`（`:126`）+ `amount: paymentIntent.amount`/`currency`（`:98-99`）を `PaymentDetails`/`Order` に書き込む。`stripe.paymentIntents.retrieve(...)` による再検証なし。署名検証済み webhook（`webhooks/stripe/route.ts`）が権威的経路。
- **Impact**: 自注文を所有するユーザーが偽造 `paymentIntent`（`status:"succeeded"`、任意 `amount`）でこのアクションを呼び、実課金なしに自注文を `Paid` に反転 + 攻撃者選択の金額を記録できる。`Order.paymentStatus` を信頼するフルフィルメント/販売者ビューが未払い注文で動く。（本番では Next.js の server-action エラーマスキングと webhook 整合で緩和されるが、偽造成功時は webhook が発火しない。）
- **Effort**: M / **Risk**: MED / **Confidence**: MED
- **Fix sketch**: クライアントからは `orderId` + `paymentIntentId` のみ取り、サーバー側で `stripe.paymentIntents.retrieve(id)` して status/amount/currency を導出（または webhook を `paymentStatus` の唯一の書き手にする）。

### [SECURITY-04] Verify shipping-address ownership in `placeOrder`

- **Evidence**: `src/queries/user.ts:614` — `order.create({ data: { …, shippingAddressId: shippingAddress.id } })` がクライアント渡しの address id を使用。関数は `shippingAddress.countryId`（`:501`）を読むのみで、そのアドレスが `user.id` のものか検証しない（`shippingAddress.findFirst({ where: { id, userId } })` なし）。
- **Impact**: 呼び出し元が他ユーザーの `ShippingAddress` id を自注文に付けられる。`getOrder`（`order.ts:72`）が `shippingAddress.include: { country, user }` で返すため被害者の住所 + 関連 PII が露出、かつ非所有アドレスへの配送も可能。address id は推測困難な UUID のため実用性は限定的だが、サーバー側所有権チェックが欠落。
- **Effort**: S / **Risk**: LOW / **Confidence**: MED
- **Fix sketch**: `findFirst({ where: { id: shippingAddress.id, userId } })` でロードし不在なら拒否。

### [SECURITY-05] Stop returning raw `error.message` from the products search route

- **Evidence**: `src/app/api/index-products/route.ts:134`, `:403` — 両ハンドラが失敗時に `return NextResponse.json({ error: error.message }, { status: 500 })`。プレーンな Route Handler（server-action のエラー redaction 対象外）で未認証到達可能。対照的に `src/app/api/search-products/route.ts:49` は汎用 `"Internal Server Error"` で正しい。
- **Impact**: 内部エラーテキスト（Prisma/DB メッセージ＝スキーマ・カラム名・接続詳細）が 500 で任意クライアントに開示。
- **Effort**: S / **Risk**: LOW / **Confidence**: MED
- **Fix sketch**: レスポンスボディの `error.message` を定数文字列に置換し、詳細は `console.error` のみ。（注: この 2 ファイルはほぼ重複 — tech-debt 統合機会。）

### [SECURITY-06] No security response headers (CSP, etc.) on a payment/PII surface

- **Evidence（確認範囲を明示）**: セキュリティレスポンスヘッダは**次の 2 経路を実確認した
  範囲で未設定**。「どこにも無い」という一般的主張ではなく、以下の確認に限定して読むこと:
  1. `next.config.mjs` — `images.remotePatterns` のみ設定で **`headers()` ブロックが存在しない**
     （CSP / X-Frame-Options / frame-ancestors / X-Content-Type-Options / Referrer-Policy / HSTS
     のいずれも無し）。
  2. `src/middleware.ts` — Clerk の `clerkMiddleware` で保護ルートを `auth.protect()` する
     のみで、**`NextResponse.next()` を返す際にヘッダを付与していない**
     （`:27` / `:42` / `:46`）。middleware 経由での注入も無い。
  - 併せて `grep -rlnE "Content-Security-Policy|X-Content-Type-Options|Referrer-Policy" src/ next.config.mjs`
    が **0 件**であることを確認済み。
  > **未確認の経路**: リバースプロキシ / ホスティング（Vercel 等）のプラットフォーム側
  > ヘッダ設定は本リポジトリからは判定できない。**本 finding はアプリケーションコード内に
  > ヘッダ設定が無いことを示すに留まり**、本番レスポンスに実際にヘッダが付いていない
  > ことの証明ではない。プラン化時は `curl -I <本番URL>` 等で実レスポンスを確認すること。
  - 対象面の重大性: アプリはサニタイズ済みだが `dangerouslySetInnerHTML` で販売者 HTML を
    描画（`src/components/store/product-page/product-description.tsx:22`）、checkout/profile も扱う。
- **Impact**: checkout/profile/dashboard での XSS/クリックジャッキングに対する多層防御の最終ネットがない。将来のサニタイザ欠陥時に CSP の受け皿がない。
- **Effort**: M（Clerk/Cloudinary/Stripe/PayPal オリジンとの CSP 調整） / **Risk**: MED（過度に厳しい CSP は埋め込みを壊す。report-only ロールアウト必要） / **Confidence**: MED
- **Fix sketch（導入先を `next.config.mjs` の `headers()` に確定）**:
  **`next.config.mjs` の `headers()` ブロック**を導入先とする。middleware での注入は採らない。
  > **なぜ `headers()` か**: (a) 静的アセットを含む全レスポンスに一律で適用でき、
  > middleware の matcher 漏れによる抜けが生じない。(b) middleware はリクエスト毎に
  > 実行されるため、定数ヘッダの付与をそこで行うのは実行コストの無駄。
  > (c) 本リポジトリの middleware は Clerk 認証の責務に閉じており
  > （`.claude/steering/tech.md` の CSRF 方針も middleware をトークン処理に使わない設計）、
  > ヘッダ責務を混ぜると責務が二重化する。
  - 手順: `Content-Security-Policy-Report-Only` を先行導入し、Clerk / Cloudinary / Stripe /
    PayPal の各オリジンを許可リストへ反映 → 違反レポートが落ち着いてから enforcing へ昇格。
    同時に `X-Content-Type-Options: nosniff` / `Referrer-Policy` / `frame-ancestors` は
    最初から enforcing で入れてよい（埋め込みを壊すリスクが低いため）。

### [SECURITY-07] (investigate) PayPal order-creation endpoint hardcoded to sandbox

- **Evidence**: `src/queries/paypal.ts:72`, `:189` — `fetch("https://api.sandbox.paypal.com/...")` がハードコード。webhook は env 由来: `PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com"`（`webhooks/paypal/route.ts:6`）。
- **Impact**: 決済作成経路と webhook 経路の設定ドリフト。本番で create/capture が sandbox を叩く（課金が本番処理されない / 検証済み webhook と環境不一致）決済整合性ハザード。
- **Effort**: S / **Risk**: LOW / **Confidence**: LOW（意図された本番設定の確認要）
- **Fix sketch**: `paypal.ts` でも PayPal API base を `PAYPAL_API_BASE` から取得（webhook と同様）。本番 env 配線を検証。

### [SECURITY-08] (investigate) Older server actions interpolate raw internal error text into thrown messages

- **Evidence**: `src/queries/coupon.ts:102-104`（`…: ${error.message}`）他 `:131-133`, `:416-417`, `:448-450`, `:485-487`; `src/queries/review.ts:142`（`Error updating review: ${message}`）; `store.ts`/`user.ts` の生 `throw error` 再スロー。
- **Impact**: 内部/Prisma エラー詳細のクライアント漏洩の可能性。Next.js が server-action の throw を本番でマスクするため SECURITY-05 より低優先。新しいモジュール（inventory/message/support/dashboard/admin order）は汎用メッセージ済み — 古い query ファイルがドリフト。
- **Effort**: S / **Risk**: LOW / **Confidence**: LOW
- **Fix sketch**: 汎用のクライアント向けメッセージ + 構造化 `console.error` に標準化し、古いファイルを新しいモジュールのパターンへ収束。

### [SECURITY-09] (investigate) `upsertReview` has no purchase verification; stale `@access` doc

- **Evidence**: `src/queries/review.ts:15-104` — 認証済みユーザーなら購入検証なしに商品ごと 1 レビューを作成/更新可能。doc コメントは `@access Admin only`（`:9`）と誤記（stale）。
- **Impact**: 評価操作（1 アカウント 1 レビューで限定的だが購入ゲートなし）と誤解を招くアクセス注釈。IDOR ではない（`findFirst` で userId スコープ）ため低深刻度。
- **Effort**: M / **Risk**: LOW / **Confidence**: LOW
- **Fix sketch**: 任意で user+product の delivered `OrderItem` 一致をレビュー前提にする。stale `@access` コメントを修正。

---

**余談（security ではなく correctness 寄り・要 vet）**: `src/components/store/product-description.tsx:1` に誤ったディレクティブ `'use-client'`（ハイフン）があり、サイレントにサーバーコンポーネント化している。サニタイズはサーバー側でも走るため XSS 防御は保持されるが、意図の乖離として記録。

**Areas checked and found clean**: 既修正フィックスすべて健在（Stripe/PayPal userId スコープ `stripe.ts:30/82`・`paypal.ts:42/159`; `upsertCoupon` 所有権事前チェック + 強制 `scope:'STORE'` `coupon.ts:50-60,82`; `applyCoupon` CAS `coupon.ts:300-310`; review IDOR `productId+userId` findFirst）; `trackOrder`（`order.ts:98`）は文書化された列挙/PII ポスチャに一致（not-found ≡ email 不一致 → null・email 除去・一時エラーは再スロー）; webhook 署名検証（Stripe constructEvent / PayPal verify / Clerk Svix）+ 冪等 $transaction + 金額は検証済みイベント/DB 由来; `placeOrder` は全価格/割引をサーバー再計算 + stock CAS; admin 読み書き（dashboard/store-dashboard/admin order）は `requireAdmin`/`requireStoreOwner` を try/catch 外で呼ぶ; `getAllOrders` は limit ≤100 + enum 検証; `message.ts` `assertParticipant`; `inventory.ts::updateSizeStock` の所有権チェーン updateMany; user-HTML sink（product-description）は DOMPurify サニタイズ + メッセージは escaped React text; 検索ルートはパラメータ化 `Prisma.sql`（SQL インジェクションなし）; `userCountry` cookie は httpOnly/secure/SameSite=Lax; コミット済みシークレットなし（.env*.example のみ・.env* は gitignore）; `upsertProduct` は明示フィールドマッピング（mass-assignment なし）。
