# Implementation Plans — 索引

improve スキルの監査ラウンド（R1〜R14）と、その後の実装ラウンドで起票したプラン群の**索引**。
本ファイルは「次に何をやるか」を引くためだけに短く保つ（毎セッションの読み込みコストを抑えるため）。

- **ラウンド別の経緯・各プランの詳細な実行記録・推奨順の履歴・Deferred / Rejected 一覧**は
  [`archive/README-full-log.md`](archive/README-full-log.md)（2026-09-26 まで本ファイルだった全文。**凍結・更新しない**）
- 新デザイン・デザインシステム関連の計画: [`layout-design/`](layout-design/README.md)
- セッション再開時の状態: [`ADVISOR_STATE.md`](ADVISOR_STATE.md)
- **Deferred / Rejected の生きた台帳**: [`DEFERRED.md`](DEFERRED.md)（direction 残候補の単一の出所）
- 監査の生データ・triage 台帳: [`audit/`](audit/)（[`VETTED_FINDINGS.md`](audit/VETTED_FINDINGS.md) / [`recon.md`](audit/recon.md)）
- Expansion / Operations / Trust / Growth の現行 SSOT: [`docs/architecture/expansion/`](../docs/architecture/expansion/)

## 運用ルール（肥大化防止）

- **Status 表が実行状態の SSOT**。`ADVISOR_STATE.md` 等と食い違う場合は本表を正とする。
- Status セルは **1 行・状態語 + 日付 + コミット範囲まで**（例: `DONE（2026-09-26・abc1234〜def5678）`）。
  テスト件数・判断の経緯・発見事項は**各プラン本文の「実施結果」節**に書き、ここへ書き写さない。
- 着手前に各プランの Executor instructions / STOP conditions / Done criteria を読むこと。
- "Depends on" 列は **hard 依存のみ**。soft 順序・環境前提（Docker / `CLERK_SECRET_KEY` / `$DIRECT_URL`）は
  各プランの Step 0 と、アーカイブの "Dependency notes" 節を参照。

## 未完了のプラン（次の着手先）

| Plan | Title | Category | Priority | Depends on | Status |
|------|-------|----------|----------|------------|--------|
| [011](011-onboarding-docs-env-and-stale-plan.md) | Retire stale screens doc; complete env docs; add `.env.example` | docs | P3 | — | TODO |
| [012](012-spike-item-level-inventory-restock.md) | **Spike**: extend inventory restock to item-level transitions | direction | P3 | — | TODO |
| [016](016-spike-seller-onboarding-catalog-approval.md) | **Spike**: 出品審査ワークフロー（商品公開制御）設計 | direction | P3 | — | TODO |
| [017](017-spike-recommendation-foundation.md) | **Spike**: ルールベース・レコメンド基盤 v1 設計 | direction | P3 | — | TODO |
| [018](018-spike-returns-rma-workflow.md) | **Spike**: 返品・交換（RMA）ワークフロー設計 | direction | P3 | — | TODO |
| [019](019-spike-review-ugc-governance.md) | **Spike**: レビュー・UGC 品質ガバナンス設計 | direction | P3 | — | TODO |
| [020](020-spike-promotion-engine.md) | **Spike**: プロモーション・キャンペーンエンジン設計 | direction | P3 | — | TODO |
| [021](021-spike-notification-foundation.md) | **Spike**: 通知・トランザクショナルメッセージ基盤設計 | direction | P3 | — | TODO |
| [022](022-spike-seller-performance-trust.md) | **Spike**: セラーパフォーマンス指標・自動措置設計 | direction | P3 | — | TODO |
| [025](025-spike-rate-limit-public-endpoints.md) | **Spike**: 公開エンドポイントのレート制限 | security | P3 | — | TODO |
| [068](068-implement-category-tree-admin-cutover.md) | カテゴリツリー: admin UI 統合 + Phase C カットオーバー（**不可逆**・013 の後続実装 3/3） | direction | P2 | 067 | IN PROGRESS |

