# PROGRESS.md

> **運用ルール**: 進捗・一時的な決定を記録する。gitで追えるもの（コミット一覧・変更行数）は書かない。
> 書くべき情報: なぜその決定をしたか／今どこにいるか／次に何をするか。

---

## 現在の状態（2026-05-24 時点）

### テスト統計
| 指標 | 値 |
|------|----|
| Jestユニットテスト | 1008テスト / 70スイート（3 skipped、全パス） |
| Jestスナップショット | 40（`tests/component/ui/` — B1 で導入） |
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
- **今後の残タスク**:
  - 各種クロステナント IDOR テスト（8件）の追加。
  - `SECURITY_GAP_REPORT.md` / `QA_HANDOFF.md` / テストダッシュボード（`docs/coverage-dashboard.html`）等のドキュメント更新。

---

## 既知の課題

| 課題 | 詳細 | 優先度 |
|------|------|--------|
| Elasticsearch 未実装 | `src/lib/elastic-search.ts` がコメントアウト中。全文検索は現在 tsvector で代替 | 低 |
| E2E シード不安定 | 解消済み: CI環境で PostgreSQL コンテナを使用し、`seed-idempotency` ジョブで冪等性を検証完了 (OI-5) | - |
| E2E テスト網羅不足 | `TEST_IMPLEMENTATION_PLAN.md` の P1/P2 スイートが未実装 | 中 |

---

## 次アクション

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
