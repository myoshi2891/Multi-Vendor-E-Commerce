# PROGRESS.md

> **運用ルール**: 進捗・一時的な決定を記録する。gitで追えるもの（コミット一覧・変更行数）は書かない。
> 書くべき情報: なぜその決定をしたか／今どこにいるか／次に何をするか。

---

## 現在の状態（2026-09-03 時点）

### テスト統計
| 指標 | 値 |
|------|----|
| Jestユニットテスト | **2121 passed / 2124 total（3 skipped tests）/ 194 スイート（193 passed + 1 skipped suite）** — 2026-09-03 実測（plan 068 Step 1–9 で **+49 / スイート不変**: ツリー編集の不変条件・リーフ強制・`parentId`/`sortOrder` スキーマ・slug 正準化・admin 表のツリー表示）。以下は 2072 時点までの記録: 2026-09-02 実測（コードレビュー指摘対応 第 2 弾で **+1 / スイート不変**: `src/lib/category-tree.test.ts` に `resolveCategoryNode` の DB 障害再送出ガードを追加。SSOT は [`QA_HANDOFF.md`](./testing/QA_HANDOFF.md)）。以下は 2071 時点までの記録: 2026-09-02 実測（コードレビュー指摘対応で **+6 / スイート +1**: `tests/component/store/category-link.test.tsx` 新設 +3、`browse/page.test.tsx` +2、`parse-models.test.ts` +1。SSOT は `docs/testing/QA_HANDOFF.md`）。以下は 2062 時点までの記録: 2026-09-02 実測（plan 067 Phase B で `src/lib/category-tree.test.ts` 新設 **+1 スイート**。直前は 2032 passed / 192 スイート）。以下は 2032 時点までの記録: 2026-09-02 実測（`scripts/erd/parse-models.test.ts` 新設で **+4 / スイート +1**。直前は 2028 passed / 2031 total / 191 スイート）。以下は 2028 時点までの記録: 2026-08-31 実測（レビュー指摘対応で **+1 / スイート不変** —— `scan-tests.ts` の `EACH_PATTERN` が `schema.test.each(` のメンバー呼び出しをテーブル展開として計上していた件の回帰ガード。直前は 2027 passed / 2030 total）。以下は 2027 時点までの記録: 2026-08-31 実測（レビュー指摘対応で **+1 / スイート不変** —— `scan-tests.ts` の `BLOCK_PATTERN` が `.test(` のメンバー呼び出しをテスト宣言として計上していた件の回帰ガード。直前は 2026 passed / 2029 total）。以下は 2026 時点までの記録: 2026-08-31 実測（レビュー指摘対応で **+1 / スイート不変** —— `upsertCategory` のツリー管理列を実行時に落とすことの回帰ガード。直前は 2025 passed / 2028 total）。以下は 2025 時点までの記録: 2026-08-31 実測（plan 066 でシードの宣言データを単一の木へ統合したのに伴う **−1 / スイート不変**。`SEED_SUB_CATEGORIES` 前提のテストを木の不変条件テストへ置き換えた）。直前は 2026 passed / 2029 total・2026-08-25 実測（コードレビュー指摘の修正に伴う回帰検知点。うち 1 件は `browse/page.tsx` の `normalizePriceParam` が空白のみの `?maxPrice=%20` を `Number("   ") === 0` 経由で「上限 0 の空レンジ」として通していた不具合の回帰ガード。**本行は 2020 のまま据え置かれていたが、実測との差 6 はこの間のレビュー対応分の未同期であり、本更新で是正した**）。直前: **2020 passed / 2023 total（3 skipped tests）/ 191 スイート** — 2026-08-24 実測（コードレビュー指摘の修正に伴う回帰検知点 **+3 / スイート不変**）。直前: **2017 passed / 2020 total / 191 スイート** — 2026-08-23 実測（plan 049 の本体修正に伴う検知点 **+4 / スイート +1**）。直前: **2013 passed / 2016 total（3 skipped tests）/ 190 スイート（189 passed + 1 skipped suite）** — 2026-08-23 実測（plan 030 で money-path クライアント **6 スイート・+26 テスト**を新設）。直前: **1987 passed / 1990 total / 184 スイート** — 2026-08-13 実測（レビュー指摘対応で **+3 / スイート不変**。`review.test.ts` に集計の原子性 2 本〔単一 `$transaction` への配線 / Product 行ロックが書き込みより手前〕、`shipping-utils.test.ts` に `Prisma.Decimal` 移行の丸め回帰 1 本）。以下は 1984 到達時点までの記録: 2026-08-13 実測（plan 010 で `src/lib/shipping-utils.test.ts` を新設し **+8 / スイート +1**。配送料計算 SSOT `computeShippingTotal` の直接ユニットテスト）。**⚠️ 1915 → 1984 の差 69 のうち本プランの成果は 8 件だけで、残る 61 テスト・3 スイートは本行の未同期分の是正である** —— SSOT の [`QA_HANDOFF.md`](./testing/QA_HANDOFF.md) は 2026-08-12 時点で既に 1976 / 183 スイートを記載しており、本行だけが 2026-08-10 の値のまま据え置かれていた（内訳は URL 数値パラメータ正規化 +36 / スイート +1、`browse-pagination.test.tsx` +6 / スイート +1、Prisma 遅延初期化 +13、`getProducts` 未マッチ URL フィルタ是正 +5、レビュー指摘対応 +1）。以下は 1915 到達時点までの記録: 2026-08-10 実測（CodeRabbit レビュー対応で `categories-menu.test.tsx` に +6 / `product-sort.test.tsx` に +1・スイート不変。**差 20 のうち 13 テスト・2 スイートは先行コミット `879763a0` の未同期分**を併せて是正したもの）。直前は 1895 passed / 1898 total / 178 スイート・2026-08-09 実測（CodeRabbit 指摘対応で `scripts/coverage-dashboard/render-html.test.ts` に +1・スイート不変）。直前は 1894 passed / 1897 total・2026-08-09 実測（plan 064 / TESTS-21 の本体修正で `src/queries/user.test.ts` に +3・スイート不変）。直前は 1891 passed / 1894 total・2026-08-08 実測（SonarCloud PR #169 の New Code カバレッジ 70% を受け `src/app/api/webhooks/stripe/route.test.ts` に非 USD 拒否ケースを追加し +1・スイート不変。直前は 1890 passed / 1893 total・2026-08-04 実測: plan 026 で `paypal.test.ts` を 40→56 に拡張し +16・スイート不変。同日 plan 029 で `profile.test.ts` を 34→63 に拡張し +29・スイート不変。同日 plan 028 で `src/queries/country.test.ts` を新設し +4 テスト / +1 スイート。`src/queries/` 20 モジュール中で唯一テストが無かった country.ts を閉じた）。直前: 2026-08-03 実測で 1841 / 1844・177 スイート（12 件のドリフトを訂正）。その前: 2026-08-01 実測（CodeRabbit レビュー対応 第 12 弾の回帰 +3・スイート数不変 — 静的走査が文字列リテラルの中身をコードと取り違えていた件。ダッシュボードは `scan-tests.test.ts` 81→24 / `size.test.ts` 9→8 に是正。直前の第 11 弾で +7、その前の SonarCloud 重複解消リファクタで +16・スイート +1）。増減の経緯は [`COVERAGE_REPORT.md §7 履歴`](./testing/COVERAGE_REPORT.md#7-履歴)、統計の SSOT は [`QA_HANDOFF.md`](./testing/QA_HANDOFF.md) |
| Jest Integration テスト | **135テスト / 16スイート** — 2026-09-03 実測 135/135 pass（plan 068 で `tests/integration/category-tree-write.test.ts` を新設し **+4 / スイート +1**）。以下は 131 時点までの記録: 2026-09-02 実測 131/131 pass（レビュー指摘対応で **+2 / スイート不変**: `category-tree-resync.test.ts` に `Product.categoryNodeId` の NULL 埋め / stale 追随を追加。区間の `UPDATE "Product"` は 実行されるだけで検算されていなかった。併せて `setup/migration-sql.ts` の `runStatements` を `$transaction` で包んだ。SSOT は [`QA_HANDOFF.md`](./testing/QA_HANDOFF.md)）。以下は 129 時点までの記録: 129/129 pass（plan 067 の残作業で `product-browse.test.ts` に **+4** / `product-update.test.ts` に **+2**・スイート不変。直前は 123 / 15 スイート — plan 067 で `category-tree-resync.test.ts` を新設し **+6 / スイート +1**。SSOT は [`QA_HANDOFF.md`](./testing/QA_HANDOFF.md)）。以下は 117 時点までの記録: **117テスト / 14スイート**（… + `product-browse` **16** + `category-tree-migration` **9**）— 2026-08-31 実測 117/117 pass（plan 066 / V-3・V-4 で `category-tree-migration.test.ts` を新設し **+9 / スイート +1**）。直前は 108 テスト / 13 スイート・2026-08-24 実測（レビュー指摘対応で `store-status.test.ts` に並行遷移シナリオ **+1** / スイート不変。`updateStoreStatus` の昇格判定を tx 内 `FOR UPDATE` へ移した本体修正の回帰ガード）。直前 107（plan 039 で `product-browse.test.ts` を新設し **+16 / スイート +1**。R6 ラウンドが閉じ切った）。直前: **91テスト / 12スイート**（… + `store-status` **8** + `product-update` **5**）— 2026-08-23 実測 91/91 pass（plan 038 で `product-update.test.ts` を新設し **+5 / スイート +1**）。直前: **86テスト / 11スイート**（`cart-checkout` 11 + `order-placement` **9** + `order-lifecycle` **8** + `webhook-payment` **12** + `search-products` **9** + `product-deletion` **4** + `shipping-address-default` **6** + `user-deletion-webhook` **7** + `coupon-code-uniqueness` **5** + `review-aggregation` **7** + `store-status` **8**）— 2026-08-23 実測 86/86 pass（plan 035 で `store-status.test.ts` を新設し **+8 / スイート +1**。R5 ラウンドが閉じ切った）。直前: **78テスト / 10スイート**（`cart-checkout` 11 + `order-placement` **9** + `order-lifecycle` **8** + `webhook-payment` **12** + `search-products` **9** + `product-deletion` **4** + `shipping-address-default` **6** + `user-deletion-webhook` **7** + `coupon-code-uniqueness` **5** + `review-aggregation` **7**）— 2026-08-13 実測 78/78 pass（レビュー指摘対応で `review-aggregation.test.ts` に +2 / スイート不変。`upsertReview` の集計を単一 `$transaction` + Product 行 `SELECT … FOR UPDATE` へ直列化した本体修正に伴う並行シナリオ。**多ユーザー輻輳ケースは修正前の実装でも緑**なので、lost update の決定論的ガードは `review.test.ts` 側の配線テスト）。直前は 76テスト / 10スイート・同日実測 76/76 pass（plan 034 / TESTS-18 で `review-aggregation.test.ts` を新設し +5 / スイート +1。`upsertReview` の評価集計・User フォールバック upsert・同一ユーザー再投稿の update 分岐を実 DB で固定。**集計は非トランザクションなので並行投稿の lost update は未検証**）。直前は 71テスト / 9スイート・同日実測 71/71 pass（plan 041 / TESTS-25 で `coupon-code-uniqueness.test.ts` を新設し +5 / スイート +1。`Coupon.code` のグローバル unique 制約の実発火・既存行の無傷・行数不変を固定。**これで R7 ラウンドが閉じ切った**）。直前は 66テスト / 8スイート・2026-08-09 実測 66/66 pass（plans 033 / 036 / 037 / 040 の新設スイートと、plan 064 で `shipping-address-default` が 4 → 6）。直前は 40テスト / 4スイート・2026-08-08 計上（`a4d01b27` が `webhook-payment.test.ts` に非 USD 拒否シナリオ S8 を追加し 39→40・スイート不変。最後のフルラン実測は 2026-08-04 の 39/39 pass）。直前: 2026-08-04 実測 39/39 pass（plan 032 で `webhook-payment.test.ts` を新設し +11 / スイート +1。Stripe / PayPal webhook の冪等性・原子性を実 DB で検証）。直前: 28/28 pass（plan 031 で `order-lifecycle.test.ts` を新設し +8 / スイート +1。キャンセル・返金の親子連動と在庫復元、二重キャンセルの冪等性、group 単位キャンセルの親集約、両 admin 関数の認可ガード）。直前: 20 テスト / 2 スイート（plan 027 で order-placement に在庫の実減算量 / オーバーセルロールバック / PLATFORM クーポン端数吸収の 3 シナリオを追加。17→20・スイート不変）。直前: 17 テスト（2026-05-31 placeOrder 統合テスト +6 / +1 スイート）。`bun run test:integration`（testcontainers）で実行、`bun run test` 集計外。2026-07-17: ダッシュボード集計の 14 との乖離を解消（`scan-tests.ts` の `it.each` 展開対応で 14→17） |
| Jestスナップショット | 127（`tests/component/ui/` — B1 MVP 40 + B1+ Sprint 1 +26 + B1+ Sprint 2 +27 + B1+ Sprint 3 +19 + B1+ Sprint 4 +15） |
| 型エラー | 0件 |
| Playwright E2E | **66 tests/browser / 30 files（3ブラウザ計 198）** — 2026-09-03 実測（`bunx playwright test --list` が `Total: 198 tests in 30 files`。plan 068 の `admin-category-tree.spec.ts` で +1 test/browser・+1 file。本 spec は chromium で dev / 本番ビルドいずれの起動モードでも緑〔`9034f300`〕。**firefox / webkit は未実行**）。以下は 65 tests 時点までの記録: 2026-09-02 実測（`bunx playwright test --list` が `Total: 195 tests in 29 files`。plan 067 V-2 で `search-filter.spec.ts` に **+1 test/browser** —— 旧 `?subCategory=` が 308 で正準 `?category=` へ着地することの検証）。以下は 64 時点までの記録: **64 tests/browser / 29 files（3ブラウザ計 192）** — 2026-08-31 実測（`bunx playwright test --list`）。Visual は cart / checkout / browse / product の 4 スペック（`test.skip` で chromium 限定。列挙数には 3 ブラウザ分が載る）。直前は 63 tests/browser / 28 files（計 189）・2026-08-23 実測。Chromium / Firefox / WebKit |

### 技術スタック（現行）
| パッケージ | バージョン |
|-----------|-----------|
| Next.js | ~16.2.12（App Router） |
| React | 19 |
| @clerk/nextjs | v7 |
| ESLint | 9（flat config） |
| Swiper | 12.x |

### データ補正記録

| 日付 | 対象 | before | after | 記録 |
|------|------|--------|-------|------|
| 2026-08-09 | `PaymentDetails.amount`（Stripe セント→ドル・CORRECTNESS-05 残件） | 補正対象 **0 件**（`PaymentDetails` 総行数 0 / `Order` 18 行） | 0 件（no-op で COMMIT） | [plan 063](../plans/063-backfill-stripe-payment-amount.md) 実行記録。検証 `still_wrong=0` / `null_ratio=0` / `stale_paypal_currency=0`。手順とゲート設計は [`scripts/backfill/README.md`](../scripts/backfill/README.md) |

---

## フェーズ別サマリ（経緯）

### 2025-12〜2026-02: テスト基盤・DB移行
- Playwright + Jest 導入。E2E seed（tsx ランナー）整備
- MySQL → PostgreSQL (Neon) + Prisma Accelerate に移行
  - **理由**: Neon のサーバーレス特性 + Prisma Accelerate のコネクションプーリングでコールドスタートを解消

### 2026-03-01: ユニットテスト大量追加・バグ修正
- 536テスト → 543テストへ。`src/config/` にテスト共通インフラを整備
- 修正した実装バグ4件（IDOR脆弱性・Svix evt.data 二重パース・countryId 比較・エラーメッセージ）
  - **IDOR修正の背景**: `review.ts` の upsert がオーナーチェックなしで任意の review を上書きできた

### 2026-03-14〜16: AIスキル・ラグジュアリーシード・Decimal移行
- `.claude/skills/` に5スキル追加（spec-sync-check, safe-migration, server-action-scaffold, test-complete, feature-plan）
- `prisma/seed/` に5フェーズシーダー構築（`bun run seed:luxury`）
- 全金額フィールドを `Decimal(12,2)` に統一
  - **理由**: Float の浮動小数点誤差が注文金額計算に影響するリスクを排除

### 2026-03-23: ドキュメント管理戦略確立
- `.claude/steering/documentation-guide.md` を新規作成（ADRガイドライン・Decision Tree）
- plans/archive ディレクトリを削除（有用な情報は正式ドキュメントに統合済み）

### 2026-03-28: Next.js 16 マイグレーション完了
- Next.js 14→16、React 18→19、Clerk v6→v7、ESLint 8→9 を一括アップグレード
- **主な Breaking Changes 対応**:
  - `params`/`cookies`/`headers` が Promise 化 → `await` / `use()` フック対応
  - Clerk v7 で `auth()` / `currentUser()` が async 化
  - ESLint 9 flat config（`eslint.config.mjs`）への移行
  - React 19 の `useRef<T>(null)` → `RefObject<T | null>` に module augmentation で対応
- 881テスト / 54スイートで全パス確認後マージ

### 2026-05-21: Phase 1 基盤テスト検証（TEST_IMPLEMENTATION_PLAN.md P0対応）
- `use-mobile`, `useFromStore`, `middleware`, `modal-provider` の4スイートに優先度ラベルを付与
- プレエキシスティング型エラー2件を修正（`quantity-selector.test.tsx`・`product.test.ts`）
- 945テスト / 60スイート / 型エラー 0件に到達

### 2026-05-21: A1 認可テストギャップ補完（COVERAGE_REPORT.md 高優先度）
- 14 ファイルの認可テスト実態を `docs/testing/SECURITY_GAP_REPORT.md` に記録
- `review.test.ts` に IDOR レグレッションテスト追加（`findFirst.where.userId` を明示検証）
- `paypal.test.ts` / `stripe.test.ts` に `it.skip` で IDOR スケルトンテスト追加（実装側の `userId` フィルタ未実装を documenting）
- **次アクション**: 別 PR で `paypal.ts` / `stripe.ts` の `db.order.findUnique` に `userId` フィルタを追加し、`it.skip` を有効化

### 2026-05-22: OI-5 E2E シード冪等性 CI 検証
- `ci.yml` に `seed-idempotency` ジョブを追加（常時実行）
- PostgreSQL 16 service container 起動 → `prisma migrate deploy` → `seed:e2e` × 2回
- `psql` で User/Product/ProductVariant の行数を取得し `diff` でアサート
- シードは既に `upsert` ベースで冪等だったが、CI 環境での実証が初めて
- **完了**: 優先 Open Issues (OI-2 / OI-3 / OI-4 / OI-4a / OI-5) 全て解消

### 2026-05-22: OI-3 認証必須ページの a11y spec 追加
- `tests/e2e/helpers/auth.ts` を新規作成。`createCustomerSession()` で Clerk テストモードユーザーを動的作成・サインイン・クリーンアップ
- `tests/e2e/a11y/checkout.spec.ts` / `profile.spec.ts` を追加（WCAG 2.1 AA、chromium 限定）
- `CLERK_SECRET_KEY` 未設定時は `test.skip` で自動スキップ（CI 安全）
- `tests/e2e/seed/constants.ts` に `customer` ベース定義を追加（seller と並列）
- `tests/e2e/a11y/README.md` を Phase 2 認証ヘルパー実装パターンに更新
- **次アクション**: OI-5（E2E シード冪等性 CI 検証）

### 2026-05-22: OI-4a Visual baseline 生成ワークフロー追加
- `ci.yml` に `workflow_dispatch` 起動の `visual-baselines` ジョブを追加
- PostgreSQL service container 起動 → `prisma migrate deploy` → `seed:e2e` → `playwright --update-snapshots`
- `peter-evans/create-pull-request@v6` で `chore/visual-baselines-linux` ブランチに自動 PR
- `specs/multi-vendor-ecommerce/07-testing.md §Visual Regression > CI（Linux）` を更新
- **次アクション**: マージ後に `gh workflow run ci.yml --ref dev` で起動 → OI-3 へ

### 2026-05-22: OI-4 GitHub Actions CI ワークフロー追加
- `.github/workflows/ci.yml` を新規作成。`lint` / `test` / `build` の3並列ジョブを `push`/`pull_request` (main, dev) で実行
- Bun セットアップは `oven-sh/setup-bun@v2` を採用、依存は `bun install --frozen-lockfile` で固定
- Clerk / Stripe / Prisma 等のモジュールロード時エラーを避けるため、CI 専用スタブ値を `env:` でグローバル指定（実キーは E2E/Visual ジョブで別途設定）
- `concurrency` で同一 ref の重複実行をキャンセル
- **次アクション**: OI-4a（Linux Visual baseline 生成ワークフロー）

### 2026-05-22: OI-2 マルチバリアントカートテスト追加
- `tests/e2e/seed/constants.ts` の `variant` 系を `variants[]` 配列化し、第2バリアント（`e2e-variant-2`、$109、White）を追加
- 既存テスト互換のため `seed.variant`/`seed.size`/`seed.variantImage`/`seed.color` は `variants[0]` の別名として残置
- `tests/e2e/seed/seed-e2e.ts` でバリアント生成をループ化（`deleteMany` を各バリアントスコープに維持し冪等性を保つ）
- `tests/e2e/purchase-flow.spec.ts` に「複数バリアントをカートに追加すると別行として表示される」テストを追加（8/8 テスト）
- **次アクション**: OI-4（CI workflow）に着手

### 2026-05-21: A2/A3 Visual Regression と a11y MVP（COVERAGE_REPORT.md 高優先度）
- `tests/e2e/visual/` に cart/checkout の Visual Regression spec を追加（chromium 限定）
- `playwright.config.ts` に `reducedMotion: 'reduce'` / `locale: 'en-US'` / `timezoneId: 'UTC'` を追加してスナップショット安定化
- `tests/e2e/a11y/` に `/sign-in` と `/seller/apply` Step 1 の WCAG 2.1 AA スキャンを追加（`@axe-core/playwright`）
- **次アクション**: Visual Regression の baseline をローカル生成してコミット、`/checkout` の a11y/Visual は Clerk テストセッションヘルパー整備後の Phase 2

### 2026-05-23: CI Action SHA pin 修正・タグコメント運用化
- `oven-sh/setup-bun` の pin SHA が無効（"unable to find version" エラー）で lint/test/build/seed-idempotency/visual-baselines の全ジョブが起動不能になっていた
  - 原因: pinning 時のタイポ。先頭 7 文字 `0c5077e` のみ一致し、以降が誤値だった（短 prefix だけ一致する別 SHA の貼り間違いは SHA pin で起こりやすい事故）
  - 修正: `gh api repos/oven-sh/setup-bun/git/refs/tags/v2.2.0` で正しい SHA を再取得して 5 箇所一括更新
- 再発防止として、全 SHA pin（`actions/checkout` / `peter-evans/create-pull-request` / postgres image / `oven-sh/setup-bun`）に `# <version>` 形式のタグコメントを併記する運用に変更
  - **理由**: 40 文字 SHA は人間が検証不能。タグコメントを併記すれば「どのリリースに pin しているか」を即座に把握でき、誤 SHA の混入をレビューで早期検知できる。Dependabot の bump 提案も読みやすくなる
- ルール化:
  - `.claude/rules/01-engineering-standards.md` に "CI / Supply Chain" セクションを新設
  - `specs/multi-vendor-ecommerce/06-quality.md` の Security に Supply chain hardening を明文化
- **次アクション**: OI-4 系の追加 CI 拡張（E2E ジョブ追加等）でも本 pin 運用に従う

### 2026-05-24: 認可ガード統合とCSRF防御方針の策定
- **CSRF防御方針の決定（ADR 001）**:
  - Next.js 16 Server Actions の Origin/Host 検証と Clerk の SameSite=Lax Cookie に依存し、明示的なトークン実装を導入しない方針を決定。`docs/architecture/decisions/001-csrf-policy.md` を作成。
  - `specs/multi-vendor-ecommerce/06-quality.md` および `.claude/steering/tech.md` に本方針と規約を追記。
- **共通認可ヘルパー導入 (`src/lib/auth-guards.ts`)**:
  - `requireUser` / `requireAdmin` / `requireSeller` / `requireStoreOwner` を実装し、15件の単体テストをパス（100%グリーン）。
  - エラーメッセージを統一（未認証: "Unauthenticated.", ロール不一致: "Only ...", 所有権不一致: "Forbidden: store not owned by current user."）。
- **認可ガード置換の適用**:
  - `category.ts` / `subCategory.ts` / `offer-tag.ts` の ADMIN インラインチェックを `requireAdmin()` に置換。
  - `coupon.ts` の SELLER 所有権チェックを `requireStoreOwner()` に置換。
  - `product.ts` の `upsertProduct` / `deleteProduct` / その他 SELLER アクションを `requireStoreOwner` / `requireSeller` に置換。
  - `store.ts` の `updateStoreDefaultShippingDetails` / `getStoreShippingRates` / `upsertShippingRate` を `requireStoreOwner` に置換し、所有権チェックと店舗取得の `findUnique` 二重呼び出しを統合。`store.test.ts` のエラーメッセージ期待値も新仕様に同期。
- **IDOR テスト 3 階層化（2026-05-24 追加）**:
  - 既存テストの「(a) スロー検証」に加え、「(b) `where: { url, userId }` 構造検証」「(c) ガード失敗時の副作用なし検証」を 8 件追加。
  - 内訳: `product.test.ts` +4 (deleteProduct IDOR 描述新設 / upsertProduct 副作用検証)、`coupon.test.ts` +1 (upsertCoupon IDOR describe 新設)、`store.test.ts` +3 (updateStoreDefaultShippingDetails / getStoreShippingRates / upsertShippingRate 補強)。
  - テスト総数: 1008 → 1016。`ae66fac`。
- **今後の残タスク**:
  - ~~`getStoreOrders` (`src/queries/store.ts:361`) は `requireStoreOwner` 未統合（自前インライン比較が残存）。別タスクで判断。~~ → 2026-05-26 にクローズ（下記「2026-05-26」エントリ参照）。
  - `SECURITY_GAP_REPORT.md` の更新（A4 セクションの記録）。

### 2026-05-30: C1 完了 — Lighthouse CI でパフォーマンス予算化
- **背景**: C シリーズ（パフォーマンス退行検知）の 1 件目。SaaS ロードマップ範囲の別ストリーム項目で、実着手判断に至り着手。
- **実装**:
  - `.github/workflows/lhci.yml`（新規）: `pull_request [main, dev]` + `workflow_dispatch`。`ci.yml` の `seed-idempotency` を土台に Postgres service → `migrate deploy` → `seed:e2e` → `build` → `bunx lhci autorun`。
  - `.lighthouserc.json`（新規）: `/browse` を 3 回計測（`preset: desktop`）。`categories:performance` / LCP / CLS / TBT を **warn-only** で評価し、`temporary-public-storage` にアップロード。
  - 新規 devDependency: `@lhci/cli@0.15.1`。
- **設計判断（Clerk 回避は検証で確定）**:
  - 当初の `pk_test` ダミー key 案は、`clerkMiddleware` が dev インスタンスで「dev browser cookie 不在」の handshake リダイレクト（偽 FAPI ドメイン）を発行し collect が 400 で失敗（実 CI ログで確認）。さらに middleware 全バイパス案も、`/` の描画ツリー（`user-menu.tsx` / `user.tsx`）が `currentUser()` を呼ぶため不可。
  - 対応: **本番インスタンス形式のダミー `pk_live` キー**（`pk_live_` + base64(`example.clerk.accounts.dev$`)、secret も `sk_live_` ダミー）。本番インスタンスは handshake を行わず、未認証リクエストは FAPI 未到達で `currentUser()` が null を返す。**ローカル `next start` で `/browse` → 200・handshake リダイレクトなしを実証**。secret 不要・自己完結を維持。
  - 第1イテレーションは warn-only でベースライン観測を優先（PR を即ブロックしない）。
- **副産物の発見（C1 と独立した既存バグ）**: ホーム（`/`）は `src/components/store/home/main/featured.tsx:13` の `useState<number>(window.innerWidth)` が SSR で `ReferenceError: window is not defined` を投げ **500**（本番 SSR でも再現する可能性）。このため lhci の URL から `/` を除外し `/browse` のみとした。featured.tsx 修正は別タスク。
- **アーカイブ作業**: `render-html.ts` の `NEXT_ACTIONS` から C1 を削除、`QA_HANDOFF.md` の C1 をアーカイブ化し C2 の依頼プロンプトを新設、`COVERAGE_REPORT.md §3 C1` を `~~完了~~` 化、`coverage-dashboard.html` を再生成。
- **次アクション**: (1) featured.tsx の SSR `window` バグ修正 → lhci URL に `/` を追加。(2) C2（Bundle Size 継続監視、`.github/workflows/bundle.yml`）。(3) 数回観測後に lhci の assertions を `warn → error` 化。

### 2026-06-16: 管理者ダッシュボード Phase 4 完了（null セーフ化先行リファクタ）

#### 概要

`docs/design/admin-dashboard/tasks.md` の **Phase 4（下位互換性確保ステップ）を完結**。Phase 5 で `Coupon.storeId` が nullable になる前に、`coupon.store` を参照する箇所を null セーフ化。振る舞いは変えず（現状 storeId は必須のため fallback は使用されない）、スキーマ変更後の安全着地を保証する。

#### 実施内容

| Task | 対象 | コミット |
|------|------|---------|
| 4-1 | `src/queries/coupon.ts:294` applyCoupon メッセージの `coupon.store.name` → `?.name ?? '全店舗'` | `04c9636` |
| 4-2 | `src/queries/user.ts:1135-1150` saveUserCart 確認 → ternary ガード済みのため変更不要 | — |
| 4-3 | `src/components/store/cards/place-order.tsx:127` + `src/app/dashboard/admin/coupons/columns.tsx:62` の `coupon.store.name` → null セーフ | `a977236` |
| 4-4 | tsc 0 errors / test 1387 passed / lint 0 errors 検証 | — |

#### テスト統計（変動なし）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1387 passed | **1387 passed**（変動なし・リファクタのみ） |
| スイート数 | 143 | 143 |
| 型エラー | 0 件 | **0 件** |

> **次の着手**: Phase 5（F3-第2段 platform-wide 発行）— `safe-migration` skill 必須・破壊的・厳格な直列。

---

### 2026-06-16: 管理者ダッシュボード Phase 3 完了（F3 クーポン横断管理）

#### 概要

`docs/design/admin-dashboard/tasks.md` の **Phase 3（F3-第1段 クーポン横断管理）を完結**。`Coupon.isActive` スキーマ追加・admin クーポン query 4 種・Zod スキーマ・admin クーポン UI + SonarCloud QG 修復（PR #138）まで含めた全タスク（3-A〜3-E）が完了。詳細は下記「SonarCloud QG 修復（PR #138）」エントリを参照。

#### 実施内容（主要コミット）

| Task | 対象 | コミット |
|------|------|---------|
| 3-A（schema） | `Coupon.isActive Boolean @default(true)` 追加・ERD 再生成 | `b4095bd` / `bc95656` |
| 3-B（isActive 再検証） | `applyCoupon` / `placeOrder` の `isActive=false` ガード | `b4095bd` / `669ad3d` |
| 3-C（admin query） | `getAllCoupons` / `upsertCouponAsAdmin`(P2002) / `deleteCouponAsAdmin` / `toggleCouponActive` | `c4693b1` Red / `982c765` Green |
| 3-D（Zod） | `AdminCouponFormSchema`（`isActive` + `storeId` 含む） | `958af7a` |
| 3-E（UI）+ QG 修復 | admin coupon pages / columns / `admin-coupon-details.tsx` / `CouponFormFields` 共有コンポーネント抽出 | `31dcf68`〜`9d12e90`（PR #138） |

#### テスト統計（更新）

| 指標 | 更新前（Phase 2 完了時） | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1302 passed | **1387 passed** |
| スイート数 | 137 | **143** |
| 型エラー | 0 件 | **0 件** |

> **次の着手**: Phase 4（null セーフ化先行）— `coupon.store?.name` 等の Phase 5 スキーマ変更前の防御リファクタ。

---

### 2026-06-16: SonarCloud Quality Gate 修復（PR #138・coupon カバレッジ + 重複解消）

#### 概要

PR #138（`dev → main`）の SonarCloud Quality Gate が 2 条件未達だった（Coverage 20.9% < 80% / Duplication 8.7% > 3%）。`admin-coupon-details.tsx` と `coupon-details.tsx` のフォームフィールド重複（96 行）を `CouponFormFields` 共有コンポーネントへ抽出し Duplication を解消。coupon.ts 残ブランチ・columns.tsx・admin-coupon-details.tsx のテストを追加し Coverage を満たした。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/components/dashboard/forms/coupon-form-fields.tsx` | code / discount / startDate / endDate フィールドを共有コンポーネントとして抽出（新規） | `a80e4be` |
| `src/queries/coupon.test.ts` | 残ブランチカバー（P2002 分岐・applyCoupon edge case）+39 テスト | `322ce41` |
| `src/app/dashboard/admin/coupons/columns.test.tsx` | columns.tsx 各 cell レンダラーのテスト新規追加（+52 行相当） | `ca2fb6c` |
| `src/components/dashboard/forms/admin-coupon-details.test.tsx` | コンポーネントテスト 10 件（レンダリング 6 + 正常系 2 + 異常系 2） | `df53785` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1348 passed | **1387 passed** |
| スイート数 | 141 | **143** |
| スナップショット | 127 | 127 |
| 型エラー | 0 件 | **0 件** |

---

### 2026-06-13: SonarCloud Quality Gate 修復（PR #134・注文テーブル重複解消 + カバレッジ）

#### 概要

PR #134（`dev → main`）の `SonarCloud Code Analysis` チェックが Quality Gate 未達で赤かった（New Code の Coverage 19.4% < 80% / Duplication 7.8% > 3%）。GitHub Actions の `SonarCloud Scan` ジョブは `continue-on-error: true` で緑だが、Sonar アプリが別経路で貼る Quality Gate ステータスは制御外のため赤くなる構造。マージはブロックされない（Able to merge）が、品質改善目的で根本修正した。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/components/dashboard/shared/order-table-cells.tsx` | admin/seller columns に重複していた `ProductImagesCell` / `ViewOrderButton` を共有コンポーネントへ抽出（新規） | `2d692cb` |
| `src/app/dashboard/admin/orders/columns.tsx` / `seller/.../orders/columns.tsx` | 共有セルを参照、private な重複 ViewOrderButton を削除。seller のコメントアウト済み旧 hooks 違反ブロックも削除 | `2d692cb` |
| `src/components/dashboard/shared/order-table-cells.test.tsx` | 共有セルのテスト（+4） | `8e29b0b` |
| `src/app/dashboard/{admin,seller/.../}/orders/columns.test.tsx` | 各 cell レンダラのテスト（+15）。両 columns Lines 100% | `99ecd48` |
| `tests/component/dashboard/order-status-select.test.tsx` | admin 分岐 + falsy レスポンスの 2 条件を追加（+2） | `0d9fba5` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1251 passed | **1272 passed** |
| スイート数 | 134 | **137** |
| 型エラー | 0 件 | **0 件** |

---

### 2026-06-13: 管理者ダッシュボード Phase 1 完了（Task 1-C / 1-D・F2 注文管理 UI）

#### 概要

`docs/design/admin-dashboard/` の **Phase 1（F2 注文管理）を完結**。1-A（query）/ 1-B（型）は完了済みだったため、残る UI 層 1-C（`OrderStatusSelect` の discriminated union 化）と 1-D（admin 注文管理ページ）を実装。これで全店舗横断の注文閲覧・group 単位のステータス変更・詳細モーダルが動作する。**Phase 単位の現在地は専用トラッカ [docs/design/admin-dashboard/PROGRESS.md](design/admin-dashboard/PROGRESS.md) を SSOT** とし、本ファイルは全体履歴として記録する。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/components/dashboard/forms/order-status-select.tsx` | props を `{mode:"seller"\|"admin"}` の discriminated union 化。admin 分岐は `updateOrderGroupStatusAsAdmin` を呼ぶ。`catch(error: any)` → `unknown`+型ガードへ是正 | `refactor(ui): make OrderStatusSelect props a discriminated union` |
| seller columns / store-order-summary / store-summary | 既存 seller 呼び出し 3 箇所に `mode="seller"` 付与（store-summary は未使用 import を削除）。型整合のため union 化と同一コミット（rule 02: 各コミット tsc-clean） | 同上 |
| `src/app/dashboard/admin/orders/columns.tsx`（新規） | `ColumnDef<AdminOrderType>`。Store 列（group 店舗列挙）/ Status 列（group ごと `OrderStatusSelect(mode:admin)`）/ 詳細モーダル（`order` 逆参照を注入する `toStoreOrder` アダプタで `StoreOrderSummary` 流用） | `feat(admin): add cross-store order management page and columns` |
| `src/app/dashboard/admin/orders/page.tsx`（新規） | `force-dynamic` + URL パラメータ正規化（`Number()`→`Number.isFinite`）+ limit キャップ。`getAllOrders().orders` を DataTable へ | 同上 |
| `tests/component/dashboard/order-status-select.test.tsx` | 既存 3 render に `mode="seller"` 付与（テスト数不変・新規ケースなし） | union 化コミットに同梱 |

> **設計判断**: 1 注文が複数店舗（`groups[]`）にまたがるため、行粒度は **「Order 行 + group 内訳」**（design.md 準拠・ユーザー合意）。Store/Status 列は各 group を縦に列挙する。`StoreOrderSummary` は `group.order.*` 逆参照を参照するが `AdminOrderType.groups[]` は持たないため、親 Order の `paymentStatus`/`shippingAddress`/`paymentDetails` を注入する `toStoreOrder` アダプタで橋渡し（構造的部分型で `any` 不要）。
>
> **後続に引き継ぎ（Phase 1 スコープ外）**: `updateOrderPaymentStatus` の paymentStatus 手動変更 UI（design §3.3 の決済 API 非連携警告 + §3.5 runbook）。1-D は OrderGroup の配送ステータス変更のみ結線済み。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1251 | **1251 passed**（変動なし・既存テストへ `mode` 付与のみ） |
| スイート数 | 134 | 134 |
| スナップショット | 127 | 127 |
| 型エラー | 0 件 | **0 件** |

> テスト数・スイート数・スナップショット数いずれも不変のため `spec-sync-after-test` は非該当（lint 0 errors / build 成功・`/dashboard/admin/orders` = Dynamic を確認）。

### 2026-06-13: SonarCloud Quality Gate 修復（PR #133・order.ts New Code Coverage）

#### 概要

PR #133（dev → main）の SonarCloud Quality Gate が **New Code Coverage 63.4%（< 80%）** で Failed し CI が落ちていた。対象は `src/queries/order.ts` 単独。Task 1-A で追加した admin query 群のうち、5 関数の `catch` ブロック（エラー経路）と `reconcileParentOrderStatus` の Delivered/Canceled/Refunded 集約分岐・子0件早期 return が未カバーだったのが原因。**プロダクションコードは無変更、テスト追加のみで解消**。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/order.test.ts` | 異常系（DB エラー）: `getAllOrders`/`getOrderForAdmin` は汎用メッセージ変換、3 つの mutation は元 Error 再 throw を検証 | `38a9bbe` |
| `src/queries/order.test.ts` | `reconcile` の全 Delivered/Canceled/Refunded 集約分岐 + 子0件早期 return（親連動スキップ） | `38a9bbe` |

> 構造化ログ（`console.error`）は各異常系 describe で `jest.spyOn(console,"error").mockImplementation(()=>{})` により抑制。`order.ts` カバレッジ: Lines 87.5%→**100%** / Branch 61.5%→**83.3%**（Sonar 新コード換算 ~93%）。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1242 | **1251 passed** |
| スイート数 | 134 | 134 |
| スナップショット | 127 | 127 |
| 型エラー | 0 件 | **0 件** |

### 2026-06-13: 管理者ダッシュボード Phase 1 / Task 1-A（admin 注文 query）

#### 概要

`docs/design/admin-dashboard/` 設計の Phase 1（F2 注文管理・スキーマ変更なし）の起点として、`src/queries/order.ts` に全店舗横断の admin 注文 query 5 種を追加した。認可は `requireAdmin()` に集約し、親 Order ↔ 子 OrderGroup/OrderItem のステータス連動を `$transaction` でアトミック化。在庫連動は設計どおりスコープ外（TODO フックのみ）。UI（1-C/1-D）は別タスク。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/order.ts` | `getAllOrders`（`AdminOrderFilterSchema` で limit≤100 clamp・nativeEnum 入口検証） | `1747f32` |
| `src/lib/types.ts` | `AdminOrderType`（`Prisma.PromiseReturnType<typeof getAllOrders>["orders"][number]`）追加 | `445ad00` |
| `src/queries/order.ts` | `getOrderForAdmin`（既存 `getOrder` から userId フィルタを除去） | `7083681` |
| `src/queries/order.ts` | `updateOrderGroupStatusAsAdmin` + `reconcileParentOrderStatus`（子→親の集約遷移・混在は Processing） | `ff15259` |
| `src/queries/order.ts` | `updateOrderItemStatusAsAdmin` + `updateOrderPaymentStatus`（Refunded/Cancelled の親→子連動・決済 API 非呼出・enum スペル写像 Cancelled→Canceled） | `d88063a` |
| `src/queries/order.test.ts` | 認可 3 階層 / limit キャップ / 親子連動 / where 構造検証で +24 | （上記各コミット） |

> 監査ログ（`[Admin:Action] actor=... target=... to=...`）は各 action 実装時にインラインで付与（action の振る舞いの一部として feat コミットに包含）。`tx` 型は Prisma Accelerate 拡張クライアントとの非互換を避けるため `$transaction` から導出（`Parameters<Parameters<typeof db.$transaction>[0]>[0]`）。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1220 | **1242 passed** |
| スイート数 | 134 | 134 |
| スナップショット | 127 | 127 |
| 型エラー | 0 件 | **0 件** |

### 2026-06-06: コードレビュー指摘トリアージ・修正 + 統計同期

#### 概要

外部コードレビューの 18 指摘を現行コードに照合し、有効な 15 件を修正、陳腐化/誤判定の 3 件を理由付きでスキップした。併せて `upsertReview` のメール欠落エラー経路テストを +1 し、未同期だったテスト統計を実測へ是正した。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/review.ts` | `findUnique`→`create` の User フォールバックを `db.user.upsert` でアトミック化（レース回避）。メール検証は維持 | `6584e58` |
| `src/queries/review.test.ts` | upsert アサーション化 + メール欠落エラー経路テスト +1 + 認証 mock に emailAddresses 付与 | `6584e58` |
| `src/components/store/forms/review-details.tsx` | CustomRatingStars に role=slider / aria-value* / 矢印キー操作（0.5 刻み）/ focus ring を追加。color join を `?.`+`filter(Boolean)` で堅牢化 | `cda8792` |
| `src/components/store/profile/{payments,reviews}/*.tsx` | データ取得 `getUserPayments`/`getUserReviews` を try/catch でラップ（構造化ログ） | `bf1eb82` |
| `src/components/store/shared/upload-images.tsx` | Cloudinary 結果を `unknown`+型ガード化（`any` 除去） | `576c732` |
| テスト 6 ファイル | `any`/unsafe cast 除去・共有フィクスチャ化・stale コメント修正・fireEvent→userEvent | `7ef382f` |
| `docs/admin-manual.md` | 店舗削除をソフトデリート（`isDeleted`/`deletedAt`）として記述修正 | `a86e012` |

**スキップ（理由付き）**: review-details.test の rating 文字列アサーション（JSX 空白畳み込みで現状が正）、payments/reviews の render-phase setState（React 公式「You Might Not Need an Effect」の許容パターン）。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1179 | **1193** |
| スイート数 | 122 | **129** |
| スナップショット | 127 | 127 |
| 型エラー | 0 件 | **0 件** |

> 差分の大半は 2026-05-31 以降に追加された review/rating 系コンポーネントテストの未同期分の反映。本対応の純増は +1（メール欠落テスト）。

### 2026-06-02: SonarQube 静的解析の導入（CI = SonarCloud / ローカル = Docker）

- **背景**: コード品質（バグ・スメル・セキュリティホットスポット・カバレッジ）を継続的に可視化する基盤が無かった。`jest.config.js` は既に lcov を出力できる設定を持つが、それを消費する解析基盤が未接続だった。
- **決定**: CI は SonarCloud (SaaS)、開発者ローカルは SonarQube Community (Docker) のハイブリッド。Quality Gate は **初期は非ブロッキング**（既存コードの大量指摘で CI を止めないため）。詳細・代替案比較は [ADR-005](architecture/decisions/005-sonarqube-static-analysis.md)。
- **実装内容**:
  - `sonar-project.properties`: `sonar.coverage.exclusions` を `collectCoverageFrom` の除外と一致させ分母を揃える。`sonar.javascript.lcov.reportPaths=coverage/lcov.info`。
  - `ci.yml`: `test` ジョブに `--coverage` + `upload-artifact`、非ブロッキング `sonarcloud` ジョブ（`needs: test` / `continue-on-error` / `fetch-depth: 0` / `SONAR_TOKEN` 未登録時 skip）を追加。third-party action は SHA 固定（rule 01）。
  - `docker-compose.sonar.yml`（SonarQube Community + 専用 PostgreSQL + scanner-cli、digest 固定）+ Makefile `sonar-up/down/scan` + `.env.docker.example`。
- **統計**: テスト数・スイート数・スナップショット数は **不変**（config/docs のみ）。`spec-sync-after-test` は非該当のため QA_HANDOFF.md / coverage-dashboard.html は更新せず。
- **前提（リポジトリ外の手動作業）**: SonarCloud アカウント / Organization / Project 作成、`sonar-project.properties` のキー記入、GitHub Secrets への `SONAR_TOKEN` 登録。未登録でも非ブロッキングのため CI は緑のまま。
- **コミット**: ブランチ `chore/sonarqube-integration`（`chore(sonar):` / `ci:` / `chore(docker):` / `docs(sonar):` の 4 コミット）

### 2026-05-31: B3.1 — placeOrder（注文確定）の実 DB 統合テスト

- **背景**: B3 で `tests/integration/` 基盤が整ったが、実 DB 統合テストは cart-checkout 1 ファイルのみ。最もトランザクション依存の高い注文確定フロー `placeOrder`（`src/queries/user.ts`）はモック Prisma の unit テストしか持たず、原子性・実 FK・Decimal 精度・在庫キャップが構造的に未検証だった。
- **実装内容**:
  - `tests/integration/order-placement.test.ts`（6 シナリオ / 1 スイート）: 単一店舗 FK・Decimal 集計 / 複数店舗 OrderGroup 分割 / 在庫キャップ（`Math.min`）/ クーポン店舗限定割引 / 所有権ガード（IDOR・副作用なし）/ 不正 variant·size 組み合わせの拒否。
  - 基盤拡張: `tests/integration/setup/seed.ts` に ProductVariantImage 作成（`placeOrder` が `variant.images[0].url` を参照）と `seedShippingAddress` を追加。本体コード（`src/`）は無変更。
- **統計**: Integration 11 → 17 / スイート 1 → 2。`bun run test`（unit/component 1179）は変動なし。ダッシュボードのテストファイル総数 134 → 135。
- **categorize ドリフト（注記のみ）**: `tests/integration/` は categorize 上 unit×other に分類されるため Integration 行には出ない（マトリクス 17/80 不変）。categorize.ts は変更せず注記にとどめた。
- **コミット**: `78a20c9`（seed 基盤）/ `ae28157`（テスト本体）/ docs 同期（本コミット）

### 2026-05-29: B3 完了 — Cart → Checkout Integration テスト / NA-NS-03 アーカイブ

- **背景**: Open Issue B3 で「Cart → Checkout の状態橋渡し（Zustand persist hydration / shipping fee 計算 / クーポン適用）を Integration 粒度で検証」が指定されていた。既存 E2E (`tests/e2e/purchase-flow.spec.ts`) は実ブラウザベースで遅く、リグレッション検知のフィードバックループが長い。ユニットテスト (`src/cart-store/useCartStore.test.ts`) は store の純粋ロジックのみで、DB / server action との接続は未カバー。
- **実装内容**:
  - **基盤整備（Phase 0）**: 既存リポジトリに Integration テスト基盤が存在しなかったため、testcontainers-managed PostgreSQL + 専用 jest config を新設。
    - `docs/architecture/decisions/004-integration-test-db-strategy.md` (ADR-004): testcontainers vs docker-compose 共有 vs `services.postgres` vs Neon vs SQLite の 5 案を比較し testcontainers を採択。
    - `docker-compose.test.yml` + `.env.test.example`: testcontainers が動かない環境用のフォールバック Postgres サービス。
    - `tests/integration/setup/container.ts` (`globalSetup`): `PostgreSqlContainer` 起動 → `DATABASE_URL` 注入 → `execFileSync` 経由で `bunx prisma migrate deploy`。`DATABASE_URL` 既設の場合は外部 DB モードと判定し testcontainers をスキップ。
    - `tests/integration/setup/teardown.ts` (`globalTeardown`): container 停止。
    - `tests/integration/setup/db.ts`: テスト用 `PrismaClient` ファクトリ（`src/lib/db.ts` シングルトンの例外パスとして直接 instantiate）。
    - `tests/integration/setup/reset-db.ts`: 23 テーブルを 1 文の `TRUNCATE ... RESTART IDENTITY CASCADE` で初期化。
    - `tests/integration/setup/seed.ts`: `src/config/test-fixtures.ts` の shape を踏襲した DB INSERT 版（`seedUser` / `seedStore` / `seedProductWithVariantAndSize` / `seedCart` / `seedCartItem` / `seedCoupon` / `seedCategoryWithSubcategory` / `seedCountry`）。
    - `jest.integration.config.js`: `testEnvironment: "jsdom"` + `testMatch: tests/integration/**` + `maxWorkers: 1` + `testTimeout: 60s`。uuid v14 を `transformIgnorePatterns` 例外で ts-jest 変換、画像/CSS は file-mock/style-mock で空スタブ化。
    - `jest.config.js`: `testPathIgnorePatterns` に `/tests/integration/` を追加し既存 unit から分離。
    - `package.json`: `@testcontainers/postgresql@^10.13.2` (devDependency) + `"test:integration"` script 追加。
    - `.github/workflows/ci.yml`: `integration-tests` ジョブ追加（testcontainers が runner の Docker daemon を直接利用するため `services:` 不要）。
  - **B3 本体 (Phase 1)**: `tests/integration/cart-checkout.test.ts` で 4 シナリオ計 11 テスト。
    - Scenario 1 (Zustand persist hydration / 2 テスト): `localStorage` から `useCartStore.persist.rehydrate()` が `cart` / `totalItems` / `totalPrice` を正しく復元 / `addToCart()` が localStorage に同期保存。
    - Scenario 2 (Shipping fee 一貫性 / 3 テスト): ITEM / WEIGHT / FIXED の 3 方式で `computeShippingTotal` (`src/lib/shipping-utils.ts`) の出力が DB の `CartItem.shippingFee` と完全一致 + `totalPrice` が `unit price × qty + shipping fee` と整合（Decimal 比較は `.toNumber()` + `toBeCloseTo`）。
    - Scenario 3 (Coupon 適用 / 5 テスト): 正常適用 (`applyCoupon` server action) で `Cart.couponId` 更新 + `total` が store subtotal の 10% 分減算 / 異常系 4 つ（存在しない code / 期限切れ / クーポン対象店舗外 / 二重適用拒否）。
    - Scenario 4 (未認証 redirect / 1 テスト): `currentUser` を null モックで CheckoutPage を呼出 → `redirect("/cart")` が throw されることを `NEXT_REDIRECT:/cart` カスタムエラーで捕捉。重い transitive import (StoreHeader → flag-icons CSS / .webp 画像 / uuid ESM) は moduleNameMapper + transformIgnorePatterns で吸収。
- **設計判断（ADR-003 flake 回避）**: ADR-003 で報告されている jsdom + RTL + userEvent + waitFor の CI flake を継承しないよう、本テストでは **React Testing Library によるコンポーネント描画を意図的に避けた**。検証はすべて store / DB / server-action 層で実施。Scenario 4 のみ CheckoutPage 関数の直接呼出を行うが、`redirect` が即時 throw するため React render に到達しない。
- **コミット計画**（[`02-tdd-step-commit.md`](.claude/rules/02-tdd-step-commit.md) 準拠で 2 PR 構成）:
  - **PR 1 (Phase 0 / インフラ)**: ADR-004 / docker-compose.test.yml + env templates / testcontainers setup / jest.integration.config.js + script / CI workflow の論理単位ごとに分割
  - **PR 2 (Phase 1〜2 / 本体 + 同期)**: cart-checkout.test.ts (Tier 1 単一新規ファイル = 1 commit) + spec-sync-after-test の SSOT 同期コミット
- **影響**:
  - テスト総数: unit/component 1137（変動なし） + integration 11（新設）
  - スイート数: unit/component 112（変動なし） + integration 1（新設）
  - 型エラー: 0 件（維持）
  - 新規 devDependency: `@testcontainers/postgresql@^10.13.2`
  - 新規 CI ジョブ: `integration-tests`
- **アーカイブ作業**:
  - `scripts/coverage-dashboard/render-html.ts` の `NEXT_ACTIONS` から cart-checkout エントリを削除
  - `QA_HANDOFF.md` の NA-NS-03 プロンプトを HTML コメントアウトでアーカイブ化
  - `COVERAGE_REPORT.md §3 B3` を `~~完了~~` 取り消し線 + 達成内容に更新、Integration マトリクスのセルを ✦ に遷移
- **次アクション**: 残るは C1 (Lighthouse CI) / C2 (Bundle Size) の長期項目のみ。B3 で確立した testcontainers 基盤は B4 や IDOR セキュリティテストの拡充に再利用可能。

---

### 2026-05-28: B2 完了 — Stripe / PayPal Webhook ハンドラー新規実装 + Contract テスト / NA-NS-02 アーカイブ

- **背景**: Open Issue B2 で「Stripe / PayPal Webhook ハンドラーの Contract テスト追加」が指定されていたが、Phase 1 調査で **Stripe/PayPal Webhook ハンドラー自体が未実装** であることが判明（既存 `src/app/api/webhooks/route.ts` は Clerk Svix 専用）。同期決済 (`src/queries/stripe.ts` / `paypal.ts`) のみで out-of-band イベント（チャージバック / 部分返金 / 遅延失敗）への DB 整合性が未保証だったため、ハンドラー新規実装 + Contract テストの 2 段構えに再設計。
- **実装内容**:
  - **新規エンドポイント**: `/api/webhooks/stripe` と `/api/webhooks/paypal` を子ルートとして並置（既存 Clerk webhook `/api/webhooks` はそのまま維持）。
  - **Stripe ハンドラー**: `stripe.webhooks.constructEvent` で署名検証（raw body を `req.text()` で取得）。`payment_intent.succeeded` → Paid / `payment_intent.payment_failed` → Failed / `charge.refunded` → Refunded or PartiallyRefunded（amount_refunded と amount を比較し全額/部分を即時判定）。
  - **PayPal ハンドラー**: PayPal `verify-webhook-signature` API 呼び出し（事前に `/v1/oauth2/token` で Bearer トークン取得する 2 段階フェッチ）。`PAYMENT.CAPTURE.COMPLETED` → Paid / `DENIED` → Failed / `REFUNDED` → Refunded（部分判定は PayPal の resource 構造上即時不可のため当面一律 Refunded、partial 精密判定は将来課題）。
  - **冪等性**: `db.paymentDetails.upsert({ where: { orderId } })` で重複イベントを安全に処理（orderId が unique 制約）。
  - **前提改修 (commit `338ab41`)**: `src/queries/stripe.ts` の `createStripePaymentIntent` に `metadata: { orderId }` を、`src/queries/paypal.ts` の `createPayPalPayment` に `purchase_units[0].custom_id = orderId` を付与。Webhook 側で `event.data.object.metadata.orderId` / `resource.custom_id` から内部 Order を逆引きできるようにする最小限の改修。
  - **固定フィクスチャ**: `tests/fixtures/webhooks/stripe/{payment-intent-succeeded,payment-intent-failed,charge-refunded-full,charge-refunded-partial}.json` と `tests/fixtures/webhooks/paypal/{payment-capture-completed,payment-capture-denied,payment-capture-refunded}.json` を配置。Stripe の `charge.refunded` は全額/部分の 2 ケースで amount_refunded/amount を変えてカバー。
  - **Contract テスト**: 各ハンドラーで 15 ケース（合計 30）+ metadata 検証 +2 ケース。署名検証（ヘッダー欠落・不正署名・正常署名）/ 正常系イベント分岐 / 境界系（metadata 欠落 400 / 未知イベント 200 no-op / Order 不在 404 / 冪等性 / DB エラー 500）を網羅。
- **コミット分割（[`02-tdd-step-commit.md`](../.claude/rules/02-tdd-step-commit.md) 準拠）**:
  - `338ab41` — `feat(payments): attach orderId metadata to Stripe/PayPal payment intents`（既存 query への metadata 付与のみ、テスト +2）
  - `1d69f0f` — `feat(webhooks): add Stripe webhook handler with contract tests`（fixture 4 + handler + test = 6 ファイル / 同一 SUT による相互依存例外条件を満たす）
  - `2321cd8` — `feat(webhooks): add PayPal webhook handler with contract tests`（fixture 3 + handler + test = 5 ファイル / 同上）
- **アーカイブ作業**:
  - `scripts/coverage-dashboard/render-html.ts` の `NEXT_ACTIONS` から NA-NS-02 を削除（同期物として）。
  - `QA_HANDOFF.md` の NA-NS-02 プロンプトを HTML コメントアウトでアーカイブ化。
  - `COVERAGE_REPORT.md §3 B2` を `~~完了~~` 取り消し線 + 達成内容に更新。
- **影響**:
  - テスト総数: 1103 → 1135（+32）
  - スイート数: 110 → 112（+2、`route.test.ts` × 2）
  - 型エラー: 0 件（維持）
  - 新規 API ルート 2 本（Stripe / PayPal Webhook 受信エンドポイント）
- **次アクション**: B3（Cart → Checkout Integration テスト）。運用配線（Stripe Dashboard / PayPal Developer Portal での Webhook URL 登録 + `STRIPE_WEBHOOK_SECRET` / `PAYPAL_WEBHOOK_ID` の `.env.local` 設定）は別タスクとして切り出し済み。

### 2026-05-28: B1+ Sprint 4 — Tier 3 + 補助 全 11 プリミティブ Snapshot 拡張 / NA-NS-01 完全アーカイブ

- **背景**: Sprint 3 に続き [`B1_SNAPSHOT_EXPANSION_PLAN.md`](testing/B1_SNAPSHOT_EXPANSION_PLAN.md) の Sprint 4（最終 Sprint）として、Tier 3（外部 lib 依存）7 プリミティブ + 補助 4 プリミティブの計 11 プリミティブを実装。shadcn/ui プリミティブカバーを **38/49 → 49/49（100%）** へ到達させ NA-NS-01 をアーカイブ化。
- **実装内容**: 1 ファイル 1 commit 厳守で以下 11 プリミティブを追加。Tier 3 は外部 lib mock / setup が個別必要なため計画書段階から「同梱コミット禁止」が明文化されていた:
  - form (1 snap) / calendar (1) / carousel (1) / command (2) / sidebar (1) / navigation-menu (1) / sonner (1) / accordion (2) / toast (2) / toaster (1) / data-table (2)
- **設計判断と新規 jsdom スタブ**:
  - **carousel (embla-carousel-react)**: `IntersectionObserver` / `matchMedia` が jsdom 未実装でテスト時に throw。`tests-setup/jest.setup.ts` に no-op スタブを追加（commit `222d16e`、ResizeObserver スタブと同パターン）。
  - **command (cmdk)**: `Element.prototype.scrollIntoView` が jsdom 未実装で cmdk の自動スクロール処理で throw。同様に no-op スタブを追加（commit `ab07840`）。CommandDialog 内 DialogContent は Radix accessibility 警告（DialogTitle 未指定）を出すが snapshot 構成では省略許容のため `console.error` を spy で抑制。
  - **calendar (react-day-picker)**: `month` prop を渡さないと「今日」依存で day_today クラスが日次変動する。`month={new Date("2026-01-15")}` で固定。
  - **form (react-hook-form)**: 共有ヘルパー化は YAGNI として、各テストファイル内に最小 `FormFixture` を local 定義（[`B1_SNAPSHOT_EXPANSION_PLAN.md`](testing/B1_SNAPSHOT_EXPANSION_PLAN.md) 方針）。`useId()` 出力 `_r_0_` は render root ごとにリセットされるため安定。
  - **sidebar**: `useIsMobile` (matchMedia 経由) と `SidebarProvider` の Context が必須。`SidebarProvider defaultOpen` で expanded state を再現。
  - **sonner**: `useTheme` (next-themes) は Provider なしでもデフォルトを返すため追加 setup 不要。
  - **data-table**: TanStack Table ラッパーで `useModal()` 依存のため `ModalProvider` でラップ。React Fragment を返すため `container.firstChild` ではなく `container` 全体をスナップショット対象に。
- **アーカイブ作業**:
  - `scripts/coverage-dashboard/render-html.ts` の `NEXT_ACTIONS` から NA-NS-01 を削除（コメントで完了履歴記録）。
  - `QA_HANDOFF.md §3.3` の NA-NS-01 プロンプトを HTML コメントアウトでアーカイブ化（履歴の参照は残す）。
  - `B1_SNAPSHOT_EXPANSION_PLAN.md` Status を `Completed 2026-05-28` に更新。
- **影響**:
  - テスト総数: 1088 → 1103（+15）
  - Jest スナップショット: 112 → 127（+15）
  - スイート数: 99 → 110（+11）
  - 型エラー: 0 件（維持）
  - **shadcn/ui プリミティブカバー: 49/49 (100%)** — Tailwind / Radix のスタイル退行検知範囲が全プリミティブに到達
- **コミット**: `1b207ba` (form) → `875de63` (calendar) → `222d16e` (infra: IntersectionObserver/matchMedia) → `08f49c3` (carousel) → `ab07840` (infra: scrollIntoView) → `5b17cce` (command) → `07adff8` (sidebar) → `5e5b7b8` (navigation-menu) → `52ce863` (sonner) → `1af2485` (accordion) → `5987ea2` (toast) → `ed282c5` (toaster) → `8e429f2` (data-table)。
- **次アクション**: B1+ 完了により medium priority に降格された B2 (Webhook Contract) / B3 (Cart → Checkout Integration) へ着手判断。

### 2026-05-28: B1+ Sprint 3 — Tier 2 全 8 プリミティブ Snapshot 拡張

- **背景**: B1+ Sprint 2 に続き [`B1_SNAPSHOT_EXPANSION_PLAN.md`](testing/B1_SNAPSHOT_EXPANSION_PLAN.md) の Sprint 3 として、Tier 2（compound Radix プリミティブ）全 8 プリミティブを実装。shadcn/ui プリミティブカバーを 30/49 → 38/49 へ拡大。
- **実装内容**: 1 ファイル 1 commit 厳守で以下 8 プリミティブを追加。計画書では Menu family / Sheet family の同梱コミットを候補としていたが、Menu primitives の snapshot ファイルが class-heavy（dropdown-menu = 140 行 / menubar = 123 行 / sheet = 196 行）で [`02-tdd-step-commit.md`](../.claude/rules/02-tdd-step-commit.md) の 200 行閾値を 3 ファイル合計で超過するため分離を選択:
  - dropdown-menu (2 snap) / context-menu (2) / menubar (2) / sheet (3) / drawer (2) / tabs (2) / toggle-group (3) / table (3)
- **設計判断**:
  - **context-menu**: Radix `react-context-menu` の Root は `defaultOpen` を持たない（右クリック契機の API）。`fireEvent.contextMenu(trigger)` でメニューを open 状態にし、role="menu" を取得。
  - **menubar**: Radix `react-menubar` の Root は `defaultValue="<menu-value>"` で特定の MenubarMenu を初期 open にできる。MenubarMenu に `value="file"` を割り当て、Root に `defaultValue="file"` を渡す。
  - **sheet**: Radix Dialog を内部実装に持つため SheetContent は role="dialog"。`side="left"` バリアントは CVA の sheetVariants 経由でクラス差分が出るため追加スナップショット対象に含めた。
  - **drawer**: vaul ライブラリの Drawer.Content も role="dialog" を出力。`defaultOpen` で初期 open 状態を再現。
- **影響**:
  - テスト総数: 1069 → 1088（+19）
  - Jest スナップショット: 93 → 112（+19）
  - スイート数: 91 → 99（+8）
  - 型エラー: 0 件（維持）
- **コミット**: `e6c79e3` (dropdown-menu) → `d7b7431` (context-menu) → `ab9a51e` (menubar) → `904899b` (sheet) → `be434c7` (drawer) → `c43eefe` (tabs) → `8b19838` (toggle-group) → `4429b8b` (table)。
- **次アクション**: Sprint 4（Tier 3: form / calendar / carousel / command / sidebar / navigation-menu / sonner、補助: accordion / toast / toaster / data-table、計 11 commits + spec-sync + NA-NS-01 archive）。

### 2026-05-28: B1+ Sprint 2 — Tier 1 後半 11 プリミティブ Snapshot 拡張

- **背景**: B1+ Sprint 1（2026-05-26）に続き [`B1_SNAPSHOT_EXPANSION_PLAN.md`](testing/B1_SNAPSHOT_EXPANSION_PLAN.md) の Sprint 2 として、Tier 1（外部 lib 依存なし）後半 11 プリミティブを実装。Tailwind / Radix のスタイル退行検知範囲を 19/49 → 30/49 へ拡大。
- **実装内容**: 1 ファイル 1 commit 厳守で以下 11 プリミティブを追加（[`02-tdd-step-commit.md`](../.claude/rules/02-tdd-step-commit.md) MUST 規定）:
  - alert (3 snap) / alert-dialog (3) / avatar (3) / breadcrumb (3) / collapsible (2) / hover-card (2) / input-otp (2) / pagination (3) / resizable (2) / scroll-area (2) / chart (2)
- **設計判断**:
  - **hover-card**: Radix `HoverCardPrimitive.Content` には ARIA role が付かないため、popover の `getByRole("dialog")` 戦略は使えない。代わりに `screen.getByText("Card body")` で styled HoverCardContent を直接取得（テキストの最内側親要素 = HoverCardContent 自身）。popper wrapper を含めるとスナップショットに非決定な transform が混入するため除外。
  - **chart**: recharts `ResponsiveContainer` は jsdom 内で親要素サイズを 0×0 と読み警告を出すが、テスト失敗には至らない。`beforeEach`/`afterEach` で `console.warn` を spy → no-op して出力ノイズを抑制。スナップショットは ChartContainer の class 合成と `ChartStyle` の `<style>` 注入（id を `id="bar-fixture"` 等で固定）を検証する範囲に留める。
  - **alert-dialog**: `defaultOpen` 時は `screen.getByRole("alertdialog")` で AlertDialogContent を限定取得（dialog と異なる role）。
- **影響**:
  - テスト総数: 1042 → 1069（+27）
  - Jest スナップショット: 66 → 93（+27）
  - スイート数: 80 → 91（+11）
  - 型エラー: 0 件（維持）
- **コミット**: `750d830` (alert) → `c7245db` (alert-dialog) → `2753815` (avatar) → `9296ebb` (breadcrumb) → `9df0482` (collapsible) → `e38f9ee` (hover-card) → `d306803` (input-otp) → `ce6d346` (pagination) → `68a0df9` (resizable) → `35c6374` (scroll-area) → `45c339b` (chart)。
- **次アクション**: Sprint 3（Tier 2: Menu family / Sheet family / tabs / toggle-group / table、5–7 commits）。

### 2026-05-26: B1+ Sprint 1 — Tier 1 前半 10 プリミティブ Snapshot 拡張

- **背景**: B1 MVP（2026-05-23 / 9 プリミティブ・40 snapshot）で確立した規約を残り 40 プリミティブへ展開する [`B1_SNAPSHOT_EXPANSION_PLAN.md`](testing/B1_SNAPSHOT_EXPANSION_PLAN.md) の Sprint 1 として、Tier 1（外部 lib 依存なし）前半 10 プリミティブを実装。Tailwind / Radix のスタイル退行検知範囲を 9/49 → 19/49 へ拡大。
- **実装内容**: 1 ファイル 1 commit 厳守で以下 10 プリミティブを追加（[`02-tdd-step-commit.md`](../.claude/rules/02-tdd-step-commit.md) MUST 規定）:
  - aspect-ratio (2 snap) / separator (2) / progress (3) / switch (3) / checkbox (3) / radio-group (3) / slider (3) / toggle (3) / tooltip (2) / popover (2)
- **インフラ発見**: Radix UI の `useSize` 系（Slider / Popover / Tooltip / HoverCard / ScrollArea 等）は ResizeObserver に依存するが jsdom は未実装。`tests-setup/jest.setup.ts` に no-op スタブを追加（独立 commit `6545fce`）。B1 MVP では出現しなかったため計画書の「jest.setup.ts 変更不要」前提が一部更新された。
- **影響**:
  - テスト総数: 1016 → 1042（+26）
  - Jest スナップショット: 40 → 66（+26）
  - スイート数: 70 → 80（+10）
  - 型エラー: 0 件（維持）
- **コミット**: `b55e177` (aspect-ratio) → `7268b72` (separator) → `4298b52` (progress) → `189f397` (switch) → `f1c9cee` (checkbox) → `b815abb` (radio-group) → `6545fce` (ResizeObserver stub) → `a42b94b` (slider) → `c70dec9` (toggle) → `1b75ad8` (tooltip) → `66fb8d5` (popover)。
- **次アクション**: Sprint 2（Tier 1 後半 11 プリミティブ: alert / alert-dialog / avatar / breadcrumb / collapsible / hover-card / input-otp / pagination / resizable / scroll-area / chart）。

### 2026-05-26: A4 残課題 `getStoreOrders` 統合と IDOR 3 階層化

- **背景**: A4（2026-05-24）で coupon / product / store 配下の他アクションは全て `requireStoreOwner` に統合済みだったが、`store.ts::getStoreOrders` のみ自前の `findUnique({ where: { url } })` + `user.id !== store.userId` インライン比較が残存していた。`findUnique` 単独では `userId` を複合キーに含まないため IDOR 防御が「取得後にブロック」する後付け構造であり、エラーメッセージも旧仕様 `"You are not authorized to view this store's orders."` で統一文言から乖離。
- **変更内容**:
  - `getStoreOrders` の認可ブロック（auth / role / `findUnique` / ownership 比較の計 29 行）を `const { store } = await requireStoreOwner(storeUrl);` の 1 行に置換。複合キー `{ url, userId }` による「取得即所有検証」の原子的 IDOR 防御に変更。
  - IDOR テストを `SECURITY_GAP_REPORT.md §5.2` の 3 階層パターンに拡張: (a) 統一文言検証 / (b) `where: { url, userId }` 構造検証 / (c) `orderGroup.findMany` 非呼び出し検証。
  - 「存在しないストア」テストも同じ統一文言 `"Forbidden: store not owned by current user."` に同期（`requireStoreOwner` の `findUnique` 失敗パスは「未所有」と意味的に同一）。
- **影響**:
  - テスト総数: 1015 → 1016（+1 net、IDOR (b)+(c) 1 件追加）。
  - `.claude/steering/tech.md` の「認可ガード」項に完全準拠（インライン展開ゼロ）。
- **コミット**: `70f5b94`（コード変更）+ docs 同期コミット（本コミット）。

### 2026-05-24: CI フレーク調査と ModalProvider setOpen 同期化（ADR-002 / ADR-003 / 一時スキップ）

- **問題**: `src/providers/modal-provider.test.tsx` の `[P1] モーダルを開くと...` テストが CI で間欠的に失敗。ローカル（M1 Mac）20 連続実行で再現せず、エラー本文も完全に空という稀な症状。
- **試行 1 — テストリファクタ**: `findByTestId` パターンへ書換（`eb15fcf`）→ CI 失敗継続。
- **試行 2 — 診断 instrumentation（[ADR-002](architecture/decisions/002-ci-jest-verbose-flag.md)）**: CI workflow を `bunx jest --verbose --ci` に変更（`5cbf82a`）→ 直後の偶発グリーンを「解消」と誤認、翌 commit `2eb3049`（docs only）で再失敗し誤認判明。
- **試行 3 — アーキ修正（[ADR-003](architecture/decisions/003-modal-setopen-sync-for-react19.md)）**: `ModalProvider.setOpen` を `async` から同期関数に変更し、fetchData 経路は fire-and-forget IIFE で起動（`9b77c59`）→ 再び 1 サイクル偶発グリーンの後、`9040dcc`（docs only）で再失敗。**設計改善としては妥当だが根本解消ならず**（ADR-003 Status: Partial Mitigation）。
- **最終判断 — 一時スキップ（OI-8）**: 該当テスト 1 件のみ `it.skip` で退避し CI 安定優先。同等カバレッジは `[P1] fetchData なしでモーダルを開ける` が部分的に担保。期限 2026-06-07 までに再着手予定。6 仮説（A: isMounted 撤廃 / B: MSW bypass / C: Jest 30 reporter / D: useEffect spy leak / E: bunx runtime / F: runner 個体差）の詳細カタログは ADR-003「後続調査と一時スキップ判断」に集約。
- **形式知化**:
  - `.claude/skills/ci-flake-diagnosis/SKILL.md` を新規作成（gh CLI でのログ精査 → 仮説分類 → 段階的修正の標準手順）
  - `.claude/steering/tech.md` に「Context Provider setter の同期化」パターンを追記
  - ADR-002 を訂正し ADR-003 を新規作成
  - `docs/testing/QA_HANDOFF.md` に OI-8 を追加（スキップ追跡 SSOT）
- **教訓**:
  - **「1 サイクル両グリーン = 修正完了」は誤り**（2 回繰り返した判断ミス: `5cbf82a` / `9b77c59`）。連続 N サイクルを基準とする
  - 「エラー本文が空」は assertion failure ではないシグナル → React 19 strict act / runtime 層を疑う
  - `async` だが consumer が `await` しない関数は anti-pattern。型を `void` に正直化する
  - **禁忌ルール（`it.skip`）も状況次第で必要悪**。条件付き運用（期限・同等カバレッジ確認・追跡 doc）で適用
- **解消（2026-06-14, OI-8 クローズ）**: 真因は modal-provider 固有でも「RTL + userEvent + waitFor のメタ問題」でもなく、`src/queries/size.test.ts` が `@/lib/db` を未モックで実 Prisma を `spyOn` していたことによる stub DB への `PrismaClientInitializationError`(P1001) 接続リークだった。非同期 reject が同一ワーカーのプロセス境界をまたぎ、jest-circus が「その瞬間 current な別ファイル」へ `error` イベントとして帰属（P1001 の stack が空 → レポーターが本文を空に整形 → 「本文空」署名）。一時カスタム jsdom 環境の `handleTestEvent` で 3× P1001 を実観測（`a93effe`、撤去 `756c6a9`）。`size.test.ts` に `jest.mock("@/lib/db")` を追加して根絶（`83ef06c`）→ 被害者だった modal-provider 9 件を un-skip（`49fa32d`、1272→1281 passed / skip 12→3）。ローカル 30x ループ FAIL 0・stub DB フルスイート P1001 = 0・CI push/pull_request 両 event 緑。詳細: [docs/ci/archive/unit-tests-run-reactive.md](ci/archive/unit-tests-run-reactive.md)。

---

## 既知の課題

| 課題 | 詳細 | 優先度 |
|------|------|--------|
| ~~modal-provider テスト CI flake (OI-8)~~ | ✅ **解消済み（2026-06-14）**。真因は modal-provider ではなく `src/queries/size.test.ts` の `@/lib/db` 未モックによる実 Prisma 接続リーク（stub DB へ P1001 → jest-circus が別ファイルへ「本文空」失敗を帰属）。`size.test.ts` に `jest.mock("@/lib/db")` を追加して根絶（`83ef06c`）→ modal-provider 9 件を un-skip（`49fa32d`）。詳細: [docs/ci/archive/unit-tests-run-reactive.md](ci/archive/unit-tests-run-reactive.md) | - |
| Elasticsearch 未実装 | `src/lib/elastic-search.ts` がコメントアウト中。全文検索は現在 tsvector で代替 | 低 |
| E2E シード不安定 | 解消済み: CI環境で PostgreSQL コンテナを使用し、`seed-idempotency` ジョブで冪等性を検証完了 (OI-5) | - |
| E2E テスト網羅不足 | `TEST_IMPLEMENTATION_PLAN.md` の P1/P2 スイートが未実装 | 中 |

---

## 次アクション

### 0. 【最優先】管理者ダッシュボード Phase 3（F3 クーポン横断管理）

**背景**: Phase 2（F1 ダッシュボード統計）は 2026-06-15 に完了。KPI カード・売上チャート・最近リストが `/dashboard/admin` で動作中。次は Phase 3（クーポン横断管理）に着手する。Phase 単位の現在地は [docs/design/admin-dashboard/PROGRESS.md](design/admin-dashboard/PROGRESS.md) を参照（SSOT）。

**次セッション 依頼プロンプト（コピペ可）**:

```
docs/design/admin-dashboard/PROGRESS.md と tasks.md を参照し、Phase 3（F3 クーポン横断管理）の
3-A から進めて。具体的には Coupon モデルへの isActive 列追加（migrate dev + ERD 再生成）から始め、
3-B（placeOrder / applyCoupon の isActive 再検証）→ 3-C（admin クーポン query）→ 3-D（Zod スキーマ）
→ 3-E（UI）の順で実装。スキーマ変更は safe-migration スキルを使うこと。
完了の定義は test-complete（lint/tsc/test）+ bun run build。進捗は admin-dashboard/PROGRESS.md と
docs/PROGRESS.md の両方を更新し、次の依頼プロンプトも更新すること。
```

**注意**: Phase 5（platform-wide 発行）は破壊的変更のため `safe-migration` 必須・最後に単独実施。

---

### 1. TEST_IMPLEMENTATION_PLAN.md の P1 スイート実装

**背景**: Phase 1 の P0（基盤テスト）は2026-05-21 に完了。次は P1 優先度のコンポーネントテストに着手。

**入力ファイル**:
- `docs/testing/TEST_IMPLEMENTATION_PLAN.md`（⏸️ステータスのスイートを確認）
- `src/config/test-fixtures.ts`（既存ファクトリを活用）

**進め方**:

```
/test-gen
```

対象スイートを指定して `test-gen` スキルを呼び出す。AAAパターン・既存インフラ活用を指示。

---

### 2. E2E テストの CI 安定化

**背景**: `seed-idempotency` ジョブにより、CI環境（Docker）でシードデータが問題なく投入でき、かつ冪等であることが確認されました。今後は Playwright E2E の CI 統合を進める必要があります。

**確認すべきこと**:
- `E2E_DATABASE_URL` が CI secrets に設定されているか
- `tests/e2e/` の各スペックが seed データに依存している箇所の一覧化
- `playwright.config.ts` の `webServer` タイムアウト設定

---

### 3. spec-sync-check で仕様乖離を確認

**背景**: Next.js 16 マイグレーション後、いくつかのインターフェース仕様が変更されている可能性がある。

**進め方**:

```
/spec-sync-check
```

---

### SonarCloud Quality Gate 修復（PR #136）(2026-06-15)

#### 概要

PR #136 の New Code カバレッジ 46.0%（< 80%）を解消。dashboard query の catch ブロックテストと admin dashboard 4 コンポーネントのテストを追加。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/dashboard.test.ts` | getSalesOverTime / getRecentOrders / getRecentStores / getAdminDashboardStats の catch ブロック（Error / 非-Error 両分岐）+8 | `750374b` |
| `tests/component/dashboard/admin/stats-cards.test.tsx` | 新規作成（KPI カード 8 ラベル・数値フォーマット +3 テスト） | `686e45a` |
| `tests/component/dashboard/admin/recent-orders.test.tsx` | 新規作成（注文リスト・空状態・日付フォーマット +3 テスト） | `b29b4d5` |
| `tests/component/dashboard/admin/sales-chart.test.tsx` | 新規作成（period="daily"/"monthly" 分岐・デフォルト値 +4 テスト） | `9f98ff5` |
| `tests/component/dashboard/admin/recent-stores.test.tsx` | 新規作成（STATUS_LABEL/VARIANT 全分岐・?? フォールバック +8 テスト） | `ef091c3` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1302 passed / 1305 total | **1328 passed / 1331 total** |
| スイート数 | 138 | **141** |
| 型エラー | 0 件 | **0 件** |

---

---

### Phase 3 F3-第1段: クーポン横断管理 + isActive 列追加 (2026-06-15)

#### 概要

`Coupon.isActive` 列追加（後方互換）を起点に、管理者による全ストアクーポン横断管理（一覧・作成・削除・有効/無効トグル）を実装。`applyCoupon`・`placeOrder` の二重防御で無効クーポンを注文確定まで遮断する。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `prisma/schema.prisma` | `Coupon.isActive Boolean @default(true)` 追加 + migrate + ERD 再生成 | `d5d5284` |
| `src/queries/coupon.ts` | `applyCoupon` Step 2.5 に isActive チェック追加 | `b4095bd` |
| `src/queries/user.ts` | `placeOrder` クーポン適用条件に `&& isActive === true` 追加 | `669ad3d` |
| `src/queries/coupon.ts` | admin query 4 種追加（getAllCoupons / upsertCouponAsAdmin / deleteCouponAsAdmin / toggleCouponActive） | `982c765` |
| `src/lib/schemas.ts` | `AdminCouponFormSchema`（isActive + storeId optional）追加 | `958af7a` |
| `src/app/dashboard/admin/coupons/` | page.tsx + columns.tsx（Store 列 + Active バッジ）+ new/page.tsx 新規実装 | `31dcf68`, `eb996d0` |
| `src/components/dashboard/forms/admin-coupon-details.tsx` | isActive Switch 付き admin フォームコンポーネント新規実装 | `31dcf68` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1328 passed / 1331 total | **1348 passed / 1351 total** |
| スイート数 | 141 | **141** |
| 型エラー | 0 件 | **0 件** |

---

---

### Phase 5-B: F3-第2段 platform-wide クーポン 影響箇所改修 (2026-06-16)

#### 概要

`Coupon.storeId` の nullable 化（5-A）を受け、`placeOrder` / `applyCoupon` / `updateCheckoutProductWithLatest` の3箇所と `AdminCouponFormSchema` / `upsertCouponAsAdmin` / seller `upsertCoupon` / admin UI を PLATFORM scope に対応させた。各ステップは Red→Green の TDD で直列実施。残課題（在庫連動・PartiallyRefunded 部分返金）は別タスク。5-C（E2E検証）は未着手。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/user.ts` (`placeOrder`) | PLATFORM クーポンを全 OrderGroup に適用、最終グループで端数吸収 | `dcd70cc` 系 |
| `src/queries/coupon.ts` (`applyCoupon`) | PLATFORM 全 item 対象化 + Number演算を `Prisma.Decimal` に置換 | `dcd70cc` |
| `src/queries/user.ts` (`updateCheckoutProductWithLatest`) | PLATFORM 対応 + `cart.coupon.store` null ガード再強化 | `f87867b` |
| `src/lib/schemas.ts` (`AdminCouponFormSchema`) | `scope` 追加 + `superRefine`（STORE→storeId必須／PLATFORM→storeId禁止） | `e2d113b` |
| `src/queries/coupon.ts` (`upsertCouponAsAdmin`) | `isPlatform ? null : storeId` 対応 | `7446308` |
| `src/components/dashboard/forms/admin-coupon-details.tsx` | scope ドロップダウン UI + storeId 欄の条件表示 | `f26262f` |
| `src/queries/coupon.ts` (seller `upsertCoupon`) | P2002 ハンドリング追加 + 重複チェックメッセージを日本語に統一 | `1e1749a` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1387 passed / 1390 total | **1398 passed / 1401 total** |
| スイート数 | 143 | **143** |
| 型エラー | 0 件 | **0 件** |

---

### Phase 5-C: F3-第2段 platform-wide クーポン E2E検証 (2026-06-16)

#### 概要

5-B で実装した PLATFORM scope クーポンを E2E で検証した。なぜ: `Coupon.storeId` nullable 化と `placeOrder`/`applyCoupon`/`updateCheckoutProductWithLatest` の改修はユニットテストでしか確認していなかったため、実際の購入フロー（複数ストア商品 → クーポン適用 → チェックアウト → 注文確定）で UI 表示まで含めて回帰がないことを確認する必要があった。実装過程で `applyCoupon` が `Prisma.Decimal` を含む Cart をそのままクライアントへ返しており、Decimal のメソッドがサーバーアクション境界で失われる既知パターン（`updateCheckoutProductWithLatest` で過去修正済み、`e872af8`）と同型のバグを検出したため、同コミットで先に修正した。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/coupon.ts` (`applyCoupon`) | クライアント返却前に Cart の Decimal フィールドを `toNumber()` でシリアライズ | `ae9364f` |
| `tests/e2e/platform-coupon.spec.ts` | 2店舗カート + PLATFORM クーポン適用 → 注文確定 → 両 OrderGroup の割引・couponId 反映を検証する E2E テスト新規 | `3463d1d` |
| `tests/e2e/seed/constants.ts` / `seed-e2e.ts` | storeB / productB / variantB / `scope: "PLATFORM"` クーポンの seed データは前段で投入済み | `59db81d`（先行） |

#### 次に何をするか

- 残課題（在庫連動・PartiallyRefunded 部分返金）は Phase 5 の対象外。別タスクで扱う。
- Phase 5（F3-第2段 platform-wide クーポン発行）は 5-A〜5-C すべて完了。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 | 1398 passed / 1401 total | **1398 passed / 1401 total**（変動なし） |
| Jest スイート数 | 143 | **143**（変動なし） |
| Playwright E2E（main） | 5 スペック | **6 スペック**（+ `platform-coupon.spec.ts`） |
| 型エラー | 0 件 | **0 件** |

---

### コードレビュー指摘対応（IDOR / クーポン UI / 認可ガード配置） (2026-06-17)

#### 概要

コードレビューで検出された 3 件の有効な指摘を修正。いずれも現行コードで再現を確認済み。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/user.ts` | `updateCheckoutProductWithLatest` の cross-cart IDOR 修正（`cartProducts[0].cartId` のみ検証 → 全 cartProduct を所有カートの cartItem id 集合で検証し複数カート混在・他カート item.id 混入を拒否）+ IDOR 回帰テスト +1 | `ec4192f` |
| `src/components/store/checkout-page/container.tsx` | `isDiscounted` に `isCouponCurrentlyValid` を AND し、失効/無効クーポンの割引 UI とサーバー確定額のドリフトを解消 | `216c2de` |
| `src/queries/coupon.ts` / `coupon.test.ts` | `upsertCoupon`/`getStoreCoupons`/`deleteCoupon` の `requireStoreOwner` を try/catch 外へ移動（tech.md 準拠）、dead な isGuardError 分岐除去、旧ラップ期待 2 件を更新 | `a6b5223` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1399 passed | **1400 passed** |
| スイート数 | 143 | **144** |
| 型エラー | 0 件 | **0 件** |

---

### upsertCoupon cross-store/PLATFORM hijack IDOR 修正 (2026-06-17)

#### 概要

seller 用 `upsertCoupon` の cross-store / PLATFORM クーポン乗っ取り（IDOR）を修正。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/coupon.ts` | `requireStoreOwner` 直後に対象クーポンの所有権を事前検証。`db.coupon.upsert({ where: { id } })` の id 単独キーでは他店舗・PLATFORM(`storeId=null`) クーポンの id を渡すと update 分岐が `storeId` を自店舗へ書き換え乗っ取れた。upsert 前に `findUnique` で対象行を取得し `storeId !== store.id` を `Forbidden` で拒否（DB read のみ try/catch、認可 throw はその外） | `505e13b` |
| `src/queries/coupon.test.ts` | IDOR 3 階層 (a) throw 検証 / (c) 副作用なし検証を他店舗・PLATFORM の 2 ケースで追加（+2） | `f6e75fd` |
| `docs/testing/SECURITY_GAP_REPORT.md` | §6 に発見・修正・追加テストを記録 | `db63bbc` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1400 passed | **1402 passed** |
| スイート数 | 144 | **144**（変動なし） |
| 型エラー | 0 件 | **0 件** |

---

### applyCoupon TOCTOU レースコンディション修正 (2026-06-17)

#### 概要

`applyCoupon` のチェック（Step 4）と書き込み（Step 7）が原子的でなく、並行リクエストが先のクーポンを上書きできた TOCTOU レースを修正。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/coupon.ts` | 無条件 `db.cart.update({ where: { id } })` を `couponId=null` を条件に含めた条件付き `db.cart.updateMany`（DB レベル CAS）へ置換。`count === 0` で `'Coupon is already applied to this cart.'` をスロー、続けて `findFirstOrThrow` で返却形を再構築。両クエリで `userId` スコープ維持 | `3e665be` |
| `src/queries/coupon.test.ts` | 3 階層 (a) throw / (b) where 構造（`couponId: null`）/ (c) 副作用なし の回帰テスト +1。既存正常系 7 件を `updateMany`+`findFirstOrThrow` パターンへ移行 | `da8b9b9` |
| `docs/testing/SECURITY_GAP_REPORT.md` | §7 に発見・修正・追加テストを記録 | （本コミット）|

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1402 passed | **1403 passed** |
| スイート数 | 144 | **144**（変動なし） |
| 型エラー | 0 件 | **0 件** |

---

### applyCoupon Decimal 演算エラー経路テスト追加 (2026-06-17)

#### 概要

`applyCoupon` Step 6（割引計算ブロック）の Decimal 演算例外が try/catch でラップされることを検証するテストを 4 件追加。コードレビューで指摘された未検証エラー経路のカバー。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/coupon.test.ts` | `Prisma.Decimal.prototype.mul/div/add/sub` を各 `mockImplementationOnce` で throw させ、`"Error occurred while applying coupon"` ラップを検証する 4 件を `describe("Decimal演算エラー")` ブロックとして追加 | `04dd88c` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1403 passed | **1407 passed** |
| スイート数 | 144 | **144**（変動なし） |
| 型エラー | 0 件 | **0 件** |

---

### 販売者ダッシュボード Phase 1 + Phase 2-A/2-B（F2 在庫管理 query 層） (2026-06-18)

#### 概要

販売者ダッシュボード F2「在庫管理」の query 層・Zod・型・純粋関数を実装。Phase 1（`Store.lowStockThreshold` スキーマ）と Phase 2-A（在庫 query 3 種 + IDOR 3 階層テスト）/ 2-B（`StoreInventoryRow` 型）が完了。UI（2-C）は未着手。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `prisma/schema.prisma` | `Store.lowStockThreshold Int @default(5)` 追加 + ERD 再生成 | `dbf7127` |
| `src/queries/inventory.ts` | 新規: `getStoreInventory` / `updateSizeStock`（size→variant→product.storeId 所有権チェーンで IDOR 防止）/ `updateStoreLowStockThreshold`。認可は `requireStoreOwner`（try/catch 外）、構造化ログ統一 | `807e5c0`–`a9ad821` |
| `src/lib/schemas.ts` | `UpdateSizeStockSchema` / `LowStockThresholdSchema` 追加 | `7ce4707`–`9c91861` |
| `src/lib/utils.ts` | `getStockStatus` / `StockStatus` を純粋関数として抽出（F2-5、在庫切れ優先判定） | `a9ad821` |
| `src/lib/types.ts` | `StoreInventoryRow` を `Prisma.PromiseReturnType<typeof getStoreInventory>[number]` で導出 | `2dd35b5` |
| `src/queries/inventory.test.ts` | 新規スイート +22（認可/IDOR 3 階層/Zod 弾き/正常系） | `807e5c0`–`9c91861` |
| `src/lib/utils.test.ts` | `getStockStatus` 境界テスト +6（0→out / threshold→low / threshold+1→ok・AC-F2-5） | `a9ad821` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1407 passed | **1435 passed** |
| スイート数 | 144 | **145** |
| 型エラー | 0 件 | **0 件** |

---

### 販売者ダッシュボード Phase 2-C（F2 在庫管理 UI） (2026-06-18)

#### 概要

販売者ダッシュボード F2「在庫管理」の UI 層を実装し、Phase 2（F2）を完了。
`/dashboard/seller/stores/[storeUrl]/inventory` で在庫一覧（DataTable）・在庫数インライン編集・
在庫アラートサマリー・過小在庫しきい値設定が操作可能になった。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/components/dashboard/seller/stock-status-badge.tsx` | 新規: `getStockStatus` → Badge 色分け（out=destructive / low=橙 / ok=outline）+ RTL テスト +3 | `3e2e175` |
| `src/components/dashboard/seller/inventory-quantity-cell.tsx` | 新規: 在庫数インライン編集（`useRef` リエントランシーガード・`updateSizeStock`→toast→`router.refresh()`） | `8da1262` |
| `src/components/dashboard/seller/low-stock-threshold-form.tsx` | 新規: しきい値設定フォーム（`updateStoreLowStockThreshold`、軽量制御コンポーネント） | `966dea9` |
| `src/components/dashboard/seller/inventory-alert-summary.tsx` | 新規: 在庫切れ/過小件数の集計表示（RSC・`getStockStatus` 共有） | `966dea9` |
| `src/app/dashboard/seller/stores/[storeUrl]/inventory/columns.tsx` | 新規: `getInventoryColumns(threshold, storeUrl)` ファクトリ（cell へ threshold/storeUrl 注入）+ `columns.test.tsx` +5 | `b3ba8c9` |
| `src/app/dashboard/seller/stores/[storeUrl]/inventory/page.tsx` | 新規: `force-dynamic` + `requireStoreOwner`（しきい値取得）+ `getStoreInventory` + DataTable | `b3ba8c9` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1435 passed | **1443 passed** |
| スイート数 | 145 | **147** |
| 型エラー | 0 件 | **0 件** |

---

### 販売者ダッシュボード Phase 2-C 仕上げ（F2 在庫管理 UI テスト完備） (2026-06-18)

#### 概要

Phase 2-C のUIハードニング（`updateSizeStock` のアトミック所有権チェック・client boundary 化）の後、
最後まで未整備だった `inventory-alert-summary.tsx` の同階層テストを追加し、2-C 全 6 コンポーネントが
テスト完備となった。これで Phase 2（F2 在庫管理）の UI 層が完了。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/inventory.ts` / `.test.ts` | `updateSizeStock` のアトミック所有権チェック + エラーメッセージ sanitize | `c40708a` |
| `.../inventory/inventory-table-client.tsx` | 在庫テーブルを client boundary でラップ | `92d14ab` |
| `inventory-quantity-cell.test.tsx` / `low-stock-threshold-form.test.tsx` | UI 強化に伴うコンポーネントテスト追加 | `09b2c2e` |
| `src/components/dashboard/seller/inventory-alert-summary.test.tsx` | 新規 +3（out/low 集計マッピング・threshold 境界が行バッジと一致・ゼロ件エッジ） | `8211773` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1443 passed | **1451 passed** |
| スイート数 | 147 | **150**（149 passed + 1 skipped suite） |
| 型エラー | 0 件 | **0 件** |

---

### 販売者ダッシュボード Phase 3-A（F1 店舗ダッシュボード統計 query 層） (2026-06-18)

#### 概要

販売者ダッシュボード F1「店舗統計」の query 層を新規実装。admin `dashboard.ts` を店舗スコープ化
（`requireStoreOwner` + where に `storeId` 注入）し、新規発明を最小化（design.md 判断1）。UI（3-B）は未着手。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/store-dashboard.ts` | 新規。`getStoreDashboardStats`（5 並列集計・売上は親 `Order.paymentStatus=Paid` のみ・`unstable_cache` 20 分でキャッシュキーに `storeId` 含有 NFR-8）/ `getStoreSalesOverTime` / `getStoreRecentOrders` / `getStoreTopProducts` | `f2cd8f1` |
| `src/lib/types.ts` | `StoreRecentOrderType` / `StoreTopProductType` を `Prisma.PromiseReturnType` で導出 | `f2cd8f1` |
| `src/queries/store-dashboard.test.ts` | 新規 +39（認可 3 階層 × 4 関数 / 売上 join / `_sum` null→0 / storeId 別キャッシュキー / DB エラー両分岐） | `f2cd8f1` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1451 passed | **1490 passed** |
| スイート数 | 150 | **151**（150 passed + 1 skipped suite） |
| 型エラー | 0 件 | **0 件** |

---

### 販売者ダッシュボード Phase 3-B（F1 店舗ダッシュボード UI） (2026-06-18)

#### 概要

プレースホルダー `[storeUrl]/page.tsx`（`<div>SellerStorePage</div>`）を店舗 KPI ダッシュボードへ置換。
3-A の query 4 種を `Promise.all` で結線し、presentational コンポーネント 3 本を新規追加。売上チャートは
admin `sales-chart.tsx` を `SalesPoint[]` 共用でそのまま import（依存追加なし・design.md 判断1 の再利用方針）。これで Phase 3 完了。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/app/dashboard/seller/stores/[storeUrl]/page.tsx` | プレースホルダーを `Promise.all([getStoreDashboardStats, getStoreSalesOverTime, getStoreRecentOrders, getStoreTopProducts])` + `force-dynamic`（NFR-4）で置換 | `07bc12e` |
| `src/components/dashboard/seller/store-stats-cards.tsx` | 新規。admin `stats-cards` 派生・6 KPI（総売上/注文/閲覧/販売/商品/在庫アラート） | `4301c85` |
| `src/components/dashboard/seller/store-recent-orders.tsx` | 新規。OrderGroup 行・`toNumberSafe` で Decimal 整形 | `4301c85` |
| `src/components/dashboard/seller/store-top-products.tsx` | 新規。sales 降順 | `4301c85` |
| `src/components/dashboard/seller/{store-stats-cards,store-recent-orders,store-top-products}.test.tsx` | RTL +6（値描画 + ゼロ件エッジ AC-F1-5） | `5e48d5e` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1490 passed | **1496 passed** |
| スイート数 | 151 | **154**（153 passed + 1 skipped suite） |
| 型エラー | 0 件 | **0 件** |

---

### 販売者ダッシュボード Phase 4（F3 在庫減算 + F3-5 在庫復元） (2026-06-19)

#### 概要

販売者ダッシュボード設計の最終フェーズ。注文確定時に `Size.quantity` を一切減らさず**オーバーセル可能**だった
`placeOrder` を、既存 `$transaction` 内の条件付き `updateMany` で **check-and-decrement のアトミック化**に修正
（TOCTOU レース回避）。併せて 4-D（キャンセル/返品時の在庫復元）をユーザー承認のもと実施し、整合性の対を完成。これで全フェーズ完了。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/user.ts` | OrderItem 作成ループ内に条件付き `tx.size.updateMany`（`quantity:{gte}` + `decrement`）追加。`count===0` で `"在庫が不足しています"` throw → `$transaction` 全体ロールバック（F3-1〜F3-3） | `037c8ff` |
| `src/queries/order.ts` | `updateOrderGroupStatusAsAdmin` / `updateOrderPaymentStatus` に在庫復元を結線。更新前ステータスを読み「非終端 → Canceled/Refunded」遷移時のみ `increment`、終端→終端再実行では復元せず二重復元防止。共有ヘルパー `restockOrderItems` + 終端判定を抽出（F3-5） | `eca47a6` |
| `src/queries/user.test.ts` | +3（不足ロールバック / 減算成功 / レース構造 `gte` 検証） | `8cbf4c0` |
| `src/queries/order.test.ts` | +6（グループ/注文単位の復元 + 冪等性 + 非キャンセル遷移） | `b3badc6` |
| `tests/e2e/stock-decrement.spec.ts` | 新規。認証付き購入フロー完走後に `Size.quantity` が注文数分減ることを検証（AC-F3-4・3 ブラウザ） | `1a66ed2` |

#### 設計判断

- **スコープ外（意図的）**: `updateOrderItemStatusAsAdmin`（配送履行軸）と seller 非トランザクション版 `updateOrderGroupStatus` には在庫復元を結線しない。前者は決済キャンセル経路と別軸で二重復元リスクがあり、後者は `$transaction` 化が別変更になるため。両者の TODO コメントは残置。
- **テストの観測点**: パススルー `$transaction` モックでは実ロールバックを再現できないため、不足時は「最終 `order.update`（合計確定）に到達しない」ことで意図を検証。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1496 passed | **1505 passed** |
| スイート数 | 154 | **154**（不変・既存ファイルへ追加） |
| 型エラー | 0 件 | **0 件** |

---

### profile-settings Phase 1（Settings 画面 + 導線修正） (2026-06-19)

#### 概要

顧客向けアカウント設定ページ `/profile/settings` を新規追加し、Clerk `<UserProfile routing="hash" />` を埋め込み。併せて誤リンク・欠落していたユーザーメニュー／サイドバーの Settings 導線を修正。設計は `docs/design/profile-settings/{requirements,design,tasks}.md`。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/app/(store)/profile/settings/page.tsx` | 新規。`<UserProfile routing="hash" />` 埋め込み（force-dynamic 不要・Prisma 非依存） | `9d5629d` |
| `src/components/store/layout/header/user-menu/user-menu.tsx` | `extraLinks` の Settings リンクを誤値 `/` → `/profile/settings` | `1227a5d` |
| `src/components/store/layout/profile-sidebar/sidebar.tsx` | `menu` 配列末尾に Settings エントリ追加 | `e410180` |
| `tests/component/store/user-menu.test.tsx` | Settings リンク回帰テスト（async Server Component を `render(await UserMenu())`） | `413ed19` |
| `tests/component/store/profile-sidebar.test.tsx` | Settings エントリ描画テスト（`usePathname` モック） | `e410180` |
| `tests/component/store/settings-page.test.tsx` | `<UserProfile>` モック描画テスト | `0e32d0a` |

> プロフィール編集（氏名/メール/削除）は既存 Clerk webhook (`src/app/api/webhooks/route.ts`) 経由で Prisma `User` に同期されるため、新規 server action・schema 変更なし。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1505 passed | **1508 passed** |
| スイート数 | 154 | **157** |
| 型エラー | 0 件 | **0 件** |

---

### profile-messages Phase 4（販売者 UI・ループ閉鎖） (2026-06-20)

#### 概要

購入者↔販売者 1:1 メッセージングの**ループを閉じる**販売者 UI を実装。販売者ダッシュボードに会話一覧 + 返信画面を追加し、既存の `sendMessage` / `conversation-thread.tsx` を流用して双方向往復を成立させた。設計は `docs/design/profile-messages/{requirements,design,tasks}.md`（Phase 4）。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/message.ts` | `getStoreConversations` の include に購入者（`user` id/name/picture）を追加（別定数 `storeConversationListInclude`、購入者向けは無改修） | `8ab715e` |
| `src/lib/types.ts` | `StoreConversationWithLatest` 型を追加（`ConversationWithLatest` の superset） | `8ab715e` |
| `src/queries/message.test.ts` | `getStoreConversations` の include アサーション 1 行（テスト数±0） | `8ab715e` |
| `src/components/dashboard/seller/seller-messages-container.tsx` | 販売者コンテナ新規（2 ペイン・左ペインは購入者で識別・右ペインは `conversation-thread.tsx` 流用・5 秒ポーリング） | `d2b987b` |
| `src/app/dashboard/seller/stores/[storeUrl]/messages/page.tsx` | 販売者ページ新規（`force-dynamic` + `getStoreConversations`） | `4781914` |
| `src/constants/{data,icons}.ts` ほか | seller サイドバー Messages 導線 + `MessagesIcon` 新規 | `4781914` |
| `src/components/dashboard/seller/seller-messages-container.test.tsx` | container テスト +7（一覧/fetch+既読/ポーリング/hidden/再フェッチ/ログ） | `95d0005` |

> 返信は購入者と同じ `sendMessage` を呼び、`assertParticipant` が店舗オーナーを参加者として許可する（IDOR 防止は既存 server action 層で担保）。`StoreConversationWithLatest` は構造的部分型で `ConversationThread`（props: `ConversationWithLatest`）に代入可能。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1553 passed | **1560 passed** |
| スイート数 | 160 | **161** |
| 型エラー | 0 件 | **0 件** |

---

### profile-messages Phase 5（E2E 往復・全フェーズ完了） (2026-06-20)

#### 概要

購入者↔販売者メッセージングの**往復を E2E で検証**し全フェーズを完了。`tests/e2e/messages.spec.ts` で「購入者が `/profile/messages` で送信 → 販売者が seller dashboard で受信・返信 → 購入者ページの 5 秒ポーリングが返信を自動受信」を検証（AC-M8）。買い手/売り手の同時セッション維持のため 2 browser context に分離。設計は `docs/design/profile-messages/{requirements,design,tasks}.md`（Phase 5）。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `tests/e2e/messages.spec.ts` | 往復 E2E 新規（2 context・Clerk テストモードで USER/SELLER 動的生成・ACTIVE 店舗 + 会話を `beforeAll` で Prisma 直挿入・`CLERK_SECRET_KEY` 未設定時 `test.skip`・Chromium で往復通過確認・3 ブラウザ対象） | `ea89706` |
| `docs/testing/QA_HANDOFF.md` ほか | E2E スペック数 7→8 を SSOT で同期 + HEAD/履歴更新（本コミット） | （docs 同期） |

> 会話起点 UI（商品/注文画面からの問い合わせボタン）は将来拡張のため、E2E は会話を Prisma 直挿入で用意する。`04-interfaces.md` / `05-workflows.md` は Phase 2〜4 で同期済みのため Phase 5 では変更不要。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 (unit/component) | 1560 passed | **1560 passed**（変動なし・E2E は集計外） |
| スイート数 | 161 | **161**（変動なし） |
| Playwright E2E（main） | 7 スペック | **8 スペック**（+ `messages.spec.ts`） |
| 型エラー | 0 件 | **0 件** |

---

### SonarCloud Quality Gate 修復（PR #145・メッセージング重複解消 + カバレッジ補完） (2026-06-20)

#### 概要

PR #145（dev → main）の SonarCloud 解析が **Duplicated Lines 9.7%（> 3.0%）** で Quality Gate Failed。震源は購入者 `messages-container.tsx` と販売者 `seller-messages-container.tsx` の ~214 行相互コピー（直近 `a3f2cef` で同型実装を同時導入したため）。共通フック + 汎用レイアウトへ抽出して重複を解消し、あわせて新規コードの未カバー分岐（catch の unknown 系統・認証分岐等）を ~100% 分岐まで底上げした。New Issues(4) は「No conditions set」で非ブロッキングのため対象外。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/components/shared/messages/use-conversation-thread.ts` | 新規。ポーリング/既読化/送信後再フェッチ/`selectedIdRef` レースガードを集約。ログ出所は引数化で既存文言を維持 | `456fadf` |
| `src/components/shared/messages/messages-layout.tsx` | 新規。2 ペイン骨格を汎用化。アバター取得元を `getAvatar` アダプタで注入（購入者=店舗 / 販売者=購入者） | `456fadf` |
| `messages-container.tsx` / `seller-messages-container.tsx` | 共有フック/レイアウトを使う薄いラッパへ置換（props は S6759 で `Readonly` 化・public 型と export 名は不変） | `456fadf` |
| `src/queries/message.test.ts` | 全 server action の catch を Error/unknown 両系統 + 未テスト DB エラー経路 + order null でカバー（+14、Branches 74.5%→100%） | `2d5ab8a` |
| `messages-container.test.tsx` / `seller-messages-container.test.tsx` | 共有フック/レイアウトの poll/markRead/handleSent catch 両系統・レースガード false・inFlight・cancelled・no-op・アバター描画（+11/+1、両コンテナ+shared/messages 100%） | `082bf0a` |
| `tests/component/store/user-menu.test.tsx` | 認証済み/未認証/`fullName` フォールバック/catch Error・unknown（+5、37.5%→100%） | `cdc81d5` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 (unit/component) | 1560 passed | **1591 passed** |
| スイート数 | 161 | **161**（不変・既存ファイルへ追加） |
| 型エラー | 0 件 | **0 件** |

---

### Compare 機能（商品比較）実装 (2026-06-21)

#### 概要

`docs/design/compare/` の MVP（Zustand 永続ストア + 比較グリッドページ）に加え、tasks.md 2-B の「Add to compare ボタン」を実装。Red→Green TDD でストア → グリッド → 商品カードボタンの順にコミット分割。footer の「Compare」リンク（既存・配線済み）が初めて到達先を持つ。新規 server action・schema 変更なし（既存 `getProductsByIds` を再利用）。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/compare-store/useCompareStore.ts` | 新規。zustand + persist（`useCartStore` と同型）。バリアント ID のみ保持・上限 4 件・冪等・`isComparing` | `5a1c669` |
| `src/compare-store/useCompareStore.test.ts` | 新規 +8（T-CMP1〜4 add/冪等/上限/削除 + `isComparing`） | `23f7332`/`5a1c669` |
| `src/app/(store)/compare/page.tsx` | 新規。client wrapper（`CompareGrid` を描画・`force-dynamic` 不要） | `2616f88` |
| `src/components/store/compare/compare-grid.tsx` | 新規 client。既存 `getProductsByIds` 再利用・`useEffect` キャンセルフラグ・`items.length===0` で未呼び出し（空配列 throw 回避）・横並びカラム + 個別削除/全消去/スケルトン | `2616f88` |
| `src/components/store/compare/compare-grid.test.tsx` | 新規 +2（T-CMP5/T-CMP6・`getProductsByIds` mock） | `ece4e5c`/`2616f88` |
| `src/components/store/cards/product/product-card.tsx` | Add-to-compare トグルボタン追加（GitCompare・トグル＋トースト・上限 4 超過は `toast.error`・ストアは void のままハンドラ側で分岐） | `bdf3356` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 (unit/component) | 1591 passed | **1601 passed** |
| スイート数 | 161 | **163** |
| 型エラー | 0 件 | **0 件** |

---

### SonarCloud Quality Gate 修復（PR #147 compare 機能）(2026-06-22)

#### 概要

PR #147（compare 機能）の SonarCloud Quality Gate が New Code Coverage 63.6%（< 80%）で Failed。
`product-card.tsx` にテストファイルが無く新規 compare ロジックが 0% だったのが主因。テスト追加で
両ファイル Lines 100% にし QG を通す。New Issues / Duplications は元から 0 で、原因はカバレッジのみ。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/components/store/cards/product/product-card.test.tsx` | 新規 +8（`handleToggleCompare` 3 分岐 [追加/削除/上限 4] + wishlist 成功/失敗 catch + `rating>0 && sales>0` 条件）。toast は callable+`.success`/`.error` を持つモックで再現 | `e8fe553` |
| `src/components/store/compare/compare-grid.test.tsx` | +4（loading スケルトン描画 / 個別 remove / clear all / `getProductsByIds` reject の catch 経路） | `e39a38e` |
| `src/components/store/cards/product/product-card.tsx` | wishlist catch の `error: any` を `unknown` + `instanceof Error` 型ガードへ修正（no-any 規約準拠） | `22bb3f3` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 (unit/component) | 1601 passed | **1613 passed** |
| スイート数 | 163 | **164** |
| 型エラー | 0 件 | **0 件** |

---

### Offers 機能（オファー landing + 導線）実装 (2026-06-22)

#### 概要

`docs/design/offers/` の MVP を実装。プラットフォーム全体のオファー（`OfferTag`）を一覧する公開ページ
`/offers` を追加し、user-menu の「Discounts & Offers」リンク（旧 `""`）を `/offers` に配線した。
商品グリッドは再実装せず、各オファーを既存 `/browse?offer=<url>` フィルタへ委譲（DRY）。新規 server
action・schema 変更なし（既存 `getAllOfferTags` を再利用）。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/app/(store)/offers/page.test.tsx` | 新規 +2（T-OF1 一覧＋`/browse?offer=<url>` リンク描画 / T-OF2 空状態・`getAllOfferTags` mock・`render(await OffersPage())`） | `fd11326` |
| `src/app/(store)/offers/page.tsx` | 新規（async server component・`force-dynamic`・`getAllOfferTags` 再利用・空配列で空状態） | `90f774d` |
| `tests/component/store/user-menu.test.tsx` | T-OF3 回帰 +1（Discounts & Offers→`/offers`、旧 `""` を弾く） | `67c4023` |
| `src/components/store/layout/header/user-menu/user-menu.tsx` | `extraLinks` の Discounts & Offers を `""`→`/offers`（1 行） | `d2cd4e4` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 (unit/component) | 1617 passed | **1620 passed** |
| スイート数 | 164 | **165** |
| 型エラー | 0 件 | **0 件** |

---

### Storefront static pages 実装 (2026-06-22)

#### 概要

`docs/design/storefront-static-pages/` に従い、リンク切れだった footer/ user-menu 導線先の静的ページ群を実装。共有 `StaticPageLayout` + 型付きコンテンツ定数で `/about` `/legal` `/faqs` `/customer-service` `/product-support` を追加し、`/faq`→`/faqs` の 308 恒久リダイレクトと user-menu の Help Center / Legal & Privacy リンクを配線。文面はプレースホルダ（運営差替前提）。新規 server action・schema 変更なし。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/components/store/static/static-page-layout.tsx` | 共有レイアウト部品（plain text `<p>` 描画・XSS 回避・`slugify` 目次） | `fa1f56a`–`de2c3a2` |
| `src/components/store/static/content/*.ts` | コンテンツ定数 5 本（プレースホルダ文面 + `SUPPORT_LINKS`） | (constants commit) |
| `src/app/(store)/{about,legal,faqs,product-support}/page.tsx` | 静的ページ（`metadata` + `StaticPageLayout`・`legal` は `withToc`） | (pages commit) |
| `src/app/(store)/customer-service/page.tsx` | サポートポータル（5 導線カード） | (portal commit) |
| `src/app/(store)/faq/page.tsx` | `permanentRedirect("/faqs")`（308） | (portal commit) |
| `tests/component/store/user-menu.test.tsx` | +2 回帰（Help Center→`/customer-service` / Legal & Privacy→`/legal`） | (test commit) |
| `src/components/store/layout/header/user-menu/user-menu.tsx` | `extraLinks` 2 行配線（旧 `""`） | `227ca0e` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 (unit/component) | 1620 passed | **1629 passed** |
| スイート数 | 165 | **168** |
| 型エラー | 0 件 | **0 件** |

---

### Support forms 実装（2026-06-22）

#### 概要

4 種のサポートフォーム（問い合わせ/返品/紛争/問題報告）を単一 `SupportTicket` モデルに集約して実装。送信は公開（ゲスト可）、ログイン時のみ `userId` を付与。`docs/design/support-forms/` の設計に準拠。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `prisma/schema.prisma` + migration + ERD | `SupportTicket` モデル + `SupportTicketCategory` enum + 逆リレーション（additive・非破壊）、ERD に Support Domain ページ追加 | `e3c58aa` |
| `src/lib/schemas.ts` | `SupportTicketSchema`（`superRefine` 条件必須・`preprocess` 空欄正規化） | `595012e` / `1652212` |
| `src/queries/support.ts` | 公開 server action `createSupportTicket`（PII 非ログ・縮退） | `86404dd` |
| `src/components/store/support/support-form.tsx` | 共有 client フォーム（RHF+Zod・`useRef` 二重送信防止） | `1652212` |
| `src/app/(store)/{contact,returns-exchange,dispute,report-problem}/page.tsx` + `content/returns.ts` | 公開 4 ページ（全て SSG・`force-dynamic` 不付与） | `7aec40e` / `8dd3380` |
| `user-menu.tsx` | 3 リンク配線（returns/dispute/report） | `3608a3b` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 (unit/component) | 1629 passed | **1638 passed** |
| スイート数 | 168 | **170** |
| 型エラー | 0 件 | **0 件** |

---

### 共通レイアウト統一（全店舗ページに Header/Footer）(2026-06-25)

#### 概要

ヘッダー/フッターを各 `page.tsx` で個別描画していたため `/compare` `/returns-exchange` `/product-support` 等で未表示だった問題を、`(store)/layout.tsx` での共通描画に集約して解消。全画面ページ（`order`・`seller/apply`）は共通 chrome を継承しないよう `(fullscreen)` ルートグループへ退避（URL 不変）。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/app/(fullscreen)/` | 新規ルートグループ + Toaster ラッパー layout、`order`/`seller` を `git mv` で退避 | `54d8c07` |
| `src/app/(store)/layout.tsx` | `StoreHeader` + `Footer` を共通描画（cookies 経由で動的化） | `33be2c3` |
| `header.tsx` / `footer.tsx` | ルート要素に `data-testid=store-header/store-footer` 付与 | `33be2c3` |
| `(store)/{page,cart,checkout,browse,product,store}` + `profile/layout.tsx` | 重複 Header/Footer と未使用 import を除去（`CategoriesHeader` は維持） | `b767a24` |
| `(store)/layout.tsx` | sticky footer 化（`flex min-h-screen flex-col` + children `flex-1`）でフッターの浮きを解消 | `1f3ef92` |
| `src/app/(auth)/layout.tsx` + sign-in/sign-up page | 認証ページに共通 chrome 供給（Clerk フォームの `h-screen`→`flex-1` 中央寄せ） | `cc69850` |
| `tests/e2e/layout-chrome.spec.ts` | chrome 表示の E2E（chromium 通過確認）。認証ページ検証含め 7 テスト | `7fdc6ba` / `cc69850` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 (unit/component) | 1650 passed | **1650 passed**（不変） |
| Playwright E2E（main） | 8 スペック | **9 スペック** |
| 型エラー | 0 件 | **0 件** |

---

### Track order 機能実装 (2026-06-26)

#### 概要

公開の注文追跡機能を実装。ログイン不要で注文番号 + メールから配送状況を照会する `/track-order` ページと公開 server action `trackOrder`。footer の「Track your Order」配線済だがページ未実装だった空白を解消。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/lib/schemas.ts` | `TrackOrderSchema`（orderId/email）追加 | `b2a30e5` |
| `src/queries/order.test.ts` | trackOrder IDOR テスト T-TO1〜T-TO6（Red） | `5945810` |
| `src/queries/order.ts` | 公開 `trackOrder`（where:{id} のみ・email 照合はアプリ層・不一致/不存在を同一 null・user 除去・PII 非ログ） | `494811d` |
| `tests/component/store/track-order-form.test.tsx` | フォームテスト T-TO7/T-TO8（Red） | `d636079` |
| `src/app/(store)/track-order/page.tsx`, `src/components/store/track-order/{track-order-form,track-order-result}.tsx` | page + form（RHF+zodResolver・二重送信防止）+ result（共有ステータスタグ流用） | `b57bd40` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 (unit/component) | 1651 passed | **1659 passed**（+8） |
| スイート数 | 171 | **172** |
| 型エラー | 0 件 | **0 件** |

---

### Plan 003: Stripe 決済状態のサーバー導出・配送先住所所有権検証 (2026-07-16)

#### 概要

決済完了状態・金額・通貨をクライアント入力ではなく Stripe の再取得結果から導出し、他ユーザーの配送先住所IDを注文に関連付ける IDOR を防止した。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/stripe.ts` / `stripe-payment.tsx` / `stripe.test.ts` | PaymentIntent ID のみを受け、Stripe 再取得・`metadata.orderId` 照合・不一致拒否へ変更 | `4825e55` |
| `src/queries/user.ts` / `user.test.ts` | `shippingAddress.id + userId` の所有権検証をトランザクション前に追加 | `373ad85` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1662 passed（前回記録） | **1667 passed**（plan 003 は +2、累積ドリフトを同期） |
| スイート数 | 172 | **172** |
| 型エラー | 0 件 | **0 件** |

---

### Plan 023: 公開商品検索ページネーションの境界化・正規化 (2026-07-16)

#### 概要

公開 `index-products` GET の無制限ページネーションを防ぎ、無効な URL パラメータで Prisma 例外にならないよう正規化した。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|----------|
| `src/app/api/index-products/route.ts` | `page` を 1〜10,000、`limit` を 1〜50 に正規化・クランプし、`skip` を有界化 | `7f2365e` |
| `src/app/api/index-products/route.test.ts` | 有効値・過大/負/非数値・過大ページの Prisma 引数と応答メタデータを確認する5件を追加 | `7f2365e` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1667 passed（前回記録） | **1681 passed**（plan 023/024 を統合後に全スイート実測） |
| スイート数 | 172 | **172** |
| 型エラー | 0 件 | **0 件** |

---

### Plan 024: `userCountry` cookie 書き込み検証 (2026-07-16)

#### 概要

公開 API の cookie 書き込みを読取り側と対称にし、不正・過大な入力を保存しないようにした。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|----------|
| `src/lib/utils.ts` / `src/app/api/setUserCountryInCookies/route.ts` | 共通型ガード、JSON/shape/長さ検証、4フィールド投影、`Path=/` を実装 | `58a6bd5` |
| `src/app/api/setUserCountryInCookies/route.test.ts` | 必須6ケースの回帰テストへ更新 | `58a6bd5` |
| `plans/audit/findings-11-security-followup.md` | Plan 024 をDONEに更新 | `8bd7bfd` |

#### テスト統計（統合後）

| 指標 | 値 |
|------|----|
| テスト総数 | **1681 passed / 1684 total**（3 skipped） |
| スイート数 | **171 passed / 172 total**（1 skipped） |
| 型エラー | **0 件** |

---

### CodeRabbit 指摘対応: 決済ステータス写像・エラー遮断・型契約・plans/ja 再同期 (2026-07-17)

#### 概要

`main ← dev` の CodeRabbit 指摘を精査し、実コード 3 件を修正した上で、指摘の大半（約 65 件）の根本原因だった
`plans/ja/` のドリフトを構造的に解消した。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|----------|
| `src/queries/stripe.ts` | 未完了 intent（`processing` / `requires_action` / `requires_confirmation` / `requires_capture`）を `Failed` に確定させず `Pending` へ写像。`canceled` は `Cancelled` に分離。3DS 認証中の注文が後続 webhook の `succeeded` と矛盾しなくなった | `d093373`（Red）→ `35c402f`（Green） |
| `src/queries/order.ts` | `updateOrderItemStatus` の `updateMany` を try/catch で包み、生 Prisma エラーの UI 露出を遮断（認可ガードは規約どおり try の外に維持） | `1d99179` |
| `src/queries/stripe.test.ts` | `as never` 11 箇所を除去。`never` は全型に代入可能なため、引数契約の変更を無条件に黙らせていた | `d330e34` |
| `plans/ja/` | `ADVISOR_STATE.md` / `README.md` / `audit/**` は英語原本の訳ではなく**日本語原本の複製**だったため削除（原本の成長にコピーが追随せず 26〜98 行乖離。`findings-02` は原本とバイト同一）。`README.md` は索引を複製しない範囲宣言に作り替え | `c449c82` |
| `plans/ja/001-012` | 真の訳である 12 本を原本と再同期。004 は override が脆弱な `^3.0.5` を指示していた（原本は `3.0.6` 厳密ピン）、005 は「原子性を証明する」と誤記（原本は明確に否定）、001 は原本が否定した grep 検証のまま、002 は未出荷の旧実装、010 はテスト欠落、012 は採番衝突 | `e9ba111` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1681 passed / 1684 total | **1685 passed / 1688 total**（3 skipped） |
| スイート数 | 172（171 passed + 1 skipped） | **174**（173 passed + 1 skipped） |
| スナップショット | 127 | **127**（変化なし） |
| 型エラー | 0 件 | **0 件** |

> スイート +2 は本セッションの追加ではなく、先行コミット由来の未同期分（`src/lib/log.test.ts`
> = plans 007-009 のログ集約 / `place-order.test.tsx` = 二重送信ガード）を取り込んだもの。

---

### CodeRabbit 指摘対応 第2弾 (2026-07-17)

#### 概要

Stripe PaymentIntent の初期状態を決済失敗と誤判定しないよう分岐を修正し、ページネーションコメントとテスト統計を同期した。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/stripe.test.ts` | `requires_payment_method` のエラー有無による分岐を回帰テストで固定 | `444a129` |
| `src/queries/stripe.ts` | `last_payment_error` ありを `Failed`、なしを `Pending` に写像 | `c57e239` |
| `src/app/api/index-products/route.ts` | 小数値を拒否せず切り捨てる実装にコメントを一致 | `2631481` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1685 passed / 1688 total | **1686 passed / 1689 total**（3 skipped） |
| スイート数 | 174（173 passed + 1 skipped） | **174**（173 passed + 1 skipped） |
| スナップショット | 127 | **127**（変化なし） |
| 型エラー | 0 件 | **0 件** |

---

## 参照ドキュメント

| ドキュメント | 目的 |
|-------------|------|
| `docs/testing/TEST_IMPLEMENTATION_PLAN.md` | テスト実装計画（P0/P1/P2 優先度付き） |
| `docs/testing/TESTING_DESIGN.md` | テスト設計方針・ヘルパー関数パターン |
| `docs/migration/06-framework-upgrade.md` | Next.js 16 マイグレーションの詳細記録 |
| `specs/multi-vendor-ecommerce/` | SDD 仕様書群（Single Source of Truth） |
| `.claude/steering/tech.md` | 実装パターン・コーディング規約 |

---

### CodeRabbit 指摘対応 第3弾（ソースコード 4 件） (2026-07-17)

#### 概要

CodeRabbit が `dev` に出した 83 件のうち、ソースコードを対象とする 4 件を精査して対応した。
精査の結果、2 件は実バグ、2 件は「既に正しい挙動の回帰ロック欠落」であることが判明し、
severity は指摘の見立てと一部食い違った。「未来日付」系 5 件は当日日付のため誤検知と判定。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/components/store/cards/place-order.tsx` | `push()` を待たず `finally` が無条件にガード解除 → 遷移中に `placeOrder` 再実行（Red で 2 回を実測）。`navigating` フラグで成功経路の解除をスキップ | `0166533` |
| `src/lib/schemas.ts` / `src/app/dashboard/admin/orders/page.tsx` | `AdminOrderFilterSchema.page` に上限が無く `?page=1e12` が `skip`≈5e13 まで素通り。`MAX_PAGE=10_000` でクランプし `page.tsx` の非対称も解消 | `fa25439` |
| `src/app/api/setUserCountryInCookies/route.test.ts` | `HttpOnly` / `SameSite=lax` の検証を追加（ソースは既に正しい・後退検知のみ欠落） | `75535f4` |
| `src/queries/store.test.ts` | `applySeller` の評価系除外を回帰ロック化（`upsertStore` 側には既存・非対称の解消） | `3247e42` |
| `docs/architecture/expansion/*` | `plans/` を「git 未追跡」とする誤記 6 箇所を是正（実際は 93 ファイルが追跡対象）。SSOT の論拠を追跡状態から「宣言と凍結」へ | `9dde461` |
| `plans/057-upgrade-next-middleware-bypass.md` | `^16.2.10` は 16.3+ を許容し「16.2.x 限定」の宣言と矛盾。tilde（`~16.2.10`）へ是正 | `e08978c` |

#### 判明した事実（次セッションへの引き継ぎ）

- **重複注文は発生していなかった**: `emptyUserCart` は `db.cart.delete` でカート行ごと削除するため、
  2 回目の `placeOrder` は `Cart not found.` で throw する。実害は「成功したのに誤エラートースト」。
  冪等性キーの導入は過剰と判断し不採用。
- **`applySeller` / `upsertStore` は同じ `pickSellerEditableStoreFields` を共有**。allowlist を壊すと
  両テストが同時に Red になることを実証済み。片方だけロックがある状態は穴なので対称を保つこと。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1686 passed / 1689 total | **1689 passed / 1692 total** |
| スイート数 | 174 | **174**（不変） |
| 型エラー | 0 件 | **0 件** |
| lcov | S 65.63 / B 45.29 / F 54.33 / L 64.59 | **S 65.65 / B 45.33 / F 54.36 / L 64.61** |

#### 残課題

CodeRabbit の残り 77 件は docs 整合系が大半。`plans/README.md` の "Depends on" 矛盾は
文書自身が L172-175 で自認済みのため、指摘の詳細なしで着手可能。

---

### CodeRabbit ローカルレビュー対応 第4弾（2026-07-17）

#### 概要

CodeRabbit VSCode 拡張が未プッシュの 25 コミットに対して出した 73 件の指摘を triage し、
`src/` 本番コード 4 件と docs/テスト統計整合 10 件に対応した（`plans/` 59 件は次段へ繰越）。
指摘は GitHub 上に存在せず `gh api` で取得できないため、各指摘を実コードへ照合して
妥当性を判定した。判定記録は [`plans/audit/VETTED_FINDINGS.md`](../plans/audit/VETTED_FINDINGS.md)。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/components/store/cards/place-order.tsx` | 注文確定と同時にガードを恒久化。後片付け失敗で再注文できた実バグを修正 | `5192aea`→`cc7468c` |
| `src/queries/order.ts` | エラーログ 7 箇所を `logError` へ統合（監査ログ 3 箇所は対象外） | `cd12973` |
| `src/queries/stripe.ts` | 有効な PaymentIntent を一意に検証し、確定状態からの退行を拒否 | `91020b3`→`ab97f8f` |
| `src/queries/user.ts` | カート保存を Serializable + 冪等 `deleteMany` で直列化 | `f4bddb3`→`f046d22` |
| `scripts/coverage-dashboard/scan-tests.ts` | `it.each` の展開を数え、ダッシュボードの integration 件数を 14→17 に是正 | `a1fe1bb`→`c1be6d7` |

#### 判断メモ

- stripe の指摘を字面どおり「`succeeded` 以外を拒否」と実装すると、`toOrderPaymentStatus` が
  意図的に全ステータスを写像している既存仕様と既存テストを壊す。真の脆弱性は
  「同一注文の古い intent による確定済み決済の退行」だったため、確定状態ガード +
  有効 intent id の一致確認という形に読み替えて実装した。
- ダッシュボードの数値ズレは HTML でも docs でもなく **scanner のロジック**が SSOT だった。
  rule 02/03 の「生成物は手編集せず SSOT を直す」に従い `scan-tests.ts` を修正した。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1689 passed / 1692 total | **1699 passed / 1702 total** |
| スイート数 | 174 | **174**（変化なし） |
| Integration（ダッシュボード集計） | 14（実測 17 と乖離） | **17**（実測と一致） |
| 型エラー | 0 件 | **0 件** |

---

### improve Round 13 P1 第1弾: plan 057 + plan 058（2026-07-18）

#### 概要

依存層 P1 の plan 057（`next` の HIGH advisory 解消）と Round 13 セキュリティ P1 の
plan 058（`getCoupon` cross-store IDOR read 修正）を dev に順次コミットで実行した。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `package.json` / `bun.lock` | `next` を `^16.2.1` → `~16.2.10` に bump（GHSA-26hh-7cqf-hhc6 HIGH ほか 3 advisory 解消。tilde で 16.2.x に固定） | `10e35f3` |
| `src/queries/coupon.ts` | `getCoupon` を `requireStoreOwner` + `findFirst { id, storeId }` にスコープ、`getCouponAsAdmin`（`requireAdmin` + 非スコープ）新設 | `15c9a96` |
| seller / admin `coupons/columns.tsx` | 新シグネチャ / 新関数への呼び出し更新（計 2 箇所） | `15c9a96` |
| `src/queries/coupon.test.ts` | IDOR 3 階層回帰テスト追加 + 既存 getCoupon テストの署名更新（77→84） | `15c9a96` |

#### 検証

- `bun audit`: next の 3 advisory 消滅（handlebars CRITICAL は既知の dev-only 残存 = DEPS-05）
- 未認証 `/dashboard` / `/profile` は Clerk へ 307 リダイレクト（smoke 実施済み。非 document リクエストは 404 = いずれも保護動作）
- 詳細記録: `docs/testing/SECURITY_GAP_REPORT.md` §8

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1699 passed / 1702 total | **1707 passed / 1710 total** |
| スイート数 | 174 | **174**（変化なし） |
| 型エラー | 0 件 | **0 件** |

---

### improve Round 13 P1 第2弾: plan 059（2026-07-18）

#### 概要

PayPal capture 経路を Stripe capture と同水準のガードに引き上げた（plan 059 / SECURITY-12・13）。
過少支払いによる Paid 化と、遅延/DENIED capture による確定済みステータスの退行を遮断。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/stripe.ts` | `isSettledPaymentStatus` を export（ロジック不変・確定済みステータス SSOT の共有） | `6a31da1` |
| `src/queries/paypal.ts` | capture 前の settled ガード + custom_id/金額（`Prisma.Decimal.equals`）/通貨の突合。検証エラーは catch で透過 | `6a31da1` |
| `src/queries/paypal.test.ts` | 負系 5 ケース追加（15→20）。既存モックに custom_id・total 整合を追加 | `6a31da1` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1707 passed / 1710 total | **1712 passed / 1715 total** |
| スイート数 | 174 | **174**（変化なし） |
| 型エラー | 0 件 | **0 件** |

詳細記録: `docs/testing/SECURITY_GAP_REPORT.md` §9

---

### improve Round 13 P1 第3弾: plan 060（2026-07-18・P1 全 4 プラン完走）

#### 概要

クーポン mutation にサーバー側 Zod 検証を導入した（plan 060 / SECURITY-14）。
直接呼び出しで discount>99 を永続化し注文 total を負値化できる money-critical ギャップを
書き込み境界で遮断。これで Round 13 P1（058/059/060）+ 依存層 P1（057）の 4 プランが完走。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/coupon.ts` | `upsertCoupon` に `CouponFormSchema.safeParse` ゲート、`upsertCouponAsAdmin` に `AdminCouponFormSchema.safeParse` ゲート。両者ともスプレッド書き込みを `parsed.data` + サーバー強制フィールドの明示マッピングへ置換 | `c67b833` |
| `src/queries/coupon.test.ts` | 負系 4 + 明示マッピング検証 1 を追加（84→89）。upsert 系既存テストを `createValidCouponInput`（ISO 文字列日付）へ更新 | `c67b833` |

#### 判断メモ

- 共有 fixture `MockCoupon` の `startDate`/`endDate` は `Date` 型で、Prisma モデルの
  `String` と乖離している（既存テストは `as never` で黙殺）。本番 shape はスキーマと
  一致するためプランの STOP 条件（「dates are not strings after all」）には該当せず、
  テストファイル内ヘルパーで ISO 文字列入力を生成する最小対応とした。
  fixture 本体の是正は全域に波及するためスコープ外の別課題。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1712 passed / 1715 total | **1717 passed / 1720 total** |
| スイート数 | 174 | **174**（変化なし） |
| 型エラー | 0 件 | **0 件** |

詳細記録: `docs/testing/SECURITY_GAP_REPORT.md` §10

---

### improve Round 13 P2 — レスポンス強化ヘッダ + 検索 route の error.message 漏洩停止 (2026-07-18)

#### 概要

security 分類の P2 プラン 2 本（061 / 062）を TDD（Red→Green）で実装。いずれも
未認証クライアントに対する露出面を塞ぐ変更で、相互依存はない。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `tests/e2e/security-headers.spec.ts` | 新規。5 ヘッダの**値**を `/` と `/checkout` で厳密アサート（Red 確認済み） | `4e2c4fa` |
| `next.config.mjs` | `async headers()` で全ルート（`/:path*`）へ 5 ヘッダを付与 | `afd22b3` |
| `src/app/api/index-products/route.test.ts` | POST/GET の 500 分岐テスト +2（Red 時に漏洩を実証） | `5ef0dfe` |
| `src/app/api/index-products/route.ts` | catch 2 か所を `unknown` + 固定 `"Internal Server Error"` へ。JSDoc も同期 | `492e9ac` |

#### 設計上の要点

- **ヘッダは名前ではなく値をアサートする**: `grep -iE 'x-frame-options|...'` 方式ではヘッダ名の
  存在しか見ておらず、`X-Frame-Options: ALLOWALL` のような値の緩和を検知できない。E2E と
  curl smoke の双方で 5 値すべてを厳密比較する方式に統一した。
- **500 分岐への到達方法**: `route.ts` は入れ子 try/catch で、内側 catch のフォールバック
  `findMany` は try で包まれていない。よってモックを 2 回 reject させると outer catch へ伝播し、
  route を改変せずに 500 を踏める。
- **CSP は意図的に対象外**: Clerk / Stripe / PayPal / Cloudinary の allowlist と Report-Only
  ロールアウトが必要なため、SECURITY-06 の CSP 分は継続課題として残す。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1717 passed / 1720 total | **1719 passed / 1722 total** |
| スイート数 | 174 | **174**（変化なし） |
| Playwright E2E スペック | 9 | **10**（security-headers 追加・3 ブラウザ 6/6 pass） |
| スナップショット | 127 | **127**（変化なし） |
| 型エラー | 0 件 | **0 件** |

検証: curl 厳密値 smoke が `/` `/checkout` 両方で 5/5 完全一致を報告。

---

### CodeRabbit ローカルレビュー対応 Phase 1（ソースコード実バグ 5 件）(2026-07-18)

#### 概要

VSCode CodeRabbit 拡張のローカルレビュー 50 件のうち、ソースコードに対する
指摘 5 件を精査して修正した。残る 45 件（`plans/**` 40 件・`docs/`・`.agent/` 5 件）は
Phase 3-4 として別途対応する。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `.coderabbit.yaml` | 設定コメント（plans/ 全除外）と実装（1 ファイルのみ除外）の食い違いを解消するため廃止 | `f088dca` |
| `scripts/coverage-dashboard/scan-tests.ts` | 開き括弧自身が `hasContent` を立て `it.each([])` を 1 件と数えていたのを是正 | `b5eb8d1` |
| `src/components/store/cards/place-order.tsx` | 無保護だった同期 `emptyCart()` を try/catch で包み、成立済み注文の遷移を継続 | `f4aba5f` |
| `src/lib/db-retry.ts` (新規) | `retryOnSerializationFailure`（P2034 限定・指数バックオフ + ジッター） | `d8108b5` |
| `src/queries/user.ts` | `saveUserCart` の Serializable transaction に P2034 再試行を適用 | `e5903c8` |
| `src/queries/stripe.ts` | `paymentIntents.create` に orderId + 金額由来の冪等キーを付与 | `ae585a7` |
| `src/queries/stripe.ts` / `src/lib/payment-status.ts` | 決済状態更新を単一 transaction + 条件付き update（CAS）へ変更。`SETTLED_PAYMENT_STATUSES` を公開 | `c77cdd7` |

#### 判断メモ

- **`src/queries/store.ts:436` は修正しない**。「200 件超が無告知で閲覧不能」という指摘の
  前提が誤りで、呼び出し元 `orders/page.tsx` に `Showing up to the latest {STORE_ORDERS_MAX}
  orders.` の告知があり、`store-constants.ts` にも PERF-04 follow-up と明記されている。
- **冪等キーに金額を含める**のは、Stripe が「同一キー・異なるパラメータ」の再送をエラーで
  拒否するため。`orderId` だけを鍵にすると、クーポン適用等で合計が正当に変わった時点で
  決済が永久に通らなくなる。
- **CAS の相手は webhook**。`src/app/api/webhooks/stripe/route.ts` は `$transaction` を
  使っているが条件付き update ではないため、server action 側で「未確定であること」を
  where に含めて退行を防ぐ設計とした。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1719 passed / 1722 total | **1738 passed / 1741 total** |
| スイート数 | 174 | **175**（`src/lib/db-retry.test.ts` 新設） |
| スナップショット | 127 | **127**（変化なし） |
| 型エラー | 0 件 | **0 件** |

---

### CodeRabbit ローカルレビュー対応（plan/audit doc + 実コード 3 件のセキュリティ修正）(2026-07-24)

#### 概要

CodeRabbit のローカルレビュー指摘を精査し、plan/audit ドキュメント 21 件の整合修正に加え、
ドキュメント上で OPEN と明示した実コードの脆弱性 3 件を Red→Green で修正。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `next.config.mjs` / `security-headers.spec.ts` | HSTS を `NODE_ENV=production && VERCEL_ENV!=='preview'` に限定（Vercel preview 毒回避）。E2E は付与条件を鏡写しに | `2960381` / `8857847` |
| `src/queries/user.ts` / `user.test.ts` | `placeOrder` の住所所有権 TOCTOU を tx 内再検証で閉塞（+1 テスト） | `b95f847` / `8e2d6dd` |
| `src/app/api/webhooks/route.ts` / `route.test.ts` | `user.deleted` で SupportTicket PII を削除前に秘匿化（GDPR 消去・+1 テスト） | `7e3e507` / `e886b57` |
| plan/audit docs 21 件 | 本文と Done criteria の乖離・SSOT パス・件数・旧前提の履歴化・検証コマンド誤検出などの整合修正 | 個別コミット |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1738 passed / 1741 total | **1746 passed / 1749 total** |
| スイート数 | 175 | **175**（変化なし） |
| スナップショット | 127 | **127**（変化なし） |
| 型エラー | 0 件 | **0 件** |

---

### CodeRabbit レビュー 24 件対応（docs 22 件 + 実コード 2 件） (2026-07-26)

#### 概要

CodeRabbit のレビュー指摘 24 件を精査（誤検出なし）。plan/docs/specs の記述整合 22 件に加え、
プラン文書が「実コード未対応」と自認していた 2 件を、文書だけ直すとドリフトが確定するため
実コードごと修正した（`.int()` は Red→Green）。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/lib/schemas.ts` / `coupon.test.ts` | `CouponFormSchema.discount` に `.int()`。`50.5` が `safeParse` を通過し Prisma の `Int` 列まで到達していた（admin 経路は reject せず resolve）。plan 060 の未達 Done criterion を解消（+2 テスト） | `11d68f89`(Red) / `6d0cd9dc`(Green) |
| `next.config.mjs` / `security-headers.spec.ts` / `.env.docker.example` | HSTS の `includeSubDomains; preload` を環境名判定から明示 opt-in（`HSTS_INCLUDE_SUBDOMAINS` / `HSTS_PRELOAD`）へ分離。`NODE_ENV=production` は本番ドメイン配信を意味せず、self-host staging で非可逆な preload 登録を誤発火させ得た | `10b3fd1f` / `66ed444f` |
| `plans/011`(en+ja) | スキャンゲートのベース名除外が ja 版を巻き添えにしていた問題と、`\|\| true` で常に exit 0 になる問題を修正。Clerk URL 変数の optional/required 矛盾も解消 | `39b5b480` |
| `plans/031` / `032` | `Promise.all` だけでは並行性を証明できない（プール 1 で逐次化）ため、バリア（latch）を必須化。032 の `grep "Promise.all"` ゲートを名指しテスト実行へ置換 | `f74f6fba` |
| `plans/033` / `041` | 5b 追加分の Verify 件数（8→9）と、041 の撤回済み STOP 条件・unit scope 矛盾を是正 | `d73e7dac` |
| `plans/038` | 共有 DB のスキーマを変える一時 DDL の隔離・直列化を任意表現から MUST へ格上げ | `6aa87b9e` |
| `plans/013` / `018` / `029` | 旧 URL 対応表のキー曖昧性、冪等性キーの入力束縛の実装不能形、fake timer 未復元を是正 | `f7796188` |
| `plans/047` | セント整数と `Prisma.Decimal` 規約の適用境界を明示 | `0fd1e67c` |
| `plans/057` / `plans/README.md` | `^16` では 16.2.x に固定できない問題（自プランの STOP 条件を踏む）を `~16.2` へ。058〜062 の完了済み実行順を履歴化 | `5e8e7379` |
| `plans/audit/*` / `ADVISOR_STATE.md` / `ja/004` | Clerk advisory の影響範囲が台帳内で 2 通りに割れていた件を、`gh api /advisories/GHSA-vqx2-fgx2-5wq9`（`>=7.0.0 <7.2.1` / patched 7.2.1）で確定して統一。DEPS-08 の履歴値と現行値を分離。CAS ガードを tx 原子性の解消と扱わないよう切り分け（実コード確認: Stripe は tx 化済み・PayPal は非原子のまま） | `6ab1c4a4` / `bc5d9241` |
| `docs/PROGRESS.md` / `rate-limiting-spike.md` | 基準日のずれ、CloudFront-Viewer-Address の Origin Request Policy 前提とフェイルクローズ要件を追記 | `24679550` |
| `specs/07-testing.md` | 1738→1746 の差分 +8 と「+2」の単位不一致を SSOT の説明へ整合 | `a688080f` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1746 passed / 1749 total | **1749 passed / 1752 total** |
| スイート数 | 175 | **175**（変化なし） |
| スナップショット | 127 | **127**（変化なし） |
| 型エラー | 0 件 | **0 件** |

---

### CodeRabbit レビュー 24 件の残 8 件対応（「本文が無いと確定できない」区分の解消） (2026-07-26)

#### 概要

見出しのみで判断を保留していた 8 件について、コメント本文の提供を受けて全件を再精査した結果、
**8 件すべてが実欠陥**と確定したため対応した。うち 2 件は実コード、6 件はプラン／監査台帳の欠陥。

特に HSTS は、`next.config.mjs` が**同一ファイル内で**「`NODE_ENV=production` は本番ドメインで
配信中を意味しない」と明記しながら、その論理を拡張ディレクティブにしか適用していない
非対称な状態だった（前回対応の適用漏れ）。plan 005 は DONE でありながら自身の主張が未検証
であることを自認しており、ステータス格下げではなくテスト追加で解消した。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `next.config.mjs` / `security-headers.spec.ts` / `.env.docker.example` | HSTS の付与判定を「環境名」から「**配信先シグナル**」（`VERCEL_ENV=production` または `HSTS_ENABLED=1`）へ移行。bare な production ビルド（self-host staging 等）に 2 年 max-age が記録されるのを閉塞。`!isVercelPreview` はプロジェクト全体 env の漏れ対策として独立した拒否条件で残置。9 env 組合せで実測 | `a1f00f79`(Red) / `dcc41fe6`(Green) |
| `src/cart-store/useCartStore.test.ts` | `persist ラウンドトリップ` を新設（+3）。インメモリ状態を破棄してから `persist.rehydrate()` する形で「リロード後に復元される」を検証。`f77f0965` の元バグ再注入で 2 件 fail を確認し非空振りを実証 | `4531d574` |
| `plans/005` | DONE のまま未検証ギャップを抱えていた状態を解消。ラウンドトリップテストを完了条件へ昇格。バグ再注入の位置（`set()` の前だと persist が即上書きするため再現しない）も明記 | `894b741f` |
| `plans/061` | 訂正その 2 として三条件ゲートと 9 ケースの実測表を追記。curl スモークの期待値（bare `next start` は 4/4）と Done criteria を同期 | `d4130659` |
| `plans/011`(en+ja) | env 検証が `src/` の `process.env` 13 変数しか見ておらず、Clerk/Prisma がライブラリ内部で読む `CLERK_SECRET_KEY` / `DATABASE_URL` / `DIRECT_URL` の欠落を検出できなかった（Step 2 の superset 指示と不一致）。両ソースの和集合を走査する実行可能ゲートへ差し替え、除外は理由付きで明示列挙。実測で Step 2 の 19 変数と完全一致 | `efbe9790` |
| `plans/015` | ts_rank キーセット述語が PostgreSQL で実行不能だった（`WHERE` から SELECT 出力別名は参照不可。既存実装の `ORDER BY relevance` が合法なため誤解を誘発）。`ranked` CTE 形へ書き換え + 実 SQL 実行を Verify 要件化 | `b156f2a8` |
| `plans/021` | Q4 と STOP 条件がベンダー中立化済みの前提節に反し Vercel 固定のままだった件を実行モデル記述へ。`dedupeKey` の「1 回だけ送る」絶対保証が直後の at-least-once 選択肢と矛盾していた件を、unique 制約が実際に保証する範囲へ限定 | `e024b72b` / `cded2ed8` |
| `plans/027` | ヘルパー化後の `jest.mock` factory 実装を明示（巻き上げのため factory 内はローカル `requireActual` 固定・NG 例併記）。`mock` 接頭辞の命名規則は ts-jest では救済にならない点も追記 | `93f5770f` |
| `plans/audit/findings-06` | 現行状態（`^7.5.0`）と監査時点 Evidence（`^7.0.7`）を別見出し + 日付で構造分離。単一バレットの引用でも誤読しないようにした | `b23c1676` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1749 passed / 1752 total | **1752 passed / 1755 total** |
| スイート数 | 175 | **175**（変化なし） |
| スナップショット | 127 | **127**（変化なし） |
| 型エラー | 0 件 | **0 件** |

---

### CodeRabbit レビュー 46 コメントの精査と対応 (2026-07-26)

#### 概要

`dev` ブランチ向け CodeRabbit レビュー（25 issue / 46 コメント）を全件実ファイルに当てて検証し、
実欠陥 22 / 偽陽性 10 / 環境制約で保留 1 に仕分けたうえで対応した。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/lib/pii.ts`(new) / `src/app/api/webhooks/route.ts` | App Router の route ファイルが許さない named export `REDACTED_PII` を共有モジュールへ退避 | `bfcf52ba` |
| `src/components/store/cards/place-order.test.tsx` | `clearAllMocks` を越えて残る `mockImplementation` の throw を `mockReset()` で遮断 | `7fe521e5` |
| `src/queries/stripe.ts` / `stripe.test.ts` | 冪等キーが canceled 済み intent を返し続け、注文がその金額で恒久的に決済不能になる経路を閉塞（Red → Green・回帰 +2） | `4111e0ad` / `96856785` |
| `plans/023` `plans/042` `plans/044` `plans/ja/009` `plans/ja/011` | 検証コマンドのスコープと POSIX 互換化（awk の範囲・実装形状の検証・`\s` 依存・双方向 comm） | `5ee2fc33`〜`642c8b51` |
| `plans/031` `plans/032` | in-process latch は並行性の必要条件であって証明ではない旨へ表現を修正 | `83808001` |
| `plans/047` `plans/056` `plans/013` `plans/015` `plans/018` `plans/021` `plans/038` | assertion 契約と spike 仕様の欠落（金額トークンのアンカー・2xx 判定・URL 後方互換・Seq Scan・NOT NULL 冪等キー・排除済み選択肢・事前 DROP） | `75ac134f`〜`ac967364` |
| `plans/audit/findings-18` `plans/audit/recon.md` `plans/README.md` `docs/architecture/rate-limiting-spike.md` | 監査台帳の値割れ 5 件・Round 13 の計画範囲と 057 の完了状態・ALB の XFF append 前提 | `02dd60b9`〜`7d063a10` |

**未対応（理由付き）**:

- `package.json` の `next` 16.2.11 bump — 作業環境がネットワーク到達不可で lockfile 更新も
  `bun audit` による advisory 照合もできない。ネットワーク有り環境で実測込みで対応する。
- 「未来日付の実測を確定実績として記録するな」系 10 件 — リポジトリ全体を grep しても
  2026-07-26 を超える日付は存在しない（ヒットはクーポン有効期限 `2026-12-31` と
  テストフィクスチャ `2027-12-31` のみ）。偽陽性として変更しない。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1752 passed / 1755 total | **1754 passed / 1757 total** |
| スイート数 | 175 | **175**（不変） |
| スナップショット | 127 | **127**（不変） |
| 型エラー | 0 件 | **0 件** |

---

### CodeRabbit レビュー 19 コメントの精査と対応（第 4 弾） (2026-07-27)

#### 概要

`dev → main` PR に付いた CodeRabbit 19 コメント（見出しのみ判明）を実測でリポジトリに
突き合わせ、**確認済み 18 / 誤検知 1** に仕分けたうえで実コード 2 件を Red → Green で修正した。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/coupon.test.ts` | 検証・重複コードエラーの文言を正規表現アンカーで完全一致に固定（Red・+4） | `76a96296` |
| `src/queries/coupon.ts` | `isDomainError` を追加し、意図的 throw を catch 冒頭で素通し（Green） | `fba1cf46` |
| `scripts/coverage-dashboard/scan-tests.test.ts` | 修飾子付きテストの計上 + 過大計上ガード 2 件（Red・+3） | `ff9f5c28` |
| `scripts/coverage-dashboard/scan-tests.ts` | `BLOCK_PATTERN` に修飾子を列挙形で許容（Green） | `8637bca5` |

**根本原因の要点**:

- **coupon**: `safeParse` 失敗の throw が `try` の内側にあり、catch が
  `Error occurred while trying to upsert coupon: ${message}` で上書きしていた。
  フォームへ「クーポンの入力値が不正です。」を返せず、ユーザー入力ミスが `logError` にも載っていた。
  **既存テストが検出できなかった理由**は `toThrow(string)` の部分一致で、ラップ後の文言にも
  部分文字列として含まれていたため。
- **dashboard**: `BLOCK_PATTERN` が `test.skip(` にマッチせず（`test` の直後が `.`）、
  `tests/e2e` の skip 14 件が 0 件計上。`e2e × pages` が 23 と表示され、SSOT の 37
  （= 111 テスト ÷ 3 ブラウザ）と乖離していた。`it.each` の欠陥（`c1be6d7`）と同型の再発。

**誤検知（修正せず記録）**:

- 「`coverage-dashboard.html` の `byDomain` に `api-routes` が無く、ドメイン合計 187 件」
  — 直近 5 バージョンすべてに `"api-routes":6` が存在し、合計は 193 = `totalTestFiles`。
  指摘値 187 はちょうど `193 - 6` で、当該キーを読み落とした集計。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1754 passed / 1757 total | **1761 passed / 1764 total** |
| スイート数 | 175 | **175**（不変） |
| スナップショット | 127 | **127**（不変） |
| 型エラー | 0 件 | **0 件** |

---

### CodeRabbit レビュー 17 コメントの精査と対応（第 5 弾） (2026-07-28)

#### 概要

全 17 件を実測でリポジトリに突き合わせ、**確認済み 17 / 誤検知 0**。実コード 3 件を
Red → Green で修正し、docs 11 件は plan/audit の整合修正。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/coupon.test.ts` | `get`/`delete` 系 5 関数の文言を正規表現アンカーで完全一致に固定（Red・件数不変） | `8a648282` |
| `src/queries/coupon.ts` | 第 4 弾で `upsert` 系に入れた `isDomainError` を `get`/`delete` 系へ適用（Green） | `2cc7368d` |
| `src/components/dashboard/.../columns.test.tsx`（seller クーポン） | 編集モーダルの reject 処理を固定する新規スイート（**+7**） | `e1a8b710` |
| seller クーポン `columns.tsx` | `getCoupon` reject に try/catch + destructive トースト + `setClose()`（Green） | `8df613c1` |
| `scripts/coverage-dashboard/scan-tests.test.ts` / `.ts` | `EACH_PATTERN` が `it.skip.each` / `test.only.each` を拾わない欠陥（回帰 +1） | `73d68b57` / `15ff8eb2` |

**根本原因の要点**:

- **coupon（第 4 弾の同一欠陥クラスの残存）**: `if (!couponId) throw` が `try` の内側にあり
  catch が汎用文言で上書き。既存 5 アサーションは `toThrow(string)` の**部分一致**で、
  ラップ後の文言にも部分文字列として含まれるため**全件 pass しており欠陥を守っていなかった**。
- **モーダル**: plan 058 で `storeURL` 引数が加わり reject 経路ができたが、ADR-003 の
  fire-and-forget IIFE が `console.error` するだけで、**ユーザーには何も伝わらずモーダルは
  行スナップショットのまま開き続け、未検証データを編集できた**。
- **scan-tests**: `it.each` 欠測（`c1be6d7`）・`test.skip(` 欠測（`ff9f5c28`）に続く**同型 3 度目**。
  リポジトリ内に該当構文が 0 件のため集計値は不変で、将来のドリフトに対する防御。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1761 passed / 1764 total | **1769 passed**（+8） |
| スイート数 | 175 | **176**（`columns.test.tsx` 新規） |
| スナップショット | 127 | **127**（不変） |
| 型エラー | 0 件 | **0 件** |
| lcov | 66.18% | **66.48%** |

---

### CodeRabbit レビュー 20 コメントの精査と対応（第 6 弾） (2026-07-30)

#### 概要

全 20 件を実測で突き合わせ、**確認済み 20 / 誤検知 0**（実コード 6 / docs 14）。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/app/api/webhooks/route.ts` | `user.deleted` の id 無検証キャストを tx 開始前の 400 で閉塞（`it.each` +4） | `4e4534d1` / `87a766df` |
| `src/lib/db-retry.ts` | `maxAttempts` の `0` / `NaN` を下限 1 でクランプ（+5） | `333c5e26` / `cd6cc148` |
| `src/queries/coupon.ts` | `toggleCouponActive` の `'Coupon not found.'` を `isDomainError` へ追加（+1） | `f36716a2` / `4c0d2bbc` |
| admin クーポン `columns.tsx` | `getCouponAsAdmin` reject の未処理を seller 版と同形に（+5） | `563488b3` / `31b3f269` |
| `security-headers.spec.ts` / `playwright.config.ts` | `E2E_USE_DEV` を `isEnabled`（`trim()==="1"`）へ統一（**破壊的変更**） | `7d6347df` / `37e1603b` |
| `scripts/coverage-dashboard/scan-tests.ts` | 注釈形 `test.skip(cond, reason)` の二重計上を是正（+2） | `83673910` / `88f4eee5` |

**根本原因の要点**:

- **webhook（最重大）**: Clerk の `DeletedObjectJSON.id` は optional。`undefined` を Prisma の
  `where` に渡すと**「フィルタなし」と解釈される**ため、`updateMany({ where: { userId: undefined } })`
  = **全 SupportTicket の PII 上書き**、`deleteMany({ where: { id: undefined } })` = **全 User 削除**へ退化。
- **db-retry**: `?? DEFAULT` は `0` / `NaN` が nullish でないため素通り。`0` だと for が 1 周も
  回らず `throw undefined` になり、下流の `instanceof Error` 型ガードが全崩れする。
- **E2E 集計の訂正（重要）**: 第 4 弾の「23→37 で一致」という記録は、**注釈形 16 件ぶんの
  過大計上がたまたま古い基準値 37 に着地したもの**で真の値ではなかった。実行時実測は **39**
  （`--list` の 117 tests ÷ 3 ブラウザ）、修正後の静的値は **36**。残差 **3** はループ生成ぶんで、
  **静的走査の原理的限界**として明記した。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1769 passed | **1786 passed**（+17） |
| スイート数 | 176 | **176**（不変） |
| スナップショット | 127 | **127**（不変） |
| 型エラー | 0 件 | **0 件** |
| lcov | 66.48% | **66.53%** |

---

### CodeRabbit レビュー 21 コメントの精査と対応（第 7 弾） (2026-07-30)

#### 概要

全 21 件を実測で突き合わせ、**確認済み 21 / 誤検知 0**（依存 1 / 実コード 2 / docs・plans 18）。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `package.json` | `next` を `~16.2.12` へ bump（新規 9 advisory・HIGH 4 の圏内に**再露出**していた） | `129dfcac` / `74ad8f0e` |
| `src/lib/db-retry.ts` | `baseDelayMs` の小数・非有限を正規化（+3） | `992d19a2` / `406751a1` |
| `src/queries/paypal.ts` | P2025 の無条件 `already settled` 写像を、再読で確定した場合のみに限定（+1） | `3fdc64a9` / `910a2b4a` |

**根本原因の要点**:

- **依存の再露出**: `GHSA-6gpp-xcg3-4w24`（App Router の Middleware/Proxy バイパス）は plan 057 が
  閉じた `GHSA-26hh-7cqf-hhc6` と**同じ脅威モデルの再発**。「plan NNN で bump 済み ＝ 恒久解決」
  ではないことを DEPS-08 に教訓として記録した（057 の Done criteria は履歴として上書きしない）。
- **db-retry**: `randomInt` は整数しか受理せず、小数で**catch の内側から `ERR_INVALID_ARG_TYPE`**
  が飛び、投げ返すはずの P2034 が TypeError に化けて `isSerializationFailure` が全て空振りした。
- **paypal**: P2025 は CAS 不一致に固有でなく、order の並行削除等でも返る。**実障害が
  「決済確定済み」として誤報告**され呼び出し側が調査もリトライもしなくなる。`stripe.ts` の
  既存解法（catch 内で再読し実際に settled のときだけ正規化・`d976b1e8`）を移植した。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1786 passed | **1790 passed**（+4） |
| スイート数 | 176 | **176**（不変） |
| スナップショット | 127 | **127**（不変） |
| 型エラー | 0 件 | **0 件** |
| lcov | 66.53% | **66.55%** |

---

### CodeRabbit レビュー 20 コメントの精査と対応（第 8 弾） (2026-07-30)

#### 概要

全 20 件を実測で突き合わせ、**確認済み 20 / 誤検知 0**（実コード 3 / docs 17）。実コード 3 件は
いずれも Red → Green を別コミットで実測。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/lib/db-retry.ts` | `baseDelayMs` の**有限の巨大値**を `MAX_BASE_DELAY_MS = 60_000` で上限クランプ（+3） | `82b38c02` / `8159bb2c` |
| `src/queries/stripe.ts` | canceled 後の再作成キーを**観測した canceled intent の id** から導出（上限 3 回・+2） | `5aa5f6f8` / `f9d7a50f` |
| `src/queries/paypal.ts` | capture **前**に `GET /v2/checkout/orders/{id}` で相関・金額・通貨を検証（+4） | `7138512c` / `71104354` |
| docs 17 件 | 実行可能ゲート 3 / 完了ゲート昇格 3 / 自己矛盾 5 / 根拠精度 2 / 数値是正 2 / 統計同期 2 | `1201b907` 他 |

**根本原因の要点**:

- **db-retry（第 7 弾の残存）**: 第 7 弾は小数・非有限を閉じたが、`2 ** 48` 以上の**有限の巨大値**は
  素通しのままで `randomInt` が `ERR_OUT_OF_RANGE` を投げ、同じく P2034 が化けていた。
- **stripe**: canceled 後の再作成キーが `randomUUID()` 由来で**呼び出しごとに別キー**になり、
  **canceled を観測した後だけ二重送信防御が消えて**いた（`4111e0ad` が閉じたはずの経路の裏口）。
- **paypal（資金移動）**: capture を**先に**叩き `custom_id` / `amount` / `currency` を**課金後**に
  検証していたため、検証で throw しても**金は既に動いている**。既存の capture 後検証は
  **削除せず二重防御として残した**。
- **docs 側の実行可能ゲート 3 件は、合格側 exit 0 / 違反注入側 exit 1 を実際に実行して両方向確認**。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1790 passed | **1799 passed / 1802 total**（+9） |
| スイート数 | 176（175 passed + 1 skipped） | **176**（不変） |
| スナップショット | 127 | **127**（不変） |
| 型エラー | 0 件 | **0 件** |

> **付記**: 本ラウンドで `COVERAGE_REPORT.md §1` の「テスト総数」行が第 7 弾の +4 を取り込めず
> 1786 のまま据え置かれていた**台帳ドリフト**を 1799 へ是正した（SSOT の `QA_HANDOFF.md` は
> 当時から正しく 1790 を保持していた）。PROGRESS.md 側は第 4 弾（1761）で終端しており、
> 本エントリ群（第 5〜8 弾）がその 4 ラウンドぶんの遡及反映にあたる。

---

### CodeRabbit レビュー 15 コメントの精査と対応（第 9 弾） (2026-07-31)

#### 概要

`dev → main` PR の CodeRabbit 15 コメントを実測でリポジトリに突き合わせ、
**確認済み 14 / 誤検知 1**（実コード 2 / docs 13）。実コード 2 件は資金移動と IDOR に
直結するため Red → Green を別コミットで実測した。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/paypal.test.ts` | retrieve と capture が**異なる `signal`** を受け取ることを固定（Red・**+2**） | `ee61b9bb` |
| `src/queries/paypal.ts` | 各 fetch を「controller 生成 → fetch → `finally` で `clearTimeout`」のヘルパーへ分離（Green） | `5ac6022b` |
| `src/queries/user.test.ts` | `$queryRaw` が `order.create` より前に呼ばれ、0 行なら throw する契約へ書き換え（Red・件数不変） | `4600451c` |
| `src/queries/user.ts` | 住所所有権の再検証を `SELECT … FOR UPDATE` へ置換（Green） | `f77dafd8` |
| `specs/.../06-quality.md` | P2025 の正規化を「再読で確定した場合のみ」へ実装と整合 | `8e60a417` |
| `plans/003-*.md` + `ja/003` | 住所 TOCTOU を「行ロックで閉塞済み」へ更新 | `a9d7f420` |
| `plans/004-*.md` | 検証日時の 3 箇所統一 + js-cookie ゲートを解決済みエントリ向けに修正 | `c9d1b07a` |
| `plans/031-*.md` + `plans/README.md` | group-level の並行二重復元を deferred として**実際に起票** | `e6b93f50` |
| `plans/057-*.md` | Step 1 の旧バージョン抽出コマンドを正典パイプラインへ | `7e82f1ac` |
| `plans/059-*.md` / `061` / `063` | helper 参照先 / five headers / 完了条件の二条件判定 | `e626664d` / `3a4a4656` / `6009ff74` |
| `plans/ja/011-*.md` / `ja/002` | bash 要求の明記 / enum 実測根拠の追記 | `8573fd8e` / `6efb0573` |
| `plans/audit/findings-13-*.md` | SHA 略記を台帳と同じ 7 桁へ統一 | `e80a06d9` |
| `docs/PROGRESS.md` | 第 5〜8 弾の履歴を backfill | `c86465ea` |

**根本原因の要点**:

- **paypal（資金移動）**: 第 8 弾で capture **前**の検証 GET を挿入した結果、1 リクエストぶん
  だった 10s 予算に 2 本目が乗った。`controller` は 1 個しか作られず両者が同じ `signal` を
  共有するため、**retrieve が 9.9s かかると capture は残 0.1s で abort される**。さらに
  `clearTimeout` は capture 成功後にしか無く、検証不一致の throw 経路ではタイマーが残っていた。
- **user（IDOR）**: `tx.shippingAddress.findFirst` は**素の SELECT で行ロックを取らない**ため、
  チェックと `order.create` の間に `userId` 付け替えが割り込めた。`FOR UPDATE` は付け替え側の
  `FOR NO KEY UPDATE` と競合するので Read Committed 下でも commit までブロックされ、
  ロック取得後の述語再評価（EvalPlanQual）で先行 commit 時は行が脱落して throw する。
  実 DB での並行閉塞は unit がモック境界で止まるため観測できず、`plans/README.md` の
  deferred に testcontainers での検証として記録した。
- **誤検知 1 件（修正の性格が違う）**: findings-13 の `4261be0c` / `e63474b6` は「誤った SHA」
  ではなく**同一コミットの 8 桁略記**で、`git cat-file -e` は解決する。監査追跡は壊れていない。
  台帳（VETTED_FINDINGS.md / README.md）が 7 桁で書いている段落内での**表記統一**として修正した。
  実測ではリポジトリ全体の略記はユニークで 7 桁 421 / 8 桁 92 であり、8 桁も広く使われている
  ため一括統一は行っていない。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1799 passed / 1802 total | **1801 passed / 1804 total**（+2） |
| スイート数 | 176（175 passed + 1 skipped） | **176**（不変） |
| スナップショット | 127 | **127**（不変） |
| 型エラー | 0 件 | **0 件** |
| lint | 0 errors / 15 warnings | **0 errors / 15 warnings** |
| カバレッジ | S 66.61 / B 46.71 / F 55.03 / L 65.63 | **S 66.61 / B 46.71 / F 55.09 / L 65.61** |

### CodeRabbit ローカルレビュー 22 コメントの精査と対応（第 10 弾） (2026-07-31)

VS Code の CodeRabbit 拡張が `main ← dev` に対して出したローカルレビュー 22 件。GitHub PR の
コメントではないため `gh api` では取得できず、指摘の見出しと実ファイルを突き合わせて判定した。
結果は **確認済み 21 / 誤検知 1**。

#### 実コード 2 件（いずれも Red → Green を別コミットで実測）

- **`src/queries/paypal.ts` — タイムアウト予算が本文読み取りに掛かっていなかった**。
  `fetch` は**ヘッダ受信時点で解決**するので、`finally` の `clearTimeout` を fetch 直後に置くと
  呼び出し側の `await response.json()` / `.text()` は**予算の外**で走る。PayPal が本文を送り渋る、
  あるいは接続が半開きのまま滞留すると server action がそこで無期限に待つ。第 9 弾で
  「retrieve と capture の予算共有」を閉じたが、**どちらの予算もヘッダ境界で終わっていた**。
  `Response` を返す形自体が誤用を誘発する（呼び出し側が `await response.json()` と書いた瞬間に
  予算外へ出る）ため、ヘルパー内で `text()` まで読み切ってから解放し `{ ok, status, body }` を
  返す形へ変更した。パースは呼び出し側の `JSON.parse`、`json()` ではなく `text()` を使うのは
  非 JSON のエラー本文でヘルパー内 throw させないため（+1・`bf725e39` Red → `9f614860` Green）。
- **`src/queries/user.ts` — 注文トランザクションの実行時間上限が暗黙だった**。
  `placeOrder` の `db.$transaction` はオプション無しで、上限は Prisma 既定の
  maxWait 2s / timeout 5s。カート消費 → 住所の `SELECT … FOR UPDATE` → 商品取得 →
  店舗ごとの OrderGroup / OrderItem 作成 → 在庫 CAS → 合計確定と書き込みが多く、
  注文点数に比例して伸びる。**この timeout は住所行の排他ロックを保持する時間の上限＝
  並行チェックアウトが待たされる時間の上限でもある**ため、暗黙の既定値に委ねてよい値ではない。
  `ORDER_TRANSACTION_OPTIONS`（maxWait 5s / timeout 20s）で明示した。`saveUserCart` の
  トランザクションは Serializable + 再試行付きの 2 文で既定内に収まるため変更していない
  （+1・`9ebbe104` Red → `af786cb5` Green）。

#### 誤検知 1 件（修正せず記録）

`src/app/api/webhooks/route.test.ts:341-344` の「`supportTicket` / `user` がそれぞれ二重に宣言され
型リテラルが `Duplicate identifier` で失敗する」という指摘は、**リポジトリの実体と一致しない**。
`grep -c` は両プロパティとも **1**、`bunx tsc --noEmit --pretty false` は **exit 0 / 出力 0 行**。
提示された diff の削除行は実ファイルに存在せず、適用すれば `route.ts:137-149` が実際に使っている
正しい型宣言を壊す。

#### docs 19 件

- **実行可能ゲート 4 件**（すべて合格側 exit 0 / 違反注入側 exit 1 を実測して確認）:
  004 の js-cookie 検証が `@clerk/shared` の**依存宣言**にしか当たらず解決エントリ
  （`"js-cookie": ["js-cookie@3.0.7", …]`）を取りこぼし、かつ `sort` が空入力で exit 0 を返す
  **fail open** だった件 / 042 が必須と定めた `expect(passwordInput).toBeVisible()` を
  **存在検査していなかった**件（禁止だけを見るゲートは「待機ごと削除した実装」を素通しする）/
  044 のゲートが `reuseExistingServer` の**極性**を見ず `!!` 反転でも合格し、実行行検出が
  コメントにも当たっていた件 / ja/009 の構造ゲートが 1 行化でコメント・デッドコードも
  合格させていた件。
- **自己矛盾 4 件**: 003 en·ja の TOCTOU が `RESOLVED` と書きながら末尾で実 DB 未検証を認めていた /
  021 の組み合わせ表が **(B) 遅延ワーカー × (P3) 主処理を失敗させる**を成立扱いしていた
  （B は記録が主処理の**後**に来るのでロールバック対象が存在せず、成立させようとすると
  必ず (P1) 原子的 Outbox に吸収される）/ 050 が禁止した `response?.status()` を処方として
  残していた / 057 の `DONE (1 criterion pending)`。
- **参照先ドリフト 3 件**: 013 の browse URL がパス形とクエリ形で割れていた
  （実装は `searchParams` 単一ルートでパス形は存在しない）＋ `findFirst` は実体が
  **`findUnique`**（`@unique` 前提のため親内一意化すると型エラーで書き換えが強制される）/
  041 の coupon.ts 行参照が全面的に 50〜100 行ずれ / findings-06 の Next 現行版 `~16.2.12` が
  README の rejected 節へ未伝播。
- **契約の穴 2 件**: 029 の `process.env.TZ` 復元漏れ（ワーカー共有のため後続ファイルへ波及）/
  063 の承認ゲートが**件数一致だけ**で、1 行離脱＋1 行流入でも同数になり行集合の同一性を
  保証できなかった件（`md5(string_agg(id ORDER BY id))` の digest 突合を追加）。
- **現況の分解 1 件**: findings-13 の TESTS-02 を決済経路ごとに分けた。実測で
  **Stripe は `$transaction` + CAS で解消済み**（`stripe.ts:275-310`）、**PayPal は未解消**
  （`paypal.ts:399` の upsert と `:441` の update が別書き込み。`4261be0` が入れたのは
  `notSettled()` の CAS 条件であって `$transaction` ではない）。deferred の理由が
  「優先度」と「依存」で異なる。
- **完了形の誤記 1 件**: 044 の Maintenance notes が `E2E_NO_REUSE` を「閉じてある」と断言して
  いたが、`playwright.config.ts:60` は `reuseExistingServer: !process.env.CI` のみ、
  `run-local.sh` に該当 export は 0 件、README の Status も TODO。
- **SSOT 統一 1 件**: D2 の導入コストが `render-html.ts`=S / `QA_HANDOFF.md`・
  `COVERAGE_REPORT.md`=M で割れていた（`documentation-guide.md` 規定に従い S へ統一）。
- **本ラウンドの統計同期 3 件**。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1801 passed / 1804 total | **1803 passed / 1806 total**（+2） |
| スイート数 | 176（175 passed + 1 skipped） | **176**（不変） |
| スナップショット | 127 | **127**（不変） |
| 型エラー | 0 件 | **0 件** |
| lint | 0 errors / 15 warnings | **0 errors / 15 warnings** |
| カバレッジ | S 66.61 / B 46.71 / F 55.09 / L 65.61 | **S 66.66 / B 46.71 / F 55.15 / L 65.65** |

---

### SonarCloud 重複解消リファクタ + 負の配送料バグ修正 (2026-08-01)

#### 概要

PR #164 の SonarCloud Quality Gate が `new_duplicated_lines_density` **3.9% > 3%** の 1 条件だけで
ERROR になっていたため、重複ブロックを抽出して解消した。その過程で重複コード内に「在庫 0 のとき
ITEM 方式の配送料が負値になる」既存バグを発見し、抽出で 1 箇所に集約した上で修正した。

#### 診断

`gh pr checks 164` では GitHub Actions のジョブ（Lint / Unit / Integration / Build / E2E /
Lighthouse）が全て pass しており、失敗していたのは **SonarCloud アプリが直接送る Check** だけ。
ワークフローの `sonarcloud` ジョブは `continue-on-error: true` だが、アプリ側の Check はその
管轄外なので、コードを直す以外に緑にできない。

| 条件 | しきい値 | 実測 | 判定 |
|------|---------|------|------|
| `new_duplicated_lines_density` | ≤ 3% | 3.9% | ❌ |
| `new_coverage` | ≥ 80% | 86.1% | OK |
| reliability / security / maintainability rating | 1 | 1 | OK |
| `security_hotspots_reviewed` | 100% | 100% | OK |

Sonar API（`/api/duplications/show`）から重複ブロックの実レンジを取得し、3 クラスタへ整理した。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/user.ts` | `findCartProductWithVariantAndSize` を抽出（`db.product.findUnique` の include + 3 条件検証が 4 経路で重複）。呼び出し元ごとにメッセージが違うため throw せず `null` を返す形 | `333b6171` |
| `src/queries/user.ts` | `calculateDiscountedUnitPrice` を抽出（3 経路） | `2db937c2` |
| `src/queries/user.ts` | `resolveCartShippingFee` を抽出（`getShippingDetails` + ITEM/WEIGHT/FIXED の Decimal 計算・2 経路）。国の解決方法が違うため解決済み `Country \| null` を引数で受ける | `3f9547d0` |
| `src/queries/user.ts` | `buildValidatedCartItem` を抽出（明細オブジェクトの組み立て・2 経路） | `cb375d11` |
| `src/queries/paypal.ts` | `requirePayPalUser` / `findOwnedPayPalOrder` を抽出（53 行 × 2 の前段・差分はログ prefix のみ） | `8b6ed8bb` |
| `src/lib/order-settlement.ts` (新規) | `hasOrderSettledAfterConflict` を新設し `stripe.ts` / `paypal.ts` の P2025 再読ブロック（25 行 × 2）を置換 | `632f1037` |
| `src/lib/order-settlement.test.ts` (新規) | 14 テスト。抽出元でテストが 0 件だった `catch (reReadError)` 分岐を含め新規ファイル 100% カバー | `639db82b` |
| `src/queries/user.test.ts` | 在庫 0 時の ITEM 配送料に対する Red テスト 2 件（実測 `shippingFee: "7"`） | `14d8bbab` |
| `src/queries/user.ts` | `Math.max(0, quantity - 1)` で追加個数をクランプ（Green） | `98f309f2` |

#### 設計判断

- **クラスタ A / C は同一ファイル内のモジュールプライベートヘルパー**。`"use server"` が要求するのは
  **export が async であること**だけで、非 export の宣言はファイル内に置ける（既存の
  `ORDER_TRANSACTION_OPTIONS` / `notSettled` / `fetchPayPal` が前例）。`src/lib/` へ出さないのは、
  `user.test.ts` の `jest.mock("./product")` 構成をそのまま流用でき、かつ新規ファイルの未カバー行で
  `new_coverage` を薄めないため。
- **クラスタ B のみ `src/lib/`**。`stripe.ts` ↔ `paypal.ts` のファイル跨ぎであり、`payment-status.ts`
  が同じ理由（`"use server"` の全 export async 制約）で既に `src/lib/` に置かれている。
- **`getProductShippingFee` には寄せない**。既に Decimal 版の ITEM/WEIGHT/FIXED 計算を持っており
  重複を消す最短経路に見えるが、(1) 追加個数の丸め方が違う（`Math.max(0, qty-1)` vs `qty-1`）、
  (2) 無料配送時に `shippingRate.findFirst` を発行しないためクエリ形状が変わる、
  (3) `user.test.ts` が両者を別々にモックしている。**純粋リファクタと銘打った変更で金額計算の
  挙動が変わる**のを避け、インラインを逐語抽出してから式を直す順序にした。
- 逐語保存した契約: 2 種類の not-found メッセージ（詳細版 / 簡易版）、PayPal の `"Order not found"`
  （ピリオド無し）と Stripe の `"Order not found."`（有り）、`error.message ===` の文字列比較、
  `where: { id, userId }` の形、ログ文字列のバイト一致。

#### 修正したバグ

ITEM 方式の配送料が `validQuantity === 1 ? fee : fee + extra * (validQuantity - 1)` で個数を
クランプしておらず、在庫切れ（または改ざん payload の `quantity: 0`）で `validQuantity === 0` に
なると `(0 - 1) = -1` により **`fee - extra` = 負の配送料**が算出されていた。値は
`saveUserCart` では `CartItem.shippingFee` / `Cart.shippingFees` / `Cart.total` へ、`placeOrder`
では `OrderItem.shippingFee` と `OrderGroup` / `Order` 合計へそのまま伝播する。同じロジックが
4 箇所にコピーされていたため、抽出で 1 箇所へ集約してから修正した。修正後は
`updateCheckoutProductWithLatest` を含む 3 経路の配送料計算式が一致する。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 | 1803 passed / 1806 total | **1819 passed / 1822 total**（+16） |
| スイート数 | 176（175 passed + 1 skipped） | **177**（176 passed + 1 skipped・**+1**） |
| スナップショット | 127 | **127**（不変） |
| 型エラー | 0 件 | **0 件** |
| lint | 0 errors / 15 warnings | **0 errors / 15 warnings** |
| カバレッジ | S 66.66 / B 46.71 / F 55.15 / L 65.65 | **S 66.8 / B 46.78 / F 55.34 / L 65.8** |
| Integration | 17 / 2 スイート | **17 / 2 スイート**（不変・testcontainers 実 DB で pass） |

---

### plans 042 / 051 の実行 — E2E signIn ヘルパー修復と国選択セレクタ E2E (2026-08-03)

#### 概要

`plans/README.md` の Status 表で P1 かつ TODO だった 042（E2E signIn ヘルパー修復）と
051（国選択セレクタの cookie 往復 E2E）を実行した。042 はサインイン修復とフッター SVG の
実 WCAG 違反是正を達成したが、注文フローの既知ハングにより**部分完了**で停止した。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `tests/e2e/helpers/auth.ts` | 共有 `signInWithPassword` を新設。`.cl-signIn-root` へスコープし `input[name=...]` で特定（ラベル文言のグローバル一致を廃止）。1 段/2 段の実行時分岐は持たない | `235754b8` |
| `tests/e2e/stock-decrement.spec.ts` / `platform-coupon.spec.ts` | インラインのサインイン手順を共有関数呼び出しへ置換 | `5f635485` |
| `tests/e2e/messages.spec.ts` / `seller-onboarding.spec.ts` | 同上（messages はローカル `signIn` を削除、seller-onboarding は 2 箇所） | `a5816c0c` |
| `src/components/store/icons/send.tsx` / `wishlist.tsx` / `order.tsx` | `role="img"` の SVG に `aria-label` を付与（axe `svg-img-alt` / serious の是正） | `c25a8768` |
| `tests/e2e/country-selector.spec.ts` | 新規。Ship to の hover → 国選択 → cookie 書き込み → `router.refresh()` → リロード永続 | `5f2143b3` |

#### 根本原因（042）

`/sign-in` は共通フッター付きで、Newsletter フォームが
`<label class="sr-only">Email address</label>` を持つ。Clerk ウィジェットは client-only の
ため**ハイドレーション前は Newsletter 欄だけが存在**し、`getByLabel` がそちらへ解決していた。
識別子が空のままサインインが成立せず `toBeHidden` が 20s でタイムアウトしていた。

#### 実測で判明した前提の誤り（051）

プランは「cookie 未設定なら DEFAULT_COUNTRY（United States）」を前提としていたが、
`src/middleware.ts:18-27` が cookie 不在時に ipinfo.io で IP から国を判定して先に設定するため、
**初期表示は実行マシンの所在地に依存する**（日本から実行すると `Japan/EN/`）。
既知の cookie を事前投入して middleware の分岐を迂回する形に変更し、外部ネットワークにも
実行地にも依存しない決定論的なテストにした。

#### 未達（次セッションへの引き継ぎ）

- **042 は部分完了**。`stock-decrement` / `platform-coupon` が**サインイン成立後**の
  商品ページ `goto`（30s × 3 リトライ）でタイムアウトする。`scripts/e2e/run-local.sh`
  ヘッダー記載の「重い注文フローの間欠 120s ハング」と一致し、実行ごとに落ちるテストが
  移動する（1 回目は stock-decrement のみ、2 回目は両方）。プランの STOP 条件
  「locator 以外の失敗モード」に該当するため改変せず停止した。
- 3 ブラウザフルラン（042 Step 6）は未実施。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 | 1829（記録値） | **1841 passed / 1844 total**（実測で訂正・12 件のドリフトを解消） |
| Jest スイート数 | 177 | **177**（不変） |
| Playwright E2E | 39 tests/browser・16 files | **41 tests/browser・17 files**（3 ブラウザ計 123） |
| スナップショット | 127 | **127**（不変） |
| 型エラー | 0 件 | **0 件** |
| lint | 0 errors / 15 warnings | **0 errors / 15 warnings** |

---

### plan 047: チェックアウト異常系の un-skip + 注文詳細の金額明細検証 (2026-08-03)

#### 概要

住所未選択で Place order を押したときのエラー表示 E2E を un-skip し（TESTS-30）、注文詳細ページの
請求金額をセント整数の完全一致で検算する assert を追加した（TESTS-31）。あわせて plan 042 が
「原因不明の別事案」として残した**サインイン後ナビゲーションの間欠ハングを根本解決**した。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `tests/e2e/payment-error.spec.ts` | 住所未選択エラーを un-skip。認証セッションは入れ子 describe に閉じ込め、`CLERK_SECRET_KEY` 未設定時の skip を既存の未認証テストへ波及させない。`/checkout` へは `/cart` の Checkout 経由で到達 | `0c5540c0` |
| `src/components/store/order-page/payment.tsx` | 決済プロバイダ非依存の `data-testid="order-payment"` を付与（src 変更は 1 行・オペレーター承認済み） | `edef9711` |
| `tests/e2e/platform-coupon.spec.ts` | 注文詳細の金額明細 assert を追加（構造 ×2 グループ / グループ内検算 / 全体合計一致 / 支払い領域の存在） | `87f6ce05` |
| `tests/e2e/payment-error.spec.ts` / `platform-coupon.spec.ts` | `waitForPostSignInSettle` を除去してハングを解消。`gotoStable` は Firefox 対策として残す。checkout 後の `waitForURL` を 10s → 30s | `ec32b174` |

#### 根本原因（間欠ハング）

`waitForPostSignInSettle`（サインイン後の networkidle 待ち）を通すと、後続の `page.goto` が
**リクエストを 1 件も発行しないまま**ハングし、per-goto 予算 × リトライを丸ごと消費する
（実測: platform-coupon が 3 回連続 2 分 timeout。同時刻にシェルから同 URL を curl すると
0.5〜1.5s で 200 が返り、トレースの network ログにも当該リクエストが現れない）。settle を
使っていない `a11y/checkout.spec.ts` だけが安定していたのはこのため。除去後は同一フローが
9〜11s で完走する。`gotoStable` は無罪で、Firefox のソフトリダイレクト割り込み
（`NS_BINDING_ABORTED`）を吸収するため必要。

#### 金額検算の方式

表示金額はハードコードせず、`$X.XX` を**パース時に 1 度だけ丸めてセント整数化**してから
整数演算で検算する（`.claude/steering/tech.md` が定める「金額規約の唯一の例外 = E2E の
表示文字列検算」）。許容誤差は持たず `toBe` の完全一致で、グループ内
`subtotal + shipping - discount === total` と `Σ group total === order total` の両方が
3 ブラウザで一致した。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 | 1841 passed / 1844 total | **1841 passed / 1844 total**（不変・E2E のみの変更） |
| Jest スイート数 | 177 | **177**（不変） |
| Playwright E2E | 41 tests/browser・17 files | **41 tests/browser・17 files**（不変。un-skip は skip/active の内訳のみを動かす） |
| 対象 2 spec の 3 ブラウザ実測 | platform-coupon が間欠 failed / 住所未選択は 3 ブラウザとも skip | **9 passed / 6 skipped / 0 failed / flaky 0** |
| スナップショット | 127 | **127**（不変） |
| 型エラー | 0 件 | **0 件** |
| lint | 0 errors / 15 warnings | **0 errors / 15 warnings** |

---

### plans 044 / 042 の完了 — E2E 運用ガードと signIn 修復の最終検証 (2026-08-04)

#### 概要

`plans/README.md` の Status 表で唯一残っていた P1（042 = IN PROGRESS）を閉じ、
その前提となる P2/DX（044）を先に完了させた。042 の残ブロッカーは plan 047 が特定した
サインイン後ハングの**除去漏れ 1 箇所**で、これを外したことで 3 ブラウザフルランが
初めて「visual ベースライン以外 failed 0」に到達した。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `playwright.config.ts` | `globalTimeout` を 1200s → 3600s（plan 044 Step 3）。1200s は 25.5m のランを収容できず 3 件を `did not run` で打ち切っていた | `d7ffbb88` |
| `tests/e2e/stock-decrement.spec.ts` | `waitForPostSignInSettle` の呼び出しと import を除去（plan 047 の除去漏れ）。除去理由を他 spec と同型のコメントで固定 | `d939b697` |

#### 実測結果

| 実測 | 結果 |
|------|------|
| chromium 認証バッチ（stock-decrement / platform-coupon / seller-onboarding / messages / a11y） | **9 passed / 0 failed**（1.9m） |
| 3 ブラウザフルラン（`bash scripts/e2e/run-local.sh`） | **83 passed / 3 failed / 37 skipped / flaky 0**（5.8m） |
| `.last-run.json` の status | `failed`（**`timedout` ではない** = plan 044 Step 4 の判定基準を充足） |
| 042 の機械検証ゲート 5 項目 | すべて PASS |

failed 3 件は `visual/cart.spec.ts` × 2 と `visual/checkout.spec.ts` × 1 の
ベースライン陳腐化のみで、**plan 043（目視ゲート付き再撮影）の担当**。

#### plan 044 の実装がプラン本文と異なる点

044 Step 1–2 はプラン本文では「:3000 の `lsof` 事前チェック」だったが、実装は
**専用ポート :3100 への隔離 + `E2E_NO_REUSE=1` による再利用の無効化**（`eeb9422b` /
`fdc0ee9f`）。プラン本文の Why this matters が「事前チェックは TOCTOU を縮めるだけで
塞がない」と自ら認めており、`E2E_NO_REUSE` が本質的なガードだと結論していたため、
実装はその結論に沿った上位互換。ポート隔離は他プロジェクトの :3000 常駐を
停止せずに済む副次利点も持つ。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 | 1841 passed / 1844 total | **1841 passed / 1844 total**（不変・E2E のみの変更） |
| Jest スイート数 | 177 | **177**（不変） |
| Playwright E2E | 41 tests/browser・17 files（123） | **41 tests/browser・17 files（123）**（不変） |
| 3 ブラウザフルラン | 52 passed / 17 failed / 39 skipped / 3 did not run（25.5m・2026-07-11） | **83 passed / 3 failed / 37 skipped / 0 did not run**（5.8m） |
| スナップショット | 127 | **127**（不変） |
| 型エラー | 0 件 | **0 件** |
| lint | 0 errors / 15 warnings | **0 errors / 15 warnings** |

#### 後続への影響

042 の完了により、hard dependency として 042 を待っていた
**plans 047（済）/ 048 / 049 / 050 / 052 / 053（サインアウト部）/ 055** の着手条件が解除された。

---

### plans 043 / 028 の実行（VRT 再ベースライン + 最後の未テスト server action） (2026-08-04)

#### 概要

VRT ベースライン 3 枚を目視ゲート付きで再撮影し、3 ブラウザフルランの failed をゼロにした
（plan 043）。併せて `src/queries/` で唯一テストが無かった `country.ts` に unit テストを
新設し、「全サーバーアクションがテスト済み」の不変条件を回復した（plan 028）。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `tests/e2e/visual/cart.spec.ts-snapshots/*.png` | 空カート / 商品追加後カートのベースライン再撮影（720px→1071px） | `2d7ac110` |
| `tests/e2e/visual/checkout.spec.ts` | Clerk ウィジェットの描画完了アンカーを追加してから撮影 | `15cbca83` |
| `tests/e2e/visual/checkout.spec.ts-snapshots/*.png` | サインイン画面が写ったベースラインへ差し替え | `15cbca83` |
| `src/queries/country.test.ts` | `getAllCountries` の unit テスト 4 本を新規作成 | `68f636d5` |

#### plan 043 で判明した「陳腐化ではない失敗」

cart 2 枚はプラン想定どおりの陳腐化だった —— 旧ベースラインは **dev サーバー時代の
720px** で、フッターが描画される前の状態を固定しており、左下に Next.js の dev
インジケータまで写り込んでいた。+351px の増分の実体は Newsletter バナー＋フッター
リンク群で、要素の重なり・見切れは無い。

**checkout は違った。** 旧ベースラインは真っ白で、再撮影しても actual は
「ヘッダー＋空の本文＋フッター」にしかならない。Clerk は client-only のため URL 到達
直後は本文が空で、**`toHaveScreenshot` の安定判定（100ms 間隔の 2 枚が一致）が空画面を
「安定」と誤認**していた（3 試行ともバイト同一の 150420B ＝ フレークではなく決定論的。
error-context の a11y スナップショットにはウィジェットが写るので DOM には存在する）。

そのまま固定すると「サインイン画面の差分検出器」にならず、マシン速度が変われば描画が
間に合って恒常 red にもなるため、オペレーター承認を得て spec に描画完了アンカー
（`.cl-signIn-root` + `input[name="password"]` の可視。`tests/e2e/helpers/auth.ts:67-82`
と同一）を追加した。プラン本文では spec は Out of scope であり、意図的逸脱として記録する。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 | 1841 passed / 1844 total | **1845 passed / 1848 total**（plan 028 で +4） |
| Jest スイート数 | 177 | **178**（+1） |
| Playwright Visual | 3 テストとも failed | **3 テストとも passed**（連続 2 回 green） |
| 3 ブラウザフルラン | 83 passed / 3 failed / 37 skipped / flaky 0（5.8m） | **83 passed / 0 failed / 37 skipped / flaky 3**（7.4m） |
| スナップショット | 127 | **127**（不変） |
| 型エラー | 0 件 | **0 件** |
| lint | 0 errors / 15 warnings | **0 errors / 15 warnings** |

#### 残課題

フルランの flaky 3 件（payment-error@chromium / platform-coupon@firefox /
layout-chrome@webkit）はいずれもリトライで pass しており VRT とは無関係。
別事案として残る。

---

### plan 029 の実行（profile.ts のエラー経路 + 期間フィルタ網羅） (2026-08-04)

#### 概要

`src/queries/profile.ts`（プロフィール系 5 テーブルを供給する server action 群）の
Branches を 67.81% から 100% へ引き上げた。本体は 1 行も変更していない。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/profile.test.ts` | catch 分岐 20 件 + 期間フィルタ 9 件を追加（34→63） | `70803930` |

#### 何がテストされていなかったか

5 関数（`getUserOrders` / `getUserPayments` / `getUserReviews` / `getUserWishlist` /
`getUserFollowedStores`）はいずれも「currentUser 用」「DB フェッチ用」の 2 つの
try/catch を持ち、どちらも `instanceof Error` の真偽でログの引数形状を変える。
この **20 分岐が丸ごと未検証**で、「エラー時に内部詳細を漏らさず汎用メッセージへ
縮退する」という PII 非漏洩の契約が固定されていなかった。

期間フィルタは既存テストが 1 件あったが、`gte: expect.any(Date)` までしか見ておらず
**last-6-months / last-1-year / last-2-years を区別できない**ものだった。
`jest.useFakeTimers({ now })` で固定時刻を敷き `subMonths` / `subYears` の実値と
突き合わせる形へ強化した（実装の `new Date()` と期待値生成が同一時刻を見るため
TZ 依存も生じない）。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 | 1845 passed / 1848 total | **1874 passed / 1877 total**（+29） |
| Jest スイート数 | 178 | **178**（不変） |
| profile.ts Branches | 67.81%（59/87） | **100%（87/87）** |
| lcov 全体 Branches | 46.94% | **47.48%** |
| スナップショット | 127 | **127**（不変） |
| 型エラー | 0 件 | **0 件** |
| lint | 0 errors / 15 warnings | **0 errors / 15 warnings** |

---

### plan 026 の実行（paypal.ts のエラー経路網羅） (2026-08-04)

#### 概要

決済モジュール `src/queries/paypal.ts` のエラー経路を unit テストで網羅し、
Branches を 72.05% から 91.91%（Statements / Lines / Functions は 100%）へ。
本体は 1 行も変更していない characterization テスト。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/paypal.test.ts` | ヘルパー catch 8 + 外側 catch 6 + 不正応答 2 を追加（40→56） | `c3699b9c` |

#### プラン本文からの逸脱（Drift check に実際に引っかかった）

プラン 026 の baseline は「17 テスト / Branches 28.6%」だったが、その後 plan 059 が
capture 検証を追加して `paypal.ts` は +391 行、テストは 17→40 に成長していた。
ケース表（catch の 3 分岐 × 2 箇所、非 OK 応答、外側 catch の非 Error 分岐）は
そのまま有効だったので活かし、**数値目標だけを実測から再導出**した。

また catch は共通ヘルパー `requirePayPalUser` / `findOwnedPayPalOrder` へ抽出済みで、
`createPayPalPayment` と `capturePayPalPayment` の差はログ prefix のみ。そのため
分岐本体は create 側で通し、capture 側は prefix 切り替えのみを確認する形にした
（機械的な二重化はカバレッジを増やさず読む量だけ増やす）。

末尾 2 件（`purchase_units` / `captures` 欠損）はケース表に無いが、90% 到達に
必要な optional-chaining 分岐であり追加した。

#### 規約との関係（重要）

本テストは **現状の 3 引数ログ形式をそのまま assert している**。
`.claude/steering/tech.md` が定める構造化ログ規約は 2 引数形式であり、
**paypal.ts は規約の実装例として名指しされていながら準拠していない**。
このテストは規約準拠を証明するものではなく、現状の挙動を固定するもの。
将来 `logError` へ移行する際は、この乖離がテストを壊す変更として機械的に見える。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 | 1874 passed / 1877 total | **1890 passed / 1893 total**（+16） |
| Jest スイート数 | 178 | **178**（不変） |
| paypal.ts Branches | 72.05%（98/136） | **91.91%** |
| lcov 全体 Branches | 47.48% | **48.00%** |
| 型エラー | 0 件 | **0 件** |
| lint | 0 errors / 15 warnings | **0 errors / 15 warnings** |

---

### plan 027 実行: `placeOrder` のオーバーセルロールバックと PLATFORM クーポン端数吸収を実 DB で固定 (2026-08-04)

#### 概要

improve Round 4 の plan 027 を実行し、`placeOrder` の money-critical な 2 分岐（在庫のアトミック
減算まわりと PLATFORM クーポンの端数吸収）を testcontainers の実 PostgreSQL で固定した。
`src/queries/user.ts` は 1 行も変更していない（純追加のテスト作業）。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `tests/integration/setup/seed.ts` | `SeedCouponInput` に `scope?: CouponScope` を追加、`storeId` を `string \| null` へ緩和（PLATFORM クーポンは店舗に所有されない） | `ee86ef32` |
| `tests/integration/setup/query-mocks.ts` | 新規。`requireActual` の三重複を除くための実装透過ヘルパー `actualDeliveryDetails` を集約 | `b0e488b5` |
| `tests/integration/order-placement.test.ts` | Scenario 7（実減算量）/ 8（オーバーセルロールバック）/ 9（PLATFORM 端数吸収）を追加。6 → 9 シナリオ | `b0e488b5` |

#### 設計上のポイント

- **Scenario 8 の割り込み点**: 事前キャップ `Math.min(quantity, size.quantity)` があるため単純な
  在庫不足では throw に到達しない。`placeOrder` が `$transaction` の**外**で呼ぶ
  `getDeliveryDetailsForStoreByCountry` を seam にして、検証通過後・減算前に在庫を 5 → 2 へ
  横取りすることで `count === 0` 経路を決定論的に再現した。**割り込みを外すと本シナリオだけが
  落ちる**ことを実測して、空振りテストでないことを確認済み。
- **プラン本文からの数値の逸脱 1 点**: プランは PLATFORM 10% の総割引を $10.00 と想定していたが、
  実装の割引基数 `cartTotalPrice` は `item.totalPrice`（**送料込み**）の合計のため実測は **$12.00**。
- **併せて判明**: 割引率は Int・除数は固定 100 なので `Prisma.Decimal` の除算は必ず有限小数になり、
  **残差吸収は素朴な各グループ計算と数学的に一致する**（端数吸収分岐は丸め順序をブレさせない
  ための防御）。Scenario 9 の識別力は「`storeId: null` のクーポンが全グループへ適用される」=
  PLATFORM 分岐の一意な証明と、割引合計のセント一致にある。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest Integration テスト | 17 / 2 スイート | **20 / 2 スイート**（order-placement 6 → 9） |
| Jest ユニット/コンポーネント | 1890 passed / 178 スイート | **1890 passed / 178 スイート**（不変） |
| 型エラー | 0 件 | **0 件** |
| lint | 0 errors / 15 warnings | **0 errors / 15 warnings** |

---

### plan 031 実行: 注文キャンセル/返金の子連動・在庫復元を実 DB で固定 (2026-08-04)

#### 概要

improve Round 5 の plan 031 を実行し、注文確定**後**のライフサイクル（`src/queries/order.ts`）を
testcontainers の実 PostgreSQL で固定した。plan 027 が固定した在庫**減算**側と対になる
**復元**側で、これで在庫整合の両側が閉じた。`src/` は 1 行も変更していない。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `tests/integration/setup/seed.ts` | `seedOrderWithGroupAndItem` を追加（Order + OrderGroup + OrderItem を FK 結線。**在庫は触らない**設計） | `b0f5066a` |
| `tests/integration/order-lifecycle.test.ts` | 新規。6 シナリオ / 8 テスト | `61eacfb1` |

#### 固定した内容と、主張しないこと

- キャンセル/返金の親子連動（親 `PaymentStatus` は "Cancelled"、子 `OrderStatus` は
  "Canceled" というスペル差も含む）と、在庫が減算前まで戻ること
- **二重キャンセルの冪等性**: 逐次 2 回でも復元は 1 回ぶんのみ。`Cancelled → Refunded` の
  再遷移も条件付き `updateMany` の `where` に弾かれる
- group 単位キャンセルはそのグループの在庫のみ復元し、親 status は混在→`Processing` /
  全 Canceled→`Canceled` へ集約
- 非 ADMIN は**両** admin 関数とも拒否され、副作用ゼロ
- **⚠️ 主張しないこと 2 点**: (a) 並行ケースは「並行ディスパッチの回帰テスト」であって
  DB 上でトランザクションが重なったことの証明ではない。(b) 並行安全性を固定したのは
  `updateOrderPaymentStatus`（CAS 済み）のみで、`updateOrderGroupStatusAsAdmin` は
  read-then-act のままなので**並行二重復元は未解決**（`plans/README.md` の Deferred）

#### 実装上の落とし穴（次の実行者向け）

`OrderStatus` / `PaymentStatus` は `@prisma/client` と `src/lib/types.ts` の**両方に同名で存在**し、
値が同一なので **Jest は緑のまま `tsc --noEmit` だけが落ちる**。SUT (`order.ts`) と同じ
`@/lib/types` から取ること。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest Integration テスト | 20 / 2 スイート | **28 / 3 スイート** |
| Jest ユニット/コンポーネント | 1890 passed / 178 スイート | **1890 passed / 178 スイート**（不変） |
| 型エラー | 0 件 | **0 件** |
| lint | 0 errors / 15 warnings | **0 errors / 15 warnings** |

---

### plan 032 実行: 決済 webhook の実 DB 冪等性を固定 (2026-08-04)

#### 概要

improve Round 5 の plan 032 を実行し、Stripe / PayPal webhook の冪等性の本体
（`PaymentDetails.orderId` の unique 制約 + `upsert` の実挙動 + 2 書き込みの原子性）を
testcontainers の実 PostgreSQL で検証した。unit の両 `route.test.ts` は `@/lib/db` を
全モックしており、これらは**一度も実行されていなかった**。`src/` は 1 行も変更していない。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `tests/integration/webhook-payment.test.ts` | 新規。Stripe 7 + PayPal 4 = 11 テスト | `9e1682b7` |

#### 🆕 新規 finding（未修正・characterization で固定）

**プロバイダー切替時に `PaymentDetails.amount` / `currency` が更新されない。**
両 route の `upsert` は `update` 分岐にこの 2 列を持たず `create` 分岐にしかないため、
Stripe → PayPal の切替後の行は「`paymentMethod: PayPal` なのに `amount` は Stripe の
**セント値** 9999（正しくは `Order.total` = 110.00）」という**単位混在**で残る。
CORRECTNESS-05 と同じ単位問題の族で、二重計上・返金額誤りに直結しうる。
プランの STOP 条件には該当しないため現挙動を Scenario P4 で固定し、修正時に正しく
赤くなる形にしたうえで `plans/README.md` の Deferred に起票した。

#### 実装上のポイント

- **並行再送は「両方 2xx」も assert する**。`count === 1` だけでは片方が 500 で落ちても
  緑になり、「冪等に処理した」ではなく「1 本が失敗した」（= Stripe が再配送し続ける）
  状態を見逃す。冪等性の主張は「両方成功 **かつ** 副作用 1 回」の連言。
- **原子性の対照（control）は制約を落とした後に置く**。先に置くと
  `Order.paymentMethod='Stripe'` の行が残り `ADD CONSTRAINT` が
  `is violated by some row` で落ちる（実際に踏んだ）。
- **本ファイルのみ `testEnvironment: node`**（docblock）。jsdom には Fetch API の
  `Request` / `Response` が無く Route Handler を直接呼べない。config は無変更。
  `structuredClone` も無いため fixture の deep clone は JSON round-trip で行う。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest Integration テスト | 28 / 3 スイート | **39 / 4 スイート** |
| Jest ユニット/コンポーネント | 1890 passed / 178 スイート | **1890 passed / 178 スイート**（不変） |
| 型エラー | 0 件 | **0 件** |
| lint | 0 errors / 15 warnings | **0 errors / 15 warnings** |

---

### SonarCloud PR #169 New Code カバレッジ 70% の是正 (2026-08-08)

#### 概要

Stripe webhook の非 USD 拒否分岐が SonarCloud で未カバー扱い（Coverage on New Code 70.0% / 未カバー 2 行・未カバー条件 1）になっていた問題を、ユニット層のテスト追加で解消した。

#### 根本原因

分岐自体は `tests/integration/webhook-payment.test.ts` の Scenario S8 が検証済みだった。しかし `jest.config.js` の `testPathIgnorePatterns` が `tests/integration/` を除外しているため、統合テストの実行結果は `coverage/lcov.info` に載らない。SonarCloud は `sonar-project.properties` 経由でこの lcov のみを読むため、**統合テストだけで守った分岐は New Code カバレッジに算入されない**。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/app/api/webhooks/stripe/route.test.ts` | 非 USD イベントが 400 を返し、`$transaction` / `paymentDetails.upsert` / `order.update` を一切呼ばないことを検証するケースを追加（+1） | `0089f4a4` |
| `docs/testing/QA_HANDOFF.md` ほか | テスト統計同期・ダッシュボード再生成 | (本コミット) |

`route.ts` の Lines は 87.5% → **90.62%**。残る未カバー行（36 / 97 / 126 / 141 / 147 / 218）はいずれも New Code 外の既存行。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest ユニット/コンポーネント | 1890 passed / 1893 total / 178 スイート | **1891 passed / 1894 total / 178 スイート** |
| Jest スナップショット | 127 | **127**（不変） |
| 型エラー | 0 件 | **0 件** |
| lint | 0 errors / 15 warnings | **0 errors / 15 warnings** |

---

### plan 033: tsvector 全文検索の raw SQL を実 DB で固定 (2026-08-09)

#### 概要

`/api/search-products` が `$queryRaw` で発行する PostgreSQL 全文検索 SQL を、testcontainers の実 PostgreSQL に対して初めて実行し 9 シナリオで固定した。`src/` は 1 行も変更していない。

#### なぜ必要だったか

unit テスト（`src/app/api/search-products/route.test.ts`）は `@/lib/db` を全モックしているため、**SQL 文字列そのものはユニット・統合いずれのテストでも一度も実行されていなかった**。この SQL は Elasticsearch → tsvector 移行（`docs/migration/`）の中核でありながら、構文エラー・`'simple'` トークナイザーの挙動・関連度順ソートの回帰をどのテストも検知できない状態だった。テーブル名やカラム名の変更に raw SQL は自動追従しないため、Prisma メジャーアップグレードや schema 変更で静かに壊れうる。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `tests/integration/search-products.test.ts` | 新規作成（9 テスト）。トークナイザーの小文字化 / name・description 双方のヒット / `ts_rank` 降順 / `plainto_tsquery` の AND 意味論 / 空白トリムと `q` 欠落の 2 分岐 / パラメータ化の安全性 / 従属の `ORDER BY RANDOM()` | `6514e0c6` |
| `docs/testing/QA_HANDOFF.md` ほか | テスト統計同期・ダッシュボード再生成・plans/README の Status 更新 | (docs 同期コミット) |

#### 実装上の判断 2 点

- **`testEnvironment: node` をファイル単位 docblock で上書き**（plan 032 と同じ）。`jest.integration.config.js` の既定は jsdom だが、jsdom には Fetch API の `Request` / `Response` グローバルが無く Route Handler を直接呼べない。config は無変更。
- **商品は `db.product.create` を直接使う**。`seedProductWithVariantAndSize` は name が `Product ${suffix}` に固定されており、検索語の出現位置・頻度を制御できないため。variant / size は検索 SQL に不要。

#### 識別力の確認（rule 02 の Red 規律）

本体を変更できないテスト追加作業でも空振りを避けるため、識別力の要になる 2 シナリオ（3 = 関連度順、6 = パラメータ化）の期待値を一時的に崩して**その 2 件だけが赤くなる**ことを実測してから戻した。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest Integration テスト | 40 / 4 スイート | **49 / 5 スイート** |
| Jest ユニット/コンポーネント | 1891 passed / 1894 total / 178 スイート | **1891 passed / 1894 total / 178 スイート**（不変） |
| テストファイル総数（ダッシュボード） | 199 | **200** |
| 型エラー | 0 件 | **0 件** |
| lint | 0 errors / 15 warnings | **0 errors / 15 warnings** |

---

### plan 036: deleteProduct の FK Restrict / カスケードを実 DB で固定 (2026-08-09)

#### 概要

`deleteProduct` のハード削除がどこまで連鎖し、何に阻止されるかを testcontainers の実 PostgreSQL で 4 シナリオ固定した。`src/` と `prisma/` は 1 行も変更していない。

#### なぜ必要だったか

`deleteProduct` は `db.product.delete` を呼ぶだけで、実際の削除範囲は FK 定義（`prisma/schema.prisma` の `onDelete`）が決める。unit テストは `db.product.delete` をモックするため、**CASCADE も RESTRICT も原理的に検証できない**。schema 変更や Prisma メジャーアップグレードで挙動が変わっても、どのテストも気づけない状態だった。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `tests/integration/product-deletion.test.ts` | 新規作成（4 テスト）。CASCADE 9 種の全件消滅（孫の FreeShippingCountry 含む）/ Review による RESTRICT（P2003）/ 失敗時の原子性 / 所有権ガードと not-found の副作用なし | `7986d9fb` |
| `docs/testing/QA_HANDOFF.md` ほか | テスト統計同期・ダッシュボード再生成・plans/README の Status 更新 | (docs 同期コミット) |

#### 設計上のポイント

- **削除前の件数を厳密な `toEqual` で固定した**（spec のみ 2・他は 1）。`>= 1` のような下限にすると、Arrange の取りこぼしを「0 件のものを数えて 0 件だった」と誤読でき、CASCADE の検証が空振りになる。
- **RESTRICT 失敗時は子テーブル全件の不変を assert する**。商品と variant だけを数えても「部分的に子だけ消えていない」ことは示せない（DB は tx 内で子の CASCADE を実行してから RESTRICT に到達しうる）。
- `requireSeller` は `user.privateMetadata?.role !== "SELLER"` で判定するため、Clerk mock は `{ id, privateMetadata: { role: "SELLER" } }` の形が必要（`placeOrder` 系の mock とは形が異なる）。

#### この記録が主張しないこと

シナリオ 2 は **現挙動の characterization** であり、「レビュー付き商品は削除できない」を正しい仕様として肯定するものではない。削除可能にする場合（レビュー先行削除 / ソフト削除化 / onDelete 変更）は期待値を意図的に反転させること。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest Integration テスト | 49 / 5 スイート | **53 / 6 スイート** |
| Jest ユニット/コンポーネント | 1891 passed / 178 スイート | **1891 passed / 178 スイート**（不変） |
| テストファイル総数（ダッシュボード） | 200 | **201** |
| 型エラー | 0 件 | **0 件** |
| lint | 0 errors / 15 warnings | **0 errors / 15 warnings** |

---

### plan 037: upsertShippingAddress の default 不変条件を実 DB で固定 (2026-08-09)

#### 概要

配送先住所の `default` フラグが「1 ユーザー = 最大 1 件」に保たれるかを testcontainers の実 PostgreSQL で 4 シナリオ固定した。`src/queries/user.ts` は 1 行も変更していない。

#### なぜ必要だったか

checkout の配送先自動選択は `addresses.find((a) => a.default)` で**最初の default を採る**。したがって default が 2 件併存すると、**どちらへ配送されるかが行の並び順に依存する非決定**になる。この行状態はモック unit では観測できない。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `tests/integration/shipping-address-default.test.ts` | 新規作成（4 テスト）。更新経路の解除 / 新規経路のスキップ（characterization）/ P2002 による IDOR 防御 / 未認証拒否 | `bc663893` |
| `docs/testing/QA_HANDOFF.md` ほか | テスト統計同期・ダッシュボード再生成・plans/README の Status 更新 | (docs 同期コミット) |

#### 判明した非対称（既知バグ TESTS-21）

実装は `findUnique(address.id)` が行を返したときにしか他住所の `default` を解除しない。したがって:

- **既存住所を default に更新** → 解除が走り `count === 1`（正常）
- **新規住所を default 付きで作成** → 条件が偽になり解除がスキップされ `count === 2`（バグ）

シナリオ 2 はこの**現挙動の characterization** であり、正しい期待値ではない。テスト内に `TODO(characterization)` タグ・TESTS-21 参照・正しい不変条件・「修正時に 1 へ反転」を明記してある。これが無いと後任が `=== 2` を満たすべき契約と誤読し、修正側を差し戻す事故が起きる。

#### IDOR 防御の実体

他ユーザーの住所 id を渡すと所有権 `findFirst` が null を返し、同一 id での `create` が **P2002** で reject される。つまり「上書きされない」ことの根拠は明示的な認可エラーではなく **PK 一意制約**であり、被害者の行は無傷のまま残る。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest Integration テスト | 53 / 6 スイート | **57 / 7 スイート** |
| Jest ユニット/コンポーネント | 1891 passed / 178 スイート | **1891 passed / 178 スイート**（不変） |
| テストファイル総数（ダッシュボード） | 201 | **202** |
| 型エラー | 0 件 | **0 件** |
| lint | 0 errors / 15 warnings | **0 errors / 15 warnings** |

---

### plan 040: Clerk user.deleted webhook の FK 連鎖を実 DB で固定 (2026-08-09)

#### 概要

Clerk の `user.deleted` イベントを受けた webhook が、User への 3 種の FK（RESTRICT / CASCADE / SET NULL）にどう反応するかを testcontainers の実 PostgreSQL で 7 シナリオ固定した。`src/app/api/webhooks/route.ts` と `prisma/` は 1 行も変更していない。

#### なぜ必要だったか

`user.deleted` は `db.user.deleteMany` のハード削除だが、User への FK は 3 種が混在する。注文・レビュー・住所・店舗のいずれか 1 件でも持つユーザーが Clerk 上でアカウントを削除すると、DB 側の削除は P2003 で**永続的に失敗**し webhook は 500 を返し続ける。Svix のリトライは有限回で打ち切られるため、**誰も気付かないままユーザーの PII が DB に残存し続ける**（GDPR 等の削除要求と衝突するコンプライアンス隣接事案）。この 3 値境界は `deleteMany` をモックする unit テストでは原理的に検証できない。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `tests/integration/user-deletion-webhook.test.ts` | 新規作成（7 テスト）。CASCADE 7 種 / RESTRICT 4 経路 / SET NULL + PII 秘匿化 / deleteMany の冪等性 | `c364a75d` |
| `docs/testing/QA_HANDOFF.md` ほか | テスト統計同期・ダッシュボード再生成・plans/README の Status 更新 | (docs 同期コミット) |

#### 設計上のポイント

- **implicit M2M は相手側から `_count` を引く**。`_UserFollowingStore` / `_CouponToUser` は Prisma から直接クエリできないため、Store / Coupon 側の `_count` が 0 になることで中間テーブル行の消滅を確認する。Store 残存の assert だけでは、孤児行が残っても green になってしまう。
- **Conversation は `orderId` が optional** なので Order 無しで成立する。これにより Order の RESTRICT に触れずに Conversation / Message の CASCADE を発火できる。
- **`PaymentDetails` の CASCADE は到達不能**。`PaymentDetails.orderId` は Order への必須 FK なので、PaymentDetails を持つユーザーは必ず Order を持ち、削除は常に Order の RESTRICT で先に阻止される。

#### この記録が主張しないこと

シナリオ 2〜5（RESTRICT 群）は**現挙動の characterization** であり、「削除できないのが正しい」という主張ではない。修正（PII 匿名化 + 行温存 / ソフト削除 / onDelete 変更）が入ったら期待値を反転させること。一方シナリオ 6 の PII 秘匿化は `7e3e507` で実装済みの**正の保証**であり、性質が異なる。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest Integration テスト | 57 / 7 スイート | **64 / 8 スイート** |
| Jest ユニット/コンポーネント | 1891 passed / 178 スイート | **1891 passed / 178 スイート**（不変） |
| テストファイル総数（ダッシュボード） | 202 | **203** |
| 型エラー | 0 件 | **0 件** |
| lint | 0 errors / 15 warnings | **0 errors / 15 warnings** |

---

### plan 064 / TESTS-21: 配送先 default 不変条件の修正 (2026-08-09)

#### 概要

`upsertShippingAddress` が「1 ユーザーにつき `default: true` は最大 1 件」という不変条件を
**新規作成経路で破っていた**件を修正し、plan 037 が固定していた characterization を回帰ガードへ反転した。

#### 原因と修正

他住所の default 解除が `findUnique({ where: { id: address.id } })` の非 null に条件付けられていた。
新規住所の id は UI が `v4()` で採番するため常に null になり、**新規経路では解除が丸ごとスキップ**されて
default が 2 件併存していた。2 件あると `address.list.tsx:21` の `addresses.find((a) => a.default)` が
どちらを拾うかが物理行順依存になり、**checkout の配送先自動選択が非決定**になる。

修正は 2 段構え:

1. **アプリ層** — 解除条件を `address.default` のみにし、所有権検証・解除・作成/更新を `db.$transaction` で束ねた。
   `$transaction` は装飾ではなく**前提条件**である: 解除を無条件化すると、他ユーザーの id を渡された
   IDOR 経路で「create が P2002 で落ちる**前に**攻撃者自身の default が解除される」= 拒否されたのに
   副作用が残る状態が生まれる（追加したシナリオ5 が修正前の実装で実際に赤くなり実証された）。
2. **DB 層** — 部分 unique index `ShippingAddress("userId") WHERE "default"` を手書き migration で追加。
   Prisma スキーマ構文では表現できないため `migrate dev --create-only` + SQL 手書き。適用前に本番相当 DB を
   調査し「総 6 行 / default 5 行 / 重複ユーザー 0 件」を確認、適用後に `migrate dev` が DROP を
   提案しないことも確認済み。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/user.test.ts` | unit +3（新規経路の解除 / tx 経由 / P2002 伝播） | `879e3d33` |
| `tests/integration/shipping-address-default.test.ts` | シナリオ2 を 2 → 1 に反転、原子性シナリオ5 を追加 | `058c5437` |
| `src/queries/user.ts` | 解除の無条件化 + `$transaction` 化 + `NOT: { id }` | `cbd32067` |
| `prisma/migrations/20260809064416_.../migration.sql` | 部分 unique index 追加、シナリオ6 で回帰ガード化 | `433ffd4c` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1891 passed | **1894 passed** |
| スイート数 (unit/component) | 178 | **178**（不変） |
| Integration テスト総数 | 64 | **66** |
| Integration スイート数 | 8 | **8**（不変） |
| テストファイル総数（ダッシュボード） | 203 | **203**（不変・新規ファイルなし） |
| 型エラー | 0 件 | **0 件** |

---

### plan 045 の実行 — ゲスト導線 E2E（TESTS-33） (2026-08-09)

#### 概要

認証不要のゲスト導線（compare / track-order / offers / 静的ページ）の E2E を新設した。
`plans/README.md` の Status 表で P2 かつ依存ゼロだったため、E2E トラックの先頭として着手。
`src/` は 1 行も変更していない（E2E シード拡張とテスト追加のみ）。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `tests/e2e/seed/constants.ts` / `seed-e2e.ts` | OfferTag を 1 件シードし productB に紐付け（url のみワーカーサフィックス） | `eaac5c06` |
| `tests/e2e/guest-flows.spec.ts` | 新規 6 テスト（compare 2 / track-order 2 / offers 1 / 静的ページ 1） | `515a736f` |

#### 実装との突き合わせで判明した 2 点（プラン本文からの逸脱）

1. 商品カードの `data-testid="product-card-<slug>"` は `<Link>` に付いており、アクションボタンは
   `group-hover` オーバーレイ内＝ Link の**外**にある。カード単位のスコープは testid 配下ではなく
   **group コンテナ**で取る必要がある（`page` 直下だと複数カードで strict mode violation）。
2. `OfferTag.url` だけがワーカーサフィックス付きで **name は全ワーカー共通**のため、/offers の
   見出しは一意な **href でスコープしてから**文言を検証する（過去 run のタグが upsert で残る）。

識別力は 2 箇所（compare の件数期待・`/contact` の見出し）を意図的に崩し、
**その 2 テストだけが落ちる**ことを実測してから戻している。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Playwright E2E | 41 tests/browser・17 files（計 123） | **47 tests/browser・18 files**（計 **141**） |
| E2E メインスペック | 11 | **12**（+ `guest-flows.spec.ts`） |
| Jest テスト総数 (unit/component) | 1894 | **1894**（不変） |
| Integration テスト総数 | 66 | **66**（不変） |
| テストファイル総数（ダッシュボード） | 203 | **204** |
| 型エラー | 0 件 | **0 件** |

---

### plan 052 の実行 — a11y スキャンをストアフロント主要ページへ拡大（TESTS-43） (2026-08-09)

#### 概要

axe（WCAG 2.1 AA）スキャンの対象が認証系 4 ページのみで、顧客の滞在時間が最も長い
ゲストページ（browse / 商品詳細 / cart）に検出経路が無かった。3 spec を追加したところ
**初回スキャンで critical 3 種 / serious 2 種の実違反を検出**したため、オペレーター承認の
うえプランのスコープを拡大して `src/` を修正し、green 化した。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/components/store/browse-page/sort.tsx` | 空の `htmlFor` を `useId()` 由来の ID で input と接続（`label` / critical） | `df4d4f7e` |
| `src/components/store/product-page/quantity-selector.tsx` | +/- ボタンに `aria-label`、数量 input に `aria-labelledby`（`button-name` / `label` ともに critical） | `df4d4f7e` |
| `src/components/store/layout/categories-header/categories-menu.tsx` | `<ul>` 直下を `<li>` に是正（`list` / `listitem` / serious）。併せて href 末尾の余分な `}` を除去 | `df4d4f7e` |
| `tests/e2e/a11y/{browse,product,cart}.spec.ts` | WCAG 2.1 AA スキャン 3 spec を新設（chromium 限定ゲート + `color-contrast` 既知負債 disable） | `e0cdb735` |

**検証**: a11y スイート **7 passed**（chromium）/ Jest **1894 passed**（不変）/ VRT **3 passed** /
purchase-flow + guest-flows **11 passed** / `bunx tsc --noEmit` 0 件 / `bun run lint` 0 errors。

**プランからの逸脱 2 点**: (1) `/browse` の readinessLocator はプラン記載の prefix セレクタ
`[data-testid^="product-card-"]` ではなく seed slug 完全一致の testid を使う（prefix はカード内
`product-card-price` にも当たり、描画順依存の脆い待機になるため）、(2) `src/` は out of scope と
されていたが、実違反の検出を受けてオペレーター承認のうえ拡大した。

**ドリフト発見**: plan 052 本文の「home（`/`）は OI-9 未解消のため対象外」は執筆時点
（2026-07-12）の誤りで、**OI-9 は 2026-06-06 に解消済み**（`c196e3d5`）。
`tests/e2e/a11y/home.spec.ts` の追加は依存なしで着手できる。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Playwright E2E | 47 tests/browser・18 files（計 141） | **50 tests/browser・21 files**（計 **150**） |
| Playwright a11y | 4 スペック | **7 スペック**（+ browse / product / cart） |
| E2E メインスペック | 12 | **12**（不変。a11y は別カテゴリ計上） |
| Jest テスト総数 (unit/component) | 1894 | **1894**（不変） |
| Integration テスト総数 | 66 | **66**（不変） |
| テストファイル総数（ダッシュボード） | 204 | **207** |
| 型エラー | 0 件 | **0 件** |

---

### CodeRabbit レビュー対応 — ストアフロント UI の a11y / 状態整合 (2026-08-10)

#### 概要

CodeRabbit の指摘 5 件を現行コードに突き合わせて検証し、**4 件を修正・1 件を却下**した。あわせて、先行コミット `879763a0` でスキップされていたテスト統計の同期ドリフト（13 テスト・2 スイート）を是正した。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/components/store/browse-page/sort.tsx` | 未知の `sort` 値を `DEFAULT_SORT` へ正規化。表示ラベル / `RadioGroup` の `value` / 太字判定を `activeSort` 1 箇所から導出し、「Most Popular と表示されているのに `aria-checked` がどれも false」という不整合を解消 | `4bba7872` |
| `tests/component/store/product-sort.test.tsx` | 未知 sort 値で既定項目が `aria-checked="true"` になることを固定（+1） | `4bba7872` |
| `src/components/store/layout/categories-header/categories-menu.tsx` | 表示遅延タイマーを `useRef` で保持し離脱・再入・アンマウントで破棄／トリガーを `div` → `<button type="button">` 化し `aria-expanded` / `aria-controls` を同期／閉じた `<ul>` を `invisible` でフォーカス順から除外 | `3a6ccf83` |
| `tests/component/store/categories-menu.test.tsx` | タイマー破棄・Enter / Space / クリック開閉・`aria-expanded`・閉時のフォーカス除外を固定（+6。タイマー破棄は旧実装での Red を実測） | `3a6ccf83` |
| `docs/testing/COVERAGE_REPORT.md` | 「未採用カテゴリ」から Visual / a11y を除去（plan 052 までに両者とも実装・green 化済み）。「Jest スイート総数」行を unit/component 限定と明示（integration 8 は別・合算 188） | 本コミット |

#### 却下した指摘（1 件）

- **tailwind `classnames-order` の autofix**: `bunx eslint src/components/store/browse-page/sort.tsx` の findings は **0 件**。出力の `duration-[30ms] is ambiguous` は Tailwind パーサーの情報メッセージであり、順序ルールの違反ではない。

#### 設計判断（レビュー指摘と異なる箇所）

閉じたリストをフォーカス順から外すのに `hidden` / `inert` ではなく **`invisible`（`visibility: hidden`）** を採用した。前者は要素をアクセシビリティツリーから消すため既存の `getByRole("list")` 5 件が全滅するが、`visibility: hidden` はブラウザでは同じくフォーカス不可にでき、jsdom は Tailwind の CSS を評価しないためテストが生き残る。`transition-all` 下では discrete に切り替わるので開閉アニメーションも壊れない。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1895 passed / 1898 total | **1915 passed / 1918 total** |
| スイート数 | 178（177 passed + 1 skipped） | **180（179 passed + 1 skipped）** |
| スナップショット | 127 | **127**（不変） |
| 型エラー | 0 件 | **0 件** |

> 更新前の 1895 / 178 は実測ではなくドリフトした値だった。差 20 のうち **13 テスト・2 スイートは `879763a0`（categories-menu / product-sort スイート新設）の未同期分**で、当該コミットで `spec-sync-after-test` が起動されていなかったことによる（[`.claude/rules/02-tdd-step-commit.md`](../.claude/rules/02-tdd-step-commit.md)）。

---

### plan 046 — /browse ページネーション配線 + E2E 有効化 (2026-08-11)

#### 概要

`plans/README.md` の Status 表で TODO だった P2 プランのうち、唯一 `src/` の実バグ修正を含む plan 046（TESTS-32）を実行した。`search-filter.spec.ts` のページネーションテストが skip されたままだった真因は「テストが壊れていた」ことではなく、**/browse にページネーション UI が存在しなかった**ことである。`getProducts` は `page` / `pageSize` / `totalPages` を実装済みなのに browse ページが `page` searchParam を読んでおらず、**商品が 11 件以上あっても先頭 10 件にしか到達できない dormant バグ**として放置されていた。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/app/(store)/browse/page.tsx` | `page` searchParam を tech.md の URL パラメータ正規化規約で処理し `getProducts` の第 3 引数へ配線。`totalPages > 1` のときだけページャを描画 | `f10a5b89` |
| `src/components/store/browse-page/browse-pagination.tsx` | 新規（client）。共有 `Pagination`（`setPage: Dispatch<SetStateAction<number>>` のクライアント state 型）を「既存クエリを保持したまま `page` だけ差し替えて push」する形へ橋渡しする薄いラッパー。共有コンポーネント本体は他 3 箇所で使用中のため不変 | `f10a5b89` |
| `src/lib/types.ts` | `FiltersQueryType.page` をオプショナルで追加。**`ProductFilters` へは意図的に渡さない** —— `FiltersHeader` が `Object.entries(queries)` を回してキーごとにフィルタチップを描画するため、混ぜるとページ番号がチップとして表示され Filter 件数も増える | `f10a5b89` |
| `tests/e2e/seed/constants.ts` / `seed-e2e.ts` | 専用カテゴリ `E2E Pagination` に商品 12 件を隔離投入（既存 `E2E Category` に足すと search-filter のカテゴリフィルタ assert と purchase-flow の件数前提が壊れる）。`bun run seed:e2e` 2 回連続 exit 0 の冪等性を実測 | `96ca7bc7` |
| `tests/e2e/search-filter.spec.ts` | skip を解除し、SSR ページに効かない route-mock を捨てて実データ検証へ全面書き換え | `4adb0b3b` |

#### プラン本文からの逸脱（1 件）

カード件数のセレクタは、プラン記載の `[data-testid^="product-card-"]` ではなく seed slug まで含めた `[data-testid^="product-card-e2e-page-item-"]` を使った。前者はカード内の価格 `data-testid="product-card-price"`（`product-page/product-info/product-price.tsx:112`）にも一致し、件数が二重に数えられる（plan 052 が別ページで踏んだのと同じクラスの罠）。

#### 識別力の機械的確認

ラッパーの `goTo` を「既存クエリを保持しない」実装へ一時的に崩すと、**このテストだけが** `category` 保持の assert で落ちることを実測してから戻した（`Received "…/browse?page=2"`）。件数 10 → 2 は category を落とした実装でも偶然一致するため、この assert が無いと検証そのものが空振りになる。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1915 passed / 1918 total | **1928 passed / 1931 total** |
| スイート数 | 180 | **180**（不変） |
| Integration テスト総数 | 66 | **66**（不変） |
| Playwright E2E | 50 tests/browser（計 150） | **50 tests/browser（計 150）**（不変・skip が 1 件解消） |
| テストファイル総数（ダッシュボード） | 209 | **210** |
| 型エラー | 0 件 | **0 件** |

> **plan 046 は Jest テストもテストファイルも増やしていない。** unit/component の +13 と
> ファイル +1（`src/lib/db.test.ts`）はいずれも先行コミット `a9083b17`〜`7064f9f3`
> （Prisma クライアントの遅延初期化 Proxy と初期化エラー再 throw）の未同期分の是正である。
> E2E 総数が動かないのは `--list` が skip も数えるためで、本プランで変わったのは
> **skip の 0 件化**（search-filter が chromium 5 passed / skip 0、3 ブラウザ 15 passed）。

---

### plan 048 — 顧客エンゲージメント導線 E2E (2026-08-11)

#### 概要

ウィッシュリスト・ストアフォロー・レビュー投稿は UI・server action・専用プロフィールページがすべて実装済みなのに E2E がゼロだった（TESTS-34/35/36）。リピート購入を支える主要導線として 3 テストを 1 spec にまとめた。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/components/store/cards/product/product-card.tsx` | wishlist ボタン（Heart アイコンのみでアクセシブル名なし）に `aria-label="Add to wishlist"` を付与。**本プラン唯一の `src/` 変更** | `7db28f6e` |
| `src/components/store/cards/product/product-card.test.tsx` | ロケータを不在ベース（「aria-label もテキストも持たない唯一のボタン」）から肯定形（`getByRole("button", { name: "Add to wishlist" })`）へ是正。アクセシブル名を与えた時点で旧ロケータは 2 件 fail した | `7db28f6e` |
| `tests/e2e/engagement.spec.ts` | 新規・3 テスト（wishlist / follow・unfollow / review 投稿） | `c1ad7c64` |

#### 実測で確認したアプリ側の潜在バグ（本プランでは修正しない）

`store-card.tsx:30-31` の `if (!user.isSignedIn) router.push('/sign-in')` は **`return` を持たない**。Clerk の `useUser()` はロード完了まで `isSignedIn: false` を返すため、**ハイドレーション直後にフォローを押すとサインイン済みでもホームへ飛ばされ、フォロー自体も成立しない**（`/sign-in` はサインイン済みユーザーを `/` へ跳ね返す）。プランは「潜在バグ」とだけ記していたが、初回実装では 3 回とも「クリック後 URL が `/`・toast なし・フォロワー 0 のまま」で、実際にこの導線を壊していた。

プランが `src/` 変更を Step 1 の 1 行に限っているため、修正ではなくテスト側で `window.Clerk.loaded === true` を待って回避した（`waitForClerkLoaded`）。**本体を修正する際はこのヘルパーの必要性を再評価すること。**

#### 識別力の機械的確認

フォロワー数の期待を +1 → +2 に、レビュー本文の期待を存在しない文字列に崩すと、**その 2 件だけが落ち** wishlist は通ったままであることを実測してから戻した。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1928 passed / 1931 total | **1928 passed / 1931 total**（不変・ロケータ修正のみ） |
| スイート数 | 180 | **180**（不変） |
| Playwright E2E | 50 tests/browser（21 files・計 150） | **53 tests/browser（22 files・計 159）** |
| テストファイル総数（ダッシュボード） | 210 | **211** |
| 型エラー | 0 件 | **0 件** |

---

### plan 050 — 管理者による店舗ステータス変更 E2E (2026-08-11)

#### 概要

店舗の BAN / 無効化は運営の主要オペレーションだが、admin UI からの操作 → ストアフロント反映の E2E がゼロだった（TESTS-38）。隣接する `seller-onboarding.spec.ts` はステータスを Prisma 直更新しており admin UI を通らないため、この導線はこれまで一度も検証されていなかった。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/config/test-helpers.ts` | `gotoStable` がナビゲーションのレスポンス（`Response \| null`）を返すようにした。HTTP ステータスを検証する呼び出し側が割り込みリトライを自前で再実装せずに済む。既存呼び出し側は戻り値を無視しており後方互換 | `52ab59ab` |
| `tests/e2e/admin-store-status.spec.ts` | 新規・1 テスト（ACTIVE 公開の control → admin UI で BANNED → store ページ非公開 → Active へ復帰） | `a3874701` |

`src/` のアプリケーションコードは無変更。

#### プラン本文からの逸脱（1 件・成功シグナルの取り方）

プランは「成功 toast を確認」と記していたが、`store-status-select.tsx` は**エラー時にしか toast を出さない**。さらに素朴に `row.getByText("Banned")` を待つと**誤った理由で緑になる** —— ドロップダウンが開いている間は「**選択肢としての** Banned タグ」が行内に存在するため、更新完了ではなく「ドロップダウンが開いた」ことを見てしまう。実際これで server action の完了を待たずに進み、**DB がまだ ACTIVE のうちに store ページを見に行って落ちた**（実測: DB status=ACTIVE / store ページ 200）。

`handleClick` は**成功時にだけ `setIsOpen(false)`** するので、「旧ステータスのタグが消えた（＝選択肢ごと閉じた）」ことを完了条件にした。

#### フレークの原因特定と除去

初回の 3 ブラウザ実行は **2 flaky**（firefox `NS_BINDING_ABORTED` / webkit `interrupted by another navigation`）。原因は sign-in 直後の遅延リダイレクトによる `page.goto` の割り込みで、このリポジトリが `gotoStable` で既に解いていた既知現象だった。ステータス検証にレスポンスが必要だったため、割り込み処理をスペックへ複製せず**ヘルパー側がレスポンスを返す**ようにした。結果 **flaky 0**。

#### 識別力の機械的確認

BAN 後の期待を `not.toBe(200)` → `toBe(200)` に崩すと `Expected: 200 / Received: 500` で落ちることを実測してから戻した。非公開の assert は `not.toBe(200)` に留め、**500 を期待値に固定していない**（`notFound()` で 404 に直した瞬間に赤くなる「修正を罰するテスト」を避けるため）。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1928 passed / 1931 total | **1928 passed / 1931 total**（不変） |
| スイート数 | 180 | **180**（不変） |
| Playwright E2E | 53 tests/browser（22 files・計 159） | **54 tests/browser（23 files・計 162）** |
| テストファイル総数（ダッシュボード） | 211 | **212** |
| 型エラー | 0 件 | **0 件** |

---

### SonarCloud PR #173 — browse-pagination の New Code カバレッジ 0.0% 解消 (2026-08-11)

#### 概要

SonarCloud の PR #173 Measures が `src/components/store/browse-page/browse-pagination.tsx` を **Coverage on New Code 0.0%（未カバー 11 行 / 未カバー 2 条件）** として報告していた。plan 046 で追加された当該コンポーネントに Jest テストが 1 件も無かったのが原因で、コンポーネントテストを新設して解消した。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `tests/component/store/browse-pagination.test.tsx` | 新設（6 テスト）。値形式 `setPage(i + 1)` / 関数形式 `setPage(prev => prev ± 1)` の両分岐、既存クエリ（category / sort）保持、端（先頭 Previous / 最終 Next）で `router.push` が走らないことを検証 | `2f2b77eb` |
| `src/**` | **無変更**（テスト追加のみ） | — |

#### 未カバー 2 条件の実体

`browse-pagination.tsx` の `typeof next === "function" ? next(page) : next` の両側。共有ページャ（`src/components/store/shared/pagination.tsx`）は**番号クリックでは値形式**、**Prev/Next では関数形式**で `setPage` を呼び分けるため、どちらか一方の操作しか叩かないと分岐が閉じない。両方を叩いて当該ファイルは **Stmts / Branch / Funcs / Lines すべて 100%**（`bunx jest <path> --coverage --collectCoverageFrom=<当該ファイル>` で単体実測）。

#### 同期時に是正したドリフト 2 件

1. **スイート数**: 各ドキュメントは 180 と記載していたが、本対応前の実測が既に **181**（テスト総数 1931 は一致していたため差分はスイート数のみ）。本対応の +1 を含めて **182** に更新。
2. **lcov カバレッジ**: 2026-08-04 実測のまま据え置かれていたため再測定。分母（8657 → 8697）も動いており、差分は本 PR 単独ではなく 08-04 以降の全コミット分を含む。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1928 passed / 1931 total | **1934 passed / 1937 total** |
| スイート数 | 180（記載値。実測は 181） | **182（181 passed + 1 skipped）** |
| Integration テスト総数 | 66 | **66**（不変） |
| Playwright E2E | 54 tests/browser（23 files・計 162） | **54 tests/browser（23 files・計 162）**（不変） |
| テストファイル総数（ダッシュボード） | 212 | **213** |
| カバレッジ全体（lcov） | 67.71 / 48.00 / 55.48 / 66.79（2026-08-04） | **68.49 / 48.46 / 56.57 / 67.58**（2026-08-11 実測） |
| 型エラー | 0 件 | **0 件** |

---

### URL 数値パラメータ正規化の恒久対応（共通ヘルパー化 + 範囲外ページの正準リダイレクト） (2026-08-12)

#### 概要

コードレビューで保留になっていた 2 件（`Number.isSafeInteger` への置き換え / 範囲外ページが空リスト）を、
1 ファイルの最小パッチではなく規約と実装の両方を前へ進める恒久対応として閉じた。

#### 判断の要点

- **`Number.isSafeInteger` は採らない**: `?page=1e15` は safe integer 判定を**通過する**ため
  `skip = (page - 1) * pageSize = 1e16` が Prisma の `Int`（32bit）を超える点は変わらず、根本原因を塞がない。
  また `Math.floor` を落とすと「小数は切り捨て」という文書化済みの挙動が黙って変わる。
- **真の防御は上限クランプ**で、`api/index-products/route.ts` と `dashboard/admin/orders/page.tsx` は
  既に `MAX_PAGE = 10_000` で実装済みだった。つまり **`tech.md` の規約行のほうが実装より古い**のが本質。
- **範囲外ページはリダイレクト**で解決。ページャは `page={currentPage}` をハイライトするため、
  寄せないと URL・ハイライト・表示内容の 3 者が食い違う。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/lib/utils.ts` | `normalizePositiveIntParam` / `normalizePageParam` / `MAX_PAGE` を新設。既存ローカル実装の `max ? ... : ...`（`max === 0` を falsy で取りこぼす）を `max !== undefined` へ是正 | `c6f96b73` |
| `src/lib/utils.test.ts` | +28 テスト（正常系・異常系・上限クランプ・配列先頭採用・`max: 0` 回帰ガード） | `c6f96b73` |
| `browse` / `profile` 3 ページ / `api/index-products` / `admin/orders` | URL page パラメータ 6 箇所をヘルパーへ集約。未クランプだった 4 箇所は挙動変更、既存 2 箇所は挙動不変 | `ccf37303` |
| `src/app/(store)/browse/page.tsx` ほか | 範囲外ページを正準 URL へ `redirect()`。browse は `buildBrowseHref` で既存フィルタを保持、history のみ Client Component のため state 上で正規化 | `bda2df7a` |
| `src/app/(store)/browse/page.test.tsx` | 新設（8 テスト）。クエリ保持 assert は `buildBrowseHref` を壊すと当該 2 件だけが落ちることを実測して識別力を確認 | `bda2df7a` |
| `.claude/steering/tech.md` | 「URL パラメータ正規化」行を共通ヘルパー必須へ差し替え、却下理由（isSafeInteger では不十分 / `Math.floor` を保つ理由）を実装パターン節に記録 | `9521a81b` |
| `docs/migration/06-framework-upgrade.md` | インライン形の how-to に superseded 注記 | `9521a81b` |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1934 passed / 1937 total | **1970 passed / 1973 total** |
| スイート数 | 182（181 passed + 1 skipped） | **183（182 passed + 1 skipped）** |
| Integration テスト総数 | 66 | **66**（不変） |
| Playwright E2E | 54 tests/browser（23 files・計 162） | **54 tests/browser（23 files・計 162）**（不変） |
| 型エラー | 0 件 | **0 件** |
| lint | 0 errors / 15 warnings | **0 errors / 15 warnings**（不変） |

---

### `getProducts` の未マッチ URL フィルタ是正（E2E 失敗調査の副産物） (2026-08-12)

#### 概要

E2E `search-filter.spec.ts` の「ページネーションで次ページに遷移できる」が失敗。
**直接原因はシードデータの欠落**（`e2e-pagination*` カテゴリが DB に 0 件）だったが、
調査の過程で `getProducts` の実バグが露出したため併せて修正した。

#### 原因特定の決め手

失敗時スナップショットで「フィルタチップは `e2e-pagination-chromium-w0` を表示しているのに、
商品リストは他ワーカーの商品を含む**全カタログ（ページャ 7 ページ）**」という矛盾が出ていた。
チップと商品リストは `browse/page.tsx` の**同じ `category` 変数**から描画されるため、
この不一致はページ側では起こり得ない。原因は `getProducts` 側の `if (found) { push }` で、
**未マッチのフィルタを黙って捨てて全件を返していた**。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/product.ts` | store / category / subCategory / offer の URL が解決できない場合は明示的に 0 件を返す（`product.findMany` / `count` を発行しない） | `cce53407` |
| `src/queries/product.test.ts` | +5 テスト（未マッチ 4 モデル + `currentPage` / `pageSize` 保持） | `cce53407` |
| DB | `bun run seed:e2e` を実行（3 ターゲット × 12 商品を投入） | — |

#### 検証

- Jest 全体: **1975 passed / 3 skipped**（183 スイート）、tsc 0、lint 0 errors / 15 warnings
- E2E（chromium）: `search-filter` **5 passed** / `guest-flows` **6 passed**（計 11 passed）
- 識別力の実測: category のガードを元の実装へ戻すと**当該 1 件だけ**が落ちる
- 実アプリ: `/browse?category=does-not-exist-xyz` → **No Products**、実在カテゴリ → **10 件**
- リダイレクトの実アプリ検証（前作業分）: `?page=999` / `?page=1e21` ともに `307` で
  フィルタ・ソートを保持したまま最終ページへ。Prisma エラーなし

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1970 passed / 1973 total | **1975 passed / 1978 total** |
| スイート数 | 183（182 passed + 1 skipped） | **183**（不変） |
| 型エラー | 0 件 | **0 件** |

---

### レビュー指摘対応（配列 page パラメータのテスト追加ほか） (2026-08-12)

#### 概要

コードレビュー指摘 3 件を現行コードに対して検証し、いずれも有効だったため修正した。

#### 実施内容

| 対象 | 変更内容 |
|------|---------|
| `src/app/(store)/browse/page.test.tsx` | +1 テスト（`?page=2&page=999` で `normalizePageParam` が先頭要素 2 を採り、`getProducts` に 2 を渡してリダイレクトしないこと）。既存テストは `color` の配列だけを覆っており、`page` の配列経路は未検証だった |
| `src/queries/product.test.ts` | 未マッチ URL の `it.each` に期待 URL を追加し、対象モデルの `findUnique` が `{ where: { url }, select: { id: true } }` で呼ばれたことを検証（件数不変）。別モデルの解決結果や前ケースのモック実装に依存しないテストになる |
| `docs/testing/COVERAGE_REPORT.md` | §1 の「Jest スイート総数」行が 182（181 passed + 1 skipped）で停留しており、SSOT の `QA_HANDOFF.md`（183 / 182 passed + 1 skipped）と割れていた分を是正 |

#### 検証

- Jest 全体: **1976 passed / 3 skipped**（183 スイート）、tsc 0、lint 0 errors / 15 warnings

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| テスト総数 (unit/component) | 1975 passed / 1978 total | **1976 passed / 1979 total** |
| スイート数 | 183（182 passed + 1 skipped） | **183**（不変） |
| 型エラー | 0 件 | **0 件** |

---

### plan 053 — 認証サーフェスのスモーク E2E（TESTS-41） (2026-08-12)

#### 概要

Clerk のサインアップウィジェット描画・ヘッダーの Register 導線・サインアウト往復が E2E ゼロだった
（`plans/audit/findings-17-e2e-coverage-r9.md` TESTS-41）。R8 監査ではサインイン UI のドリフトが
認証系 E2E 16 件の全滅として初めて顕在化したが、**サインアップ側には同型のドリフトを早期検出する
canary が存在しない**（テストインフラはユーザー作成を Clerk API 直で行うため、サインアップ UI は
どのテストも通らない）。Clerk メジャーアップグレード（plan 004）時の回帰検出器も兼ねる。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `tests/e2e/auth-surface.spec.ts` | 新設・3 テスト（サインアップウィジェット描画 / Register 導線 / サインアウト往復） | `45cb7e1b` |

`src/` は **1 行も変更していない**（プランの Out of scope どおり）。

#### プラン本文と実 DOM の差 2 点（いずれも実測で是正）

1. **`<UserMenu />` はヘッダー内に 2 回描画される** — `header.tsx:32`（モバイル用 `lg:hidden`）と
   `:48`（デスクトップ用 `hidden lg:flex`）。両方 DOM に存在するため、テキスト一致だけでは
   strict mode violation になる。`filter({ visible: true })` で「今ユーザーが操作できる方」を指す
   —— どのビューポートで動かしても成立する。
2. **hover には `force: true` が必須（自己遮蔽デッドロック）** — ドロップダウンの器は
   `absolute -left-20 top-0 … group-hover:block` で、開くと**トリガー自身の上に重なる**。
   素の `hover()` は「対象がポインタイベントを受け取れるか」を確認してからマウスを動かすため、
   マウスが乗った瞬間に器が覆いかぶさって判定が永久に通らず 30s タイムアウトする。
   **症状の文言と真因がズレる典型例**: ログは "waiting for element to be visible and stable" と
   出るが、`boundingBox` を 6 フレーム測ると完全に静止していた。真因はマウス移動の前後で
   `document.elementFromPoint` を撮って確定（`SPAN` → `DIV.absolute -left-20 top-0 …`）。
   プラン記載の `.cl-userButtonTrigger` も同根で使えない —— `<UserButton />`（`user-menu.tsx:87`）は
   器の**内側**にあり、開く前は不可視（「開くために開いた状態が要る」鶏卵）。プランの
   STOP conditions が代替として挙げる `.group` 配下のアバターを hover 対象にした。
   **この器を開けたい後続テストは全て同じ罠を踏む。**

#### 検証

- 新スペック: chromium **3 passed** / 3 ブラウザ **9 passed**・**flaky 0**（リトライなし）
- 識別力の機械的確認: 3 assert を個別に崩すと**その test だけ**が落ちる
  （sign-up + Register を崩して **2 failed / 1 passed**、sign-out を崩して **1 failed / 2 passed**）
- 回帰: `layout-chrome`（chromium）**7 passed**
- `bunx tsc --noEmit` **0 件** / `bun run lint` **0 errors**（15 warnings は既存ベースライン）
- Drift check（`git diff --stat 99ede89..HEAD -- 'src/app/(auth)/' …/user-menu/ tests/e2e/helpers/`）:
  差分は `helpers/auth.ts` のみ ＝ plan 042 の signIn 修復で、プランが明示的に STOP 免除としている分

#### 本プランが主張しないこと

- フルサインアップ（確認コード入力 → セッション成立）は**意図的に対象外**（findings-17 Rejected 節）。
  将来必要になったら Clerk test mode の固定確認コード + `+clerk_test` メールで別 spec として設計する
- サインイン UI の検証は plan 042 の担当（重複させない）
- E2E フルラン（全 spec × 3 ブラウザ）は再取得していない —— 最新実測は
  **2026-08-04 の 83 passed / 0 failed / 3 flaky / 37 skipped** のまま

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Playwright E2E | 54 tests/browser・23 files・3 ブラウザ計 162 | **57 tests/browser・24 files・計 171** |
| E2E メインスペック | 14 | **15** |
| Jest テスト総数 (unit/component) | 1976 passed / 1979 total・183 スイート | **不変** |
| ダッシュボード集計ファイル数 | 213（QA_HANDOFF 記載）/ 214（実測） | **215** |
| 型エラー | 0 件 | **0 件** |

> **ダッシュボード集計の注意**: 213 → 215 の +2 のうち plan 053 の成果は 1 件だけで、
> もう 1 件は先行コミット `bda2df7a` の `src/app/(store)/browse/page.test.tsx`（未同期分）。

---

### plan 055 — ゲストカート → サインイン後の引き継ぎ E2E（TESTS-42） (2026-08-12)

#### 概要

「ゲスト状態で構築したカートが、サインイン後もそのまま使えて /checkout に持ち越される」という
**認証遷移をまたぐ導線**がどの層でも検証されていなかった（`plans/audit/findings-17-e2e-coverage-r9.md`
TESTS-42）。既存カバーは「未認証で Checkout → 認証エラー表示」（purchase-flow）と
「最初から認証済みでカート構築」（a11y/checkout・plan 047）のみ。`saveUserCart` の integration
テストは plan 005（カート整合性修正）待ちで deferred 継続中のため、**この経路は現状ノーガード**だった。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `tests/e2e/cart-login-handoff.spec.ts` | 新設・1 テスト（ゲスト構築 → サインイン → 引き継ぎ → サーバー保存 → 新規コンテキストでの再取得を直列検証） | `9704903c` |

`src/` は **1 行も変更していない**（プランの Out of scope どおり）。

#### 検証の肝 —— なぜ `page.reload()` ではダメか

reload は**同一ブラウザコンテキスト**のままなので localStorage が残り、Zustand ストアが
そこから再水和して同じ商品名を描画する。つまり **`saveUserCart` が完全に壊れて DB に 1 行も
書かれていなくても green になる**。「表示元がサーバーの Cart であること」を主張するには、
クライアント側の永続状態を持たない場所から開くしかない —— `browser.newContext()` で開き直し、
`finally` で `close()` している（`storageState` の使い回しも localStorage ごと復元するため不可）。

**プラン本文に無い追加を 1 点入れた**: 新規コンテキストで signIn した直後に
`localStorage.getItem("cart")` が空であることを assert している。「新規コンテキストだから
空のはず」はコメントで主張するだけでは保証にならず、ここが空でなければ下の検証は再び
クライアント永続を見ているだけになる。**前提を機械で固定した。**

#### Drift check（引っかかったが STOP 非該当）

`git diff --stat 99ede89..HEAD` の in-scope パスで `src/queries/user.ts` が **+1565/−703** と
大きく動いていた。差分はヘルパー抽出（`findCartProductWithVariantAndSize`）と構造化ログの
refactor で、プランが**前提とする契約**はいずれも健在だった:

- `saveUserCart` は未認証で `Unauthenticated.` を throw する（`user.ts:333`）
- `summary.tsx` は `saveUserCart` 成功時のみ `router.push("/checkout")`（`:25-36`）
- testid `checkout`（`:85`）/ `cart-total`（`:77`）

`container.tsx` の −1 行はデバッグ `console.log` の除去。`purchase-flow.spec.ts` は無変更。

#### 検証

- 新スペック: chromium **1 passed** / 3 ブラウザ **3 passed**・**flaky 0**（リトライなし）
- 識別力の機械的確認: step 5 の期待値を存在しない文字列へ崩すと落ちることを実測してから戻した
- 回帰: `purchase-flow`（chromium）**5 passed**
- `bunx tsc --noEmit` **0 件** / `bun run lint` **0 errors**（15 warnings は既存ベースライン）

#### 本プランが主張しないこと

- **金額・数量の厳密検証はしない**（`saveUserCart` は plan 005 の correctness 修正対象。
  修正が入っても壊れない「アイテムが存在する」レベルに留める意図的な設計。
  **005 実装後は本 spec を回帰テストとして使い、検証を強化すること**）
- DB の Cart 行を Prisma で直接検証していない（deferred の saveUserCart integration テストの担当）
- /checkout 以降の操作（住所選択・Place Order）は plan 047 / platform-coupon の担当
- E2E フルラン（全 spec × 3 ブラウザ）は再取得していない —— 最新実測は
  **2026-08-04 の 83 passed / 0 failed / 3 flaky / 37 skipped** のまま

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Playwright E2E | 57 tests/browser・24 files・3 ブラウザ計 171 | **58 tests/browser・25 files・計 174** |
| E2E メインスペック | 15 | **16** |
| Jest テスト総数 (unit/component) | 1976 passed / 1979 total・183 スイート | **不変** |
| ダッシュボード集計ファイル数 | 215 | **216** |
| 型エラー | 0 件 | **0 件** |

---

### plan 010 — 配送料 SSOT `computeShippingTotal` の直接ユニットテスト (2026-08-13)

#### 概要

`.claude/steering/tech.md` が「すべての配送料計算はここを通す」と規約化している
`computeShippingTotal` に、初めて**直接の**ユニットテストを追加した。

#### なぜ必要だったか（オラクル問題）

本関数はこれまで統合テスト内でのみ間接的に実行されていたが、**そこでは期待値の算出にも
`computeShippingTotal` 自身が使われていた**。自分自身をオラクルにしているため、
関数が一貫して間違っていても検出できない —— 金額に触れる SSOT としては致命的な穴だった。
本テストの期待値は**すべて手計算した定数のハードコード**で、関数を呼んで導出したものは無い。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/lib/shipping-utils.test.ts` | 新設・8 ケース（quantity ガード 2 / ITEM 2 / WEIGHT 3 / FIXED 1） | `8b83c185` |
| `src/lib/shipping-utils.ts` | **無変更**（本プランは characterization のみ） | — |

カバーした分岐: `quantity <= 0` の早期ガード（0 / 負値）、ITEM の単数（extra 項ゼロ）と
複数（`base + (qty-1) * extra`）、WEIGHT の整数計算・float 誤差の 2 桁正規化
（`0.1 × 0.1 × 3` = 0.030000000000000006 → 0.03）・`.xx5` の half-up 丸め境界
（`0.25 × 0.5 × 1` = 0.125 → **0.13**）、FIXED の weight / quantity / extra 非依存。

**float 正規化と丸め境界は別の分岐**なので両方必要。前者は「誤差を落とせているか」、
後者は「境界でどちらに倒れるか」を見ており、片方だけでは half-up が banker's rounding に
変わっても気づけない。

#### 識別力の機械的確認

丸め境界ケースの期待値を 0.12 へ崩すと、**当該テストのみ**が
`Expected: 0.12 / Received: 0.13` で落ちることを実測してから戻している。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 (unit/component) | 1976 passed / 1979 total | **1984 passed / 1987 total** |
| Jest スイート数 | 183 | **184** |
| Jest Integration | 66 / 8 スイート | **不変** |
| Playwright E2E | 58 tests/browser・計 174 | **不変** |
| ダッシュボード集計ファイル数 | 216 | **217** |
| 型エラー | 0 件 | **0 件** |

> **⚠️ 上表の「更新前」は SSOT（`QA_HANDOFF.md`）の値である。** 本ファイルのテスト統計
> テーブルは 1915 / 180 スイートのまま据え置かれており、本セッションで**61 テスト・
> 3 スイート分の未同期を併せて是正**した。plan 010 の成果は +8 / +1 スイートのみ。

---

### plan 041 — `Coupon.code` グローバル unique と P2002 の実 DB 統合テスト (2026-08-13)

#### 概要

`Coupon.code` はスキーマ上グローバル一意（`@unique`・storeId との複合ではない）だが、
seller 経路 `upsertCoupon` の事前重複チェックは**自店舗内のみ**を検索する。つまり
**他店舗または PLATFORM クーポンが同じ code を持つ場合、事前チェックを素通りして
実 DB の unique 制約だけがこれを止める**。これは競合（race）ではなく、2 店舗が両方
"SUMMER10" を作ろうとするだけで**決定論的に到達する本経路**である。

unit テストは P2002 をモックの reject で注入するだけなので、実制約の発火・既存行の無傷・
新規行の不在は原理的に観測できない。それを実 PostgreSQL（testcontainers）で固定した。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `tests/integration/coupon-code-uniqueness.test.ts` | 新設・5 シナリオ | `c6a5064f` |
| `src/queries/coupon.ts` | **無変更**（characterization のみ） | — |
| `scripts/coverage-dashboard/render-html.ts` | R7 エントリを削除（ラウンド完了） | docs 同期コミット |
| `docs/testing/QA_HANDOFF.md` | R7 プロンプト節を削除（二重 SSOT の同期） | 同上 |

#### 設計上の重要な制約 — 内部経路を推論しない

事前チェックと P2002 フォールバックは**まったく同じエラーメッセージ**
`'このクーポンコードは既に使用されています'` を投げる。したがって `rejects.toThrow` だけでは
どちらの経路で拒否されたか判別できない。

かつてプランは「事前チェックと同一条件の `findFirst` をテスト側で実行して null を確認する」
方法を指定していたが、**経路の証明にならない**ため 2026-07-18 に撤回された —— その
`findFirst` は実装内部の事前チェックを観測しておらず、テスト側で `storeId` をハードコード
した別クエリを走らせているだけである。将来事前チェックがグローバル化されて P2002 経路が
一度も実行されなくなっても、テスト側のクエリは同じ結果を返し続けるので**緑のまま腐る**。

本テストは**外から観測可能な不変条件だけ**（拒否 + 既存行無傷 + 行数不変）を assert する。

> **なお実行時 stderr が経路を実証している。** `Unique constraint failed on the fields: (code)`
> が `coupon.ts:117`（upsert）で発生し `logError`（`:144`）を経て P2002 分岐に到達している。
> 事前チェック経路は `isDomainError` により `:142` で **logError より手前**で再 throw される
> ので、**ログが出たこと自体が「実 unique 制約が発火した」証拠**になる。ただしこれは
> 観測であって assert ではない（ログに依存した検証は実装のログ形式に結合するため入れない）。

#### プラン本文からの逸脱 2 点

1. **P2002 変換のユニットテスト（+2）は追加していない。** プランは
   `src/queries/coupon.test.ts` に seller / admin 各 1 本を要求しているが、**両方とも既に
   存在する**（`:154` と `:1478`。しかも要求どおり `findFirst` を null にして事前チェックを
   素通りさせる形）。プラン本文の側が執筆後の実装に追い越されていた。**Jest は +0。**
2. **code `"ADMIN-CLASH"` は使えない。** `CouponFormSchema`（`src/lib/schemas.ts:531`）が
   `/^[A-Za-z0-9]+$/` を要求するため、ハイフン入り code は unique 制約に到達する前に
   「クーポンの入力値が不正です。」で弾かれ、見たい経路に入らない（`ADMINCLASH` へ変更）。
   なお `CouponFormSchema` による検証（`coupon.ts:107-112`）自体がプランの Current state に
   無い —— plan 060 / SECURITY-14 で事前チェックと upsert の**間**に追加されたものである。

#### 識別力の機械的確認

シナリオ 2 の `storeId` 期待値を `storeB.id` → `storeA.id` に崩すと、**当該テストのみ**が
落ちることを実測してから戻している。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest Integration | 66 / 8 スイート | **71 / 9 スイート** |
| Jest テスト総数 (unit/component) | 1984 passed / 184 スイート | **不変** |
| Playwright E2E | 58 tests/browser・計 174 | **不変** |
| ダッシュボード集計ファイル数 | 217 | **218** |
| 型エラー | 0 件 | **0 件** |

---

### plan 034 — `upsertReview` の評価集計を実 DB 統合テストで固定 (2026-08-13)

#### 概要

商品の `rating` / `numReviews` は商品カード・商品詳細・プロフィールに広く出る**信頼シグナル**
だが、その集計 —— レビュー投稿のたびに全レビューを読み直して平均を再計算し
`product.update` する（`src/queries/review.ts:107-131`）—— は実 DB で一度も検証されて
いなかった。全モックの unit テスト（`src/queries/review.test.ts`）は**呼び出し構造しか
固定できず**、次の 2 点は原理的に観測できない:

- 同一ユーザーの再投稿が create ではなく **update** になる（`numReviews` が増えない）
- 複数ユーザーの平均が**実データから**正しく導出される

集計ドリフトは静かに蓄積し、表示上の平均と実レビューの乖離として顧客に露出する。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `tests/integration/review-aggregation.test.ts` | 新設・5 シナリオ | `734a34b4` |
| `src/queries/review.ts` | **無変更**（characterization のみ） | — |
| `scripts/coverage-dashboard/render-html.ts` | R5 の残タスクを「033〜035」→「035 のみ」へ | docs 同期コミット |
| `docs/testing/QA_HANDOFF.md` | R5 プロンプトを 035 向けへ差し替え（二重 SSOT の同期） | 同上 |

シナリオ: 初回投稿（rating=4 / numReviews=1 + **User フォールバック upsert** による
reviewer の自動作成）/ 複数ユーザーの平均（4 と 2 → 3）/ 同一ユーザー再投稿
（5 → 件数 2 のまま・平均 3.5・画像は総入れ替えで 1 件）/ 商品間の独立性 /
未認証 reject + 副作用なし。

#### 設計判断 2 点

1. **前提を assert に落とした。** シナリオ 1 は呼び出し**前**に
   `db.user.findUnique({ where: { id: "reviewer-1" } })` が `null` であることを検証する。
   「新規 reviewer だから DB に居ないはず」をコメントで主張するだけでは、もし居た場合に
   User フォールバックの create 分岐を素通りし、**検証したい経路を一度も通らないまま
   緑になる**。
2. **画像枚数は対象 review に限定して数える。** グローバルな `db.reviewImage.count()` は
   reviewer-2 の画像や他 Product の画像も拾うため、`deleteMany + create` の総入れ替えが
   壊れても検出できない / 逆に無関係な理由で落ちる。まず対象 review を特定してから
   `where: { reviewId }` で数えている。

#### 申し送り（本プランが主張しないこと）

- **並行投稿の lost update は未検証。** 集計は非トランザクション（create → findMany →
  `product.update` の 3 往復）なので理論上は起こりうる。本スイートが固定したのは
  **逐次実行時の集計正しさのみ**である。`$transaction` 化や DB 側集計を入れる場合、
  本スイートはそのまま回帰ガードとして使える。
- `Store.averageRating` の集計は対象外（`upsertReview` は Product の rating のみ更新する。
  Store 側は Round 3 spike 022 の設計対象）。
- レビューの**編集 UI・削除**および画像の部分更新は対象外。

#### 識別力の機械的確認

シナリオ 3 の `review.count` 期待値を 2 → 3 に崩すと、**当該テストのみ**が
`Expected: 3 / Received: 2` で落ちることを実測してから戻している（upsert 分岐が create に
落ちる回帰の検知点）。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest Integration | 71 / 9 スイート | **76 / 10 スイート** |
| Jest テスト総数 (unit/component) | 1984 passed / 184 スイート | **不変** |
| Playwright E2E | 58 tests/browser・計 174 | **不変** |
| ダッシュボード集計ファイル数 | 218 | **219** |
| 型エラー | 0 件 | **0 件** |


---

### plan 035 の実行（`updateStoreStatus` の PENDING→ACTIVE ロール昇格を実 DB 統合テストで固定 / TESTS-19） (2026-08-23)

#### 概要

店舗承認時の**権限境界の変更**（`User.role` を USER → SELLER へ昇格）を実 DB
（testcontainers PostgreSQL）で初めて検証する統合スイートを新設した。`src/queries/store.ts`
は 1 行も変更していない。本プランの完了で **improve Round 5 の Integration ギャップが閉じ切った**。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `tests/integration/store-status.test.ts` | 新規作成（8 シナリオ） | `e6ebdb15` |
| `scripts/coverage-dashboard/render-html.ts` | `NEXT_ACTIONS` の R5 エントリを削除（クローズ済みコメントへ置換） | docs 同期コミット |
| `docs/testing/QA_HANDOFF.md` | 統計 SSOT 更新 + R5 依頼プロンプト節を削除 | docs 同期コミット |

#### 検証境界

1. PENDING → ACTIVE で `User.role` が SELLER へ昇格し、Clerk 同期が 1 回発火する
2. PENDING → BANNED では昇格せず Clerk も呼ばれない
3. DISABLED → ACTIVE は **DB 昇格なし・Clerk 同期あり**（`TODO(characterization)`）
4. ACTIVE → ACTIVE の再実行は DB 冪等・Clerk 呼び出しは累計 2 回（非冪等）
5. 未知 `storeId` は `"Store not found."` で reject・副作用なし
6. 非 ADMIN / 未認証の拒否 + `Store.status` 不変
7. `$transaction` の原子性（後段失敗で前段もロールバック）

#### 申し送り: シナリオ 3 は既知バグの characterization → **2026-08-24 に remediation 済み**

**当時（plan 035 実行時点）の観測**: Clerk 同期の条件は `updatedStore.status === "ACTIVE"`
のみで**起点ステータスを見なかった**。このリポジトリの認可ソースは DB の `User.role` では
なく Clerk の `privateMetadata.role`（`src/lib/auth-guards.ts` の `requireSeller`）なので、
DISABLED/BANNED → ACTIVE では **DB が USER のままでも実際に販売者権限が通る**権限昇格
バグだった。上の「検証境界 3」はその characterization である。

**現況**: `7a56c93d`（`fix(auth): updateStoreStatus での意図しない販売者ロール昇格を防止`）
で本体を修正済み。**DB 上 SELLER である場合**（PENDING からの昇格後 / 既存 SELLER）のみ
Clerk メタデータを同期する。これに伴い `tests/integration/store-status.test.ts` の
シナリオ 3 は characterization から**回帰ガードへ反転済み**で、期待値は
`mockUpdateUserMetadata` が `not.toHaveBeenCalled()` であること
（`tests/integration/store-status.test.ts:198-203`）。

#### シナリオ 7（原子性）が本スイートの中心

シナリオ 1〜4 は「status 更新とロール昇格が**両方成功した**」ことしか示さない。同一
`$transaction` かどうかは、後段だけを決定論的に失敗させて前段が巻き戻るのを見ない限り
実証できない。失敗注入の手段は限られる —— オーナー User の事前削除は `Store.user` が
`onDelete` 未指定＝既定 `Restrict` のため FK で拒否され、統合テストは実 DB シングルトンを
共有するので `tx.user.update` の spy 差し替えも不可。残る手が**一時 CHECK 制約**
（`tmp_block_seller`）である。`resetDb` は TRUNCATE でありテーブル制約を落とさないため
DROP は `finally` 必須で、その漏れは**同一ファイルの 2 回連続実行**でしか顕在化しない
（実測で 2 回とも pass）。

#### プラン本文からの逸脱 1 点

`StoreStatus` は `@prisma/client` と `@/lib/types`（`types.ts:517`）の **2 系統**があり、
`updateStoreStatus` の引数型は後者（`store.ts:4` が import）。TS の enum は名前的型なので
値が同一文字列でも相互代入できず、混同すると**テストは緑のまま `tsc --noEmit` だけが落ちる**。
呼び出し側は `AppStoreStatus` の別名 import に統一した。プラン本文の Current state は
この二重定義に触れていない。

#### 識別力の機械的確認

シナリオ 7 の `expect(storeAfter.status).toBe(StoreStatus.PENDING)` を `ACTIVE` へ崩すと、
**当該テストのみ**が落ち他の 7 件は通ったままであることを実測してから戻している。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest Integration | 78 / 10 スイート | **86 / 11 スイート** |
| Jest テスト総数 (unit/component) | 1987 passed / 184 スイート | **不変** |
| Playwright E2E | 58 tests/browser・計 174 | **不変** |
| ダッシュボード集計ファイル数 | 219 | **220** |
| 型エラー | 0 件 | **0 件** |


---

### plan 056 の実行（Newsletter 購読フォームの dormant 404 を characterization E2E で固定 / TESTS-39） (2026-08-23)

#### 概要

フッターの Newsletter フォームが POST する `/api/newsletter` はリポジトリに存在せず
（schema にも購読者モデル無し）、全購読操作が失敗する。この dormant なギャップを CI で
可視化し続けるための characterization spec を新設した。`src/` は 1 行も変更していない。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `tests/e2e/newsletter.spec.ts` | 新規作成（2 テスト） | `50664cc5` |

#### 契約の形（本プランの核心）

assert は `response.ok() === false` であって `toBe(404)` では**ない**。404 は
「購読は成功しない」という恒久的な命題ではなく、「route ファイルが無い」という**偶発的な機構**
にすぎない。404 を成功条件に固定すると 2 つの向きで壊れる:

1. **偽の健全性** — ルーティング回帰で API が軒並み 404 になっても、緑のまま
   「characterization どおり」と報告する。実際には全部壊れている
2. **誤った失敗トリガー** — catch-all が 501 を返す等、ユーザーから見た挙動が変わらない
   変更で赤くなる

`not.toBe(200)` でも不足で、201 Created / 202 Accepted / 204 No Content を「成功していない」と
見なしてしまう（`ok()` は 200-299 で true）。plan 050 が確立した「修正を罰するテストは書かない」
原則と同型。

#### 「起きないこと」を時間で証明しない

空メールでの POST 不発は、固定待機ではなく `invalid` イベントを `expect.poll` で待ち切ってから
`toHaveLength(0)` を見る。`invalid` は submit 試行時の制約検証失敗**でのみ**発火するため、
「submit が処理され、かつブロックされた」ことを一意に示す。`checkValidity()` は validity を
問い合わせるだけの純粋関数で **click 前でも `false`** を返すので、待ちの基準にすると初回評価で
即成立し、**まだ飛んでいない POST を「無かった」と誤判定する**。

#### 識別力の機械的確認

`response.ok()` の期待値を `true` へ、`toHaveLength(0)` を `(1)` へそれぞれ崩すと
**2 failed** になることを実測してから戻している。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Playwright E2E | 58 tests/browser・25 files・計 174 | **60 tests/browser・26 files・計 180** |
| Jest テスト総数 (unit/component) | 1987 passed / 184 スイート | **不変** |
| Jest Integration | 86 / 11 スイート | **不変** |
| ダッシュボード集計ファイル数 | 220 | **221** |
| 型エラー | 0 件 | **0 件** |


---

### plan 030 の実行（money-path クライアント 6 ファイルの component テスト / TESTS-01 残余） (2026-08-23)

#### 概要

チェックアウト完了率という最重要 KPI の動線を構成しながら lcov **0%** だった
クライアントコンポーネント 6 ファイルに component テストを新設した（**+26 テスト / +6 スイート**）。
**1 ファイル = 1 コミット**（rule 02）。本プランの完了で **improve Round 4 が閉じ切った**。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `tests/component/store/newsletter.test.tsx` | 新規（4 ケース） | `13d3dd70` |
| `tests/component/store/cart-summary.test.tsx` | 新規（4 ケース） | `33814ae1` |
| `tests/component/store/paypal-payment.test.tsx` | 新規（4 ケース） | `89155f93` |
| `tests/component/store/stripe-payment.test.tsx` | 新規（6 ケース） | `87be3ddb` |
| `src/components/store/checkout-page/container.tsx` | **本体修正**（hydrate 失敗の握り） | `066ffd2f` |
| `tests/component/store/checkout-container.test.tsx` | 新規（4 ケース） | `235fabcb` |
| `tests/component/store/cart-container.test.tsx` | 新規（4 ケース） | `2a04e331` |

#### カバレッジ（対象 6 ファイル・lcov Lines）

| ファイル | 更新前 | 更新後 |
|---|---|---|
| `cards/payment/paypal/paypal-payment.tsx` | 0% | **100%** (16/16) |
| `cards/payment/stripe/stripe-payment.tsx` | 0% | **97.6%** (41/42) |
| `cart-page/container.tsx` | 0% | **100%** (33/33) |
| `cart-page/summary.tsx` | 0% | **100%** (22/22) |
| `checkout-page/container.tsx` | 0% | **96.8%** (30/31) |
| `layout/footer/newsletter.tsx` | 0% | **100%** (29/29) |

#### 検出した実バグ 2 件

本プランは plan 010 / 034 のような「網を張った」型ではなく、**「壊れているものを見つけた」型**の成果である。

1. **hydrate 失敗が未処理 rejection になっていた（修正済み・`066ffd2f`）**
   `checkout-page/container.tsx` の `useEffect` は `updateCheckoutProductWithLatest()` を
   catch なしで呼んでいた。実害はユーザー側にあり、引き直しが失敗しても画面には
   **古い金額が表示されたまま**で、そのまま注文を確定できてしまう。オペレーター承認のうえ
   try/catch + 構造化ログ + `toast.error` を入れ、あわせて `tech.md` の
   「useEffect キャンセルフラグ」パターンも適用した（`activeCountry` 切替で再実行されるため
   古いレスポンスが新しい状態を上書きするレースがあった）。
2. **Stripe の intent 取得失敗時のエラー表示が到達不能（未修正・characterization）**
   `getClientSecret` の catch は `setErrorMessage` を呼ぶが、直後の早期リターン
   （`!clientSecret`）がローダーを返すため、`errorMessage` を描画する `<form>` に到達しない。
   ユーザーが見るのは**無限スピナー**。プランの Out of scope のため本体は修正せず、
   実挙動を固定して修正時に期待値を反転させる旨をテスト内に明記した。

#### `it.failing` は使えなかった（実測で棄却）

プラン Step 5 は hydrate 失敗の検知点を `it.failing` で作る案を提示しているが、
**`it.failing` が反転するのは assertion の結果だけ**である。`useEffect` の外へ漏れた
rejection は Node のプロセスレベルで浮上するため吸収されず、実測では **1 failed** かつ
**同じ rejection が 2 重報告**された。プランが要求する検証手順（単独実行が緑 + フルランも緑）を
満たせなかったため、プランが推奨する代替 (a)「本体側で握る」を採った。

#### プラン本文からの逸脱 2 点

1. **`createMockCartItem` は使えない。** プランは共通ファクトリとしてこれを指定するが、
   返すのは Prisma `Decimal` を持つ **DB の CartItem** で、`CartSummary` が受け取る
   `CartProductType`（`price: number`）とは別物。同じ `src/config/test-fixtures.ts` の
   **`createMockCartProduct`** を使用した（共通基盤を使う要件は満たしている）。
2. **ケース数はプラン本文より多い**（3+4+5 指定 → 実装 4+4+6）。いずれも分岐の false 側を
   1 件ずつ追加したもの: `saveUserCart` が falsy を resolve する経路 /
   `createStripePayment` が `paymentDetails` を返さない経路。前者は
   実装が `if (res) router.push(...)` なので reject 系だけでは未検証で残る。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 (unit/component) | 1987 passed / 184 スイート | **2013 passed / 190 スイート** |
| lcov Statements | 68.49% | **70.51%** (6154/8727) |
| lcov Branches | 48.46% | **50.00%** (2611/5221) |
| lcov Lines | 67.5% 台 | **69.67%** (5548/7963) |
| Jest Integration | 86 / 11 スイート | **不変** |
| Playwright E2E | 60 tests/browser・計 180 | **不変** |
| ダッシュボード集計ファイル数 | 221 | **227** |
| 型エラー | 0 件 | **0 件** |


---

### plan 038 の実行（`upsertProduct` の全置換 tx・slug 一意性・SetNull 連鎖 / TESTS-22） (2026-08-23)

#### 概要

セラーの商品編集フロー（`handleProductAndVariantUpdate`）を実 DB で初めて検証した。
`src/queries/product.ts` は 1 行も変更していない。**Integration 86 → 91 / スイート 11 → 12**。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `tests/integration/product-update.test.ts` | 新規作成（5 シナリオ） | `85d7e442` |

#### 固定した最重要の仕様: 編集がカート/ウィッシュリストへ及ぼす副作用

sizes は `deleteMany` → `createMany` の**全置換**なので、`Size.id` が**編集のたびに変わる**。
その帰結として:

- `Wishlist.sizeId` は実 FK（`ON DELETE SET NULL`）なので **NULL 化**する
- `CartItem.sizeId` は **FK なしの平文字列**なので**古い id のまま残る**（参照先は既に存在しない）

後者は checkout の再検証で弾かれる経路の前提であり、ここに仕様として固定した。

#### 失敗注入は tx の「後段」でなければ原子性の証拠にならない

tx 冒頭（`product.update`）で落とすと、Spec / Question / Size の置換は**そもそも一度も
実行されない**。旧行が残るのは「巻き戻った」のではなく「未実行」なだけで、
**`$transaction` が無くてもテストは緑になる**。tx 内の最終操作だけを一時 CHECK 制約で落とし、
**旧 `Size.id` が保たれている**ことを決定的な証拠にした（シナリオ 1 のとおり、置換が実行されれば
id は必ず新しくなる）。

#### DDL の後始末を 3 通りで実測検証した

1. 同一ファイル 2 回連続実行 → 2 回とも 5 passed
2. **リーク状態からの冪等回復** — `beforeEach` で制約を張った状態でも全 pass
   （testcontainers は実行ごとに新 DB を立てるため、同一 run 内で人工的にリークを再現した）
3. **`finally` 側の `IF EXISTS` が本来の失敗を隠さない** — ADD を意図的に失敗させると、
   報告されるのは ADD 側のエラー（`42703 column "nonexistent_column" does not exist`）であって
   「制約が無い」という二次エラーではない。素の DROP だと `finally` の throw が try の例外を
   置き換え、失敗注入が成立したのかすら判別できなくなる

#### CI 直列化要件は既存構成で充足済み（ワークフロー未変更）

プランの Done criteria は「DDL テストを他 integration ジョブと並行させない構成が
`.github/workflows/` に反映されていること」を求めるが、本リポジトリでは構造的に充足済み:
`jest.integration.config.js:63` の `maxWorkers: 1` がランナー内を直列化し、`globalSetup` が
**実行ごとに専用の testcontainers PostgreSQL を立てる**（ADR-004）ため、共有 DB を掴む
並行ジョブがそもそも存在しない。CI も `integration-tests` 単一ジョブで `services:` 不使用。
冗長な変更は加えず、根拠を記録するに留めた。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest Integration | 86 / 11 スイート | **91 / 12 スイート** |
| Jest テスト総数 (unit/component) | 2013 passed / 190 スイート | **不変** |
| Playwright E2E | 60 tests/browser・計 180 | **不変** |
| ダッシュボード集計ファイル数 | 227 | **228** |
| 型エラー | 0 件 | **0 件** |


---

### plan 039 の実行（`getProducts` のフィルタ/ソート/ページング統合 / TESTS-23） (2026-08-23)

#### 概要

`/browse` の供給源 `getProducts` の where 動的合成・ソート・ページングを実 DB で初めて
検証した（**8 シナリオ / 16 テスト**）。本プランの完了で **improve Round 6 が閉じ切った**。
**実バグを 1 件検出し、オペレーター承認のうえ本体を修正**している。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/queries/product.ts` | **本体修正**（`lte: Infinity` の除去） | `f1be1aa0` |
| `tests/integration/product-browse.test.ts` | 新規作成（8 シナリオ / 16 テスト） | `e5b2e8a5` |

#### 検出した実バグ: `lte: Infinity` が Prisma の Decimal フィルタで throw する

上限未指定時、実装は `lte: filters.maxPrice || Infinity` を渡していた。Prisma は
**Decimal カラムのフィルタに Infinity を載せられず**、シリアライズ時に値が落ちて
`Argument \`lte\` is missing.` で **throw** する（Prisma 5.22.0 実測）。
つまり「**下限だけ指定した価格絞り込み**」は常に失敗していた。

`/browse` は `page.tsx` が `maxPrice` を `Number.MAX_SAFE_INTEGER` に既定化しているため
**ストアフロント経由では再現しない**。`getProducts` を直接呼ぶ経路と、複合フィルタ
`{ category, minPrice }` で落ちる。上限が無いときは `lte` を付けない形へ修正した。

#### Arrange では assert が依存する値をすべて明示する

- **`views` / `createdAt` を相異なる値に固定**しないと、既定 `orderBy`（views desc）が
  同値になる。**PostgreSQL は同値行の順序を保証しない**ため、ページング検証が
  実 DB の行順に依存したフレークテストになる
- **全 Size の `price` と `discount` を明示**する。フィルタは生の `price` を `some` で見る
  （どれか 1 Size が範囲内なら商品全体がヒットする）ため追加 Size が絞り込みに紛れ込み、
  ソートは `discount` 込みの割引後価格を見るためスキーマ既定値任せだと並び順が静かに壊れる

#### プラン本文からの逸脱 2 点

1. **シナリオ 2 の fail-open characterization は既に修正済みだった。** プランは
   「存在しない category URL はフィルタ脱落 → 全件返る」を固定せよと指示するが、その挙動は
   **`cce53407`（2026-08-12 "fix(queries): return no results when a URL filter matches no
   row"）で fail-closed に修正済み**。プラン本文が指定する反転先（`totalCount === 0`）へ
   期待値を反転し、同型の store / offer 経路も併せて固定した（片方だけ退行しても検出できる）。
2. **「Clerk mock 不要」は成立しない。** `getProducts` は `currentUser` を呼ばないが、
   **モジュール `src/queries/product.ts` が Clerk を import している**ため、モックが無いと
   読み込み時点で `@clerk/backend` の ESM を jest が解釈できず SyntaxError になる。
   判断基準は「その関数が使うか」ではなく「**そのモジュールが読み込むか**」。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest Integration | 91 / 12 スイート | **107 / 13 スイート** |
| Jest テスト総数 (unit/component) | 2013 passed / 190 スイート | **不変** |
| Playwright E2E | 60 tests/browser・計 180 | **不変** |
| ダッシュボード集計ファイル数 | 228 | **229** |
| 型エラー | 0 件 | **0 件** |


---

### plan 049 の実行（プロフィール系 E2E: 住所管理 + 注文履歴 / TESTS-37） (2026-08-23)

#### 概要

`/profile` 配下は a11y スキャン 1 本しか E2E が無かった。住所管理と注文履歴をブラウザ導線で
固定した（**+2 tests/browser / +1 file**）。本プランの完了で **improve Round 8 が閉じ切った**。
**実バグを 2 件検出し、いずれもオペレーター承認のうえ本体を修正**している。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/components/store/shared/shipping-addresses/address-details.tsx` | **本体修正**（選べない国のエラー表面化） | `f7e2bc59` |
| `tests/component/store/shipping-form.test.tsx` | 検知点 +1 | `0649bf57` |
| `src/components/store/profile/orders/orders-table.tsx` ほか | **本体修正**（RSC 境界の Decimal） | `652e4f5b` |
| `src/components/store/profile/orders/orders-table.test.tsx` ほか | 検知点 +3 / スイート +1 | `34134ded` |
| `tests/e2e/profile.spec.ts` | 新規作成（2 テスト） | `b002373e` |

#### 検出した実バグ 1: `/profile/orders` がページ全体描画に失敗していた

`orders-table.tsx` / `payments-table.tsx` は `"use client"` で、Server Component から
Prisma `Decimal` を props で受け取る。**RSC 境界を越えると Decimal はメソッドを失った素の値**に
なるため、`order.total.toFixed(2)` / `payment.amount.toNumber()` が TypeError になる。
実測では `/profile/orders` が "This page couldn't load" になり、
サーバーログに `TypeError: a.total.toFixed is not a function` が出ていた。
既存ヘルパー `toNumberSafe`（`src/lib/utils.ts:32`）経由へ変更した。

**なぜユニットテストで捕まらなかったか**: 既存の `payments-table.test.tsx` は
`amount: { toNumber: () => 1000 }` という**本物の Decimal 風モック**を渡しており、
RSC のシリアライズ境界はテストに存在しないため当該経路を一度も踏まない。検知点は
**素の number / string を渡す**形で追加した（実障害は string 形で起きる ——
number は `.toFixed` を持つので素通りする）。

#### 検出した実バグ 2: 住所フォームが選べない国を黙って無視していた

`CountrySelector` は**静的な ISO 国リスト**を描画するが、保存できるのは DB の `Country` 行だけで、
両者は名前一致でしか結びつかない。一致しない場合 `handleCountryChange` は `if (country)` の中でしか
処理せず、UI 上は国が選ばれたように見えるのに `countryId` が空のまま残り、送信時には
「国が原因」と分からない検証エラーだけが出ていた。**E2E 環境ではこれが常に起きる** ——
seed は並列分離のため国名にサフィックスを付ける（実測: `United States CHROMIUM-W0` の 3 行のみ）ので、
**UI からは住所を 1 件も登録できない**。国の欄でエラーを表面化させる形へ修正した。

#### プラン本文からの逸脱 4 点（いずれもプラン側の記述が実装と食い違っていた）

1. 送信ボタンは新規追加では **`Create Address`**（`Save Address information` は編集時のラベル）
2. 国は native `select` ではなく**カスタムコンボボックス**（トグル → 検索 → `role="option"`）
3. **seed の国は選択肢に現れない**ため、spec 側で静的リストと一致する実国名の Country 行を用意した
4. 氏名は**英字のみ**（`ShippingAddressSchema` の `/^[a-zA-Z]+$/`）。`"E2E"` は数字を含み弾かれる

#### 観測したが触っていないもの（当時は未起票）→ **2026-08-24 に修正済み**

**当時の観測**: `payments-table.tsx` は `paymentMethod === "Stripe"` の行を表示時に
**`/ 100`** していた（セント建ての名残）。plan 063 の backfill と Round 14 A-3
（`e63474b`）で `PaymentDetails.amount` はドル建てに統一済みなので、**この除算は表示額を
1/100 にしている可能性がある**と記録した。本プランの範囲外のため当時は修正していない。

**現況**: `e918c9d7`（`fix(payments): PaymentsTable での Stripe ドル建て金額の二重除算を撤去`）
で除算を撤去済み。表示は provider によらず `toNumberSafe(payment.amount).toFixed(2)` に
統一され、`payments-table.tsx:134-145` に「ここで provider を見て `/ 100` すると正しく
保存された行が 1/100 に化ける」根拠コメントを残してある。**回帰検知点も追加済み** ——
`src/components/store/profile/payments/payments-table.test.tsx:281` の
"does not divide a serialized Stripe dollar amount by 100"（RSC 越しに文字列化された
Stripe のドル建て金額が除算されないことを固定）。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Playwright E2E | 60 tests/browser・26 files・計 180 | **62 tests/browser・27 files・計 186** |
| Jest テスト総数 (unit/component) | 2013 passed / 190 スイート | **2017 passed / 191 スイート** |
| Jest Integration | 107 / 13 スイート | **不変** |
| ダッシュボード集計ファイル数 | 229 | **231** |
| 型エラー | 0 件 | **0 件** |


---

### plan 054 の実行（VRT 対象の拡大 / TESTS-44）— **部分完了** (2026-08-23)

#### 概要

VRT の対象は cart 2 枚 + checkout リダイレクト 1 枚のみで、購買判断が起きるページの
レイアウト回帰を検出する層が無かった。**browse のみベースライン化**し、
**商品詳細は目視ゲートで欠陥を検出したため見送った**。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `tests/e2e/visual/browse.spec.ts` + ベースライン PNG | 新規作成（1 テスト） | `0dba44de` |

#### 商品詳細を見送った理由（プラン Step 3 の目視ゲート）

撮影したベースラインで、右側の購入パネル（Ship to / Buy now / **Add to cart**）が
**1280px ビューポートでクリップされている**ことを検出した。客観測定では
`scrollWidth === clientWidth === 1280` で**ドキュメントの横スクロールは発生しておらず**、
親コンテナ側で切れている。

**VRT のベースライン PNG は「意図した見た目」の宣言**である。この状態を固定すると
**欠陥をロック**することになり、次の担当者は「直したらテストが壊れた」と受け取る
（plan 050 が確立した「修正を罰するテストは書かない」原則と同型）。
**レイアウト修正は [plans/065](../plans/065-fix-product-detail-right-panel-clipping.md) として起票済み**（2026-08-24）。**商品詳細のベースラインは 065 完了まで引き続き保留**で、修正後に改めて撮影する。

#### browse ベースラインの目視確認結果

グリッドは seed 商品 10 件を 4 列で描画し、サイドバーのフィルタ・ソート・
ページネーション・フッターまで崩れなく出ている。マゼンタの矩形は Playwright の
**mask 描画**であって未ロード画像ではない。

#### 再現性

ベースライン撮影後、更新フラグなしで **2 回連続実行して 2 回とも 4 passed**。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Playwright E2E | 62 tests/browser・27 files・計 186 | **63 tests/browser・28 files・計 189** |
| Playwright Visual | 2 スペック / 3 テスト | **3 スペック / 4 テスト** |
| Jest テスト総数 (unit/component) | 2017 passed / 191 スイート | **不変** |
| Jest Integration | 107 / 13 スイート | **不変** |
| ダッシュボード集計ファイル数 | 231 | **232** |
| 型エラー | 0 件 | **0 件** |

---

### コードレビュー指摘の修正（静かな失敗 3 件 + ドキュメントの履歴/現状分離） (2026-08-25)

#### 概要

コードレビューで挙がった 9 件を現行コードに突き合わせて全件有効と判定し、修正した。
本体側の 3 件はいずれも **「エラーになっていないのに機能していない」= 静かな失敗** で、
共通する構造は**フォールバック / 握り潰しが失敗を正常系に見せてしまう**ことだった。

#### 実施内容

| 対象 | 変更内容 |
|------|---------|
| `src/components/store/cards/payment/stripe/stripe-payment.tsx` | `createStripePaymentIntent` が `clientSecret: null` を返した場合を**エラーとして扱う**。従来は握り潰していたため clientSecret が null のままローダーガードに捕まり、ユーザーには無限スピナーだけが残った（throw 経路と同じ症状だがエラー状態が立たず検出不能）。併せて `catch (error: any)` を `unknown` + 型ガードへ |
| `src/app/(store)/browse/page.tsx` | `Number(maxPrice) \|\| Number.MAX_SAFE_INTEGER` を `normalizePriceParam` に置換。`?maxPrice=0`（上限 0 の空レンジ）が falsy で fallback に落ち、**「上限 0」が「上限なし」へ反転して全件が通っていた**。`getProducts` 側は既に `hasPriceBound` で 0 を正しい境界として扱えており、**クエリ層の防御が入口で無効化されていた**構図 |
| `src/queries/store.ts` | `updateStoreStatus` の非昇格経路で、オーナーのロールを tx 外スナップショットではなく**ロック取得後の tx 内**で読み直す。`status` 側は `FOR UPDATE` で TOCTOU を閉じていたが、`role` 側に同じ窓が残っていた。古い USER を掴むと Clerk 同期が飛ばされ、DB は SELLER なのに Clerk が USER のまま取り残される |
| `tests/integration/store-status.test.ts` | finally の cleanup を `DROP CONSTRAINT IF EXISTS` に変更（setup 側と統一）。制約が既に無い場合に finally が throw すると、**try 内の本来の失敗を握り潰してすり替える** |
| `tests/integration/product-browse.test.ts` | ヘッダの「`lte: Infinity` を Decimal カラムへ渡す価格境界」を現行挙動（maxPrice 未指定なら `lte` を付けない）に合わせて修正 |
| `tests/e2e/profile.spec.ts` / `tests/e2e/mobile-responsive.spec.ts` | Firefox ローカル skip 3 件に **OI-12**（解消条件・見直し期限 2026-10-31・QA_HANDOFF 参照）の追跡メタデータを付与 |
| `docs/testing/QA_HANDOFF.md` | OI-12 を「現在アクティブな残課題」へ起票 |
| `specs/multi-vendor-ecommerce/07-testing.md` | plan 054 の「レイアウト修正は未起票」を **2026-08-23 時点の履歴**と明示し、現在の追跡先が plan 065 であることを追記。plan 035 の `TODO(characterization)` 記述も履歴化し、`7a56c93d` 以降のシナリオ 3 が**回帰ガード**であることを追記 |
| `plans/065-fix-product-detail-right-panel-clipping.md` | 054 実行記録の「未起票」を実行時の履歴として分離し、現状は本プランが追跡先であると明記 |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 (unit/component) | 2021 passed / 2024 total | **2025 passed / 2028 total** |
| Jest スイート数 | 191 | **不変** |
| Jest スナップショット | 127 | **不変** |
| Playwright E2E | 63 tests/browser・28 files | **不変**（コメントのみ） |
| Jest Integration | 108 / 13 スイート | **不変**（cleanup のみ） |
| 型エラー | 0 件 | **0 件** |

> 追加した検知点 4 件: `stripe-payment.test.tsx` +1 / `store.test.ts` +1 / `browse/page.test.tsx` +2。
> なお QA_HANDOFF / COVERAGE_REPORT の記載値 2020 は実測 2021 と 1 件ドリフトしていたため、
> 本更新で実測値へ揃えた。

---

### plan 065（商品詳細レイアウト修正）→ plan 054 完了（VRT 拡大・R9 クローズ） (2026-08-31)

#### 概要

商品詳細の右購入パネル（Ship to / Buy now / **Add to cart**）が 1280px でクリップされる
レイアウト欠陥を修正し（plan 065）、そのブロックが外れたことで plan 054 の残りである
商品詳細の VRT ベースラインを撮影した。これで improve Round 9（plans 051–056）が閉じ切った。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/components/store/product-page/container.tsx` | 情報+パネル行の `w-full` を `min-w-0 flex-1` へ置換。flex コンテナ（`xl:flex`）の子における `w-full` は残余幅ではなく**親幅（1248px）**に解決されるため、画像 swiper（456px）と並ぶと確定的に溢れていた | `51c73e4c` |
| `tests/e2e/visual/product.spec.ts`（新規） | 商品詳細の VRT。chromium 限定 / fullPage / mask は既存 3 スペックと同形。ピクセル比較の前に `Add to cart` の右端が `clientWidth` 以内であることも assert | `bb780b99` |
| `tests/e2e/visual/product.spec.ts-snapshots/product-detail-chromium-darwin.png`（新規） | 目視ゲート合格後のベースライン | `bb780b99` |
| `scripts/coverage-dashboard/render-html.ts` | R9 の `NEXT_ACTIONS` エントリを削除（全 6 プラン DONE） | docs 同期コミット |
| `docs/testing/QA_HANDOFF.md` | 統計テーブル（E2E / Visual / ファイル総数）+ HEAD 更新、R9 依頼プロンプト節を削除（`render-html.ts` と二重 SSOT のため同一コミットで同期） | 同上 |

#### 実測（購入パネルの `getBoundingClientRect().right` vs `clientWidth`）

| 幅 | 修正前 | 修正後 |
|----|--------|--------|
| 768px | right=752 / 768（収まり） | 同一（挙動不変） |
| **1280px** | **right=1434 / 1280（+154px はみ出し）** | **right=1264（-16px 収まり）** |
| 1440px | right=1434 / 1440（収まり） | right=1424 |

`scrollWidth === clientWidth` は全幅で維持（クリップを横スクロールにすり替えていない）。
`page.tsx` の `overflow-x-hidden`（症状を計測から隠していた層）はプランの指示どおり削除していない。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 (unit/component) | 2026 passed / 2029 total | **不変** |
| Jest スイート数 | 191 | **不変** |
| Jest Integration | 108 / 13 スイート | **不変** |
| Playwright E2E | 63 tests/browser・28 files（計 189） | **64 tests/browser・29 files（計 192）** |
| Playwright Visual | 3 スペック / 4 テスト | **4 スペック / 5 テスト** |
| テストファイル総数（ダッシュボード集計） | 232 | **233** |
| 型エラー | 0 件 | **0 件** |

> **2026-08-31 追記（plan 066）**: `tests/integration/category-tree-migration.test.ts` の新設で
> ダッシュボード集計は **233 → 234** になった。詳細は本ファイル末尾の plan 066 エントリを参照。

---

### plan 066: カテゴリツリー Phase A（スキーマ + 互換レイヤー） (2026-08-31)

#### 概要

固定 2 階層（`Category` + 子を持てない `SubCategory`）を N 階層ツリーへ移行する 3 分割実装の 1 本目。
**構造だけを加算し、読み取り経路は 1 行も切り替えていない** —— storefront の挙動は不変で、
ロールバックは新列・新テーブルの drop で足りる。この可逆性が 066/067/068 に分けた唯一の理由。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `prisma/schema.prisma` | `Category` に `parentId`/`path`/`depth`/`sortOrder`/`childCount`、`CategorySlugAlias` + `CategoryAliasSource` enum を新設、`Product.categoryNodeId`（nullable） | `0f0fa400` |
| `prisma/migrations/20260831102943_category_tree_phase_a/` | DDL 3 段（`path` を nullable 追加 → backfill → SET NOT NULL）+ 冪等なデータ移行 DML（`PHASE_A_DATA_MOVE` マーカー） | `0f0fa400` |
| `scripts/erd/generate-erd.ts` / `docs/architecture/data-model.drawio` | `CategorySlugAlias` を Catalog ページへ追加し再生成（orphan WARNING 0 件） | `0f0fa400` |
| `src/queries/category.ts` | `upsertCategory` の引数型を新列 5 つ分だけ narrow し、`create` で `path = url` / `depth = 0` を補う | `0f0fa400` |
| シード 3 系統 | `SeedSubCategory` を廃し `parentUrl?` を持つ単一の木（32 ノード）へ。商品はリーフ 1 本 | `7fada5be` |
| `tests/integration/category-tree-migration.test.ts` | 移行 DML の冪等性・衝突リネーム・`childCount` 整合（9 シナリオ） | `9fc80ce3` |

#### 実測（事前計測と移行結果）

事前計測は**実 DB（Neon）で実行**した。シードで代替していない。

| 指標 | 値 |
|------|----|
| slug 衝突（`Category` ∩ `SubCategory`） | **0 件**（STOP 条件の 20 件を大きく下回る） |
| 移行前の規模 | Category 40 / SubCategory 58 / Product 105 |
| 移行後 | ルート 40 / 子 58 / alias 98 / リネーム 0 |
| `childCount` ドリフト | **0** |
| `Product.categoryNodeId` の未 backfill | **0** |

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest ユニット | 2026 passed / 2029 total | **2025 passed / 2028 total** |
| Jest スイート | 191 | **191**（不変） |
| Jest Integration | 108 / 13 スイート | **117 / 14 スイート** |
| Playwright E2E | 64 tests/browser（計 192） | **64 tests/browser（計 192）**（不変） |
| 型エラー | 0 件 | **0 件** |

#### 既知の課題（066 の範囲外）

- `bun run seed:luxury` は **Neon に対しては Phase 4（Review）で `P2028` により失敗する**。
  `review-seeder.ts` の `$transaction` が Prisma 既定（maxWait 2s / timeout 5s）のままで、
  リモート DB のレイテンシで期限を超える。**ローカル PostgreSQL では 5 フェーズ完走**するため
  plan 066 の変更とは無関係。注文処理で `ORDER_TRANSACTION_OPTIONS` を明示したのと同型の対応が要る。

---

### ERD パーサの切り出しと未コミット作業の片付け (2026-09-02)

#### 概要

前セッションから作業ツリーに残っていた 3 件の変更を、rule 02 に従い論理単位で分割コミットした。
plan 067（カテゴリツリー Phase B）に着手する前に作業ツリーを clean にすることが目的。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `scripts/erd/parse-models.ts` / `.test.ts` / `generate-erd.ts` | Prisma スキーマのパーサを純関数として切り出し、記法の回帰をユニットテストで固定（+4 / スイート +1）。`stripBlockAttributes` で複数行ブロック属性の継続行が偽フィールドになる問題を修正 | `2877abf7` |
| `docs/architecture/decisions/007-attribute-storage.md` / `docs/design/category-attributes/design.md` / `plans/066` / `plans/069` / `plans/README.md` | 多値属性の一意インデックスが NULL を重複許容する穴を 5 項目チェックリストとして明文化。ADR-007 に逆リレーションを追記 | `12554bd8` |
| `tests/integration/setup/seed.ts` | `seedProductWithVariantAndSize` が新旧両系統（`Category.parentId` / `SubCategory.categoryId`）で親子を検証。存在確認だけでは別カテゴリの id を渡しても Product 作成が通っていた | `31ab8c20` |

#### 実測

- `bun run erd:generate` → `docs/architecture/data-model.drawio` に**差分ゼロ**（パーサ切り出しが挙動を変えていないことの機械的確認）
- `bun run test:integration` → **117 passed / 14 スイート**（不変）
- `bunx tsc --noEmit` → 0 件

> **注記**: plan 067 本文が挙げる統合テストのコマンド `bun run test -- tests/integration/...` は**動作しない**。
> `jest.config.js` の `testPathIgnorePatterns` が `/tests/integration/` を除外しているため、
> 正しくは `bun run test:integration`（`jest.integration.config.js` 経由）である。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 (unit/component) | 2028 passed / 2031 total | **2032 passed / 2035 total** |
| スイート数 | 191（190 passed + 1 skipped） | **192（191 passed + 1 skipped）** |
| Integration | 117 / 14 スイート | **不変** |
| 型エラー | 0 件 | **0 件** |

---

### カテゴリツリー Phase B — 読み取りのサブツリー化 (2026-09-02 / plan 067・**IN PROGRESS**)

#### 概要

066 が置いた木の構造を、storefront の読み取りが実際に使うようにした。
条件を「その 1 ノードと完全一致」から「そのノードを根とするサブツリー」へ変え、
3 階層目以降の商品が祖先カテゴリのフィルタでヒットするようにしている。
Phase C（plan 068）は不可逆なので、**戻れる最後の地点がここ**である。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/lib/category-tree.ts` | `subtreeOf` / `isWithinSubtree`（prefix 境界の一元化）、`resolveCategoryNode`（別名フォールバック）、`buildCategoryTree` | `8bebdc6e` `4cd23f1d` `9b4ea311` |
| `src/lib/schemas.ts` | Category / SubCategory の slug を `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` へ制約 | `10707b6d` |
| `src/queries/product.ts` | browse フィルタを `categoryNode` のサブツリーへ + dual-write | `168c4ea7` `8cca6a84` |
| `src/queries/category.ts` | `getAllCategories` をツリー返却へ（店舗スコープは祖先を prefix 展開する 2 クエリ） | `a1dbe5dc` |
| `src/components/store/browse-page/filters/category/` | 2 段固定 → 再帰コンポーネント | `a1dbe5dc` |
| `src/app/(store)/browse/page.tsx` | 旧 `?subCategory=` を `permanentRedirect`（308）で正準化 | `c478ec54` |
| `prisma/migrations/*_category_tree_phase_b_resync` | `PHASE_B_RESYNC` 区間（rename / 親付け替え / featured を既存行にも追随） | `5c4b2501` |
| `tests/integration/setup/migration-sql.ts` | マーカー抽出・SQL 分割器を Phase A / B で共有 | `5c4b2501` |

#### 設計文書からの逸脱・発見

1. **design.md §2-Q3 の `{ category: subtreeOf(...) }` は誤り。** `category` は旧 FK で
   **ルート**を指すため、サブツリー条件を掛けてもリーフに紐づく商品へ届かない。
   066 が追加した `categoryNode` を引く形に直した。設計文書は Phase A 実装前に
   書かれており、リレーション名が確定していなかったことによる差分である。
2. **`redirect()` は 307。** 308 が要件なので `permanentRedirect()` を使う。
3. **`?category=A&subCategory=B` を無条件に畳めない。** 2 つのサブツリーの積として
   効いているため、A と B が親子でない場合に畳むと「0 件」が「B の結果」へ化ける。
   B が A の子孫（または同一）のときだけ畳む。
4. **plan 067 本文の統合テストコマンドが動作しない。** `jest.config.js` が
   `/tests/integration/` を除外しているため、正しくは `bun run test:integration`。
5. **Done criteria の `grep startsWith` は検索対象に `src/app` を含んでいない。**
   実際の重複は `browse/page.tsx` に出た（`isWithinSubtree` へ寄せて解消）。

#### 実測

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 (unit/component) | 2032 passed / 2035 total | **2062 passed / 2065 total** |
| スイート数 | 192 | **193** |
| Integration | 117 / 14 スイート | **123 / 15 スイート** |
| 型エラー | 0 件 | **0 件** |
| ESLint | 0 errors | **0 errors** |

実 DB 実測（`DIRECT_URL` 経由の `$queryRaw`）: slug 制約違反 **0 件** /
Category 98 / SubCategory 58 / Product 105 / `categoryNodeId IS NULL` **0 件**。

#### 残作業・BLOCKED

残作業は **2026-09-02 に完了**（下記「カテゴリツリー Phase B の残作業完了」を参照）。
BLOCKED（実 DB への `prisma migrate deploy` が権限で拒否され再同期は未適用）のみが残り、
[`docs/testing/QA_HANDOFF.md`](testing/QA_HANDOFF.md) の「067-B の残 BLOCKED」節に記録した。

---

### カテゴリツリー Phase B の残作業完了 (2026-09-02)

#### 概要

plan 067（カテゴリツリー Phase B）の残作業 —— storefront の残リンク・統合テスト 4 本・
E2E 1 本 —— を実装し、plan 067 を **DONE** にした。

#### 実施内容

| 対象 | 変更内容 | コミット |
|------|---------|---------|
| `src/components/store/layout/footer/{footer,links}.tsx` | リンク元を旧 `SubCategory` テーブルから `Category` ツリーへ移し、`?category=<正準slug>` を生成（308 の 1 ホップを解消） | `d7769375` |
| `src/lib/category-tree.ts` | `flattenCategoryTree`（pre-order・並び替えなし）を追加。unit +2 | `d7769375` |
| `tests/integration/product-browse.test.ts` | V-1（兄弟 prefix の非ヒット）/ depth 2 の商品がルート祖先で取れる / 旧 `?subCategory=` の同一サブツリー解決 / V-6（fail-closed）の +4 | `171ac4fa` |
| `tests/integration/product-update.test.ts` | create・update 両経路の dual-write（3 列が揃う）+2 | `c094f7d4` |
| `tests/e2e/search-filter.spec.ts` + `tests/e2e/seed/` | V-2: 旧 `?subCategory=` が **308** で正準ノードへ着地（`CategorySlugAlias` 経由の旧 slug を含む）。シードに別名行を 1 件追加 | `0ed9502a` |

#### 踏まなかった罠

1. **`links.tsx` の `?subCategory=` を機械的に `?category=` へ置換してはならない。**
   旧 `SubCategory.url` は移行でリネームされ得るうえ、グローバル一意制約下で**別ノードの
   正準 slug**になっている可能性がある。`resolveCategoryNode(CATEGORY)` は url 完全一致を
   先に引くので、無関係なノードへ着地する。**データ源ごとツリーへ移す**のが正しい。
   `home/category-card.tsx` は home.ts の legacy 経路（067 スコープ外）なので据え置き。
2. **E2E の 308 検証に `page.goto` を使わない。** 最終 URL しか見えず 302 と区別できない。
   `request.get(..., { maxRedirects: 0 })` でステータスと `Location` を直接見る。
3. **別名テストで `Category.url` を書き換えない。** 旧 slug が url に残っていると
   完全一致で解決してしまい、別名表を引く経路が 1 度も実行されない。別名行だけを足す。
4. **ローカル E2E は `PORT=3100 E2E_NO_REUSE=1` で隔離する。** :3000 に別リポジトリの
   next-server が居ると `reuseExistingServer` がそれを掴み、全 spec が赤になる
   （`playwright.config.ts` に警告として明記されている既知の罠）。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 (unit/component) | 2062 passed / 2065 total | **2064 passed / 2067 total** |
| スイート数 | 193 | **193**（不変） |
| Integration | 123 / 15 スイート | **129 / 15 スイート** |
| Playwright E2E | 64 tests/browser（計 192） | **65 tests/browser（計 195）** |
| 型エラー | 0 件 | **0 件** |
| ESLint | 0 errors | **0 errors** |

V-1 と dual-write は、本体を壊すと赤になることを実測で確認した（`subtreeOf` から境界文字
`/` を落とす / `categoryNode` の connect を落とす）。

---

### レビュー指摘対応（カテゴリツリー周辺のコード + 設計ドキュメント） (2026-09-02)

#### 概要

コードレビューの指摘を 1 件ずつ現行コードに突き合わせ、**まだ有効なものだけ**を修正した。
コードは 5 件（fail-closed / a11y / 例外の握り潰し防止 / シードの不変条件 / 走査器の誤検出）、
設計ドキュメントは 5 件。2 件は現行コードで既に解消済みだったため見送った（下記「見送り」）。

#### 実施内容（コード）

| 対象 | 変更内容 | 種別 |
|------|---------|------|
| `src/queries/product.ts` | `?category=a&category=b` で Next.js が渡す **配列**が `resolveCategoryNode` → Prisma の `where: { url }` へ素通りして実行時に落ちていた。`typeof !== "string"` を fail-closed（0 件）へ寄せ、`/browse` 側の `typeof === "string"` ガードと境界を揃えた | 正しさ |
| `src/components/store/browse-page/filters/category/category-link.tsx` | カテゴリ選択が**宛先の無い `<label htmlFor>`**、開閉が `<span onClick>` で、どちらもキーボード到達不能かつ状態非公開だった。`<button type="button">` 2 本へ分離し `aria-pressed` / `aria-expanded` を公開。`border-[#ccc]` / `bg-black` をトークン（`border-border` / `bg-foreground`）へ置換 | a11y |
| `src/lib/category-tree.ts` | `resolveCategoryNode` の Prisma 呼び出しを try/catch でラップ。**`null` に畳まず元の例外を再送出**する —— `null` は「解決不能な slug」= 0 件を意味するので、DB 障害を畳むと障害が「空カタログ 200」として出てしまう | 規約 + 可観測性 |
| `prisma/seed/seeders/product-seeder.ts` | 商品の `categoryUrl` にルートを指定すると `maps.categories.get(rootUrl)` が**成功してしまい**既存の未検出エラーに掛からない。リーフ必須を明示的に throw | 不変条件 |
| `scripts/coverage-dashboard/scan-tests.ts` | `BLOCK_PATTERN` / `EACH_PATTERN` の否定後読みが `(?<![.\w$])` で、プライベートメンバ `this.#test(...)` を宣言として計上していた（`test` の直前は `#` で、`.` は `#` の手前にあり後読みに掛からない）。`(?<![.#\w$])` へ広げ、`scan-tests.test.ts` に回帰ガード **+1**（Red→Green 実測: 修正前 1 件一致 / 修正後 0 件） | 計測の正確さ |

#### 実施内容（ドキュメント）

| 対象 | 変更内容 |
|------|---------|
| `docs/design/category-tree/design.md` | Phase B の擬似コードが `whereClause.AND.push({ category: … })` のままだった（設計執筆は Phase A 実装前）。実装どおり `categoryNode` へ直し、Phase C の rename で `category` に戻ることを併記 |
| `docs/design/category-attributes/design.md` | (1) `NUMBER` は `z.coerce.number()` の前に空入力を `undefined` へ正規化する（`Number("") === 0` で「未入力」が `0` として保存され、ファセットに偽の `0` が出る）。`required: false` のときだけ `.optional()`。(2) 型変更 経路 2 は同じ `key` で新旧定義が並ぶため `@@unique([categoryId, key])` と衝突する。`key` は不変（Q7）なので**制約側**をアーカイブ対象外にする部分ユニークインデックスへ変更し、読み書き規則を明記。(3) 「定義の削除」行の「ファセットから履歴が消えない」を、継承クエリの `archivedAt: null` と検証シナリオ A-6 に合わせて「値は残るがファセットには出ない」へ訂正 |
| `plans/068-implement-category-tree-admin-cutover.md` | 再親子化が対象ノードの `path` しか更新しない設計だった。**全子孫の `path` / `depth` を同一 `$transaction` で追随**させ、**最深子孫**で深さ上限を判定し、**旧親と新親の両方**の `childCount` を再計算することを追記。子孫の取り残しは検索結果でしか表面化しないため、回帰テスト V-7c は DB の値だけでなく `?category=` の検索結果も検算する |
| `specs/multi-vendor-ecommerce/03-data-model.md` | Product のカテゴリ関係が「category と subcategory に属する」1 行だけだった。Phase A/B の 3 本の FK（root / leaf / 新 leaf の dual-write）と、Phase C（`SubCategory` 削除・`categoryNodeId` → `categoryId` rename で単一ノード参照）を段階ごとに明記 |

#### 見送り（現行コードで無効）

1. **`scripts/erd/parse-models.ts` の `isForeignKey` が常に false**: パーサは初期値を
   `false` で置くが、`generate-erd.ts:969` の `markForeignKeys(models)` が生成パイプライン内で
   確定させている（`generate-erd.ts:219`）。指摘中の `optionId` は `schema.prisma` に存在しない。
2. **`render-html.ts` の 067-B コメントが未来日 2026-09-02**: 2026-09-02 は**発行日そのもの**で
   未来日ではない。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 (unit/component) | 2064 passed / 2067 total | **2065 passed / 2068 total** |
| スイート数 | 193 | **193**（不変） |
| Jest スナップショット | 127 | **127**（不変） |
| 型エラー | 0 件 | **0 件** |
| ESLint | 0 errors | **0 errors**（15 warnings はすべて既存・変更ファイル外） |

---

### plan 068 の E2E 検証とドキュメント同期 (2026-09-03)

#### 概要

前セッションは plan 068（カテゴリツリーの admin 統合・リーフ強制）を Step 1–9 まで実装したが、
E2E を**一度も実行しないままコミット**していた（`524ba258` が自らそう宣言していた）。CI は
Playwright を回さないので、この spec は赤くならないまま「3 階層目を admin から作れる」という
068 の中心的主張だけを無検証で保持していた。今セッションでそれを実行して緑にし、統計の伝播と
ダッシュボード再生成を行った。**Phase C（不可逆）は未着手のまま**。

#### E2E で見つかった欠陥（すべて spec 側。実装側の欠陥は無し）

| # | 欠陥 | なぜ紛らわしかったか |
|---|------|---------------------|
| 1 | フィクスチャが `CategoryFormSchema` 違反。`name` は `^[a-zA-Z0-9\s]+$` でハイフンを弾くのに、slug 用の `Date.now()-乱数` を name にも流していた | `url` 側の規則は逆にハイフン区切りを**要求する**ため、同じ ID で片方だけ落ちる |
| 2 | クライアントマウント前に `fill` していたため、react-hook-form の空 `defaultValues` が値を巻き戻した | 巻き戻るのは**制御 input だけ**。非制御の画像隠し入力と Radix Select の値は残るので「一部のフィールドだけ消える」形に見える |
| 3 | Radix Select が開く際にポータルを作り直すため、option クリックが間欠的に `not stable` → `detached` | 1 回目の run では通っていた（間欠） |

3 件とも**症状は `waitForURL` のタイムアウト**という同じ形で出た。原因から遠い位置で落ちるのを
やめるため、送信直前に入力値を検算する assert を追加した。また `:3000` は別リポジトリのアプリが
掴んでいることがあり（`reuseExistingServer` はポート応答しか見ない）、`PORT=3100 E2E_NO_REUSE=1`
での隔離実行が必須であることを再確認した。

#### 067-B「BLOCKED」の訂正

引き継ぎは「`20260901223148_category_tree_phase_b_resync` が権限拒否で実 DB 未適用」と記録して
いたが、`_prisma_migrations` を直接引くと `finished_at` = 2026-09-02T03:03:00Z /
`rolled_back_at` = NULL で**適用済み**だった。`Product.categoryNodeId IS NULL` も 0 件 / 105 行。
**Phase C に残るゲートはオペレーター承認のみ**である。

#### テスト統計（更新）

| 指標 | 更新前 | 更新後 |
|------|--------|--------|
| Jest テスト総数 (unit/component) | 2072 passed / 2075 total | **2121 passed / 2124 total**（2026-09-03 実測） |
| スイート数 | 194 | **194**（不変） |
| Jest Integration | 131 / 15 スイート | **135 / 16 スイート** |
| Playwright E2E | 65 tests/browser / 29 files | **66 tests/browser / 30 files**（chromium のみ緑を実測） |
| lcov カバレッジ | Statements 70.51% (2026-08-23) | **72.45% (6395/8826)** / Branches 52.06% / Functions 60.73% / Lines 71.81%（2026-09-03） |
| 型エラー | 0 件 | **0 件** |
