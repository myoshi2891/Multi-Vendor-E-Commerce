# Plan 010: Add direct unit tests for `computeShippingTotal` (the shipping-fee SSOT)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f9752c0..HEAD -- src/lib/shipping-utils.ts plans/README.md`
> If the file changed since this plan was written, compare the "Current state"
> excerpt to live code; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `f9752c0`, 2026-07-03

## Why this matters

`computeShippingTotal` is the repo's single source of truth for all shipping-fee math (`.claude/steering/tech.md` mandates every shipping calculation route through it). Yet it has **no direct unit test** — it is only exercised indirectly inside integration tests, where it is used as its own oracle (the integration test computes the expected value with the same function it's testing, so a self-consistent bug is invisible). This plan pins its behavior with explicit, hand-computed expected values across all three methods and the edge cases (zero/negative quantity, single vs. multiple items, rounding boundaries). It is pure additive test coverage — no production change, LOW risk, high value for a function that touches money on every order.

## Current state

`src/lib/shipping-utils.ts` (full function, as of `f9752c0`):

```ts
import { ShippingFeeMethod } from "@prisma/client";

export function computeShippingTotal(
	shippingFeeMethod: ShippingFeeMethod,   // "ITEM" | "WEIGHT" | "FIXED"
	shippingFee: number,
	extraShippingFee: number,
	weight: number,
	quantity: number
): number {
	if (quantity <= 0) return 0;                 // early guard

	let result: number;
	switch (shippingFeeMethod) {
		case "ITEM": {
			const qty = quantity > 1 ? quantity - 1 : 0;
			result = shippingFee + qty * extraShippingFee;   // base + extra per additional item
			break;
		}
		case "WEIGHT":
			result = shippingFee * weight * quantity;
			break;
		case "FIXED":
			result = shippingFee;
			break;
	}
	// 2-decimal normalization with EPSILON correction
	return Math.round((result + Number.EPSILON) * 100) / 100;
}
```

Behavior to pin (derived by reading the code — verify each by hand):
- **quantity ≤ 0** → returns `0` (both `0` and negative).
- **ITEM**: `shippingFee + (quantity - 1) * extraShippingFee` for `quantity > 1`; for `quantity === 1` the extra term is 0 → just `shippingFee`.
- **WEIGHT**: `shippingFee * weight * quantity`.
- **FIXED**: `shippingFee` regardless of weight/quantity (as long as quantity > 0).
- **Rounding**: result normalized to 2 decimals via `Math.round((result + Number.EPSILON) * 100) / 100` — pick inputs whose raw product has >2 decimals to prove rounding (e.g. WEIGHT with `weight = 0.1`, `shippingFee = 0.1`, `quantity = 3` → `0.1*0.1*3 = 0.03...` float noise → expect `0.03`).

### Repo conventions

- **Test placement**: `src/lib/*.test.ts` co-located — the repo already has `src/lib/utils.test.ts`, `src/lib/auth-guards.test.ts`, `src/lib/schemas.test.ts`. Jest picks these up (config only ignores `node_modules`, `tests/e2e`, `tests/integration`). New file: `src/lib/shipping-utils.test.ts`.
- **AAA pattern** (Arrange-Act-Assert), both normal and edge cases (`.claude/rules/01-engineering-standards.md`, testing section).
- `ShippingFeeMethod` is a Prisma enum; import it from `@prisma/client` and pass the string literals `"ITEM"`/`"WEIGHT"`/`"FIXED"`.

## Commands you will need

| Purpose  | Command                                          | Expected   |
|----------|--------------------------------------------------|------------|
| Test     | `bun run test -- src/lib/shipping-utils.test.ts` | all pass   |
| Typecheck| `bunx tsc --noEmit`                              | exit 0     |
| Lint     | `bun run lint`                                   | exit 0     |

## Scope

**In scope**:
- `src/lib/shipping-utils.test.ts` (create)
- `plans/README.md` — update plan 010 status when complete

**Out of scope**:
- `src/lib/shipping-utils.ts` — do NOT modify the implementation. If a test reveals a genuine bug (e.g. an unreachable/uninitialized `result` for an unexpected method value), STOP and report it as a finding — do not "fix" it in this test-only plan.
- Integration tests that use the function as an oracle — leave them.

## Git workflow

- Branch: `advisor/010-shipping-utils-tests`
- Commit style: `test(shipping): add unit tests for computeShippingTotal`
- Follow the TDD/commit discipline in `.claude/rules/02-tdd-step-commit.md`: this is additive characterization testing of existing code, so 1 test file = 1 commit is fine (no Red-first requirement for pinning existing behavior).
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Write `src/lib/shipping-utils.test.ts`

Create the file with AAA-structured cases. Compute every expected value by hand and hard-code it (do NOT call `computeShippingTotal` to derive the expectation — that reintroduces the oracle problem):

