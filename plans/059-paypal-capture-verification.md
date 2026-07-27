# Plan 059: Verify amount/order/currency and guard settled status in PayPal capture (Stripe parity)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> ```bash
> git diff --stat d2aff76 -- src/queries/paypal.ts src/queries/stripe.ts src/queries/paypal.test.ts
> git status --porcelain -- src/queries/paypal.ts src/queries/stripe.ts
> ```
> Use `d2aff76` (not `d2aff76..HEAD`) so working-tree/staged changes are also seen.
> If any in-scope file changed since this plan was written, compare the "Current state"
> excerpts against the live code first; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `d2aff76`, 2026-07-17

## Why this matters

The Stripe capture path (`confirmStripePayment` in `src/queries/stripe.ts`) treats Stripe as the
authoritative source: it refuses already-settled orders, and it verifies the retrieved
PaymentIntent's `metadata.orderId`, `amount`, and `currency` against the order before marking it
`Paid`. **The PayPal capture path (`capturePayPalPayment` in `src/queries/paypal.ts`) does none of
this.** It checks order ownership (good) but then confirms `paymentStatus: "Paid"` from the capture
response **without verifying the captured amount, the order correlation (`custom_id`), the currency,
or whether the order was already settled**.

Concrete cost: because the capture only binds `orderId` (server-supplied) and `paymentId`
(client-supplied) loosely, a user can drive a PayPal order created for a **cheap** order into the
capture of an **expensive** order, so an expensive order flips to `Paid` on an underpayment; and a
late/`DENIED` capture can regress an already-`Paid`/`Refunded` order to `Failed`. This plan brings
PayPal to parity with the Stripe guards. The authoritative values already exist: `createPayPalPayment`
(`paypal.ts:82-92`) stamps `custom_id: orderId`, `amount.value: order.total.toFixed(2)`,
`currency_code: "USD"` when creating the PayPal order.

## Current state

- **The Stripe guards to mirror — `src/queries/stripe.ts:182-216`**:

  ```ts
  if (isSettledPaymentStatus(order.paymentStatus)) {
      throw new Error("Order payment is already settled.");
  }
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (paymentIntent.metadata?.orderId !== orderId) {
      throw new Error("Payment intent does not match order.");
  }
  const expectedAmount = toStripeAmount(order.total);
  if (paymentIntent.amount !== expectedAmount || paymentIntent.currency !== "usd") {
      throw new Error("Payment intent amount/currency mismatch.");
  }
  ```

- **The settled-status helper — `src/queries/stripe.ts:63-71`** (currently **module-private**):

  ```ts
  const SETTLED_PAYMENT_STATUSES: readonly PaymentStatus[] = [ /* ... */ ];
  const isSettledPaymentStatus = (status: PaymentStatus): boolean =>
      SETTLED_PAYMENT_STATUSES.includes(status);
  ```

- **The unguarded PayPal capture — `src/queries/paypal.ts:157-283`**:
  - `paypal.ts:159-164` fetches `order` scoped to `{ id: orderId, userId: user.id }` (ownership ok).
    `order.total` is a `Prisma.Decimal` and is in scope for the rest of the function.
  - `paypal.ts:207` — `const captureData = await captureResponse.json();`
  - `paypal.ts:210-218` — on non-`COMPLETED` status, unconditionally sets `paymentStatus: "Failed"`
    (no settled-status guard).
  - `paypal.ts:222-281` — upserts `paymentDetails` and sets `paymentStatus: "Paid"` **with no
    amount/custom_id/currency verification**. The capture amount is read at
    `paypal.ts:232-238` as `captureData.purchase_units[0].payments.captures[0].amount.value` /
    `.currency_code`.

- **The authoritative values (set at creation) — `src/queries/paypal.ts:82-92`**:

  ```ts
  purchase_units: [{
      custom_id: orderId,
      amount: { currency_code: "USD", value: order.total.toNumber().toFixed(2) },
  }],
  ```

### Repo conventions that apply here

- **金額は `Prisma.Decimal`**（`.claude/steering/tech.md`「金額・数値精度」）. Compare the captured
  string value to `order.total` with a `Prisma.Decimal` comparison, not float `===`. Only call
  `.toNumber()`/`.toFixed()` at the comparison boundary, never accumulate.
- **認可ガードは `try/catch` の外**（already followed in this function — the ownership fetch and its
  guards precede the capture `try` at `paypal.ts:186`). Add the settled-status check in the same
  pre-`try` region, right after `if (!order) throw new Error("Order not found");` (`paypal.ts:181`).
- **外部呼び出しは `try/catch`**（the PayPal `fetch` is already wrapped — keep it).
- `any` is banned; keep `catch (error: unknown)`.
- `Prisma` and `PaymentStatus` are imported from `@prisma/client` in these files already — confirm
  the import before use.

## Commands you will need

| Purpose   | Command                                     | Expected on success        |
|-----------|---------------------------------------------|----------------------------|
| Typecheck | `bunx tsc --noEmit`                         | exit 0, no errors          |
| PayPal test | `bun run test -- src/queries/paypal.test.ts` | all pass (incl. new tests) |
| Stripe test | `bun run test -- src/queries/stripe.test.ts` | all pass (unchanged)       |
| Lint      | `bun run lint`                              | exit 0 (warnings ok)       |

## Scope

> **⚠️ この節と Steps は 2026-07-18 時点で一部 superseded。** 下の
> [Divergence since this plan shipped](#divergence-since-this-plan-shipped-2026-07-18) を
> **先に読むこと**。具体的には、以下 2 点はここに書かれているとおりには shipped していない:
>
> - `isSettledPaymentStatus` は `stripe.ts` から export **されていない**（`stripe.ts` は
>   `"use server"` で、同期ヘルパーの export は無効なため）。実際は
>   `src/lib/payment-status.ts` に置かれている。
> - したがって下の Out of scope「共有 `payment-status.ts` を導入するな / STOP して報告せよ」は
>   **無効**。共有モジュールが正しい設計として既に shipped 済みで、STOP 条件ではない。
>
> 本節は当時の計画として保存してあり、現状の仕様ではない。

**In scope** (the only files you should modify):
- `src/queries/stripe.ts` — **export** `isSettledPaymentStatus` (and `SETTLED_PAYMENT_STATUSES` if
  needed) so PayPal can reuse the single source of truth. **This is the only change to stripe.ts —
  add `export`, change no logic.**
- `src/queries/paypal.ts` — add settled guard + capture verification
- `src/queries/paypal.test.ts` — add tests

**Out of scope** (do NOT touch):
- Stripe capture logic — it is the reference implementation; do not refactor it.
- The webhook status-overwrite issue (SECURITY-17) — separate deferred finding; do not change
  `src/app/api/webhooks/paypal/route.ts` here.
- The PayPal sandbox URL hardcoding (`paypal.ts:189`) — a previously-rejected finding (SECURITY-07);
  leave it.
- Introducing a shared `payment-status.ts` util — exporting from `stripe.ts` is sufficient and
  lower-risk. If you think a shared module is warranted, STOP and report instead.

## Git workflow

- Branch: `advisor/059-paypal-capture-verification`
- Commit style: `fix(security): verify amount/order/currency in PayPal capture`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Export the settled-status helper from `stripe.ts`

In `src/queries/stripe.ts:70`, change `const isSettledPaymentStatus` to
`export const isSettledPaymentStatus`. (Export `SETTLED_PAYMENT_STATUSES` too only if your import
needs it — the function alone is enough.) Change nothing else in `stripe.ts`.

**Verify**:
- `bunx tsc --noEmit` → exit 0
- `bun run test -- src/queries/stripe.test.ts` → all pass (no behavior change)

### Step 2: Add the settled-status guard to `capturePayPalPayment`

In `src/queries/paypal.ts`, import the helper:
`import { isSettledPaymentStatus } from "@/queries/stripe";` (verify no import cycle is introduced —
if `stripe.ts` imports from `paypal.ts`, STOP and report; the cheap alternative is to duplicate the
small constant, but confirm the cycle first).

Immediately after `if (!order) throw new Error("Order not found");` (`paypal.ts:181`) and **before**
the capture `try` (`paypal.ts:186`), add:

```ts
// 確定済み決済は capture 応答で上書きしない（Paid/Refunded を古い/DENIED capture で退行させない）。
if (isSettledPaymentStatus(order.paymentStatus)) {
    throw new Error("Order payment is already settled.");
}
```

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 3: Verify amount / custom_id / currency before confirming Paid

After `const captureData = await captureResponse.json();` (`paypal.ts:207`) and the
`captureData.status !== "COMPLETED"` branch, but **before** the `paymentDetails.upsert`
(`paypal.ts:222`), add verification against the authoritative `order`:

```ts
const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0];
const capturedValue = capture?.amount?.value;
const capturedCurrency = capture?.amount?.currency_code;
// custom_id は purchase_units[0].custom_id（作成時に orderId を格納）に載る。
// PayPal の応答バージョンによっては capture 側にも複製されるため両方を許容する。
const capturedCustomId =
    captureData.purchase_units?.[0]?.custom_id ?? capture?.custom_id;

