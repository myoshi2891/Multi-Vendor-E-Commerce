# Plan 063: Backfill `PaymentDetails.amount` for Stripe rows written in minor units

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **This plan writes to production payment data.** It is gated on the
> `safe-migration` skill and on an explicit human approval of the affected row
> set. Do **not** run any `UPDATE` before Step 3 has produced a reviewed dry-run report.
>
> **Drift check (run first)**:
>
> ```bash
> git diff --stat e63474b6 -- src/queries/stripe.ts prisma/schema.prisma
> git status --porcelain -- src/queries/stripe.ts
> ```
>
> If `src/queries/stripe.ts` no longer writes `order.total` into `PaymentDetails.amount`,
> or `PaymentDetails.amount` is no longer `Decimal(12,2)`, the premise below has changed —
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: MED (production payment data)
- **Depends on**: none (the code fix already shipped in `e63474b6`)
- **Category**: correctness
- **Planned at**: commit `b84eb9d9`, 2026-07-27

## Why this matters

`PaymentDetails.amount` is `Decimal(12,2)` — **dollars**
([`prisma/schema.prisma:699`](../prisma/schema.prisma)). PayPal always wrote dollars and was
correct from the start. The Stripe path wrote `paymentIntent.amount`, which is Stripe's
**minor unit** (cents), so a `$99.99` order was recorded as `9999.00`.

The code defect was fixed in `e63474b6` (2026-07-19, Round 14) — all four Stripe write sites now
store `order.total`. **What remains is the historical data**: every `PaymentDetails` row created
by the Stripe path *before* that commit still holds a cents value in a dollars column, i.e. it
overstates the payment by 100×.

This is tracked in [`plans/README.md`](README.md) under **CORRECTNESS-05**, where it was recorded
as "残るのは既存行の backfill のみで、これは未起票". This plan exists to make that remainder
executable rather than leaving it buried in a Deferred paragraph — a data-correctness item with no
plan number does not appear in any status table and is easy to lose across rounds.

Impact of leaving it: any aggregate over `PaymentDetails.amount` that spans the fix date mixes two
units. Revenue reporting, per-user payment history, and refund reconciliation all silently combine
`9999.00` and `99.99` rows for equivalent orders.

## Current state

- `src/queries/stripe.ts` writes `amount: order.total` (`Prisma.Decimal`, dollars) at all write
  sites. `toStripeAmount()` remains for values handed to the Stripe API, which legitimately wants
  minor units.
- `src/queries/paypal.ts` writes dollars and was never affected.
- `prisma/schema.prisma:699` — `amount Decimal @db.Decimal(12, 2)`.
- No migration has touched existing rows.

## Scope

**In scope**: a one-off corrective backfill of `PaymentDetails` rows created by the Stripe path
before `e63474b6`, plus the query used to identify them and the record of what was changed.

**Out of scope**:

- `src/queries/stripe.ts` / `paypal.ts` — the code is already correct. Do **not** modify.
- `toStripeAmount()` — correct as-is (Stripe API takes minor units).
- Any change to `PaymentDetails.amount`'s column type.
- PayPal rows.

## Steps

### Step 1: Establish the cutover boundary

Find the deployment time of `e63474b6`, not just its commit time — rows written between commit and
deploy are still affected.

```bash
git show -s --format='%H %cI %s' e63474b6
```

