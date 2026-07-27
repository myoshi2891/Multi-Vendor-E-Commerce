# Plan 006: Prevent double-submit of "Place order" (reentrancy guard + disabled button)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f9752c0..HEAD -- src/components/store/cards/place-order.tsx plans/README.md`
> If the file changed since this plan was written, compare the "Current state"
> excerpt to live code; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness
- **Planned at**: commit `f9752c0`, 2026-07-03

## Why this matters

The "Place order" button calls `handlePlaceOrder()` with no `disabled` state and no reentrancy guard. `placeOrder` (server) is not idempotent per cart — each call creates an `Order` and decrements stock. A user who double-clicks (or a slow network that invites a second click) can create duplicate orders and double-decrement inventory in one checkout. The spinner shown while `loading` is decorative only — the button stays clickable. This plan closes the **client-triggered** double-submit path using the repo's established reentrancy-guard convention, which eliminates the realistic user-driven case at LOW risk. (A deeper server-side idempotency guarantee against truly concurrent requests is called out as a deferred follow-up, because it overlaps a larger transaction refactor and carries MED risk — keeping this plan safe and focused.)

## Current state

`src/components/store/cards/place-order.tsx`.

State + handler, lines 26-47 (as of `f9752c0`):

```ts
const [loading, setLoading] = useState<boolean>(false)
const { id, coupon, subTotal, shippingFees, total } = cartData
const { push } = useRouter()
const emptyCart = useCartStore((state) => state.emptyCart)
const handlePlaceOrder = async () => {
    setLoading(true)
    if (!shippingAddress) {
        toast.error('Select a shipping address before placing your order.')
    } else {
        try {
            const order = await placeOrder(shippingAddress, id)
            if (order) {
                emptyCart()
                await emptyUserCart()
                push(`/order/${order.orderId}`)
            }
        } catch (_error) {
            toast.error('Something went wrong while placing your order.')
        }
    }
    setLoading(false)
}
```

Button, lines 142-148 — no `disabled`:

```tsx
<Button onClick={() => handlePlaceOrder()}>
    {loading ? (<PulseLoader size={5} color="#fff" />) : (<span>Place order</span>)}
</Button>
```

`import { Dispatch, FC, SetStateAction, useState } from 'react'` (line 5) — `useRef` is not yet imported.

### Repo convention to follow (inlined)

The project documents a **reentrancy guard via `useRef`** for exactly this (`.claude/steering/tech.md`, "リエントランシーガード"; exemplar `src/components/store/layout/footer/newsletter.tsx`):

```ts
const isSubmittingRef = useRef(false);
const handleSubmit = async () => {
    if (isSubmittingRef.current) return;   // early return
    isSubmittingRef.current = true;
    try {
        await performAsyncOperation();
    } finally {
        isSubmittingRef.current = false;   // always release
    }
};
```

Use this pattern. The `disabled` prop on the button is the visible complement to the ref (the ref covers the race between click and state update; `disabled` covers the UI).

## Commands you will need

| Purpose   | Command             | Expected            |
|-----------|---------------------|---------------------|
| Typecheck | `bunx tsc --noEmit` | exit 0              |
| Lint      | `bun run lint`      | exit 0 (warns ok)   |
| Test      | `bun run test -- src/components/store/cards` | all pass (if tests exist here) |

## Scope

**In scope**:
- `src/components/store/cards/place-order.tsx` — add ref guard + `disabled`
- A co-located component test if the repo tests this component (see step 3; create only if a sibling test pattern exists)
- `plans/README.md` — update plan 006 status when complete

**Out of scope**:
- Server-side idempotency in `placeOrder` (`src/queries/user.ts`) — was deferred when this plan ran; **has since shipped** (`src/queries/user.ts:638-641` — see Maintenance notes). Either way, do NOT modify `placeOrder` here.
- The `emptyUserCart` / cart-clearing flow.
- Coupon/discount display logic in this file.

## Git workflow

- Branch: `advisor/006-place-order-double-submit`
- Commit style: `fix(checkout): guard place-order against double submit`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add the `useRef` import and reentrancy guard

