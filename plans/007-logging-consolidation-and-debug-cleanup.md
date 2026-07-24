# Plan 007: Introduce a `logError` helper, remove debug `console.log`, and fix the untagged coupon logs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f9752c0..HEAD -- src/lib src/queries/coupon.ts src/components/store/forms/apply-coupon.tsx src/components/store/cart-page/container.tsx plans/README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts to live code; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `f9752c0`, 2026-07-03

## Why this matters

Error logging in `src/queries/` exists in three incompatible shapes: the canonical structured form `console.error("[Module:Function] msg", { error, stack })`, a legacy hand-copied `instanceof Error` 3-arg form, and — worst — bare `console.error(error)` with no module tag and no stack, concentrated in `coupon.ts` (the highest-churn file). On top of that, two UI files ship debug `console.log` that violate the repo's "no `console.log` in `src/`" rule, one of which dumps the entire cart to the browser console on every load. Three log formats defeat log aggregation/alerting; the bare coupon logs make incident triage on the coupon path blind. This plan adds one shared `logError` helper, deletes the debug logs, and converts the bare coupon logs to the tagged structured form — a coherent, low-risk slice. The full ~90-site legacy migration is explicitly deferred (see Maintenance notes) to keep this reviewable.

## Current state

There is **no** existing logging helper in `src/lib/` (confirmed: no `src/lib/log*.ts`).

Canonical target shape (already used in newer modules, e.g. `src/queries/inventory.ts:120-132`, `order.ts`):

```ts
console.error("[Module:Function] message", { error: error.message, stack: error.stack });
// non-Error branch:
console.error("[Module:Function] Unknown error", { error });
```

Bare, untagged logs in `src/queries/coupon.ts` (6 sites: lines 54, 92, 130, 158, 195, 332). Example at line 54:

```ts
} catch (error: unknown) {
    console.error(error)                 // ← no [Module:Function] tag, no stack
    throw new Error('Error occurred while verifying coupon ownership.')
}
```

Debug `console.log` violating the no-console.log rule:

```ts
// src/components/store/forms/apply-coupon.tsx:53 — inside catch (error: any)
console.log(error)
toast.error(error.toString())

// src/components/store/cart-page/container.tsx:39 — dumps whole cart every load
const updatedCart = await updateCartWithLatest(cartItems)
console.log('updatedCart--->', updatedCart)
```

### Repo conventions

- Structured logging is the standard (`.claude/steering/tech.md`, "構造化ログ"): first arg `"[Module:Function] message"`, second arg `{ error, stack }`. The non-Error branch logs `{ error }` (the raw value) because `.message`/`.stack` may not exist.
- `any` is banned — use `unknown` + `instanceof Error` narrowing.
- `console.log` is forbidden in `src/` (CLI seeds excepted). `console.error`/`console.warn` at boundaries are fine.
- Helper/utility functions need JSDoc (`.claude/steering/tech.md`, "Docstrings").

## Commands you will need

| Purpose      | Command                                       | Expected          |
|--------------|-----------------------------------------------|-------------------|
| Typecheck    | `bunx tsc --noEmit`                           | exit 0            |
| Helper test  | `bun run test -- src/lib/log.test.ts`         | all pass          |
| Coupon test  | `bun run test -- src/queries/coupon.test.ts`  | all pass          |
| Lint         | `bun run lint`                                | exit 0 (warns ok) |

## Scope

**In scope**:
- `src/lib/log.ts` (create) — the `logError` helper
- `src/lib/log.test.ts` (create) — its unit test
- `src/queries/coupon.ts` — convert the 6 bare `console.error(error)` sites to `logError`
- `src/components/store/forms/apply-coupon.tsx` — replace `console.log(error)` (and fix the `error: any`)
- `src/components/store/cart-page/container.tsx` — delete the debug `console.log`
- `plans/README.md` — update plan 007 status when complete

