# Plan 008: Delete the dead `search copy.tsx` and relocate the inline `AdminOrderFilterSchema` to `schemas.ts`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f9752c0..HEAD -- src/queries/order.ts src/lib/schemas.ts "src/components/store/layout/header/search/"`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts to live code; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `f9752c0`, 2026-07-03

## Why this matters

Two small convention/hygiene fixes:

1. **Dead file** `src/components/store/layout/header/search/search copy.tsx` is an unreferenced duplicate of the real `search.tsx` (confirmed: no import of it anywhere in `src/`). It has a space in its filename and older logging, and it shadows the maintained component — a trap for accidental edits.
2. **Convention violation**: `AdminOrderFilterSchema` is defined inline in `src/queries/order.ts:294`. It is the only `z.object(...)` defined outside `src/lib/schemas.ts` in non-test source, breaking the repo rule "Zod schemas live in `src/lib/schemas.ts`". Colocating it makes the admin-order-filter contract discoverable and testable with the rest.

Both are safe, mechanical, and independently verifiable.

## Current state

### Dead file

`src/components/store/layout/header/search/` contains:
- `search.tsx` (the real component, maintained)
- `search copy.tsx` (dead duplicate — target for deletion)
- `suggestions.tsx`

`grep -rn "search copy" src/` returns nothing (no importer).

### Inline schema, `src/queries/order.ts:294-304`

```ts
const AdminOrderFilterSchema = z.object({
    paymentStatus: z.nativeEnum(PaymentStatus).optional(),
    orderStatus: z.nativeEnum(OrderStatus).optional(),
    search: z.string().optional(),
    page: z.number().int().min(1).default(1),
    // limit は throw ではなく clamp（≤100）でキャップし、極端値を 100 に丸める（AC-F2-3）
    limit: z
        .number()
        .default(20)
        .transform((n) => Math.min(Math.max(Math.floor(n), 1), 100)),
});
```

Used in the same file at:
- line 315: `filters?: Partial<z.infer<typeof AdminOrderFilterSchema>>`
- line 318: `const f = AdminOrderFilterSchema.parse(filters ?? {});`

Enum import in `order.ts` (line 5): `import { OrderStatus, PaymentStatus, ProductStatus } from "@/lib/types";`

`schemas.ts` already imports enums from Prisma (line 1: `import { ShippingFeeMethod } from "@prisma/client";`) and `import * as z from "zod";` (line 2). It exports schemas + inferred types, e.g. `TrackOrderSchema` / `TrackOrderInput` (lines 15-20). `order.ts` already imports from schemas: `import { TrackOrderSchema, type TrackOrderInput } from "@/lib/schemas";` (line 6).

### Repo conventions

- Zod schemas belong in `src/lib/schemas.ts` (`.claude/steering/structure.md`, "入力バリデーション"; `.claude/steering/tech.md` rule 4).
- Preserve the exact schema shape — including the `limit` clamp `transform` and its comment — so validation behavior is byte-for-byte identical.

## Commands you will need

| Purpose    | Command                                       | Expected          |
|------------|-----------------------------------------------|-------------------|
| Typecheck  | `bunx tsc --noEmit`                           | exit 0            |
| Order test | `bun run test -- src/queries/order.test.ts`   | all pass          |
| Lint       | `bun run lint`                                | exit 0 (warns ok) |

## Scope

**In scope**:
- Delete `src/components/store/layout/header/search/search copy.tsx`
- `src/lib/schemas.ts` — add `AdminOrderFilterSchema` (+ inferred type)
- `src/queries/order.ts` — import the schema instead of defining it

