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
- 2072 passed / 2075 total across 194 suites (3 skipped tests in 1 skipped suite), as of 2026-09-02.
  Integration is 131 tests across 15 suites: a review follow-up added +2 in
  `category-tree-resync.test.ts` covering `Product.categoryNodeId` resynchronization — a product
  created after the one-shot Phase A backfill (NULL) and one whose category changed afterwards
  (stale). The section's `UPDATE "Product"` was executed by the suite but never asserted, which is
  the exact path the file's own docstring describes as making products "silently disappear" once
  reads switch over. `setup/migration-sql.ts` now runs a marked section inside `$transaction`, so
  tests observe the same atomicity production gets.
  Code-review follow-up added +6 tests (+1 suite): `tests/component/store/category-link.test.tsx`
  (+3, new suite) pins that a category branch re-opens when a descendant becomes selected by a
  client-side navigation — the `useState` initializer runs once, but the branch stays mounted
  while `?category=` changes — and that the sync only ever opens, preserving a user's manual
  collapse. `src/app/(store)/browse/page.test.tsx` (+2) pins that an explicitly supplied but
  unresolvable `category` (or an array one) is no longer folded into `?category=<sub>` by the
  308 canonicalization, which had turned `getProducts`' fail-closed zero result into the
  subcategory's results. `scripts/erd/parse-models.test.ts` (+1) pins that Prisma line comments
  are not emitted as fields.
- Earlier entry: 2065 passed / 2068 total across 193 suites (3 skipped tests in 1 skipped suite),
  as of 2026-09-02. Review follow-up added +1 regression test (suites unchanged): the coverage dashboard's test
  scanner counted private-member calls (`this.#test(...)`) as test declarations, because its
  negative lookbehind excluded `.` but not `#`. Widened to `(?<![.#\w$])` and pinned in
  `scripts/coverage-dashboard/scan-tests.test.ts`.
- Earlier entry: 2064 passed / 2067 total across 193 suites, as of 2026-09-02.
  Category tree Phase B (plan 067) closed: `flattenCategoryTree` (+2 tests, suites unchanged) backs the
  footer category links, which now emit the canonical `?category=` slug instead of the legacy
  `?subCategory=` that took a 308 hop on every click.
  Integration is 129 tests across 15 suites (+4 in `product-browse.test.ts` for subtree filtering —
  sibling-prefix isolation (V-1), depth-2 products reached through a root ancestor, legacy
  `?subCategory=` resolving to the same subtree, fail-closed on an unresolvable slug (V-6) — and
  +2 in `product-update.test.ts` pinning the `categoryNodeId` dual-write on both create and update).
  E2E is 65 tests/browser across 29 files (195 total): `search-filter.spec.ts` asserts the 308
  canonicalization for both the canonical slug and a `CategorySlugAlias`-only legacy slug.
- Earlier entry: 2062 passed / 2065 total across 193 suites (3 skipped tests in 1 skipped suite), as of 2026-09-02.
  Category tree Phase B (plan 067) added `src/lib/category-tree.test.ts` (+1 suite) plus new cases in
  `schemas.test.ts`, `product.test.ts`, `category.test.ts` and `browse/page.test.tsx`.
  Integration is 123 tests across 15 suites (`category-tree-resync.test.ts`, +6 / +1 suite).
- Earlier entry: 2032 passed / 2035 total across 192 suites (3 skipped tests in 1 skipped suite), as of 2026-09-02.
  Added `scripts/erd/parse-models.test.ts` (+4 tests / +1 suite) pinning the Prisma-schema parser
  notation regressions after it was extracted out of `scripts/erd/generate-erd.ts`.
- Earlier entry: 2028 passed / 2031 total across 191 suites (3 skipped tests in 1 skipped suite), as of 2026-08-31.
  A review fix closed a miscount in `scripts/coverage-dashboard/scan-tests.ts`: `BLOCK_PATTERN`
  used `\b(it|test)\s*\(`, and `\b` also matches the boundary between `.` and an identifier, so
  `RegExp.prototype.test` member calls such as `/^CREATE\b/i.test(sql)` were counted as test
  declarations. A negative lookbehind `(?<![.\w$])` closes it; +1 regression test, suites unchanged.
- Earlier entry: 2026 passed / 2029 total across 191 suites (3 skipped tests in 1 skipped suite), as of 2026-08-31.
- Earlier entry: 2025 passed / 2028 total across 191 suites, as of 2026-08-31 (before the review-fix regression guard on `upsertCategory`).
  Plan 066 (category tree Phase A) folded the seed declaration data into a single tree, so the
  `SEED_SUB_CATEGORIES` assertions in `prisma/seed/__tests__/` were replaced with tree invariants
  (parent reference integrity, no self-parent, depth <= 1, every root has >= 2 children, products
  point only at leaves, the legacy `SubCategory` row shares its id with the `Category` node, and
  `childCount` is recomputed from the declaration). Net -1 test, suites unchanged.
- Earlier entry: 2026 passed / 2029 total across 191 suites (3 skipped tests in 1 skipped suite), as of 2026-08-25.
- Earlier entry: 2025 passed / 2028 total across 191 suites (3 skipped tests in 1 skipped suite), as of 2026-08-25.
  Regression detection points added while fixing code-review findings (+4 tests, suites
  unchanged): `stripe-payment.test.tsx` pins that a `clientSecret: null` response is surfaced
  as an error rather than swallowed — it produces the same infinite-spinner symptom as the
  throw path but leaves no error state, so nothing could catch it; `store.test.ts` pins that
  the non-promotion path of `updateStoreStatus` re-reads the owner's role **inside** the
  transaction (the TOCTOU window that `FOR UPDATE` closed on `status` was still open on
  `role`); and `browse/page.test.tsx` adds two price-boundary cases so `?maxPrice=0` is not
  flipped to "no upper bound" by a truthy check.
- Earlier entry: 2020 passed / 2023 total across 191 suites (3 skipped tests in 1 skipped suite), as of 2026-08-24.
  (The recorded figure drifted by one against the measured 2021 / 2024; corrected in the
  2026-08-25 entry above.)
  Detection points for the two defects plan 049 surfaced (+4 tests, +1 suite): a new
  `orders-table.test.tsx`, one case in `payments-table.test.tsx`, and one in
  `shipping-form.test.tsx`.