In `src/components/store/cards/place-order.tsx`:
1. Add `useRef` to the React import (line 5): `import { Dispatch, FC, SetStateAction, useRef, useState } from 'react'`.
2. Add the ref next to the `loading` state:
   ```ts
   const isPlacingOrderRef = useRef(false)
   ```
3. Rewrite `handlePlaceOrder` to guard on the ref and always release it:
   ```ts
   const handlePlaceOrder = async () => {
       if (isPlacingOrderRef.current) return
       isPlacingOrderRef.current = true
       setLoading(true)
       try {
           if (!shippingAddress) {
               toast.error('Select a shipping address before placing your order.')
               return
           }
           const order = await placeOrder(shippingAddress, id)
           if (order) {
               emptyCart()
               await emptyUserCart()
               push(`/order/${order.orderId}`)
           }
       } catch (_error) {
           toast.error('Something went wrong while placing your order.')
       } finally {
           isPlacingOrderRef.current = false
           setLoading(false)
       }
   }
   ```
   Note: the early `return` for the missing address now sits inside the `try`, so the `finally` still releases the ref and clears `loading` — fixing a latent "stuck loading" path too.

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 2: Disable the button while placing the order

Change the button (line ~142) to disable during `loading`:

```tsx
<Button onClick={() => handlePlaceOrder()} disabled={loading}>
    {loading ? (<PulseLoader size={5} color="#fff" />) : (<span>Place order</span>)}
</Button>
```

Confirm the shared `Button` (`src/components/ui/button.tsx`, shadcn) forwards `disabled` — shadcn buttons do by default.

**Verify**: `bunx tsc --noEmit` → exit 0; `bun run lint` → exit 0.

### Step 3: Extend the existing component test — required, not conditional

**`src/components/store/cards/place-order.test.tsx` already exists** and already covers this
component (rapid double-click → one `placeOrder`; guard held through navigation; guard released on
failure so a retry works; cleanup failure must not allow a re-order). The harness, the
`@/queries/user` mocks (`placeOrder`, `emptyUserCart`) and the `next/navigation` / `react-hot-toast`
mocks are all in place, so **a regression test for this fix is mandatory** — the "no test infra
here, fall back to manual" escape hatch does not apply.

Add to that file rather than scaffolding anything new. Model new cases on the ones already there.

**Verify**: `bun run test -- src/components/store/cards/place-order.test.tsx` → all pass, including
the pre-existing cases (do not regress them).

## Test plan

Required, in `src/components/store/cards/place-order.test.tsx`:

- double-click → `placeOrder` called once; button `disabled` while pending
- error toast on rejection, and the guard released so a retry calls `placeOrder` again
- missing-address path shows the address toast and does not call `placeOrder`
- the guard stays held once the order is confirmed, including when `emptyUserCart()` rejects
  (a placed order is irreversible — cleanup failure must not re-enable the button)

Structural pattern: the cases already in that file.

## Done criteria

ALL must hold:

- [ ] `bunx tsc --noEmit` exits 0
- [ ] `bun run lint` exits 0
- [ ] `grep -n "isPlacingOrderRef" src/components/store/cards/place-order.tsx` shows the guard
- [ ] `grep -n "disabled={loading}" src/components/store/cards/place-order.tsx` shows the disabled button
- [ ] `placeOrder` in `src/queries/user.ts` is unchanged (`git diff --stat` shows no change there)
- [ ] Before the **code commit**, no files outside the in-scope list are modified (`git status`) — the `plans/README.md` status-row update lands in a separate docs commit
- [ ] `plans/README.md` status row for 006 updated

## STOP conditions

Stop and report if:

