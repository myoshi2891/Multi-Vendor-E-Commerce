# Coverage Report — Field Survey

> **生成日**: 2026-05-21（**最終更新**: 2026-06-19）/ **対応する成果物**: [`docs/coverage-dashboard.html`](./coverage-dashboard.html) ([生成元](../../scripts/coverage-dashboard/))
> **再生成コマンド**: `bun run coverage:dashboard`

このレポートは、テストカバレッジダッシュボード初回生成 (2026-05-21) 時点での **現状サマリ・優先アクション・実装記録** を一覧化したものです。ダッシュボード HTML は視覚的な探索用、本ファイルは **読み返し・PR レビュー・スプリントプランニング用** の整理ドキュメントとして使い分けてください。

---

## 1. Executive Summary

| 指標 | 値 |
|---|---|
| テストファイル総数 | **183 ファイル**（Jest unit/component 172 / Jest integration 2 / Playwright E2E メイン 9）— この小計は Jest + E2E メインのスコープであり、**Visual 2 + a11y 4 は別計上**（ダッシュボード `coverage-dashboard.html` が SSOT・全カテゴリ合算）。ファイル追加履歴: 2026-06-26 track-order 機能で `tests/component/store/track-order-form.test.tsx` 新規（`trackOrder` ユニットは既存 `order.test.ts` に追加）。2026-06-22 PR #149 SonarCloud 修復で `src/components/store/static/content/content.test.ts` 新規。2026-06-22 support-forms 機能で `src/queries/support.test.ts` + `src/components/store/support/support-form.test.tsx` 新規。2026-06-22 storefront-static-pages 機能で `static-page-layout.test.tsx` + `about/page.test.tsx` + `customer-service/page.test.tsx` 新規。2026-06-22 offers 機能で `src/app/(store)/offers/page.test.tsx` 新規。2026-06-22 PR #147 で `product-card.test.tsx` 新規。2026-06-21 Compare 機能で `useCompareStore.test.ts` + `compare-grid.test.tsx` 新規。2026-06-20 で `seller-messages-container.test.tsx`、2026-06-19 で `message.test.ts` + `{conversation-thread,messages-container}.test.tsx`、profile-settings Phase 1 で `{user-menu,profile-sidebar,settings-page}.test.tsx`、Phase 4(F3) で E2E `stock-decrement.spec.ts` を追加 |
| Jest スイート総数 | **172 スイート**（171 passed + 1 skipped）— スイート数の遷移: 161 → 163（2026-06-21 Compare 2 ファイル）→ 164（2026-06-22 PR #147 product-card 1 ファイル）→ 165（2026-06-22 offers `offers/page.test.tsx` 1 ファイル）→ 168（2026-06-22 storefront-static-pages 3 ファイル）→ 170（2026-06-22 support-forms 2 ファイル）→ 171（2026-06-22 PR #149 `content/content.test.ts` 1 ファイル）→ 172（2026-06-26 track-order `track-order-form.test.tsx` 1 ファイル）。 |
| テスト総数 | **1659 unit/component passed** (3 skipped) + **17 integration** — 2026-06-26 時点（track-order 機能: 既存 `order.test.ts` に +6 [T-TO1〜T-TO6・IDOR 3 階層] + 新規 `track-order-form.test.tsx` +2 [T-TO7/T-TO8] = +8、1651→1659、171→172 スイート。直前 PR #149 SonarCloud 修復: +12、1638→1650、170→171 スイート）。残 3 skip は DB ゲートの idempotency suite |
| Jest スナップショット | **127** — 2026-05-28 時点（**B1+ 全完了** で 112 → 127 / 累計 49 プリミティブカバー） |
| マトリクスセル数 | **80** (8 カテゴリ × 10 ドメイン) |
| カバー済みセル | **18 / 80 (23%)** — 2026-06-06 ダッシュボード再生成時点（`coverage-dashboard.html` の自動マトリクスと一致。旧 `17/80 (21%)` はダッシュボードに対して未同期だったため是正） |
| lcov エントリ数 | **50** (2026-06-06 ローカル再生成時点。`coverage/lcov.info` は `.gitignore` 対象で git 管理外。再生成は `bun run test -- --coverage`) |
| 未採用カテゴリ | Visual / Snapshot, a11y, Performance |
| 型エラー | **0 件** (2026-05-21 解消済み) |

**所感**: ユニット & インテグレーションは中核ドメイン（queries, store-ui）で堅実に整備されているが、**横展開（カテゴリ軸）が未着手**。特に売上直結フローの Visual / a11y は盲点で、リリース毎のリスクが暗黙のまま残っている。

---

## 2. Current State Heatmap (テキスト版)

`✦` = full (テスト存在 & skip なし & lcov ≥ 60%) / `◐` = partial (.skip 含む or lcov < 60%) / `◯` = missing

| カテゴリ ╲ ドメイン       | queries | api | pages | store | dashbd | shared | hooks | lib | seed | other |
|---|---|---|---|---|---|---|---|---|---|---|
| **Unit**           |   ✦    |  ◯  |  ✦   |  ✦   |   ✦   |   ✦   |   ✦   |  ✦  |  ◐   |   ◐   |
| **Integration**    |   ◐    |  ◯  |  ◯   |  ◐   |   ◐   |   ◐   |   ◯   |  ◯  |  ◯   |   ◯   |
| **E2E**            |   ◯    |  ◯  |  ◐   |  ◯   |   ◯   |   ◯   |   ◯   |  ◯  |  ◯   |   ◯   |
| **Visual/Snapshot**|   ◯    |  ◯  |  ◐   |  ◯   |   ◯   |   ◯   |   ◯   |  ◯  |  ◯   |   ◯   |
| **a11y**           |   ◯    |  ◯  |  ◐   |  ◯   |   ◯   |   ◯   |   ◯   |  ◯  |  ◯   |   ◯   |
| **Performance**    |   ◯    |  ◯  |  ◯   |  ◯   |   ◯   |   ◯   |   ◯   |  ◯  |  ◯   |   ◯   |
| **API/Contract**   |   ◯    |  ✦  |  ◯   |  ◯   |   ◯   |   ◯   |   ◯   |  ◯  |  ◯   |   ◯   |
| **Security**       |   ◯    |  ◯  |  ◯   |  ◯   |   ◯   |   ◯   |   ◯   |  ✦  |  ◯   |   ◯   |

> **Unit 行の注記（2026-05-31 更新）**: `pages / store / dashbd / shared` を co-located unit テストで✦化（[QA_HANDOFF.md「2026-05-31」](./QA_HANDOFF.md) 参照）。残る非✦セルは構造的・スコープ外の理由による:
> - **`api` ◯（構造的 N/A）**: `src/app/api/*` のテストは [`categorize.ts`](../../scripts/coverage-dashboard/categorize.ts) で必ず `api-contract` カテゴリへ分類されるため、Unit×api セルを埋める手段が存在しない。api の実カバーは **API/Contract 行 ✦**（`route.test.ts` × 6）が担保する。Issue #4 の意図的設計（カテゴリ上書き）を崩さないため categorize.ts は変更しない。
> - **`seed` ◐（意図的に分母外）**: `collectCoverageFrom` をロジック中心の `src/**` に限定したため `prisma/seed` は計測されない。「seed 以外を✦化」という本タスクのスコープ通り。
> - **`hooks` ✦（2026-06-14 昇格）**: OI-8 解消で `modal-provider.test.tsx` の file-level skip を解除（`hasSkip` 消失）。`modal-provider.tsx` は lcov 32/33 = 97% で ✦ 条件（skip なし & lcov ≥ 60%）を満たす。
> - **`other` ◐**: `scripts/coverage-dashboard/scan-tests.test.ts` がスキップ検出ロジックのテストデータとして `.skip` 文字列を含み、スキャナが自己参照的に `hasSkip` 誤検知する（Issue #7 と同種のドッグフードノイズ）。
>
> **Integration 行 `queries` ◐ の注記（2026-06-02 D1 完了）**: `tests/integration/`（`cart-checkout` / `order-placement`）は D1 で [`categorize.ts`](../../scripts/coverage-dashboard/categorize.ts) により `integration × queries` へ分類されるようになり、`unit × other` への誤検知が解消した。ただし統合テストファイルには同名ソースが無く lcov 解決が `null` のため、生成ダッシュボード上では ✦ ではなく **◐（partial）** で表示される（commit `b57841a`）。

### カテゴリ別カバー率

| カテゴリ | カバー済み列 | カバー率 | 備考 |
|---|---|---|---|
| Unit | 7/10 | 70% | queries / pages / store / dashbd / shared / hooks / lib が✦（hooks は 2026-06-14 OI-8 解消で◐→✦）。seed / other は ◐、api は構造的 ◯（上記注記参照） |
| Integration | 4/10 | 40% | tests/component/（store / dashbd / shared）+ tests/integration/（queries ◐、D1 で追加） |
| E2E | 1/10 | 10% | tests/e2e/ 配下 (5 spec) |
| API / Contract | 1/10 | 10% | route.test.ts のみ |
| Security | 2/10 | **20%** | A1 完了: queries（IDOR認可テスト）+ lib（middleware/sanitize） |
| Visual / Snapshot | 1/10 | **10%** | A2 完了: pages（cart/checkout spec — baseline 未コミット） |
| Accessibility | 1/10 | **10%** | A3 完了: pages（sign-in / seller-apply、WCAG 2.1 AA スキャン） |
| Performance | 0/10 | **0%** | 全列未対応 |

### ドメイン別 (列) のホットスポット

| ドメイン | 既存テスト数 | 状態 |
|---|---|---|
| `src/queries/` (Server Actions) | 14 | Unit のみ。Security 横展開が必要 |
| `src/components/store/` (Store UI) | 10 | Integration のみ。Visual / a11y 未対応 |
| `tests/e2e/` (Pages) | 5 | E2E のみ。Visual / a11y 未対応 |
| `src/app/api/` (API Routes) | 4 | API/Contract のみ。Stripe/PayPal Webhook の契約検証が薄い |
| `src/lib/`, `src/utils/`, `src/middleware.ts` | 5 | Unit + Security |
| `prisma/seed/` | 10 | シード自己整合性テストで充実 |
| `src/components/dashboard/` | 5 | Integration のみ |
| `src/components/shared/`, `ui/` | 2 | Integration のみ。Snapshot が有効そう |
| `src/hooks/`, `cart-store/`, `providers/` | 5 | Unit のみ |

---

## 3. Next Actions (カバレッジ観点の戦略台帳)

> **運用ルール**: このセクションは「なぜやるか・何を達成するか」の**戦略理由**を記録する台帳。
> 「次のセッションで何をするか」の即時 TODO は **[QA_HANDOFF.md](./QA_HANDOFF.md) の `残課題・Open Issues` を Single Source of Truth** とする。

---

### ✅ 完了済みアーカイブ（🔴 高優先度）

