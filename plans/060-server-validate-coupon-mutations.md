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

> **`discount` must also be constrained to integers.** `CouponFormSchema.discount` is
> `z.number().min(1).max(99)` — it accepts `50.5`, but the column is `Int`, so a fractional value
> passes the `safeParse` gate only to be rejected/truncated at the Prisma boundary. Add `.int()`
> (`z.number().int().min(1).max(99)`) so the range check and the storage type agree at the same
> boundary. **✅ 完了（2026-07-26）**: `src/lib/schemas.ts` の `CouponFormSchema.discount` に
> `.int()` を追加済み。`AdminCouponFormSchema` は `CouponFormSchema.extend()` のため継承する
> （`discount` を再定義していないことを確認済み）。回帰テストは `src/queries/coupon.test.ts` の
> 「小数の discount は拒否され、DB 書き込みが発生しない」×2（seller / admin 経路）。
> Red 時点では admin 経路が **reject せず resolve** していた（`50.5` が Int 列まで到達）。

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

  > **⚠️ Cross-plan collision — `code` rejects hyphens, and
  > [`plans/041`](041-integration-test-coupon-code-uniqueness.md):298-300 depends on one.**
  > `^[A-Za-z0-9]+$` has no `-`, so once this plan puts a `safeParse` gate in front of the coupon
  > mutations, `code: "ADMIN-CLASH"` is rejected as a **validation** error. Plan 041's scenario 5
  > asserts a **P2002 unique-constraint** conversion (`"このクーポンコードは既に使用されています"`)
  > and counts rows to prove no side effect — with the gate in place the call never reaches the
  > database, so 041 tests validation instead of the uniqueness path it was written for, while
  > still passing on the surface (both paths throw).
  >
  > **Resolution: 041 changes its fixture code to an alphanumeric value (e.g. `ADMINCLASH`)** —
  > the hyphen is incidental to that test, which is about *collision*, not about punctuation.
  > Do **not** relax `^[A-Za-z0-9]+$` to accommodate it: the regex is the shipped form contract,
  > and widening it here would let the UI and the server action disagree.
  >
  > That edit belongs to 041's own execution and is **out of scope for this plan** (a test plan
  > does not silently rewrite another plan's fixtures). If 041 has already run when this plan is
  > executed, treat the now-misdirected scenario 5 as a finding and report it.
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
- `src/lib/schemas.ts` — add `.int()` to `CouponFormSchema.discount` (see the note in
  "Why this matters"). `CouponFormSchema`/`AdminCouponFormSchema` are already exported, so no
  export change is needed.
- `plans/README.md` — the 060 status-row update required by the Executor instructions and Done
  criteria; land it in a **separate docs commit** after the code commit (not with the code diff)

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
> keys on it).
>
> **id semantics — settled, no longer a STOP condition (2026-07-30).** An earlier revision said
> "if unsure, STOP and report rather than guessing the id semantics". That question is answered by
> the shipped implementation and by both call sites, so do not stop on it:
>
> - **The client always generates the id.** Both coupon forms send `id: data?.id ?? v4()` —
>   seller: [`coupon-details.tsx:59`](../src/components/dashboard/forms/coupon-details.tsx),
>   admin: [`admin-coupon-details.tsx:89`](../src/components/dashboard/forms/admin-coupon-details.tsx).
>   `coupon.id` is therefore never `""` / `undefined`: an edit reuses the row's id, a new coupon
>   carries a fresh UUID. Prisma's `@default(uuid())` fallback is never exercised on this path.
> - **The shipped code matches.** `upsertCouponAsAdmin` (`src/queries/coupon.ts:513-515`) passes
>   `id: coupon.id` in `create` only, with the comment
>   `// id はフォーム側で常にクライアント生成される (data?.id ?? v4())`.
> - Consequence for the `where`: `{ id: coupon.id }` never matches on a create, so the upsert takes
>   the `create` branch — which is why the id must be present there.
>
> If a **new** caller ever omits `id`, that is a change to this contract and needs its own plan
> (dropping `id` from `create` to let `@default(uuid())` run is the fix, not a local guess).

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