if (capturedCustomId !== orderId) {
    throw new Error("PayPal capture does not match order.");
}
if (
    capturedCurrency !== "USD" ||
    capturedValue === undefined ||
    !new Prisma.Decimal(capturedValue).equals(order.total)
) {
    throw new Error("PayPal capture amount/currency mismatch.");
}
```

Place this so that a mismatch throws (and the order is **not** marked Paid). Confirm `Prisma` is
imported from `@prisma/client` at the top of `paypal.ts` (it is used elsewhere; add it if missing).

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 4: Tests

Add to `src/queries/paypal.test.ts` (this suite already mocks `db`, `fetch`, and `currentUser` —
follow its existing capture tests as the structural pattern). Cover:

1. **happy path** — capture COMPLETED with `custom_id === orderId`, `amount.value` equal to
   `order.total`, `currency_code "USD"` → order updated to `Paid` (existing behavior preserved).
2. **amount mismatch** — capture value ≠ `order.total` → throws
   `"PayPal capture amount/currency mismatch."`, and **no** `order.update` to `Paid` occurs.
3. **custom_id mismatch** — `custom_id !== orderId` → throws `"PayPal capture does not match order."`,
   no Paid update.
4. **already settled** — `order.paymentStatus` is a settled status → throws
   `"Order payment is already settled."` before any `fetch`/capture happens.
5. **currency mismatch** — `currency_code !== "USD"` → throws mismatch, no Paid update.

**Verify**: `bun run test -- src/queries/paypal.test.ts` → all pass, including the 4 new negative
cases.

## Test plan

- New tests: cases 2–5 above (case 1 likely already exists — keep/adjust it).
- Structural pattern: existing `capturePayPalPayment` tests in `src/queries/paypal.test.ts`.
- Verification: `bun run test -- src/queries/paypal.test.ts` all pass; `stripe.test.ts` unchanged
  and green.

## Done criteria

ALL must hold:

- [ ] `bunx tsc --noEmit` exits 0
- [ ] `isSettledPaymentStatus` is exported from `src/queries/stripe.ts` (only change to that file)
- [ ] `capturePayPalPayment` throws before capture when `order.paymentStatus` is settled
- [ ] `capturePayPalPayment` throws (and does not mark Paid) on amount, custom_id, or currency
      mismatch, verified against `order.total` / `orderId` / `"USD"`
- [ ] `bun run test -- src/queries/paypal.test.ts` passes with the new negative cases
- [ ] `bun run test -- src/queries/stripe.test.ts` still passes (no logic change)
- [ ] `bun run lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 059 updated

