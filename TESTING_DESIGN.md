# Testing Design: Directory Layout and Tool Selection

## Goals
- Build a layered test pyramid for a Next.js 14 multi-vendor commerce app.
- Prioritize high-risk flows: auth/RBAC, pricing, inventory, checkout, payments, and order state.
- Keep tests fast and deterministic with clear separation of unit, integration, and E2E.

## Current State (Observed)
- Jest + ts-jest already configured; `test` script points to Jest.
- Existing unit tests live under `src/queries/*.test.ts`.
- React Testing Library and jest-dom are already installed.

## Decision: Jest Config (Merged This Iteration)
- Keep a single `jest.config.js` to avoid config sprawl during early setup.
- Use `@jest-environment jsdom` per component test file that needs DOM APIs.
- Keep `testEnvironment: "node"` as the default for faster unit and server tests.
- Scope runs via `--testPathPattern` in scripts instead of multiple Jest configs.
- Revisit splitting only if setup diverges (db reset, jsdom-only setup, or slow runs).

## Tool Selection

### Unit Tests
- Runner: Jest (existing)
- Purpose: Pure functions, helpers, schema logic, query composition
- Notes: Keep node environment for speed; avoid DB and network

### Component Tests
- Runner: Jest (existing)
- Library: React Testing Library + jest-dom (existing)
- Add: `@testing-library/user-event` for realistic UI interaction
- Environment: jsdom

### Integration Tests (DB and Server Logic)
- Runner: Jest (existing)
- DB: MySQL test database using Docker Compose
- ORM: Prisma with a separate `.env.test`
- Notes: Use database reset per suite (migration + seed)

### API Route Tests (Next.js route handlers)
- Runner: Jest (existing)
- Helper: invoke `GET/POST` handler with `NextRequest`
- Option: a small local helper to build request/response objects

### End-to-End (E2E)
- Runner: Playwright (recommended)
- Why: Multi-browser, traces, parallelism, strong Next.js support
- Scope: Full customer and seller flows, plus admin critical paths

### Visual Regression
- Tool: Playwright screenshots (baseline + diff)
- Scope: Product card, checkout, order details, seller dashboard

### Accessibility
- Unit: jest-axe for components
- E2E: axe-core via Playwright

### Contract and Webhook Testing
- Tool: Postman/Newman or Pact (optional)
- Scope: Stripe/PayPal webhooks and critical POST routes

### Performance and Load
- Tool: k6 or Artillery
- Scope: browse, search, checkout, and payment initiation

### Security Checks
- Tool: OWASP ZAP baseline scan (CI or staging)
- Scope: auth, checkout, order APIs, and admin routes

## Directory Layout

```
.
├─ src/
│  └─ ... (co-located unit tests: *.test.ts)
├─ tests/
│  ├─ unit/                # optional if not co-locating
│  ├─ component/           # RTL component tests (jsdom)
│  ├─ integration/         # DB and server-side integration tests
│  ├─ api/                 # API route handler tests
│  ├─ e2e/                 # Playwright tests
│  ├─ visual/              # Playwright screenshot tests
│  ├─ accessibility/       # axe checks
│  ├─ performance/         # k6 or Artillery scripts
│  ├─ contracts/           # webhook and external contract tests
│  ├─ fixtures/            # static JSON and files
│  ├─ factories/           # test data factories
│  ├─ mocks/               # MSW handlers and stub servers
│  └─ helpers/             # shared test utilities
├─ tests-setup/
│  ├─ jest.setup.ts        # jest-dom, MSW setup
│  ├─ jest.env.ts          # global env bootstrap
│  └─ db.reset.ts          # reset, migrate, seed
├─ playwright.config.ts
└─ jest.config.js
```

## Naming Conventions
- Unit tests: `src/**.test.ts` or `tests/unit/**.test.ts`
- Component tests: `tests/component/**.test.tsx`
- Integration tests: `tests/integration/**.test.ts`
- E2E tests: `tests/e2e/**.spec.ts`
- Visual tests: `tests/visual/**.spec.ts`

## Environment and Data Strategy
- Use `.env.test` for test DB and secrets.
- Use a dedicated MySQL schema for tests.
- Reset strategy:
  - Integration suites: migrate + seed before suite
  - E2E suites: seed before run, clean after run
- Use factories for consistent test data, not hard-coded IDs.

## Suggested Scripts (for reference)

```
test                -> jest
test:unit           -> jest --testPathPattern "src/.*\\.test\\.ts$"
test:component      -> jest --testPathPattern "tests/component/.*\\.test\\.tsx$"
test:integration    -> jest --testPathPattern "tests/integration/.*\\.test\\.ts$"
test:e2e            -> playwright test
test:visual         -> playwright test tests/visual
test:a11y           -> playwright test tests/accessibility
test:perf           -> k6 run tests/performance/browse.js
```

## CI Order (Fast to Slow)
1) Lint and typecheck
2) Unit + component
3) Integration (DB)
4) E2E smoke
5) Visual, performance, security scans (nightly)

## Notes for This Codebase
- Keep existing `src/queries/*.test.ts` as unit tests.
- Use `@jest-environment jsdom` per component test file (keep single config).
- Use Playwright for full purchase, seller update, and admin flows.
- Mock external providers (Clerk, Stripe, PayPal) for unit/integration tests.
- Only run real webhooks in isolated staging or contract tests.

## Playwright: Concrete Proposal

### Config file (`playwright.config.ts`)

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
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
```

Notes:
- If you prefer Bun, switch `command` to `bun run dev`.
- For CI stability, consider `next build` + `next start` instead of `next dev`.

### First E2E scenario (cart smoke, guest user)
Goal: prove cart add, quantity update, and persistence without auth.

Preconditions:
- Seed at least one product with a stable slug and in-stock variant.
- Add `data-testid` to: product card, add-to-cart button, cart rows, totals.

Test outline (`tests/e2e/cart-smoke.spec.ts`):

```ts
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

Next scenario after this:
- Authenticated checkout start (login via Clerk test account), verify redirect
  from `/cart` to `/checkout` and order summary shows correct totals.