- The component doesn't match the "Current state" excerpt (drift).
- The shared `Button` does not accept `disabled` (unexpected for shadcn) — report.
- You conclude the client guard is insufficient for the observed risk and a server-side change is truly required now — report rather than editing `placeOrder` (that's the deferred, higher-risk follow-up).

## Maintenance notes

- ~~**Deferred follow-up (separate plan)**: make `placeOrder` idempotent against genuinely concurrent requests — e.g. consume/lock the cart inside the order-creation `$transaction` so a second concurrent call finds no cart.~~ **Shipped — no longer deferred (2026-07-27).** `placeOrder` now consumes the cart *inside* the order-creation transaction with a conditional delete, exactly as this note anticipated:

  ```ts
  // src/queries/user.ts:638-641
  const consumed = await tx.cart.deleteMany({ where: { id: cartId, userId } })
  if (consumed.count === 0) throw new Error('Cart not found.')
  ```

  Two concurrent calls race on the same row; the loser sees `count === 0` and aborts before any
  order row or stock decrement is written. This is the same "conditional write + count check"
  idiom the stock decrement uses. **Do not re-plan this as open work.**

  Still genuinely open (do *not* fold into the above): the `applyCoupon` lost-update
  `$transaction` refactor tracked in `specs/.../08-open-questions.md` and the README Deferred
  list. That was mentioned here only as an overlapping refactor, not as part of the cart-consumption
  follow-up, and it remains unaddressed.
- ~~Reviewer should confirm the ref is released in a `finally` (no path leaves it stuck `true`, which would permanently disable ordering for that mounted component).~~ **Superseded — see below.**

### Superseded: the guard is deliberately NOT released after a successful order (2026-07-18)

This plan is **DONE**, but both the Step-2 snippet (lines ~123-143) and the
review note above specify an **unconditional** release in `finally`. That is the
behavior the implementation had to abandon, and following it now reintroduces a
duplicate-submit bug:

`push()` returns `void` and cannot be awaited, so the component stays mounted
and interactive while the navigation is in flight. An unconditional
`finally { isPlacingOrderRef.current = false }` therefore re-arms the button
*before* the user leaves the page, and a second click re-invokes `placeOrder`.
This was measured, not theorized — the regression test observed **two** calls.
It did not create duplicate orders (the cart row is already gone, so the second
attempt finds nothing) but it failed with `"Cart not found."`, showing an
error toast on top of a successful order.

> **Where that `"Cart not found."` comes from, in the current tree (2026-07-27).**
> An earlier revision attributed it to `emptyUserCart` deleting the cart row. That is no
> longer the mechanism to reason from: `emptyUserCart` (`src/queries/user.ts:817`) now uses
> `deleteMany` and is **deliberately idempotent** — it does not throw when the row is already
> gone. The row is consumed earlier, inside `placeOrder`'s own transaction
> (`src/queries/user.ts:638-641`), and the throw comes from that conditional delete's
> `count === 0` branch (or the pre-check at `:451`). The observed symptom is unchanged; only
> the attribution is corrected.

The shipped shape (`src/components/store/cards/place-order.tsx:74-80`) releases
the guard **only on the failure path**:

```ts
} finally {
    // 注文成立後は解除しない（アンマウント前提の意図的な例外）。
    // 失敗・住所未選択時のみ解除して再試行を許可する。
    if (!orderPlaced) {
        isPlacingOrderRef.current = false
        setLoading(false)
    }
}
```

The "stuck `true`" hazard the old note warns about is real but is accepted here:
after a successful order the component is expected to unmount via navigation, so
a permanently-armed guard has no user-visible lifetime. Retry after a genuine
failure is what must stay possible, and that is the branch the condition keeps.

Two later changes build on this and must be preserved together:

- **Cleanup is best-effort** (2026-07-18). The snippet's `emptyCart()` is
  synchronous but unguarded; the Zustand store is `persist`-backed, so it can
  throw on a storage failure (Safari private mode, quota). Combined with
  `orderPlaced === true` skipping the release, an unguarded throw left the user
  with a placed order, an error toast, no navigation, and a permanently disabled
  button — unrecoverable. Both `emptyCart()` and `emptyUserCart()` are now
  individually wrapped so neither can block `push()`.
- ~~The deferred server-side idempotency follow-up below is still open; this UI
  guard does not protect against genuinely concurrent requests.~~
  **Superseded (2026-07-27).** Two corrections: the follow-up is in *Maintenance notes*
  **above**, not below — and it is no longer open. `placeOrder` consumes the cart inside the
  order-creation `$transaction` (`src/queries/user.ts:638-641`), so genuinely concurrent
  requests are now rejected server-side as well. This UI guard remains the first line of
  defence for the ordinary double-click, but it is no longer the *only* one.
- If a global loading/submit abstraction is later introduced for forms, fold this guard into it.
