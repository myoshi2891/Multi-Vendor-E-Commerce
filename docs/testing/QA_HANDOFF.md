# QA & Test Implementation Handoff（次回セッションへの引き継ぎ）

> **最終更新**: 2026-05-22 / **HEAD**: `217bf76`

---

## 現在の実装状態サマリ

### テスト統計（2026-05-22 時点）

| 指標 | 値 |
|------|-----|
| Jest テスト総数 | **945** / 60 スイート（全パス） |
| Playwright E2E | **5 スペック**（purchase-flow / seller-onboarding / payment-error / search-filter / mobile-responsive） |
| 型エラー | **0 件** |
| Skipped テスト | 3 件（意図的） |

---

## フェーズ別実施状況

### ✅ Phase 1（基盤ロジック・ユーティリティ）— 完了

| ステップ | 対象 | ファイル | 状態 |
|---|---|---|---|
| 1-1 | middleware.ts | `src/middleware.test.ts` | ✅ 完了 |
| 1-2 | country.ts | `src/lib/country.test.ts` | ✅ 完了 |
| 1-3 | sanitize.ts | `src/utils/sanitize.test.ts` | ✅ 完了 |
| 1-4a | useIsMobile | `src/hooks/use-mobile.test.tsx` | ✅ 完了 |
| 1-4b | useToast reducer | `src/hooks/use-toast.test.ts` | ✅ 完了 |
| 1-4c | useFromStore | `src/hooks/useFromStore.test.tsx` | ✅ 完了 |
| 1-5 | modal-provider | `src/providers/modal-provider.test.tsx` | ✅ 完了 |
| 1-6 | utils.ts (cn + DOM) | `src/lib/utils.test.ts` / `tests/component/utils-dom.test.ts` | ✅ 完了 |

### ✅ Phase 2（UI コンポーネント）— 完了

| ステップ | 対象コンポーネント | ファイル | 状態 |
|---|---|---|---|
| Step 10 | ステータスタグ群 | `tests/component/shared/status-tags.test.tsx` | ✅ 完了 |
| Step 11 | ProductPrice | `tests/component/store/product-price.test.tsx` | ✅ 完了 |
| Step 12 | ProductShippingFee | `tests/component/store/shipping-fee.test.tsx` | ✅ 完了（2026-03-23） |
| Step 13 | SizeSelector | `tests/component/store/size-selector.test.tsx` | ✅ 完了 |
| Step 14 | QuantitySelector | `tests/component/store/quantity-selector.test.tsx` | ✅ 完了 |
| Step 15 | CartProduct | `tests/component/store/cart-product.test.tsx` | ✅ 完了 |
| Step 16 | ApplyCouponForm | `tests/component/store/apply-coupon-form.test.tsx` | ✅ 完了 |
| Step 17 | PlaceOrderCard | `tests/component/store/place-order-card.test.tsx` | ✅ 完了 |
| Step 18 | OrderStatusSelect | `tests/component/dashboard/order-status-select.test.tsx` | ✅ 完了 |
| Step 19 | ProductStatusSelect | `tests/component/dashboard/product-status-select.test.tsx` | ✅ 完了 |
| Step 20 | StoreStatusSelect | `tests/component/dashboard/store-status-select.test.tsx` | ✅ 完了 |
| Step 21 | CountrySelector | `tests/component/shared/country-selector.test.tsx` | ✅ 完了 |

### ⚠️ Phase 3（E2E テスト）— スケルトン完了・一部保留

| ステップ | ファイル | 状態 | 備考 |
|---|---|---|---|
| Step 22 | `tests/e2e/purchase-flow.spec.ts` | ⚠️ 7/8 テスト | 「複数バリアント追加」1件が ⏸️ 保留中 |
| Step 23 | `tests/e2e/seller-onboarding.spec.ts` | ✅ ファイル作成済み | 実行は seed:e2e 前提 |
| Step 24 | `tests/e2e/payment-error.spec.ts` | ✅ ファイル作成済み | 実行は seed:e2e 前提 |
| Step 25 | `tests/e2e/search-filter.spec.ts` | ✅ ファイル作成済み | 実行は seed:e2e 前提 |
| Step 26 | `tests/e2e/mobile-responsive.spec.ts` | ✅ ファイル作成済み | 実行は seed:e2e 前提 |

