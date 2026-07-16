# Plan 005: Fix cart integrity — atomic `saveUserCart` and single-source persist in the cart store

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f9752c0..HEAD -- src/queries/user.ts src/cart-store/useCartStore.ts src/cart-store/useCartStore.test.ts src/queries/user.test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts to live code; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness
- **Planned at**: commit `f9752c0`, 2026-07-03

## Why this matters

Two independent cart-persistence bugs each cause silent data loss:

1. **Server (`saveUserCart`)** deletes the existing cart and then creates the new one in two separate awaits with **no transaction**. If the `create` fails after the `delete` committed, the user's server-side cart is gone. This also violates the repo rule "multi-table updates must use `db.$transaction`".
2. **Client (`useCartStore`)** manually calls `localStorage.setItem('cart', JSON.stringify(updatedCart))` on removal and `localStorage.removeItem('cart')` on empty. But the store uses Zustand's `persist` middleware on the same `'cart'` key, which writes a wrapped `{"state":{...},"version":0}` shape. The manual writes clobber that wrapper with a bare array, so after removing an item and reloading, `persist` fails to rehydrate and the cart resets/corrupts. The bug is invisible within a session because in-memory state looks correct.

Both are small, surgical fixes with clear regression tests.

## Current state

### Server: `src/queries/user.ts` (`saveUserCart`)

Non-atomic delete-then-create, `src/queries/user.ts:251-285` (as of `f9752c0`):

```ts
// 検証成功後に既存カートを削除（検証前に削除するとエラー時にカート消失）
if (userCart) {
    await db.cart.delete({ where: { userId } });
}

// Save the validated items to the cart in the database
const cart = await db.cart.create({
    data: {
        cartItems: { create: validatedCartItems.map((item) => ({ /* ... */ })) },
        shippingFees: shippingFee,
        subTotal,
        total,
        userId,
    },
});

if (cart) return true
```

The comment already shows awareness that ordering matters — but delete and create are still separate transactions. A failure between them loses the cart.

### Client: `src/cart-store/useCartStore.ts`

The store is created with `persist(..., { name: 'cart' })` (line 256) from `zustand/middleware` (import line 3). Three manual localStorage calls conflict with it:

```ts
// removeFromCart — line 206
localStorage.setItem('cart', JSON.stringify(updatedCart))

// removeMultipleFromCart — line 231
localStorage.setItem('cart', JSON.stringify(updatedCart))

// emptyCart — line 240
localStorage.removeItem('cart')
```

`persist` already writes the `'cart'` key whenever `set(...)` runs, so these lines are both redundant and corrupting. Each of the three actions already calls `set(() => ({ cart: updatedCart, totalItems, totalPrice }))` immediately before the manual localStorage line — so removing the manual line loses nothing; `persist` handles it.

### Repo conventions

- **`db.$transaction` is mandatory** for multi-table writes (`.claude/steering/tech.md`). `cart.delete` + `cart.create` (with nested `cartItems.create`) qualifies.
- Cart store tests live at `src/cart-store/useCartStore.test.ts` (co-located, per the testing rules). `saveUserCart` tests are in `src/queries/user.test.ts` (describe starts line 217).
- Do not change the validation, pricing, or shipping-fee logic in `saveUserCart` — only wrap the delete+create atomically.

## Commands you will need

| Purpose        | Command                                          | Expected          |
|----------------|--------------------------------------------------|-------------------|
| Typecheck      | `bunx tsc --noEmit`                              | exit 0            |
| Store test     | `bun run test -- src/cart-store/useCartStore.test.ts` | all pass    |
| Server test    | `bun run test -- src/queries/user.test.ts`      | all pass          |
| Lint           | `bun run lint`                                   | exit 0 (warns ok) |

## Scope

**In scope**:
- `src/queries/user.ts` — `saveUserCart` transaction wrap
- `src/cart-store/useCartStore.ts` — remove 3 manual localStorage calls
- `src/queries/user.test.ts` — atomicity test
- `src/cart-store/useCartStore.test.ts` — persist-integrity assertion

**Out of scope**:
- `placeOrder` double-submit / idempotency (that is plan 006).
- The `totalPrice` float summation in the store (`sum + item.price * item.quantity`) — a separate money-precision concern; do not change it here.
- Any other `db.cart.*` call site.

## Git workflow

- Branch: `advisor/005-cart-integrity`
- Commit style: `fix(cart): make saveUserCart atomic and stop clobbering persist storage`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Wrap `saveUserCart` delete+create in a transaction

In `src/queries/user.ts`, replace the separate `db.cart.delete(...)` and `db.cart.create(...)` (lines ~251-285) with a single `db.$transaction`:

```ts
const cart = await db.$transaction(async (tx) => {
    if (userCart) {
        await tx.cart.delete({ where: { userId } });
    }
    return tx.cart.create({
        data: {
            cartItems: { create: validatedCartItems.map((item) => ({ /* unchanged */ })) },
            shippingFees: shippingFee,
            subTotal,
            total,
            userId,
        },
    });
});

if (cart) return true;
```

Keep the `cartItems.create` mapping and all field values exactly as they are — only the transaction wrapper is new. Now if `create` fails, the `delete` rolls back and the old cart survives.

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 2: Remove the manual localStorage calls in the cart store

