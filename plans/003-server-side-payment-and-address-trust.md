# Plan 003: Derive Stripe payment state server-side and verify shipping-address ownership

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f9752c0..HEAD -- src/queries/stripe.ts src/queries/user.ts src/queries/stripe.test.ts src/queries/user.test.ts src/components/store/cards/payment/stripe/stripe-payment.tsx plans/README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts to live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `f9752c0`, 2026-07-03

## Why this matters

Two server actions trust client-supplied data that determines money and PII:

1. **Stripe capture** — `createStripePayment(orderId, paymentIntent)` writes `paymentStatus`, `amount`, and `currency` straight from a client-supplied `PaymentIntent` object, with no server-side `stripe.paymentIntents.retrieve()`. A user who owns their own order can call this action with a forged `{ status: "succeeded", amount: <anything> }` and flip their unpaid order to `Paid` while recording an attacker-chosen amount — without any real charge, and without the signed webhook ever firing.
2. **Address ownership** — `placeOrder(shippingAddress, cartId)` uses `shippingAddress.id` directly on the created order without confirming the address belongs to the current user; `getOrder` later returns that address with its related user PII.

Both are "never trust the client for security-relevant state" bugs. This plan makes the server the source of truth: re-fetch the PaymentIntent from Stripe by id, and verify address ownership before use.

## Current state

- `src/queries/stripe.ts` — `createStripePaymentIntent` (creates the intent, has `orderId` metadata) and `createStripePayment` (the vulnerable capture writer).
- `src/queries/user.ts` — `placeOrder` (creates the order; trusts `shippingAddress.id`).
- `src/components/store/cards/payment/stripe/stripe-payment.tsx` — the client caller; passes the full `paymentIntent` to `createStripePayment` (line ~60).

Vulnerable capture, `src/queries/stripe.ts:71-138` (abbreviated to the load-bearing lines):

```ts
export const createStripePayment = async (
    orderId: string,
    paymentIntent: PaymentIntent   // ← whole object from the client
) => {
    const user = await currentUser();
    if (!user) throw new Error("Unauthenticated.");

    const order = await db.order.findUnique({ where: { id: orderId, userId: user.id } });
    if (!order) throw new Error("Order not found.");

    const updatedPaymentDetails = await db.paymentDetails.upsert({
        where: { orderId },
        update: {
            paymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount,          // ← client value
            currency: paymentIntent.currency,      // ← client value
            status: paymentIntent.status === "succeeded" ? "Completed" : paymentIntent.status,
            userId: user.id,
        },
        create: { /* same fields */ },
    });

    const updatedOrder = await db.order.update({
        where: { id: orderId },
        data: {
            paymentStatus: paymentIntent.status === "succeeded" ? "Paid" : "Failed",  // ← client-derived
            paymentMethod: "Stripe",
            paymentDetails: { connect: { id: updatedPaymentDetails.id } },
        },
        include: { paymentDetails: true },
    });
    return updatedOrder;
};
```

The intent is created server-side with an authenticated Stripe client, `src/queries/stripe.ts:41-46`:

```ts
const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(order.total.toNumber() * 100), // cents
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    metadata: { orderId },
});
return { paymentIntentId: paymentIntent.id, clientSecret: paymentIntent.client_secret };
```

Vulnerable order create, `src/queries/user.ts:609-616`:

```ts
const order = await db.$transaction(async (tx) => {
    const order = await tx.order.create({
        data: {
            userId,
            shippingAddressId: shippingAddress.id,   // ← ownership never checked
            orderStatus: 'Pending',
            paymentStatus: 'Pending',
            ...
```

`placeOrder` only reads `shippingAddress.countryId` (line 601) and `shippingAddress.id`; it never confirms `shippingAddress.userId === user.id`.

### Repo conventions

- **External calls wrapped in try/catch** with `instanceof Error` narrowing and structured logging `console.error("[Module:Function] msg", { error, stack })` (see `.claude/steering/tech.md`). `stripe.ts` currently uses an older 3-arg `console.error` — keep the existing style within this file unless you are adding a new catch, in which case use the structured 2-arg form.
- The `stripe` client is already imported/initialized in `src/queries/stripe.ts` (used by `createStripePaymentIntent`). Reuse it.
- `placeOrder` uses inline `currentUser()` (pre-existing) — do not migrate to auth-guards here.
- Money precision: amounts are `Decimal(12,2)`; do not introduce float math beyond what already exists.

