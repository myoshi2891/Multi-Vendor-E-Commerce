# Plan 003: Derive Stripe payment state server-side and verify shipping-address ownership

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f9752c0..HEAD -- src/queries/stripe.ts src/queries/user.ts src/queries/stripe.test.ts src/queries/user.test.ts src/components/store/cards/payment/stripe/stripe-payment.tsx`
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

Keep using `shippingAddress.countryId` / `shippingAddress.id` as before for the rest of the flow — the check just gates it. (Optionally use `ownedAddress.countryId` to be fully server-sourced, but the existing `shippingAddress.countryId` is acceptable since ownership is now proven.)

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
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 003 updated

## STOP conditions

Stop and report if:

- Any "Current state" excerpt doesn't match live code (drift).
- The `stripe` client export in `src/queries/stripe.ts` is not reusable in `createStripePayment` (e.g. it's created inside `createStripePaymentIntent` only) — report so the initialization can be lifted first.
- Removing the `PaymentIntent`-typed argument breaks a second caller you can't see — report the caller.
- Tests fail twice after reasonable fixes.
- The `metadata.orderId` on the retrieved intent turns out to be absent in the test fixtures for legitimate flows (means intent creation isn't stamping metadata as the excerpt claims) — report before weakening the match check.

## Maintenance notes

- This makes the signed webhook and this action agree on `amount`/`currency` source (both Stripe-authoritative), reducing drift risk — but the `PaymentDetails.amount` unit mismatch across providers (CORRECTNESS-05) is still open and should be planned separately.
- Reviewer should confirm no `paymentIntent.status`/`.amount` is read from the argument after the change — only from the retrieved object.
- If PayPal capture (`paypal.ts`) is later hardened the same way, mirror this pattern (server-side re-fetch + order match).
- Follow-up deferred: currency-unit normalization and the older 3-arg logging in `stripe.ts` (convert to structured logging in a tech-debt pass).