- Earlier entry: 2013 passed / 2016 total across 190 suites (3 skipped tests in 1 skipped suite), as of 2026-08-23.
  Plan 030 covered the six money-path client components that sat at lcov 0% (+26 tests, +6 suites,
  one suite per commit): newsletter, cart summary, PayPal payment, Stripe payment, checkout
  container and cart container. Their Lines coverage moved from 0% to 96.8–100%. Unlike the
  net-casting suites added by plans 010 and 034, this one found two real defects.
  First, `checkout-page/container.tsx` called its hydration query without a `catch`, so a failure
  escaped the `useEffect` as an unhandled rejection and the page kept showing **stale amounts**
  with nothing telling the user the refresh had failed; it was fixed under operator approval
  (`066ffd2f`) with a try/catch, a structured log and a toast, plus the cancellation-flag pattern
  from `tech.md` since the effect re-runs when the country changes. Building the detection point
  with `it.failing` was rejected empirically: `it.failing` inverts the *assertion* result, while an
  unhandled rejection surfaces at Node's process level and is not absorbed — the probe produced one
  failing test and reported the same rejection twice. Second, the error message set when Stripe's
  intent request fails is **unreachable**: the early return for `!clientSecret` renders the loader,
  so the `<form>` that would display it never mounts and the user sees an endless spinner. That one
  is pinned as characterization; the component was left unchanged (out of scope for this plan).
- Earlier entry: 1987 passed / 1990 total across 184 suites (3 skipped tests in 1 skipped suite), as of 2026-08-13.
  Review-fix pass (+3, no new suite). `src/queries/review.test.ts` gained 2 cases pinning
  that the review write and the aggregation update are wired into a single `$transaction`
  and that the `Product` row lock is taken *before* the write — these, not the integration
  suite, are the deterministic guard against the aggregation lost update.
  `src/lib/shipping-utils.test.ts` gained 1 regression case for the `Prisma.Decimal`
  migration: WEIGHT `0.15 × 1.45 × 10` is exactly 2.175 in decimal, so half-up gives 2.18,
  but the old `Math.round((x + EPSILON) * 100) / 100` returned 2.17 — `Number.EPSILON` is
  an absolute constant sized for magnitudes near 1 and cannot correct error introduced by
  the `* 100` scaling.
- Earlier entry: 1984 passed / 1987 total across 184 suites (3 skipped), as of 2026-08-13.
  `computeShippingTotal` — the repo's single source of truth for shipping-fee math — had no
  direct unit test; it was only exercised inside integration tests that computed the expected
  value with the same function, making a self-consistent bug invisible. `src/lib/shipping-utils.test.ts`
  pins all three methods and the edge cases with hand-computed constants (+8 tests, +1 suite).
- Earlier entry: 1976 passed / 1979 total across 183 suites (3 skipped), as of 2026-08-12.
  `getProducts` used to drop a `store` / `category` / `subCategory` / `offer` filter whose URL
  resolved to no row, turning "no such category" into "show the whole catalog"; it now returns
  an empty result (+5 tests, no new suite). This also removes a false-green path in
  `tests/e2e/search-filter.spec.ts`, which rendered the full catalog whenever the E2E seed was
  missing.
- Earlier entry: 1970 passed / 1973 total across 183 suites (3 skipped), as of 2026-08-12.
  URL numeric-param normalization was consolidated into `normalizePageParam` /
  `normalizePositiveIntParam` (`src/lib/utils.ts`) with a mandatory `MAX_PAGE` clamp, adding
  +28 tests to `src/lib/utils.test.ts` and a new suite
  `src/app/(store)/browse/page.test.tsx` (+8 tests, +1 suite) covering the canonical redirect
  for out-of-range pages. The clamp — not a stricter integer check — is what protects the
  query layer: `?page=1e15` passes `Number.isSafeInteger` yet still yields
  `skip = (page - 1) * pageSize = 1e16`, which exceeds Prisma's 32-bit `Int`.
- Earlier entry: 1934 passed / 1937 total across 182 suites (3 skipped), as of 2026-08-11.
  SonarCloud PR #173 reported 0.0% coverage on new code for
  `src/components/store/browse-page/browse-pagination.tsx` (11 uncovered lines, 2 uncovered
  conditions); `tests/component/store/browse-pagination.test.tsx` closes it with +6 tests
  (+1 suite). The two conditions are the `typeof next === "function"` split — the shared
  pager calls `setPage(i + 1)` for numbered pages and `setPage(prev => prev ± 1)` for
  Previous/Next, so both call shapes are needed to cover the branch.
- Playwright E2E: 64 tests/browser across 29 files (192 across the three browsers), as of 2026-08-31.
  Plan 065 fixed the product-detail layout defect described in the entry below, and the
  remainder of plan 054 then added `tests/e2e/visual/product.spec.ts` (+1 test/browser; VRT is
  chromium-only, so the other two projects skip it), bringing visual regression coverage to
  cart, checkout, browse and product detail. The `devices["Desktop Chrome"]` viewport is
  1280x720 — exactly the width at which the purchase panel used to be clipped — so the spec
  doubles as a regression detector for that class of defect. Before comparing pixels it also
  asserts both horizontal edges of "Add to cart": its left edge is at least `0` and its right
  edge stays within `clientWidth`, so a panel pushed off either side of the viewport fails the
  spec. That closes the path where a baseline refresh silently freezes a broken layout again.
- Earlier entry: 63 tests/browser across 28 files (189 across the three browsers), as of 2026-08-23.
  Plan 054 added `tests/e2e/visual/browse.spec.ts` (+1 test/browser; VRT is chromium-only, so
  the other two projects skip it), bringing visual regression coverage to cart, checkout and
  browse. The product-detail baseline was deliberately **not** committed: the captured image
  showed the right-hand purchase panel — including the primary "Add to cart" button — clipped
  at a 1280px viewport. Measurement confirmed `scrollWidth === clientWidth === 1280`, so the
  document itself does not scroll horizontally; a parent container is cutting the panel off.
  A VRT baseline is a declaration of the intended appearance, so freezing that state would
  lock the defect in and make the eventual fix look like a test failure. The layout fix was
  **not yet filed as of 2026-08-23**, which is what this entry recorded at the time; it is
  **now tracked by `plans/065-fix-product-detail-right-panel-clipping.md`**. The
  product-detail baseline should be captured after that fix lands.
- Earlier entry: 62 tests/browser across 27 files (186 across the three browsers), as of 2026-08-23.
  Plan 049 added `tests/e2e/profile.spec.ts` (+2 tests/browser, +1 file) covering address
  creation through the form and an order appearing in the history, and it uncovered two real
  defects that the suite then pinned. First, `/profile/orders` failed to render at all:
  `orders-table.tsx` and `payments-table.tsx` are client components that receive Prisma
  `Decimal` props from a server component, and a `Decimal` loses its methods when it crosses
  the RSC boundary, so `order.total.toFixed(2)` and `payment.amount.toNumber()` threw
  (`TypeError: a.total.toFixed is not a function`). Both now go through the existing
  `toNumberSafe` helper. The reason unit tests never caught it is instructive: the existing
  payments test passed `amount: { toNumber: () => 1000 }`, a Decimal-shaped mock, so the
  serialized path was never exercised — the new detection tests pass a plain number and a
  plain string instead, and only the string form reproduces the failure since numbers already
  have `toFixed`. Second, the address form silently ignored a country with no matching row:
  `CountrySelector` renders a static ISO list while only DB `Country` rows can be saved, so an
  unmatched pick left `countryId` empty and surfaced a validation error that never mentioned
  the country. In E2E that happens every time, because the seed suffixes country names for
  parallel isolation, making it impossible to save an address through the UI at all.
