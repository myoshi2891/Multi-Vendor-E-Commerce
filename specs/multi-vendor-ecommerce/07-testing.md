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
- 686 unit tests across 30 suites (all passing).
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
│     └─ __tests__/              # シードテスト（実DB統合テスト）
├─ playwright.config.ts
└─ jest.config.js
```

## E2E Seed
- Seed script: `tests/e2e/seed/seed-e2e.ts`
- Seed constants: `tests/e2e/seed/constants.ts`
