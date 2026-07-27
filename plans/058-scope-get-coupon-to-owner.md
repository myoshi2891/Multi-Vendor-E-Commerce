# Plan 058: Scope `getCoupon` to the caller's store (close cross-store coupon IDOR read)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> ```bash
> git diff --stat d2aff76 -- src/queries/coupon.ts src/queries/coupon.test.ts "src/app/dashboard/seller/stores/[storeUrl]/coupons/columns.tsx" src/app/dashboard/admin/coupons/columns.tsx
> git status --porcelain -- src/queries/coupon.ts
> ```
> Use `d2aff76` (not `d2aff76..HEAD`) so working-tree and staged changes are also seen.
> If any in-scope file changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `d2aff76`, 2026-07-17

## Why this matters

`getCoupon(couponId)` is a `'use server'` action (the file header at `src/queries/coupon.ts:1`
is `'use server'`, so every exported function is a directly-invocable server endpoint). It runs
`db.coupon.findUnique({ where: { id: couponId } })` with **no authentication, role, or ownership
check** — its JSDoc even mislabels it `@PermissionLevel Public`. Every sibling in the same file
(`getStoreCoupons`, `deleteCoupon`, `upsertCoupon`) enforces `requireStoreOwner`; this read is the
lone gap.

Because server actions are reachable POST endpoints, **any caller** — authenticated or not —
supplying an arbitrary `couponId` receives the full coupon row (`code`, `discount`, `storeId`,
dates) for **any store**: a cross-tenant IDOR read. Leaked discount codes can then be redeemed via
`applyCoupon` at checkout. Closing this makes coupon reads match the ownership contract the rest of
the module already enforces.

> **Do not scope the threat model to authenticated callers.** The middleware
> (`src/middleware.ts:6-13`) protects only `/dashboard*`, `/checkout` and `/profile*`. A server
> action is dispatched by its action id against **whatever route path the request targets**, so an
> attacker posts the id to a public path (`/`, `/browse`, …), never crosses a protected matcher, and
> the action runs. Sign-in is therefore not a precondition for this read, and "an authenticated user
> could see another store's coupons" understates both the reachable population and the severity.
>
> The general rule this instance illustrates: **route-level middleware is not an authorization
> control for server actions.** Every action carries its own authorization or it has none — which is
> exactly why `.claude/steering/tech.md` requires the `src/lib/auth-guards.ts` helpers inside each
> action rather than relying on where the action is rendered.

## Current state

- `src/queries/coupon.ts:1` — file header `'use server'` (all exports are server actions).
- `src/queries/coupon.ts:145-165` — the vulnerable function (load-bearing lines):

  ```ts
  /**
   * @Function getCoupon
   * @PermissionLevel Public          // ← stale/incorrect: this is the bug
   */
  export const getCoupon = async (couponId: string) => {
      try {
          if (!couponId) throw new Error('Please provide coupon ID.')
          const coupon = await db.coupon.findUnique({
              where: { id: couponId },   // ← no ownership scoping
          })
          return coupon
      } catch (error: unknown) {
          logError('[Coupon:getCoupon] failed to fetch coupon', error)
          throw new Error(
              `Error occurred while trying to fetch coupon: ${error instanceof Error ? error.message : String(error)}`
          )
      }
  }
  ```

- **Exemplar to copy — `deleteCoupon` (`src/queries/coupon.ts:177-203`)**, the canonical
  owner-scoped pattern in this file:

  ```ts
  export const deleteCoupon = async (couponId: string, storeURL: string) => {
      // 認可ガードは try/catch の外に置く（認可エラーを汎用 DB エラーで上書きしないため）
      const { store } = await requireStoreOwner(storeURL)
      try {
          if (!couponId) throw new Error('Please provide coupon ID.')
          const response = await db.coupon.delete({
              where: { id: couponId, storeId: store.id },   // ← scoped
          })
          return response === null ? false : true
      } catch (error: unknown) {
          logError('[Coupon:deleteCoupon] failed to delete coupon', error)
          throw new Error(`Error occurred while trying to delete coupon: ${error instanceof Error ? error.message : String(error)}`)
      }
  }
  ```

- **`requireStoreOwner` (`src/lib/auth-guards.ts:87-110`)** — signature
  `requireStoreOwner(storeUrl: string): Promise<{ user: User; store: Store }>`. Throws
  `"Forbidden: store not owned by current user."` when the store URL is not owned by the session
  user, `"Please provide store URL."` when the arg is empty. `requireAdmin(): Promise<User>`
  (`auth-guards.ts:53`) throws for non-admins.

- **Callers** (both are client components; they invoke the action):
  - Seller: `src/app/dashboard/seller/stores/[storeUrl]/coupons/columns.tsx:158` —
    `rowData: await getCoupon(coupon?.id)`. `params.storeUrl` is already in scope here (used at
    line 154 as `storeUrl={params.storeUrl}`).
  - Admin: `src/app/dashboard/admin/coupons/columns.tsx:150` — `rowData: await getCoupon(coupon.id)`.
    Admin coupons include PLATFORM coupons (`storeId = null`), so the admin path must **not** be
    store-scoped; it is gated by `requireAdmin()` instead.

### Repo conventions that apply here

- **認可ガードは `try/catch` の外**（`.claude/steering/tech.md`「エラーハンドリング」）— put
  `requireStoreOwner()` / `requireAdmin()` before the `try`, so an authorization error is not
  overwritten by the generic DB error message.
- Server actions live only in `src/queries/`. UI calls them; do not move logic into components.
- Structured logging via `logError(...)` is already used in this file — keep it.
- `any` is banned; keep `catch (error: unknown)`.

## Commands you will need

| Purpose   | Command                                   | Expected on success        |
|-----------|-------------------------------------------|----------------------------|
| Typecheck | `bunx tsc --noEmit`                       | exit 0, no errors          |
| Unit test | `bun run test -- src/queries/coupon.test.ts` | all pass (incl. new tests) |
| Lint      | `bun run lint`                            | exit 0 (warnings ok)       |

## Scope

**In scope** (the only files you should modify):
- `src/queries/coupon.ts` — scope `getCoupon`, add `getCouponAsAdmin`
- `src/app/dashboard/seller/stores/[storeUrl]/coupons/columns.tsx` — pass `storeUrl`
- `src/app/dashboard/admin/coupons/columns.tsx` — call `getCouponAsAdmin`
- `src/queries/coupon.test.ts` — add tests

**Out of scope** (do NOT touch):
- `upsertCoupon` / `applyCoupon` / `deleteCoupon` and any other coupon action — the discount
  server-side validation gap is **plan 060**, not this plan.
- The `CouponToUser` usage-limit gap (SECURITY-24) — separate, deferred.
- Any change to what fields the coupon row returns (shape is unchanged).

## Git workflow

- Branch: `advisor/058-scope-get-coupon`
- Commit style (conventional): `fix(security): scope getCoupon to owning store (IDOR)`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Split `getCoupon` into an owner-scoped seller read + an admin read

In `src/queries/coupon.ts`, replace the current `getCoupon` (lines ~145-165) with:

```ts
/**
 * @Function getCoupon
 * @Description Retrieves a coupon owned by the given store. Seller-only.
 * @PermissionLevel Seller (must own storeURL)
 */
