# Testing Strategy

## Current State
- Jest + ts-jest configured for unit and server-side tests.
- React Testing Library and jest-dom installed for component tests.
- Playwright configured for E2E scenarios.
- Existing unit tests live under `src/queries/*.test.ts`.
- Shared test infrastructure in `src/config/`:
  - `test-fixtures.ts`: type-safe mock factories using `Partial<T>` overrides.
  - `test-helpers.ts`: common utilities (mock auth, DB spies, console spies).
  - `test-scenarios.ts`: reusable scenario data (relative date-based).
  - `test-config.ts`: shared constants (IDs, URLs, error messages).
- 881 unit tests across 54 suites (all passing).
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