#### A1. Server Actions に CSRF / 認可テストを横展開 ✅ 2026-05-21 完了
- **対象**: `src/queries/**.test.ts` (Security 行)
- **達成内容**: 14 ファイル全調査、IDOR 脆弱性 2 件修正（paypal/stripe）、認可テスト補完
- **記録**: [`SECURITY_GAP_REPORT.md`](./SECURITY_GAP_REPORT.md) / commits `55c07b1`, `03a7e89`

#### A2. Checkout / Cart の Visual Regression を導入 ✅ 2026-05-21 完了
- **対象**: `tests/e2e/visual/`
- **達成内容**: cart/checkout の spec ファイル追加、playwright.config.ts に安定化設定を追加、および baseline スクリーンショットの生成・コミット
- **期待効果**: 売上直結フロー (cart, checkout) の UI 崩れをマージ前に阻止

#### A3. フォーム a11y を WCAG 2.1 AA で計測 ✅ 2026-05-21 完了
- **対象**: `tests/e2e/a11y/`
- **達成内容**: sign-in / seller-apply および /checkout / /profile の WCAG 2.1 AA スキャン追加（`@axe-core/playwright`）
- **期待効果**: 認証・申請フォームの障壁を計測 → 改善 → 退行防止のループ確立

#### B1. shadcn/ui プリミティブの Snapshot ✅ MVP 完了 2026-05-23
- **対象**: `tests/component/ui/*.test.tsx` — 9 プリミティブ（button / dialog / select / badge / card / input / label / textarea / skeleton）
- **達成内容**: 40 snapshot を `tests/component/ui/__snapshots__/` に生成・コミット。Tailwind / Radix のスタイル退行を CI で機械検知できるようになった。Portal を伴う `Dialog` / `Select` は `document.body` 経由でスナップショット化
- **運用ルール**: 詳細は [`TESTING_DESIGN.md` § shadcn/ui Snapshot テスト](./TESTING_DESIGN.md) を参照
- **残課題（B1+）**: `src/components/ui/` 配下の残り 40 プリミティブを後続 PR で段階追加

---

### 🟡 未着手（中優先度）— Next Sprint

#### ~~B2. Stripe / PayPal Webhook の Contract テスト~~ ✅ 完了 2026-05-28
- **達成内容**: `/api/webhooks/stripe` と `/api/webhooks/paypal` を新設し、固定ペイロードフィクスチャを `tests/fixtures/webhooks/` に配置。Stripe (payment_intent.succeeded / payment_intent.payment_failed / charge.refunded) と PayPal (PAYMENT.CAPTURE.COMPLETED / DENIED / REFUNDED) の主要イベントを冪等処理する Contract テスト 30 ケース + metadata 検証 2 ケースを追加（commits `338ab41` / `1d69f0f` / `2321cd8`）。署名検証・未知イベント no-op・Order 不在 404・DB エラー 500 の境界系を網羅
- **残課題**: Stripe Dashboard / PayPal Developer Portal での Webhook URL 登録は運用配線・別タスク。`PAYMENT.CAPTURE.REFUNDED` の partial 判定は元 capture lookup が必要なため当面 `Refunded` 一律マップ

#### ~~B3. Cart → Checkout の Integration テスト~~ ✅ 完了 2026-05-29
- **達成内容**: `tests/integration/cart-checkout.test.ts` を新設し、4 シナリオ計 11 テストを実装。Scenario 1 (Zustand persist hydration / 2 テスト) + Scenario 2 (shipping fee 一貫性 ITEM/WEIGHT/FIXED / 3 テスト) + Scenario 3 (`applyCoupon` server action: 正常 + 4 異常パス / 5 テスト) + Scenario 4 (未認証 `/checkout` → `/cart` redirect / 1 テスト)。基盤として testcontainers-managed PostgreSQL + 専用 jest config (`jest.integration.config.js`) + setup ヘルパー (`tests/integration/setup/{container,teardown,db,reset-db,seed,file-mock,style-mock}.{ts,js}`) を整備し、ADR-004 で技術選定の根拠 (testcontainers vs docker-compose vs services.postgres vs Neon vs SQLite) を記録
- **CI**: `.github/workflows/ci.yml` に `integration-tests` ジョブを追加。testcontainers が runner の Docker daemon を直接利用するため `services:` ブロック不要
- **コスト**: ~3.3 秒 / 11 テスト (testcontainers 起動含む)。`maxWorkers: 1` 直列実行

#### ~~B3.1. placeOrder（注文確定）の Integration テスト~~ ✅ 完了 2026-05-31
- **達成内容**: B3 基盤を踏襲し、最もトランザクション依存の高い `placeOrder`（`src/queries/user.ts`）を実 DB で初カバー。`tests/integration/order-placement.test.ts` に 6 シナリオ（単一店舗 FK・Decimal 集計 / 複数店舗 OrderGroup 分割 / 在庫キャップ `Math.min` / クーポン店舗限定割引 / 所有権ガード IDOR・副作用なし / 不正 variant·size 組み合わせの拒否）。基盤として `seed.ts` に ProductVariantImage 作成（`placeOrder` が `variant.images[0].url` を参照）と `seedShippingAddress` を追加。本体コードは無変更。Integration 11 → 17 / スイート 1 → 2 (commits `78a20c9` / `ae28157`)
- **categorize ドリフト（D1 で恒久解消済み 2026-06-02, commit `b57841a`）**: 当初 `scripts/coverage-dashboard/categorize.ts` は Integration カテゴリを `tests/component/` のみにマップしたため、`tests/integration/` 配下（cart-checkout / order-placement）はダッシュボード上 **unit × other セル**に誤分類されていた。D1（下記）で `tests/integration/` → `integration × queries` の分類規則を追加し解消（Issue #4 の api→api-contract 上書き設計は維持）
- **モック unit との差分**: 既存 `user.test.ts` は `$transaction` をモックしコールバックを直接実行するため、原子性・実 FK 制約・Postgres の Decimal 精度・実在庫キャップを構造的に検証できない。本テストはこれらを実 DB で担保する

#### ~~D1. ダッシュボード Integration 行の実体化（categorize 改修）~~ ✅ 完了 2026-06-02
- **対象**: `scripts/coverage-dashboard/categorize.ts` + `categorize.test.ts`
- **背景**: 上記 B3.1 で記録した「categorize ドリフト」の恒久対応。`tests/integration/` が `unit × other` セルに誤分類され、ヒートマップ Integration 行が実体（実 DB での placeOrder / cart-checkout 検証）を反映しなかった
- **達成内容**: `DOMAIN_RULES` に `tests/integration/` → `queries`（SUT は `src/queries/` の `placeOrder` / `applyCoupon`）、`detectCategory` に `tests/integration/` → `integration` を追加。`categorize.test.ts` に domain / category 両ケースを追加（32 ケース・green）。Issue #4 の api→api-contract 上書き設計は維持
- **マトリクスへの反映**（lcov あり再生成）: `integration × queries` ◯→**◐**（同名ソース無しで lcov `null` のため partial）、`unit × other` から統合 2 ファイルが離脱（partial 維持）。`byCategory.unit` 50→48 / `integration` 66→68、`byDomain.queries` 14→16 / `other` 7→5、`coveredCells` 17→18（21%→23%）。Integration 行カバー率 3/10 30% → 4/10 40%
- **記録**: commit `b57841a`（categorize 改修）/ ドキュメント・ダッシュボード再生成は本コミット

#### D2. Performance 行の着手（OI-9 修正 → lhci に `/` 追加）🆕 2026-06-02 起票
- **対象**: `src/components/store/home/main/featured.tsx + .lighthouserc.json`
  > [!NOTE]
  > `scripts/coverage-dashboard/render-html.ts:NEXT_ACTIONS` is the authoritative SSOT to prevent future drift.
- **背景**: 下記 C1 残課題「ホーム `/` は OI-9（featured.tsx の SSR window バグ）で計測対象外」の解消。`/` を予算化し売上導線トップの退行を検知
- **コスト感**: **M**
- **期待効果**: Performance 0% 行を前進。OI-9 クローズで本番 SSR の 500 リスクも同時に解消
- **即時 TODO**: [`QA_HANDOFF.md`「次回着手用 依頼プロンプト」D2](./QA_HANDOFF.md)

#### R4. improve Round 4 テストギャップ解消（plans 026〜030）🆕 2026-07-10 起票

- **対象**: `src/queries/paypal.ts` / `country.ts` / `profile.ts`（unit）、`tests/integration/order-placement.test.ts`（integration）、money-path クライアント 6 ファイル（component）
- **なぜやるか**: 2026-07-10 の lcov 実測監査（全体 Branches **44.89%**）で、カバレッジの低さが**危険な場所に集中**していることが判明したため。(1) `paypal.ts` は決済モジュールかつエラーハンドリング規約の exemplar なのに Branches 28.6% — エラー縮退が回帰無検出。(2) `placeOrder` のオーバーセルロールバック（TOCTOU ガード）と PLATFORM クーポン端数吸収は在庫・金額整合の最重要保証なのに実 DB 未検証（Round 1 TESTS-05/08 の昇格）。(3) `country.ts` は「全 server action テスト済み」不変条件の唯一の違反（0%）。(4) checkout KPI 直結のクライアント 6 ファイル（stripe/paypal 決済・checkout/cart コンテナ・newsletter）が 0%
- **何を達成するか**: paypal Branches 90%+ / profile 95%+ / country 100% / 統合 +3 シナリオ / component スイート +6。実行手順・ケース表・STOP 条件は **`plans/026〜030`** が SSOT（zero-context executor 向け自己完結）。監査台帳: [`plans/audit/findings-12-test-coverage.md`](../../plans/audit/findings-12-test-coverage.md)
- **コスト感**: S〜M × 5 プラン（相互独立・並行可。027 のみ Docker 必須）
- **やらないと判定したもの**（再監査防止）: coupon-utils / serialize-cart の直接テスト（間接カバレッジ 100%）、chart.tsx 分岐網羅、dashboard forms 群、product-details.tsx（TECHDEBT-02 従属）— 詳細は findings-12 の rejected 節
- **即時 TODO**: [`QA_HANDOFF.md`「次回着手用 依頼プロンプト」R4](./QA_HANDOFF.md)、進捗 SSOT は [`plans/README.md`](../../plans/README.md) status 列

#### R5. improve Round 5 Integration テストギャップ解消（plans 031〜035）🆕 2026-07-11 起票