**Out of scope**:
- `search.tsx` / `suggestions.tsx` — the live components; do not touch.
- Any change to the schema's validation behavior.
- Other inline validation elsewhere (none found; if you find one, note it, don't fix it here).

## Git workflow

- Branch: `advisor/008-deadcode-and-schema-relocation`
- Commit style: two commits recommended — `chore(search): remove dead search copy.tsx` and `refactor(order): move AdminOrderFilterSchema to schemas.ts`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Confirm the dead file has no importer, then delete it

```
grep -rn "search copy" src/            # expect: no matches
grep -rn "search%20copy\|search_copy\|searchCopy" src/   # expect: no matches
```

If both are empty, delete the file:
```
git rm "src/components/store/layout/header/search/search copy.tsx"
```

**Verify**: `bunx tsc --noEmit` → exit 0 (nothing referenced it); the file no longer exists.

### Step 2: Add `AdminOrderFilterSchema` to `schemas.ts`

Append to `src/lib/schemas.ts` (near the other schemas), copying the shape **exactly**:

```ts
export const AdminOrderFilterSchema = z.object({
    paymentStatus: z.nativeEnum(PaymentStatus).optional(),
    orderStatus: z.nativeEnum(OrderStatus).optional(),
    search: z.string().optional(),
    page: z.number().int().min(1).default(1),
    // limit は throw ではなく clamp（≤100）でキャップし、極端値を 100 に丸める（AC-F2-3）
    limit: z
        .number()
        .default(20)
        .transform((n) => Math.min(Math.max(Math.floor(n), 1), 100)),
});

export type AdminOrderFilter = z.infer<typeof AdminOrderFilterSchema>;
```

Add the enum import at the top of `schemas.ts`. Match how `order.ts` imports them — `PaymentStatus`/`OrderStatus` come from `@/lib/types` there. Prefer the same source for consistency:
```ts
import { OrderStatus, PaymentStatus } from "@/lib/types";
```
(If `@/lib/types` does not re-export these enums as values usable by `z.nativeEnum`, fall back to `import { OrderStatus, PaymentStatus } from "@prisma/client";` — `schemas.ts` already imports Prisma enums. Pick whichever compiles; `z.nativeEnum` needs the runtime enum object, not a type.)

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 3: Import the schema in `order.ts` and remove the inline definition

In `src/queries/order.ts`:
1. Extend the existing schemas import (line 6) to include the moved schema:
   ```ts
   import { TrackOrderSchema, type TrackOrderInput, AdminOrderFilterSchema } from "@/lib/schemas";
   ```
2. Delete the inline `const AdminOrderFilterSchema = z.object({ ... });` block (lines ~294-304).
3. The two use sites (`z.infer<typeof AdminOrderFilterSchema>` at line ~315 and `AdminOrderFilterSchema.parse(...)` at line ~318) now resolve to the imported schema — no change needed, but confirm they still compile. If `PaymentStatus`/`OrderStatus`/`z` become unused in `order.ts` after the move, remove only the now-unused imports (lint will flag them).

**Verify**: `bunx tsc --noEmit` → exit 0; `bun run test -- src/queries/order.test.ts` → all pass (the `getAllOrders` filter-parsing tests exercise this schema).

### Step 4: Lint

**Verify**: `bun run lint` → exit 0 (fix any unused-import warning introduced by the move).

## Test plan

- No new tests strictly required — the existing `getAllOrders` tests in `src/queries/order.test.ts` already exercise `AdminOrderFilterSchema.parse` (limit clamp, enum validation). They must stay green, proving the moved schema behaves identically.
- Optionally add a direct unit test for `AdminOrderFilterSchema` in `src/lib/schemas.test.ts` if that file exists; if not, skip (don't scaffold new infra for this).
- Verification: `bun run test -- src/queries/order.test.ts` → all pass.

## Done criteria

ALL must hold:

- [ ] `src/components/store/layout/header/search/search copy.tsx` no longer exists
- [ ] `grep -rn "search copy" src/` returns no matches
- [ ] `grep -n "AdminOrderFilterSchema" src/lib/schemas.ts` shows the exported schema
- [ ] `grep -n "const AdminOrderFilterSchema = z.object" src/queries/order.ts` returns no match (inline definition gone)
- [ ] `bunx tsc --noEmit` exits 0
- [ ] `bun run test -- src/queries/order.test.ts` exits 0
- [ ] `bun run lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 008 updated

## STOP conditions

Stop and report if:

- `grep -rn "search copy" src/` finds an importer (the file is NOT dead) — do not delete; report.
- The schema excerpt in `order.ts` doesn't match "Current state" (drift).
- `z.nativeEnum(PaymentStatus)` fails to compile from both `@/lib/types` and `@prisma/client` — report the type error.
- Order tests fail twice after reasonable fixes.

## Maintenance notes

- Keep new server-action input schemas in `src/lib/schemas.ts` from the start.
- Reviewer should confirm the `limit` clamp `transform` and comment survived the move verbatim (validation behavior must be identical).
- If a `src/lib/schemas.test.ts` is later added, cover `AdminOrderFilterSchema` there (limit clamp bounds, enum rejection).
