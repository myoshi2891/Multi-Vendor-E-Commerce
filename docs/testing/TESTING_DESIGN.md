# Testing Design: Directory Layout and Tool Selection

## ドキュメントガイド

- **目的**: リポジトリのテスト戦略とディレクトリ構成を定義する
- **関連**: `QA_TEST_PERSPECTIVES.md`（同ディレクトリ）、`../../README.md`、`../migration/03-test-strategy-updates.md`
- **CI 推奨**: `bun run lint` → `bun run test` → `bun run build` → スモークテスト: `bunx playwright test --project=chromium --workers=1` → フルリグレッション: `bunx playwright test --project=all --workers=1` またはプロジェクト指定なし（`E2E_DATABASE_URL` を設定）。integration スイートには `.env.test` を使用する

---

## Goals

- Next.js 14 マルチベンダーコマースアプリ向けの階層型テストピラミッドを構築する
- 高リスクフロー（認証 / RBAC / 価格 / 在庫 / チェックアウト / 決済 / 注文ステータス）を優先する
- unit / integration / E2E を明確に分離し、テストを高速かつ決定論的に保つ

---

## Current State（観測済み）

- Jest + ts-jest 設定済み。`test` スクリプトが Jest を指している
- 既存のユニットテストは `src/queries/*.test.ts` に配置されている
- React Testing Library と jest-dom がインストール済み

---

## 設計判断: Jest Config

| 判断 | 内容 |
|-----|------|
| **単一 jest.config.js を維持** | 初期セットアップ中のコンフィグ分散を避けるため |
| **デフォルト環境** | `testEnvironment: "node"`（ユニット・サーバーテストの高速化） |
| **jsdom 環境** | DOM API が必要なコンポーネントテストファイルに `@jest-environment jsdom` を個別指定 |
| **スコープ制御** | 複数の Jest 設定ではなく `--testPathPattern` でスクリプトを分ける |
| **再検討のタイミング** | DB リセット・jsdom 専用セットアップ・低速化が生じた場合のみ分割を検討 |

---

## ツール選定

| テスト種別 | ランナー | 目的 | 備考 |
|-----------|---------|------|------|
| **Unit** | Jest | 純粋関数・ヘルパー・スキーマ・クエリ合成 | node 環境で高速実行。DB・ネットワーク不使用 |
| **Component** | Jest + React Testing Library | UI インタラクション | jsdom 環境。`@testing-library/user-event` を追加 |
| **Integration** | Jest + Docker Compose（PostgreSQL） | DB・サーバーロジック | `.env.test` で独立した DB を使用。スイート前にリセット |
| **API Route** | Jest | Next.js route handler の GET / POST | `NextRequest` を直接呼び出す小さなヘルパーを利用 |
| **E2E** | Playwright | 顧客 / 販売者 / 管理者の全フロー | マルチブラウザ・トレース・並列対応 |
| **Visual Regression** | Playwright（スクリーンショット） | 商品カード・チェックアウト・注文詳細・販売者ダッシュボード | ベースライン + diff |
| **Accessibility** | jest-axe（unit）+ axe-core（Playwright） | コンポーネントおよび E2E でのアクセシビリティ検証 | — |
| **Contract / Webhook** | Postman/Newman または Pact（任意） | Stripe / PayPal Webhook・重要な POST ルート | — |
| **Performance / Load** | k6 または Artillery | 閲覧・検索・チェックアウト・決済開始 | — |
| **Security** | OWASP ZAP baseline scan | 認証・チェックアウト・注文 API・管理ルート | CI またはステージングで実行 |

---

## ディレクトリ構成

```
.
├─ src/
│  └─ ...                       ユニットテストを co-locate: *.test.ts
├─ tests/
│  ├─ unit/                     co-locate しない場合の任意配置
│  ├─ component/                RTL コンポーネントテスト（jsdom）
│  ├─ integration/              DB・サーバーサイド integration テスト
│  ├─ api/                      API route handler テスト
│  ├─ e2e/                      Playwright テスト
│  ├─ visual/                   Playwright スクリーンショットテスト
│  ├─ accessibility/            axe チェック
│  ├─ performance/              k6 または Artillery スクリプト
│  ├─ contracts/                Webhook・外部コントラクトテスト
│  ├─ fixtures/                 静的 JSON・ファイル
│  ├─ factories/                テストデータファクトリ
│  ├─ mocks/                    MSW ハンドラー・スタブサーバー
│  └─ helpers/                  共有テストユーティリティ
├─ tests-setup/
│  ├─ jest.setup.ts             jest-dom・MSW セットアップ
│  ├─ jest.env.ts               グローバル env ブートストラップ
│  └─ db.reset.ts               リセット・マイグレーション・シード
├─ playwright.config.ts
└─ jest.config.js
```

---

## 命名規則

| テスト種別 | パターン |
|-----------|---------|
| Unit | `src/**/*.test.ts` または `tests/unit/**/*.test.ts` |
| Component | `tests/component/**.test.tsx` |
| Integration | `tests/integration/**.test.ts` |
| E2E | `tests/e2e/**.spec.ts` |
| Visual | `tests/visual/**.spec.ts` |

---

## 環境・データ戦略

| 項目 | 内容 |
|-----|------|
| **環境変数** | テスト DB とシークレットには `.env.test` を使用する |
| **DB** | テスト専用の PostgreSQL データベースを使用する |
| **Integration リセット** | スイート前に migrate + seed を実行する |
| **E2E リセット** | 実行前にシード投入、実行後にクリーンアップする |
| **テストデータ** | ハードコードした ID ではなくファクトリを使用する |