### ✅ A1（認可テスト横展開）— 完了（2026-05-21）

- `docs/testing/SECURITY_GAP_REPORT.md` で 14 ファイルの認可カバレッジを調査・記録
- `review.test.ts` に IDOR レグレッションテストを追加
- `paypal.ts` / `stripe.ts` の IDOR 脆弱性（orderId 所有権チェック欠落）を修正 → テスト有効化
- 参照コミット: `55c07b1`, `03a7e89`, `37754d9`, `217bf76`

### ✅ A2（Visual Regression MVP）— ファイル追加済み・baseline 未コミット

- `tests/e2e/visual/cart.spec.ts` / `checkout.spec.ts` を追加（chromium 限定）
- `playwright.config.ts` に `reducedMotion: 'reduce'` / `locale: 'en-US'` / `timezoneId: 'UTC'` を追加
- ⚠️ **baseline スクリーンショットが未コミット** → CI で実行すると常に失敗する状態
- 参照コミット: `f639334`

### ✅ A3（a11y MVP）— 完了（2026-05-21）

- `tests/e2e/a11y/sign-in.spec.ts` / `seller-apply.spec.ts` を追加
- `@axe-core/playwright` で WCAG 2.1 AA スキャン
- 参照コミット: `d261d76`

---

## 残課題・Open Issues

| # | 課題 | 優先度 | 備考 |
|---|---|---|---|
| OI-1 | **Visual Regression baseline 未コミット** | 🔴 高 | `bunx playwright test --update-snapshots` 実行後コミット |
| OI-2 | `purchase-flow.spec.ts` の「複数バリアント追加」1テスト保留 | 🟡 中 | [P1] スキップ中 |
| OI-3 | `/checkout` / `/profile` の a11y spec 未追加 | 🟡 中 | Clerk セッションヘルパー整備後 |
| OI-4 | `.github/workflows/` CI 未整備 | 🟡 中 | lint + test + build の自動化が未設定 |
| OI-5 | E2E シード冪等性（CI 環境での `seed:e2e`） | 🟡 中 | 外部 DB 接続前提のため CI 未検証 |
| OI-6 | `DashboardStats` コンポーネント調査未完了 | 🟢 低 | ソース上に見当たらない。実装確認要 |
| OI-7 | `coverage/lcov.info` が古い (2025-03-16 時点) | 🟢 低 | CI 整備後に自動更新 |

---

## 次回セッション 推奨着手順

```
優先 1: Visual Regression baseline をコミット (OI-1)
  → bunx playwright test --update-snapshots -- tests/e2e/visual/
  → git add tests/e2e/visual/__screenshots__/ && git commit

優先 2: purchase-flow の残り 1 テスト実装 (OI-2)
  → tests/e2e/purchase-flow.spec.ts の ⏸️ テストを有効化

優先 3: GitHub Actions CI ワークフロー追加 (OI-4)
  → .github/workflows/ci.yml（lint + test + build 3 ジョブ）
```

---

## 次回セッション開始時のプロンプト例

> 「QA_HANDOFF.md を確認し、OI-1（Visual Regression baseline のコミット）から着手してください。」

---

## 主要コミット履歴（2026-05-21〜22）

| コミット | 内容 |
|---|---|
| `8e8df92`–`ad6bbc7` | Phase 1 基盤テスト整備（型エラー 0 件達成） |
| `4925d73` | Phase 1 完了後の spec/coverage ドキュメント更新 |
| `55c07b1` | A1: 認可テスト横展開・SECURITY_GAP_REPORT.md 作成 |
| `03a7e89` | IDOR 脆弱性修正（paypal/stripe）+ E2E リファクタ |
| `f639334` | A2: Visual Regression spec 追加 |
| `d261d76` | A3: a11y spec 追加 |
| `37754d9` | PayPal エラーハンドリング改善 |
| `217bf76` | capturePayPalPayment の try-catch リファクタ |

---

*Stay Red, Go Green, and Refactor rigorously.*
