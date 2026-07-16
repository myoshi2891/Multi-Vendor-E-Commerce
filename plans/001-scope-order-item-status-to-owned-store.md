# Plan 001: Scope `updateOrderItemStatus` order-item lookup to the owned store (fix cross-store IDOR)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f9752c0..HEAD -- src/queries/order.ts src/queries/order.test.ts`
> If either in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `f9752c0`, 2026-07-03

## Why this matters

`updateOrderItemStatus` verifies that the caller owns the store passed in `storeId`, but then looks up the target order item by `id` alone — it never confirms the item actually belongs to that store. A SELLER who owns **any** store can pass their own `storeId` (passing the ownership gate) together with a victim store's `orderItemId` and flip that item's fulfillment status (Shipped / Delivered / Canceled / Refunded). This is a cross-tenant IDOR that corrupts other sellers' order state. The sibling function `updateOrderGroupStatus` already scopes correctly (`findUnique({ where: { id: groupId, storeId } })`); this plan brings item-level updates to the same standard using the repo's atomic ownership-chain pattern.

## Current state

- `src/queries/order.ts` — server actions for orders. `updateOrderItemStatus` is the vulnerable function; `updateOrderGroupStatus` (same file) is the correct sibling to mirror.

Vulnerable code, `src/queries/order.ts:229-280` (as of `f9752c0`):

```ts
export const updateOrderItemStatus = async (
    storeId: string,
    orderItemId: string,
    status: ProductStatus
) => {
    // Retrieve the current user
    const user = await currentUser();
    if (!user) throw new Error("Unauthenticated.");
    if (user.privateMetadata.role !== "SELLER")
        throw new Error("Only sellers can perform this action.");

    // Ensure the user is a seller of the specified store
    const store = await db.store.findUnique({
        where: { id: storeId, userId: user.id },
    });
    if (!store) {
        throw new Error("Unauthorized to update order item status.");
    }

    // Retrieve the product item to be updated
    const product = await db.orderItem.findUnique({
        where: { id: orderItemId },          // ← NOT scoped to the store
    });
    if (!product) {
        throw new Error("Order item not found");
    }

    // Update the order status
    const updatedProduct = await db.orderItem.update({
        where: { id: orderItemId },
        data: { status },
    });
    return updatedProduct.status;
};
```

Correct sibling for reference, `src/queries/order.ts:193-215`:

```ts
const order = await db.orderGroup.findUnique({
    where: { id: groupId, storeId: storeId },
});
if (!order) { throw new Error("Order not found"); }
const updatedOrder = await db.orderGroup.update({
    where: { id: groupId },
    data: { status },
});
```

### Data model fact you need

`OrderItem` relates to a store through its parent `OrderGroup`: `OrderItem.orderGroup` → `OrderGroup.storeId`. There is **no direct `storeId` column on `OrderItem`**. So the ownership scope must go through the relation: `orderGroup: { storeId }`.

### Repo conventions that apply

- **Atomic ownership-chain pattern** (the exemplar to copy): `src/queries/inventory.ts:104-138` (`updateSizeStock`) folds the ownership check into a single `updateMany` where-clause and treats `result.count === 0` as forbidden — no separate read-then-write, no TOCTOU gap:

  ```ts
  const result = await db.size.updateMany({
      where: { id: sizeId, productVariant: { product: { storeId: store.id } } },
      data: { quantity: parsed.data.quantity },
  });
  if (result.count === 0) {
      throw new Error("Forbidden: size not owned by current store.");
  }
  ```

- **Preserve the existing auth style in this function.** `updateOrderItemStatus` currently uses inline `currentUser()` + role checks (pre-existing; the newer `src/lib/auth-guards.ts` helpers are for *new* actions). Do **not** refactor the auth block in this plan — that is a separate concern and would enlarge the diff/risk. Only change the lookup+update to be store-scoped.
- **Return type unchanged**: the function returns `updatedProduct.status` (a `ProductStatus`). Keep that contract.

## Commands you will need

| Purpose   | Command                                   | Expected on success |
|-----------|-------------------------------------------|---------------------|
| Typecheck | `bunx tsc --noEmit`                       | exit 0, no errors   |
| Unit test | `bun run test -- src/queries/order.test.ts` | all pass          |
| Lint      | `bun run lint`                            | exit 0 (warnings ok)|

## Scope

**In scope** (the only files you should modify):
- `src/queries/order.ts` — fix `updateOrderItemStatus` only
- `src/queries/order.test.ts` — add/adjust tests for the new scoping

**Out of scope** (do NOT touch):
- The inline `currentUser()` + role-check auth block in `updateOrderItemStatus` — leave as-is (auth-guard migration is a separate effort).
- `updateOrderGroupStatus`, `updateOrderItemStatusAsAdmin`, or any other function in `order.ts`.
- The `ProductStatus` enum / `src/lib/types.ts`.

## Git workflow

- Branch: `advisor/001-scope-order-item-status`
- Commit style: Conventional Commits, e.g. `fix(order): scope updateOrderItemStatus to owned store (IDOR)`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Replace the unscoped read+update with a single scoped `updateMany`

In `src/queries/order.ts`, inside `updateOrderItemStatus`, replace the `db.orderItem.findUnique(...)` + not-found throw + `db.orderItem.update(...)` block (the code after the store-ownership check, roughly lines 257-277) with an atomic ownership-scoped update that mirrors `updateSizeStock`:

