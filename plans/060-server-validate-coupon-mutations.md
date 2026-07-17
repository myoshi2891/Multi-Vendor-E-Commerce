# Plan 060: Enforce server-side Zod validation on coupon mutations (block discount > 99% → negative order totals)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> ```bash
> git diff --stat d2aff76 -- src/queries/coupon.ts src/queries/coupon.test.ts src/lib/schemas.ts
> git status --porcelain -- src/queries/coupon.ts src/lib/schemas.ts
> ```
> Use `d2aff76` (not `d2aff76..HEAD`) so working-tree/staged changes are also seen.
> If any in-scope file changed since this plan was written, compare the "Current state"
> excerpts against live code first; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S–M
- **Risk**: LOW–MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `d2aff76`, 2026-07-17

## Why this matters

`upsertCoupon` and `upsertCouponAsAdmin` are `'use server'` actions that spread client-supplied
data straight into the database: `db.coupon.upsert({ ..., update: { ...coupon, ... } })`. They
enforce ownership (good) but **never validate the coupon fields server-side**. The form schema
`CouponFormSchema` constrains `discount` to `.min(1).max(99)`, but that runs only in the browser
form via `zodResolver` — the server action can be called directly, bypassing it.

Concrete cost: `discount` is a bare `Int` in the DB (`prisma/schema.prisma`: `discount Int`), so a
seller calling the action directly can persist `discount > 99`. Both `applyCoupon`
(`src/queries/coupon.ts:294`) and `placeOrder` (`src/queries/user.ts:679`) compute
`total.mul(discount).div(100)`, so a discount above 100 makes the discount exceed the item total and
drives an order group / order `total` **negative**. This is the sharp, money-critical instance of
the broader "server actions skip Zod" gap; this plan fixes coupons and establishes the pattern the
other actions (review, shipping address, product) can follow later.

## Current state

- **`upsertCoupon` — `src/queries/coupon.ts:33-91`** (signature `(coupon: Coupon, storeURL: string)`):

  ```ts
  export const upsertCoupon = async (coupon: Coupon, storeURL: string) => {
      const { store } = await requireStoreOwner(storeURL)            // ownership ok
      if (!coupon) throw new Error('Please provide coupon data.')
      // ... existingById ownership check (coupon.ts:51-61) ...
      // NO field validation here
      const couponDetails = await db.coupon.upsert({
          where: { id: coupon.id },
          update: { ...coupon, storeId: store.id, scope: 'STORE' },   // ← unvalidated spread
          create: { ...coupon, storeId: store.id, scope: 'STORE' },
      })
      return couponDetails
  }
  ```

- **`upsertCouponAsAdmin` — `src/queries/coupon.ts:381-405`** (signature `(coupon: Coupon)`):

  ```ts
  export const upsertCouponAsAdmin = async (coupon: Coupon) => {
      await requireAdmin()
      if (!coupon) throw new Error('Please provide coupon data.')
      const isPlatform = coupon.scope === 'PLATFORM'
      let normalizedStoreId: string | null = /* ... */
      const couponDetails = await db.coupon.upsert({
          where: { id: coupon.id },
          update: { ...coupon, storeId: normalizedStoreId },          // ← unvalidated spread
          create: { ...coupon, storeId: normalizedStoreId },
      })
      // ... P2002 handling ...
  }
  ```

- **The schemas that already encode the contract — `src/lib/schemas.ts:523-573`**:
  - `CouponFormSchema` (`:523`): `code` (2–50, `^[A-Za-z0-9]+$`), `startDate` (string), `endDate`
    (string), `discount` (`.number().min(1).max(99)`).
  - `AdminCouponFormSchema` (`:553`): extends `CouponFormSchema` with `isActive`, `scope`, `storeId`
    + a `superRefine` (STORE ⇒ storeId required; PLATFORM ⇒ storeId empty).

- **Prisma `Coupon` model** (`prisma/schema.prisma`): `startDate String`, `endDate String`,
  `discount Int`. **`startDate`/`endDate` are `String`, not `DateTime`** — so `CouponFormSchema`
  (which types them as `string`) is directly compatible with the `Coupon` object; no date coercion
  is needed. `z.object` **strips unknown keys** by default, so `.safeParse(coupon)` validates the
  four form fields and ignores `id`/`isActive`/`createdAt`/etc.

- **Exemplar — the `safeParse` gate in `src/queries/inventory.ts:99-102`**:

  ```ts
  const parsed = UpdateSizeStockSchema.safeParse({ sizeId, quantity });
  if (!parsed.success) {
      throw new Error("在庫数は 0 以上の整数で指定してください。");
  }
  ```

### Repo conventions that apply here

- **入力バリデーションは `src/lib/schemas.ts` の Zod スキーマ**（`.claude/steering/structure.md`）.
  Reuse the existing schemas; do not hand-roll `if (discount > 99)` checks.
- **認可ガードは `try/catch` の外**（already followed — keep the `requireStoreOwner`/`requireAdmin`
  calls before the try; put the `safeParse` gate after auth, before the DB write, matching
  `inventory.ts`).
- `any` banned; keep `catch (error: unknown)`. Structured logging via `logError`/`console.error`
  2-arg form already present — keep it.

## Commands you will need

| Purpose   | Command                                       | Expected on success        |
|-----------|-----------------------------------------------|----------------------------|
| Typecheck | `bunx tsc --noEmit`                           | exit 0, no errors          |
| Unit test | `bun run test -- src/queries/coupon.test.ts`  | all pass (incl. new tests) |
| Lint      | `bun run lint`                                | exit 0 (warnings ok)       |

## Scope

**In scope** (the only files you should modify):
- `src/queries/coupon.ts` — add `safeParse` gates + explicit field mapping in both upsert actions
- `src/queries/coupon.test.ts` — add tests
- `src/lib/schemas.ts` — **only if** you need to export `CouponFormSchema`/`AdminCouponFormSchema`
  (they are already exported — likely no change needed; confirm before editing)

**Out of scope** (do NOT touch):
- `applyCoupon` / `placeOrder` — do not change the discount *math*; this plan blocks bad data at the
  write boundary. The `cart.total` lost-update in `applyCoupon` is a separate known issue.
- `getCoupon` — that's plan 058.
- The other unvalidated mutations (review, shipping address, product) — SECURITY-15, deferred; this
  plan establishes the pattern but does not implement them.
- The `CouponToUser` usage-limit gap (SECURITY-24).

## Git workflow

- Branch: `advisor/060-server-validate-coupon`
- Commit style: `fix(security): validate coupon fields server-side (discount range)`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add a server-side validation gate to `upsertCoupon`

In `src/queries/coupon.ts`, after the ownership checks and before the `db.coupon.upsert`
(around `coupon.ts:79`), add:

```ts
// フォーム契約をサーバー側でも強制する（直接呼び出しで discount>99 等を回避させない）。
// z.object は未知キーを除去するため、Coupon 全体を渡して 4 フォームフィールドのみ検証される。
const parsed = CouponFormSchema.safeParse(coupon)
if (!parsed.success) {
    throw new Error('クーポンの入力値が不正です。')
}
```

Then replace the unvalidated spread with an explicit mapping that uses the **validated** values and
keeps the server-forced fields:

```ts
const couponDetails = await db.coupon.upsert({
    where: { id: coupon.id },
    update: {
        code: parsed.data.code,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        discount: parsed.data.discount,
        storeId: store.id,
        scope: 'STORE',
    },
    create: {
        id: coupon.id,
        code: parsed.data.code,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        discount: parsed.data.discount,
        storeId: store.id,
        scope: 'STORE',
    },
})
```

> Keep `id: coupon.id` only in `create` (upsert needs the id to create the row; the `where` already
> keys on it). If `id` is optional/absent for new coupons in the current flow, check how the
> existing code handles it — if `coupon.id` is `""`/undefined for new records, mirror whatever the
> current spread relied on (Prisma generates `@default(uuid())` when `id` is omitted). If unsure,
> STOP and report rather than guessing the id semantics.

Ensure `CouponFormSchema` is imported from `@/lib/schemas` at the top of `coupon.ts`.

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 2: Add a validation gate to `upsertCouponAsAdmin`

In `upsertCouponAsAdmin` (`coupon.ts:381-405`), after `requireAdmin()` and the `!coupon` check,
before computing `normalizedStoreId`, add:

```ts
const parsed = AdminCouponFormSchema.safeParse(coupon)
if (!parsed.success) {
    throw new Error('クーポンの入力値が不正です。')
}
```

Then use `parsed.data` for the validated form fields in the upsert (keep the existing
`normalizedStoreId` logic for `storeId`, and `parsed.data.scope`/`parsed.data.isActive` for those):

```ts
const couponDetails = await db.coupon.upsert({
    where: { id: coupon.id },
    update: {
        code: parsed.data.code,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        discount: parsed.data.discount,
        isActive: parsed.data.isActive,
        scope: parsed.data.scope,
        storeId: normalizedStoreId,
    },
    create: {
        id: coupon.id,
        code: parsed.data.code,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        discount: parsed.data.discount,
        isActive: parsed.data.isActive,
        scope: parsed.data.scope,
        storeId: normalizedStoreId,
    },
})
```

> `AdminCouponFormSchema` has a `superRefine` (STORE ⇒ storeId required). The existing
> `normalizedStoreId` logic already enforces the store-id rule and may throw its own
> `"Please provide a valid store ID."` — keep that; the schema check is an additional guard, not a
> replacement. Order them so the clearer error wins if both would fire (put `safeParse` first).

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 3: Tests

Add to `src/queries/coupon.test.ts` (mirror the existing `upsertCoupon` tests' auth-guard mocking).
Cover both actions:

- **rejects discount > 99** — `upsertCoupon({ ...validCoupon, discount: 150 }, "my-store")` rejects
  with the validation error, and `db.coupon.upsert` is **not called** (assert the mock had zero
  calls — the negative-total vector is blocked before any write).
- **rejects discount < 1** — same, with `discount: 0`.
- **rejects bad code** — e.g. `code: "!!"` (fails the `^[A-Za-z0-9]+$` regex) → rejects, no write.
- **happy path preserved** — a valid coupon still upserts, and the persisted `scope`/`storeId` are
  the server-forced values (`'STORE'` / owned store id), not client-supplied ones.
- **admin path** — `upsertCouponAsAdmin({ ...valid, discount: 150 })` rejects with no write.

**Verify**: `bun run test -- src/queries/coupon.test.ts` → all pass, including the new cases.

## Test plan

- New tests: the five cases above (three negative, one happy, one admin).
- Structural pattern: existing `upsertCoupon` tests in `coupon.test.ts`.
- Verification: `bun run test -- src/queries/coupon.test.ts` all pass.

## Done criteria

ALL must hold:

- [ ] `bunx tsc --noEmit` exits 0
- [ ] `upsertCoupon` and `upsertCouponAsAdmin` each call `safeParse` on the incoming coupon and
      throw before any `db.coupon.upsert` when validation fails
- [ ] Neither action still writes via `{ ...coupon }` spread — fields are mapped explicitly from
      `parsed.data` (+ server-forced `storeId`/`scope`)
- [ ] `grep -n "\.\.\.coupon" src/queries/coupon.ts` → no matches inside the upsert `update`/`create`
      objects (verify the spread is gone from the write path)
- [ ] `bun run test -- src/queries/coupon.test.ts` passes with the new discount-range tests
- [ ] `bun run lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 060 updated

