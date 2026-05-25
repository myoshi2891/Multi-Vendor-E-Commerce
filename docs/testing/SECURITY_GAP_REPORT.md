# Server Action 認可テスト ギャップレポート

**作成日**: 2026-05-21
**対象**: `src/queries/*.test.ts`（14 ファイル）
**目的**: `docs/testing/COVERAGE_REPORT.md` の A1 タスク（認可テストの横展開）の実態調査と、不足箇所の特定

---

## サマリー

既存テストは予想以上に充実しており、14 ファイル中 9 ファイルは認証・ロール・IDOR テストが既に揃っている。一方、調査過程で **2 件の実装側 IDOR 脆弱性** を発見した。本レポートは:

1. 各ファイルのカバレッジ実測
2. 発見した IDOR 脆弱性の記録
3. 本タスクで追加した補完テストの記録

を含む。

---

## 1. カバレッジ実測（grep ベース）

| ファイル | 関数の認証要件 | unauth | role | IDOR | 評価 |
|---|---|---|---|---|---|
| `category.test.ts` | ADMIN 必須 | 8 | 6 | 0 | ✅ 充実（IDOR 不要、グローバル resource） |
| `coupon.test.ts` | SELLER + 店舗所有権 | 12 | 14 | 6 | ✅ 充実 |
| `home.test.ts` | 認証不要（public read） | 0 | 0 | 0 | ✅ 意図的（read-only public） |
| `offer-tag.test.ts` | ADMIN 必須 | 6 | 7 | 0 | ✅ 充実 |
| `order.test.ts` | USER / SELLER | 12 | 10 | 11 | ✅ 模範 |
| `paypal.test.ts` | USER | 4 | 0 | 2 | ✅ IDOR レグレッションテスト追加（実装修正済み） |
| `product.test.ts` | SELLER + 店舗所有権 | 26 | 10 | 4 | ✅ 充実 |
| `profile.test.ts` | USER | 10 | 0 | 3 | ✅ IDOR は `userId` フィルタで担保 |
| `review.test.ts` | USER | 3 | 0 | 3 | ⚠️ IDOR の明示テスト追加（本タスク） |
| `size.test.ts` | 認証不要（public read） | 1 | 0 | 0 | ✅ 意図的（read-only public） |
| `store.test.ts` | SELLER / ADMIN | 29 | 8 | 18 | ✅ 充実 |
| `stripe.test.ts` | USER | 6 | 0 | 2 | ✅ IDOR レグレッションテスト追加（実装修正済み） |
| `subCategory.test.ts` | ADMIN 必須 | 7 | 7 | 0 | ✅ 充実 |
| `user.test.ts` | USER / ADMIN | 27 | 0 | 8 | ✅ 充実 |

**未整備**: `country.ts`（テストファイル無し）— public read-only のため許容。

---

## 2. 発見した IDOR 脆弱性（**修正済み** — 2026-05-22）

### Issue A: PayPal 決済の orderId 所有権チェック欠落（修正済み）

**ファイル**: `src/queries/paypal.ts:24`, `src/queries/paypal.ts`（`capturePayPalPayment` 内）

**修正内容**: `createPayPalPayment` の `db.order.findUnique` の `where` に `userId: user.id` を追加。`capturePayPalPayment` は元々 `findUnique` を持たなかったため、PayPal の capture 課金 fetch 呼び出しの**前**に同等の所有権チェックを挿入し、他人の注文に対して課金が発生しないようにした。

```typescript
// 修正後（src/queries/paypal.ts）
const order = await db.order.findUnique({
    where: { id: orderId, userId: user.id },
});
if (!order) throw new Error("Order not found");
```

### Issue B: Stripe 決済の orderId 所有権チェック欠落（修正済み）

**ファイル**: `src/queries/stripe.ts:30`, `src/queries/stripe.ts:79`

`createStripePaymentIntent` と `createStripePayment` の両方で `findUnique` の `where` に `userId: user.id` を追加。

---

## 3. 本タスクで追加したテスト

### 3.1 `review.test.ts` — IDOR 明示テスト

既存レビュー検索 (`db.review.findFirst`) の where 句に `userId: user.id` フィルタが含まれることを明示的に検証するテストを追加。これは IDOR 防止の **既存実装に対するレグレッションテスト** であり、将来の実装変更で `userId` フィルタが外れた場合に検知できる。

### 3.2 `paypal.test.ts` / `stripe.test.ts` — IDOR レグレッションテスト（有効化済み）

`createPayPalPayment` / `capturePayPalPayment` / `createStripePaymentIntent` / `createStripePayment` の各テストで `db.order.findUnique` の `where` 句に `userId: user.id` が含まれることを検証する。実装の所有権チェックが将来外れた場合に検知できる。`capturePayPalPayment` のテストでは PayPal 課金 `fetch` が呼ばれていないことも合わせて確認する。