## STOP conditions

Stop and report (do not improvise) if:

- The code at `paypal.ts:157-283` or `stripe.ts:182-216` doesn't match the "Current state" excerpts
  (drift).
- Importing `isSettledPaymentStatus` from `stripe.ts` into `paypal.ts` creates an import cycle
  (stripe.ts already imports from paypal.ts) — report; do not force it.
- The PayPal capture response shape in the existing tests differs from
  `purchase_units[0].payments.captures[0].amount.value` — report the actual shape; the verification
  must read the amount from wherever the existing mark-Paid code reads it.
- Typecheck or tests fail twice after a reasonable fix attempt.

## Divergence since this plan shipped (2026-07-18)

This plan is **DONE**. The 2026-07-18 CodeRabbit Phase 1 round hardened the code
past what the steps describe, so do not read the step text as the current spec:

1. **The settled guard is atomic (CAS), not read-then-act.** Step 2 checks
   `isSettledPaymentStatus(order.paymentStatus)` and then updates — two statements
   with a TOCTOU window. The shipped `paypal.ts` folds the guard into the write's
   `where` (`paymentStatus: { notIn: [...SETTLED_PAYMENT_STATUSES] }`) and catches
   Prisma `P2025` as "already settled". The read-then-act check is kept only as an
   early return to skip a wasted PayPal API call.
2. **The settled helper is NOT exported from `stripe.ts`.** Steps 1-2 export
   `isSettledPaymentStatus` from `src/queries/stripe.ts`, but that module is
   `"use server"` and may only export async Server Actions — a **synchronous**
   helper exported there is invalid. The helper and `SETTLED_PAYMENT_STATUSES` now
   live in `src/lib/payment-status.ts`; both `stripe.ts` and `paypal.ts` import
   from there. The Scope note "do not introduce a shared `payment-status.ts` util"
   is therefore **superseded** — the shared module is the correct home and shipped.
3. **`custom_id` is validated before any status-driven write.** Step 3 verifies
   after the non-`COMPLETED` branch; the shipped code moved the `custom_id` match
   **ahead of** the `paymentStatus: "Failed"` write, so a mismatched PayPal order
   id cannot flip another user's order to Failed.
4. **Prefer verifying the PayPal order before invoking capture. Status: OPEN —
   not fixed by this plan.** The steps (and the shipped code) verify the capture
   response *after* money has already moved. Retrieving and matching the order
   (amount / `custom_id` / currency) *before* `capture` is the stronger shape.
   This is **not** covered by the webhook hardening (SECURITY-17): that path is
   explicitly out of scope here (see Maintenance notes below) and itself deferred,
   so the earlier "if not already covered" hedge does not apply — treat this as a
   tracked open follow-up. Do **not** record pre-capture order verification as
   resolved anywhere (plan index / security reports) until it lands.

## Maintenance notes

- If PayPal's capture response schema changes (`custom_id` location, captures array shape), the
  verification in Step 3 must be revisited — it defensively reads `custom_id` from two locations.
- The webhook path (`src/app/api/webhooks/paypal/route.ts`) has the **same class of gap**
  (unconditional status overwrite — SECURITY-17). This plan deliberately does not touch it; when
  that deferred finding is planned, reuse the exported `isSettledPaymentStatus` here.
- Reviewer should confirm the amount comparison uses `Prisma.Decimal.equals` (not float `===`) and
  that every mismatch path prevents the `Paid` update rather than merely logging.