## STOP conditions

Stop and report (do not improvise) if:

- The code at `coupon.ts:33-91` or `:381-405` doesn't match the "Current state" excerpts (drift).
- `CouponFormSchema.safeParse(coupon)` fails on a **valid** coupon during the happy-path test — that
  means the `Coupon` object shape diverges from the schema (e.g. dates are not strings after all);
  report the actual field types before adapting the schema.
- The new-coupon `id` semantics are unclear (is `coupon.id` empty for creates?) — report rather than
  guessing; a wrong id mapping could overwrite the wrong row.
- Typecheck or tests fail twice after a reasonable fix attempt.

## Maintenance notes

- This is the reference implementation for **SECURITY-15** (the broader server-side-validation gap).
  The follow-up plans for `upsertReview` (`AddReviewSchema`), `upsertShippingAddress`
  (`ShippingAddressSchema`), and `upsertProduct` (`ProductFormSchema`) should copy this
  `safeParse`-then-explicit-map pattern — but note `upsertProduct` takes a `ProductWithVariantType`
  whose schema/type diff needs reconciling (do not assume it's as clean as coupons).
- Reviewer should confirm no code path still spreads client data into the write, and that the
  discount range is enforced by the schema (not a hand-rolled `if`).
- If a future migration changes `Coupon.startDate`/`endDate` to `DateTime`, this validation must
  switch to `z.coerce.date()` — it currently relies on them being `String`.
