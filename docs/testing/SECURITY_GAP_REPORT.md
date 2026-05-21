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
| `paypal.test.ts` | USER | 4 | 0 | 1 | ⚠️ IDOR 検証不在（後述） |
| `product.test.ts` | SELLER + 店舗所有権 | 26 | 10 | 4 | ✅ 充実 |
| `profile.test.ts` | USER | 10 | 0 | 3 | ✅ IDOR は `userId` フィルタで担保 |
| `review.test.ts` | USER | 3 | 0 | 3 | ⚠️ IDOR の明示テスト追加（本タスク） |
| `size.test.ts` | 認証不要（public read） | 1 | 0 | 0 | ✅ 意図的（read-only public） |
| `store.test.ts` | SELLER / ADMIN | 29 | 8 | 18 | ✅ 充実 |
| `stripe.test.ts` | USER | 6 | 0 | 1 | ⚠️ IDOR 検証不在（後述） |
| `subCategory.test.ts` | ADMIN 必須 | 7 | 7 | 0 | ✅ 充実 |
| `user.test.ts` | USER / ADMIN | 27 | 0 | 8 | ✅ 充実 |

**未整備**: `country.ts`（テストファイル無し）— public read-only のため許容。

---

## 2. 発見した IDOR 脆弱性（本タスクのスコープ外、要別 PR 対応）

### Issue A: PayPal 決済の orderId 所有権チェック欠落

**ファイル**: `src/queries/paypal.ts:24`, `src/queries/paypal.ts:103`

```typescript
// 現状（脆弱）
const order = await db.order.findUnique({
    where: { id: orderId },
});
```

**問題**: 認証済みの任意ユーザーが、他人の `orderId` を指定して `createPayPalPayment` / `capturePayPalPayment` を呼び出せる。攻撃者は他人の注文に対して PayPal 決済セッションを発火させ、結果として `paymentDetails.userId` に自身の ID が記録される。

**推奨修正**:

```typescript
const order = await db.order.findUnique({
    where: { id: orderId, userId: user.id },
});
if (!order) throw new Error("Order not found");
```

**影響**: 他人の注文を不正に「Paid」状態に更新できる可能性 / 決済記録の関連性が不整合となる。

### Issue B: Stripe 決済の orderId 所有権チェック欠落

**ファイル**: `src/queries/stripe.ts:30`, `src/queries/stripe.ts:79`

Issue A と同じパターン。`createStripePaymentIntent` と `createStripePayment` の両方で `userId` フィルタが欠落。

---

## 3. 本タスクで追加したテスト

### 3.1 `review.test.ts` — IDOR 明示テスト

既存レビュー検索 (`db.review.findFirst`) の where 句に `userId: user.id` フィルタが含まれることを明示的に検証するテストを追加。これは IDOR 防止の **既存実装に対するレグレッションテスト** であり、将来の実装変更で `userId` フィルタが外れた場合に検知できる。

### 3.2 `paypal.test.ts` / `stripe.test.ts` — IDOR スケルトンテスト（skip 付き）

実装の IDOR 脆弱性が修正されたら有効化するスケルトンテストを `it.skip` で追加。コメントで「実装側の修正後に skip を外す」旨を明記。これにより:

- セキュリティ要件の存在が明示的にコード上で documenting される
- 別 PR で実装修正後、`it.skip` → `it` の 1 行変更で有効化できる

---

## 4. 関連

- 本タスクの計画: `~/.claude/plans/melodic-plotting-bubble.md`（A1 セクション）
- 上位レポート: `docs/testing/COVERAGE_REPORT.md` の A1（🔴 高優先度）
- 次アクション（別 PR 推奨）: Issue A / B の実装修正 + 該当 `it.skip` の有効化
