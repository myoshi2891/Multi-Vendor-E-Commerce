# QA & Test Implementation Handoff（次回セッションへの引き継ぎ）

> **最終更新**: 2026-06-25 / **HEAD**: `7fdc6ba`

---

## 現在の実装状態サマリ

### テスト統計（2026-06-22 時点）

| 指標 | 値 |
|------|-----|
| Jest テスト総数 (unit/component) | **1650** passed / 1653 total / 171 スイート（170 passed + 1 skipped suite）— 2026-06-22 SonarCloud Quality Gate 修復（PR #149 support-forms）：New Code Coverage 77.5% (< 80%) を解消し New Issues 4 件をクリア。Issue 修正＝`support-form.tsx`/`static-page-layout.tsx` の props を `Readonly<>` 化（S6759×2）・`<p role="status">`→`<output>`（S6819）・段落 key を index→内容（S6479）（`1508fc8`）。カバレッジ＝`support.test.ts` +5（`currentUser`/`create` の throw 経路を Error/非 Error 両系統）、`support-form.test.tsx` +4（送信成功 `<output>` 表示 / 失敗 alert / `requireOrderId` 欄 / `submitLabel` 上書き）、新規スイート `content/content.test.ts` +3（0% だった `faqs`/`legal`/`product-support`/`returns` 定数の import+shape 検証）= +12（`63c3755`）。対象本番 6 ファイルが新規コードで ~100% に。計 1638→1650 passed / 1641→1653 total / 170→171 スイート。直前 2026-06-22 support-forms 機能（`docs/design/support-forms/`）実装：4 種サポートフォーム（問い合わせ/返品/紛争/問題報告）を単一 `SupportTicket` モデル（`category` enum で識別・`orderId`/`userId` nullable・`status String @default("OPEN")`）+ additive migration（`add_support_ticket`・非破壊）+ ERD 再生成（rule 03）で実装。公開 server action `createSupportTicket`（`src/queries/support.ts`・認可ガードなし=ゲスト可・ログイン時のみ `currentUser()` で `userId` 付与・取得失敗はログして縮退・PII 本文は非ログ）+ `SupportTicketSchema`（Zod・`superRefine` で RETURN_REQUEST/DISPUTE のみ `orderId` 必須・空欄 `""` は `preprocess` で `undefined` 正規化）。共有 client フォーム `support-form.tsx`（RHF+zodResolver・`useRef` 二重送信防止・`requireOrderId` で orderId 欄切替）+ 公開ページ `/contact` `/returns-exchange`（返品ポリシー要約 `content/returns.ts` 静的定数同梱）`/dispute` `/report-problem`（DB を render 時に読まないため `force-dynamic` 不付与で 4 ルート全て `○ Static` 確認）。user-menu「Return & Refund Policy」`/`→`/returns-exchange`、「Order Dispute Resolution」`""`→`/dispute`、「Report a Problem」`""`→`/report-problem` を配線（3 行・Discounts & Offers 行は不変）。新規スイート `support.test.ts` +4（T-SF1〜T-SF4：CONTACT 作成/orderId 欠落却下/ログイン userId/未ログイン userId 未設定）、`support-form.test.tsx` +2（T-SF5 必須検証/T-SF6 リエントランシー）、既存 `user-menu.test.tsx` に +3 回帰（T-SF7：3 リンク、`e3c58aa`〜`3608a3b`）= +9。計 1629→1638 passed / 1632→1641 total / 168→170 スイート。直前 2026-06-22 storefront-static-pages 機能（`docs/design/storefront-static-pages/`）実装：共有プレゼンテーション部品 `StaticPageLayout`（`src/components/store/static/static-page-layout.tsx`・見出し/リード/セクション配列/任意目次を受け取り plain text `<p>` 描画＝`dangerouslySetInnerHTML` 不使用で XSS 回避・`slugify` でアンカー生成）+ 型付きコンテンツ定数 5 本（`content/{about,legal,faqs,product-support,customer-service}.ts`）+ 公開ページ `/about` `/legal`（目次付き）`/faqs` `/product-support` `/customer-service`（ポータル・`SUPPORT_LINKS` から 5 導線カード）+ `/faq`→`/faqs` の 308 `permanentRedirect`。DB 非依存のため `force-dynamic` 不付与で SSG 維持（build で 6 ルート全て `○ Static` 確認）。user-menu「Help Center」`""`→`/customer-service`、「Legal & Privacy」`""`→`/legal` を配線（2 行）。新規 server action・schema 変更なし。新規スイート `static-page-layout.test.tsx` +5（title/h2/段落分割/lead/withToc 目次）、`about/page.test.tsx` +1（`<h1>About`）、`customer-service/page.test.tsx` +1（5 導線 href）、既存 `user-menu.test.tsx` に +2 回帰（Help Center→`/customer-service` / Legal & Privacy→`/legal`、旧 `""` を弾く、`fa1f56a`〜`227ca0e`）= +9。計 1620→1629 passed / 1623→1632 total / 165→168 スイート。直前 2026-06-22 offers 機能（`docs/design/offers/`）実装：プラットフォーム全体のオファー landing `/offers`（`src/app/(store)/offers/page.tsx`・`force-dynamic`・既存 `getAllOfferTags` 再利用・商品グリッドは持たず各タグを `/browse?offer=<url>` へ委譲＝DRY）+ user-menu「Discounts & Offers」を `""`→`/offers` に配線（1 行）。新規 server action・schema 変更なし。新規スイート `offers/page.test.tsx` +2（T-OF1 一覧＋`/browse?offer=<url>` リンク描画 / T-OF2 空状態、`getAllOfferTags` mock、`fd11326`〜`90f774d`）、既存 `user-menu.test.tsx` に T-OF3 回帰 +1（Discounts & Offers→`/offers`、旧 `""` を弾く、`67c4023`〜`d2cd4e4`）= +3。計 1617→1620 passed / 1620→1623 total / 164→165 スイート。直前 2026-06-22 compare レビュー指摘修正：`compare-grid.tsx` の catch に非 `Error` 値用の `else`（`"[Compare:fetch] Unknown error"` 構造化ログ）を追加し tech.md パターンへ整合、回帰テストを両スイートへ +4（`useCompareStore.test.ts` に永続化契約 3 件 [compare-store キーへの setItem / remove 後の再永続化 / 既存データからの rehydrate]、`compare-grid.test.tsx` に非 `Error` reject の Unknown error 分岐 1 件）。スイート数不変。計 1613→1617 passed / 1616→1620 total。直前 2026-06-22 SonarCloud Quality Gate 修復（PR #147 compare 機能）：New Code Coverage 63.6% (< 80%) を解消。`product-card.tsx`（テストファイル無し = 0%）に `product-card.test.tsx` 新規 +8（compare トグル 3 分岐 [追加 / 削除 / 上限 4] + wishlist 成功 / 失敗 catch + rating>0&&sales>0 条件、`e8fe553`）、既存 `compare-grid.test.tsx` を +4（loading スケルトン / 個別 remove / clear all / `getProductsByIds` reject catch、`e39a38e`）で両ファイル Lines 100%。あわせて `product-card.tsx` wishlist catch の `error: any` を `unknown` + `instanceof Error` 型ガードへ修正（no-any 規約準拠、`22bb3f3`）。計 1601→1613 passed / 1604→1616 total / 163→164 スイート。直前 2026-06-21 Compare 機能（商品比較）実装：Zustand+persist `useCompareStore`（`src/compare-store/`・バリアント ID 保持・上限 4・冪等・`isComparing`）+ `/compare` ページ（client wrapper）+ `CompareGrid`（client・既存 `getProductsByIds` 再利用・`useEffect` キャンセルフラグ・items 空時は未呼び出しで空状態 = `getProductsByIds` の空配列 throw 回避）+ 商品カードへ Add-to-compare トグルボタン（tasks.md 2-B・トグル＋トースト・上限 4 超過は `toast.error`）。新規 server action・schema 変更なし。ユニット `useCompareStore.test.ts` +8（T-CMP1〜4 + isComparing）+ component `compare-grid.test.tsx` +2（T-CMP5/T-CMP6・`getProductsByIds` mock）= +10（`23f7332`〜`bdf3356`）。計 1591→1601 passed / 1594→1604 total / 161→163 スイート。直前 2026-06-20 SonarCloud Quality Gate 修復（PR #145）：購入者向け `messages-container.tsx` と販売者向け `seller-messages-container.tsx` の ~214 行相互コピー（Duplicated Lines 9.7% > 3.0% の主因）を共通フック `src/components/shared/messages/use-conversation-thread.ts`（ポーリング/既読化/送信後再フェッチ/レースガード）+ 汎用 `messages-layout.tsx`（2 ペイン骨格・アバター取得を `getAvatar` で注入）へ抽出し両コンテナを薄いラッパ化（`456fadf`）。あわせて新規コードのカバレッジを底上げ：`message.test.ts` +14（全 server action の catch を Error/unknown 両系統 + 未テストの DB エラー経路 + order null 経路、Branches 74.5%→100%、`2d5ab8a`）、`messages-container.test.tsx` +11 / `seller-messages-container.test.tsx` +1（共有フック/レイアウトの poll/markRead/handleSent catch 両系統・レースガード・inFlight・cancelled・no-op・アバター描画、両コンテナ+shared/messages Branches 100%、`082bf0a`）、`user-menu.test.tsx` +5（認証済み/未認証経路・fullName フォールバック・catch Error/unknown、37.5%→100%、`cdc81d5`）。計 1560→1591 passed / 1563→1594 total（161 スイート不変）。直前 profile-messages Phase 4（販売者 UI・ループ閉鎖）完了：`getStoreConversations` の include に購入者（`user` name/picture）を追加し `StoreConversationWithLatest` 型を新設（販売者左ペインで会話を識別）。販売者ページ `/dashboard/seller/stores/[storeUrl]/messages`（`force-dynamic`）+ `seller-messages-container.tsx`（`conversation-thread.tsx` 流用・返信は共有 `sendMessage`）+ seller サイドバー Messages 導線（`messages` アイコン新規）を追加。component テスト 1 スイート +7（`seller-messages-container.test.tsx`：購入者名での一覧描画/選択時 fetch+既読化/5 秒ポーリング/`document.hidden` 停止/返信後再フェッチ/poll 失敗ログ、`8ab715e`〜`95d0005`）。計 1553→1560 passed / 1556→1563 total / 160→161 スイート。直前 2026-06-19 profile-messages Phase 2+3（購入者↔販売者メッセージング）：Phase 2 で `src/queries/message.test.ts` 新規 +31（6 server action の認可 / IDOR 3 階層 [getConversationMessages/sendMessage/markConversationRead] / 冪等 upsert / `$transaction` 検証、`fcbcb3d`）。Phase 3 で購入者 UI（`/profile/messages`・5 秒ポーリング）の component テスト 2 スイート +14（`conversation-thread.test.tsx` 7：バブル左右振り分け/送信/Zod 空入力/リエントランシーガード/失敗 toast+構造化ログ、`messages-container.test.tsx` 7：一覧描画/選択時 fetch+既読化/5 秒ポーリング再取得/`document.hidden` 停止/送信後再フェッチ/poll 失敗ログ、`e4e752d`〜`a20a313`）。計 1508→1553 passed / 1511→1556 total / 157→160 スイート。直前 profile-settings Phase 1（Settings 画面 + 導線修正）完了：`user-menu` の Settings リンク回帰（`/`→`/profile/settings`）、`profile-sidebar` の Settings エントリ、`settings/page.tsx` の `<UserProfile />` 描画の +3（新規スイート 3：`tests/component/store/{user-menu,profile-sidebar,settings-page}.test.tsx`、`413ed19`〜`9d5629d`）で 1505→1508 passed / 1508→1511 total / 154→157 スイート。新規 server action・schema 変更なし（プロフィール編集は既存 Clerk webhook が Prisma 同期）。直前 Phase 4（F3 在庫減算 + F3-5 在庫復元）は `8cbf4c0`〜`eca47a6`（1496→1505 passed） |
| Jest Integration テスト総数 | **17** / 2 スイート（`cart-checkout.test.ts` 11 + `order-placement.test.ts` 6）— 2026-05-31 placeOrder 統合テストで +6 / +1 スイート。`bun run test:integration` (testcontainers + jsdom 専用 config) で実行。`bun run test` の集計外 |
| Jest スナップショット | **127**（`tests/component/ui/__snapshots__/`）— B1+ Sprint 4 で +15（form / calendar / carousel / command / sidebar / navigation-menu / sonner / accordion / toast / toaster / data-table） |
| Playwright E2E（main） | **9 スペック**（purchase-flow / seller-onboarding / payment-error / search-filter / mobile-responsive / platform-coupon / stock-decrement / messages / layout-chrome）— 2026-06-25 共通レイアウト統一: `tests/e2e/layout-chrome.spec.ts` 追加（`(store)` 全ページで `store-header`/`store-footer` が各1つ描画・ホームが二重ヘッダーにならない・`(fullscreen)` の `seller/apply` には共通 chrome 無し、を検証。`data-testid=store-header/store-footer` を header/footer ルートに付与。6 テスト、chromium で通過確認・3 ブラウザ対象、`7fdc6ba`）。背景: ヘッダー/フッターを各 `page.tsx` で個別描画していたため `/compare` `/returns-exchange` `/product-support` 等で未表示だった問題を、`(store)/layout.tsx` での共通描画に集約して解消。`order`/`seller` 全画面ページは `(fullscreen)` ルートグループへ退避。Jest 集計は不変。2026-06-20 profile-messages Phase 5: `tests/e2e/messages.spec.ts` 追加（AC-M8 往復: 購入者が `/profile/messages` で送信 → 販売者が `/dashboard/seller/stores/[storeUrl]/messages` で受信・返信 → 購入者ページの 5 秒ポーリングが返信を自動受信。buyer/seller を別 browser context に分離して同時セッション維持。Clerk テストモードで USER/SELLER 動的生成・会話は `beforeAll` で Prisma 直挿入・`CLERK_SECRET_KEY` 未設定時 `test.skip`。Chromium で往復通過確認・3 ブラウザ対象、`ea89706`）。Jest 集計は不変。2026-06-19 Phase 4: `tests/e2e/stock-decrement.spec.ts` 追加（認証付き購入フロー完走後に対象 `Size.quantity` が注文数分減ることを検証・AC-F3-4、`1a66ed2`）。2026-06-16 Phase 5-C: `tests/e2e/platform-coupon.spec.ts` 追加（`3463d1d`） |
| Playwright Visual | **2 スペック**（cart / checkout） |
| Playwright a11y | **4 スペック**（sign-in / seller-apply / checkout / profile） |
| 型エラー | **0 件** |
| Skipped テスト | **3 件**（idempotency suite 3 件 [`prisma/seed/__tests__/idempotency.test.ts` を `SKIP_DB_TESTS` 環境変数で `describe.skip`]）。modal-provider 9 件は 2026-06-14 に un-skip 済み（OI-8 解消）。Playwright a11y spec は別系統で `CLERK_SECRET_KEY` 未設定時に `test.skip` 条件分岐 |
| Skipped スイート | **1 件**（idempotency suite のみ。modal-provider.test.tsx の file-level skip は OI-8 解消で解除） |