- Earlier entry: 60 tests/browser across 26 files (180 across the three browsers), as of 2026-08-23.
  Plan 056 added `tests/e2e/newsletter.spec.ts` (+2 tests/browser, +1 file) as a characterization
  suite: `/api/newsletter` does not exist in the repo (no subscriber model in the schema either),
  so every subscription attempt fails with a "Failed to subscribe." toast. The contract is
  `response.ok() === false`, deliberately **not** `toBe(404)` — a 404 is not the durable
  proposition ("subscribing does not succeed") but an incidental mechanism ("the route file is
  missing"). Pinning 404 would keep the suite green through a routing regression that 404s every
  API, and would turn it red for a harmless change such as a catch-all returning 501.
  `not.toBe(200)` is likewise insufficient because it admits 201/202/204. The empty-email case
  proves a negative without a fixed wait: it waits on the `invalid` event, which fires only when
  constraint validation blocks a submit attempt, and only then asserts that no POST was recorded.
  `checkValidity()` cannot serve as that signal — it is a pure query that returns false before the
  click as well, so polling on it settles immediately and would misread a not-yet-dispatched POST
  as absent. When the route is implemented this suite fails by design and must be rewritten as a
  success-path test rather than skipped.
- Earlier entry: 58 tests/browser across 25 files (174 across the three browsers), as of 2026-08-12.
  Plan 055 added `tests/e2e/cart-login-handoff.spec.ts` (+1 test/browser, +1 file): a cart built
  as a guest survives sign-in and is persisted server-side by the Checkout button. The load-bearing
  detail is that step 5 reopens `/checkout` in a **fresh `browser.newContext()`**, not via
  `page.reload()` — a reload keeps the same localStorage, so Zustand rehydrates from the client and
  the test would stay green even if `saveUserCart` wrote nothing to the database. The spec also
  asserts that `localStorage.getItem("cart")` is empty in that fresh context, so the premise is
  pinned by a check rather than by a comment. Amounts are deliberately not asserted: `saveUserCart`
  is plan 005's correctness target, so the assertions stay at "the item is present".
  Plan 053 added `tests/e2e/auth-surface.spec.ts` (+3 tests/browser, +1 file): the Clerk sign-up
  widget renders, the header Register link reaches `/sign-up`, and sign-out returns the guest
  chrome. Only the sign-out test needs `CLERK_SECRET_KEY`; the two guest tests always run. Two
  locator facts generalize beyond this spec: `<UserMenu />` is rendered **twice** in the header
  (mobile `lg:hidden` and desktop `hidden lg:flex`), so a text match alone is a strict-mode
  violation — filter on `visible: true`; and opening the hover dropdown requires
  `hover({ force: true })`, because the panel is `absolute … top-0` and covers its own trigger
  once open, so Playwright's pointer-event check never passes (measured with
  `document.elementFromPoint` before and after moving the mouse). The failure surfaces as
  "waiting for element to be visible and stable" even though the layout is provably static.
  The CodeRabbit review round added 7 tests (`tests/component/store/categories-menu.test.tsx`
  +6, `product-sort.test.tsx` +1) with no new suites; the remaining delta from the previous
  entry (1895 / 178 suites) is the unsynced count of those two suites, added in `879763a0`.
  Integration tests are excluded from the default `bun run test` run
  (`jest.config.js` `testPathIgnorePatterns`), so branches covered only there never reach
  `coverage/lcov.info` and SonarCloud reports them as uncovered New Code. Every new branch
  therefore also needs at least one unit-level test (2026-08-08: the non-USD rejection in
  `src/app/api/webhooks/stripe/route.ts`, +1 test, no new suite).
  Plan 026 took `src/queries/paypal.test.ts` from 40 to 56 tests (+16, no new suite) and
  `paypal.ts` from 72.05% branch coverage to 91.91%, with statements, lines and functions at
  100%. The plan's stated baseline (17 tests / 28.6% branches) was already stale — plan 059's
  capture verification had grown the file — so the case table was kept but the numeric target
  was re-derived from a fresh measurement. Because both entry points share
  `requirePayPalUser` / `findOwnedPayPalOrder`, the branch bodies are driven through
  `createPayPalPayment` and the capture side only checks that the log prefix switches.
  These are characterization tests: they pin the current three-argument `console.error` shape,
  which does **not** match the two-argument structured-logging convention in
  `.claude/steering/tech.md`, and `paypal.ts` itself is unchanged.
  Plan 029 took `src/queries/profile.test.ts` from 34 to 63 tests (+29, no new suite) and
  `profile.ts` from 67.81% branch coverage (59/87) to 100% (87/87). The gap was the two
  try/catch sites in each of the five query functions — `currentUser` and the DB fetch, each
  splitting on `instanceof Error` — plus the period filter in `getUserOrders` /
  `getUserPayments` / `getUserReviews`. The existing period test asserted only
  `gte: expect.any(Date)`, which cannot tell last-6-months from last-2-years; the new ones
  pin a fixed clock and compare against `subMonths` / `subYears` directly.
  Plan 028 added `src/queries/country.test.ts` (+4 tests / +1 suite), closing the last
  server-action module that had no unit test — `ls src/queries/*.test.ts | wc -l` now equals
  the 20 implementation modules, restoring the CLAUDE.md invariant that every server action is
  unit-tested. The 2026-08-03 entry (1841 / 1844 across 177 suites) itself corrected a 12-test
  drift that predated plans 042 / 051.
- Playwright E2E: 50 tests per browser across 21 files (150 total over chromium/firefox/webkit),
  as of 2026-08-09. **50 is the runtime count** (what `bunx playwright test` actually executes);
  `docs/coverage-dashboard.html` reports **47** for the same tree (e2e 37 + a11y 7 + visual 3)
  because it is a *static* filesystem scan counting `test(` declaration sites and cannot expand
  loops — `tests/e2e/layout-chrome.spec.ts` declares 5 but runs 7 (`for (const path of
  chromePages)` wraps one `test()`), and `tests/e2e/security-headers.spec.ts` declares 1 but
  runs 2, so 47 + 3 = 50. The two numbers are different *units*, not a drift; always state which
  one is meant rather than reconciling them to a single value. The 21-file total spans all
  categories (12 main E2E + 7 a11y + 2 visual). Up 3 from the a11y specs
  `tests/e2e/a11y/{browse,product,cart}.spec.ts`
  (plan 052, WCAG 2.1 AA scans of the guest storefront). All a11y specs are gated to chromium,
  so the firefox/webkit copies are skipped by design. The first scan surfaced real violations
  (3 critical, 2 serious) in `sort.tsx`, `quantity-selector.tsx` and `categories-menu.tsx`,
  which were fixed in the same change set; the suite is 7 passed on chromium.
  The previous total was 47 per browser across 18 files (141 total), as of 2026-08-09 —
  up 6 from `tests/e2e/guest-flows.spec.ts` (plan 045, guest journeys:
  compare / track-order / offers / static pages). The spec needs no Clerk session, so it runs
  regardless of the auth-dependent suites' state; measured 6 passed on chromium and 18 passed
  across the three browsers with zero flakes.
  The previous total was 41 per browser across 17 files (123 total), as of 2026-08-03 — up 2
  from `tests/e2e/country-selector.spec.ts` (plan 051, Ship-to cookie round-trip). One of the two is gated off on WebKit, which drops `Secure` cookies on insecure
  origins while local E2E serves the production build over http.
