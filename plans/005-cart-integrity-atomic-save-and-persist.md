# Plan 005: Fix cart integrity — atomic `saveUserCart` and single-source persist in the cart store

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f9752c0..HEAD -- src/queries/user.ts src/cart-store/useCartStore.ts src/cart-store/useCartStore.test.ts src/queries/user.test.ts plans/README.md`
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
- `src/queries/user.test.ts` — transaction-wiring and rejection-propagation test
- `src/cart-store/useCartStore.test.ts` — persist-integrity assertion
- `plans/README.md` — update plan 005 status when complete

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
- Adjust existing happy-path tests: they currently likely mock `db.cart.delete` / `db.cart.create` directly. Since the code now calls `db.$transaction(cb)`, make the mock `db.$transaction.mockImplementation(async (cb) => cb(mockTx))` where `mockTx.cart.delete`/`create` are jest fns.

  > **⚠️ この段落の続きは訂正済み（2026-07-18）。原文の「ファイル内の既存 `$transaction`
  > モック使用箇所を検索して真似よ（`order.test.ts` の `callback(mockDb)` passthrough
  > パターン）」という指示には従わないこと。** テスト作成者ごとに別々のアドホックな
  > モックが生まれるため、下の「Corrections to the test steps」§1 で unsound と
  > 判定されている。**`tx` ダブルは `src/config/test-helpers.ts` から取り**、
  > ケースが足りなければそのモジュールを拡張する（`CLAUDE.md`「テスト構成」が定める
  > 共通テストインフラ）。原文はプランが DONE になった当時の記録として残すが、
  > 新しいテストへ複写しないこと。

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
Follow the existing test setup in this file for how the store + localStorage are initialized (this file installs a `localStorageMock` at the top and clears it in `beforeEach` — keep that).

**Then assert the round trip, not just the shape.** The shape check above is a proxy: it proves what
was written *looks* like the persist wrapper, not that the store can read it back. A payload can
satisfy `toHaveProperty('state')` and still fail to rehydrate (wrong `version`, a renamed key, a
`partialize` that drops the field). Since the whole point of this plan is that a persisted cart
survives a reload, verify it end-to-end:

> ⚠️ **この下のスニペットはそのまま貼らない — 空振りする。** 先に
> [「Corrections to the test steps」の 2 番](#corrections-to-the-test-steps-2026-07-18)
> を読み、そこの訂正版（in-memory state を破棄してから rehydrate する形）を使うこと。
> 以下は歴史的記録として残しているだけで、採用可能な手順ではない。

```ts
// ⚠️ 採用しない（空振り版）: 下の Corrections 2 の訂正スニペットを使う
// after mutating the cart via store actions
await useCartStore.persist.rehydrate();          // ← 同一インスタンスのまま = no-op でも通る
const rehydrated = useCartStore.getState();
expect(rehydrated.cart).toHaveLength(<expected>); // the items came back
expect(rehydrated.totalItems).toBe(<expected>);   // derived state recomputed, not stale
```

Assert the derived fields (`totalItems` / `totalPrice`) as well as `cart` — rehydrating the array
while leaving the totals at their defaults is exactly the regression this catches.

**Verify**: `bun run test -- src/cart-store/useCartStore.test.ts` → all pass.

### Step 5: Full typecheck + lint

**Verify**: `bunx tsc --noEmit` → exit 0; `bun run lint` → exit 0.

## Test plan

- Server: transaction-wiring/rejection-propagation test (create fails → no success) + adjusted happy path using the `$transaction` mock. Real rollback behavior remains an integration-test concern.
- Client: persist-wrapper-integrity test after removal (asserts wrapped shape) + confirm empty-cart leaves a valid persisted empty state.
- Structural patterns: `saveUserCart` describe in `user.test.ts`; existing cart action tests in `useCartStore.test.ts`.
- Verification: both test commands pass with the new tests.

## Done criteria

ALL must hold:

- [ ] `bunx tsc --noEmit` exits 0
- [ ] `grep -n "localStorage" src/cart-store/useCartStore.ts` returns no matches
- [ ] `grep -n "db.\$transaction" src/queries/user.ts` shows `saveUserCart` now wraps delete+create
- [ ] `bun run test -- src/queries/user.test.ts` exits 0; transaction-wiring and rejection-propagation test present
- [ ] `bun run test -- src/cart-store/useCartStore.test.ts` exits 0; persist-integrity test present
- [ ] `bun run lint` exits 0
- [ ] Before the **code commit**, no files outside the in-scope list are modified (`git status`) — the `plans/README.md` status-row update lands in a separate docs commit
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

### Corrections to the test steps (2026-07-18)

This plan is **DONE**; the steps are left as the historical record. Two
instructions in them are unsound and must **not** be copied into new tests:

1. **Step 3 defers the transaction-mock shape to "search the file".** Telling
   the executor to mirror whatever `$transaction` mocking already exists in the
   file produces a different ad-hoc mock per test author. This repo has shared
   test infrastructure for exactly this — `src/config/test-helpers.ts` (mock
   utilities), `test-fixtures.ts` (typed factories), `test-scenarios.ts`, and
   `test-config.ts` (see `CLAUDE.md` "テスト構成"). New transaction tests should
   take the `tx` double from there, and extend that module when it lacks a case,
   rather than re-deriving a local `callback(mockDb)` passthrough.

2. **Step 4's `rehydrate()` round trip does not prove what it claims.** The
   snippet calls `useCartStore.persist.rehydrate()` and then asserts on
   `useCartStore.getState()` — but that is the *same* store instance that just
   performed the mutation, so its in-memory state already holds the expected
   values. `rehydrate()` could be a complete no-op (or read a corrupt payload
   and bail) and every assertion would still pass. It cannot fail for the
   regression it was written to catch.

   To actually exercise a reload, the in-memory state must be discarded before
   rehydrating, so the values can only come back from storage:

   ```ts
   // after mutating the cart via store actions
   const persisted = localStorage.getItem('cart');       // capture what was written
   // null なら書き込み自体が起きていない = 検出すべき回帰。`as string` / `!` で握りつぶさず
   // 早期に失敗させて型も string に絞る。
   if (persisted === null) throw new Error('cart was not persisted before rehydrate');
   useCartStore.setState({ cart: [], totalItems: 0, totalPrice: 0 });  // simulate a fresh load
   localStorage.setItem('cart', persisted);              // string に絞り込み済み
   await useCartStore.persist.rehydrate();

   const rehydrated = useCartStore.getState();
   expect(rehydrated.cart).toHaveLength(<expected>);   // came back from storage
   expect(rehydrated.totalItems).toBe(<expected>);     // derived state recomputed
   ```

   Note the `beforeEach` at `src/cart-store/useCartStore.test.ts:54` already
   resets the store this way — the reset is the load-bearing part, not the
   `rehydrate()` call.

**Coverage gap — closed (2026-07-26)**: for a period this plan was marked DONE
while only the wrapper-shape assertions from the first half of Step 4 existed
(`useCartStore.test.ts:239`, `:274`, `:302`). Those assert what gets *written*
to storage; nothing read it back, so "a persisted cart survives a reload" — the
stated point of this plan — was unverified, and DONE overstated the result.

That is now fixed rather than relabelled. `useCartStore.test.ts` has a
`persist ラウンドトリップ` describe block with three tests built on the pattern
above (capture payload → discard in-memory state → restore payload →
`await persist.rehydrate()` → assert). It is a completion criterion of this
plan, not follow-up work — see the Done criteria addition below.

The tests were confirmed **non-vacuous** by reintroducing the exact bug removed
in `f77f0965` (the bare-array `setItem` *after* `set()` in `removeFromCart` /
`removeMultipleFromCart`, and `removeItem('cart')` in `emptyCart`): two of the
three fail. The third exercises the `addToCart` path, which never carried a
manual write, so it stays green by design.

> **Injection order matters when re-checking this.** Placing the bare-array
> `setItem` *before* the `set()` call does **not** reproduce the bug — `persist`
> writes on every `set()`, so it immediately overwrites the bare array with the
> correct wrapper and every test stays green. The historical bug wrote *after*
> `set()`, which is why it clobbered the wrapper. A "the test still passes"
> result from a mis-ordered injection proves nothing about the test.

**Done criteria addendum (2026-07-26)**: this plan is DONE only while a
round-trip test exists that discards in-memory state before rehydrating.
Deleting or weakening the `persist ラウンドトリップ` block (for example by
asserting on `getState()` without the preceding `setState({ cart: [] })`)
returns the plan to an unverified state.