---

## 2026-05-31: ダッシュボード Unit 行の✦化（seed 除く）

[`COVERAGE_REPORT.md §2`](./COVERAGE_REPORT.md) ヒートマップの **Unit カテゴリ行**で◯だった `pages / store / dashbd / shared` を、各ドメインに co-located unit テストを追加して **✦（lcov ≥ 60%）に昇格**。

- **基盤**: [`jest.config.js`](../../jest.config.js) に `collectCoverageFrom`（ロジック中心の `src/**`、型・定数・テストインフラ・純表示物を除外）と `coverageReporters: ["lcov", "text-summary"]` を追加。`prisma/seed` は `src` 外のため分母外。unit config の `moduleNameMapper` に画像・スタイルの空モックを追加（コンポーネント unit テストの基盤）。
- **追加テスト（co-located, 10 ファイル / +42）**:
  - shared-ui: `logo` / `color-wheel` / `theme-toggle`
  - store-ui: `shared/pagination` / `shared/countdown` / `cards/rating-statistics`
  - dashboard-ui: `shared/color-palette` / `forms/click-to-add` / `shared/images-preview-grid`
  - pages: `app/dashboard/admin/categories/columns`
- **Unit 行の最終状態**: `queries ✦ / pages ✦ / store ✦ / dashbd ✦ / shared ✦ / lib ✦`、`hooks ◐`（modal-provider の OI-8 スキップ）、`seed ◐`（logic-centric で意図的に分母外）、`other ◐`（`scan-tests.test.ts` が `.skip` 文字列を含むスキャナ自己参照、Issue #7 同種）、`api ◯`（**構造的 N/A**: `src/app/api/*` は categorize 上必ず `api-contract` になり Unit セルは埋まらない。実カバーは **API/Contract 行 ✦** が担保）。

---

## 2026-05-31: placeOrder の実 DB 統合テスト（Integration tier 拡充）

B3（cart-checkout）で確立した `tests/integration/` 基盤（testcontainers + 実 PostgreSQL）を踏襲し、
最もトランザクション依存の高い**注文確定フロー `placeOrder`（`src/queries/user.ts`）** を初めて実 DB で検証。

- **追加テスト**: `tests/integration/order-placement.test.ts`（6 シナリオ / 1 スイート）。
  単一店舗 FK・Decimal 集計 / 複数店舗 OrderGroup 分割 / 在庫キャップ（`Math.min`）/ クーポン店舗限定割引 /
  所有権ガード（IDOR・副作用なし）/ 不正 variant·size 組み合わせの拒否。
- **基盤拡張**: `tests/integration/setup/seed.ts` に ProductVariantImage 作成（`placeOrder` が `variant.images[0].url` を参照）
  と `seedShippingAddress` を追加（commit `78a20c9`）。本体コード（`src/`）は無変更。
- **統計**: Integration 11 → **17** / スイート 1 → **2**。`bun run test`（unit/component 1179）は変動なし。
  ダッシュボードのテストファイル総数 134 → 135。
- **categorize ドリフト（D1 で恒久解消済み 2026-06-02, commit `b57841a`）**: 当初 `scripts/coverage-dashboard/categorize.ts` は
  Integration カテゴリを `tests/component/` のみにマップしたため、`tests/integration/` 配下（cart-checkout / order-placement）は
  ダッシュボード上 **unit × other セル**に誤分類されていた。D1 で `tests/integration/` → `integration × queries` の分類規則を追加し解消。
  再生成（lcov あり）で `integration × queries` ◯→◐（同名ソース無しで lcov `null` のため partial）、`coveredCells` 17→18（21%→23%）。
  Issue #4 の api→api-contract 上書き設計は非干渉で維持。