- Plan 047 (2026-08-03) did not change that total: un-skipping a declared test moves it from
  skipped to active without adding a case. What changed is the split — `payment-error.spec.ts`
  now runs the "place order without a shipping address" check on all three browsers, and
  `platform-coupon.spec.ts` asserts the order-detail amount breakdown (per-group
  `subtotal + shipping - discount === total` and `Σ group totals === order total`, compared as
  cent integers with no tolerance). Measured across three browsers with
  `scripts/e2e/run-local.sh`: 9 passed / 6 skipped / 0 failed / 0 flaky.
- Order-flow specs must not call `waitForPostSignInSettle` before navigating. Doing so makes the
  next `page.goto` hang without ever issuing a request (measured: three consecutive 2-minute
  timeouts while the same URL answered in 0.5–1.5s from curl). `gotoStable` stays: Firefox
  aborts the goto with `NS_BINDING_ABORTED` when the post-sign-in soft redirect interrupts it.
- Plans 044 / 042 closed on 2026-08-04. Plan 047 had removed the settle wait from two specs but
  `stock-decrement.spec.ts` still carried it; removing that last site took the spec from a
  120s hang to 7.3s. First clean full run since the sign-in drift was introduced:
  **83 passed / 3 failed / 37 skipped / 0 flaky in 5.8 minutes** (`scripts/e2e/run-local.sh`,
  three browsers). The 3 failures are the stale visual baselines owned by plan 043 — no
  authentication failure remains. Wall-clock fell from the 25.5-minute baseline because the
  hang no longer burns the per-goto budget times two retries. `globalTimeout` is now 3600s
  (plan 044): the old 1200s could not hold a run with retries and truncated 3 tests as
  "did not run", which silently shrinks the measured denominator.
- Plan 043 closed on 2026-08-04, taking the full run to **83 passed / 0 failed / 3 flaky /
  37 skipped in 7.4 minutes**. The cart baselines were stale exactly as planned (the old ones
  were 720px tall, shot on a dev server before the footer rendered, Next's dev indicator baked
  in). The checkout baseline was **not** stale: Clerk renders client-side, so at capture time
  the page body was still empty, and `toHaveScreenshot`'s stability rule — two shots 100ms
  apart that match — accepts an empty page as stable (three runs produced byte-identical
  actuals). Re-baselining that would freeze a screenshot that cannot detect sign-in UI changes
  and would go permanently red on a machine fast enough to paint in time, so the spec now waits
  on a render anchor (`.cl-signIn-root` + a visible `input[name="password"]`, the same anchor
  `tests/e2e/helpers/auth.ts` uses) before capturing. The 3 flaky tests
  (payment-error@chromium, platform-coupon@firefox, layout-chrome@webkit) all passed on retry
  and are unrelated to VRT.
