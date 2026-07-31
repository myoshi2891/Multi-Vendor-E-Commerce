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

> **`ratio IS NULL` is a fourth bucket, not a member of "neither".** `NULLIF(o.total, 0)` returns
> NULL for zero-total orders, so `ratio` is NULL for them. Under SQL three-valued logic a NULL
> ratio satisfies **neither** `ratio ≈ 100` **nor** `ratio NOT BETWEEN 0.99 AND 1.01` — such rows
> are silently absent from every range-based count. They therefore (a) escape the Step 4 update and
> (b) escape the Step 5 verification, so a cents-valued row on a zero-total order would be left
> uncorrected *and* reported as clean. Enumerate them explicitly:
>
> ```sql
> -- zero-total 注文（ratio が計算不能）を必ず別立てで列挙する
> SELECT pd.id, pd."paymentIntentId", pd.amount, o.total, pd."createdAt"
> FROM "PaymentDetails" pd
> JOIN "Order" o ON o.id = pd."orderId"
> WHERE pd."createdAt" < :deploy_boundary
>   AND pd."paymentMethod" = 'Stripe'
>   AND (o.total IS NULL OR o.total = 0);
> ```
>
> Each such row must be resolved by hand (the order total itself is likely the defect) or recorded
> as unresolved with a reason. Do not let them fall through the range predicates unnoticed.

### Step 3: Produce a dry-run report and get human approval

Write the Step 2 result to a file and summarise:

- total candidate rows, and how many have `ratio ≈ 100` / `ratio ≈ 1` / neither / **`ratio IS NULL`
  (zero-total orders)** — the four buckets must sum to the candidate total, which is the arithmetic
  check that no row was silently dropped by three-valued logic
- **the exact count of rows the Step 4 `UPDATE` is expected to affect** (the `ratio ≈ 100` bucket),
  **together with a checksum of that bucket's `id` set**. Both are what the approver signs off on,
  and Step 4 compares against both before `COMMIT`.

  ```sql
  -- Step 4 が同じ述語で再計算して突合する。件数と id 集合の両方を出す。
  SELECT count(*)                                                       AS will_update,
         md5(coalesce(string_agg(pd.id::text, ',' ORDER BY pd.id), '')) AS candidate_digest
  FROM   "PaymentDetails" pd
  JOIN   "Order" o ON o.id = pd."orderId"
  WHERE  pd."createdAt" < :deploy_boundary
    AND  pd."paymentMethod" = 'Stripe'
    AND  pd.amount / NULLIF(o.total, 0) BETWEEN 99 AND 101;
  ```

  > **なぜ件数だけでは足りないか。** 承認と実行の間は非同期に空くので、その間に候補集合が
  > **入れ替わる**ことがある —— 1 行が手作業で修正されて候補から外れ、別の 1 行が新たに
  > 候補へ入れば、**件数は一致したまま対象行が違う**。件数の一致は「承認された行に対して
  > UPDATE した」ことを含意しない。`ORDER BY` 付きの `string_agg` は id 集合を決定論的な
  > 1 文字列へ畳むので、集合が 1 行でも変われば digest が変わる。
  >
  > `coalesce(…, '')` は候補 0 件のときに `string_agg` が NULL を返し、`md5(NULL)` = NULL に
  > なって**比較が常に不成立（NULL）になる**のを避けるため。0 件は 0 件として
  > 決定論的な digest（空文字列の md5）を持つべきで、「比較不能」に落としてはいけない。