## Commands you will need

| Purpose   | Command                                       | Expected          |
|-----------|-----------------------------------------------|-------------------|
| Typecheck | `bunx tsc --noEmit`                           | exit 0            |
| Unit test | `bun run test -- src/queries/stripe.test.ts`  | all pass          |
| Unit test | `bun run test -- src/queries/user.test.ts`    | all pass          |
| Lint      | `bun run lint`                                | exit 0 (warns ok) |

## Scope

**In scope**:
- `src/queries/stripe.ts` — `createStripePayment` signature + server-side re-fetch
- `src/components/store/cards/payment/stripe/stripe-payment.tsx` — update the call to pass only what the server needs
- `src/queries/user.ts` — `placeOrder` address-ownership check
- `src/queries/stripe.test.ts`, `src/queries/user.test.ts` — tests
- `plans/README.md` — update plan 003 status when complete

**Out of scope**:
- The signed webhook handlers (`src/app/api/webhooks/stripe/route.ts`) — already authoritative; do not change.
- PayPal capture (`src/queries/paypal.ts`) — separate surface; note but don't touch.
- The `PaymentDetails.amount` unit inconsistency (Stripe cents vs PayPal dollars) — that is a separate finding (CORRECTNESS-05); do not attempt it here.
- Migrating `placeOrder` / `createStripePayment` auth to auth-guards.

## Git workflow

- Branch: `advisor/003-server-side-payment-trust`
- Commit style: `fix(payment): derive stripe state server-side; verify address ownership`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Change `createStripePayment` to accept an id and re-fetch from Stripe

Change the signature from `(orderId: string, paymentIntent: PaymentIntent)` to `(orderId: string, paymentIntentId: string)`. Immediately after the order-ownership check, retrieve the authoritative intent:

```ts
export const createStripePayment = async (
    orderId: string,
    paymentIntentId: string
) => {
    try {
        const user = await currentUser();
        if (!user) throw new Error("Unauthenticated.");

        const order = await db.order.findUnique({ where: { id: orderId, userId: user.id } });
        if (!order) throw new Error("Order not found.");

        // 権威的なソースは Stripe。クライアント値ではなく retrieve した intent から導出する。
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        // この intent が当該 order のものであることを検証（metadata.orderId は intent 作成時に付与）。
        if (paymentIntent.metadata?.orderId !== orderId) {
            throw new Error("Payment intent does not match order.");
        }
        // ... existing upsert/update, now reading from the retrieved paymentIntent ...
```

The rest of the function body stays structurally the same — but every `paymentIntent.*` now refers to the **retrieved** object, so `amount`, `currency`, and `status` are Stripe-authoritative. Do not otherwise change the upsert/update shape.

> **Stripe-authoritative is not the same as "matches this order".** The retrieve call proves the
> intent's own values, not that they agree with what the order is owed. Reconcile them explicitly
> before the upsert — otherwise an intent whose `amount` differs from `order.total` (or a non-`usd`
> currency) is recorded as this order's payment:
>
> ```ts
> // metadata が正しくても amount/currency が食い違う intent を弾く
> const expectedAmount = toStripeAmount(order.total);
> if (paymentIntent.amount !== expectedAmount || paymentIntent.currency !== "usd") {
>     throw new Error("Payment intent amount/currency mismatch.");
> }
> ```
>
> `toStripeAmount` must be the **same** Decimal-based helper used at intent creation
> (`order.total.mul(100).toDecimalPlaces(0).toNumber()`), or creation and verification drift apart.
>
> **Already shipped, do not re-derive**: `src/queries/stripe.ts` now also (a) records the active
> intent id at creation and requires a match at capture, and (b) refuses transitions out of a
> settled `paymentStatus` — closing the "old Pending/canceled intent downgrades a Paid order"
> hole that metadata+amount+currency alone leaves open. See the Round 10 ledger entry CR-03 in
> [`audit/VETTED_FINDINGS.md`](audit/VETTED_FINDINGS.md).

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 2: Update the client caller to pass the id only