- Earlier entry (2026-08-01): 1829 passed / 1832 total across 177 suites (3 skipped).
  Three regressions from the CodeRabbit review round, twelfth pass (+3, no new suites).
  `scan-tests.test.ts` 21→24 (the scanner treated the contents of string literals, template
  literals and comments as code. A file that carries scanned-source **as fixture strings** inflated
  to a multiple of its real size — `scan-tests.test.ts` itself reported **81 on the dashboard
  against 21 at runtime**, and `hasSkip` was a false positive from the same source. `findMaskedSpans`
  now enumerates the non-code ranges once per file and `BLOCK_PATTERN` / `EACH_PATTERN` /
  `SKIP_PATTERN` discard any match landing inside one. **The literals are not stripped** — the title
  in `it("title", fn)` *is* a string literal, so stripping would destroy the declaration itself;
  the test is on the match position. Dashboard corrections: `scan-tests.test.ts` **81→24** and
  `size.test.ts` **9→8** (the latter had a **commented-out** `it(` at `:144` counted as a
  declaration). No other file's `testCount` or `hasSkip` moved).
  **Two figures in the eleventh-pass entry are corrected here.** `webhooks/route.test.ts` was
  **19→20, not 20→21** — the raw `it(` count is 15 at `4e4534d1` and 16 at `5c1ec584`, and the
  runtime figure including `it.each` expansion goes 19→20. The **+1 delta was right; both absolute
  values were one too high**. `scan-tests.test.ts` 17→21 is correct as a runtime figure, but the
  dashboard read **81** at that moment, so the entry and the generated artifact disagreed; the
  twelfth pass closes that split at its source.
- 1826 passed / 1829 total across 177 suites (3 skipped), as of 2026-08-01.
  Seven regressions from the CodeRabbit review round, eleventh pass (+7, no new suites).
  `webhooks/route.test.ts` 19→20 (`user.deleted` validated `rawUserId.trim() === ""` but bound the
  **untrimmed** value as the filter key, so `"  user_x  "` passed validation and the SupportTicket
  PII redaction plus the delete both matched **zero rows while returning 200** — the GDPR erasure
  silently no-opped).
  `paypal.test.ts` 30→32 (the capture correlation check was written as
  `purchase_units[0].custom_id ?? capture?.custom_id`; `??` short-circuits on the first non-nullish
  value, so once the outer id matched `orderId` the capture-level id was **never examined**. The
  capture object is what represents the actual movement of money, so a response correlated to the
  caller's order on the outside and to a different order on the inside reached the Paid write.
  Now every present `custom_id` must match; a separate test pins that either location may still
  carry it).
  `scan-tests.test.ts` 17→21 (`it.each(<identifier>)` counted as 0 — the same defect class as the
  `it.each([...])` undercount fixed in `c1be6d7`, but for tables lifted into a named constant.
  Same-file `const` and single-hop `@/` / relative imports now resolve; anything else stays at 0, so
  **identifier resolution** never over-counts. `order-settlement.test.ts` moves from 6 to
  **14 cases** on the dashboard, matching its runtime value. Note the original wording here —
  "the scanner never over-counts" — was too broad and was **disproved by this file's own entry**:
  the fail-safe covers unresolved identifiers only, and a separate path (string literals read as
  code) was over-counting by 60 on `scan-tests.test.ts` at the very moment this was written.
  Closed in the twelfth pass above).
- 1819 passed / 1822 total across 177 suites (3 skipped), as of 2026-08-01.
  Sixteen regressions from the SonarCloud duplication cleanup (+16, **one new suite**).
  `src/lib/order-settlement.test.ts` is new (14): `hasOrderSettledAfterConflict` was extracted from
  the identical P2025 re-read blocks in `stripe.ts` and `paypal.ts`. Its `catch (reReadError)` arm
  had **no test at either origin** — both P2025 tests drive the re-read with `mockResolvedValue`
  only — and `src/lib/**` is excluded from neither `collectCoverageFrom` nor
  `sonar.coverage.exclusions`, so an uncovered arm in a small new file would breach the
  `new_coverage >= 80%` gate. The suite drives settled/unsettled statuses (expanded from
  `SETTLED_PAYMENT_STATUSES` so the SSOT is not duplicated), a missing order, the query shape
  (deliberately not filtered by `userId`), and both the `Error` and non-`Error` re-read failures.
  New-file coverage: 100% statements / branches / functions / lines.
  `user.test.ts` 68→70 (ITEM shipping fee did not clamp the additional-item count, so
  `validQuantity === 0` — an out-of-stock size, or a tampered `quantity: 0` payload — computed
  `fee + extra * (0 - 1)` = a **negative shipping fee** that propagated into `Cart.total` via
  `saveUserCart` and into `OrderItem.shippingFee` / `OrderGroup` totals via `placeOrder`. Both
  paths were pinned Red at `shippingFee: "7"` before `Math.max(0, quantity - 1)` made them Green).
- 1803 passed / 1806 total across 176 suites (3 skipped), as of 2026-07-31.
  Two regressions from the CodeRabbit review round, ninth pass (+2, no new suites).
  `paypal.test.ts` 27→29 (retrieve and capture shared a single 10s timer / `AbortController`,
  so a slow retrieve could abort the capture mid-flight, and `clearTimeout` ran only after a
  successful capture — the verification-mismatch throws leaked the timer. The rows assert the two
  `fetch` calls receive **distinct `signal` instances** and that the retrieve-side mismatch path
  still releases its timer).
  `user.test.ts` stays at 67 — closing the shipping-address ownership race replaced the existing
  TOCTOU assertions rather than adding to them: `tx.shippingAddress.findFirst` (a plain SELECT
  that takes no row lock) became `$queryRaw` + `SELECT … FOR UPDATE`, so the test now pins that
  the locking read happens before `order.create` and that an empty result throws
  `"Shipping address not found."` without creating an order.
- 1799 passed / 1802 total across 176 suites (3 skipped), as of 2026-07-30.
  Nine regressions from the CodeRabbit review round, eighth pass (+9, no new suites).
  `db-retry.test.ts` 16→19 (an `it.each` of two rows — `2 ** 48` and `Number.MAX_SAFE_INTEGER` —
  plus one backoff-ceiling case. The seventh pass clamped *non-finite* values but let a **finite**
  huge one through untouched, since `Math.floor` never shrinks a value. `randomInt` requires
  `max - min < 2 ** 48`, so the same defect class survived: the throw came *from inside the catch
  block* as `ERR_OUT_OF_RANGE` and replaced the P2034. The rows assert the error is still a
  `PrismaClientKnownRequestError`, i.e. that it was not transmuted).
  `stripe.test.ts` 39→41 (observing the same canceled intent twice must derive the **same**
  recreate idempotency key — the previous `randomUUID()` suffix made every call unique, so
  double-submit protection vanished precisely after a cancellation was observed; and once the
  recreate ceiling is hit the action must throw rather than persist a canceled intent id).
  `paypal.test.ts` 23→27 (`GET /v2/checkout/orders/{id}` must run **before** capture: a mismatched
  `custom_id`, `amount`, or `currency_code` each throws with the capture URL never requested, and
  the happy path pins the GET→POST ordering. Verifying after capture meant the money had already
  moved by the time the check failed).
- 1790 passed / 1793 total across 176 suites (3 skipped), as of 2026-07-30.
  Four regressions from the CodeRabbit review round, seventh pass (+4, no new suites).
  `db-retry.test.ts` 13→16 (an `it.each` of three rows: a fractional / `NaN` / negative
  `baseDelayMs` must still surface the P2034. `randomInt` only accepts integers, so a fractional
  value threw `ERR_INVALID_ARG_TYPE` *from inside the catch block* and replaced the P2034 every
  downstream `isSerializationFailure` check looks for; the rows also assert the operation ran
  `maxAttempts` times, which is what proves the jitter path was reached at all).
  `paypal.test.ts` 22→23 (a P2025 whose re-read shows an unsettled order must not be normalized to
  "already settled" — the PayPal counterpart of the stripe.ts fix landed at 1749; the
  concurrent-capture case now models both `findUnique` calls instead of leaving the re-read
  unexercised).
- 1786 passed / 1789 total across 176 suites (3 skipped), as of 2026-07-30.
  Seventeen regressions from the CodeRabbit review round, sixth pass (+17, **no new suites** — every
  case landed in a file that already existed). `webhooks/route.test.ts` 15→19 (an `it.each` of four
  rows: `user.deleted` with a missing / empty / whitespace-only / non-string `id` must return 400
  **and never open the transaction** — an unvalidated `undefined` reaches Prisma as
  `where: { userId: undefined }`, which it reads as *no filter*, redacting every SupportTicket and
  deleting every User). `db-retry.test.ts` 8→13 (an `it.each` of four rows plus one single case:
  `maxAttempts` of `0` / negative / `NaN` / fractional must still run the operation once instead of
  `throw undefined`, which broke every downstream `instanceof Error` guard). `admin/coupons/
  columns.test.tsx` 20→25 (the admin edit modal's `getCouponAsAdmin` rejection path — the seller
  variant already had try/catch + destructive toast + `setClose()`; only admin was missing it).
  `scan-tests.test.ts` 15→17 (declaration-form `test.skip('title', fn)` counts, in-body annotation
  `test.skip(cond, reason)` does not). `coupon.test.ts` 95→96 (`toggleCouponActive`'s
  `'Coupon not found.'` re-anchored to exact match and passed through `isDomainError`).
- 1769 passed / 1772 total across 176 suites (3 skipped), as of 2026-07-28.
  Eight regressions from the CodeRabbit review round, fifth pass (+8, +1 suite):
  `coupons/columns.test.tsx` (+7, **new suite**) covers the seller coupon edit modal, whose
  `setOpen` fetch callback let a `getCoupon` rejection escape unhandled — the modal-provider's
  fire-and-forget IIFE only logged it, so the user saw no notification and the modal stayed open
  on an unverified row snapshot; the suite pins the toast, the `setClose()`, and the structured log.
  `scan-tests.test.ts` (+1) pins that modifier-prefixed `it.skip.each` / `test.only.each` expand to
  their table row counts — both `BLOCK_PATTERN` and `EACH_PATTERN` missed them, leaving 4 of 5
  fixture cases invisible to the dashboard scanner. `coupon.test.ts` gained no cases: its five
  existing `Please provide coupon ID.` assertions were substring matches that passed while the
  `catch` rewrote the message, and were re-anchored to exact match.
- 1761 passed / 1764 total across 175 suites (3 skipped), as of 2026-07-27.
  Seven regressions from the CodeRabbit review round, fourth pass (+7, no new suites):
  `coupon.test.ts` (+4) anchors the *exact* message of validation and duplicate-code failures —
  the pre-existing assertions used `toThrow(string)`, whose substring match passed even while the
  `catch` rewrote them to `Error occurred while trying to upsert coupon: …`, so the form could
  never surface `クーポンの入力値が不正です。`; one case also pins that a user input mistake emits
  no `logError`. `scan-tests.test.ts` (+3) pins that modifier-suffixed tests (`test.skip` etc.)
  count toward `testCount`, plus two guards against over-counting once modifiers are allowed
  (`test.describe` / `test.describe.skip` stay excluded as wrappers; `it.each` is not
  double-counted against the `EACH_PATTERN` expansion).
- 1754 passed / 1757 total across 175 suites (3 skipped), as of 2026-07-26.
  Two regressions from the CodeRabbit review round, third pass (+2, no new suites):
  `stripe.test.ts` pins that a canceled PaymentIntent returned by the fixed idempotency key is
  recreated under a fresh key, and that non-canceled statuses are *not* recreated — without the
  first, an order stays permanently unpayable at that amount once its intent is canceled.
- 1752 passed / 1755 total across 175 suites (3 skipped), as of 2026-07-26.
  Three regressions from the CodeRabbit review round, second pass (+3, no new suites):
  `useCartStore.test.ts` gains a `persist ラウンドトリップ` block that discards the in-memory
  state before `persist.rehydrate()`, so the restored cart can only have come from storage —
  plan 005's headline claim ("a persisted cart survives a reload") had no test until now.
- 1749 passed / 1752 total across 175 suites (3 skipped), as of 2026-07-26.
  One regression from the CodeRabbit review round, second pass (+1, no new suites):
  `stripe.test.ts` pins that a P2025 is only normalized to "already settled" when a re-read
  confirms it — the normalization used to cover the whole `$transaction`, so a concurrent order
  delete or a vanished `paymentDetails.connect` target was misreported as a completed payment.
- 1748 passed / 1751 total across 175 suites (3 skipped), as of 2026-07-26.
  Two regressions from the CodeRabbit review round (+2, no new suites): `coupon.test.ts` pins
  rejection of a fractional `discount` on both the seller and admin upsert paths, matching the
  `.int()` added to `CouponFormSchema.discount` (the value reached the `Int` column before).
- 1746 passed / 1749 total across 175 suites (3 skipped), as of 2026-07-24.
  That is **+8 against the 1738 measured on 2026-07-18**, of which **+2 are the intentional
  security regressions** from the CodeRabbit local review, doc/code round (no new suites):
  `user.test.ts` pins the placeOrder shipping-address ownership TOCTOU (re-validate inside the
  order tx), and `webhooks/route.test.ts` pins the SupportTicket PII redaction on user deletion.
  The remaining +6 is measurement drift between the two runs, not new deliberate coverage — see
  the note in [`QA_HANDOFF.md`](../../docs/testing/QA_HANDOFF.md) (the SSOT for these figures).
- 1738 passed / 1741 total across 175 suites (3 skipped), as of 2026-07-18.
  Nineteen regressions from the CodeRabbit local review, Phase 1 (+19, one new suite).
  `src/lib/db-retry.test.ts` is the new suite (+8): `saveUserCart` declared
  `isolationLevel: Serializable` without any retry, which only converts a P2002/P2025 conflict into
  a P2034 one — the legitimate concurrent request still fails. `retryOnSerializationFailure` retries
  P2034 with exponential backoff and jitter, and the tests pin that non-P2034 errors are rethrown on
  the first attempt (retrying a unique-constraint violation only repeats the same failure).
  `stripe.test.ts` (+6) covers two payment defects: the idempotency tests require a deterministic
  key derived from order id **and** amount, because Stripe rejects a reused key carrying different
  parameters — keying on the order alone would permanently block payment after a legitimate total
  change (coupon). The CAS tests require `PaymentDetails` and `Order` to be updated inside one
  transaction with `paymentStatus: { notIn: SETTLED }` in the `where`: the previous read-then-act
  let the Stripe webhook write `Paid` between the guard's read and the action's write, regressing a
  settled order to `Pending`. `user.test.ts` (+2) asserts the retry is wired through the real
  transaction. `place-order.test.tsx` (+1) requires navigation to survive a throwing `emptyCart()`
  — the store is persisted, so the synchronous call can still throw on a storage failure, and an
  unguarded throw left the user with a placed order, an error toast, no navigation, and a
  permanently disabled button. `scan-tests.test.ts` (+2) pins `it.each([])` to zero cases; the
  scanner's opening-bracket branch set `hasContent`, inflating an empty table to one.
- 1719 passed / 1722 total across 174 suites (3 skipped), as of 2026-07-18.
  Two security regressions from plan 062 (+2, no new suites). `index-products/route.test.ts` (+2)
  pins both handlers' 500 branch to a fixed `{ error: "Internal Server Error" }` body: the previous
  `catch (error: any)` returned raw `error.message`, exposing internal detail (DB driver text,
  connection host/port) to unauthenticated clients. The tests reach the outer catch by rejecting the
  mocked `db.product.findMany` twice — the fallback `contains` query inside the inner catch is not
  itself wrapped, so the second rejection propagates. A new Playwright spec
  `tests/e2e/security-headers.spec.ts` (2 tests × 3 browsers) asserts the exact values of the five
  response-hardening headers added by plan 061 on `/` and `/checkout`; asserting values rather than
  header names is what catches a weakened setting (e.g. `SAMEORIGIN` → `ALLOWALL`).
- 1717 passed / 1720 total across 174 suites (3 skipped), as of 2026-07-18.
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
- 117 integration tests across 14 suites
  (adds `tests/integration/category-tree-migration.test.ts` 9), as of 2026-08-31, measured 117/117 pass.
  Covers the category tree Phase A data move (plan 066 / V-3, V-4): root path/depth normalisation,
  child adoption with id reuse, deterministic collision rename with alias rows coexisting under the
  `(entityType, oldSlug)` composite key, idempotency across two runs, `childCount` consistency, and
  the `Product.categoryNodeId` backfill. The suite reads the `PHASE_A_DATA_MOVE` marker section out
  of the migration file itself rather than restating the SQL, so the migration stays the single
  source of truth.
- Earlier entry: 108 integration tests across 13 suites
  (adds `tests/integration/product-browse.test.ts` 16; `store-status.test.ts` 8 → 9 for the
  concurrent PENDING → BANNED / PENDING → ACTIVE transition), as of 2026-08-24,
  measured 108/108 pass.
  Plan 039 pinned `getProducts`, the query behind `/browse` (91 -> 107; suites 12 -> 13), and
  found a real defect while doing so. With no upper bound the query passed
  `lte: filters.maxPrice || Infinity`, and Prisma cannot put `Infinity` on a Decimal column —
  the value drops during serialization and the query throws "Argument `lte` is missing."
  (measured on Prisma 5.22.0), so any price filter with only a minimum failed outright. The
  storefront never showed this because `browse/page.tsx` defaults `maxPrice` to
  `Number.MAX_SAFE_INTEGER`; callers that go straight to `getProducts` do hit it. The fix
  (`f1be1aa0`, operator-approved) simply omits `lte` when there is no maximum.
  The suite's Arrange pins every value an assertion depends on. `views` and `createdAt` are
  set to distinct values because the default `orderBy` is `views desc` and freshly seeded rows
  all share `views: 0` — PostgreSQL does not guarantee an order among equal rows, so the
  pagination assertions would otherwise depend on physical row order and flake. Every size's
  `price` and `discount` is set explicitly too: filters read the raw `price` through `some`
  (one matching size pulls in the whole product), while the price sorts read the discounted
  price, so leaving `discount` to the schema default would let a default change silently
  reorder results. Two departures from the plan text: its scenario 2 asks to characterize
  fail-open URL filters, but that was already fixed to fail-closed in `cce53407`, so the
  expectation was inverted as the plan itself prescribed (and the store/offer paths pinned
  alongside); and its claim that no Clerk mock is needed does not hold — `getProducts` never
  calls `currentUser`, but the module imports Clerk, so without the mock jest fails to parse
  `@clerk/backend`'s ESM at load time.
- Earlier entry: 91 integration tests across 12 suites
  (adds `tests/integration/product-update.test.ts` 5), as of 2026-08-23, measured 91/91 pass.
  Plan 038 pinned the seller product-edit flow (86 -> 91; suites 11 -> 12).
  `handleProductAndVariantUpdate` replaces specs, questions, free-shipping rows, images,
  colors and sizes wholesale (deleteMany then createMany) inside one `$transaction`, and the
  most consequential thing that falls out of that is what it does to shoppers' saved state:
  because every edit mints new `Size` rows, `Wishlist.sizeId` (a real FK with ON DELETE SET
  NULL) becomes null, while `CartItem.sizeId` — a plain string with no FK — keeps pointing at
  a row that no longer exists, which is the precondition for checkout's re-validation to
  reject the line. The atomicity scenario must inject its failure **late** in the transaction:
  failing at the first statement (`product.update`) means the replacements never ran at all,
  so surviving old rows prove nothing and the test would pass even without a transaction. The
  suite therefore fails only the final statement via a temporary CHECK constraint and treats
  the **preserved old `Size.id`** as the proof, since a replacement that actually executed
  would have minted a new id. The temporary DDL drops with `IF EXISTS` both before the ADD
  (idempotent recovery from a leaked constraint) and in the `finally` — a bare DROP there
  throws its own "constraint does not exist" error on the path where the ADD failed, masking
  the real cause. The CI serialization requirement is already met by `maxWorkers: 1` plus a
  per-run testcontainers database (ADR-004), so no workflow change was needed.
- Earlier entry: 86 integration tests across 11 suites
  (`tests/integration/cart-checkout.test.ts` 11 +
  `tests/integration/order-placement.test.ts` 9 +
  `tests/integration/order-lifecycle.test.ts` 8 +
  `tests/integration/webhook-payment.test.ts` 12 +
  `tests/integration/search-products.test.ts` 9 +
  `tests/integration/product-deletion.test.ts` 4 +
  `tests/integration/shipping-address-default.test.ts` 6 +
  `tests/integration/user-deletion-webhook.test.ts` 7 +
  `tests/integration/coupon-code-uniqueness.test.ts` 5 +
  `tests/integration/review-aggregation.test.ts` 7 +
  `tests/integration/store-status.test.ts` 8) as of 2026-08-23,
  measured 86/86 pass.
  Plan 035 added the store-status suite (78 → 86; suites 10 → 11), closing the R5 round.
  `updateStoreStatus` promotes the store owner from USER to SELLER, so its transition
  condition is a permission boundary: the DB promotion fires only for PENDING → ACTIVE,
  while the Clerk metadata sync fires whenever the *result* is ACTIVE, without looking at
  the origin status. Because authorization reads Clerk's `privateMetadata.role`
  (`src/lib/auth-guards.ts`) rather than the DB column, a DISABLED/BANNED → ACTIVE
  transition grants seller access while the DB still says USER. That scenario was originally
  pinned as a `TODO(characterization)` — a known-bug fixture to be inverted, not a contract.
  **That description is history: the bug was fixed in `7a56c93d`**, which gates the Clerk
  sync on the owner actually being `SELLER` in the DB rather than on the resulting status
  alone. Scenario 3 (`DISABLED → ACTIVE`) has since had its expectation inverted and now
  asserts `mockUpdateUserMetadata` is **not** called, so it reads as a **regression guard**
  against the privilege escalation rather than as a characterization of it.
  The suite's load-bearing case is transactional atomicity: scenarios 1–4 only show that
  both writes succeeded, so the single-`$transaction` claim is proven by failing the
  second write deterministically (a temporary CHECK constraint blocking `role = 'SELLER'`)
  and observing the status update roll back. Deleting the owner cannot serve as the
  injection point — `Store.user` has no `onDelete`, so the implicit `Restrict` rejects the
  delete — and the shared real-DB singleton rules out spying on `tx.user.update`. Since
  `resetDb` truncates rows but does not drop table constraints, the DDL is dropped in a
  `finally` and the cleanup is verified by running the file twice in a row.
  Plan 034 added the review-aggregation suite (71 → 76; suites 9 → 10). A product's
  `rating` / `numReviews` are recomputed by re-reading every review on each submission,
  and the fully mocked unit tests can only pin the call structure — whether a repeat
  submission by the same user becomes an update rather than a create, and whether the
  average is actually derived from stored rows, are unobservable without a real database.
  The suite also covers the User fallback upsert (on-demand DB user creation when the
  Clerk webhook missed a sync). The aggregation used to run as three separate round trips
  (create → findMany → `product.update`), which could lose an update under concurrent
  submissions; it is now a single `$transaction` serialized by a `SELECT … FOR UPDATE` on
  the `Product` row, taken *before* the review write. Two concurrency scenarios were added
  (+2): same-user double submit must not inflate the row count, and contending submissions
  from distinct users must all succeed without deadlock or tx timeout. Note what each
  scenario can actually prove — the multi-user one **stays green against the pre-fix
  implementation** (identical call sequences stay phase-locked on a uniform-latency local
  DB, so every caller reads the correct count by accident), so the deterministic guard for
  the lost update is the wiring assertion in `src/queries/review.test.ts`
  ("集計の原子性"), not the integration test.
  Plan 041 added the coupon-code global-uniqueness suite (66 → 71; suites 8 → 9).
  `Coupon.code` is globally unique, but the seller-path pre-check only searches within the
  caller's own store — so a code already taken by another store or by a PLATFORM coupon
  reaches the real unique constraint. No concurrency is needed to open that gap: once the
  colliding row is committed, the pre-check passes and the *next* insert fails on the
  constraint every time. Two stores concurrently creating an as-yet-unused "SUMMER10" is a
  different case — one insert wins and the other gets P2002 — and the suite does not cover
  it (every scenario seeds the colliding row up front and then calls once). It asserts only
  externally observable
  invariants (rejected + existing row untouched + row count unchanged) because the
  pre-check and the P2002 fallback throw the *same* message, so a test cannot tell the
  paths apart from the message — and a test-side re-query would keep passing even if the
  P2002 path stopped executing entirely.
  Earlier entry: 66 integration tests across 8 suites as of 2026-08-09,
  measured 66/66 pass. Plan 064 fixed TESTS-21 and turned the shipping-address
  characterization into a regression guard (overall 57 / 7 suites → 64 / 8 → 66 / 8; plan 064's
  own step is 64 → 66 with suites unchanged at 8) — see below.
  Plan 040 added the Clerk `user.deleted` FK suite
  (57 → 64; suites 7 → 8), pinning all three FK behaviours that a mocked
  `deleteMany` cannot reach: CASCADE (cart, wishlist, conversation, message and
  both implicit M2M join tables), RESTRICT (order / review / address / store —
  the deletion fails permanently and the user's PII stays in the database; a
  characterization, not an endorsement), and SET NULL with PII redaction on
  `SupportTicket` (a positive guarantee, landed in `7e3e507`). Plan 037 added the shipping-address default-flag suite
  (53 → 57; suites 6 → 7), pinning the asymmetry between the update path (which
  cleared other defaults) and the create path (which skipped the clear, leaving two
  defaults) — the latter as a characterization of the known gap TESTS-21, tagged
  `TODO(characterization)`. **Plan 064 fixed that gap and flipped the expectation to 1**
  (57 → 66 with plan 040's suite in between, which took suites 7 → 8; plan 064's own
  64 → 66 left suites unchanged at 8), so the file is now a
  regression guard rather than a record of a bug. The suite additionally pins two
  properties that the fix depends on: the clear is rolled back with the failing
  `create` when an attacker submits another user's address id (proving the write is
  atomic — the victim-side assertion alone passes on `userId` scoping without a
  transaction), and a second default written *around* the server action is rejected by
  the partial unique index `ShippingAddress("userId") WHERE "default"`. Plan 036
  added the `deleteProduct` FK suite (49 → 53;
  suites 5 → 6), pinning the CASCADE chain (nine child tables, including the
  grandchild `FreeShippingCountry`) and the `Review` RESTRICT that makes a
  reviewed product undeletable (P2003) — a characterization of current
  behaviour, not an endorsement of it. Plan 033 added the tsvector full-text
  search suite before that (40 → 49; suites 4 → 5); it is the first time the
  `$queryRaw` string behind `/api/search-products` is executed by any test —
  the unit suite mocks `@/lib/db` wholesale. Earlier, `a4d01b27` added the
  non-USD rejection scenario S8, 39 → 40, with the suite count unchanged.
  Run via `bun run test:integration` against a testcontainers-managed
  PostgreSQL (see ADR-004). Excluded from the default `bun run test` run via
  `testPathIgnorePatterns`. `order-placement.test.ts` exercises `placeOrder`
  (`src/queries/user.ts`) end-to-end with a real `$transaction`: per-store
  OrderGroup split, stock capping, store-scoped coupon discount, ownership
  (IDOR) guard, rollback on invalid product combinations, the atomic stock
  decrement amount, oversell rollback (stock stolen between validation and
  decrement — no partial commit), and PLATFORM coupon remainder absorption.
  `order-lifecycle.test.ts` covers the post-checkout side of the same
  inventory invariant (`src/queries/order.ts`): cancel/refund cascades to
  OrderGroup/OrderItem, restock restores the pre-order quantity, double
  cancellation restocks exactly once (sequential and concurrently dispatched),
  non-cancel transitions touch neither children nor stock, group-level
  cancellation restocks only that group while the parent status is
  re-aggregated, and both admin mutations reject non-admins without side
  effects. Note: only `updateOrderPaymentStatus` is CAS-guarded;
  `updateOrderGroupStatusAsAdmin` remains read-then-act, so its concurrent
  double-restock is unresolved (tracked in `plans/README.md` Deferred).
  `webhook-payment.test.ts` drives the Stripe and PayPal webhook route handlers
  against the real database (the unit suites mock `@/lib/db` entirely, so the
  idempotency machinery itself was never executed): first-event row creation,
  single-row invariant on sequential *and* concurrently dispatched redelivery,
  status transitions updating the same row, 404 without side effects, and
  `$transaction` rollback when the second write fails, and rejection of a
  non-USD Stripe event with 400 and no writes (S8). The provider-switch
  scenario was originally a characterization of a known gap (the upsert
  `update` branch carried no `amount`/`currency`); `c4a6fb41` fixed that
  branch and `607c2b88` flipped the expectation, so it now asserts that the
  row is updated to `Order.total` / `usd`. This file overrides
  `testEnvironment` to `node` via docblock because jsdom lacks the Fetch API
  `Request`/`Response` globals that Route Handlers require.
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