- 参照コミット: `78a20c9`（seed 基盤）/ `ae28157`（テスト本体）

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
| F1-1 | StatsCards (admin dashboard) | `tests/component/dashboard/admin/stats-cards.test.tsx` | ✅ 完了 |
| F1-2 | RecentOrders (admin dashboard) | `tests/component/dashboard/admin/recent-orders.test.tsx` | ✅ 完了 |
| F1-3 | SalesChart (admin dashboard) | `tests/component/dashboard/admin/sales-chart.test.tsx` | ✅ 完了 |
| F1-4 | RecentStores (admin dashboard) | `tests/component/dashboard/admin/recent-stores.test.tsx` | ✅ 完了 |

### ⚠️ Phase 3（E2E テスト）— スケルトン完了・一部保留

| ステップ | ファイル | 状態 | 備考 |
|---|---|---|---|
| Step 22 | `tests/e2e/purchase-flow.spec.ts` | ✅ 8/8 テスト | 「複数バリアント追加」を 2026-05-22 に追加（OI-2 解消） |
| Step 23 | `tests/e2e/seller-onboarding.spec.ts` | ✅ ファイル作成済み | 実行は seed:e2e 前提 |
| Step 24 | `tests/e2e/payment-error.spec.ts` | ✅ ファイル作成済み | 実行は seed:e2e 前提 |
| Step 25 | `tests/e2e/search-filter.spec.ts` | ✅ ファイル作成済み | 実行は seed:e2e 前提 |
| Step 26 | `tests/e2e/mobile-responsive.spec.ts` | ✅ ファイル作成済み | 実行は seed:e2e 前提 |

### ✅ A1（認可テスト横展開）— 完了（2026-05-21）

- `docs/testing/SECURITY_GAP_REPORT.md` で 14 ファイルの認可カバレッジを調査・記録
- `review.test.ts` に IDOR レグレッションテストを追加
- `paypal.ts` / `stripe.ts` の IDOR 脆弱性（orderId 所有権チェック欠落）を修正 → テスト有効化
- 参照コミット: `55c07b1`, `03a7e89`, `37754d9`, `217bf76`

### ✅ A4（認可ガード統合 + IDOR テスト 3 階層化）— 完了（2026-05-24）

- **認可ガード統合 (`src/lib/auth-guards.ts`)**: `requireUser` / `requireAdmin` / `requireSeller` / `requireStoreOwner` を導入し、`category` / `subCategory` / `offer-tag` / `coupon` / `product` / `store` の各 Server Action からインライン認可チェックを撤去。エラーメッセージを SSOT 化（"Forbidden: store not owned by current user." 等）。
- **CSRF 防御方針 (ADR 001)**: Next.js 16 Server Actions の Origin/Host 検証 + Clerk SameSite=Lax Cookie に依拠する方針を採択。明示的トークン実装は導入しない。`specs/multi-vendor-ecommerce/06-quality.md` / `.claude/steering/tech.md` に明文化。
- **IDOR テスト 3 階層化**: 既存の「(a) スロー検証」に加え、「(b) `where: { url, userId }` 構造検証」「(c) ガード失敗時の副作用なし検証（下流の `upsert` / `create` / `delete` / `findMany` 非呼び出し）」を 8 件追加 (`product.test.ts` +4 / `coupon.test.ts` +1 / `store.test.ts` +3)。
- 参照コミット: `a73603e` 〜 `eae2cfe`

### ✅ A2（Visual Regression MVP）— 完了（2026-05-22）

- `tests/e2e/visual/cart.spec.ts` / `checkout.spec.ts` を追加（chromium 限定）
- `playwright.config.ts` に `reducedMotion: 'reduce'` / `locale: 'en-US'` / `timezoneId: 'UTC'` を追加
- baseline スクリーンショット 3 枚をコミット済み（`688225f`）
  - `cart.spec.ts-snapshots/cart-empty-chromium-darwin.png`
  - `cart.spec.ts-snapshots/cart-with-item-chromium-darwin.png`
  - `checkout.spec.ts-snapshots/checkout-redirect-signin-chromium-darwin.png`
- ⚠️ **CI（Linux）では `-linux.png` baseline が別途必要**（詳細は `specs/multi-vendor-ecommerce/07-testing.md §Visual Regression`）
- 参照コミット: `f639334`, `688225f`

### ✅ A3（a11y MVP）— 完了（2026-05-21）

- `tests/e2e/a11y/sign-in.spec.ts` / `seller-apply.spec.ts` を追加
- `@axe-core/playwright` で WCAG 2.1 AA スキャン
- 参照コミット: `d261d76`

---

## 残課題・Open Issues

### 🔴 現在アクティブな残課題（優先度順・2026-06-19 時点） {#active-open-issues}

> 解消済み OI（OI-1〜OI-8）は下表に取り消し線付きで監査証跡として残す。**着手すべきは以下 4 件（OI-9 / OI-11 / OI-10 / C2）。**

| 優先 | ID | 課題 | 期限 / 状態 | 次の一手 |
|---|---|---|---|---|
| **1（最優先）** | **OI-9** | ホーム `/` が SSR で 500（`featured.tsx` の `window` 初期化子参照） | 🟡 未着手 | 遅延初期化 `useState(() => typeof window !== "undefined" ? window.innerWidth : 0)` + `useEffect` で実測反映。**これは下記 NEXT_ACTION「D2（Performance 行着手）」の前提**：修正後に `.lighthouserc.json` / `lhci.yml` の計測 URL へ `/` を追加できる。 |
| 2 | **OI-11** | `/dashboard/seller` 系ルートが本番 SSR で `ReferenceError: self is not defined`（`next-cloudinary` の `CldUploadWidget` をサーバ評価）。OI-9 と同族の client-only ref 問題。現状テストは落ちていない（ログのみ）が本番でも再現の可能性 | 🟡 未着手 | `image-upload.tsx` の `CldUploadWidget` を `next/dynamic` の `ssr:false` で遅延 import する。発見: 2026-06-19（E2E 本番ビルド化で顕在化） |
| 3 | **OI-10** | a11y `color-contrast` 負債: `/checkout`・`/profile`・`/seller/apply` でグレー/ブルー系テキストが 4.5:1 未満。E2E では `runA11yScan` の `disabledRules:["color-contrast"]` で抑制中（追跡のため意図的） | 🟢 低 | 配色（テキスト色）を是正して `disabledRules` を解除する。発見: 2026-06-19（a11y readiness 修正で axe 到達後に検出） |
| 4 | **C2** | Bundle Size の継続監視 | 🟢 低 | `@next/bundle-analyzer + size-limit` で初期 JS の閾値超過を CI 警告（下記 C2 プロンプト参照）。 |

> ✅ **OI-8 完了（2026-06-14）**: CI flake の真因は `src/queries/size.test.ts` の `@/lib/db` 未モックによる実 Prisma 接続リーク（stub DB へ P1001 → jest-circus が別ファイルへ「本文空」失敗を帰属）。`size.test.ts` に `jest.mock("@/lib/db")` を追加して根絶（`83ef06c`）→ 被害者だった `modal-provider.test.tsx` 9 件を un-skip（`49fa32d`、1272→1281 / skip 12→3）。CI push/pull_request 両 event × 2 サイクル緑・stub DB フルスイート P1001 = 0。詳細: [`docs/ci/archive/unit-tests-run-reactive.md`](../ci/archive/unit-tests-run-reactive.md)。
>
> ✅ **D1 完了（2026-06-02）**: ダッシュボード Integration 行の誤分類（`tests/integration/` が `unit × other` セルに分類）は `categorize.ts` 改修で恒久解消（commit `b57841a`）。`integration × queries` ◯→◐（lcov に同名ソース無しのため partial）。詳細: [`COVERAGE_REPORT.md §3 D1`](./COVERAGE_REPORT.md)。

---

### 📜 Open Issues 監査証跡（解消済み含む全履歴）