```ts
import { computeShippingTotal } from "@/lib/shipping-utils";
import { ShippingFeeMethod } from "@prisma/client";

describe("computeShippingTotal", () => {
    describe("quantity ガード", () => {
        it("quantity が 0 のとき 0 を返す", () => {
            expect(computeShippingTotal("ITEM", 10, 2, 1, 0)).toBe(0);
        });
        it("quantity が負のとき 0 を返す", () => {
            expect(computeShippingTotal("FIXED", 10, 2, 1, -3)).toBe(0);
        });
    });

    describe("ITEM 方式", () => {
        it("単数 (quantity=1) は base のみ", () => {
            expect(computeShippingTotal("ITEM", 10, 2, 1, 1)).toBe(10);
        });
        it("複数は base + (qty-1)*extra", () => {
            // 10 + (3-1)*2 = 14
            expect(computeShippingTotal("ITEM", 10, 2, 1, 3)).toBe(14);
        });
    });

    describe("WEIGHT 方式", () => {
        it("fee*weight*quantity", () => {
            // 5 * 2 * 3 = 30
            expect(computeShippingTotal("WEIGHT", 5, 0, 2, 3)).toBe(30);
        });
        it("float 誤差の 2 桁正規化", () => {
            // 0.1 * 0.1 * 3 = 0.030000...4（float 誤差）→ 0.03 に正規化
            expect(computeShippingTotal("WEIGHT", 0.1, 0, 0.1, 3)).toBe(0.03);
        });
        it("丸め境界（.xx5 は half-up で切り上げ）", () => {
            // 0.125 は 2 桁目の直後がちょうど 5。computeShippingTotal は
            // Math.round((x + EPSILON) * 100) / 100 で half-up するため 0.13 になる。
            // ↑の float 正規化テストとは別に「実際の丸め境界」を検証する入力。
            expect(computeShippingTotal("WEIGHT", 0.25, 0, 0.5, 1)).toBe(0.13);
        });
    });

    describe("FIXED 方式", () => {
        it("weight/quantity に依存せず fee を返す", () => {
            expect(computeShippingTotal("FIXED", 25, 99, 99, 4)).toBe(25);
        });
    });
});
```

Adjust the enum-literal typing if `ShippingFeeMethod` requires it (e.g. cast `"ITEM" as ShippingFeeMethod` only if the compiler complains — the string unions usually satisfy it directly).

**Verify**: `bun run test -- src/lib/shipping-utils.test.ts` → all pass; `bunx tsc --noEmit` → exit 0.

### Step 2: Confirm test-suite bookkeeping

Because this adds a new test file (and new tests), the repo's process (`.claude/rules/02-tdd-step-commit.md`) calls for updating test-count docs via the `spec-sync-after-test` flow. In this executor context:
- If you have the `spec-sync-after-test` skill/tooling available, run it to update stats + regenerate the coverage dashboard, and include those doc changes **in a separate commit** from the test file.
- If that tooling is NOT available in your environment, STOP after the test commit and report that the doc/stat sync (`QA_HANDOFF.md`, coverage dashboard) is pending for a maintainer — do NOT hand-edit `docs/coverage-dashboard.html` (it is generated).

**Verify**: `bun run lint` → exit 0.

## Test plan

- New file `src/lib/shipping-utils.test.ts` covering: quantity 0, quantity negative, ITEM single, ITEM multiple, WEIGHT integer, WEIGHT rounding, FIXED independence.
- Structural pattern: `src/lib/utils.test.ts` (nearest pure-function unit test in the same directory).
- Verification: `bun run test -- src/lib/shipping-utils.test.ts` → all pass with the new cases.

## Done criteria

ALL must hold:

- [ ] `src/lib/shipping-utils.test.ts` exists with the 7 cases above (or more)
- [ ] `bun run test -- src/lib/shipping-utils.test.ts` exits 0
- [ ] `bunx tsc --noEmit` exits 0
- [ ] `bun run lint` exits 0
- [ ] `src/lib/shipping-utils.ts` is unchanged (`git diff --stat` shows no change)
- [ ] Test-count docs synced via `spec-sync-after-test` (separate commit) OR the pending-sync note recorded in your report
- [ ] `plans/README.md` status row for 010 updated

## STOP conditions

Stop and report if:

- The `computeShippingTotal` signature/behavior doesn't match "Current state" (drift) — recompute expected values against the live code before writing.
- A hand-computed expectation disagrees with the function's output in a way that indicates a real bug (e.g. `result` used while possibly unassigned for an out-of-enum method) — report it as a finding; do not modify the implementation.
- Tests fail twice after reasonable fixes.

## Maintenance notes

- If a new `ShippingFeeMethod` enum value is added, add a case here and to the implementation together — an unhandled method currently leaves `result` unassigned.
- Reviewer should confirm expectations are hand-computed constants, not derived by calling the function under test.
- This test is the guard that lets future refactors of `shipping-utils.ts` (e.g. the TODO'd migration to a decimal library) be verified against fixed expected values.