- the min/max `createdAt` of the rows to be updated
- the total monetary delta the update will apply
- **the unresolved zero-total list — an enumeration, not a count.** For the `ratio IS NULL` bucket,
  list **every row's `paymentDetails.id` / `orderId` / `pd.amount` / `o.total` together with the
  reason it is being left unresolved** (e.g. fully coupon-discounted order, test/seed row,
  cancelled before capture). This list is an **approval artifact in its own right** — the approver
  signs off on *which specific rows* stay unresolved, not merely on how many.

  > **なぜ件数では足りないか。** Step 5 の合格条件 2 は `null_ratio` を「承認済みの未解決リスト」と
  > 突き合わせ、さらに **id レベルで一致すること**を要求する（件数一致だけでは「解決した行」と
  > 「新たに壊れた行」が相殺して同数になる経路を排除できないため）。その突合先となる
  > **id のリストが成果物として定義されていなければ、Step 5 の条件は実行不能**になる
  > ——「承認済みの未解決リスト」という参照先が存在しないまま参照されている状態だった。
  > ここで列挙を成果物に含めることで、Step 5 の比較対象が一意に定まる。
  >
  > 各行に**理由**を要求するのは、zero-total が「正当（全額クーポン等）」と
  > 「別のバグ（`total` が書かれていない）」の両方を含みうるためである。理由を書かせると
  > 後者は承認の時点で表面化し、`ratio IS NULL` バケットに紛れて恒久的に見逃されることを防げる。

**Stop here and present the report.** Per
[`.claude/steering/tech.md`](../.claude/steering/tech.md), destructive or corrective production
writes require explicit human approval via the `safe-migration` skill. Do not proceed on your own
judgement, even if every row looks unambiguous.

### Step 4: Apply the correction inside a transaction

Only after approval. Use a corrective migration (never edit an existing migration file):

```sql
BEGIN;

-- 1) 影響行数**と対象 id 集合の digest** を UPDATE の前に確定させる
--    （述語は下の UPDATE と完全に同一にすること）
SELECT count(*)                                                       AS will_update,
       md5(coalesce(string_agg(pd.id::text, ',' ORDER BY pd.id), '')) AS candidate_digest
FROM   "PaymentDetails" pd
JOIN   "Order" o ON o.id = pd."orderId"
WHERE  pd."createdAt" < :deploy_boundary
  AND  pd."paymentMethod" = 'Stripe'
  AND  pd.amount / NULLIF(o.total, 0) BETWEEN 99 AND 101;

-- 2) **件数と digest の両方**を Step 3 の承認済みレポートと突合する。
--    どちらか一方でも違えば ROLLBACK; してここで中断する（承認の前提が崩れているため）。
--    digest が要るのは、承認から実行までの間に 1 行が候補を外れ 1 行が候補に入ると
--    **件数は一致したまま対象行が入れ替わる**ため。件数一致は行集合の同一性を含意しない。

-- 3) 両方一致した場合のみ UPDATE を実行する
UPDATE "PaymentDetails" pd
SET    amount = pd.amount / 100
FROM   "Order" o
WHERE  o.id = pd."orderId"
  AND  pd."createdAt" < :deploy_boundary
  AND  pd."paymentMethod" = 'Stripe'                        -- Step 2 と同じ肯定形の述語
  AND  pd.amount / NULLIF(o.total, 0) BETWEEN 99 AND 101;   -- ratio ≈ 100 のみ

-- 4) psql が返す `UPDATE <n>` の n が 1) の will_update と一致することを確認する。
--    不一致なら ROLLBACK;（並行書き込みが入った可能性がある）

COMMIT;
```

The count-and-digest check is **not optional bookkeeping**. Between the Step 3 report and the Step 4
execution an unbounded amount of time passes — the approval is asynchronous by design. New Stripe
rows written in that window sit after `:deploy_boundary` and cannot match, but a manual data edit or
a restored backup can change the candidate set underneath the approval. `COMMIT`ting a row set
nobody approved defeats the purpose of the approval gate.

> **The count alone cannot detect that.** A count is a lossy summary of a set: if one row is fixed
> by hand (leaving the `ratio ≈ 100` bucket) while another regresses into it, the count is
> unchanged and the comparison passes — while the rows actually updated are not the rows that were
> approved. The `md5(string_agg(id ORDER BY id))` digest is what makes the check about *which rows*
> rather than *how many*, and any single-row difference changes it.

> Run this in a session where a failed comparison can actually stop the script. Do **not** paste the
> whole block into `psql` at once — the `COMMIT` at the bottom would execute regardless of what the
> comparison showed, which is exactly the failure the check exists to prevent.

The `ratio BETWEEN 99 AND 101` predicate makes the update **self-guarding and idempotent**: a row
already in dollars has `ratio ≈ 1` and cannot match, so re-running the statement is a no-op rather
than a second division by 100. This matters more than it looks — an accidental double-run without
that predicate would divide correct rows by 100 and turn a recoverable overstatement into an
understatement that no longer has a clean signal to detect it.