- **対象**: `tests/integration/`（testcontainers 実 PostgreSQL）への 4 スイート新設 + seed ヘルパー拡張。検証対象コード: `src/queries/order.ts`（キャンセル/返金の子連動 + restock）、`src/app/api/webhooks/{stripe,paypal}/route.ts`（冪等 upsert）、`src/app/api/search-products/route.ts` + `src/queries/subCategory.ts`（raw SQL）、`src/queries/review.ts`（評価集計）、`src/queries/store.ts`（ロール昇格遷移）
- **なぜやるか**: 2026-07-11 の Integration 特化監査（初の実測: **17/17 pass / 4.779s**）で、既存 17 テストが「注文確定まで」に集中し、**注文後のライフサイクルと raw SQL / unique 制約 / 条件付き updateMany という実 DB でしか検証できないセマンティクス**が全て未カバーと判明したため。(1) 在庫復元の二重実行は placeOrder のオーバーセル（plan 027）と対になる在庫・金銭クリティカル障害。(2) webhook はプロバイダーが再送を前提とする経路なのに冪等性の本体（orderId unique + upsert）が全モックで未実行。(3) tsvector 検索 SQL は Elasticsearch 移行の中核なのに一度も実行されない。(4)(5) レビュー集計・ロール昇格は表示信頼と権限境界の遷移条件
- **何を達成するか**: Integration 17 → **約 45〜50 テスト / 2 → 6 スイート**（各プランのシナリオ合計）。実行手順・ケース表・STOP 条件は **`plans/031〜035`** が SSOT（zero-context executor 向け自己完結・全プラン Docker 必須）。監査台帳: [`plans/audit/findings-13-integration-coverage.md`](../../plans/audit/findings-13-integration-coverage.md)
- **コスト感**: S〜M × 5 プラン（相互独立・並行可。031 と 027 は seed.ts 拡張が重なるためマージ注意）
- **やらないと判定したもの**（再監査防止）: saveUserCart 統合（plan 005 のコード修正先行）、sendMessage 配列 tx（低レバレッジ）、updateProduct tx（money-path 外の次点候補）、`ORDER BY RANDOM()` 単独プラン化（033 に従属）— 詳細は findings-13 の rejected 節
- **即時 TODO**: [`QA_HANDOFF.md`「次回着手用 依頼プロンプト」R5](./QA_HANDOFF.md)、進捗 SSOT は [`plans/README.md`](../../plans/README.md) status 列

#### R6. improve Round 6 Integration 深掘りギャップ解消（plans 036〜039）🆕 2026-07-11 起票

- **対象**: `tests/integration/` への 4 スイート新設（seed ヘルパーは変更なし）。検証対象コード: `src/queries/product.ts`（deleteProduct の FK 境界 / handleProductAndVariantUpdate の全置換 tx / getProducts のフィルタ合成）、`src/queries/user.ts`（upsertShippingAddress の default 不変条件）
- **なぜやるか**: Round 5 が「$transaction / raw SQL / webhook 全サイト」を精査済みのため、Round 6 は**別の切り口**（FK onDelete の実セマンティクス・非原子 multi-write の不変条件・削除+再作成の下流連鎖・複雑 where ビルダー）をスイープした結果、(1) **レビュー付き商品はセラーが削除できず P2003 が 500 として露出**（Review→Product が RESTRICT — migration SQL レベルで確証）、(2) **新規住所を default 作成すると既存 default と併存**し checkout 自動選択（`addresses.find(a => a.default)`）が非決定化、(3) 商品編集の sizes 全置換が Wishlist.sizeId を SET NULL・CartItem.sizeId を stale 化、(4) browse 主経路の `lte: Infinity` Decimal 境界・「存在しない URL のフィルタ黙殺 → 全件」がいずれも実 DB 未検証と判明したため
- **何を達成するか**: Integration に 4 スイート・約 20 テストを追加（R5 完了後の想定合計: 2 → 10 スイート / 約 65〜70 テスト）。実行手順・ケース表・STOP 条件は **`plans/036〜039`** が SSOT（zero-context executor 向け自己完結・全プラン Docker 必須）。監査台帳: [`plans/audit/findings-14-integration-coverage-r6.md`](../../plans/audit/findings-14-integration-coverage-r6.md)。037/039 は**現挙動の characterization** を含む（修正プラン実行時に期待値を反転する前提を各プランに明記済み）
- **コスト感**: S〜M × 4 プラン（相互独立・並行可。seed.ts 非変更のため 027/031〜035 とも競合しない）
- **やらないと判定したもの**（再監査防止）: followStore トグル（implicit M2M unique が保護）、addToWishlist 重複ガード（検証すべき unique 制約が存在しない）、taxonomy/coupon upsert 群（P2002 フォールバック実装済み・次点）、applyCoupon total ロストアップデート（コード修正先行）、getStoreOrders ページング — 詳細は findings-14 の rejected 節
- **即時 TODO**: [`QA_HANDOFF.md`「次回着手用 依頼プロンプト」R6](./QA_HANDOFF.md)、進捗 SSOT は [`plans/README.md`](../../plans/README.md) status 列

#### R7. improve Round 7 Integration 残余ギャップ解消（plans 040〜041）🆕 2026-07-11 起票

- **対象**: `tests/integration/` への 2 スイート新設（seed ヘルパー・reset-db とも変更なし）。検証対象コード: `src/app/api/webhooks/route.ts`（Clerk `user.deleted` の `db.user.deleteMany`）、`src/queries/coupon.ts`（upsertCoupon / upsertCouponAsAdmin の P2002 フォールバック）
- **なぜやるか**: R5/R6 が未スイープの切り口（user-sync webhook・グローバル unique の実発火）をスイープした結果、(1) **User への FK は RESTRICT（Store/Review/ShippingAddress/Order）・CASCADE（Cart/Wishlist/PaymentDetails/Conversation/Message）・SET NULL（SupportTicket）の 3 種混在**で、注文・レビュー・住所・店舗持ちユーザーの Clerk 削除は P2003 → 500 → Svix 無限リトライ + PII 残存（コンプライアンス隣接 — migration SQL レベルで確証）、(2) **`Coupon.code` はグローバル unique なのに upsertCoupon の事前チェックは自店舗スコープのみ** — 他店舗/PLATFORM とのコード衝突は決定論的に P2002 フォールバックへ到達する（race ではない）のに実 unique 制約は一度も発火していない、と判明したため。高レバレッジ候補が 2 件のみだったため水増しせず 2 本
- **何を達成するか**: Integration に 2 スイート・約 11 テストを追加（R5/R6 完了後の想定合計: 2 → 12 スイート / 約 76〜81 テスト）。実行手順・ケース表・STOP 条件は **`plans/040〜041`** が SSOT（zero-context executor 向け自己完結・全プラン Docker 必須）。監査台帳: [`plans/audit/findings-15-integration-coverage-r7.md`](../../plans/audit/findings-15-integration-coverage-r7.md)。040 のシナリオ 2〜4・041 のシナリオ 2・3 は**現挙動の characterization** を含む（修正プラン実行時に期待値を反転する前提を各プランに明記済み）
- **コスト感**: S〜S–M × 2 プラン（相互独立・並行可。seed.ts / reset-db.ts 非変更のため 027/031〜039 とも競合しない）
- **やらないと判定したもの**（再監査防止）: category/subCategory/offerTag upsert 群（事前チェックがグローバルで unique と整合 — P2002 は race 限定）、applySeller/upsertStore 一意性（plan 002 の修正先行 + unit 網羅済み）、profile 読み取り群（plan 039 と同セマンティクス族）、dashboard 集計系（unstable_cache の試験環境リスク）、upsertShippingRate（正しい upsert イディオム）、getStoreOrders ページング（plan 009 先行 — deferred へ変更）— 詳細は findings-15 の rejected 節
- **即時 TODO**: [`QA_HANDOFF.md`「次回着手用 依頼プロンプト」R7](./QA_HANDOFF.md)、進捗 SSOT は [`plans/README.md`](../../plans/README.md) status 列

---

### 🟢 未着手（低優先度）— Mid–Long Term

#### B4. CI でのカバレッジ artifact 化 + dashboard 自動再生成
> ✅ **完了（2026-06-03）** — 見出しテキストは内部リンクのアンカー安定のため変更せず、完了表示は本行で示す。
- **対象**: `jest.config.js`（`collectCoverageFrom` / `coverageReporters: ['lcov', 'text-summary']`）+ `.github/workflows/ci.yml`（`test` ジョブ）
- **採用ツール**: Jest（既存）+ `actions/upload-artifact@043fb46d # v7.0.1`
- **コスト感**: **S**（CI 1 ジョブに 2 ステップ追加）
- **実装**:
  - `jest.config.js`: `coverageReporters: ['lcov', 'text-summary']` 設定済み（既存）。
  - `ci.yml` `test` ジョブ: `bunx jest --verbose --ci --coverage` → `coverage/lcov.info` を `coverage-lcov` artifact 化（既存）。本タスクで **`bun run coverage:dashboard` を後段に追加**して `docs/coverage-dashboard.html` を再生成し、**`coverage-dashboard` artifact（`retention-days: 7`）**として保存。
- **反映方式 = artifact のみ（リポジトリへの自動コミットはしない）**:
  - `render-html.ts` が `generatedAt`（`new Date()`）を masthead / `<meta>` / 埋め込み JSON の 3 箇所に出力するため、**CI 実行ごとに HTML が必ず差分を持つ**。naïve に main/dev へ自動コミットすると commit→CI→commit のループ（churn）になる。
  - したがって追跡ファイル（`docs/coverage-dashboard.html`）の更新は従来どおり[手動コミット運用（rule 02）](../../.claude/rules/02-tdd-step-commit.md)を SSOT のまま維持し、CI は**最新カバレッジの可視化を artifact として残す**役割に限定する。PR コメント / GitHub Pages は本フェーズ非対象。
- **期待効果**: ローカル再生成漏れがあっても、PR の Actions run summary から常に最新 lcov 由来の dashboard artifact をレビュー可能。
- **背景**: 旧 OI-7（`coverage/lcov.info` が古い）の根本対応として `QA_HANDOFF.md` の Open Issues から移管（2026-05-24）→ 本タスクで完了（2026-06-03）。

---

#### ~~C1. Lighthouse CI でパフォーマンス予算化~~ ✅ 完了（2026-05-30）
- **対象**: `.github/workflows/lhci.yml` + `.lighthouserc.json`（新規）
- **採用ツール**: `@lhci/cli@0.15.1` + GitHub Actions
- **コスト感**: **M**
- **期待効果**: LCP / CLS / TBT の退行を PR で検知
- **実装**: `pull_request [main, dev]` + `workflow_dispatch` トリガー。`ci.yml` の `seed-idempotency` を土台に Postgres service → `migrate deploy` → `seed:e2e` → `build` → `bunx lhci autorun` で `/browse` を 3 回計測（`preset: desktop`）。
- **Clerk 回避策（要点）**: `clerkMiddleware` は dev インスタンス（`pk_test`）だと「dev browser cookie 不在」で FAPI への handshake リダイレクトを発行するため、偽ドメインだと collect が 400 で失敗する。本番インスタンス形式の**ダミー `pk_live` キー**（`pk_live_` + base64(`example.clerk.accounts.dev$`)、secret も `sk_live_` ダミー）にすると handshake を行わず、未認証リクエストは FAPI 未到達で `currentUser()` が null を返し公開ページが描画される（ローカル `next start` で `/browse` → 200・handshake なしを実証）。
- **残課題**:
  - assertions は **warn-only** ベースライン。数回観測後に `.lighthouserc.json` を `warn` → `error` 化して予算を厳格化（将来 issue 化）。
  - **ホーム（`/`）は計測対象外**。`src/components/store/home/main/featured.tsx:13` の `useState<number>(window.innerWidth)` が SSR で `ReferenceError: window is not defined` を投げ `/` が 500（C1 とは独立した既存バグ）。当該バグ修正後に `/` を URL リストへ追加する。

