# Plan 012 (design/spike): Extend inventory restock to item-level status transitions

> **Executor instructions**: This is a **design/spike** plan, NOT a build plan.
> Its deliverable is a written design document plus a proof-of-concept
> investigation — you produce a decision and a follow-up implementation plan,
> you do **not** ship the feature in this plan. Do the read-only investigation,
> answer the open questions with evidence, write the design doc, and STOP.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f9752c0..HEAD -- src/queries/order.ts src/queries/user.ts`
> If either changed since this plan was written, re-read the current
> `updateOrderItemStatusAsAdmin` / `updateOrderPaymentStatus` / `restockOrderItems`
> before designing; on a major structural change, note it in your design doc.

## Status

- **Priority**: P3
- **Effort**: M (spike + design doc; implementation is a separate follow-up plan)
- **Risk**: MED (money/inventory correctness — the reason it's a spike first)
- **Depends on**: none (but informs a future implementation plan)
- **Category**: direction
- **Planned at**: commit `f9752c0`, 2026-07-03

## Why this matters

Stock is decremented when an order is placed (`placeOrder`, atomic check-and-decrement) but the reverse — returning stock on cancellation/return/refund — is only **partially** implemented. The order-level payment-status path (`updateOrderPaymentStatus`) already restocks atomically with a double-restock guard. But the **item-level** admin path (`updateOrderItemStatusAsAdmin`) flips a single `OrderItem` to `Canceled`/`Refunded`/`Returned` with an explicit `TODO` and **no restock**. So an item cancelled individually permanently understates sellable inventory — harming the SELLER "在庫管理の操作性" KPI and depressing GMV via phantom out-of-stock. The hard part is not writing an `increment`; it's guaranteeing **exactly-once** restock when an item can be reversed by two different code paths (item-level and order-level). This spike settles that design before any code is written.

## Current state (read these before designing)

### The unfilled hook — `src/queries/order.ts:521-539` (`updateOrderItemStatusAsAdmin`)

```ts
export const updateOrderItemStatusAsAdmin = async (
    orderItemId: string,
    status: ProductStatus
): Promise<ProductStatus> => {
    const admin = await requireAdmin();
    try {
        const updated = await db.orderItem.update({
            where: { id: orderItemId },
            data: { status },
            select: { status: true },
        });
        console.error(`[Admin:updateOrderItemStatus] actor=${admin.id} target=${orderItemId} to=${status}`);
        // TODO(在庫連動・スコープ外): status が Canceled/Returned のとき在庫復元フックをここに（判断5-2）
        return updated.status as ProductStatus;
    } catch (error: unknown) { /* structured log + rethrow */ }
};
```

Note it uses a plain `db.orderItem.update` — **not** inside a `$transaction`, and it does not read the item's `sizeId`/`quantity` or its previous status.

### The already-working order-level restock — `src/queries/order.ts:562-651` (`updateOrderPaymentStatus`)

This is the pattern to mirror. It runs inside `db.$transaction`, uses a **conditional `updateMany`** to make the "non-terminal → Cancelled/Refunded" transition atomic (`didTransition = transition.count === 1`), and only restocks when the transition actually happened:

```ts
const transition = await tx.order.updateMany({
    where: { id: orderId, paymentStatus: { notIn: [Cancelled, Refunded] } },
    data: { paymentStatus: status, orderStatus: childOrderStatus },
});
didTransition = transition.count === 1;
// ...
if (isCancelOrRefund && didTransition) {
    const items = await tx.orderItem.findMany({ where: { orderGroup: { orderId } }, select: { sizeId: true, quantity: true } });
    await restockOrderItems(tx, items);
}
```

### The restock helper — `src/queries/order.ts:23-33`

```ts
const restockOrderItems = async (
    tx: OrderTransactionClient,
    items: { sizeId: string; quantity: number }[]
): Promise<void> => {
    for (const item of items) {
        await tx.size.update({ where: { id: item.sizeId }, data: { quantity: { increment: item.quantity } } });
    }
};
```

### The decrement side (mirror it) — `src/queries/user.ts:716-727` (`placeOrder`)

Atomic conditional decrement with `count === 0` = out-of-stock rollback. Restock is the inverse.

### Sibling seller path

`updateOrderItemStatus` (seller, `src/queries/order.ts:229`) also flips item status and also lacks restock — the design should state whether the seller path is in or out of scope for the eventual implementation.

### The exactly-once problem (the core design question)

An `OrderItem` can be moved to a terminal reversed state by **two** paths:
1. `updateOrderItemStatusAsAdmin` (item granularity), and
2. `updateOrderPaymentStatus` (order granularity — restocks ALL items via `restockOrderItems`).

If item X is cancelled individually (path 1 restocks it) and later the whole order is refunded (path 2 restocks it again), stock is credited **twice**. The order-level path guards double-restock *within itself* (the `notIn` transition guard) but does **not** know whether an individual item was already restocked by the item-level path. This is the interaction the spike must resolve.

### Repo conventions the eventual implementation must honor

- Multi-table writes use `db.$transaction` (`.claude/steering/tech.md`).
- Atomic conditional `updateMany` for check-and-act (avoid read-then-write TOCTOU) — the established pattern in both `placeOrder` and `updateOrderPaymentStatus`.
- `Prisma.Decimal` for money; but quantities are `Int` here.
- Admin actions guarded by `requireAdmin` (already present).
- IDOR tests use the 3-tier pattern (`docs/testing/SECURITY_GAP_REPORT.md` §5.2); integration tests use testcontainers (ADR-004).

## Commands you will need (read-only investigation)

| Purpose               | Command                                       | Expected            |
|-----------------------|-----------------------------------------------|---------------------|
| Read schema           | inspect `prisma/schema.prisma` `OrderItem`    | see fields below    |
| Find status enum      | `grep -n "Returned\|Canceled\|Refunded" src/lib/types.ts prisma/schema.prisma` | enum values |
| Existing restock tests| `grep -rn "restock" src/queries/order.test.ts tests/integration/` | current coverage |

(No production edits in this plan — investigation + a design doc only.)

## Scope

**In scope** (this spike produces):
- A design document at `docs/design/inventory-restock/design.md` (create the dir) answering the open questions below, following the repo's design-doc conventions (see existing `docs/design/*/design.md` for structure).
- A follow-up **implementation** plan file at **the next free plan number**, named `plans/<next-free-number>-implement-item-level-restock.md`. Determine the number at execution time by inspecting the numeric prefixes under `plans/`; do not reuse an occupied number. Write it to the same template standard as the other plans, ready for an executor — but only after the design decisions are made.

**Out of scope** (do NOT do in this plan):
- Any change to `src/queries/order.ts`, `src/queries/user.ts`, or the schema. This is design-only.
- The downstream real-money refund execution (Stripe/PayPal refund API) — that is a separate direction (DIRECTION-01); restock and refund-execution should be designed to compose but are distinct.

## Open questions the spike MUST answer (with evidence)

1. **Exactly-once mechanism.** Choose and justify one:
   - (a) an `OrderItem.restockedAt` / `restocked: Boolean` column (schema migration) that every restock path checks-and-sets atomically in the same `$transaction`; or
   - (b) derive "already restocked" from status history — i.e. only restock on the *transition into* a terminal state, and make both paths use a conditional `updateMany` on the item (`where: { id, status: { notIn: [terminal...] } }`) so the second attempt sees `count === 0`.
   State which is simpler and safer given the existing `updateMany`-transition pattern. (Option (b) mirrors the existing code and avoids a migration; option (a) is explicit but adds schema surface. Recommend one.)
   - **Caveat for option (b)**: a status-transition guard on a *single* entity does NOT by itself prevent double-restock across *different* paths (item-level `updateOrderItemStatusAsAdmin` vs order-level `updateOrderPaymentStatus`), because they transition different rows. If (b) is chosen, the exactly-once claim MUST still be anchored at the **item level** (an item-scoped conditional `updateMany`/marker that both paths check-and-set in the same `$transaction`), not merely on an order/group status transition. See Q3.
2. **Which terminal statuses restock?** `Canceled`, `Refunded`, `Returned` — confirm the exact `ProductStatus`/`OrderStatus` enum spellings (note the existing code's `Cancelled` vs `Canceled` double-l/single-l distinction between `PaymentStatus` and `OrderStatus`). List the exact values.
3. **Item-level vs order-level interaction.** Specify how `updateOrderItemStatusAsAdmin` and `updateOrderPaymentStatus` avoid double-crediting the same item (this is where option (a)/(b) pays off). Give the concrete transaction shape.
4. **Transaction boundary.** `updateOrderItemStatusAsAdmin` currently is not in a `$transaction`. Confirm the implementation must wrap status-update + restock atomically, and specify the `where`-guard that makes the transition idempotent.
5. **Seller path.** Decide whether `updateOrderItemStatus` (seller) is included in the first implementation or deferred; justify.
6. **Refund coupling.** State whether restock fires on status alone or must wait for DIRECTION-01's refund confirmation — and why (recommendation: restock on the fulfillment-status transition, independent of payment refund, since they are separate concerns).

## Steps

### Step 1: Investigate

Read the files in "Current state", plus `prisma/schema.prisma` (`OrderItem`, `Size`, the status enums) and the existing restock tests. Confirm the enum spellings and the exact transaction primitives available (`OrderTransactionClient` type, `tx.size.update` / `updateMany`).

**Verify**: you can state, with `file:line` evidence, the exactly-once guard used by `updateOrderPaymentStatus` and why it does not currently cover the item-level path.

### Step 2: Write the design doc

Create `docs/design/inventory-restock/design.md` answering all six open questions with a recommended decision each, a concrete target transaction shape for `updateOrderItemStatusAsAdmin`, and the double-restock interaction matrix (item-path × order-path). Follow the structure of an existing `docs/design/*/design.md`.

**Verify**: every open question has a decision + rationale + evidence; the doc names the exact enum values and the chosen exactly-once mechanism.

### Step 3: Write the follow-up implementation plan

Using `plan-template.md` standards (self-contained, drift check, verification gates, STOP conditions), write `plans/<next-free-number>-implement-item-level-restock.md`, choosing the next free number at execution time. The executor must be able to implement the *decided* design: the transaction wrap, the guard, reuse of `restockOrderItems`, and the test plan (unit with mocked `tx`; an integration test under `tests/integration/` per ADR-004 that asserts stock increments exactly once across both paths).

**Verify**: the follow-up plan cites concrete `file:line`, has machine-checkable done criteria, and its scope excludes DIRECTION-01 refund execution.

## Done criteria

ALL must hold:

- [ ] `docs/design/inventory-restock/design.md` exists and answers all six open questions with decisions + evidence
- [ ] The design names the exact restock-triggering enum values and the chosen exactly-once mechanism (a or b) with justification
- [ ] `plans/<next-free-number>-implement-item-level-restock.md` exists at a number that was free when created, is template-compliant, and is ready for a zero-context executor
- [ ] No source files or schema were modified (`git status` shows only new docs/plan files, plus the `plans/README.md` index update below)
- [ ] `plans/README.md` status row for 012 updated and the new follow-up plan added to the index under its chosen number

## STOP conditions

Stop and report if:

- The current code already restocks on item-level transitions **and does so exactly once**. See the
  qualification below — a filled-in TODO is not on its own sufficient to close this spike.
- The exactly-once design requires a schema migration you're not certain is safe — recommend option (b) (no migration) and flag the tradeoff rather than committing to a migration in a spike.
- You discover restock and the DIRECTION-01 refund flow are already coupled in a way that changes the design — document and report.

> **A filled-in TODO does not close this spike.** The first STOP condition is about *behavior*, not
> about the presence or absence of a comment. Deleting the TODO and dropping a `restockOrderItems`
> call next to the `orderItem.update` satisfies "the TODO has been filled" while leaving the design
> question entirely open — and the naive version is exactly the one that double-restocks when an
> item is cancelled item-level and the order is subsequently refunded order-level. That scenario is
> this plan's own key acceptance gate (see Maintenance notes).
>
> Close the spike only if **all** of the following are true:
>
> 1. An item-level transition into a restock-triggering `ProductStatus` actually increments
>    `Size.quantity` (read the code path, don't trust the comment).
> 2. That increment is guarded so it happens **exactly once** across the item-level and order-level
>    paths — i.e. there is a state-transition guard, not an unconditional call.
> 3. A test proves (2) for the item-cancel-then-order-refund sequence. Absent such a test, the
>    guard is unverified and the spike still has work to do.
>
> If (1) holds but (2) or (3) does not, **do not close the spike** — re-scope it to designing and
> proving the exactly-once guard for the existing implementation, and report the re-scope.

**Drift note (2026-07-19)**: the TODO cited above as `order.ts:538` now sits at
[`order.ts:509`](../src/queries/order.ts), inside `updateOrderItemStatusAsAdmin`, and is still
unfilled — so the spike remains live. Separately, the **order-level** restock has since shipped
*with* an exactly-once guard: `restockOrderItems` / `isRestockTerminalOrderStatus`, plus a
conditional `updateMany` in `updateOrderPaymentStatus` whose `where` excludes already-settled
payment statuses and which keys both child cascade and restock on `transition.count === 1`.
**Use that as the reference implementation for mechanism (b)** — a conditional `updateMany` on the
status transition (`transition.count === 1`), with no schema column, which is exactly option (b)
above, *not* the `restocked` boolean column of option (a) — rather than designing a guard from
scratch; the remaining design question is how the item-level path composes with it without
double-restocking.

## Maintenance notes

- Keep this restock design consistent with the DIRECTION-01 refund-execution design if that is also pursued — they touch the same cancellation/refund transition and should compose (restock on fulfillment status; refund on payment status), not conflict.
- The eventual implementation reuses `restockOrderItems` (`order.ts:23`) — do not duplicate the increment logic.
- Reviewer of the follow-up implementation should scrutinize the exactly-once guard hardest: an integration test proving stock increments **exactly once** when an item is cancelled item-level and then the order is refunded order-level is the key acceptance gate.