---

## 4. 関連

- 本タスクの計画: ローカル開発者の `~/.claude/plans/` 配下にあり、チームでは閲覧不可。
  公開参照点はコミット履歴を参照: `55c07b1`（test(queries): backfill authorization tests and document IDOR gaps）
- 上位レポート: `docs/testing/COVERAGE_REPORT.md` の A1（🔴 高優先度）
- IDOR 修正の実装コミット: `03a7e89`（fix(security): resolve IDOR vulnerabilities in PayPal/Stripe queries and refactor E2E tests）

---

## 5. 追加調査・拡充（2026-05-24）— A4: 認可ガード統合 + IDOR 3 階層化

### 5.1 認可ガード統合

`src/lib/auth-guards.ts` に共通ヘルパー (`requireUser` / `requireAdmin` / `requireSeller` / `requireStoreOwner`) を導入し、以下の Server Action からインライン認可チェックを撤去:

| ファイル | 関数 | 適用ヘルパー |
|---|---|---|
| `category.ts` | upsertCategory / deleteCategory | `requireAdmin` |
| `subCategory.ts` | upsertSubCategory / deleteSubCategory | `requireAdmin` |
| `offer-tag.ts` | upsertOfferTag / deleteOfferTag | `requireAdmin` |
| `coupon.ts` | upsertCoupon / getStoreCoupons / deleteCoupon | `requireStoreOwner` |
| `product.ts` | upsertProduct | `requireStoreOwner` |
| `product.ts` | deleteProduct | `requireSeller` + インライン `product.store.userId` 比較 |
| `store.ts` | updateStoreDefaultShippingDetails / getStoreShippingRates / upsertShippingRate / **getStoreOrders** | `requireStoreOwner` |

副次効果として `findUnique` の二重呼び出し（旧実装で所有権チェックと取得を別々に行っていた箇所）が解消された。

**残課題の解消（2026-05-26）**: `store.ts::getStoreOrders` の自前 `findUnique` + `userId !== user.id` インライン比較を `requireStoreOwner` に統合。エラーメッセージを統一文言 `"Forbidden: store not owned by current user."` に揃え、IDOR テストを 3 階層パターン（後述 5.2）に準拠させた。

### 5.2 IDOR テスト 3 階層化

既存テストの「(a) スロー検証」に加え、以下の 2 階層を追加するレグレッションテストを 8 件投入:

- **(b) where 句の構造検証** — `expect(mockDb.store.findUnique).toHaveBeenCalledWith({ where: { url, userId } })` で複合キーの組成を担保。将来「`userId` 条件が外れる」変更を検知。
- **(c) 副作用なし検証** — ガード失敗時に下流の `upsert` / `create` / `delete` / 関連 `findMany` が呼ばれないことを担保。defense in depth として下流の意図しない実行を検知。

| ファイル | 関数 | 追加テスト |
|---|---|---|
| `product.test.ts` | `deleteProduct` | (a)(c) 商品 not found / (a)(c) 他人の商品 / (b) `include: { store: { select: { userId: true } } }` 構造検証 |
| `product.test.ts` | `upsertProduct` | (c) `product.create/update/findFirst/productVariant.create/update` 非呼び出し |
| `coupon.test.ts` | `upsertCoupon` | (b)(c) クロステナント where 構造 + `coupon.upsert/findFirst` 非呼び出し |
| `store.test.ts` | `updateStoreDefaultShippingDetails` | (b)(c) 他人の店舗 URL 明示シナリオ + `store.update` 非呼び出し |
| `store.test.ts` | `getStoreShippingRates` | (b)(c) 構造検証 + `country/shippingRate.findMany` 非呼び出し |
| `store.test.ts` | `upsertShippingRate` | (b)(c) 構造検証 + `shippingRate.upsert` 非呼び出し |
| `store.test.ts` | `getStoreOrders` | (a) 統一文言検証 + (b)(c) `where: { url, userId }` 構造 + `orderGroup.findMany` 非呼び出し（2026-05-26 追加） |

テスト総数: 1008 → 1016 (+8) → 2026-05-26 に `getStoreOrders` の (b)(c) を 1 件追加し 1017 件に増加。

### 5.3 関連コミット

- 認可ガード適用: `a73603e` (category) / `e294459` (subCategory) / `adcca3f` (offer-tag) / `06fe5d2` (coupon) / `8766979` (product) / `c83a5c4` (store)
- IDOR 補完テスト: `ae66fac`
- `getStoreOrders` 統合: `70f5b94`（2026-05-26）
- CSRF 防御方針: ADR 001 (`docs/architecture/decisions/001-csrf-policy.md`)