### Added after this plan shipped (keep in the regression set)

> These landed in later reviews against the same schema/guard this plan introduced. They are
> listed here so the coupon-validation regression set is discoverable from one place — a reader
> comparing `coupon.test.ts` against the five cases above would otherwise treat them as strays.

- **fractional `discount` (2026-07-26)** — `discount: 50.5` must be rejected on **both** the
  seller (`upsertCoupon`) and admin (`upsertCouponAsAdmin`) paths, with no DB write.
  The original five cases only pinned the `min(1)` / `max(99)` **range**, so `50.5` passed
  `safeParse` and was carried to the Prisma boundary, where `Coupon.discount` is `Int`.
  `CouponFormSchema.discount` now carries `.int()` (`src/lib/schemas.ts`) so the range check and
  the storage-type check sit at the same boundary. `AdminCouponFormSchema` inherits it via
  `.extend()`. (+2)

- **validation errors must not be wrapped (2026-07-27)** — the rejection message must be
  *exactly* `クーポンの入力値が不正です。`, not
  `Error occurred while trying to upsert coupon: クーポンの入力値が不正です。`.
  **Assert with an anchored regex** (`/^…$/`), not `toThrow(string)`: the substring match of the
  latter passes against the wrapped form, which is precisely why the defect survived the five
  cases above. Same for the duplicate-code message, and one case pins that a user input mistake
  emits no `logError`. (+4)

## Done criteria

ALL must hold:

> 下記のチェックは **2026-07-27 に再実測**したもの（`safeParse` は `coupon.ts:83` /
> `:448`、`.int()` は `schemas.ts:549`、`...coupon` スプレッドは 0 ヒットを確認）。

- [x] `bunx tsc --noEmit` exits 0
- [x] `upsertCoupon` and `upsertCouponAsAdmin` each call `safeParse` on the incoming coupon and
      throw before any `db.coupon.upsert` when validation fails
- [x] Neither action still writes via `{ ...coupon }` spread — fields are mapped explicitly from
      `parsed.data` (+ server-forced `storeId`/`scope`)
- [x] `grep -n "\.\.\.coupon" src/queries/coupon.ts` → no matches inside the upsert `update`/`create`
      objects (verify the spread is gone from the write path)
- [x] `bun run test -- src/queries/coupon.test.ts` passes with the new discount-range tests
- [x] `CouponFormSchema.discount` (and `AdminCouponFormSchema.discount`) carry `.int()`
      (`z.number().int().min(1).max(99)`) so the range check and the `Int` storage type agree at the
      same boundary, with a test that rejects a fractional value (e.g. `50.5`)
      (`grep -n "discount" src/lib/schemas.ts` shows `.int()` on the coupon discount)
- [x] `bun run lint` exits 0
- [x] No files outside the in-scope list are modified (`git status`)
- [x] `plans/README.md` status row for 060 updated

## STOP conditions

Stop and report (do not improvise) if:

- The code at `coupon.ts:33-91` or `:381-405` doesn't match the "Current state" excerpts (drift).
- `CouponFormSchema.safeParse(coupon)` fails on a **valid** coupon during the happy-path test — that
  means the `Coupon` object shape diverges from the schema (e.g. dates are not strings after all);
  report the actual field types before adapting the schema.
- ~~The new-coupon `id` semantics are unclear (is `coupon.id` empty for creates?)~~ —
  **removed 2026-08-02: this contradicted this same document.** The "id semantics — settled,
  no longer a STOP condition (2026-07-30)" note at `:215-231` already resolved the question
  (both forms send `id: data?.id ?? v4()`, so `coupon.id` is never empty, and
  `upsertCouponAsAdmin` passes `id` in the `create` branch only). Leaving the STOP condition
  in place told the executor to halt on something the plan had already answered 3 lines-worth
  of prose earlier — the most expensive kind of self-contradiction, because stopping is the
  one outcome that produces no work. If a **new** caller ever omits `id`, that is a change to
  the contract and needs its own plan, per the note's closing paragraph.
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