In `src/components/store/cards/payment/stripe/stripe-payment.tsx` (call site ~line 60), change `createStripePayment(orderId, paymentIntent)` to pass the id: `createStripePayment(orderId, paymentIntent.id)`. Leave the rest of the Stripe.js confirmation flow unchanged.

If the component no longer references the full `paymentIntent` object elsewhere, keep the local variable — Stripe.js still returns it from `confirmPayment`. Only the server-action argument changes.

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 3: Verify shipping-address ownership in `placeOrder`

In `src/queries/user.ts`, inside `placeOrder`, after the cart is loaded (after line ~442) and **before** the `$transaction` that creates the order, add an ownership check:

```ts
// shippingAddress の所有権検証（IDOR 防止: 他ユーザーの住所 id を注文に付けさせない）
const ownedAddress = await db.shippingAddress.findFirst({
    where: { id: shippingAddress.id, userId },
});
if (!ownedAddress) throw new Error("Shipping address not found.");
```

Then **derive every address value the rest of the flow uses from `ownedAddress`, not from the client-supplied `shippingAddress`** — `ownedAddress.countryId` for the shipping-fee lookup and `ownedAddress.id` for `shippingAddressId` on the order.

> **Do not keep reading `shippingAddress.countryId`.** The ownership check above only proves that
> `shippingAddress.id` belongs to the caller — it says nothing about the other fields on the
> client-supplied object. A caller can send their **own** address `id` together with a **forged**
> `countryId` and pass the check unchanged. `countryId` drives
> `getDeliveryDetailsForStoreByCountry`, so a forged value selects another country's shipping rate:
> the IDOR is closed while the shipping-fee manipulation stays open. Ownership of the id is not
> integrity of the row — re-read the row and use the server's values.

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 4: Tests — Stripe server-side derivation

In `src/queries/stripe.test.ts`:
- Mock the `stripe` client's `paymentIntents.retrieve` to return a controlled intent.
- **Happy path**: retrieve returns `{ id, status: "succeeded", amount, currency, metadata: { orderId } }`; assert the order is updated to `paymentStatus: "Paid"` and `PaymentDetails.amount`/`currency` come from the retrieved object.
- **Forgery/regression**: the client passes an id whose retrieved intent has `metadata.orderId` **not** equal to `orderId`; assert it throws `"Payment intent does not match order."` and `db.order.update` is **not** called.
- **Not succeeded**: retrieved `status: "requires_payment_method"` → order `paymentStatus: "Failed"`.

Confirm the mock for the `stripe` module includes `paymentIntents.retrieve: jest.fn()`.

**Verify**: `bun run test -- src/queries/stripe.test.ts` → all pass.

### Step 5: Tests — address ownership in `placeOrder`

In `src/queries/user.test.ts`, in the `placeOrder` describe:
- **Regression**: `mockDb.shippingAddress.findFirst.mockResolvedValue(null)` → `placeOrder` rejects with `"Shipping address not found."` and no `$transaction` / `order.create` runs.
- **Happy path**: `findFirst` returns the owned address → order proceeds (keep existing happy-path expectations working; add the `findFirst` mock to their setup).

If `mockDb.shippingAddress` lacks `findFirst`, add `findFirst: jest.fn()` to that mock.

**Verify**: `bun run test -- src/queries/user.test.ts` → all pass.

### Step 6: Full typecheck + lint

**Verify**: `bunx tsc --noEmit` → exit 0; `bun run lint` → exit 0.

## Test plan

- `stripe.test.ts`: happy path (Paid from retrieved intent), forgery rejection (metadata mismatch → throw, no order update), failed status.
- `user.test.ts`: address-ownership rejection (findFirst null → throw, no transaction) and happy path.
- Structural pattern: existing describe blocks in each test file; IDOR-rejection style from `docs/testing/SECURITY_GAP_REPORT.md` §5.2 (throw + no side effect).
- Verification: both test commands pass with the new tests.

## Done criteria

ALL must hold:

- [ ] `bunx tsc --noEmit` exits 0
- [ ] `bun run test -- src/queries/stripe.test.ts` exits 0; forgery-rejection test present and passing
- [ ] `bun run test -- src/queries/user.test.ts` exits 0; address-ownership test present and passing
- [ ] `grep -n "paymentIntents.retrieve" src/queries/stripe.ts` shows the server-side re-fetch
- [ ] `grep -n "shippingAddress.findFirst" src/queries/user.ts` shows the ownership check
- [ ] `createStripePayment` signature takes `paymentIntentId: string` (not `PaymentIntent`)
- [ ] Before the **code commit**, no files outside the in-scope list are modified (`git status`) — the `plans/README.md` status-row update lands in a separate docs commit
- [ ] `plans/README.md` status row for 003 updated

## STOP conditions

Stop and report if:

- Any "Current state" excerpt doesn't match live code (drift).
- The `stripe` client export in `src/queries/stripe.ts` is not reusable in `createStripePayment` (e.g. it's created inside `createStripePaymentIntent` only) — report so the initialization can be lifted first.
- Removing the `PaymentIntent`-typed argument breaks a second caller you can't see — report the caller.
- Tests fail twice after reasonable fixes.
- The `metadata.orderId` on the retrieved intent turns out to be absent in the test fixtures for legitimate flows (means intent creation isn't stamping metadata as the excerpt claims) — report before weakening the match check.

## Maintenance notes

- This makes the signed webhook and this action agree on `amount`/`currency` source (both Stripe-authoritative), reducing drift risk. The `PaymentDetails.amount` unit mismatch across providers (CORRECTNESS-05) was **out of scope here and has since been split in two**: the **code** defect is fixed (`e63474b6`, 2026-07-19 — all four Stripe write sites now store `order.total` in dollars, and `toStripeAmount()` is used only for values handed to the Stripe API), and the remaining **historical rows** written in minor units are tracked as `plans/063-backfill-stripe-payment-amount.md` (P2, TODO). The "still open / plan it separately" wording that used to sit here predates both and is retracted — the out-of-scope line 129 above is step text frozen at `f9752c0` and is not the current status.
- Reviewer should confirm no `paymentIntent.status`/`.amount` is read from the argument after the change — only from the retrieved object.
- If PayPal capture (`paypal.ts`) is later hardened the same way, mirror this pattern (server-side re-fetch + order match).
- Follow-up deferred: the older 3-arg logging in `stripe.ts` (convert to structured logging in a tech-debt pass). Currency-unit normalization is **no longer deferred here** — see the CORRECTNESS-05 note above (code done, data backfill = plan 063).

### Divergence since this plan shipped (2026-07-18)

This plan is **DONE** (merged as PR #158) **for its original scope only** —
server-side Stripe re-fetch and address-ownership `findFirst`. The steps above
record the work as planned at commit `f9752c0` and are deliberately left
unedited. Two points (**1–2**) have since *moved in the code*, so do **not** read
the step text as the current spec. Three further points (**3–5**) are
follow-ups beyond the original scope: **5** (the address-ownership TOCTOU) is
now **RESOLVED** — a row lock inside the order `tx`, landed 2026-07-31; **3–4**
remain open gaps this plan's DONE status does not close. Treat 3–4 as tracked
gaps, not completed work:

1. **`requires_payment_method` is no longer an unconditional `Failed`.**
   Step 4 (line ~231) expects that status to map to `paymentStatus: "Failed"`.
   `src/queries/stripe.ts` now branches on `last_payment_error`: the status is
   returned both for "declined, re-enter a method" *and* for "no payment method
   attached yet", so status alone cannot distinguish failure from an untouched
   intent. Confirming `Failed` on the initial state would block the retry.
   Current mapping: `last_payment_error ? "Failed" : "Pending"`.
2. **The cents conversion is shared, and no longer float-based.** The excerpt at
   lines 79-84 shows `Math.round(order.total.toNumber() * 100)` at creation
   time. Both creation and verification now call one helper,
   `toStripeAmount()` (`stripe.ts:52`), implemented as
   `total.mul(100).toDecimalPlaces(0).toNumber()` per the `Prisma.Decimal`
   requirement in `.claude/steering/tech.md`. Deriving the expected amount
   differently at verification time than at creation time is what makes a
   legitimate payment fail the `paymentIntent.amount !== expectedAmount` guard.
3. **Address-ownership coverage should assert non-use of client fields.** The
   Step 5 tests (lines ~239-247) pin the *rejection* path (`findFirst` → null)
   and the happy path, which a regression that silently kept reading
   `shippingAddress.<field>` from the argument would still pass. The durable
   assertion is that the persisted order carries the **DB-fetched** address —
   e.g. have `findFirst` resolve an address whose fields differ from the
   client-supplied object and assert the stored values match the DB row, not
   the argument.
4. **Amount/currency reconciliation needs its own regression test.** The Step 4
   list (line ~230) pins metadata-mismatch and status mapping but not the
   `paymentIntent.amount !== expectedAmount || currency !== "usd"` guard
   (lines 174-178). Add a case: retrieved intent with matching `metadata.orderId`
   but a mismatched amount (or non-`usd` currency) must throw
   `"Payment intent amount/currency mismatch."` with no `order.update`.
5. **The address-ownership read should sit inside the order transaction.**
   **Status: code fix landed (2026-07-31) — real-DB verification still deferred.**
   The two halves are tracked separately on purpose: the statement now takes the
   right lock (verified by unit test), but "PostgreSQL actually blocks the
   concurrent writer" has not been executed against a real database. Reading this
   as a flat RESOLVED would retire an open verification item that is still open —
   see the *Not covered by unit tests* note at the end of this entry.
   Step 3 (lines 202-209) did the `findFirst`
   *before* the `$transaction`, leaving a TOCTOU window where the address could be
   deleted/reassigned between the check and the `order.create`. `placeOrder`
   (`src/queries/user.ts`) now takes a **row lock inside the same `tx`**,
   immediately before writing `shippingAddressId`: a `$queryRaw`
   `SELECT "id" FROM "ShippingAddress" WHERE "id" = … AND "userId" = … FOR UPDATE`,
   throwing `"Shipping address not found."` when it returns no row. Regression: a
   unit test drives an empty lock result and asserts the statement is a `FOR UPDATE`
   scoped by both columns, with no `order.create`.

   > **How each half of the threat closes.** The two halves close by different
   > mechanisms, which is why the earlier plain re-read was not enough:
   >
   > - **Deletion — closed by the FK.** Inserting the `Order` row makes PostgreSQL
   >   take a `FOR KEY SHARE` lock on the referenced `ShippingAddress` row
   >   (`Order.shippingAddressId` → `ShippingAddress.id`,
   >   `prisma/schema.prisma:513-514`). That lock conflicts with `DELETE`, so a
   >   concurrent delete of the checked address blocks until this transaction
   >   commits. (Separately: the relation is `onDelete: Cascade`, so a delete
   >   *after* commit removes the order too — a retention concern, not a TOCTOU one.)
   > - **`userId` reassignment — closed by the explicit `FOR UPDATE`.** This half was
   >   the one that stayed open under the earlier `tx.shippingAddress.findFirst`,
   >   which compiles to a **plain `SELECT` and takes no row lock at all**; an
   >   `UPDATE … SET "userId" = …` does not touch the referenced key column, so it
   >   takes `FOR NO KEY UPDATE` and **does not conflict with the FK's
   >   `FOR KEY SHARE`**. `FOR UPDATE` does conflict with it, so a concurrent
   >   reassignment now blocks until this transaction commits. And because
   >   PostgreSQL re-evaluates the predicate once the lock is granted (EvalPlanQual),
   >   a reassignment that committed *first* drops the row from the result and the
   >   call throws.
   >
   > The alternative considered and not taken was `Serializable` +
   > `retryOnSerializationFailure` (`src/lib/db-retry.ts`). It would have applied to
   > the whole `placeOrder` transaction — product fetches, shipping-fee computation,
   > stock decrements — raising the abort rate of a long transaction to close a
   > two-statement window. The row lock is scoped to the row that is actually
   > contended.
   >
   > **Not covered by unit tests.** The mock boundary can only pin the shape of the
   > statement, not that PostgreSQL blocks a concurrent writer. Real concurrency
   > belongs in `tests/integration/` (testcontainers) — tracked in the deferred list
   > of [`plans/README.md`](README.md).

Later payment work built on this plan: `plans/059` (PayPal capture verification,
which reuses the shared `isSettledPaymentStatus` from `src/lib/payment-status.ts`
— **not** re-exported from this module) and the 2026-07-18 CodeRabbit Phase 1
round (idempotency key + compare-and-set on the status write) — see
`docs/testing/COVERAGE_REPORT.md §7`.
