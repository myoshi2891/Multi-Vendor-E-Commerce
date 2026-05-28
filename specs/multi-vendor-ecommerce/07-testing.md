# Testing Strategy

## Current State
- Jest + ts-jest configured for unit and server-side tests.
- React Testing Library and jest-dom installed for component tests.
- Playwright configured for E2E scenarios.
- Existing unit tests live under `src/queries/*.test.ts`, `src/hooks/`,
  `src/providers/`, `src/utils/`, `src/middleware.test.ts`, and
  `src/app/api/webhooks/**/route.test.ts` (Clerk / Stripe / PayPal contract tests).
- Shared test infrastructure in `src/config/`:
  - `test-fixtures.ts`: type-safe mock factories using `Partial<T>` overrides.
  - `test-helpers.ts`: common utilities (mock auth, DB spies, console spies).
  - `test-scenarios.ts`: reusable scenario data (relative date-based).
  - `test-config.ts`: shared constants (IDs, URLs, error messages).
- 1135 tests across 112 suites (12 skipped), as of 2026-05-28.
  - Phase 1 foundation layer (middleware, hooks, utils, providers) fully
    verified with P0/P1/P2 priority labeling applied uniformly.
- Mock patterns:
  - `MockPrismaClient` interface for typed Prisma mocks in store tests.
  - `$transaction` mock: callback receives mock client for transparent
    assertion on `tx.store.update` / `tx.user.update`.
  - Webhook mocks: Svix `Webhook.verify`, `next/headers`, Clerk client.
  - `Prisma.Decimal` mocks: money fields in mock data must use
    `new Prisma.Decimal("value")` (not plain numbers) because production
    code calls `.toNumber()`, `.add()`, `.mul()` etc. Factory overrides
    use `as never` cast for type compatibility with `Partial<MockType>`
    (e.g., `createMockSize({ price: new Prisma.Decimal("50") as never })`).

## Test Layers
- Unit: pure functions, schema validation, and query composition.
- Component: UI behavior with jsdom and user-event.
- Integration: Prisma + PostgreSQL with reset and seed per suite.
- API routes: route handlers with NextRequest mocks.
- E2E: Playwright scenarios for critical flows.

## Directory Layout

```
.
├─ src/
│  ├─ config/
│  │  ├─ test-config.ts
│  │  ├─ test-fixtures.ts
│  │  ├─ test-helpers.ts
│  │  └─ test-scenarios.ts
│  └─ ... (co-located unit tests: *.test.ts)
├─ tests/
│  ├─ unit/
│  ├─ component/
│  ├─ integration/
│  ├─ api/
│  ├─ e2e/
│  ├─ visual/
│  ├─ accessibility/
│  ├─ performance/
│  ├─ contracts/
│  ├─ fixtures/
│  ├─ factories/
│  ├─ mocks/
│  └─ helpers/
├─ tests-setup/
│  ├─ jest.setup.ts
│  ├─ jest.env.ts
│  └─ db.reset.ts
├─ prisma/
│  └─ seed/
│     └─ __tests__/              # シード関連テスト（実DB統合テストおよびモックテスト、src/config/ 等の共有インフラとは分離して運用）
├─ playwright.config.ts
└─ jest.config.js
```

## E2E Seed
- Seed script: `tests/e2e/seed/seed-e2e.ts`
- Seed constants: `tests/e2e/seed/constants.ts`

## E2E Testing

### Helper Function Patterns

E2E tests use reusable helper functions to ensure consistency and reduce code
duplication:

```typescript
// Size selection helper (tests/e2e/purchase-flow.spec.ts)
async function addItemToCart(page: Page, productSlug: string, variantSlug: string) {
  await page.goto(`/product/${productSlug}/${variantSlug}`);

  // Select the first available size
  const firstSize = page.locator('[data-testid^="size-option-"]').first();
  await firstSize.click();

  // Wait for URL to update with size parameter
  await page.waitForURL(/.*\?size=.*/, { timeout: 5000 });

  await page.getByTestId("add-to-cart").click();
}
```

**Key Patterns**:
- Use `data-testid` prefix matching (`^=`) for stable selectors
- Wait for URL parameter updates after state changes
- Explicit timeout values for clear failure messages

### Environment Variable Handling

Numeric environment variables require careful handling to avoid empty string
coercion:

```typescript
// Correct: trim and validate before conversion
const envPrice = process.env.E2E_UNIT_PRICE?.trim();
unitPrice = envPrice ? Number(envPrice) : fallbackValue;

if (!Number.isFinite(unitPrice)) {
  throw new Error(`Invalid E2E_UNIT_PRICE: ${process.env.E2E_UNIT_PRICE}`);
}
```

**Why This Matters**:
- `Number("")` returns `0`, bypassing validation
- Empty strings from environment files need explicit handling
- `trim()` prevents whitespace-only values from passing validation

### Recent Improvements
- Size selection standardized across all purchase flow tests (Round 7-8)
- Helper functions introduced for DRY test code (Round 8)
- Environment variable processing hardened (Round 9)

## Visual Regression Testing