- **068**: 可逆な範囲は実装・検証済み。**不可逆な Phase C（Step 5–7）はオペレーター承認待ち**。
- Round 2/3 の spike（015–022）の soft 順序: 013 → 014 → 015 / 021 → 018 → 019 → 022（020・016・017 は独立）。

## 完了済みのプラン

<details>
<summary>DONE（62 件）— 実行記録はアーカイブと各プラン本文</summary>

| Plan | Title | Category | Priority | Depends on | Status |
|------|-------|----------|----------|------------|--------|
| [001](001-scope-order-item-status-to-owned-store.md) | Scope `updateOrderItemStatus` to owned store (cross-store IDOR) | security | P1 | — | DONE |
| [002](002-allowlist-mutable-store-fields.md) | Allowlist seller-editable Store fields (mass assignment) | security | P1 | — | DONE |
| [003](003-server-side-payment-and-address-trust.md) | Derive Stripe state server-side; verify address ownership | security | P1 | — | DONE |
| [004](004-upgrade-clerk-nextjs-security.md) | Upgrade `@clerk/nextjs` off CRITICAL auth-bypass advisory | dependencies | P1 | — | DONE |
| [005](005-cart-integrity-atomic-save-and-persist.md) | Atomic `saveUserCart` + single-source cart persist | correctness | P2 | — | DONE |
| [006](006-place-order-double-submit-guard.md) | Guard "Place order" against double submit | correctness | P2 | — | DONE |
| [007](007-logging-consolidation-and-debug-cleanup.md) | `logError` helper; remove debug `console.log`; fix coupon logs | tech-debt | P3 | — | DONE |
| [008](008-remove-dead-search-copy-and-relocate-schema.md) | Delete dead `search copy.tsx`; relocate inline Zod schema | tech-debt | P3 | — | DONE |
| [009](009-query-hygiene-bound-store-orders-and-drop-dead-query.md) | Bound `getStoreOrders`; remove discarded browse query | perf | P3 | — | DONE |
| [010](010-unit-test-compute-shipping-total.md) | Unit-test `computeShippingTotal` (shipping-fee SSOT) | tests | P3 | — | DONE |
| [013](013-spike-category-tree-n-level.md) | **Spike**: カテゴリ体系の N 階層ツリー化設計 | direction | P2 | — | DONE |
| [014](014-spike-category-attributes-facets.md) | **Spike**: カテゴリ別属性スキーマ（ファセット基盤）設計 | direction | P2 | — | DONE |
| [015](015-spike-faceted-search-and-browse.md) | **Spike**: ファセット検索・ブラウズ統合設計 | direction | P2 | — | DONE（2026-10-03） |
| [023](023-bound-and-validate-public-search-pagination.md) | 公開検索ページングの境界・検証 | security | P2 | — | DONE |
| [024](024-validate-usercountry-cookie-write.md) | userCountry cookie 書き込みの検証 | security | P3 | — | DONE |
| [026](026-unit-test-paypal-error-branches.md) | `paypal.ts` エラー経路分岐の unit テスト（B 28.6%→90%+） | tests | P2 | — | DONE |
| [027](027-integration-test-oversell-rollback-and-platform-coupon.md) | `placeOrder` 統合: オーバーセルロールバック + PLATFORM クーポン端数（TESTS-05+08） | tests | P2 | — | DONE |
| [028](028-unit-test-country-query.md) | `country.ts` unit テスト新設（最後の未テスト server action） | tests | P3 | — | DONE |
| [029](029-unit-test-profile-catch-branches.md) | `profile.ts` catch 分岐 + 期間フィルタの unit テスト | tests | P3 | — | DONE |
| [030](030-component-test-money-path-client.md) | money-path クライアント 6 ファイルの component テスト | tests | P3 | — | DONE |
| [031](031-integration-test-order-lifecycle-restock.md) | 注文キャンセル/返金の子連動 + restock 統合（TESTS-15、旧 TESTS-06 昇格） | tests | P2 | — | DONE |
| [032](032-integration-test-webhook-payment-idempotency.md) | Stripe/PayPal webhook 実 DB 冪等性 統合（TESTS-16、旧 TESTS-04 昇格） | tests | P2 | — | DONE |
| [033](033-integration-test-tsvector-search.md) | tsvector 全文検索 raw SQL の実 DB 統合（TESTS-17） | tests | P2 | — | DONE |
| [034](034-integration-test-review-aggregation.md) | upsertReview 評価集計（rating/numReviews）統合（TESTS-18） | tests | P3 | — | DONE |
| [035](035-integration-test-store-status-role-promotion.md) | updateStoreStatus PENDING→ACTIVE ロール昇格 統合（TESTS-19） | tests | P3 | — | DONE |
| [036](036-integration-test-product-deletion-fk.md) | deleteProduct FK Restrict/カスケード実挙動 統合（TESTS-20） | tests | P2 | — | DONE |
| [037](037-integration-test-shipping-address-default.md) | upsertShippingAddress default 不変条件 統合（TESTS-21） | tests | P2 | — | DONE |
| [038](038-integration-test-product-update-tx.md) | updateProduct 全置換 tx/slug/SetNull 連鎖 統合（TESTS-22、R5 次点昇格） | tests | P3 | — | DONE |
| [039](039-integration-test-product-browse-filters.md) | getProducts フィルタ/ソート/ページング 統合（TESTS-23） | tests | P3 | — | DONE |
| [040](040-integration-test-user-deletion-webhook.md) | Clerk user.deleted webhook の FK 連鎖（RESTRICT/CASCADE/SET NULL）統合（TEST… | tests | P2 | — | DONE |
| [041](041-integration-test-coupon-code-uniqueness.md) | Coupon.code グローバル unique と P2002 フォールバック 統合（TESTS-25） | tests | P3 | — | DONE |
| [042](042-e2e-signin-helper-repair.md) | E2E signIn の Clerk UI ドリフト修復（5 サイト）+ svg-img-alt 是正（TESTS-26+27） | tests | P1 | — | DONE |
| [043](043-e2e-vrt-rebaseline.md) | VRT ベースライン 3 枚の目視ゲート付き再撮影（TESTS-28） | tests | P2 | — | DONE |
| [044](044-e2e-run-guardrails.md) | E2E 実測の運用ガード（:3000 チェック + globalTimeout 60 分）（TESTS-29） | dx | P2 | — | DONE |
| [045](045-e2e-guest-flows.md) | ゲスト導線 E2E（compare / track-order / offers / 静的）（TESTS-33、TESTS-14 昇格） | tests | P2 | — | DONE |
| [046](046-browse-pagination-e2e.md) | /browse ページネーション最小配線 + 実データ E2E（TESTS-32 訂正版） | tests | P2 | — | DONE |
| [047](047-e2e-checkout-order-detail.md) | 住所未選択エラー un-skip + 注文詳細の金額明細検証（TESTS-30+31） | tests | P1 | 042 | DONE |
| [048](048-e2e-engagement-flows.md) | wishlist / フォロー / レビュー投稿 E2E（TESTS-34+35+36） | tests | P2 | 042 | DONE |
| [049](049-e2e-profile-orders-addresses.md) | プロフィール住所管理 + 注文履歴 E2E（TESTS-37） | tests | P3 | 042 | DONE |
| [050](050-e2e-admin-store-status.md) | 管理者店舗ステータス変更 → store ページ非公開 E2E（TESTS-38） | tests | P2 | 042 | DONE |
| [051](051-e2e-country-selector.md) | 国選択セレクタ（Ship to）cookie 往復 E2E（TESTS-40） | tests | P1 | — | DONE |
| [052](052-e2e-a11y-storefront-expansion.md) | a11y スキャンを browse / 商品詳細 / cart へ拡大（TESTS-43） | tests | P2 | 042 Step 4 | DONE |
| [053](053-e2e-auth-surface-smoke.md) | 認証サーフェススモーク（sign-up ウィジェット / Register / サインアウト）（TESTS-41） | tests | P2 | サインアウトのみ 042 | DONE |
| [054](054-e2e-vrt-expansion.md) | VRT 対象を商品詳細・browse へ拡大（TESTS-44） | tests | P3 | 043 | DONE |
| [055](055-e2e-guest-cart-login-handoff.md) | ゲストカート → サインイン後の引き継ぎ E2E（TESTS-42） | tests | P2 | 042 | DONE |
| [056](056-e2e-newsletter-characterization.md) | Newsletter dormant 404 の characterization E2E（TESTS-39） | tests | P3 | — | DONE |
| [057](057-upgrade-next-middleware-bypass.md) | Upgrade `next` off the HIGH middleware-bypass advisory (GHSA-26hh-7c… | dependencies | P1 | — | DONE |
| [058](058-scope-get-coupon-to-owner.md) | `getCoupon` を所有店舗にスコープ（cross-store IDOR read・SECURITY-10） | security | P1 | — | DONE |
| [059](059-paypal-capture-verification.md) | PayPal capture の金額/相関/通貨検証 + settled ガード（Stripe パリティ・SECURITY-12/13） | security | P1 | — | DONE |
| [060](060-server-validate-coupon-mutations.md) | クーポン mutation のサーバー側 Zod 検証（discount>99→負値 total 防止・SECURITY-14） | security | P1 | — | DONE |
| [061](061-security-response-headers.md) | レスポンス強化ヘッダ（clickjacking/MIME/referrer/HSTS・SECURITY-06） | security | P2 | — | DONE |
| [062](062-stop-leaking-search-error-message.md) | 検索 route の生 `error.message` 漏洩停止 + `error:any` 撤去（SECURITY-05） | security | P2 | — | DONE |
| [063](063-backfill-stripe-payment-amount.md) | `PaymentDetails.amount` の Stripe 既存行 backfill（セント→ドル・CORRECTNESS-05 … | correctness | P2 | — | DONE |
| [064](064-fix-shipping-address-default-invariant.md) | `upsertShippingAddress` の default 不変条件修正（新規経路の解除 + `$transaction` + … | correctness | P2 | 037 | DONE |
| [065](065-fix-product-detail-right-panel-clipping.md) | 商品詳細の右購入パネルが 1280px でクリップされる欠陥の修正（plan 054 のブロッカー） | correctness | P2 | — | DONE |
| [066](066-implement-category-tree-schema.md) | カテゴリツリー Phase A: スキーマ拡張・SubCategory 統合・互換レイヤー（013 の後続実装 1/3） | direction | P2 | 013 | DONE |
| [067](067-implement-category-tree-queries.md) | カテゴリツリー Phase B: 読み取りをサブツリー prefix へ切替（013 の後続実装 2/3） | direction | P2 | 066 | DONE |
| [069](069-implement-category-attributes.md) | カテゴリ別属性の実装（属性定義 CRUD + 動的フォーム + パイロット部門シード・014 の後続実装）。Step 1 実測: `Spec` 153 行・不正 0・孤児 0 / Step 2: `multiValued` 列 + 部分 UNIQUE（多値は ENUM 限定） | direction | P2 | 014 | DONE |
| [073](073-fix-search-suggest-and-browse-tiebreaker.md) | ヘッダー検索サジェスト復旧 + ブラウズ並び順の tie-breaker（015 で発見した既存バグ） | bug | P2 | — | DONE（2026-10-03・43b401d5〜86b9c786） |
| [074](074-product-search-vector-column.md) | 重み付き検索ベクトル列（brand・keywords）+ GIN（ADR-008・015 の後続実装 1/3） | migration | P2 | 073 | DONE（2026-10-03・43b401d5〜86b9c786） |
| [075](075-unify-browse-search-and-type-filters.md) | ブラウズ検索の検索ベクトル統合 + `ProductFilters` 型付け + slug 並列解決（015 の後続実装 2/3） | direction | P2 | 074 | DONE（2026-10-03・43b401d5〜86b9c786） |
| [076](076-facet-counts-and-min-price.md) | 属性ファセット件数 + `minPrice` 非正規化で価格ソートを全件に適用（015 の後続実装 3/3） | direction | P2 | 075 | DONE（2026-10-03・43b401d5〜86b9c786） |

</details>
