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
- 1712 passed / 1715 total across 174 suites (3 skipped), as of 2026-07-18.
  Ten regressions from the CodeRabbit local review (+10, no new suites). `place-order.test.tsx`
  (+1) pins the guard to order confirmation: a failing `emptyUserCart()` cleanup must not release
  it, because the order is already placed and irreversible (previously the `catch`/`finally` path
  re-enabled the button and allowed a duplicate order). `stripe.test.ts` (+4) rejects a stale
  payment intent: `createStripePaymentIntent` now records the active intent id and
  `createStripePayment` requires a match, since an older Pending/canceled intent for the same order
  shares the same metadata/amount/currency and could downgrade a settled `Paid` order.
  `user.test.ts` (+2) requires a `Serializable` transaction and an idempotent `deleteMany`, closing
  the TOCTOU between the pre-read and the cart replacement. Counts are from a full-suite run.
- 1689 passed / 1692 total across 174 suites (3 skipped), as of 2026-07-17.
  Three regressions from the CodeRabbit follow-up (+3, no new suites). `place-order.test.tsx` (+2)
  locks the submit guard: the success path must keep `isPlacingOrderRef` and `loading` held while
  `push()` navigates (previously the `finally` released them unconditionally and `placeOrder` was
  re-invoked — measured at 2 calls), and the failure path must still release them so a retry works.
  `order.test.ts` (+1) caps `AdminOrderFilterSchema.page` at 10,000, mirroring the existing
  `limit`≤100 clamp; without it `?page=1e12` reached `skip:(1e12-1)*50` ≈ 5e13. Cookie-protection
  and `applySeller` privileged-field assertions were added to existing tests, so they do not move
  the count. Counts are from a full-suite run.
- 1686 passed / 1689 total across 174 suites (3 skipped), as of 2026-07-17.
  Two new suites (+2): `src/lib/log.test.ts` (the shared `logError` helper from the plans 007-009
  logging consolidation) and `src/components/store/cards/place-order.test.tsx` (the place-order
  double-submit guard). The remaining delta comes from the atomic `saveUserCart` work in
  `useCartStore.test.ts` / `user.test.ts` and from `store.test.ts`. Stripe capture now maps
  in-flight PaymentIntent states (`processing` / `requires_action` / `requires_confirmation` /
  `requires_capture`) to `Pending` rather than `Failed`, so a later webhook reporting `succeeded`
  cannot contradict the stored `paymentStatus`; `canceled` maps to `Cancelled`. A
  `requires_payment_method` intent is now `Failed` only when `last_payment_error` is present;
  an unconfirmed initial intent remains `Pending`. Counts are from a full-suite run.
- 1681 passed / 1684 total across 172 suites (3 skipped), as of 2026-07-16.
  Plan 023 normalizes public `index-products` GET pagination: non-numeric and invalid values use
  defaults, `limit` is capped at 50, and `page` at 10,000. Five regressions assert both Prisma
  `skip`/`take` arguments and normalized response metadata. Plan 024 adds six route-handler
  regressions for valid, malformed, oversized, and projected `userCountry` cookie writes; the
  merged total is from the full-suite run (suite count unchanged).
- 1659 passed / 1662 total across 172 suites (3 skipped), as of 2026-06-26.
  track-order feature (`docs/design/track-order/`): public order-tracking page `/track-order`
  with a public `trackOrder` server action (no auth guard; `where: { id }` only, email matched
  in app layer with `toLowerCase()` — IDOR 3-layer; mismatch and not-found return the same `null`
  to prevent enumeration; `user`/email stripped from the result; no PII logged — and on DB failure
  `trackOrder` throws a generic message instead of null, with no email/orderId in the log) and
  `TrackOrderSchema`. Client `track-order-form.tsx` (RHF + zodResolver, useRef re-entrancy guard;
  distinguishes a not-found message from a separate failed retry message when `trackOrder` throws)
  and `track-order-result.tsx` (reuses shared OrderStatusTag / PaymentStatusTag / ProductStatusTag).
  Added +7 to `order.test.ts` (T-TO1–T-TO6 plus T-TO11 DB-failure-throws-with-no-PII) and a new suite
  `src/components/store/track-order/track-order-form.test.tsx` (+4, T-TO7–T-TO10: empty-submit guard,
  matched-status render, null → not-found, throw → retry message); +11 tests, 171 → 172 suites.