#### C2. Bundle Size の継続監視
- **対象**: `.github/workflows/bundle.yml`
- **推奨ツール**: `@next/bundle-analyzer` + `size-limit`
- **コスト感**: **S**
- **期待効果**: 依存追加による初期ロードの膨張を抑制

#### (backlog) E2E 行の拡大
- **対象**: `tests/e2e/`（store / dashboard フロー）
- **背景**: ヒートマップ E2E 行は現状 `pages` のみ✦（10%）。seller onboarding 実行・order 管理など store/dashboard 主要フローは spec ファイルは存在するが `seed:e2e` 前提で未安定実行
- **方針**: 形式 Next Action（`render-html.ts` の `NEXT_ACTIONS`）には未起票。**OI-8（CI flake）解消後**に安定実行の目処が立った段階で起票判断（過剰起票回避）

---

## 4. 実装中に遭遇した問題と解決

### Issue #1: Jest 30 の CLI フラグ変更
- **症状**: `bun run test -- --testPathPattern=...` が `Option "testPathPattern" was replaced by "--testPathPatterns"` でクラッシュ
- **原因**: Jest 30 (2025 リリース) で破壊的変更。複数形 `--testPathPatterns` に置き換わった
- **対応**: 全 CLI 呼び出しを `--testPathPatterns=...` に修正
- **波及**: `package.json` の `test:watch` などには影響なし (フラグ未使用)。README で開発者向けに記載検討

### Issue #2: テストケース数のセマンティクス
- **症状**: 最初の TDD ステップで `it/test/describe` を全てカウントすると、fixture の期待値 `3` に対し実測 `4` で失敗
- **原因**: `describe` は **テストケース** ではなく **グルーピングラッパー**。ケース数として数えるとミスリードになる
- **対応**: `BLOCK_PATTERN` から `describe` を除外。テスト名も「(it / test) の数」に修正
- **学び**: TDD では「期待値ありき」で実装すると、こうしたセマンティクスのズレが早期に顕在化する

### Issue #3: ドメイン数の境界 (9 vs 10)
- **症状**: `expect(DOMAINS).toHaveLength(9)` で失敗。実装は 9 ドメイン + `other` = 10
- **原因**: 「ユーザに見せる主要ドメイン」と「fallback バケット」の混同
- **対応**: `DOMAINS` には `other` を含めて 10 とし、UI 側で 0 件の `other` を非表示にする方針へ
- **副次効果**: スキャナが自分自身のテスト (`scripts/coverage-dashboard/*.test.ts`) を `other` に分類し、自己整合性のあるカウントになった

### Issue #4: components/store の二重解釈
- **症状**: `src/components/store/` と `tests/component/store/` が**ドメインは同じ** (store-ui) だが、**カテゴリは異なる** (前者: unit, 後者: integration)
- **原因**: パスベース分類のヒューリスティック設計時に、`tests/component/` プレフィックスがカテゴリを上書きする仕様を明文化していなかった
- **対応**: `categorize.ts` の `detectCategory` で `tests/component/` 配下を最優先で integration 判定
- **テスト追加**: `tests/component/store/cart.test.tsx → category=integration`、`src/components/store/foo.test.tsx → category=unit`