export const getCoupon = async (couponId: string, storeURL: string) => {
    // 認可 + 店舗所有権を集約検証（IDOR 防御）。認可ガードは try/catch の外。
    const { store } = await requireStoreOwner(storeURL)
    try {
        if (!couponId) throw new Error('Please provide coupon ID.')
        const coupon = await db.coupon.findFirst({
            where: { id: couponId, storeId: store.id },
        })
        return coupon
    } catch (error: unknown) {
        logError('[Coupon:getCoupon] failed to fetch coupon', error)
        throw new Error(
            `Error occurred while trying to fetch coupon: ${error instanceof Error ? error.message : String(error)}`
        )
    }
}

/**
 * @Function getCouponAsAdmin
 * @Description Retrieves any coupon (incl. PLATFORM). Admin-only.
 * @PermissionLevel Admin
 */
export const getCouponAsAdmin = async (couponId: string) => {
    // 認可ガードは try/catch の外。
    await requireAdmin()
    try {
        if (!couponId) throw new Error('Please provide coupon ID.')
        const coupon = await db.coupon.findUnique({
            where: { id: couponId },
        })
        return coupon
    } catch (error: unknown) {
        logError('[Coupon:getCouponAsAdmin] failed to fetch coupon', error)
        throw new Error(
            `Error occurred while trying to fetch coupon: ${error instanceof Error ? error.message : String(error)}`
        )
    }
}
```

> Use `findFirst` (not `findUnique`) in the seller path: `findUnique` only accepts unique fields
> in `where`, and `storeId` is not part of the coupon primary key. `deleteCoupon` can use
> `db.coupon.delete({ where: { id, storeId } })` because `delete` accepts a compound filter, but
> the read equivalent is `findFirst`.

Confirm `requireAdmin` is imported at the top of the file (it may already be — check the existing
import from `@/lib/auth-guards`; add `requireAdmin` to that import list if missing).

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 2: Update the seller caller to pass `storeUrl`

In `src/app/dashboard/seller/stores/[storeUrl]/coupons/columns.tsx:158`, change:

```tsx
rowData: await getCoupon(coupon?.id),
```
to:
```tsx
rowData: await getCoupon(coupon.id, params.storeUrl),
```

**Drop the `?.` — `getCoupon(couponId: string, storeURL: string)` requires a non-null `string`, so
`coupon?.id` (`string | undefined`) violates the contract under strict mode.** The non-null
guarantee already exists here: `coupon` is the table row's `row.original` and is dereferenced without
`?.` on the line just above (`data={{ ...coupon }}`), so it is always defined — use `coupon.id`.
(If a future refactor ever makes `coupon` nullable, guard it before the call instead of re-adding
`?.`.) `params.storeUrl` is already used in the same block (line ~154); `params` is in scope.

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 3: Update the admin caller to use `getCouponAsAdmin`

In `src/app/dashboard/admin/coupons/columns.tsx`:
- Update the import from `@/queries/coupon` to include `getCouponAsAdmin` (replace `getCoupon` in
  that import if `getCoupon` is not used elsewhere in the file — check with a search first).
- At line ~150, change `rowData: await getCoupon(coupon.id)` to
  `rowData: await getCouponAsAdmin(coupon.id)`.

**Verify**:
- `bunx tsc --noEmit` → exit 0
- `grep -rn "getCoupon(" "src/app/dashboard/admin/coupons/columns.tsx"` → no matches (admin no
  longer calls the seller-scoped `getCoupon`).

### Step 4: Add regression tests

Add to `src/queries/coupon.test.ts`, following the existing test structure in that file (it already
tests `getCoupon` at lines ~409-431 — **update those existing tests** to the new two-arg signature,
then add the ownership cases). Model the auth-guard mocking on how the other owner-scoped actions in
this suite are tested.

Cover the IDOR 3-tier pattern (per `docs/testing/SECURITY_GAP_REPORT.md` §5.2):
- (a) **throws** — `getCoupon("id", "not-my-store")` rejects with the `requireStoreOwner`
  forbidden error (mock `requireStoreOwner` to throw), and no `db.coupon.findFirst` call happens.
- (b) **where structure** — a successful `getCoupon("c1", "my-store")` calls
  `db.coupon.findFirst` with `where: { id: "c1", storeId: <owned store id> }` (assert the arg shape).
- (c) **admin path** — `getCouponAsAdmin("c1")` rejects when `requireAdmin` throws, and on success
  calls `db.coupon.findUnique({ where: { id: "c1" } })`.

**Verify**: `bun run test -- src/queries/coupon.test.ts` → all pass, including the new cases.

## Test plan

- Update the 2–3 existing `getCoupon` tests to the new signature; add the (a)/(b)/(c) cases above.
- Structural pattern: the existing owner-scoped action tests already in `coupon.test.ts`
  (`deleteCoupon` / `getStoreCoupons` tests mock `requireStoreOwner`) — mirror their mocking setup.
- Verification: `bun run test -- src/queries/coupon.test.ts` all pass.

## Done criteria

ALL must hold:

> 下記のチェックは **2026-07-27 に再実測**したもの。

- [x] `bunx tsc --noEmit` exits 0
- [x] `getCoupon` signature is `(couponId: string, storeURL: string)` and its query is scoped to
      `{ id: couponId, storeId: store.id }` via `requireStoreOwner`
- [x] `getCouponAsAdmin` exists, gated by `requireAdmin()`, and is the admin caller's function
- [x] `grep -n "@PermissionLevel Public" src/queries/coupon.ts` → no match (the stale doc is gone)
- [x] `bun run test -- src/queries/coupon.test.ts` passes with the new (a)/(b)/(c) tests
- [x] `bun run lint` exits 0
- [x] No files outside the in-scope list are modified (`git status`)
- [x] `plans/README.md` status row for 058 updated

## STOP conditions

Stop and report (do not improvise) if:

- The code at `coupon.ts:145-165` doesn't match the "Current state" excerpt (drift).
- The seller `columns.tsx` does not have `params.storeUrl` in scope — report; do not thread a new
  prop through unrelated components on your own initiative.
- A third caller of `getCoupon` exists beyond the two named here (`grep -rn "getCoupon(" src/`) —
  report it; the plan assumed exactly two.
- Typecheck or tests fail twice after a reasonable fix attempt.

## Maintenance notes

- Any new coupon read must be owner- or admin-scoped like the two functions here — never a bare
  `findUnique({ where: { id } })` from a `'use server'` file.
- The stale-JSDoc cleanup here is the pattern for the `upsertReview` `@access Admin only` stale doc
  noted in the Round 13 ledger — if plan 060 or a later plan touches `review.ts`, fix that doc too.
- Reviewer should confirm the admin path is intentionally un-scoped (PLATFORM coupons have
  `storeId = null`) and gated by `requireAdmin()`, and that no seller path can reach
  `getCouponAsAdmin`.