- 1650 passed / 1653 total across 171 suites (3 skipped), as of 2026-06-22.
  SonarCloud Quality Gate remediation (PR #149) lifted support-forms New Code Coverage
  from 77.5% over the 80% gate and cleared 4 New Issues (S6759 readonly props ×2, S6819
  `<output>` over `role="status"`, S6479 content-based paragraph keys). Added `support.test.ts`
  (+5, currentUser/create throw paths in Error and non-Error branches), `support-form.test.tsx`
  (+4, success `<output>` / error alert / `requireOrderId` / `submitLabel`) and a new suite
  `content/content.test.ts` (+3, import-and-shape checks for the previously-0% faqs/legal/
  product-support/returns constants); +12 tests, 170 → 171 suites.
- 1638 passed / 1641 total across 170 suites (3 skipped), as of 2026-06-22.
  Support forms (`docs/design/support-forms/`) added a single `SupportTicket` model
  (additive, non-destructive migration + ERD regen) and a public `createSupportTicket`
  server action (`src/queries/support.ts`, no auth guard = guest-allowed, attaches
  `userId` only when signed in). Four public form pages `/contact` `/returns-exchange`
  `/dispute` `/report-problem` render the shared `support-form.tsx` (RHF + zodResolver,
  `useRef` double-submit guard) and stay `○ Static` (no `force-dynamic`). The user-menu
  "Return & Refund Policy" (`/` → `/returns-exchange`), "Order Dispute Resolution"
  (`""` → `/dispute`) and "Report a Problem" (`""` → `/report-problem`) links were wired.
  New suites `support.test.ts` (+4, T-SF1–T-SF4) and `support-form.test.tsx` (+2,
  T-SF5/T-SF6) plus +3 regressions in `user-menu.test.tsx` (T-SF7); +9 tests,
  168 → 170 suites.
- 1629 passed / 1632 total across 168 suites (3 skipped), as of 2026-06-22.
  Storefront static pages (`docs/design/storefront-static-pages/`) added the public
  `/about` `/legal` `/faqs` `/customer-service` `/product-support` pages plus a 308
  `permanentRedirect` from `/faq` to `/faqs`, all rendered via a shared
  `StaticPageLayout` component fed by typed content constants (plain-text `<p>` only,
  no `dangerouslySetInnerHTML`, no `force-dynamic` since they are DB-independent and
  stay SSG). The user-menu "Help Center" (`""` → `/customer-service`) and
  "Legal & Privacy" (`""` → `/legal`) links were wired. New suites
  `static-page-layout.test.tsx` (+5), `about/page.test.tsx` (+1),
  `customer-service/page.test.tsx` (+1) and +2 regressions in `user-menu.test.tsx`
  (Help Center / Legal & Privacy links); +9 tests, 165 → 168 suites.
  No new server action or schema change.
  Offers feature (`docs/design/offers/`) added the public `/offers` landing page
  (`src/app/(store)/offers/page.tsx`, `force-dynamic`, reusing `getAllOfferTags` and
  delegating the product grid to `/browse?offer=<url>`) and wired the user-menu
  "Discounts & Offers" link (`""` → `/offers`). New suite `offers/page.test.tsx` (+2:
  T-OF1 list & `/browse?offer=<url>` links / T-OF2 empty state, `getAllOfferTags` mocked)
  and a +1 regression in `user-menu.test.tsx` (T-OF3: link → `/offers`); +3 tests,
  164 → 165 suites. No new server action or schema change.
  Compare review-finding fixes added an `else` branch to `compare-grid.tsx`'s catch for
  non-`Error` throws (structured `"[Compare:fetch] Unknown error"` log, aligning with the
  tech.md cancellation-flag pattern) and +4 regression tests across the two existing compare
  suites (`useCompareStore.test.ts`: persistence contract — setItem under the `compare-store`
  key, re-persist after remove, rehydrate from existing data; `compare-grid.test.tsx`: the new
  non-`Error` reject branch); suite count unchanged (1613 → 1617).
  PR #147 follow-up raised SonarCloud New Code coverage from 63.6% to ≥80% by adding
  `product-card.test.tsx` (new, +8: compare toggle 3 branches, wishlist success/failure,
  rating condition) and extending `compare-grid.test.tsx` (+4: loading skeleton, remove,
  clear-all, fetch-rejection catch); both files reach 100% line coverage. The `product-card.tsx`
  wishlist `catch` was also narrowed from `any` to `unknown` + `instanceof Error`.
  Compare feature (product comparison) added a `useCompareStore` (zustand + persist under
  `src/compare-store/`, holding variant ids, max 4, idempotent, `isComparing`), the `/compare`
  page (client wrapper) and `CompareGrid` (client, reusing the existing `getProductsByIds`,
  skipping the call when the list is empty to avoid its empty-array throw), plus an
  Add-to-compare toggle button on the product card (tasks.md 2-B). Two new suites:
  `useCompareStore.test.ts` (+8: T-CMP1–4 add/idempotent/limit/remove + `isComparing`) and
  `compare-grid.test.tsx` (+2: T-CMP5/T-CMP6 fetch-and-render / empty-state no-call, mocking
  `getProductsByIds`); +10 tests, 161 → 163 suites. No new server action or schema change.
  SonarCloud Quality Gate (PR #145) remediation extracted the duplicated buyer/seller messaging
  containers into a shared hook (`src/components/shared/messages/use-conversation-thread.ts`) and a
  generic `messages-layout.tsx`, then raised new-code coverage to ~100% branches: `message.test.ts`
  (+14: every catch's Error/unknown branch + untested DB-error paths + order-null), buyer/seller
  container suites (+11/+1: shared hook & layout branches via container instantiation), and
  `user-menu.test.tsx` (+5: authenticated / fallback / catch branches); +31 tests, 161 suites unchanged.
  Profile-messages Phase 4 (seller UI, loop closure) added `getStoreConversations` buyer include
  (`StoreConversationWithLatest` type) and the seller dashboard route
  `/dashboard/seller/stores/[storeUrl]/messages` reusing `conversation-thread.tsx`; one component
  suite `src/components/dashboard/seller/seller-messages-container.test.tsx` (+7: buyer-name list,
  select fetch+mark-read, 5s polling, `document.hidden` pause, post-reply refetch, structured log);
  +7 tests, 160 → 161 suites.
  Profile-messages Phase 2+3 (buyer↔seller 1:1 messaging) added `src/queries/message.test.ts`
  (+31: authorization / IDOR 3-tier for getConversationMessages·sendMessage·markConversationRead /
  idempotent upsert / `$transaction`) and two buyer-UI component suites under
  `src/components/store/profile/messages/` (`conversation-thread.test.tsx` 7,
  `messages-container.test.tsx` 7 covering 5s polling, `document.hidden` pause, mark-read);
  +45 tests, 157 → 160 suites.
  Profile-settings Phase 1 (settings page + navigation fix) added three RTL suites under
  `tests/component/store/` (`user-menu` Settings-link regression `/` → `/profile/settings`,
  `profile-sidebar` Settings entry, `settings-page` `<UserProfile />` render); +3 tests,
  154 → 157 suites. No new server action or schema change (profile edits sync to Prisma via
  the existing Clerk webhook).
  Seller-dashboard Phase 4 (F3 stock decrement + F3-5 restock) added `placeOrder` stock
  tests in `src/queries/user.test.ts` (+3: insufficient-stock rollback / decrement success /
  race-safe conditional `updateMany`) and restock-on-cancel tests in
  `src/queries/order.test.ts` (+6: group-/order-level restock + idempotency guards); a new
  authenticated E2E spec `tests/e2e/stock-decrement.spec.ts` verifies `Size.quantity`
  decreases by the ordered amount end-to-end (AC-F3-4, Jest-excluded); 1496 → 1505 passed,
  154 suites unchanged.
  Seller-dashboard Phase 3-B (F1 store dashboard UI) added three RTL suites under
  `src/components/dashboard/seller/` (`store-stats-cards` / `store-recent-orders` /
  `store-top-products`, +6: KPI/row rendering + zero-state edge cases AC-F1-5) and
  replaced the `[storeUrl]/page.tsx` placeholder with a KPI dashboard (`Promise.all` over
  four store-scoped queries + reused `SalesChart` + `force-dynamic`); 1490 → 1496 passed,
  151 → 154 suites.
  Seller-dashboard Phase 3-A added `src/queries/store-dashboard.test.ts` (new suite, +39:
  3-tier auth × 4 functions / revenue join restricted to parent `Order.paymentStatus=Paid` /
  `_sum` null → 0 / per-`storeId` cache scoping / DB-error Error & non-Error branches);
  1451 → 1490 passed, 150 → 151 suites.
  Seller-dashboard Phase 2-A/2-B added `src/queries/inventory.test.ts` (new suite, +22:
  auth / 3-tier IDOR / Zod rejection / happy path) and 6 `getStockStatus` boundary
  tests in `src/lib/utils.test.ts` (AC-F2-5); 1407 → 1435 passed, 144 → 145 suites.
  Phase 2-C (F2 inventory UI) added `src/components/dashboard/seller/stock-status-badge.test.tsx`
  (+3 badge status boundaries) and `inventory/columns.test.tsx` (+5: accessor key order /
  per-cell rendering, reusing the orders `renderCell` pattern); 1435 → 1443 passed, 145 → 147 suites.
  Phase 2-C completion added `inventory-quantity-cell.test.tsx` / `low-stock-threshold-form.test.tsx`
  (UI hardening) and `inventory-alert-summary.test.tsx` (+3: out/low aggregation mapping,
  threshold boundary parity with row badges, empty-inventory zero counts), bringing all six
  2-C components under test; 1443 → 1451 passed, 147 → 150 suites.
  Playwright E2E (main) gained `tests/e2e/platform-coupon.spec.ts` (Phase 5-C:
  PLATFORM-scope coupon across two stores), 5 → 6 specs; Jest count unaffected.
  Phase 4 (F3) added `tests/e2e/stock-decrement.spec.ts` (post-purchase stock
  verification), 6 → 7 specs. profile-messages Phase 5 added
  `tests/e2e/messages.spec.ts` (AC-M8: buyer↔seller round trip across two browser
  contexts — buyer sends, seller replies, buyer's 5s polling surfaces the reply;
  `test.skip` when `CLERK_SECRET_KEY` is unset), 7 → 8 specs; Jest count unaffected.
  Shared layout chrome unification added `tests/e2e/layout-chrome.spec.ts`
  (asserts `store-header`/`store-footer` render exactly once across `(store)`
  pages, home is not double-headed, and `(fullscreen)` `seller/apply` has no
  shared chrome), 8 → 9 specs; Jest count unaffected. The same spec later gained
  a sign-in/sign-up chrome assertion (the `(auth)` group now supplies the shared
  header/footer), 6 → 7 tests within the spec; spec file count stays 9.
  - Phase 1 foundation layer (middleware, hooks, utils, providers) fully
    verified with P0/P1/P2 priority labeling applied uniformly.
  - modal-provider's 9 tests were un-skipped after OI-8's root cause (a Prisma
    connection leak in `src/queries/size.test.ts`) was resolved in `83ef06c`;
    the remaining 3 skips are the DB-gated idempotency suite.
- 17 integration tests across 2 suites
  (`tests/integration/cart-checkout.test.ts` 11 +
  `tests/integration/order-placement.test.ts` 6) as of 2026-05-31.
  Run via `bun run test:integration` against a testcontainers-managed
  PostgreSQL (see ADR-004). Excluded from the default `bun run test` run via
  `testPathIgnorePatterns`. `order-placement.test.ts` exercises `placeOrder`
  (`src/queries/user.ts`) end-to-end with a real `$transaction`: per-store
  OrderGroup split, stock capping, store-scoped coupon discount, ownership
  (IDOR) guard, and rollback on invalid product combinations.
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

## CI & Quality Integration

### Continuous Integration (CI) Workflow
GitHub Actions (`.github/workflows/ci.yml`) にて、以下の自動検証が PR およびマージ時に実行されます。
1. **静的解析 (Lint & Build)**: `bun run lint` および `bun run build` を実行し、コードの適合性とコンパイルの成功を保証。
2. **ユニット・コンポーネントテスト**: `bun run test --coverage` を実行。結果として出力されたカバレッジレポート（lcov）は artifact に保存され、SonarCloud に連携されます。
3. **データベース統合テスト (Integration)**: `bun run test:integration` を実行。`testcontainers-managed PostgreSQL` を runner 上の Docker を用いて一時起動し、アトミック性や外部キー制約、Decimal 等の整合性をテスト。
4. **シードデータの冪等性検証**: `seed-idempotency` ジョブにて、実 PostgreSQL に対するシードスクリプトの 2 回連続実行およびデータ行数の一致検証を実行（E2E テスト用のクリーンなデータ状態の担保）。

### Code Quality Monitoring (SonarCloud)
CI の `test` ジョブ完了後、SonarCloud ジョブ（`.github/workflows/ci.yml` の `sonarcloud`）が起動し、静的コード解析を実施します。
- バグ、コードスメル、セキュリティ脆弱性、およびコードカバレッジを統合ダッシュボードで追跡。
- 導入初期段階での Quality Gate は、既存コードベースとの兼ね合いから **非ブロッキング** で運用し、開発の停滞を防ぎつつ可視化を促進します。
- ローカル環境でも `make sonar-scan` コマンドで同様の静的解析を再現・事前確認できます（詳細は [`docs/architecture/decisions/005-sonarqube-static-analysis.md`](../../docs/architecture/decisions/005-sonarqube-static-analysis.md) を参照）。

### Automated Performance Audit (Lighthouse CI)
CI での PR トリガー時に、Lighthouse CI ジョブ (`.github/workflows/lhci.yml`) が起動し、自動パフォーマンス予算検証が行われます。
- `/browse` ページなどを対象に Lighthouse の desktop プリセットで 3 回測定を実行。
- パフォーマンス（Performance）、LCP、CLS、TBT などのスコアが指定のしきい値に適合しているかを自動監査（現在はベースライン観測段階のため警告のみで非ブロッキング）。
- 測定レポートは一時ストレージ（Lighthouse temporary public storage）にアップロードされ、結果のリンクが CI ログに記録されます。