Record both the commit timestamp and the actual production deploy timestamp (from the hosting
provider's deployment log). **The deploy timestamp is the boundary**; using the commit timestamp
alone under-selects rows.

### Step 2: Identify affected rows (read-only)

Selecting on `createdAt < boundary` alone is **not sufficient** — it would also sweep in the
PayPal rows, which are already correct. Constrain to the Stripe path.

```sql
-- Read-only. Produces the candidate set and a magnitude check per row.
SELECT pd.id,
       pd."paymentIntentId",
       pd."paymentMethod",
       pd.amount        AS stored_amount,
       o.total          AS order_total,
       pd.amount / NULLIF(o.total, 0) AS ratio,
       pd."createdAt"
FROM "PaymentDetails" pd
JOIN "Order" o ON o.id = pd."orderId"
WHERE pd."createdAt" < :deploy_boundary
  AND pd."paymentMethod" = 'Stripe'
ORDER BY pd."createdAt";
```

`paymentMethod = 'Stripe'` is safe as a **positive** predicate: `src/queries/stripe.ts` has written
the literal `"Stripe"` at every write site since the original integration (`7fca45c0`), and
`git log -S'paymentMethod: "Stripe"'` shows no other value ever reached the column.

**Do not invert it into "everything that is not PayPal".** The PayPal path wrote `"Paypal"`
(lower-case `a`) until `d8f770d2` (2026-05-29), so rows predating that commit would escape a
`!= 'PayPal'` filter and be swept into the update. If a row's provenance is still ambiguous, fall
back to the `paymentIntentId` shape — Stripe intents are prefixed `pi_`.

The `ratio` column is the decision signal: affected rows should land at **≈100**, correct rows at
**≈1**. Any row that is neither is an anomaly — it must be listed in the report and excluded from
the automated update, then handled by hand.

### Step 3: Produce a dry-run report and get human approval

Write the Step 2 result to a file and summarise:

- total candidate rows, and how many have `ratio ≈ 100` / `ratio ≈ 1` / neither
- the min/max `createdAt` of the rows to be updated
- the total monetary delta the update will apply

**Stop here and present the report.** Per
[`.claude/steering/tech.md`](../.claude/steering/tech.md), destructive or corrective production
writes require explicit human approval via the `safe-migration` skill. Do not proceed on your own
judgement, even if every row looks unambiguous.

### Step 4: Apply the correction inside a transaction

Only after approval. Use a corrective migration (never edit an existing migration file):

```sql
BEGIN;

-- 影響行数を先に確認してから UPDATE する（想定件数と一致しなければ ROLLBACK）
UPDATE "PaymentDetails" pd
SET    amount = pd.amount / 100
FROM   "Order" o
WHERE  o.id = pd."orderId"
  AND  pd."createdAt" < :deploy_boundary
  AND  pd."paymentMethod" = 'Stripe'                        -- Step 2 と同じ肯定形の述語
  AND  pd.amount / NULLIF(o.total, 0) BETWEEN 99 AND 101;   -- ratio ≈ 100 のみ

COMMIT;
```

The `ratio BETWEEN 99 AND 101` predicate makes the update **self-guarding and idempotent**: a row
already in dollars has `ratio ≈ 1` and cannot match, so re-running the statement is a no-op rather
than a second division by 100. This matters more than it looks — an accidental double-run without
that predicate would divide correct rows by 100 and turn a recoverable overstatement into an
understatement that no longer has a clean signal to detect it.

### Step 5: Verify

Re-run the Step 2 query. Every row must now show `ratio ≈ 1`. Record the before/after counts in
`docs/PROGRESS.md` and close the CORRECTNESS-05 entry in `plans/README.md`.

## Test plan

This is a data migration, not a code change, so the guarantees come from the query rather than
from Jest:

- The Step 2 query is run **before and after** and its `ratio` distribution compared.
- The Step 4 statement is exercised in a local/staging database seeded with both a cents-valued row
  and a dollars-valued row, asserting the dollars row is untouched.
- Idempotency: run Step 4 twice on the staging data and confirm the second run reports 0 rows.

## Done criteria

ALL must hold:

- [ ] The deploy boundary (not merely the commit timestamp) is recorded in this plan.
- [ ] The Step 2 query returns 0 rows with `ratio` outside `[0.99, 1.01]` after the backfill.
- [ ] Rows that were neither `≈1` nor `≈100` are enumerated and individually resolved, or
      explicitly recorded as unresolved with a reason.
- [ ] Step 4 was run twice on staging and the second run reported 0 affected rows.
- [ ] Human approval for the production write is recorded (who, when, on which report).
- [ ] `plans/README.md` CORRECTNESS-05 entry updated to reflect the closed remainder.
- [ ] No files under `src/` were modified.

## STOP conditions

- The deploy timestamp of `e63474b6` cannot be established from deployment logs — guessing the
  boundary risks both under- and over-selecting rows.
- The production data contains `paymentMethod` values other than `'Stripe'`, `'PayPal'` and
  `'Paypal'`, and `paymentIntentId` does not disambiguate them either — the candidate set cannot be
  constrained safely.
- More than a handful of rows fall outside both `ratio ≈ 1` and `ratio ≈ 100`, suggesting a third
  unit convention or unrelated corruption. Report rather than improvise a rule.
- Any refund/reconciliation process reads `PaymentDetails.amount` and would be disturbed
  mid-flight by the update — coordinate a window first.

## Maintenance notes

- The root cause was a unit mismatch between an external API's convention (Stripe minor units) and
  the column's declared type. When adding a new payment provider, assert the unit at the write
  boundary rather than trusting the SDK's field name.
- The shape that allowed this was writing a bare `number` from an SDK response
  (`amount: paymentIntent.amount`) into a `Decimal(12,2)` column: Prisma accepts the `number`
  without complaint, so nothing at the type level flagged the unit change. The fix routes
  `order.total` — already a `Prisma.Decimal` — to the column unconverted, which is also what
  `.claude/steering/tech.md`（金額・数値精度）requires.