In `src/cart-store/useCartStore.ts`, delete these three lines (and their preceding `// ...localStorage...` comments):
- line ~206: `localStorage.setItem('cart', JSON.stringify(updatedCart))` in `removeFromCart`
- line ~231: `localStorage.setItem('cart', JSON.stringify(updatedCart))` in `removeMultipleFromCart`
- line ~240: `localStorage.removeItem('cart')` in `emptyCart`

Do **not** remove the `set(() => ({ ... }))` calls that precede them — those drive `persist`. The `emptyCart` action must still `set` cart to `[]` (it already does at line 234-238); `persist` then writes the empty state under the wrapper.

**Verify**: `bunx tsc --noEmit` → exit 0 and `grep -n "localStorage" src/cart-store/useCartStore.ts` returns no matches.

### Step 3: Test — server transaction wiring (not real rollback)

> **Scope of this unit test**: a mocked `db.$transaction` does **not** prove real DB atomicity or
> rollback — it only proves the code routes delete+create *through* `$transaction` and propagates a
> rejection from inside the callback. Actual rollback-on-error must be verified by an integration
> test against a real DB (that belongs to the integration-test series, e.g. plans 027/031, per
> `docs/testing/SECURITY_GAP_REPORT.md` §5.2's mock-vs-integration split). Word the test's
> description accordingly — do not claim it "proves atomicity".

In `src/queries/user.test.ts`, in the `saveUserCart` describe (line ~217), add a test proving the delete+create is **wired through a single `$transaction`** and that a callback rejection surfaces:
- Mock `db.$transaction` to invoke its callback with a `tx` where `tx.cart.create` **rejects**; assert `saveUserCart(...)` rejects and the operation does not report success (the delete+create are issued via the transaction callback, not as independent top-level calls).
- Adjust existing happy-path tests: they currently likely mock `db.cart.delete` / `db.cart.create` directly. Since the code now calls `db.$transaction(cb)`, make the mock `db.$transaction.mockImplementation(async (cb) => cb(mockTx))` where `mockTx.cart.delete`/`create` are jest fns — mirror how other transaction-using tests in this repo mock it (search the file for existing `$transaction` mock usage; `order.test.ts` uses the `callback(mockDb)` passthrough pattern).

**Verify**: `bun run test -- src/queries/user.test.ts` → all pass.

### Step 4: Test — client persist integrity

In `src/cart-store/useCartStore.test.ts`, add a test that after `removeFromCart`, the persisted `'cart'` localStorage entry is the **wrapped** persist shape, not a bare array:
```ts
// after adding then removing an item via the store actions
const raw = localStorage.getItem('cart');
expect(raw).toBeTruthy();
const parsed = JSON.parse(raw as string);
expect(parsed).toHaveProperty('state');       // persist wrapper, not a bare array
expect(Array.isArray(parsed)).toBe(false);
```
Follow the existing test setup in this file for how the store + localStorage are initialized (jsdom provides `localStorage`). If the existing tests reset storage in `beforeEach`, keep that.

**Verify**: `bun run test -- src/cart-store/useCartStore.test.ts` → all pass.

### Step 5: Full typecheck + lint

**Verify**: `bunx tsc --noEmit` → exit 0; `bun run lint` → exit 0.

## Test plan

- Server: transaction-rollback test (create fails → no success) + adjusted happy path using the `$transaction` mock.
- Client: persist-wrapper-integrity test after removal (asserts wrapped shape) + confirm empty-cart leaves a valid persisted empty state.
- Structural patterns: `saveUserCart` describe in `user.test.ts`; existing cart action tests in `useCartStore.test.ts`.
- Verification: both test commands pass with the new tests.

## Done criteria

ALL must hold:

- [ ] `bunx tsc --noEmit` exits 0
- [ ] `grep -n "localStorage" src/cart-store/useCartStore.ts` returns no matches
- [ ] `grep -n "db.\$transaction" src/queries/user.ts` shows `saveUserCart` now wraps delete+create
- [ ] `bun run test -- src/queries/user.test.ts` exits 0; atomicity test present
- [ ] `bun run test -- src/cart-store/useCartStore.test.ts` exits 0; persist-integrity test present
- [ ] `bun run lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 005 updated

## STOP conditions

Stop and report if:

- The `saveUserCart` or cart-store code doesn't match the "Current state" excerpts (drift).
- Removing the manual localStorage calls breaks a test that asserts on the bare-array shape — that test encodes the bug; update it to the wrapped shape, but if it's unclear, report.
- The cart store turns out to read the bare-array `'cart'` key somewhere on init (a manual rehydrate outside `persist`) — report before removing the writes.
- Tests fail twice after reasonable fixes.

## Maintenance notes

- If a future feature needs to hydrate the cart from the server, do it through `setCart`/`persist`, never by writing the `'cart'` localStorage key directly — that reintroduces this corruption.
- Reviewer should confirm `persist` is the *only* writer of the `'cart'` key after this change.
- The store's `totalPrice` still uses float summation; if money precision becomes a concern, that's a separate Decimal migration (not in this plan).
