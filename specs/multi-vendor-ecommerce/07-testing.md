# Testing Strategy

## Current State
- Jest + ts-jest configured for unit and server-side tests.
- React Testing Library and jest-dom installed for component tests.
- Playwright configured for E2E scenarios.
- Existing unit tests live under `src/queries/*.test.ts`.

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
├─ playwright.config.ts
└─ jest.config.js
```

## E2E Seed
- Seed script: `tests/e2e/seed/seed-e2e.ts`
- Seed constants: `tests/e2e/seed/constants.ts`