### Overview

Visual regression tests live in `tests/e2e/visual/` and use Playwright's
`toHaveScreenshot()`. Chromium only (Firefox/WebKit excluded due to font
rendering differences; Phase 2 scope).

Covered scenarios (as of 2026-05-22):

| Spec | Test | Snapshot file |
|------|------|---------------|
| `cart.spec.ts` | 空カートの表示 | `cart-empty-chromium-<os>.png` |
| `cart.spec.ts` | 商品追加後のカート表示 | `cart-with-item-chromium-<os>.png` |
| `checkout.spec.ts` | 未認証リダイレクト | `checkout-redirect-signin-chromium-<os>.png` |

### Snapshot Naming Convention

Playwright appends the OS name automatically:

```
<test-name>-<browser>-<os>.png
  例: cart-empty-chromium-darwin.png   (macOS ローカル)
      cart-empty-chromium-linux.png    (CI / GitHub Actions)
```

**macOS と Linux は別ファイル**になる。ローカルで生成した `-darwin.png` を
push しても、Linux CI は `-linux.png` を探して FAIL する。

### Baseline 更新手順

#### ローカル（macOS）

```bash
# Chromium 限定で baseline を再生成
bunx playwright test tests/e2e/visual/ --update-snapshots --project=chromium
git add tests/e2e/visual/cart.spec.ts-snapshots/ tests/e2e/visual/checkout.spec.ts-snapshots/
git commit -m "test(visual): update baseline screenshots"
```

#### CI（Linux）

`.github/workflows/ci.yml` に `visual-baselines` ジョブが設定済み（OI-4a、2026-05-22）。
`workflow_dispatch` で手動起動し、生成された `-linux.png` を PR として提出する仕組み:

```bash
# 任意のブランチ ref で起動
gh workflow run ci.yml --ref <branch>
```

ジョブ内で以下を実行:
1. PostgreSQL service container を起動
2. `bunx prisma migrate deploy` + `bun run seed:e2e`
3. `bunx playwright test tests/e2e/visual --update-snapshots`
4. `peter-evans/create-pull-request@v6` で `chore/visual-baselines-linux` ブランチに PR 作成

PR レビュー後にマージすると `-linux.png` ベースラインが main に取り込まれる。

> 通常の CI 実行（`push`/`pull_request`）では `visual-baselines` ジョブは起動しない（`if: github.event_name == 'workflow_dispatch'`）。
> baseline 更新は意図的な UI 変更時にのみ行う。

### Playwright Config（再現性確保）

`playwright.config.ts` に以下を設定し、OS 間差異を最小化している:

```typescript
use: {
  reducedMotion: "reduce",  // アニメーション無効
  locale: "en-US",          // ロケール固定
  timezoneId: "UTC",        // タイムゾーン固定
}
```

### 参照コミット

| コミット | 内容 |
|---------|------|
| `f639334` | visual/ スペック追加・playwright.config.ts 設定追加 |
| `688225f` | macOS（darwin）baseline 3 枚をコミット |

## Component Testing

### Shipping Fee Component Tests

The `ProductShippingFee` component has comprehensive test coverage for all
three shipping methods:

```typescript
// tests/component/store/shipping-fee.test.tsx
describe("ProductShippingFee", () => {
  describe("ITEM method", () => {
    it("displays tiered pricing when fee !== extraFee", () => {
      render(<ProductShippingFee method="ITEM" fee={5} extraFee={3} quantity={2} />);
      expect(screen.getByText(/First item: \$5\.00/)).toBeInTheDocument();
      expect(screen.getByText(/Each additional: \$3\.00/)).toBeInTheDocument();
    });
  });

  describe("WEIGHT method", () => {
    it("displays calculation formula with correct precision", () => {
      render(<ProductShippingFee method="WEIGHT" fee={2.5} weight={1.5} quantity={2} />);
      expect(screen.getByText(/\$2\.50 × 1\.50 kg × 2 = \$7\.50/)).toBeInTheDocument();
    });
  });

  describe("FIXED method", () => {
    it("shows quantity-independent message", () => {
      render(<ProductShippingFee method="FIXED" fee={10} />);
      expect(screen.getByText(/quantity doesn't affect shipping fee/)).toBeInTheDocument();
    });
  });
});
```

**Coverage**:
- All 3 shipping methods (ITEM, WEIGHT, FIXED)
- Edge cases (unknown method, zero quantity)
- Centralized calculation via `computeShippingTotal`
- Floating-point precision handling

### Shipping Calculation Utility Tests

The centralized `computeShippingTotal` function ensures consistent precision:

```typescript
// src/lib/__tests__/shipping-utils.test.ts
describe("computeShippingTotal", () => {
  it("applies floating-point correction for WEIGHT method", () => {
    const result = computeShippingTotal("WEIGHT", 2.5, 0, 1.5, 2);
    expect(result).toBe(7.5); // Not 7.499999999999999
  });
});
```

**Implementation**: Uses `Math.round((result + Number.EPSILON) * 100) / 100` to
guarantee 2-decimal precision for all monetary calculations.