---

## E2E シード戦略（確定）

- **シードスクリプト**: `tests/e2e/seed/seed-e2e.ts`
- **シードデータ定数**: `tests/e2e/seed/constants.ts`

```bash
E2E_DATABASE_URL="postgresql://user:pass@localhost:5432/app_test" \
  bun run seed:e2e
```

### シードの動作

- store / category / product / variant を upsert する
- sizes / images / colors をリセットし、E2E 商品が必ず1つのサイズを持つ状態にする（UI で自動選択）

### 並列分離

シード識別子はプロジェクト + ワーカーごとに名前空間を分ける（例: `e2e-store-chromium-w0`）

### シードターゲット制御

| 変数 | 内容 |
|-----|------|
| デフォルト | 設定に基づき全 Playwright プロジェクト・ワーカーをシードする |
| `E2E_SEED_PROJECTS="chromium,firefox"` | 対象プロジェクトを上書き |
| `E2E_SEED_WORKERS=2` | ワーカー数を上書き |
| `TEST_PROJECT_NAME=chromium TEST_WORKER_INDEX=0` | 単一ターゲットをシード |

> ワーカー / プロジェクトごとにシードできない場合は `--project=chromium --workers=1` で単一実行する

テストは `testInfo.project.name` と `testInfo.workerIndex` でワーカーごとのデータを取得する。必要に応じて `E2E_*` 環境変数で上書き可能。

---

## ❌ シークレット管理ルール（必須）

| ルール | 内容 |
|--------|------|
| **ログ出力禁止** | シークレット値（env 変数・`.env` の内容）をチャットやログに出力しない |
| **コミット禁止** | `.env` やシークレットを含むファイルをステージング・コミットしない |
| **gitignore** | `.env` と `.env.*` を ignore する（`.env.example` のみ許可） |
| **コミット前確認** | `git status` でシークレットファイルがステージされていないことを確認する |
| **異常時対応** | シークレットファイルが表示または要求された場合は処理を中断し、明示的な指示を求める |

---

## テストスクリプト（参考 — 未実装を含む）

```bash
bun run test                    # jest（全ユニット）← 実装済み
bun run test:unit               # 未実装（予定: jest --testPathPattern "src/.*\.test\.ts$"）
bun run test:component          # 未実装（予定: jest --testPathPattern "tests/component/.*\.test\.tsx$"）
bun run test:integration        # 未実装（予定: jest --testPathPattern "tests/integration/.*\.test\.ts$"）
bun run test:e2e                # 未実装（現状: bunx playwright test を直接使用）
bun run test:visual             # 未実装（予定: playwright test tests/visual）
bun run test:a11y               # 未実装（予定: playwright test tests/accessibility）
bun run test:perf               # 未実装（予定: k6 run tests/performance/browse.js）
```

---

## CI 実行順序（高速 → 低速）

| ステップ | 内容 |
|---------|------|
| 1 | Lint + 型チェック |
| 2 | Unit + Component |
| 3 | Integration（DB） |
| 4 | E2E スモーク |
| 5 | Visual / パフォーマンス / セキュリティスキャン（ナイトリー） |

---

## このコードベースへの注意事項

- 既存の `src/queries/*.test.ts` はユニットテストとして維持する
- コンポーネントテストファイルには `@jest-environment jsdom` を個別指定する（単一 config を維持）
- 購入全体・販売者更新・管理者フローには Playwright を使用する
- ユニット / integration テストでは外部プロバイダー（Clerk / Stripe / PayPal）をモックする
- 実際の Webhook は分離されたステージングまたはコントラクトテストでのみ実行する

---

## Playwright: 具体的な設定

### `playwright.config.ts`

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30 * 1000,
  expect: { timeout: 5 * 1000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "bun run dev",   // CI では next build + next start を推奨
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox",  use: { ...devices["Desktop Firefox"] } },
    { name: "webkit",   use: { ...devices["Desktop Safari"] } },
  ],
});
```

### 最初の E2E シナリオ: カートスモーク（ゲストユーザー）

**目的**: 認証なしでカート追加・数量更新・永続化を検証する

**前提条件**:
- 安定したスラッグと在庫ありバリアントを持つ商品が1件シードされていること
- 以下に `data-testid` を付与すること: 商品カード / カートに追加ボタン / カート行 / 合計金額

```ts
// tests/e2e/cart-smoke.spec.ts
import { test, expect } from "@playwright/test";

test("guest can add item to cart and see totals", async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());

  await page.goto("/");
  await page.getByTestId("product-card-test-product").click();

  await page.getByTestId("variant-select").click();
  await page.getByTestId("variant-option-default").click();

  await page.getByTestId("add-to-cart").click();

  await page.goto("/cart");
  await expect(page.getByTestId("cart-item-name")).toHaveText("Test Product");
  await expect(page.getByTestId("cart-item-qty")).toHaveValue("1");
  await expect(page.getByTestId("cart-total")).toHaveText("$99.00");

  await page.getByTestId("cart-qty-increase").click();
  await expect(page.getByTestId("cart-item-qty")).toHaveValue("2");
  await expect(page.getByTestId("cart-total")).toHaveText("$198.00");

  await page.reload();
  await expect(page.getByTestId("cart-item-qty")).toHaveValue("2");
});
```

**次のシナリオ**: 認証済みチェックアウト開始（Clerk テストアカウントでログイン）→ `/cart` から `/checkout` へのリダイレクト + 注文サマリーの金額整合性検証
