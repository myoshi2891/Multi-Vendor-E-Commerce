# PROGRESS.md

> **運用ルール**: 進捗・一時的な決定を記録する。gitで追えるもの（コミット一覧・変更行数）は書かない。
> 書くべき情報: なぜその決定をしたか／今どこにいるか／次に何をするか。

---

## 現在の状態（2026-05-31 時点）

### テスト統計
| 指標 | 値 |
|------|----|
| Jestユニットテスト | 1272 passed / 1284 total / 137スイート（**12 skipped**）— 2026-06-13 PR #134 注文テーブル重複解消リファクタで +21 / +3 スイート（order-table-cells / admin orders columns / seller orders columns + order-status-select 拡張）。うち 9 skip は modal-provider の CI flake 一時退避（OI-8） |
| Jest Integration テスト | 17テスト / 2スイート（`cart-checkout` 11 + `order-placement` 6）— 2026-05-31 placeOrder 統合テスト +6 / +1 スイート。`bun run test:integration`（testcontainers）で実行、`bun run test` 集計外 |
| Jestスナップショット | 127（`tests/component/ui/` — B1 MVP 40 + B1+ Sprint 1 +26 + B1+ Sprint 2 +27 + B1+ Sprint 3 +19 + B1+ Sprint 4 +15） |
| 型エラー | 0件 |
| Playwright E2E | Chromium / Firefox / WebKit（3ブラウザ） |

### 技術スタック（現行）
| パッケージ | バージョン |
|-----------|-----------|
| Next.js | 16.2.1（App Router） |
| React | 19 |
| @clerk/nextjs | v7 |
| ESLint | 9（flat config） |
| Swiper | 12.x |

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

---

## 既知の課題

| 課題 | 詳細 | 優先度 |
|------|------|--------|
| **modal-provider テスト CI flake (OI-8)** | `src/providers/modal-provider.test.tsx:95` の `[P1] モーダルを開くと...` を CI flake のため `it.skip`。設計改善 (ADR-003) では根治できず、6 仮説が未検証。詳細: [ADR-003 後続調査](architecture/decisions/003-modal-setopen-sync-for-react19.md#後続調査と一時スキップ判断) / [QA_HANDOFF.md OI-8](testing/QA_HANDOFF.md)。期限 2026-06-07 | 中 |
| Elasticsearch 未実装 | `src/lib/elastic-search.ts` がコメントアウト中。全文検索は現在 tsvector で代替 | 低 |
| E2E シード不安定 | 解消済み: CI環境で PostgreSQL コンテナを使用し、`seed-idempotency` ジョブで冪等性を検証完了 (OI-5) | - |
| E2E テスト網羅不足 | `TEST_IMPLEMENTATION_PLAN.md` の P1/P2 スイートが未実装 | 中 |

---

## 次アクション

### 0. 【最優先】管理者ダッシュボード Phase 2（F1 ダッシュボード統計）

**背景**: Phase 1（F2 注文管理）は 2026-06-13 に完了。次は Phase 2（統計ダッシュボード）に着手する。Phase 単位の現在地は [docs/design/admin-dashboard/PROGRESS.md](design/admin-dashboard/PROGRESS.md) を参照（SSOT）。

**次セッション 依頼プロンプト（コピペ可）**:

```
docs/design/admin-dashboard/PROGRESS.md と tasks.md を参照し、Phase 2（F1 ダッシュボード統計）の
2-A を進めて。具体的には src/queries/dashboard.ts を新規作成し、getAdminDashboardStats
（requireAdmin はキャッシュ外・Promise.all 並列集計・unstable_cache 20分）/ getSalesOverTime /
getRecentOrders / getRecentStores を実装。Red→Green でテストを先行（非 ADMIN 拒否の認可 3 階層・
paymentStatus=Paid のみ集計・PartiallyRefunded 全額除外・isDeleted:false の店舗カウント・
キャッシュヒット）。完了後 2-B（KPI カード + @tremor/react チャート + 最近の注文/ストア）へ。
完了の定義は test-complete（lint/tsc/test）+ bun run build。進捗は admin-dashboard/PROGRESS.md と
docs/PROGRESS.md の両方を更新し、次の依頼プロンプトも更新すること。
```

**注意**: query パターンは Phase 1 の `getAllOrders`（`src/queries/order.ts`）を再利用。`enum StoreStatus` は `ACTIVE`/`PENDING` を使用（`INACTIVE` は存在しない）。

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

## 参照ドキュメント

| ドキュメント | 目的 |
|-------------|------|
| `docs/testing/TEST_IMPLEMENTATION_PLAN.md` | テスト実装計画（P0/P1/P2 優先度付き） |
| `docs/testing/TESTING_DESIGN.md` | テスト設計方針・ヘルパー関数パターン |
| `docs/migration/06-framework-upgrade.md` | Next.js 16 マイグレーションの詳細記録 |
| `specs/multi-vendor-ecommerce/` | SDD 仕様書群（Single Source of Truth） |
| `.claude/steering/tech.md` | 実装パターン・コーディング規約 |
