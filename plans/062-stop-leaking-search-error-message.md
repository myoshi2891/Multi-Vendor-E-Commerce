# Plan 062: Stop returning raw `error.message` from the product search route (and drop `error: any`)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> ```bash
> git diff --stat d2aff76 -- src/app/api/index-products/route.ts src/app/api/index-products/route.test.ts
> git status --porcelain -- src/app/api/index-products/route.ts
> ```
> Use `d2aff76` (not `d2aff76..HEAD`) so working-tree/staged changes are also seen.
> If the in-scope file changed since this plan was written, compare the "Current state" excerpts
> against live code first; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `d2aff76`, 2026-07-17

## Why this matters

The public product-search route returns internal exception text straight to unauthenticated clients:
both handlers end with `catch (error: any) { return NextResponse.json({ error: error.message }, {
status: 500 }) }`. That leaks internal/DB error details (schema hints, driver messages) to anyone who
can trigger a 500 — a data-minimization gap (internal error details exposed through API responses).
The sibling route `src/app/api/search-products/route.ts:49-51` already does this correctly, returning
a fixed `{ error: "Internal Server Error" }` and logging the detail server-side. This plan brings
`index-products` to the same behavior and removes the two `catch (error: any)` blocks, which also
violate the repo's `any` ban.

## Current state

- **`src/app/api/index-products/route.ts`** has two handlers (POST at the top, GET below), each
  ending with the same leak:

  ```ts
  // route.ts:132-135  (POST handler)
  } catch (error: any) {
      console.error("Search error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
  }
  ```
  ```ts
  // route.ts:412-415  (GET handler)
  } catch (error: any) {
      console.error("Search error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
  }
  ```

- **The correct pattern to copy — `src/app/api/search-products/route.ts:47-53`**:

  ```ts
  } catch (error) {
      console.error("search-products: query failed", error);
      return NextResponse.json(
          { error: "Internal Server Error" },
          { status: 500 }
      );
  }
  ```

- `src/app/api/index-products/route.test.ts` exists but currently has **no 500 / error-branch
  tests** (`grep` for `500`/`Internal` returns nothing) — this plan adds them.

### Repo conventions that apply here

- **`any` is banned** (`.claude/steering/tech.md`) — use `catch (error: unknown)`.
- Keep logging the full error **server-side** (`console.error`) so debuggability is unchanged; only
  the **client response** must not carry `error.message`.
- Match the sibling route's fixed message string `"Internal Server Error"` for consistency.

## Commands you will need

| Purpose   | Command                                                    | Expected on success        |
|-----------|-----------------------------------------------------------|----------------------------|
| Typecheck | `bunx tsc --noEmit`                                        | exit 0, no errors          |
| Route test| `bun run test -- src/app/api/index-products/route.test.ts` | all pass (incl. new tests) |
| Lint      | `bun run lint`                                             | exit 0 (warnings ok)       |

## Scope

**In scope** (the only files you should modify):
- `src/app/api/index-products/route.ts` — both catch blocks
- `src/app/api/index-products/route.test.ts` — add error-branch tests

**Out of scope** (do NOT touch):
- `src/app/api/search-products/route.ts` — already correct.
- The pagination clamping in this file (`MAX_LIMIT`/`MAX_PAGE`) — that's plan 023, already
  implemented; leave it.
- The search-input length cap (SECURITY-19) — deferred; do not add it here.
- The FULLTEXT/contains query logic — only the catch blocks change.

## Git workflow

- Branch: `advisor/062-search-error-message`
- Commit style: `fix(security): return generic 500 from product search route`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Replace both leaking catch blocks

In `src/app/api/index-products/route.ts`, change **both** occurrences (POST ~132 and GET ~412) from:

```ts
} catch (error: any) {
    console.error("Search error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
}
```

to:

```ts
} catch (error: unknown) {
    console.error("Search error:", error);
    return NextResponse.json(
        { error: "Internal Server Error" },
        { status: 500 }
    );
}
```

(`console.error(..., error)` still logs the full object when `error` is `unknown` — no `.message`
access is needed there, so no type guard is required for the log line.)

**Verify**:
- `bunx tsc --noEmit` → exit 0
- `grep -n "error: any" src/app/api/index-products/route.ts` → no matches
- `grep -n "error: error.message" src/app/api/index-products/route.ts` → no matches

### Step 2: Add error-branch tests

Add to `src/app/api/index-products/route.test.ts`, following the existing test setup in that file
(it already imports the handlers and mocks `db`). Add one test per handler:

- **POST 500 is generic** — mock the `db` call used by the POST handler to throw an error whose
  message contains a recognizable secret-ish token (e.g. `"connect ECONNREFUSED 10.0.0.5:5432"`),
  call `POST`, and assert: `res.status === 500` **and** the JSON body equals
  `{ error: "Internal Server Error" }` (assert the raw message string does **not** appear in the
  body).
- **GET 500 is generic** — same for the GET handler (mock its `db` call to throw), asserting the
  body is `{ error: "Internal Server Error" }`.

**Verify**: `bun run test -- src/app/api/index-products/route.test.ts` → all pass, including the two
new cases.

## Test plan

- New tests: the two 500-branch cases above (POST + GET), asserting the generic body.
- Structural pattern: the existing tests in `src/app/api/index-products/route.test.ts` (handler
  import + `db` mock). If that file mocks `db` via `jest.mock("@/lib/db")`, reuse that mock and make
  the relevant method `mockRejectedValueOnce(new Error(...))`.
- Verification: `bun run test -- src/app/api/index-products/route.test.ts` all pass.

## Done criteria

ALL must hold:

- [ ] `bunx tsc --noEmit` exits 0
- [ ] `grep -n "error: any" src/app/api/index-products/route.ts` → no matches
- [ ] `grep -n "error.message" src/app/api/index-products/route.ts` → no matches (client response no
      longer carries the raw message)
- [ ] Both handlers return `{ error: "Internal Server Error" }` with status 500 on failure
- [ ] `bun run test -- src/app/api/index-products/route.test.ts` passes with the two new 500 tests
- [ ] `bun run lint` exits 0
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row for 062 updated

## STOP conditions

Stop and report (do not improvise) if:

- The catch blocks at `route.ts:132`/`:412` don't match the "Current state" excerpts (drift).
- There are more than two `catch (error: any)` blocks in the file, or the message is returned from a
  location other than the two named — report the actual sites.
- The existing test file's mocking approach makes it impossible to force a 500 without touching
  out-of-scope code — report rather than restructuring the route.
- Typecheck or tests fail twice after a reasonable fix attempt.

## Maintenance notes

- Any new API route in `src/app/api/**` should follow this pattern: log the detail server-side,
  return a fixed generic message to the client. `search-products/route.ts` and (after this plan)
  `index-products/route.ts` are the two exemplars.
- Reviewer should confirm no `error.message` (or other internal detail) reaches any client response
  in this file, and that server-side logging still preserves the full error for debugging.
- The search-input length cap (SECURITY-19) is a separate deferred hardening for these same
  handlers; if it lands later, it adds a 400 branch and does not change these 500 branches.