Covered scenarios (as of 2026-08-31):

| Spec | Test | Snapshot file |
|------|------|---------------|
| `cart.spec.ts` | 空カートの表示 | `cart-empty-chromium-<os>.png` |
| `cart.spec.ts` | 商品追加後のカート表示 | `cart-with-item-chromium-<os>.png` |
| `checkout.spec.ts` | 未認証リダイレクト | `checkout-redirect-signin-chromium-<os>.png` |
| `browse.spec.ts` | browse の商品グリッド表示 | `browse-grid-chromium-<os>.png` |
| `product.spec.ts` | 商品詳細の購入パネル表示 | `product-detail-chromium-<os>.png` |

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
# 全 spec のベースラインをまとめて stage する（browse / product / cart / checkout）
git add tests/e2e/visual/*.spec.ts-snapshots/
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
// src/lib/shipping-utils.test.ts
describe("computeShippingTotal", () => {
  it("rounds WEIGHT half-up at the decimal level", () => {
    // 0.15 × 1.45 × 10 is exactly 2.175 in decimal → half-up gives 2.18
    const result = computeShippingTotal("WEIGHT", 0.15, 0, 1.45, 10);
    expect(result).toBe(2.18);
  });
});
```

**Implementation**: intermediate math runs entirely on `Prisma.Decimal`
(`.add()` / `.mul()`), with a single `toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)`
at the end and `toNumber()` only at the return boundary — per the money rule in
[`.claude/steering/tech.md`](../../.claude/steering/tech.md).

> **Historical note**: the previous implementation accumulated in `number` and rounded with
> `Math.round((result + Number.EPSILON) * 100) / 100`. `Number.EPSILON` is an *absolute*
> constant sized for magnitudes near 1, so it cannot correct error introduced by the `* 100`
> scaling: the case above became `217.49999999999997` and returned 2.17.

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