**Out of scope**:
- The ~90 legacy 3-arg `console.error` sites across other `src/queries/*` files (deferred; see Maintenance notes). Do NOT mass-migrate them in this plan.
- Any change to thrown error messages or control flow.
- The `error: any` sites elsewhere (that's a separate correctness cleanup) — only fix the one in `apply-coupon.tsx` you're already editing.

## Git workflow

- Branch: `advisor/007-logging-consolidation`
- Commit style: `refactor(logging): add logError helper; drop debug console.log`
- Consider two commits: (1) helper + test, (2) call-site conversions — but a single commit is acceptable if each step's verification passed.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Create the `logError` helper

Create `src/lib/log.ts`:

```ts
/**
 * 構造化エラーログの共通ヘルパー。
 * `.claude/steering/tech.md` の規約に合わせ、第1引数を "[Module:Function] message"、
 * 第2引数を { error, stack }（Error 以外は { error }）で出力する。
 *
 * @param tag  "[Module:Function] message" 形式のタグ付きメッセージ
 * @param error catch した unknown なエラー値
 */
export function logError(tag: string, error: unknown): void {
    if (error instanceof Error) {
        console.error(tag, { error: error.message, stack: error.stack });
    } else {
        console.error(tag, { error });
    }
}
```

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 2: Unit-test the helper

Create `src/lib/log.test.ts` following the repo's AAA pattern:
- Spy on `console.error` (`jest.spyOn(console, 'error').mockImplementation(() => {})`), restore after.
- **Error branch**: `logError("[X:y] boom", new Error("bad"))` → `console.error` called with `"[X:y] boom"` and an object whose `error === "bad"` and `stack` is a string.
- **Non-Error branch**: `logError("[X:y] boom", "raw-string")` → second arg is `{ error: "raw-string" }`.

**Verify**: `bun run test -- src/lib/log.test.ts` → all pass.

### Step 3: Convert the 6 bare coupon logs

In `src/queries/coupon.ts`, at each of the 6 `console.error(error)` sites (lines ~54, 92, 130, 158, 195, 332), import and use `logError` with a tag naming the function. Add at the top: `import { logError } from "@/lib/log";`. Example:

```ts
} catch (error: unknown) {
    logError("[Coupon:verifyOwnership] failed to verify coupon ownership", error)
    throw new Error('Error occurred while verifying coupon ownership.')
}
```

Use the actual enclosing function name for each `[Coupon:<fn>]` tag (read each catch's function). Do not change the `throw new Error(...)` messages.

**Verify**: `grep -n "console.error(error)" src/queries/coupon.ts` → no matches; `bunx tsc --noEmit` → exit 0; `bun run test -- src/queries/coupon.test.ts` → all pass. If a coupon test asserted on the old bare `console.error(error)` call shape, update that assertion to the new tagged call.

### Step 4: Remove the debug UI logs

1. `src/components/store/cart-page/container.tsx` (line ~39): delete the `console.log('updatedCart--->', updatedCart)` line entirely. Nothing else in that block depends on it.
2. `src/components/store/forms/apply-coupon.tsx` (line ~52-55): the catch is `catch (error: any)`. Change it to `catch (error: unknown)`, replace `console.log(error)` with `logError("[ApplyCoupon:handleSubmit] failed to apply coupon", error)` (import `logError`), and make the toast safe for `unknown`:
   ```ts
   } catch (error: unknown) {
       logError("[ApplyCoupon:handleSubmit] failed to apply coupon", error)
       toast.error(error instanceof Error ? error.message : "Failed to apply coupon.")
   }
   ```

**Verify**: `grep -rn "console.log" src/components/store/forms/apply-coupon.tsx src/components/store/cart-page/container.tsx` → no matches; `bunx tsc --noEmit` → exit 0.

### Step 5: Full lint

`console.log` in `src/` may be an ESLint error; confirm the two removals clear any related lint finding.

**Verify**: `bun run lint` → exit 0 (no new errors).

## Test plan

- New: `src/lib/log.test.ts` (Error + non-Error branches).
- Adjust: any `coupon.test.ts` assertion tied to the old bare log call shape.
- Structural pattern: AAA unit tests in `src/queries/*.test.ts` and `src/lib/*` tests.
- Verification: helper test + coupon test pass; no `console.log` remains in the two UI files.

## Done criteria

ALL must hold:

- [ ] `bunx tsc --noEmit` exits 0
- [ ] `src/lib/log.ts` exports `logError` with JSDoc; `src/lib/log.test.ts` passes
- [ ] `grep -n "console.error(error)" src/queries/coupon.ts` returns no matches
- [ ] `grep -rn "console.log" src/components/store/forms/apply-coupon.tsx src/components/store/cart-page/container.tsx` returns no matches
- [ ] `grep -n "catch (error: any)" src/components/store/forms/apply-coupon.tsx` returns no matches
- [ ] `bun run test -- src/lib/log.test.ts src/queries/coupon.test.ts` exits 0
- [ ] `bun run lint` exits 0
- [ ] Before the **code commit**, no files outside the in-scope list are modified (`git status`) — the `plans/README.md` status-row update lands in a separate docs commit
- [ ] `plans/README.md` status row for 007 updated

## STOP conditions

Stop and report if:

- Any "Current state" excerpt doesn't match live code (drift) — e.g. the coupon bare-log lines have already been migrated.
- Converting a coupon catch reveals the enclosing function name is ambiguous (nested closures) — use the outermost exported action name and note it.
- A test failure implies a call-site depends on the old log shape in a non-obvious way.
- Tests fail twice after reasonable fixes.

## Maintenance notes

- **Deferred follow-up (separate plan)**: migrate the ~90 legacy 3-arg `console.error("Error in X:", error.message, error.stack)` + duplicated `instanceof Error` blocks across `src/queries/*` (category, store, product, user, subCategory, offer-tag, …) to `logError`. That is mechanical but touches many files and many test assertions — do it as its own reviewable batch, not here.
- New `src/queries/` catch blocks should call `logError` from day one.
- **Toast は「サーバーが返す文言がユーザー安全である」前提でのみ `error.message` を出す。**
  Step 4 の `toast.error(error instanceof Error ? error.message : "…")` が許容されるのは、
  `applyCoupon` 等が **curated（"Coupon expired" 等の利用者向け）メッセージのみ throw する**
  ためである。ラップされていない生の Prisma/内部エラーが `.message` として到達しうる呼び出し元では、
  内部詳細の漏洩を防ぐため**汎用文言に固定**する（`.message` を無条件で表示しない）。
  ログ（`logError`）には生の詳細を残し、UI には安全な文言のみを出す分離を守ること。
- Reviewer should confirm the non-Error branch logs `{ error }` (raw), matching the documented convention, and that no thrown message text changed.
- If a structured logging backend (e.g. from a future observability plan) is added, `logError` is the single seam to route through it.