### Step 5: Verify

Re-run the Step 2 query. Every row must now show `ratio ≈ 1`, **and the `ratio IS NULL` bucket must
be counted separately** — a range predicate alone cannot see it (see the three-valued-logic note
in Step 2).

**The two counts have different pass conditions and must not be summed.** Merging them (a single
`still_wrong` with `OR ratio IS NULL`) contradicts Step 2, which explicitly permits a zero-total row
to be **recorded as unresolved with a reason** rather than fixed. Under the merged form any such
approved exception keeps `still_wrong` above zero forever, so CORRECTNESS-05 could never be closed
even though the plan was followed exactly as written.

```sql
-- 1 クエリ 2 カウント（同一行集合の上で測るため、取りこぼしが起きない）。
--   still_wrong : 範囲外。**0 でなければ不合格**
--   null_ratio  : zero-total（ratio 計算不能）。Step 3 で承認済みの未解決リストと**件数一致**が条件
-- NULL は範囲比較では検出できないため、FILTER 句で明示的に分けて数える。
SELECT
    count(*) FILTER (
        WHERE pd.amount / NULLIF(o.total, 0) NOT BETWEEN 0.99 AND 1.01
    ) AS still_wrong,
    count(*) FILTER (
        WHERE pd.amount / NULLIF(o.total, 0) IS NULL
    ) AS null_ratio
FROM   "PaymentDetails" pd
JOIN   "Order" o ON o.id = pd."orderId"
WHERE  pd."createdAt" < :deploy_boundary
  AND  pd."paymentMethod" = 'Stripe';
```

Verification passes only when **both** hold:

1. `still_wrong` = **0**（例外を認めない。範囲外の行が残っていれば backfill は未完）
2. `null_ratio` = **Step 3 の「unresolved zero-total list」**（承認済み成果物）の件数と**一致**
   （0 とは限らない。ただし「承認された件数」より多ければ、承認外の行が紛れているので不合格）

比較先は Step 3 で**列挙され承認された当のリスト**であり、件数だけの報告ではない。
`null_ratio` が承認件数と一致することに加え、**`ratio IS NULL` で残った行の id 集合が
承認リストの id 集合と完全一致する**ことを確認すること（件数一致だけでは、解決した行と
新たに壊れた行が相殺して同数になる可能性を排除できない）。集合として突き合わせるには
Step 3 が id を列挙していることが前提であり、そのためにあの列挙を承認成果物にしている。

Record the before/after counts in `docs/PROGRESS.md` and close the CORRECTNESS-05 entry in
`plans/README.md`.

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
- [ ] The Step 5 query satisfies **both** of its counts, judged separately (they must not be summed
      — see "Verification passes only when both hold" in Step 5):
      **(a)** `still_wrong = 0` (out-of-range rows admit no exception), **and**
      **(b)** `null_ratio` equals the count of the approved "unresolved zero-total list" from Step 3
      — not necessarily 0 — with the surviving `ratio IS NULL` **id set** matching that list, not
      merely its cardinality. `still_wrong` does **not** cover the NULL bucket: the `NOT BETWEEN`
      FILTER is three-valued, so a NULL ratio is neither true nor false and never counted there.
- [ ] Rows that were neither `≈1` nor `≈100` are enumerated and individually resolved, or
      explicitly recorded as unresolved with a reason.
- [ ] **Rows with `ratio IS NULL` (zero-total orders) are enumerated and individually resolved, or
      explicitly recorded as unresolved with a reason.** These never match the Step 4 predicate, so
      "the update reported 0 affected rows" is not evidence that they were correct.
- [ ] The four report buckets (`≈100` / `≈1` / neither / NULL) sum to the total candidate count.
- [ ] The Step 4 pre-`UPDATE` count **and `candidate_digest`** both matched the approved report,
      and the `UPDATE <n>` echo matched the count as well. The digest is required, not a nicety:
      equal counts do not prove the same rows — one row leaving the bucket while another enters
      keeps the count identical while changing what gets written.
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
