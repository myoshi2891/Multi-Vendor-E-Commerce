# Plan 009: Bound the seller store-orders query and remove the discarded browse-page query

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f9752c0..HEAD -- src/queries/store.ts "src/app/(store)/browse/page.tsx" src/queries/store.test.ts plans/README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts to live code; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `f9752c0`, 2026-07-03

## Why this matters

Two independent query-hygiene wins:

1. **Unbounded query**: `getStoreOrders` does `db.orderGroup.findMany({ where: { storeId }, include: { items, coupon, order{...} } })` with **no `take`** — it loads the store's entire order history (with nested items/address/payment) on every render of the seller orders page. This grows without limit as a store matures.
2. **Discarded query**: `browse/page.tsx` calls `await getFilteredSizes({})` and never uses the result — a wasted, blocking DB round-trip on every browse/search render, serialized before the real product fetch.

This plan applies a **defensive upper bound** (`take`) to the store-orders query without changing its return shape (so the seller page's client-side `DataTable` search/pagination keeps working), and deletes the dead browse-page call. Full server-side pagination of the orders table is deliberately **deferred** — see Maintenance notes — because it would change the return type consumed by `StoreOrderType` and regress the DataTable's in-browser search, which is a larger, riskier change than this hygiene pass.

> **Behavior-change caveat (not pure hygiene)**: the *return shape* is unchanged, but the
> *behavior* is not — a store with more than `take` orders will **silently** drop its oldest orders
> from the seller view, with no UI signal. This is a user-facing truncation, so treat it as a
> product contract: the seller page MUST surface a "showing the latest N orders" notice (or an
> equivalent affordance) alongside the `take`, and the follow-up (PERF-04) must deliver real
> pagination before the bound can plausibly be hit in production. Do not ship the bare `take`
> as if it were invisible.

## Current state

### Unbounded `getStoreOrders`, `src/queries/store.ts:361-393`

```ts
export const getStoreOrders = async (storeUrl: string) => {
    try {
        const { store } = await requireStoreOwner(storeUrl);
        const orders = await db.orderGroup.findMany({
            where: { storeId: store.id },
            include: {
                items: true,
                coupon: true,
                order: {
                    select: {
                        paymentStatus: true,
                        shippingAddress: { include: { country: true, user: { select: { email: true } } } },
                        paymentDetails: true,
                    },
                },
            },
            orderBy: { updatedAt: "desc" },   // ← no take
        });
        return orders;
    } catch (error: unknown) { /* logs + rethrow */ }
};
```

**Consumers that constrain the return shape** (why we keep it an array):
- `src/app/dashboard/seller/stores/[storeUrl]/orders/page.tsx:23,25` — `let orders: Awaited<ReturnType<typeof getStoreOrders>> = []; orders = await getStoreOrders(storeUrl);` then feeds `<DataTable data={orders} ... />` (client-side search/pagination).
- `src/lib/types.ts:421` — `export type StoreOrderType = Prisma.PromiseReturnType<typeof getStoreOrders>[0];` (indexes element `[0]`).
- `StoreOrderType` is used across seller `columns.tsx`, admin `columns.tsx`, and `columns.test.tsx`. Changing the return from an array to a paginated object would ripple into all of these — hence the array shape is preserved here.

### Discarded query, `src/app/(store)/browse/page.tsx`

- line 6: `import { getFilteredSizes } from "@/queries/size";`
- line 32: `await getFilteredSizes({});`  ← result never assigned or passed

`getFilteredSizes` is **still used legitimately** elsewhere (`src/components/store/browse-page/filters/size/size-filter.tsx:27`, client-side), so only the discarded call + its now-unused import in `browse/page.tsx` are removed — the function itself stays.

### Repo conventions

- `getStoreOrders` uses the older 3-arg `console.error` — leave it as-is (logging cleanup is plan 007's deferred batch).
- The sibling `getStoreRecentOrders` (`src/queries/store-dashboard.ts:189`) already demonstrates the `take` pattern on the same include shape.

## Commands you will need

| Purpose    | Command                                       | Expected          |
|------------|-----------------------------------------------|-------------------|
| Typecheck  | `bunx tsc --noEmit`                           | exit 0            |
| Store test | `bun run test -- src/queries/store.test.ts`   | all pass          |
| Lint       | `bun run lint`                                | exit 0 (warns ok) |

## Scope

**In scope**:
- `src/queries/store.ts` — add a bounded `take` to `getStoreOrders`
- `src/app/(store)/browse/page.tsx` — remove the discarded call + unused import
- `src/queries/store.test.ts` — assert the `take` bound
- `plans/README.md` — update plan 009 status when complete

**Out of scope**:
- Changing `getStoreOrders`'s return shape or adding page params (deferred; would break `StoreOrderType` + DataTable search).
- `src/lib/types.ts`, `columns.tsx`, `columns.test.tsx` — must remain untouched (the array shape is preserved precisely so they don't need changes).
- `getFilteredSizes` itself and its client-side caller.

## Git workflow

- Branch: `advisor/009-query-hygiene`
- Commit style: two commits recommended — `perf(store): bound getStoreOrders result set` and `perf(browse): remove discarded getFilteredSizes call`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add a bounded `take` to `getStoreOrders`

In `src/queries/store.ts`, add a module-level constant and apply it in the `findMany`:

```ts
// 無制限の findMany を防ぐ防御的上限。将来はサーバーサイドページネーションへ移行（PERF-04 follow-up）。
const STORE_ORDERS_MAX = 200;
```

In the `getStoreOrders` `findMany`, add `take: STORE_ORDERS_MAX` alongside `orderBy`:

```ts
orderBy: { updatedAt: "desc" },
take: STORE_ORDERS_MAX,
```

The return stays `orders` (an array), so no consumer changes.

This establishes an explicit temporary product contract: callers receive at most the 200 most recently updated orders. Older orders are not retrievable until server-side pagination is implemented, so the UI and API documentation must not present this result as the store's complete order history.

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 2: Remove the discarded browse-page query

In `src/app/(store)/browse/page.tsx`:
1. Delete line 32: `await getFilteredSizes({});`
2. Delete the now-unused import on line 6: `import { getFilteredSizes } from "@/queries/size";`

Confirm nothing else in the file references `getFilteredSizes`:
`grep -n "getFilteredSizes" "src/app/(store)/browse/page.tsx"` → no matches after edit.

**Verify**: `bunx tsc --noEmit` → exit 0 (no unused-import or missing-symbol error); `bun run lint` → exit 0.

### Step 3: Test the `take` bound

In `src/queries/store.test.ts`, in the `getStoreOrders` describe (starts line ~1243), add/adjust the success test to assert the query carries the bound:
```ts
expect(mockDb.orderGroup.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
        where: { storeId: /* the mocked store id */ },
        take: 200,
        orderBy: { updatedAt: "desc" },
    })
);
```
Use `expect.objectContaining` so the large `include` block doesn't have to be reproduced. Keep the existing ownership/authorization tests in that describe unchanged.

**Verify**: `bun run test -- src/queries/store.test.ts` → all pass.

### Step 4: Full lint

**Verify**: `bun run lint` → exit 0.

## Test plan

- `store.test.ts`: assert `getStoreOrders` passes `take: 200` (bound present); existing auth/ownership tests stay green.
- No test needed for the browse deletion beyond typecheck/lint (removing dead code); if `browse/page.tsx` has a test, ensure it still passes.
- Structural pattern: existing `getStoreOrders` describe in `store.test.ts`.
- Verification: `bun run test -- src/queries/store.test.ts` → all pass.

## Done criteria

ALL must hold:

- [ ] `bunx tsc --noEmit` exits 0
- [ ] `grep -n "take: STORE_ORDERS_MAX" src/queries/store.ts` shows the bound applied
- [ ] `grep -n "getFilteredSizes" "src/app/(store)/browse/page.tsx"` returns no matches
- [ ] `bun run test -- src/queries/store.test.ts` exits 0; the `take` assertion passes
- [ ] `bun run lint` exits 0
- [ ] `src/lib/types.ts`, seller/admin `columns.tsx`, and `columns.test.tsx` are unchanged (`git status`)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 009 updated

## STOP conditions

Stop and report if:

- `getStoreOrders` or `browse/page.tsx` don't match the "Current state" excerpts (drift).
- Removing the `getFilteredSizes` import breaks the build because it IS used elsewhere in `browse/page.tsx` — report (means the excerpt is stale).
- Adding `take` changes the return type in a way that trips `StoreOrderType` (it should not — array element type is unchanged) — report.
- Store tests fail twice after reasonable fixes.

## Maintenance notes

- **Deferred follow-up (separate plan)**: true server-side pagination of the seller orders table — return `{ orders, total, page, pageSize }`, update `StoreOrderType` to `Prisma.PromiseReturnType<typeof getStoreOrders>["orders"][number]`, and replace the client-side `DataTable` search with server-driven paging. That is a UX + type change touching seller/admin columns and tests; plan and review it on its own. The `STORE_ORDERS_MAX = 200` bound is the interim guard until then.
- Reviewer should confirm the return remains an array (no consumer breakage) and that `take` is present.
- If a store legitimately exceeds 200 order groups and sellers report "missing old orders," that is the signal to prioritize the deferred pagination follow-up — not to raise the cap unbounded.