```ts
// IDOR 防止: 対象 OrderItem を所有店舗にスコープする。
// OrderItem → OrderGroup.storeId の関係で絞り込み、検証と更新を単一の原子的更新にする。
// count === 0 は他店舗のアイテムか不存在を意味し、いずれも副作用なしで拒否される。
const result = await db.orderItem.updateMany({
    where: {
        id: orderItemId,
        orderGroup: { storeId: storeId },
    },
    data: { status },
});

if (result.count === 0) {
    throw new Error("Order item not found");
}

return status;
```

Notes:
- `updateMany` does not return the updated row, so return the `status` argument directly (it is the value just written). This keeps the `Promise<ProductStatus>`-shaped return.
- Keep the `throw new Error("Order item not found")` message identical so any test/consumer asserting on it still passes; a cross-store item now correctly hits this branch (count 0) instead of being updated.

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 2: Add an IDOR regression test + update the happy-path assertions

In `src/queries/order.test.ts`, the `describe("updateOrderItemStatus", ...)` block (starts at line 339) currently mocks `mockDb.orderItem.findUnique` / `mockDb.orderItem.update`. Since the implementation now uses `orderItem.updateMany`, update those tests:

1. **Happy path** (existing "OrderItemのステータスを正常に更新する", line ~423): mock `mockDb.orderItem.updateMany.mockResolvedValue({ count: 1 })` and assert:
   ```ts
   expect(mockDb.orderItem.updateMany).toHaveBeenCalledWith({
       where: { id: "order-item-001", orderGroup: { storeId: TEST_CONFIG.DEFAULT_STORE_ID } },
       data: { status: "Processing" },
   });
   expect(result).toBe("Processing");
   ```
2. **New IDOR test** — add inside the same describe, following the 3-tier IDOR pattern used elsewhere in this file (see `docs/testing/SECURITY_GAP_REPORT.md` §5.2 and the `describe("IDOR防止（ストア所有権検証）")` blocks at lines 219 and 369). Cover: (a) throws "Order item not found" when the item belongs to another store, (b) the `updateMany` where-clause carries `orderGroup: { storeId }`, (c) no update side effect leaks — i.e. `updateMany` returned `{ count: 0 }` path throws:
   ```ts
   it("他店舗の OrderItem は更新できない（count 0 → not found）", async () => {
       mockDb.orderItem.updateMany.mockResolvedValue({ count: 0 });
       await expect(
           updateOrderItemStatus(TEST_CONFIG.DEFAULT_STORE_ID, "victim-item", "Shipped" as never)
       ).rejects.toThrow("Order item not found");
       expect(mockDb.orderItem.updateMany).toHaveBeenCalledWith({
           where: { id: "victim-item", orderGroup: { storeId: TEST_CONFIG.DEFAULT_STORE_ID } },
           data: { status: "Shipped" },
       });
   });
   ```
3. Ensure the shared `beforeEach` for this describe still sets `mockDb.store.findUnique.mockResolvedValue(createMockStore())` (the store-ownership gate is unchanged). If the mock `db` object in this file lacks `orderItem.updateMany`, add `updateMany: jest.fn()` to the `orderItem` mock (the mock db already declares `updateMany` for `order`/`orderGroup`/`orderItem` at lines ~38-53 — confirm `orderItem` has it).

**Verify**: `bun run test -- src/queries/order.test.ts` → all pass, including the new IDOR test.

### Step 3: Full typecheck + lint

**Verify**:
- `bunx tsc --noEmit` → exit 0
- `bun run lint` → exit 0 (pre-existing warnings are acceptable; no new errors)

## Test plan

- New test in `src/queries/order.test.ts` inside `describe("updateOrderItemStatus")`: the cross-store rejection case above (asserts throw + where-clause + no successful update).
- Adjust the existing happy-path and transition tests in that describe from `findUnique`/`update` mocks to `updateMany` mocks.
- Structural pattern to follow: the existing IDOR describe blocks in the same file (lines 219, 369) and `updateSizeStock` tests if present in `src/queries/inventory.test.ts`.
- Verification: `bun run test -- src/queries/order.test.ts` → all pass.

## Done criteria

ALL must hold:

- [ ] `bunx tsc --noEmit` exits 0
- [ ] `bun run test -- src/queries/order.test.ts` exits 0; the new cross-store IDOR test exists and passes
- [ ] `grep -n "orderItem.findUnique" src/queries/order.ts` returns **no** match inside `updateOrderItemStatus` (the unscoped read is gone)
- [ ] `grep -n "orderGroup: { storeId" src/queries/order.ts` shows the new scoped where-clause
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 001 updated to DONE

## STOP conditions

Stop and report back (do not improvise) if:

- The `updateOrderItemStatus` code at `src/queries/order.ts` does not match the "Current state" excerpt (drift since `f9752c0`).
- `OrderItem` has gained a direct `storeId` column in `prisma/schema.prisma` (then the relation-based `orderGroup: { storeId }` filter may need to become `storeId` directly — report which).
- `bun run test -- src/queries/order.test.ts` fails twice after reasonable fixes.
- Fixing this appears to require changing the auth block or another function (out of scope).

## Maintenance notes

- If admin-side item status updates are ever routed through this seller function, revisit the scope (admins act cross-store by design and would hit `count === 0`).
- Reviewer should confirm the `updateMany` where-clause uses the **relation** path `orderGroup: { storeId }`, not a non-existent `OrderItem.storeId`.
- The parallel admin function `updateOrderItemStatusAsAdmin` already uses `requireAdmin` + scoped updates and is intentionally left untouched here.
- Follow-up deferred: migrating this function's inline `currentUser()` + role check to `requireSeller`/`requireStoreOwner` (tracked separately; keeps this security fix minimal).
