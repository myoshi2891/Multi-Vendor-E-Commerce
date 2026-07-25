# PROGRESS.md

> **運用ルール**: 進捗・一時的な決定を記録する。gitで追えるもの（コミット一覧・変更行数）は書かない。
> 書くべき情報: なぜその決定をしたか／今どこにいるか／次に何をするか。

---

## 現在の状態（2026-07-24 時点）

### テスト統計
| 指標 | 値 |
|------|----|
| Jestユニットテスト | **1746 passed / 1749 total / 175 スイート（174 passed + 1 skipped suite）** — 2026-07-24 実測（CodeRabbit セキュリティ修正の回帰 +2 時点）。増減の経緯は [`COVERAGE_REPORT.md §7 履歴`](./testing/COVERAGE_REPORT.md#7-履歴)、統計の SSOT は [`QA_HANDOFF.md`](./testing/QA_HANDOFF.md) |
| Jest Integration テスト | 17テスト / 2スイート（`cart-checkout` 11 + `order-placement` 6）— 2026-05-31 placeOrder 統合テスト +6 / +1 スイート。`bun run test:integration`（testcontainers）で実行、`bun run test` 集計外。2026-07-17: ダッシュボード集計の 14 との乖離を解消（`scan-tests.ts` の `it.each` 展開対応で 14→17） |
| Jestスナップショット | 127（`tests/component/ui/` — B1 MVP 40 + B1+ Sprint 1 +26 + B1+ Sprint 2 +27 + B1+ Sprint 3 +19 + B1+ Sprint 4 +15） |
| 型エラー | 0件 |
| Playwright E2E | Chromium / Firefox / WebKit（3ブラウザ） |

### 技術スタック（現行）
| パッケージ | バージョン |
|-----------|-----------|
| Next.js | ~16.2.10（App Router） |
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