### Issue #5: lcov.info の鮮度 ✅ 2026-05-24 運用確定
- **再定義**: `coverage/lcov.info` は [`.gitignore:10`](../../.gitignore) で `/coverage` 全体を無視しているため **git 管理外**。古さは「リポジトリの欠陥」ではなく「ローカル生成物の状態」であり、開発者ごとにローカルで再生成する仕様
- **運用**: `bun run test -- --coverage` → `bun run coverage:dashboard` の順で実行し、`docs/coverage-dashboard.html`（こちらは git 追跡）のみコミットする
- **CI 自動化**: → [§3 B4](#b4-ci-でのカバレッジ-artifact-化--dashboard-自動再生成) に移管

### Issue #6: CI ワークフロー未整備
- **症状**: `.github/workflows/` ディレクトリが存在せず、coverage / lint / type check / e2e のいずれも PR ブロックされない
- **影響**: テストを書いても「実行されているか」が保証されない → ダッシュボードのステータスが意味を持ちにくい
- **根本対応**: GitHub Actions で最低限 `bun run lint` + `bun run test` + `bun run build` の 3 ジョブを走らせる必要あり (本タスクのスコープ外)

### Issue #7: ダッシュボードの自己参照
- **症状**: `scripts/coverage-dashboard/*.test.ts` (5 本) が `other` ドメインの unit セルに加算される
- **判断**: バグではなく **自己整合性のある仕様**。スクリプト自体もテスト対象である以上、カウントされるべき
- **副次効果**: 65 → 60 にしたい場合は `IGNORED_DIRS` に `scripts` を追加すれば良いが、ドッグフード性を残すためにあえて未対応

---

## 5. ダッシュボードの再生成

```bash
# 最新の lcov を取得してから生成すると数値が正確
bun run test -- --coverage   # lcov.info を更新 (任意)
bun run coverage:dashboard   # docs/coverage-dashboard.html を再生成
```

実行ログ例:

```
[coverage-dashboard] scanning /path/to/repo
[coverage-dashboard] found 65 test file(s)
[coverage-dashboard] parsed lcov entries: 50
[coverage-dashboard] matrix: 11/80 cells covered (14%)
[coverage-dashboard] wrote docs/coverage-dashboard.html (118.1 KB)
```

### モジュール構成

| ファイル | 責務 | 単体テスト数 |
|---|---|---|
| `scripts/coverage-dashboard/scan-tests.ts` | テストファイル列挙 | 6 |
| `scripts/coverage-dashboard/categorize.ts` | パス → (category, domain) 分類 | 27 |
| `scripts/coverage-dashboard/parse-lcov.ts` | LCOV → ファイル別カバレッジ% | 7 |
| `scripts/coverage-dashboard/build-matrix.ts` | マトリクス + サマリ集計 | 7 |
| `scripts/coverage-dashboard/render-html.ts` | Editorial Laboratory HTML 生成 | 11 |
| `scripts/coverage-dashboard/build.ts` | CLI エントリ | — |

合計 **58 本** の Jest テスト (AAA パターン / TDD 開発)。

---

## 6. 関連ドキュメント

- [`docs/coverage-dashboard.html`](./coverage-dashboard.html) — 視覚的ダッシュボード本体
- [`docs/testing/TESTING_DESIGN.md`](./TESTING_DESIGN.md) — テスト設計の全体方針
- [`docs/testing/QA_TEST_PERSPECTIVES.md`](./QA_TEST_PERSPECTIVES.md) — QA 観点リスト
- [`docs/testing/TEST_IMPLEMENTATION_PLAN.md`](./TEST_IMPLEMENTATION_PLAN.md) — 実装計画
- [`scripts/coverage-dashboard/README.md`](../../scripts/coverage-dashboard/README.md) — ダッシュボード生成スクリプトの開発者向け解説
- [`specs/multi-vendor-ecommerce/07-testing.md`](../../specs/multi-vendor-ecommerce/07-testing.md) — テスト要件 (SDD)

---

## 7. 履歴

| 日付 | 出来事 |
|---|---|
| 2026-05-21 | ダッシュボード初回生成。本レポート作成 (commit `41c9fd9`) |
| 2026-05-21 | Phase 1 基盤テスト検証完了。テスト総数 881 → 945、型エラー 0 件に (commits `8e8df92`–`ad6bbc7`)。ダッシュボード再生成。 |
| 2026-05-21 | **A1 完了**: SECURITY_GAP_REPORT.md 作成。IDOR 脆弱性 2 件（paypal/stripe）を修正。認可テスト 14 ファイル全調査・補完。Security の queries 列が `◯` → `✦` に昇格 (commits `55c07b1`, `03a7e89`). |
| 2026-05-21 | **A2 完了（baseline 未コミット）**: `tests/e2e/visual/` に cart/checkout Visual Regression spec を追加。`playwright.config.ts` に安定化設定を追加。Visual の pages 列が `◯` → `◐` に昇格 (commit `f639334`). |
| 2026-05-21 | **A3 完了**: `tests/e2e/a11y/` に sign-in / seller-apply の WCAG 2.1 AA スキャンを追加（`@axe-core/playwright`）。a11y の pages 列が `◯` → `◐` に昇格 (commit `d261d76`). |
| 2026-05-22 | PayPal `capturePayPalPayment` の try-catch リファクタリング (commit `217bf76`). |
| 2026-05-24 | **A4 完了**: `src/lib/auth-guards.ts` 導入 → 6 ファイルの認可をヘルパー集約。IDOR テスト 3 階層化（where 構造検証 + 副作用なし検証）で +8 件。テスト総数 1008 → 1016。lcov 95 → 96。詳細は [`SECURITY_GAP_REPORT.md §5`](./SECURITY_GAP_REPORT.md#5-追加調査拡充2026-05-24--a4-認可ガード統合--idor-3-階層化) を参照 (commits `a73603e`–`ae66fac`). |
| 2026-05-26 | **B1+ Sprint 1 完了**: Tier 1 前半 10 プリミティブ snapshot 追加（aspect-ratio / separator / progress / switch / checkbox / radio-group / slider / toggle / tooltip / popover）。テスト総数 1016 → 1042 (+26)、Jest snapshot 40 → 66。インフラ: `tests-setup/jest.setup.ts` に ResizeObserver スタブ追加（Radix `useSize` 系の基盤）(commits `b55e177`〜`66fb8d5`, `6545fce`). |
| 2026-05-28 | **B1+ Sprint 2 完了**: Tier 1 後半 11 プリミティブ snapshot 追加（alert / alert-dialog / avatar / breadcrumb / collapsible / hover-card / input-otp / pagination / resizable / scroll-area / chart）。テスト総数 1042 → 1069 (+27)、Jest snapshot 66 → 93 (+27)。chart は recharts ResponsiveContainer の jsdom 0-size 警告を console.warn spy で抑制。hover-card は role 無しのため getByText で styled HoverCardContent を取得 (commits `750d830`〜`45c339b`). |
| 2026-05-28 | **B1+ Sprint 3 完了**: Tier 2 全 8 プリミティブ snapshot 追加（dropdown-menu / context-menu / menubar / sheet / drawer / tabs / toggle-group / table）。テスト総数 1069 → 1088 (+19)、Jest snapshot 93 → 112 (+19)。class-heavy な Menu snapshot を理由に 1 ファイル 1 commit で分離（Menu family 同梱は 200 行閾値超過）。context-menu は fireEvent.contextMenu / menubar は Root defaultValue で open 状態を再現 (commits `e6c79e3`〜`4429b8b`). |
| 2026-05-28 | **B1+ Sprint 4 完了 / NA-NS-01 archive (B1+ 全完了)**: Tier 3 + 補助 全 11 プリミティブ snapshot 追加（form / calendar / carousel / command / sidebar / navigation-menu / sonner / accordion / toast / toaster / data-table）。テスト総数 1088 → 1103 (+15)、Jest snapshot 112 → 127 (+15)。**49/49 shadcn/ui プリミティブカバー達成**。インフラ: `tests-setup/jest.setup.ts` に IntersectionObserver / matchMedia / Element.scrollIntoView スタブ追加（embla-carousel-react / cmdk 基盤）。`scripts/coverage-dashboard/render-html.ts` の `NEXT_ACTIONS` から NA-NS-01 を削除しアーカイブ化 (commits `1b207ba`〜`8e429f2`, infra: `222d16e` / `ab07840`). |
| 2026-05-28 | **B2 完了 / NA-NS-02 archive**: Stripe/PayPal Webhook ハンドラーを新規実装（`/api/webhooks/stripe` + `/api/webhooks/paypal`）。Stripe `webhooks.constructEvent` 署名検証 + PayPal `verify-webhook-signature` API 呼び出し（OAuth Bearer フロー）+ 冪等な PaymentDetails upsert を導入。固定ペイロードフィクスチャを `tests/fixtures/webhooks/{stripe,paypal}/` に配置し Contract テスト 30 ケース + metadata 検証 2 ケース追加。テスト総数 1103 → 1135 (+32)、スイート 110 → 112 (+2)。前提として `src/queries/stripe.ts` `paypal.ts` に `metadata.orderId` / `purchase_units[].custom_id` を付与し Webhook 相関を可能化 (commits `338ab41` / `1d69f0f` / `2321cd8`). |
| 2026-05-31 | **Unit 行✦化（seed 除く）**: `jest.config.js` に logic-centric な `collectCoverageFrom` + `coverageReporters` と画像/スタイルの moduleNameMapper を追加。co-located unit テスト 10 ファイル（shared 3 / store 3 / dashboard 3 / pages 1、+42 テスト・+10 スイート、1137 → 1179）で Unit 行の `pages / store / dashbd / shared` を ◯ → ✦ に昇格。`api` は構造的 N/A（categorize で api-contract 固定）、`seed` は分母外（意図的）、`hooks`/`other` は既存スキップ起因の ◐。詳細は §2 注記 / [`QA_HANDOFF.md`](./QA_HANDOFF.md)。 |
| 2026-05-31 | **B3.1 完了**: 注文確定 `placeOrder` を実 DB 統合テストで初カバー。`tests/integration/order-placement.test.ts`（6 シナリオ）。`seed.ts` に ProductVariantImage 作成 + `seedShippingAddress` を追加（本体無変更）。Integration 11 → 17 / スイート 1 → 2、テストファイル総数 134 → 135。`tests/integration/` は categorize 上 unit×other に分類されるドリフトを注記（マトリクス 17/80 不変） (commits `78a20c9` / `ae28157`). |
| 2026-05-29 | **B3 完了 / NA-NS-03 archive**: Cart → Checkout の状態橋渡しを Integration tier で初カバー。`tests/integration/cart-checkout.test.ts` で 4 シナリオ計 11 テスト（Zustand persist hydration / shipping fee 一貫性 ITEM・WEIGHT・FIXED / `applyCoupon` 正常+4 異常パス / 未認証 redirect）。基盤として testcontainers + 専用 jest config (`jest.integration.config.js`) + 5 setup ヘルパーを新設（ADR-004 で技術選定の根拠を記録）。CI workflow に `integration-tests` ジョブを追加。`scripts/coverage-dashboard/render-html.ts` の `NEXT_ACTIONS` から NA-NS-03 を削除しアーカイブ化。Integration マトリクスの queries / pages / lib セルが ✦ に遷移. |
| 2026-06-02 | **D1 完了（categorize ドリフト解消）**: `scripts/coverage-dashboard/categorize.ts` に `tests/integration/` → `integration × queries` の分類規則を追加し、統合テスト（cart-checkout / order-placement）の `unit × other` 誤分類を恒久解消。`categorize.test.ts` に domain/category 両ケース追加（32 ケース green）。再生成（lcov あり）で `integration × queries` ◯→◐・`unit × other` から統合 2 ファイル離脱、`coveredCells` 17→18（21%→23%）、`byCategory.unit` 50→48 / `integration` 66→68。Issue #4 の api→api-contract 上書き設計は維持。`render-html.ts` の `NEXT_ACTIONS` と `QA_HANDOFF.md` 依頼プロンプトから D1 を同時削除 (commit `b57841a` + 本コミット). |
| 2026-06-06 | **コードレビュー指摘対応 + 統計同期**: `upsertReview` を `db.user.upsert` でアトミック化（findUnique→create のレース回避）し、メール欠落エラー経路のユニットテストを +1。併せて CustomRatingStars の ARIA/キーボード操作、profile データ取得の try/catch、テスト群の `any`/unsafe cast 除去・共有フィクスチャ化、admin-manual のソフトデリート記述修正を実施。テスト統計を実測へ同期（unit/component 1179 → **1193**、スイート 122 → **129**、snapshot 127 不変、型エラー 0）。差分の大半は 2026-05-31 以降に追加された review/rating 系コンポーネントテストの未同期分の反映 (commits `a86e012`〜`7ef382f` + 本コミット). |
| 2026-06-06 | **CI品質ゲート改善（カバレッジ向上＆アクセシビリティ対応）**: `review-details.tsx` の非ネイティブ `role="slider"` を廃止し、各星をネイティブな `<button type="button">` に置き換えてアクセシビリティ指摘をクリア。`product.ts` の未使用インポート `getCookie` を削除。payments-table, reviews-container, product-list, upload-images, sidebar の5つのテストファイルを新規作成し、`review.test.ts` にも例外エラー分岐のテストを追加。テスト統計を実測へ同期（テストファイル総数 142 → **147**、テスト総数 1193 → **1220**、スイート数 129 → **134**）。 |
| 2026-06-13 | **管理者ダッシュボード Phase 1 / Task 1-A 完了**: `src/queries/order.ts` に admin 注文 query 5 種を追加（`getAllOrders` [limit≤100 clamp], `getOrderForAdmin` [userId フィルタ無し], `updateOrderGroupStatusAsAdmin` [`reconcileParentOrderStatus` で子→親集約], `updateOrderItemStatusAsAdmin`, `updateOrderPaymentStatus` [Refunded/Cancelled の親→子連動・決済 API 非呼出]）。`src/lib/types.ts` に `AdminOrderType` 追加。認可は `requireAdmin()`、非 ADMIN 拒否は IDOR 3 階層パターン。`order.test.ts` +24（テスト総数 1220 → **1242 passed**、テストファイル/スイート不変） (commits `ae18ce3`〜`d88063a` + 本コミット). |
| 2026-06-13 | **SonarCloud Quality Gate (PR #133) 修復**: `order.ts` の New Code Coverage 63.4% (< 80%) が CI を落としていた。未カバーは admin query 5 関数の `catch` ブロック（エラー経路）と `reconcileParentOrderStatus` の Delivered/Canceled/Refunded 集約分岐・子0件早期 return。`order.test.ts` に異常系（DB エラー → 汎用メッセージ変換 / 元 Error 再 throw）と集約分岐テストを +9（テスト総数 1242 → **1251 passed**、テストファイル/スイート不変）。`order.ts` Lines 87.5%→100% / Branch 61.5%→83.3%（Sonar 換算 ~93%）。プロダクションコードは無変更 (commit `38a9bbe`). |
| 2026-06-13 | **SonarCloud Quality Gate (PR #134) 修復**: New Code の Coverage 19.4% (< 80%) と Duplication 7.8% (> 3%) が `SonarCloud Code Analysis` チェックを落としていた（GitHub Actions ジョブは `continue-on-error` で緑だが、Sonar アプリが別経路で貼る Quality Gate ステータスは赤）。admin/seller の `orders/columns.tsx` に重複していた `ProductImagesCell` / `ViewOrderButton` を `src/components/dashboard/shared/order-table-cells.tsx` へ抽出（重複塊を除去）。共有 + admin columns + seller columns のテストを新規 +19、`order-status-select.test.tsx` に admin 分岐・falsy レスポンスを +2（テスト総数 1251 → **1272 passed**、テストファイル総数 147 → **150**、スイート 134 → **137**）。対象4ファイル Lines 100% (commits `2d692cb`〜`0d9fba5`). |
| 2026-06-14 | **OI-8 クローズ（modal-provider un-skip）**: CI flake の真因（`src/queries/size.test.ts` が `@/lib/db` 未モックで実 Prisma を `spyOn` → stub DB に P1001 接続リーク → jest-circus が別ファイルへ「本文空」失敗を帰属）は `83ef06c` で根絶済み。被害者だった `modal-provider.test.tsx` の file-level skip を解除し 9 件を un-skip（テスト総数 1272 → **1281 passed**、skip 12→3、suites skip 2→1、テストファイル/スイート総数不変）。ローカル 30x ループ FAIL 0 / stub DB フルスイート P1001 = 0、CI push/pull_request 両 event 緑。ヒートマップ `Unit × hooks` ◐→✦（`modal-provider.tsx` lcov 32/33 = 97%） (commit `49fa32d` + 本コミット). |
| 2026-06-15 | **Phase 2 F1 ダッシュボード統計 query 実装**: `src/queries/dashboard.ts` 新規（`getAdminDashboardStats` + `getSalesOverTime` + `getRecentOrders` + `getRecentStores`）。`dashboard.test.ts` 21 件追加（認可 3 階層・Paid のみ集計・isDeleted 除外・売上チャート・最近リスト）。TDD Red→Green 4 コミット。テスト総数 1281 → **1302 passed**、スイート 137 → **138** (commits `f871919`〜`0f42b91`). |
| 2026-06-15 | **SonarCloud Quality Gate (PR #136) 修復**: New Code Coverage 46.0%（< 80%）を解消。`dashboard.ts` catch ブロック（Error / 非-Error 両分岐）を `dashboard.test.ts` に +8。admin dashboard コンポーネント 4 本（stats-cards / recent-orders / sales-chart / recent-stores）のテストを新規作成（`tests/component/dashboard/admin/`、+18 テスト / +4 スイート）。`@tremor/react AreaChart` は jsdom モック。テスト総数 1302 → **1328 passed**、スイート 138 → **141** (commits `750374b`–`ef091c3`). |
| 2026-06-15 | **Phase 3 F3-第1段 クーポン横断管理 + isActive 列追加**: `Coupon.isActive` 列追加（`@default(true)`、後方互換）+ Prisma migrate + ERD 再生成。`applyCoupon` Step 2.5 / `placeOrder` チェック条件に isActive 再検証を追加（TDD Red→Green 4 コミット）。admin クーポン query 4 種（`getAllCoupons` / `upsertCouponAsAdmin` / `deleteCouponAsAdmin` / `toggleCouponActive`）実装 + TDD 18 テスト。`AdminCouponFormSchema`（isActive / storeId optional）追加。`/dashboard/admin/coupons/` UI（page.tsx / columns.tsx / new/page.tsx）+ `admin-coupon-details.tsx` フォーム新規実装。テスト総数 1328 → **1348 passed**（スイート 141 変動なし）(commits `d5d5284`–`eb996d0`). |
| 2026-06-16 | **SonarCloud QG 修復（PR #138）**: CouponFormFields 共有コンポーネント抽出（重複解消）/ coupon.ts 残ブランチカバー +39 / columns.tsx テスト追加 / admin-coupon-details.tsx コンポーネントテスト 10 件 / storeId 正規化 fix。テスト総数 1348 → **1387 passed**、スイート 141 → **143**、テストファイル 154 → **157** (commits `a80e4be`–`9d12e90`). |
| 2026-06-16 | **Phase 5-B 完了（F3-第2段 platform-wide クーポン）**: `Coupon.storeId` nullable 化 + `CouponScope` enum 追加（ERD 再生成）を起点に、`placeOrder`（複数 OrderGroup 按分・端数吸収）/ `applyCoupon`（Decimal 厳密演算化）/ `updateCheckoutProductWithLatest`（`coupon.store` null ガード）を PLATFORM scope 対応。`AdminCouponFormSchema` に `superRefine`（scope 別 storeId 必須/禁止）追加、`upsertCouponAsAdmin` と seller `upsertCoupon` に P2002 統一日本語メッセージを実装、admin-coupon-details.tsx に scope ドロップダウン UI 追加。テスト総数 1387 → **1398 passed**、スイート 143 不変 (commits `dcd70cc`–`1e1749a`). |
| 2026-06-16 | **Phase 5-C 完了（E2E 検証）**: `tests/e2e/platform-coupon.spec.ts` 新規（2店舗カート + PLATFORM クーポン適用 → 注文確定 → 両 OrderGroup の割引・couponId 反映を Chromium で確認、seed 拡張は `59db81d` で先行投入済み）。実装時に `applyCoupon` の Decimal クライアント返却シリアライズ漏れ（`updateCheckoutProductWithLatest` で過去修正した同型バグ）を検出し `ae9364f` で修正。Jest 統計は変動なし、Playwright E2E（main）5 → **6** スペック (commits `ae9364f`–`3463d1d`). |
| 2026-06-17 | **コードレビュー指摘対応（IDOR / クーポン UI / 認可ガード配置）**: `updateCheckoutProductWithLatest` の cross-cart IDOR（`cartProducts[0].cartId` のみ検証）を、全 cartProduct を所有カートの cartItem id 集合で検証する方式に修正 + IDOR 回帰テスト +1。checkout `isDiscounted` に `isCouponCurrentlyValid` を AND し失効/無効クーポンの割引 UI ドリフトを解消。`upsertCoupon`/`getStoreCoupons`/`deleteCoupon` の `requireStoreOwner` を try/catch 外へ移動（tech.md 準拠）し dead な isGuardError 分岐を除去、coupon.test.ts の旧ラップ期待 2 件を更新。テスト総数 1399 → **1400 passed**、スイート 143 → **144** (commits `ec4192f`–`a6b5223`). |
| 2026-06-17 | **`upsertCoupon` cross-store/PLATFORM hijack IDOR 修正**: seller `upsertCoupon` の `db.coupon.upsert({ where: { id } })` が id 単独キーで対象行の所有権を検証しておらず、他店舗（または admin の PLATFORM）クーポンの id を渡すと update 分岐が `storeId` を自店舗へ書き換えて乗っ取れた（Phase 5 の PLATFORM scope 追加で blast radius 拡大）。upsert 前に対象行を `findUnique` し `storeId !== store.id`（PLATFORM=null 含む）を `Forbidden` で拒否（認可 throw は DB read の try/catch 外）。IDOR 3 階層 (a)(c) テスト +2（他店舗 / PLATFORM）。SECURITY_GAP_REPORT.md §6 記録。テスト総数 1400 → **1402 passed**、144 スイート不変 (commits `f6e75fd`–`505e13b`). |
| 2026-06-17 | **`applyCoupon` TOCTOU レースコンディション修正**: Step 4 の `cart.couponId` チェックと Step 7 の無条件 `db.cart.update` が原子的でなく、並行リクエストが両方チェックを通過して後勝ちで先のクーポンをサイレントに上書きできた。無条件 `update` を `couponId=null` を条件に含めた条件付き `updateMany`（DB レベル CAS）へ置換し、`count === 0` で `'Coupon is already applied to this cart.'` をスロー、続けて `findFirstOrThrow` で返却形を再構築。両クエリで `userId` スコープ維持。3 階層 (a)(b)(c) 回帰テスト +1 + 既存正常系 7 件を `updateMany`+`findFirstOrThrow` へ移行。SECURITY_GAP_REPORT.md §7 記録。テスト総数 1402 → **1403 passed**、144 スイート不変 (commits `da8b9b9`–`3e665be`). |
| 2026-06-17 | **`applyCoupon` Decimal 演算エラー経路テスト追加**: Step 6（割引計算ブロック）は既存テストで DB エラー経路のみカバーされ、`Prisma.Decimal` 演算が throw したときの catch ラップが未検証だった。`Prisma.Decimal.prototype.mul/div/add/sub` を各 `mockImplementationOnce` で throw させ、`"Error occurred while applying coupon"` ラップを 4 件で検証。テスト総数 1403 → **1407 passed**、144 スイート不変 (commit `04dd88c`). |
| 2026-06-18 | **販売者ダッシュボード Phase 1 + Phase 2-A/2-B（F2 在庫管理 query 層）**: `Store.lowStockThreshold Int @default(5)` 追加（`safe-migration` + ERD 再生成）。`src/queries/inventory.ts` 新規（`getStoreInventory` / `updateSizeStock` / `updateStoreLowStockThreshold`）— 認可は `requireStoreOwner`（try/catch 外）、`updateSizeStock` は size→variant→product.storeId 所有権チェーンで IDOR 防止。`UpdateSizeStockSchema` / `LowStockThresholdSchema` 追加。`getStockStatus` / `StockStatus` を `src/lib/utils.ts` に純粋関数として抽出（F2-5）、`StoreInventoryRow` を `Prisma.PromiseReturnType` で `types.ts` に導出。`inventory.test.ts` 新規スイート +22（認可/IDOR 3 階層/Zod 弾き/正常系）+ `utils.test.ts` getStockStatus 境界 +6（AC-F2-5）。テスト総数 1407 → **1435 passed**、テストファイル 158 → **159**、スイート 144 → **145**。UI（2-C）は未着手 (commits `dbf7127`–`2dd35b5`). |
| 2026-06-18 | **販売者ダッシュボード Phase 2-C 完了（F2 在庫管理 UI）**: `/dashboard/seller/stores/[storeUrl]/inventory` を新規実装（`page.tsx` は `force-dynamic` + `requireStoreOwner` で `lowStockThreshold` を取得 + `getStoreInventory` + DataTable、`columns.tsx` は threshold/storeUrl を cell へ渡すため `getInventoryColumns(threshold, storeUrl)` ファクトリ化）。`src/components/dashboard/seller/` に 4 コンポーネント新規: `stock-status-badge`（`getStockStatus`→Badge 色分け）/ `inventory-quantity-cell`（インライン編集・`useRef` リエントランシーガード・`updateSizeStock`→toast→`router.refresh()`）/ `low-stock-threshold-form`（`updateStoreLowStockThreshold`）/ `inventory-alert-summary`（在庫切れ/過小件数集計・RSC）。`stock-status-badge.test.tsx` +3 + `inventory/columns.test.tsx` +5（orders columns.test.tsx の `renderCell` パターン流用・子コンポーネントスタブ化）。テスト総数 1435 → **1443 passed**、テストファイル 159 → **161**、スイート 145 → **147** (commits `3e2e175`–`b3ba8c9`). |
| 2026-06-18 | **販売者ダッシュボード Phase 2-C 仕上げ（F2 在庫管理 UI テスト完備）**: `updateSizeStock` のアトミック所有権チェック + エラーメッセージ sanitize（`c40708a`）、在庫テーブルの client boundary 化（`inventory-table-client.tsx`、`92d14ab`）、UI 強化 + `inventory-quantity-cell.test.tsx` / `low-stock-threshold-form.test.tsx` 追加（`09b2c2e`）。最後に `inventory-alert-summary.test.tsx` 新規 +3（out/low 集計マッピング・threshold 境界が行バッジと一致・ゼロ件エッジ）で 2-C 全 6 コンポーネントがテスト完備（`8211773`）。テスト総数 1443 → **1451 passed**、スイート 147 → **150**（149 passed + 1 skipped suite）(commits `c40708a`–`8211773`). |
| 2026-06-18 | **販売者ダッシュボード Phase 3-A（F1 店舗ダッシュボード統計 query 層）**: `src/queries/store-dashboard.ts` 新規。admin `dashboard.ts` を店舗スコープ化（`requireStoreOwner` + where に `storeId` 注入）。`getStoreDashboardStats`（5 並列集計・売上は親 `Order.paymentStatus=Paid` のみ・`unstable_cache` 20 分でキャッシュキーに `storeId` 含有し店舗間混線防止 NFR-8）/ `getStoreSalesOverTime`（Paid 売上の期間別バケット集計・Decimal は return 境界で number 化）/ `getStoreRecentOrders` / `getStoreTopProducts`。`StoreRecentOrderType` / `StoreTopProductType` を `Prisma.PromiseReturnType` で `types.ts` に導出。`store-dashboard.test.ts` 新規スイート +39（認可 3 階層 × 4 関数 / 売上 join / `_sum` null→0 / storeId 別キャッシュキー / DB エラー両分岐）。テスト総数 1451 → **1490 passed**、テストファイル 161 → **162**、スイート 150 → **151**。UI（3-B）は未着手 (commit `f2cd8f1`). |
| 2026-06-18 | **販売者ダッシュボード Phase 3-B 完了（F1 店舗ダッシュボード UI）**: プレースホルダー `[storeUrl]/page.tsx` を店舗 KPI ダッシュボードへ置換。`src/components/dashboard/seller/` に presentational コンポーネント 3 本を新規追加: `store-stats-cards`（admin `stats-cards` 派生・総売上/注文/閲覧/販売/商品/在庫アラートの 6 KPI）/ `store-recent-orders`（OrderGroup 行・`toNumberSafe` で Decimal 整形）/ `store-top-products`（sales 降順）。型は `Awaited<ReturnType<typeof get*>>` で query から導出し重複定義を回避。`SalesChart`（admin/sales-chart）は `SalesPoint[]` 共用でそのまま import（依存追加なし）。`page.tsx` は `Promise.all([getStoreDashboardStats, getStoreSalesOverTime, getStoreRecentOrders, getStoreTopProducts])` + `force-dynamic`（NFR-4）。3 コンポーネント RTL +6（値描画 + ゼロ件 AC-F1-5）。テスト総数 1490 → **1496 passed**、テストファイル 162 → **165**、スイート 151 → **154** (commits `4301c85`–`07bc12e`). |
| 2026-06-19 | **販売者ダッシュボード Phase 4 完了（F3 在庫減算 + F3-5 在庫復元）**: `placeOrder`（`src/queries/user.ts`）の OrderItem 作成ループ内に条件付き `tx.size.updateMany`（`quantity:{gte}` + `decrement`）を追加し `count===0` を在庫不足として throw → `$transaction` 全体ロールバック（読み取り→減算を単一 UPDATE に畳み込み TOCTOU レース回避・F3-1〜F3-3）。`order.ts` の `updateOrderGroupStatusAsAdmin` / `updateOrderPaymentStatus` に在庫復元（F3-5）を結線: 更新前ステータスを読み「非終端 → Canceled/Refunded」遷移時のみ `tx.size.update` で `increment`、終端→終端再実行では復元せず二重復元防止（共有ヘルパー `restockOrderItems` + 終端判定抽出）。`updateOrderItemStatusAsAdmin`（配送履行軸）と seller 非トランザクション版は二重復元リスク回避のためスコープ外（TODO 残置）。`user.test.ts` +3 / `order.test.ts` +6。E2E `tests/e2e/stock-decrement.spec.ts` 新規（認証付き購入フローで在庫 before/after 検証・AC-F3-4・Jest 集計外）。テスト総数 1496 → **1505 passed**、テストファイル 165 → **166**（Playwright 6→7）、スイート 154 不変 (commits `8cbf4c0`–`eca47a6`). |
| 2026-06-19 | **profile-settings Phase 1 完了（Settings 画面 + 導線修正）**: `/profile/settings` を新規追加し、Clerk `<UserProfile routing="hash" />` を埋め込み（氏名/メール編集・パスワード・MFA・アカウント削除。編集は既存 Clerk webhook `user.updated`/`user.deleted` 経由で Prisma `User` に同期、新規 server action なし）。導線修正: `user-menu.tsx` の `extraLinks` Settings リンクを誤値 `/` → `/profile/settings`、`sidebar.tsx` の `menu` に Settings エントリ追加。RTL テスト +3（`tests/component/store/user-menu.test.tsx` 回帰 / `profile-sidebar.test.tsx` エントリ / `settings-page.test.tsx` `<UserProfile>` モック描画、各 jsdom pragma + async Server Component は `render(await UserMenu())`）。テスト総数 1505 → **1508 passed**、テストファイル 166 → **169**、スイート 154 → **157** (commits `413ed19`–`9d5629d`). |
| 2026-06-19 | **profile-messages Phase 1〜3（購入者↔販売者 1:1 メッセージング）**: Phase 1 で `Conversation`/`Message` モデル + User/Store/Order 逆リレーション追加（`safe-migration` + ERD 再生成・非破壊 additive）。Phase 2 で `src/queries/message.ts` 新規（6 server action: `getOrCreateConversation`[`@@unique(userId,storeId)` 複合キーで冪等 upsert] / `getUserConversations`[`requireUser` スコープ] / `getStoreConversations`[`requireStoreOwner` スコープ] / `getConversationMessages`・`sendMessage`[`$transaction` で Message 作成 + Conversation.updatedAt]・`markConversationRead`[相手発のみ・冪等]。取得/送信/既読は private `assertParticipant` で参加者検証し IDOR を防止）。`SendMessageSchema`/`StartConversationSchema`、`ConversationWithLatest`/`MessageType` 型追加。`message.test.ts` 新規スイート +31（認可 / IDOR 3 階層 [getConversationMessages/sendMessage/markConversationRead] / 冪等 upsert / `$transaction` モック検証）。Phase 3 で購入者 UI: `/profile/messages`（`force-dynamic` + `getUserConversations`）+ `messages-container.tsx`（2 ペイン・5 秒ポーリング・tech.md `cancelled` パターン + `document.hidden` 停止 + 選択時既読化）+ `conversation-thread.tsx`（`senderId===conversation.userId` でバブル左右振り分け + RHF `zodResolver(SendMessageSchema.pick({content}))` composer + `useRef` リエントランシーガード）+ sidebar 導線。component テスト 2 スイート +14（`conversation-thread.test.tsx` 7 / `messages-container.test.tsx` 7）。テスト総数 1508 → **1553 passed**、テストファイル 166 → **169**、スイート 157 → **160** (commits `83eef3e`–`a20a313`). |
| 2026-06-20 | **profile-messages Phase 4 完了（販売者 UI・ループ閉鎖）**: `getStoreConversations` の include に購入者（`user` id/name/picture）を追加し別 include 定数 `storeConversationListInclude` を新設（購入者向け `getUserConversations` は無改修）。`StoreConversationWithLatest` 型を `types.ts` に追加（`ConversationWithLatest` の superset・構造的部分型で `conversation-thread.tsx` に流用可）。販売者ページ `/dashboard/seller/stores/[storeUrl]/messages`（`force-dynamic` + try/catch フォールバック + `getStoreConversations`）+ `seller-messages-container.tsx`（購入者向けと同型 2 ペイン・左ペインは `user.name/picture` で会話識別・右ペインは `conversation-thread.tsx` 流用・返信は共有 `sendMessage`・5 秒ポーリング + `document.hidden` 停止 + 選択時既読化）+ seller サイドバー Messages 導線（`MessagesIcon` 新規）。component テスト 1 スイート +7（`seller-messages-container.test.tsx`：購入者名での一覧描画 / 選択時 fetch+既読化 / 5 秒ポーリング / `document.hidden` 停止 / 返信後再フェッチ / poll 失敗構造化ログ）+ `message.test.ts` に include アサーション 1 行（テスト数±0）。テスト総数 1553 → **1560 passed**、テストファイル 169 → **170**、スイート 160 → **161** (commits `8ab715e`–`95d0005`). |
| 2026-06-20 | **profile-messages Phase 5 完了（E2E 往復・全フェーズ完了）**: `tests/e2e/messages.spec.ts` 新規（AC-M8）。購入者が `/profile/messages` で送信 → 販売者が `/dashboard/seller/stores/[storeUrl]/messages` で受信・返信 → 購入者ページの 5 秒ポーリングが返信を自動受信する往復を検証。`browser.newContext()` で buyer/seller を別コンテキストに分離し同時セッションを維持して `toBeVisible` で受信確認。Clerk テストモードで USER/SELLER 動的生成、ACTIVE 店舗 + 会話を `beforeAll` で Prisma 直挿入（起点 UI 未実装のため）、`CLERK_SECRET_KEY` 未設定時 `test.skip`。Chromium で往復通過確認・3 ブラウザ対象。Playwright E2E（main）7 → **8 スペック**、テストファイル 176 → **177**。Jest 集計は不変（**1560 passed** / 161 スイート） (commit `ea89706`). |
| 2026-06-20 | **SonarCloud Quality Gate 修復（PR #145）**: New Code の Duplicated Lines 9.7%（> 3.0% で QG Failed）を解消。震源は購入者 `messages-container.tsx` と販売者 `seller-messages-container.tsx` の ~214 行相互コピー。共通フック `src/components/shared/messages/use-conversation-thread.ts`（ポーリング/既読化/送信後再フェッチ/`selectedIdRef` レースガード・ログ出所は引数化で既存文言維持）+ 汎用 `messages-layout.tsx`（2 ペイン骨格・アバター取得元を `getAvatar` アダプタで注入）へ抽出し両コンテナを薄いラッパ化（props は S6759 で `Readonly` 化・挙動不変、`456fadf`）。カバレッジ補完: `message.ts` 全 catch を Error/unknown 両系統 + 未テスト DB エラー経路 + order null（Branches 74.5%→**100%**、`2d5ab8a`）、共有フック/レイアウトをコンテナ経由で全分岐（両コンテナ+shared/messages **100%**、`082bf0a`）、`user-menu.tsx` 認証済み/未認証/fallback/catch（37.5%→**100%**、`cdc81d5`）。テスト総数 1560 → **1591 passed**、テストファイル不変、スイート 161 不変 (commits `456fadf`–`cdc81d5`). |
| 2026-06-21 | **Compare 機能（商品比較）実装** — `docs/design/compare/` の MVP + tasks.md 2-B。`useCompareStore`（`src/compare-store/`・zustand+persist・`useCartStore` と同型・バリアント ID のみ保持・上限 4 件・冪等・`isComparing`）。`/compare`（`src/app/(store)/compare/page.tsx`・client wrapper・`force-dynamic` 不要）+ `CompareGrid`（`src/components/store/compare/`・既存 `getProductsByIds` 再利用・`useEffect` キャンセルフラグ・`items.length===0` で `getProductsByIds` を呼ばず空状態 = 空配列 throw 回避）。商品カード（`product-card.tsx`）へ Add-to-compare トグルボタン（GitCompare・トグル＋トースト・上限 4 超過は `toast.error`・ストアは void のままハンドラ側で分岐）。新規 server action・schema 変更なし。`useCompareStore.test.ts` +8（T-CMP1〜4 + isComparing）+ `compare-grid.test.tsx` +2（T-CMP5/T-CMP6・`getProductsByIds` mock）。テスト総数 1591 → **1601 passed**、テストファイル 170 → **172**、スイート 161 → **163** (commits `23f7332`–`bdf3356`). |
| 2026-06-22 | **SonarCloud Quality Gate 修復（PR #147 compare 機能）**: New Code Coverage 63.6%（< 80%）を解消。`product-card.tsx` はテストファイルが無く新規 compare ロジック（+42 行）が 0% / `compare-grid.tsx` は正常系のみで 79.6%。`product-card.test.tsx` 新規 +8（`handleToggleCompare` 3 分岐 [未比較→追加 / 比較済→削除 / 上限 4 で `toast.error`] + `handleAddToWishlist` 成功/失敗 catch + `rating>0 && sales>0` 条件、`e8fe553`）、`compare-grid.test.tsx` +4（loading スケルトン / 個別 remove / clear all / `getProductsByIds` reject catch、`e39a38e`）で両ファイル Lines **100%**。あわせて `product-card.tsx` wishlist catch の `error: any` を `unknown` + `instanceof Error` 型ガードへ修正（no-any 規約準拠、`22bb3f3`）。テスト総数 1601 → **1613 passed**、テストファイル 172 → **173**、スイート 163 → **164** (commits `e8fe553`–`22bb3f3`). |
| 2026-06-22 | **Offers 機能実装（`docs/design/offers/`）**: プラットフォーム全体のオファー landing `/offers`（`src/app/(store)/offers/page.tsx`・`force-dynamic`・既存 `getAllOfferTags` 再利用・商品グリッドを持たず各タグを `/browse?offer=<url>` へ委譲＝DRY）+ user-menu「Discounts & Offers」を `""`→`/offers` に配線（1 行・回帰テスト保護）。新規 server action・schema 変更なし。新規スイート `offers/page.test.tsx` +2（T-OF1 一覧＋`/browse?offer=<url>` リンク / T-OF2 空状態・`getAllOfferTags` mock）、`user-menu.test.tsx` に T-OF3 回帰 +1（→`/offers`、旧 `""` を弾く）。テスト総数 1617 → **1620 passed**、テストファイル 173 → **174**、スイート 164 → **165** (commits `fd11326`–`d2cd4e4`). |
| 2026-06-22 | **Storefront static pages 実装（`docs/design/storefront-static-pages/`）**: 共有プレゼンテーション部品 `StaticPageLayout`（`src/components/store/static/static-page-layout.tsx`・見出し/リード/`StaticSection[]`/任意目次を受け取り `body` を `\n\n` 分割で plain text `<p>` 描画＝`dangerouslySetInnerHTML` 不使用で XSS 回避・`slugify` でアンカー生成）+ 型付きコンテンツ定数 5 本（`content/{about,legal,faqs,product-support,customer-service}.ts`）+ 公開ページ `/about`・`/legal`（`withToc` 目次付き）・`/faqs`・`/product-support`・`/customer-service`（ポータル・`SUPPORT_LINKS` から 5 導線カード）+ `/faq`→`/faqs` の 308 `permanentRedirect`。DB 非依存のため `force-dynamic` 不付与で SSG 維持（build で 6 ルート全て `○ Static`）。user-menu「Help Center」`""`→`/customer-service`、「Legal & Privacy」`""`→`/legal` を配線（2 行・回帰テスト保護・他空文字リンクは別設計書担当のため非変更）。新規 server action・schema 変更なし。新規スイート `static-page-layout.test.tsx` +5（title/h2/段落分割/lead/withToc 目次）・`about/page.test.tsx` +1（`<h1>About`）・`customer-service/page.test.tsx` +1（5 導線 href）、`user-menu.test.tsx` に +2 回帰（Help Center / Legal & Privacy）。テスト総数 1620 → **1629 passed**、テストファイル 174 → **177**、スイート 165 → **168** (commits `fa1f56a`–`227ca0e`). |
| 2026-06-22 | **Support forms 実装（`docs/design/support-forms/`）**: 4 種サポートフォーム（問い合わせ/返品/紛争/問題報告）を単一 `SupportTicket` モデル（`SupportTicketCategory` enum で識別・`orderId`/`userId` nullable・`status String @default("OPEN")`・`onDelete: SetNull`）+ additive migration（`add_support_ticket`・非破壊）+ ERD 再生成（rule 03・Support Domain ページ追加）で実装。公開 server action `createSupportTicket`（`src/queries/support.ts`・認可ガードなし=ゲスト可・ログイン時のみ `currentUser()` で `userId` 付与・取得失敗はログして縮退・PII 本文は非ログ）+ `SupportTicketSchema`（Zod・`superRefine` で RETURN_REQUEST/DISPUTE のみ `orderId` 必須・空欄は `preprocess` で `undefined` 正規化）。共有 client フォーム `support-form.tsx`（RHF+zodResolver・`useRef` 二重送信防止）+ 公開ページ `/contact`・`/returns-exchange`（`content/returns.ts` 静的ポリシー要約同梱）・`/dispute`・`/report-problem`（`force-dynamic` 不付与で 4 ルート全て `○ Static`）。user-menu 3 リンク配線（Return & Refund→`/returns-exchange`・Order Dispute→`/dispute`・Report a Problem→`/report-problem`・Discounts & Offers 行は不変）。新規スイート `support.test.ts` +4（T-SF1〜T-SF4）・`support-form.test.tsx` +2（T-SF5/T-SF6）、`user-menu.test.tsx` に +3 回帰（T-SF7）。テスト総数 1629 → **1638 passed**、テストファイル 177 → **179**、スイート 168 → **170** (commits `e3c58aa`–`3608a3b`). |
| 2026-06-22 | **SonarCloud Quality Gate 修復（PR #149 support-forms）**: New Code Coverage 77.5%（< 80%・ゲート Failed の唯一条件）を解消し New Issues 4 件（CODE_SMELL）をクリア。Issue 修正: `support-form.tsx`/`static-page-layout.tsx` の props を `Readonly<>` 化（S6759×2）・`<p role="status">`→`<output>`（S6819・暗黙 role 維持）・段落 `key={i}`→`key={para}`（S6479）（`1508fc8`）。カバレッジ補完: `support.test.ts` +5（`currentUser`/`db.create` の throw を Error/非 Error 両分岐＝両 catch をカバー）、`support-form.test.tsx` +4（送信成功 `<output>` 表示 / 失敗 alert / `requireOrderId` 欄 / `submitLabel` 上書き）、新規スイート `content/content.test.ts` +3（0% だった `faqs`/`legal`/`product-support`/`returns` 定数の import+shape 検証）で本番 6 ファイルが新規コード ~100%。テスト総数 1638 → **1650 passed**、テストファイル 179 → **180**、スイート 170 → **171** (commits `1508fc8`–`63c3755`). |
| 2026-06-25 | **共通レイアウト統一（全店舗ページに Header/Footer）**: ヘッダー/フッターを各 `page.tsx` で個別描画していたため `/compare` `/returns-exchange` `/product-support` 等で未表示だった問題を、`(store)/layout.tsx` での共通描画（`StoreHeader` + `Footer`）に集約して解消。`StoreHeader` が `cookies()` を読むため `(store)` サブツリーは request 時の動的レンダリングとなり、Footer の DB 取得もビルド時静的化を試みず CI build が安定。全画面ページ（`order/[orderId]`・`seller/apply`）は共通 chrome を継承しないよう `(fullscreen)` ルートグループへ `git mv` で退避（URL 不変）。各ページ/`profile/layout.tsx` の重複描画と未使用 import を除去（ホーム/商品/店舗の `CategoriesHeader` は維持）。E2E `tests/e2e/layout-chrome.spec.ts` 新規 +6（chrome 各1つ / ホーム二重ヘッダー無し / `seller/apply` chrome 無し・Jest 集計外）+ header/footer ルートへ `data-testid` 付与。Playwright E2E（main）8 → **9 スペック**。Jest 集計は不変（**1650 passed** / 171 スイート） (commits `54d8c07`–`7fdc6ba`). |
| 2026-06-25 | **共通レイアウト仕上げ（sticky footer + 認証ページ chrome）**: フッターが宙に浮く問題を `(store)/layout.tsx` の sticky footer 化（`flex min-h-screen flex-col` + children `flex-1`）で解消（`1f3ef92`）。`(auth)/layout.tsx` を新設し sign-in/sign-up に共通 `StoreHeader`/`Footer` を供給（Clerk フォームがフッターを画面外へ押し出さないよう各ページの `h-screen`→`flex-1` 中央寄せに変更、`cc69850`）。`layout-chrome.spec.ts` に認証ページ chrome 検証を +1（6→7 テスト・spec ファイル数は 9 のまま）。Jest 集計は不変（**1650 passed** / 171 スイート） (commits `1f3ef92`–`cc69850`). |
| 2026-06-26 | **Track order 機能実装（`docs/design/track-order/`）**: 公開の注文追跡ページ `/track-order`（footer「Track your Order」配線済だがページ未実装だった空白を解消）。新規公開 server action `trackOrder`（`src/queries/order.ts`・認可ガードなし=ゲスト/未ログイン可・`where:{ id: orderId }` のみで取得し email 照合はアプリ層 `toLowerCase()` 比較＝IDOR 3 階層 [スロー / where 構造 / 副作用なし]・不一致と不存在を同一 `null` で列挙防止・戻り値から `user`(email) 除去・PII 非ログ）+ `TrackOrderSchema`（Zod・orderId `min(1)`/email）。client フォーム `track-order-form.tsx`（RHF+zodResolver・`useRef` 二重送信防止・不一致/不存在は単一メッセージ）+ 結果表示 `track-order-result.tsx`（既存共有タグ `OrderStatusTag`/`PaymentStatusTag`/`ProductStatusTag` を流用＝DRY・重い `order-page/*` には依存しない）。`force-dynamic` 不付与（DB 読取は action 内）。既存スイート `order.test.ts` に +6（T-TO1〜T-TO6）・新規スイート `tests/component/store/track-order-form.test.tsx` +2（T-TO7/T-TO8）。テスト総数 1651 → **1659 passed**、テストファイル 182 → **183**（track-order で +1。180→181 と記録していたが、E2E メイン `messages.spec.ts`/`layout-chrome.spec.ts` 2 本が未計上だったため基準を 182 に補正）、スイート 171 → **172** (commits `b2a30e5`–`b57bd40`). |
| 2026-06-26〜27 | **Track order テスト補強（QA_HANDOFF 未同期分の追補記録）**: `order.test.ts` +2（trackOrder エラー経路・status タグ検証、`1f1114e`）+ 失敗ログの PII 非含有検証 T-TO11 +1（`83fe664`）。あわせて `track-order-form.test.tsx` を `tests/component/store/` → `src/components/store/track-order/` へ co-located 移動（`865dda3`、スイート数不変）。テスト総数 1659 → **1662 passed** / 1662 → 1665 total。※この +3 は 2026-07-10 の Round 4 監査ベースライン実測で発見された統計ドリフトを遡って記録したもの。 |
| 2026-07-10 | **improve Round 4（`tests` フォーカス監査）完了**: `bun run test -- --coverage` の lcov 実測（Statements 65.19% / Branches 44.89%）+ ソース/テスト突合で「危険な未テスト箇所」を監査。新規所見 TESTS-11〜14 + Round 1 raw TESTS-01〜10 の reconcile を [`plans/audit/findings-12-test-coverage.md`](../../plans/audit/findings-12-test-coverage.md) に記録し、Sonnet 実行可能な自己完結プラン **plans/026〜030** を起票（paypal エラー分岐 / placeOrder オーバーセル+PLATFORM 端数統合 / country.ts 新設 / profile.ts catch 分岐 / money-path コンポーネント 6 本）。テストコードは未変更（プラン化のみ）。QA_HANDOFF の統計セル履歴長文を本 §7 へのポインタに整理（重複解消）。§3 に R4 台帳を起票。 |