| # | 課題 | 優先度 | 備考 |
|---|---|---|---|
| ~~OI-1~~ | ~~Visual Regression baseline 未コミット~~ | ~~🔴 高~~ | ✅ 解消済み（`688225f`） |
| ~~OI-2~~ | ~~`purchase-flow.spec.ts` の「複数バリアント追加」1テスト保留~~ | ~~🟡 中~~ | ✅ 解消済み（2026-05-22、`tests/e2e/seed/constants.ts` に第2バリアント追加 + spec 追加） |
| ~~OI-3~~ | ~~`/checkout` / `/profile` の a11y spec 未追加~~ | ~~🟡 中~~ | ✅ 解消済み（2026-05-22、`tests/e2e/helpers/auth.ts` + `tests/e2e/a11y/{checkout,profile}.spec.ts`。`CLERK_SECRET_KEY` 未設定時は自動スキップ） |
| ~~OI-4~~ | ~~`.github/workflows/` CI 未整備~~ | ~~🟡 中~~ | ✅ 解消済み（2026-05-22、`.github/workflows/ci.yml` に lint/test/build 3 並列ジョブ） |
| ~~OI-4a~~ | ~~CI で Visual Regression の `-linux.png` baseline 生成~~ | ~~🟡 中~~ | ✅ 解消済み（2026-05-22、`ci.yml` に `workflow_dispatch` 起動の `visual-baselines` ジョブ追加。`gh workflow run ci.yml --ref <branch>` で起動 → 自動 PR） |
| ~~OI-5~~ | ~~E2E シード冪等性（CI 環境での `seed:e2e`）~~ | ~~🟡 中~~ | ✅ 解消済み（2026-05-22、`ci.yml` の `seed-idempotency` ジョブで PG service container 起動 → seed 2回実行 → 行数 diff 検証） |
| ~~OI-6~~ | ~~`DashboardStats` コンポーネント調査未完了~~ | ~~🟢 低~~ | ✅ 解消済み（2026-05-24、調査結果: ソース・仕様ともに該当コンポーネントなし。`src/app/dashboard/{admin,seller}/.../page.tsx` はプレースホルダー、`specs/multi-vendor-ecommerce/04-interfaces.md` も「overview」と記載のみ。統計 UI 要件は将来の機能追加時に `specs/` で別途起票） |
| ~~OI-7~~ | ~~`coverage/lcov.info` が古い (2025-03-16 時点)~~ | ~~🟢 低~~ | ✅ 解消済み（2026-05-24、`/coverage` は `.gitignore:10` 対象で git 管理外。`bun run test -- --coverage` でローカル再生成 → `bun run coverage:dashboard` で `docs/coverage-dashboard.html` を更新する運用を確認。CI でのカバレッジ自動化は [`COVERAGE_REPORT §3 B4`](./COVERAGE_REPORT.md#b4-ci-でのカバレッジ-artifact-化--dashboard-自動再生成) に移管 → **B4 完了（2026-06-03）**: `ci.yml` の `test` ジョブで `bun run coverage:dashboard` を実行し `docs/coverage-dashboard.html` を `coverage-dashboard` artifact 化。`generatedAt` の churn 回避のため自動コミットはせず artifact 化に限定） |
| **OI-9** | **ホーム (`/`) が SSR で 500**: `src/components/store/home/main/featured.tsx:13` の `useState<number>(window.innerWidth)` が初期化子で `window` を参照し、`"use client"` でも SSR 実行時に `ReferenceError: window is not defined` を投げる。本番 SSR でも再現の可能性。**修正案**: `useState<number>(() => typeof window !== "undefined" ? window.innerWidth : 0)` の遅延初期化 + `useEffect` で実測値を反映。**影響**: C1 (Lighthouse CI) で `/` を計測対象から除外中。修正後に `.lighthouserc.json` / `lhci.yml` の URL へ `/` を追加する。発見: 2026-05-30 (C1 検証中) | 🟡 中 | 未着手。lhci は `/browse` のみで暫定運用 |
| ~~OI-8~~ | ~~CI flake（本文空・ローカル緑/CI赤・失敗テストがランダム移動）~~。真因確定 + 解消 2026-06-14 | ✅ 解消済み（2026-06-14） | **真因確定（2026-06-14）**: `src/queries/size.test.ts` が `@/lib/db` をモックせず実 Prisma を `spyOn` していたため、CI の stub `DATABASE_URL` へバックグラウンド接続が `PrismaClientInitializationError`(P1001) で reject。その非同期 reject が同一ワーカーのプロセス境界をまたいでリークし、jest-circus が「その瞬間 current な別ファイルのテスト/フック」に `error` イベントとして帰属（P1001 の stack getter が空のためレポーターが本文を空に整形 → 「本文空」署名）。modal-provider / shipping-form / review-details はいずれも Prisma 非依存の**被害者**だった。**過去の仮説の誤り**: 仮説 A(isMounted)/B(MSW)/workflow 層はいずれも対症療法。`[FLAKE-DIAG:unhandledRejection]`(`0736735`) が沈黙したのは、真因が process の unhandledRejection ではなく jest-circus の `error` イベントだったため。**実観測手段**: 一時カスタム jsdom 環境の `handleTestEvent` で失敗イベントの生エラーを surface（`a93effe`、撤去 `756c6a9`）→ 3× P1001 を捕捉（失敗 push run `27487047124`）。**修正**: `size.test.ts` に `jest.mock("@/lib/db")` 追加（`83ef06c`）。stub DB のフルスイートで P1001 が 6+→0、review-details は CI push/PR 両 event × 2 サイクル緑で確認。**完了（2026-06-14）**: 被害者だった `modal-provider.test.tsx` 9 件を un-skip（`49fa32d`）→ CI push/pull_request 両 event 2 サイクル緑 → `spec-sync-after-test`（passed 1272→1281 / skip 12→3）。手順全文（アーカイブ）: [`docs/ci/archive/unit-tests-run-reactive.md`](../ci/archive/unit-tests-run-reactive.md)。 |

---

## 次回セッション 推奨着手順

> **このファイルが即時 TODO の Single Source of Truth。**
> 中長期タスク（B1〜C2）の戦略的背景は [`COVERAGE_REPORT.md §3`](./COVERAGE_REPORT.md#3-next-actions-カバレッジ観点の戦略台帳) を参照。

### ✅ 完了

全ての優先 OI（OI-2 / OI-3 / OI-4 / OI-4a / OI-5）は 2026-05-22 に解消済み。
**B1（shadcn/ui プリミティブ Snapshot）** は 2026-05-23 に MVP 9 プリミティブ分を完了（40 snapshot）。
**A4（認可ガード統合 + IDOR 3 階層化）** は 2026-05-24 に完了（テスト総数 990 → 1016、+26 件）。**A4 残課題 `getStoreOrders` 統合** は 2026-05-26 にクローズ（`70f5b94`、テスト総数 1015 → 1016 / +1）。
**B1+ Sprint 1（Tier 1 前半 10 プリミティブ）** は 2026-05-26 に完了（`b55e177`〜`66fb8d5`、テスト総数 1016 → 1042 / +26、snapshot 40 → 66 / +26）。
**B1+ Sprint 2（Tier 1 後半 11 プリミティブ）** は 2026-05-28 に完了（`750d830`〜`45c339b`、テスト総数 1042 → 1069 / +27、snapshot 66 → 93 / +27）。
**B1+ Sprint 3（Tier 2 全 8 プリミティブ）** は 2026-05-28 に完了（`e6c79e3`〜`4429b8b`、テスト総数 1069 → 1088 / +19、snapshot 93 → 112 / +19）。
**B1+ Sprint 4（Tier 3 + 補助 全 11 プリミティブ）** は 2026-05-28 に完了（`1b207ba`〜`8e429f2`、テスト総数 1088 → 1103 / +15、snapshot 112 → 127 / +15）。**B1+ 全完了**：49/49 shadcn/ui プリミティブが snapshot テストでカバーされ、NA-NS-01 をアーカイブ化。

### 残課題

- 現在、アクティブな残課題は **OI-9 / OI-11 / OI-10 / C2** の 4 件です（優先度・次の一手は[アクティブな残課題テーブル](#active-open-issues)を SSOT として参照）。**OI-8（CI flake）は 2026-06-14 に解消済み**（真因 = `size.test.ts` の Prisma 接続リーク `83ef06c` + modal-provider un-skip `49fa32d`。経緯: [`docs/ci/archive/unit-tests-run-reactive.md`](../ci/archive/unit-tests-run-reactive.md)）。
- 中長期タスクは [`COVERAGE_REPORT.md §3`](./COVERAGE_REPORT.md#3-next-actions-カバレッジ観点の戦略台帳) の B / C グループに集約。

### 🟢 中長期（COVERAGE_REPORT §3 B/C グループ）

- ~~**B1** shadcn/ui プリミティブの Snapshot~~ ✅ MVP 完了（2026-05-23、9 プリミティブ / 40 snapshot）
- ~~**B1+** shadcn/ui プリミティブ Snapshot 拡張~~ ✅ **全完了（2026-05-28）**。Sprint 1 (Tier 1 前半 10) + Sprint 2 (Tier 1 後半 11) + Sprint 3 (Tier 2 全 8) + Sprint 4 (Tier 3 + 補助 全 11) で **49/49 プリミティブ・127 snapshot**。NA-NS-01 をアーカイブ化
- ~~**B2** Stripe / PayPal Webhook の Contract テスト拡充~~ ✅ **完了（2026-05-28）**。`/api/webhooks/stripe` / `/api/webhooks/paypal` ハンドラーを新規実装し、payment_intent.succeeded/failed/charge.refunded と PAYMENT.CAPTURE.COMPLETED/DENIED/REFUNDED を冪等処理。30 ケース + metadata 検証 2 ケースで網羅
- ~~**B3** Cart → Checkout の Integration テスト~~ ✅ **完了（2026-05-29）**。`tests/integration/cart-checkout.test.ts` で 4 シナリオ計 11 テストを実装：Zustand persist hydration（2）/ shipping fee 一貫性 ITEM/WEIGHT/FIXED（3）/ クーポン適用（5 正常+異常）/ 未認証リダイレクト（1）。基盤として testcontainers PostgreSQL + 専用 jest config を新設（ADR-004）
- ~~**C1** Lighthouse CI（パフォーマンス予算化）~~ ✅ **完了（2026-05-30）**。`.github/workflows/lhci.yml` + `.lighthouserc.json` を新設し、`@lhci/cli` で `/browse` の LCP/CLS/TBT を計測（warn-only ベースライン）。Clerk は pk_live ダミーで dev handshake を回避。ホーム `/` は OI-9（featured.tsx SSR window バグ）で除外
- **C2** Bundle Size 継続監視（🟢 低）
- ~~**D1** ダッシュボード `categorize.ts` 改修：`tests/integration/` を Integration 行へ正しく分類~~ ✅ **完了（2026-06-02）**。`unit × other` 誤分類を恒久解消し `integration × queries` ◯→◐（commit `b57841a`）
- **D2** Performance 行の着手（🟡 中 / cost M）：**OI-9 修正が前提**。`/` の SSR 500 を解消 → lhci 計測 URL に `/` 追加 → warn→error 化で予算厳格化

詳細は [`COVERAGE_REPORT.md §3`](./COVERAGE_REPORT.md#3-next-actions-カバレッジ観点の戦略台帳) を参照。D2 の着手プロンプトは本ファイル「次回着手用 依頼プロンプト」を参照。

---

## 主要コミット履歴（2026-05-21〜28）

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
| `688225f` | A2: Visual Regression baseline スクリーンショット 3 枚をコミット |
| `927ea05` | OI-7: lcov 再生成後の coverage-dashboard.html を更新（テストファイル 65→80 / lcov 50→95） |
| `a73603e`–`8766979` | A4: 認可ガード `requireAdmin` / `requireStoreOwner` を category / subCategory / offer-tag / coupon / product に展開 |
| `c83a5c4` | A4: `store.ts` 配送系 3 アクションに `requireStoreOwner` 適用、`findUnique` 二重呼び出しを統合 |
| `eae2cfe` | A4: クロステナント IDOR 補完テスト 8 件追加（where 構造検証 + 副作用なし検証、990 → 1016） |
| `eae2cfe` | A4: 統計 SSOT (QA_HANDOFF / PROGRESS / COVERAGE_REPORT / SECURITY_GAP_REPORT) と coverage-dashboard.html を同期 |
| `70f5b94` | A4 残課題: `getStoreOrders` を `requireStoreOwner` に統合、IDOR テストを 3 階層化（1015 → 1016） |
| `b55e177`〜`66fb8d5` | B1+ Sprint 1: Tier 1 前半 10 プリミティブ snapshot 追加（aspect-ratio / separator / progress / switch / checkbox / radio-group / slider / toggle / tooltip / popover、1016 → 1042 / +26） |
| `6545fce` | B1+ infra: `tests-setup/jest.setup.ts` に ResizeObserver スタブ追加（Radix `useSize` 系プリミティブの snapshot テスト基盤） |
| `750d830`〜`45c339b` | B1+ Sprint 2: Tier 1 後半 11 プリミティブ snapshot 追加（alert / alert-dialog / avatar / breadcrumb / collapsible / hover-card / input-otp / pagination / resizable / scroll-area / chart、1042 → 1069 / +27） |
| `e6c79e3`〜`4429b8b` | B1+ Sprint 3: Tier 2 全 8 プリミティブ snapshot 追加（dropdown-menu / context-menu / menubar / sheet / drawer / tabs / toggle-group / table、1069 → 1088 / +19） |
| `222d16e`, `ab07840` | B1+ infra: `tests-setup/jest.setup.ts` に IntersectionObserver / matchMedia / Element.scrollIntoView スタブ追加（embla-carousel-react / cmdk の snapshot テスト基盤） |
| `1b207ba`〜`8e429f2` | **B1+ Sprint 4 完了 / NA-NS-01 archive**: Tier 3 + 補助 全 11 プリミティブ snapshot 追加（form / calendar / carousel / command / sidebar / navigation-menu / sonner / accordion / toast / toaster / data-table、1088 → 1103 / +15）。49/49 shadcn/ui プリミティブカバー達成 |
| `338ab41` | B2 前提: Stripe PaymentIntent と PayPal Order に orderId metadata / custom_id を付与（Webhook 相関のため） |
| `1d69f0f` | **B2 Stripe Webhook 完了**: `/api/webhooks/stripe` ハンドラー新設、payment_intent.succeeded/failed/charge.refunded を冪等処理（15 ケース） |
| `2321cd8` | **B2 PayPal Webhook 完了 / NA-NS-02 archive**: `/api/webhooks/paypal` ハンドラー新設、PAYMENT.CAPTURE.COMPLETED/DENIED/REFUNDED を冪等処理（15 ケース、1103 → 1135 / +32） |
| `a86e012`〜`7ef382f` | コードレビュー指摘対応: `upsertReview` を `db.user.upsert` でアトミック化（レース回避）+ メール欠落エラー経路テスト +1、CustomRatingStars に ARIA/キーボード操作追加、profile データ取得 try/catch、`any`/unsafe cast 除去・共有フィクスチャ化、admin-manual のソフトデリート記述修正。テスト統計を実測へ同期（→ **1193** / 129 スイート、snapshot 127、型エラー 0） |
| `880b225` | chore: ドキュメントの同期、payments-table の競合保護・reviews-container のクリーンアップ追加、featured.ssr / product-watch のテスト安定化 |
| (本セッション) | CI品質ゲート改善: review-details.tsx のアクセシビリティ（button化）対応、product.ts からの未使用 getCookie 削除、およびカバレッジ向上のための5つの新規テストファイル（payments-table, reviews-container, product-list, upload-images, sidebar）作成、review.test.ts への non-Error パステスト追加（総テスト数 1193 → **1220**、スイート数 129 → **134**） |
| `ae18ce3`〜`d88063a` | **管理者ダッシュボード Phase 1 / Task 1-A 完了**: `src/queries/order.ts` に admin 注文 query 5 種（getAllOrders [limit≤100 キャップ] / getOrderForAdmin [userId フィルタ無し] / updateOrderGroupStatusAsAdmin [親子集約 reconcileParentOrderStatus] / updateOrderItemStatusAsAdmin / updateOrderPaymentStatus [Refunded/Cancelled の親→子連動・決済 API 非呼出]）を追加。`AdminOrderType` を types.ts に追加。認可は requireAdmin()、IDOR 3 階層パターンで `order.test.ts` +24（1220 → **1242 passed**） |
| `38a9bbe` | **SonarCloud Quality Gate (PR #133) 修復**: `order.ts` の New Code Coverage 63.4% (< 80%) を解消。`order.test.ts` に admin query 5 関数の catch エラー経路 + reconcile の Delivered/Canceled/Refunded 集約分岐 + 子0件早期 return を +9（1242 → **1251 passed**）。`order.ts` Lines 87.5%→100% / Branch 61.5%→83.3% |
| `2d692cb`〜`0d9fba5` | **SonarCloud Quality Gate (PR #134) 修復**: New Code の Coverage 19.4% (< 80%) と Duplication 7.8% (> 3%) を解消。admin/seller `orders/columns.tsx` の重複（ProductImagesCell / ViewOrderButton）を `src/components/dashboard/shared/order-table-cells.tsx` へ抽出（重複塊を除去）、共有 + admin columns + seller columns のテスト新規 +19、`order-status-select.test.tsx` に admin 分岐・falsy レスポンスの +2（1251 → **1272 passed** / 134 → **137 スイート**）。対象4ファイル Lines 100% |
| `49fa32d` | OI-8 解消: modal-provider.test.tsx 9 件を un-skip（1272 → **1281 passed** / skip 12→3 / suites skip 2→1） |
| `f871919`〜`0f42b91` | **Phase 2 F1 ダッシュボード統計 query**: `src/queries/dashboard.ts` 新規（getAdminDashboardStats / getSalesOverTime / getRecentOrders / getRecentStores）+ `dashboard.test.ts` 21 件（認可 3 階層・境界条件・売上チャート・最近リスト）。TDD Red→Green で実装。1281 → **1302 passed** / +1 suite |
| `2e25f08` | docs: Phase 2 F1 query テスト後の仕様書・カバレッジダッシュボード一括同期（`spec-sync-after-test`） |
| `4ed7fdd` | **Phase 2 F1 UI 完成**: `admin/page.tsx` をプレースホルダーから本体へ置換。`components/dashboard/admin/`（stats-cards / sales-chart / recent-orders / recent-stores）を新規実装。`@tremor/react AreaChart`・shadcn Card。テスト数変動なし（UI は unit テスト対象外）。 |
| `750374b` | **SonarCloud Quality Gate 修復 (PR #136) Phase 1**: `dashboard.test.ts` に catch ブロックテスト +8（getSalesOverTime / getRecentOrders / getRecentStores / getAdminDashboardStats の Error / 非-Error 両分岐）。1302 → **1310 passed** |
| `686e45a`–`ef091c3` | **SonarCloud Quality Gate 修復 (PR #136) Phase 2**: admin dashboard コンポーネント 4 本のテスト新規追加（tests/component/dashboard/admin/）。stats-cards +3 / recent-orders +3 / sales-chart +4 / recent-stores +8。1310 → **1328 passed** / +4 スイート |
| `d5d5284`–`eb996d0` | **Phase 3 F3-第1段 クーポン横断管理 + isActive 列追加**: `Coupon.isActive Boolean @default(true)` 追加 + migrate + ERD 再生成。`applyCoupon`・`placeOrder` に isActive 再検証追加（TDD）。admin クーポン query 4 種（getAllCoupons / upsertCouponAsAdmin / deleteCouponAsAdmin / toggleCouponActive）実装。`AdminCouponFormSchema` 追加。`/dashboard/admin/coupons/` UI（page / columns / form）新規実装。1328 → **1348 passed** / スイート変動なし |
| `a80e4be`–`9d12e90` | **SonarCloud QG 修復（PR #138）**: CouponFormFields 共有コンポーネント抽出（重複解消） / coupon.ts 残ブランチカバー / columns.tsx テスト追加 / admin-coupon-details.tsx コンポーネントテスト 10 件 / storeId 正規化 fix。1348 → **1387 passed** / 141 → **143** スイート |
| `7d3b31d`–`1e1749a` | **Phase 5 F3-第2段 platform-wide クーポン発行（5-A/5-B）**: `Coupon.storeId` を `String?` 化 + `CouponScope`（STORE/PLATFORM）追加（`safe-migration` 経由）+ ERD 再生成。`placeOrder`（端数吸収アルゴリズムで全 OrderGroup へ按分）/ `applyCoupon`（Number→Decimal 化を兼ねる）/ `updateCheckoutProductWithLatest`（null-safe `coupon.store`）の PLATFORM scope 対応。`AdminCouponFormSchema` に scope superRefine（STORE→storeId必須／PLATFORM→storeId禁止）、`upsertCouponAsAdmin` scope対応、admin-coupon-details.tsx に scope ドロップダウン UI。seller `upsertCoupon` に P2002 フォールバック + 日本語メッセージ統一（既存英語アサート破壊的書き換えを同コミットで実施）。1387 → **1398 passed**（143 スイート変動なし） |
| `ae9364f`–`3463d1d` | **Phase 5-C E2E 検証**: `applyCoupon` の Decimal クライアント返却シリアライズ漏れ修正（`updateCheckoutProductWithLatest` の既知パターンと同型バグ、`ae9364f`）→ `tests/e2e/platform-coupon.spec.ts` 新規（2店舗カート + PLATFORM クーポン適用 → 注文確定 → 両 OrderGroup の割引・couponId 反映を検証、`3463d1d`）。Jest 統計は変動なし（E2E のみ +1 スペック、main 5→**6**） |
| `ec4192f`–`a6b5223` | **コードレビュー指摘対応（IDOR / クーポン UI / 認可ガード配置）**: ① `updateCheckoutProductWithLatest` の cross-cart IDOR を修正（`cartProducts[0].cartId` のみ検証 → 全 cartProduct を所有カートの cartItem id 集合で検証し、複数カート混在・他カート item.id 混入を拒否）+ IDOR 回帰テスト +1（`ec4192f`）。② checkout `isDiscounted` に `isCouponCurrentlyValid` を AND 追加し、失効/無効クーポンの割引 UI とサーバー確定額のドリフトを解消（`216c2de`）。③ `upsertCoupon`/`getStoreCoupons`/`deleteCoupon` で `requireStoreOwner` を try/catch 外へ移動（tech.md 準拠、dead な isGuardError 分岐除去、coupon.test.ts の旧ラップ期待 2 件を更新）（`a6b5223`）。1399 → **1400 passed** / 143 → **144** スイート |
| `f6e75fd`–`505e13b` | **`upsertCoupon` cross-store/PLATFORM hijack IDOR 修正**: seller の `upsertCoupon` が `db.coupon.upsert({ where: { id } })` の id 単独キーで対象行の所有権を検証しておらず、他店舗（または admin の PLATFORM）クーポンの id を渡すと update 分岐が `storeId` を自店舗へ書き換えて乗っ取れた。PLATFORM scope 追加（Phase 5）で admin 所有クーポンへ blast radius が拡大。upsert 前に対象行を `findUnique` し `storeId !== store.id`（PLATFORM=null 含む）を `Forbidden` で拒否（認可 throw は DB read の try/catch 外）。IDOR 3 階層 (a)(c) テスト +2（他店舗 / PLATFORM）。SECURITY_GAP_REPORT.md §6 記録。1400 → **1402 passed**（144 スイート変動なし） |
| `da8b9b9`–`3e665be` | **`applyCoupon` TOCTOU レースコンディション修正**: Step 4 の `cart.couponId` チェックと Step 7 の無条件 `db.cart.update` が原子的でなく、並行リクエストが両方チェックを通過して後勝ちで先のクーポンを上書きできた。無条件 `update` を `couponId=null` を条件に含めた条件付き `updateMany`（DB レベル CAS）へ置換し、`count === 0` で `'Coupon is already applied to this cart.'` をスロー、続けて `findFirstOrThrow` で返却形を再構築。両クエリで `userId` スコープ維持。3 階層 (a)(b)(c) 回帰テスト +1 + 既存正常系 7 件を `updateMany`+`findFirstOrThrow` へ移行。SECURITY_GAP_REPORT.md §7 記録。1402 → **1403 passed**（144 スイート変動なし） |
| `04dd88c` | **`applyCoupon` Decimal 演算エラー経路テスト追加**: Step 6（割引計算ブロック）は既存テストで DB エラー経路のみカバーされ、Decimal 演算の例外が try/catch でラップされることが未検証だった。`Prisma.Decimal.prototype` の `.mul()` / `.div()` / `.add()` / `.sub()` を `mockImplementationOnce` で throw させ、`"Error occurred while applying coupon"` ラップを各 1 件で検証。1403 → **1407 passed**（144 スイート変動なし） |
| `dbf7127`–`2dd35b5` | **販売者ダッシュボード Phase 1 + Phase 2-A/2-B（F2 在庫管理 query 層）**: `Store.lowStockThreshold Int @default(5)` 追加（`safe-migration` + ERD 再生成、`dbf7127`）。`src/queries/inventory.ts` 新規（`getStoreInventory` / `updateSizeStock` / `updateStoreLowStockThreshold`）— 認可は `requireStoreOwner`（try/catch 外）、`updateSizeStock` は size→variant→product.storeId の所有権チェーンで IDOR 防止。`UpdateSizeStockSchema` / `LowStockThresholdSchema` 追加。`getStockStatus` / `StockStatus` を `src/lib/utils.ts` へ純粋関数として抽出（F2-5）。`StoreInventoryRow` を `src/lib/types.ts` に `Prisma.PromiseReturnType` で導出。テスト: `inventory.test.ts` 新規 +22（認可/IDOR 3 階層/Zod 弾き/正常系）+ `utils.test.ts` getStockStatus 境界 +6（AC-F2-5）。1407 → **1435 passed** / 144 → **145** スイート。UI（2-C）は未着手 |
| `3e2e175`–`b3ba8c9` | **販売者ダッシュボード Phase 2-C（F2 在庫管理 UI）**: `/dashboard/seller/stores/[storeUrl]/inventory` 新規（`page.tsx` `force-dynamic` + `requireStoreOwner` で `lowStockThreshold` 取得 + `getStoreInventory` + DataTable）。`columns.tsx` は `getInventoryColumns(threshold, storeUrl)` ファクトリ（バッジ/編集セルへ threshold・storeUrl を渡すため）。新規コンポーネント 4 本（`src/components/dashboard/seller/`）: `stock-status-badge`（getStockStatus → Badge 色分け）/ `inventory-quantity-cell`（インライン編集・リエントランシーガード・`updateSizeStock`→toast→refresh）/ `low-stock-threshold-form`（`updateStoreLowStockThreshold`）/ `inventory-alert-summary`（在庫切れ/過小件数集計・RSC）。テスト: `stock-status-badge.test.tsx` +3 + `inventory/columns.test.tsx` +5（orders columns.test.tsx の `renderCell` パターン流用、子コンポーネントスタブ化）。1435 → **1443 passed** / 145 → **147** スイート |
| `c40708a`–`8211773` | **販売者ダッシュボード Phase 2-C 仕上げ（F2 在庫管理 UI テスト完備）**: `updateSizeStock` のアトミック所有権チェック + エラーメッセージ sanitize（`c40708a`）、在庫テーブルを client boundary（`inventory-table-client.tsx`）でラップ（`92d14ab`）、UI 強化 + `inventory-quantity-cell.test.tsx` / `low-stock-threshold-form.test.tsx` 追加（`09b2c2e`）。最後に `inventory-alert-summary.test.tsx` 新規 +3（out/low 集計マッピング・threshold 境界一致・ゼロ件エッジ。`getStockStatus` 境界を行バッジと共有することを検証）で 2-C 全 6 コンポーネントがテスト完備（`8211773`）。1443 → **1451 passed** / 147 → **150** スイート（149 passed + 1 skipped suite） |
| `f2cd8f1` | **販売者ダッシュボード Phase 3-A（F1 店舗ダッシュボード統計 query 層）**: `src/queries/store-dashboard.ts` 新規。admin `dashboard.ts` を店舗スコープ化（`requireStoreOwner` + where に `storeId` 注入）。`getStoreDashboardStats`（5 並列集計・売上は親 `Order.paymentStatus=Paid` のみ・`unstable_cache` 20 分でキャッシュキーに `storeId` 含有し店舗間混線防止 NFR-8・`requireStoreOwner`/`lowStockThreshold` はキャッシュ外クロージャ）/ `getStoreSalesOverTime`（Paid 売上の期間別バケット集計・Decimal は return 境界で number 化）/ `getStoreRecentOrders` / `getStoreTopProducts`。`src/lib/types.ts` に `StoreRecentOrderType` / `StoreTopProductType` を `Prisma.PromiseReturnType` で導出。テスト: `store-dashboard.test.ts` 新規 +39（認可 3 階層 × 4 関数 / 売上 join / `_sum` null→0 / storeId 別スコープ / DB エラー両分岐）。1451 → **1490 passed** / 150 → **151** スイート。UI（3-B）は未着手 |
| `4301c85`–`07bc12e` | **販売者ダッシュボード Phase 3-B（F1 店舗ダッシュボード UI）**: プレースホルダー `[storeUrl]/page.tsx` を店舗 KPI ダッシュボードへ置換。新規 presentational コンポーネント 3 本（`src/components/dashboard/seller/`）: `store-stats-cards`（admin stats-cards 派生・総売上/注文/閲覧/販売/商品/在庫アラートの 6 KPI）/ `store-recent-orders`（OrderGroup 行・`toNumberSafe` で Decimal 整形）/ `store-top-products`（sales 降順）。型は `Awaited<ReturnType<typeof get*>>` で query から導出。`SalesChart`（admin/sales-chart）は `SalesPoint[]` 共用でそのまま import（依存追加なし）。`page.tsx` は `Promise.all([getStoreDashboardStats, getStoreSalesOverTime, getStoreRecentOrders, getStoreTopProducts])` + `force-dynamic`（NFR-4）。テスト: 3 コンポーネント RTL +6（値描画 + ゼロ件 AC-F1-5、`5e48d5e`）。1490 → **1496 passed** / 151 → **154** スイート |
| `8cbf4c0`–`eca47a6` | **販売者ダッシュボード Phase 4（F3 在庫減算 + F3-5 在庫復元）**: `placeOrder`（`src/queries/user.ts`）の OrderItem 作成ループ内に条件付き `tx.size.updateMany`（`quantity:{gte}` + `decrement`）を追加し、`count===0` を在庫不足として throw → `$transaction` 全体ロールバック（読み取り→減算を単一 UPDATE に畳み込み TOCTOU レース回避・F3-1〜F3-3、`037c8ff`）。`order.ts` の `updateOrderGroupStatusAsAdmin` / `updateOrderPaymentStatus` に在庫復元（F3-5）を結線: 更新前ステータスを読み「非終端 → Canceled/Refunded」遷移時のみ `tx.size.update` で `increment` 復元、終端→終端の再実行では復元せず二重復元を防止（共有ヘルパー `restockOrderItems` + 終端判定抽出、`eca47a6`）。テスト: `user.test.ts` +3（ロールバック/減算成功/レース構造）+ `order.test.ts` +6（グループ/注文単位の復元 + 冪等性 + 非キャンセル遷移）。E2E `tests/e2e/stock-decrement.spec.ts` 新規（認証付き購入フローで在庫 before/after 検証・AC-F3-4、`1a66ed2`）。1496 → **1505 passed** / 1499 → 1508 total（154 スイート不変） |
| `83e6e01`–`a20a313` | **profile-messages Phase 1〜3（購入者↔販売者 1:1 メッセージング）**: Phase 1 で `Conversation`/`Message` モデル + User/Store/Order 逆リレーション追加（`safe-migration` + ERD 再生成、非破壊 additive）。Phase 2 で `src/queries/message.ts` 新規（6 server action: `getOrCreateConversation`[冪等 upsert・`@@unique(userId,storeId)`] / `getUserConversations`[`requireUser`] / `getStoreConversations`[`requireStoreOwner`] / `getConversationMessages`・`sendMessage`・`markConversationRead`[private `assertParticipant` で参加者検証・IDOR 防止]）。`SendMessageSchema`/`StartConversationSchema`、`ConversationWithLatest`/`MessageType` 型追加。`message.test.ts` +31（認可 / IDOR 3 階層 / 冪等 / `$transaction`、`fcbcb3d`）。Phase 3 で購入者 UI: `/profile/messages`（`force-dynamic`）+ `messages-container.tsx`（2 ペイン・5 秒ポーリング・`cancelled`+`document.hidden` 停止）+ `conversation-thread.tsx`（バブル左右振り分け + RHF composer・`useRef` リエントランシーガード）+ sidebar 導線。component テスト 2 スイート +14（`e4e752d`〜`a20a313`）。1508 → **1553 passed** / 1511 → 1556 total / 157 → **160** スイート |
| `8ab715e`–`95d0005` | **profile-messages Phase 4（販売者 UI・ループ閉鎖）**: `getStoreConversations` の include に購入者（`user` id/name/picture）を追加し別 include 定数 `storeConversationListInclude` を新設（購入者向け `getUserConversations` は無改修）。`StoreConversationWithLatest` 型を `src/lib/types.ts` に追加（`ConversationWithLatest` の superset・構造的部分型で `ConversationThread` に流用可）。販売者ページ `/dashboard/seller/stores/[storeUrl]/messages`（`force-dynamic` + try/catch フォールバック）+ `seller-messages-container.tsx`（購入者向けと同型 2 ペイン・左ペインは `user.name/picture` で識別・右ペインは `conversation-thread.tsx` 流用・返信は共有 `sendMessage`・5 秒ポーリング）+ seller サイドバー Messages 導線（`MessagesIcon` 新規）。テスト: `seller-messages-container.test.tsx` 新規 +7（購入者名での一覧描画/選択時 fetch+既読化/5 秒ポーリング/`document.hidden` 停止/返信後再フェッチ/poll 失敗ログ）+ `message.test.ts` に include アサーション 1 行（テスト数±0）。1553 → **1560 passed** / 1556 → 1563 total / 160 → **161** スイート |
| `ea89706` | **profile-messages Phase 5（E2E 往復・ループ完成）**: `tests/e2e/messages.spec.ts` 新規（AC-M8）。購入者が `/profile/messages` で送信 → 販売者が `/dashboard/seller/stores/[storeUrl]/messages` で受信・返信 → 購入者ページの 5 秒ポーリングが返信を自動受信する往復を検証。`browser.newContext()` で buyer/seller を別コンテキストに分離し同時セッションを維持してポーリング受信を `toBeVisible` で確認。Clerk テストモードで USER/SELLER を動的生成、ACTIVE 店舗 + 会話を `beforeAll` で Prisma 直挿入（起点 UI 未実装のため）、`CLERK_SECRET_KEY` 未設定時 `test.skip`。Chromium で往復通過確認・3 ブラウザ対象。Playwright E2E（main）7 → **8 スペック**。Jest 集計は不変（**1560 passed** / 161 スイート据え置き） |
| `456fadf`〜`cdc81d5` | **SonarCloud Quality Gate 修復（PR #145）**: New Code の Duplicated Lines 9.7%（> 3.0% で QG Failed）を解消。震源は購入者 `messages-container.tsx` と販売者 `seller-messages-container.tsx` の ~214 行相互コピー。共通フック `src/components/shared/messages/use-conversation-thread.ts`（ポーリング/既読化/送信後再フェッチ/`selectedIdRef` レースガード・ログ出所は引数化で既存文言維持）+ 汎用 `messages-layout.tsx`（2 ペイン骨格・アバター取得元を `getAvatar` アダプタで注入し購入者=店舗/販売者=購入者を切替）へ抽出し、両コンテナを薄いラッパ化（props は S6759 で `Readonly` 化、挙動不変・既存テスト緑、`456fadf`）。カバレッジ補完: `message.ts` の全 catch を Error/unknown 両系統 + 未テスト DB エラー経路 + order null 経路でカバー（Branches 74.5%→**100%**、`2d5ab8a`）、共有フック/レイアウトを購入者/販売者コンテナ経由で全分岐カバー（poll/markRead/handleSent catch 両系統・レースガード false・inFlight・unmount cancelled・同一選択 no-op・アバター描画、両コンテナ+shared/messages **100%**、`082bf0a`）、`user-menu.tsx` の認証済み/未認証/`fullName` フォールバック/catch Error・unknown をカバー（37.5%→**100%**、`cdc81d5`）。1560 → **1591 passed** / 1563 → 1594 total（161 スイート不変） |
| `23f7332`〜`bdf3356` | **Compare 機能（商品比較）実装** — `docs/design/compare/` の MVP + tasks.md 2-B。Red→Green TDD でストア → グリッド → 商品カードボタンを実装。`useCompareStore`（`src/compare-store/`・zustand+persist・`useCartStore` と同型・バリアント ID のみ保持・上限 4 件・冪等・`isComparing`）。`/compare`（`src/app/(store)/compare/page.tsx`・client wrapper・`force-dynamic` 不要）+ `CompareGrid`（`src/components/store/compare/`・既存 `getProductsByIds` 再利用・`useEffect` キャンセルフラグで古いレスポンス上書き防止・`items.length===0` で `getProductsByIds` を**呼ばず**空状態 = 空配列 throw 回避）。商品カード（`product-card.tsx`）へ Add-to-compare トグルボタン（GitCompare・トグル＋トースト・上限 4 超過は `toast.error`・ストアは void のままハンドラ側で分岐）。新規 server action・schema 変更なし。`useCompareStore.test.ts` +8（T-CMP1〜4 + isComparing）+ `compare-grid.test.tsx` +2（T-CMP5/T-CMP6・`getProductsByIds` mock）= **+10**。1591 → **1601 passed** / 1594 → 1604 total / 161 → **163** スイート |
| `e8fe553`〜`22bb3f3` | **SonarCloud Quality Gate 修復（PR #147 compare 機能）** — New Code Coverage 63.6% (< 80%) を解消。`product-card.tsx` はテストファイルが無く新規 compare ロジック（+42 行）が 0% だった。`product-card.test.tsx` 新規 +8（`handleToggleCompare` 3 分岐 [未比較→追加 / 比較済→削除 / 上限 4 で `toast.error`]・`handleAddToWishlist` 成功 / 失敗 catch・`rating>0 && sales>0` 条件、`e8fe553`）。既存 `compare-grid.test.tsx` を +4（loading スケルトン描画 / 個別 remove / clear all / `getProductsByIds` reject の catch 経路、`e39a38e`）。両ファイル Lines 100%。あわせて `product-card.tsx` wishlist catch の `error: any` を `unknown` + `instanceof Error` 型ガードへ修正（no-any 規約準拠、`22bb3f3`）。1601 → **1613 passed** / 1604 → 1616 total / 163 → **164** スイート |

---

## 次回着手用 依頼プロンプト

> **使い方**: 新しいセッションを開いて以下の **コードブロック内の文字列をそのままコピペ** すれば、文脈再構築なしに該当タスクへ着手できます。
> プロンプトは `coverage-dashboard.html §03 Next Actions` (= `scripts/coverage-dashboard/render-html.ts` の `NEXT_ACTIONS`) と一対一で対応しています。
> **更新規約**: タスクを完了したら、対応するプロンプトをこのセクションから削除し、`render-html.ts` の `NEXT_ACTIONS` からも同時に削除する（SSOT 二重管理を防ぐ）。新規タスクを追加する場合は両方に同時追加する。

### 🔴 Immediate (high)

（現在 high 優先度の Next Action はありません。A4 残課題 `getStoreOrders` 統合は `70f5b94` でクローズ済み）

### 🟡 Next Sprint (medium)

<!-- NA-NS-01 (B1+ shadcn/ui Snapshot 拡張) ✅ 完了 2026-05-28: 49/49 プリミティブ / 127 snapshot。詳細: B1_SNAPSHOT_EXPANSION_PLAN.md / COVERAGE_REPORT.md §7 -->
<!-- NA-NS-02 (B2: Stripe/PayPal Webhook Contract テスト) ✅ 完了 2026-05-28: 30+2 ケース。コミット 338ab41 / 1d69f0f / 2321cd8 -->
<!-- NA-NS-03 (B3: Cart → Checkout Integration テスト) ✅ 完了 2026-05-29: 4 シナリオ / 11 テスト。ADR-004 参照 -->
<!-- D1 (categorize.ts 改修 / Integration 行実体化) ✅ 完了 2026-06-02: commit b57841a。詳細: COVERAGE_REPORT.md §3 D1 -->

#### D2: Performance 行の着手（OI-9 修正 → lhci に `/` 追加）

```text
ヒートマップ Performance 0% 行を前進させるため、OI-9 を修正して Lighthouse CI の計測対象に / を追加してください。

背景:
- C1（Lighthouse CI）は 2026-05-30 に完了済みだが、ホーム / は OI-9（featured.tsx の SSR window
  参照バグで 500）のため計測対象から除外され、暫定的に /browse のみを計測している。
- OI-9 を解消すれば / を lhci に追加でき、売上導線トップの LCP/CLS/TBT を予算化できる。

実装方針:
1. src/components/store/home/main/featured.tsx の useState<number>(window.innerWidth) を
   遅延初期化 useState(() => typeof window !== "undefined" ? window.innerWidth : 0) に変更し、
   useEffect で resize 実測値を反映（SSR で window 未定義でも throw しない）。
2. ローカルで / が SSR 200 を返すことを確認（OI-9 クローズ）。
3. .lighthouserc.json / .github/workflows/lhci.yml の collect URL に / を追加。
4. 数回ベースライン観測後、.lighthouserc.json の assertion を warn → error 化して予算を厳格化（別 PR 可）。

完了条件:
1. / が SSR 200、OI-9 を QA_HANDOFF.md 残課題からクローズ（取り消し線）。
2. lhci が / を計測（CI グリーン）、bunx tsc --noEmit / bun run lint グリーン。
3. render-html.ts の NEXT_ACTIONS から D2 を削除し、本プロンプトも削除（二重 SSOT 同期）。
4. COVERAGE_REPORT.md §2/§3 を更新（Performance 行の状態変化を反映）。

参考:
- OI-9 詳細: docs/testing/QA_HANDOFF.md「現在アクティブな残課題」OI-9 行
- 先行例: .github/workflows/lhci.yml + .lighthouserc.json（C1）
- コミット規約: .claude/rules/02-tdd-step-commit.md
```

#### OI-11: seller ルートの本番 SSR クラッシュ修正

```text
/dashboard/seller 系ルートが本番 SSR で ReferenceError: self is not defined を投げる問題
（OI-11）を修正してください。next-cloudinary の CldUploadWidget がサーバ評価される client-only
コンポーネントであることが原因です（OI-9 と同族）。

実装方針:
1. image-upload.tsx の CldUploadWidget を next/dynamic の { ssr: false } で遅延 import する。
2. 本番ビルド（next build → next start）で /dashboard/seller 系が SSR 200 を返すことを確認。

完了条件:
1. seller ルートが本番 SSR で 200、OI-11 を QA_HANDOFF.md 残課題からクローズ（取り消し線）。
2. bunx tsc --noEmit / bun run lint グリーン。
3. render-html.ts の NEXT_ACTIONS から OI-11 を削除し、本プロンプトも削除（二重 SSOT 同期）。

参考:
- OI-11 詳細: docs/testing/QA_HANDOFF.md「現在アクティブな残課題」OI-11 行
- 同族先行例: OI-9（featured.tsx の SSR window 参照）
```

### 🟢 Mid–Long Term (low)

SaaS ロードマップ範囲 (docs/architecture/saas-roadmap.md) で別ストリーム扱い。

#### OI-10: a11y color-contrast 負債の是正

```text
/checkout・/profile・/seller/apply のグレー/ブルー系テキストが WCAG 2.1 AA の 4.5:1 を
満たさない a11y 負債（OI-10）を是正してください。現在 E2E では runA11yScan の
disabledRules:["color-contrast"] で追跡のため意図的に抑制中です。

実装方針:
1. 対象ページのテキスト色を 4.5:1 以上を満たす配色へ是正する。
2. runA11yScan の disabledRules から "color-contrast" を解除する。

完了条件:
1. axe color-contrast 違反ゼロ、OI-10 を QA_HANDOFF.md 残課題からクローズ（取り消し線）。
2. E2E a11y spec グリーン（disabledRules 解除後）。
3. render-html.ts の NEXT_ACTIONS から OI-10 を削除し、本プロンプトも削除（二重 SSOT 同期）。

参考:
- OI-10 詳細: docs/testing/QA_HANDOFF.md「現在アクティブな残課題」OI-10 行
```

<!--
C1 (Lighthouse CI でパフォーマンス予算化) は 2026-05-30 に完了済み。
- 結果: .github/workflows/lhci.yml + .lighthouserc.json を新設、@lhci/cli で /browse の
  LCP/CLS/TBT を計測 (warn-only ベースライン)。
- Clerk 回避: pk_test ダミーは dev handshake (偽 FAPI) で collect 400。本番形式の
  pk_live ダミー (+ sk_live ダミー) で handshake を回避 (ローカルで /browse → 200 実証)。
- ホーム / は OI-9 (featured.tsx の SSR window バグ) で 500 のため URL から除外。修正後に追加。
- scripts/coverage-dashboard/render-html.ts の NEXT_ACTIONS からも削除済み。
- フォローアップ: 数回のベースライン観測後に .lighthouserc.json を warn → error 化して予算を厳格化。
-->

#### C2: Bundle Size の継続監視 (`.github/workflows/bundle.yml`)

```text
依存追加による初期 JS バンドルの肥大化を PR で検知するため、Bundle Size 継続監視を導入してください。

背景:
- C1 (Lighthouse CI) は 2026-05-30 に完了済み (.github/workflows/lhci.yml + .lighthouserc.json)。
  C2 は同じ "パフォーマンス退行を PR で検知する" ストリームの 2 件目 (COVERAGE_REPORT.md §3)。
- 目的: @next/bundle-analyzer + size-limit で初期ロード JS の閾値超過を CI で警告する。
- コスト感: S (lhci 比で軽量。サーバー起動・DB seed 不要)。

実装方針:
1. devDependencies に size-limit + @size-limit/file (または @size-limit/preset-app) を追加。
2. .size-limit.json を新設し、.next/static/chunks の主要バンドル (app shell / framework) に
   閾値 (例: gzip 後 KB) を設定。初期は warn 相当の緩い閾値でベースライン観測。
3. .github/workflows/bundle.yml を新設:
   - on: pull_request [main, dev] + workflow_dispatch
   - permissions: contents: read / concurrency: bundle-${{ github.ref }}
   - third-party action は SHA ピン + バージョンコメント (01-engineering-standards.md)。
     postgres service は不要 (bundle はビルド成果物のサイズのみ計測)。
   - steps: checkout → setup-bun (1.3.14) → bun install --frozen-lockfile →
     bunx prisma generate → bun run build → bunx size-limit
   - env: ci.yml と同じ stub 群 (DATABASE_URL は build 時の force-dynamic 回避用 stub で可)。
4. ビルドが DB に到達しないことを確認 (force-dynamic ページは build 時クエリを実行しないが、
   念のため lhci と同様 stub DATABASE_URL を渡す)。

完了条件:
1. .github/workflows/bundle.yml + .size-limit.json + package.json/lockfile をコミット。
2. bunx tsc --noEmit エラーゼロ、bun run lint グリーン。
3. scripts/coverage-dashboard/render-html.ts の NEXT_ACTIONS から C2 を削除。
4. 本セクション (QA_HANDOFF.md C2 プロンプト) を削除し、COVERAGE_REPORT.md §3 に
   C2 完了アーカイブ行を追加 (完了日 + commit hash)。
5. docs/coverage-dashboard.html を bun run coverage:dashboard で再生成。
6. docs/PROGRESS.md の「次アクション」を更新 (C シリーズ完了)。

参考:
- 先行例: .github/workflows/lhci.yml (C1。トリガー/ピン/concurrency/env のパターン)
- コミット規約: .claude/rules/02-tdd-step-commit.md (実装とドキュメント同期は別コミット)
- ドキュメント配置: .claude/steering/documentation-guide.md
```

---

*Stay Red, Go Green, and Refactor rigorously.*
