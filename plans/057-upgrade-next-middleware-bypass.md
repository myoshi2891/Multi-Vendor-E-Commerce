# Plan 057: Upgrade `next` off the HIGH middleware-bypass advisory (GHSA-26hh-7cqf-hhc6)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fab6315..HEAD -- package.json bun.lock src/middleware.ts`
> If `package.json`/`bun.lock` already show `next` at 16.2.5 or newer, the
> advisory may already be resolved — STOP and report the installed version
> (`grep '"version"' node_modules/next/package.json | head -1`) before doing anything.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW-MED
- **Depends on**: none
- **Category**: dependencies
- **Planned at**: commit `fab6315`, 2026-07-17

## Why this matters

`next` is declared as `^16.2.1` and resolves to `16.2.1`, which sits inside the affected range of three advisories (`>=16.0.0 <16.2.5`, all fixed in **16.2.5**):

| Advisory | Severity | Summary |
|---|---|---|
| [GHSA-26hh-7cqf-hhc6](https://github.com/advisories/GHSA-26hh-7cqf-hhc6) | **HIGH** | Middleware / Proxy bypass in App Router applications via segment-prefetch routes (Incomplete Fix Follow-Up) |
| [GHSA-8h8q-6873-q5fj](https://github.com/advisories/GHSA-8h8q-6873-q5fj) | **HIGH** | Denial of Service with Server Components |
| [GHSA-3g8h-86w9-wvmq](https://github.com/advisories/GHSA-3g8h-86w9-wvmq) | LOW | Middleware / Proxy redirects can be cache-poisoned |

**GHSA-26hh-7cqf-hhc6 is the reason this is P1.** This repo gates `/dashboard`, `/checkout` and `/profile` in `src/middleware.ts` via `createRouteMatcher([...])` + `await auth.protect()`. A middleware bypass in App Router means an attacker may reach those protected route shells without a valid session — **the same exposure plan 004 closed on the Clerk side, reopened one layer down in the framework**. Plan 004 upgraded `@clerk/nextjs` off its own CRITICAL middleware auth-bypass (GHSA-vqx2-fgx2-5wq9); that fix does not help here, because the bypass is in Next.js's own middleware/prefetch handling, not Clerk's.

Defense-in-depth reduces but does not eliminate the exposure: server actions re-verify via `src/lib/auth-guards.ts` and dashboard layouts call `currentUser()`, so data-returning paths stay guarded. But any page relying on middleware as its only gate is at risk, and this is exactly the threat model `.claude/steering/tech.md` assumes when it also leans on Next.js's Server Action Origin/Host validation for CSRF ([ADR-001](../docs/architecture/decisions/001-csrf-policy.md)) — a framework-level request-handling bypass weakens that assumption too.

The fix is a patch-level bump inside 16.2.x with a small, well-contained blast radius.

## Current state

- `package.json:80` — `"next": "^16.2.1"`; installed/resolved `16.2.1`.
- Latest available at planning time: **16.2.10** (`bun info next version`). The declared `^16.2.1` already *permits* 16.2.5+, so the lockfile is what currently holds the vulnerable version — but the floor is raised anyway so nobody can resolve back to a vulnerable 16.2.x.
- `src/middleware.ts` — the protected-route gate (the load-bearing lines):

  ```ts
  import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
  export default clerkMiddleware(async (auth, req, next) => {
      const protectedRoutes = createRouteMatcher([
          "/dashboard", "/dashboard/(.*)", "/checkout", "/profile", "/profile/(.*)",
      ]);
      if (protectedRoutes(req)) await auth.protect();
      // ... userCountry cookie logic ...
  });
  export const config = { matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"] };
  ```

- Dependents on `next`: `@clerk/nextjs` (7.5.19) and `next-cloudinary` (see peer notes below).
- `src/middleware.test.ts` exists (4 tests) and is the primary regression gate.

### Repo conventions / constraints

- **Package manager is Bun** (`bun.lock`). Install with `bun install`.
- **Do not** change `src/middleware.ts` logic — the fix is the dependency version. The `clerkMiddleware` + `auth.protect()` pattern is intentional (`.claude/steering/tech.md`, "Clerk v7 非同期 API"). The `middleware`→`proxy` deprecation is a **documented non-action** — do not rename the file.
- This is a **patch bump inside 16.2.x**, not a major/minor migration. No codemods, no config changes expected.

### Pre-existing conditions — do NOT attribute these to this upgrade

Read this before running anything, so a pre-existing red does not get misdiagnosed as an upgrade regression:

1. **`next-cloudinary` peer mismatch already exists.** Its `peerDependencies.next` is `"^12 || ^13 || ^14 || >=15.0.0-rc || ^15"` — it does **not** declare 16.x, and the repo already runs `next@16.2.1`. Any peer warning naming `next-cloudinary` is **pre-existing and unchanged** by a 16.2.1 → 16.2.x bump. Do not "fix" it here, and do not let it block the install.
2. **`bun run build` may already fail** on known open issues unrelated to this bump: **OI-9** (home `/` SSR 500 — `featured.tsx` reads `window` in a `useState` initializer) and **OI-11** (`/dashboard/seller` SSR `ReferenceError: self is not defined` — `next-cloudinary`'s `CldUploadWidget` evaluated on the server). Both are tracked in [`docs/testing/QA_HANDOFF.md`](../docs/testing/QA_HANDOFF.md). If build fails with **either** signature, that is **not** caused by this upgrade — record it and continue. Only a *new*, different build failure is a STOP condition.
3. **`bun audit` will still report vulnerabilities after this bump.** The remaining CRITICAL is `handlebars` via `ts-jest` (dev-only, not production-reachable) — recorded as **DEPS-05** in [`plans/README.md`](README.md) and explicitly rejected. Success here is scoped to the `next` advisories only, not a zero-vuln audit.

### Peer compatibility (verified at planning time)

- `@clerk/nextjs@7.5.19` peers `next: "^15.2.8 || ^15.3.8 || ^15.4.10 || ^15.5.9 || ^15.6.0-0 || ^16.0.10 || ^16.1.0-0"` → **16.2.5+ satisfies** `^16.1.0-0`. No Clerk change needed.
- `next-cloudinary` — see pre-existing condition 1 above.

## Commands you will need

| Purpose         | Command                                     | Expected                     |
|-----------------|---------------------------------------------|------------------------------|
| Latest version  | `bun info next version`                     | prints latest 16.x           |
| Install         | `bun install`                               | exit 0, lock updated         |
| Audit (check)   | `bun audit`                                 | `next` advisories gone       |
| Typecheck       | `bunx tsc --noEmit`                         | exit 0                       |
| Middleware test | `bun run test -- src/middleware.test.ts`    | all pass                     |
| Full unit suite | `bun run test`                              | 1685 passed / 1688 total     |
| Lint            | `bun run lint`                              | exit 0 (warns ok)            |

## Scope

**In scope**:
- `package.json` — raise the `next` floor to a patched version
- `bun.lock` — regenerated by `bun install`

**Out of scope**:
- `src/middleware.ts` and any source file — no code changes expected. If the upgrade forces a code change, that is a STOP condition (report it; do not improvise a refactor).
- Clerk, Prisma, `next-cloudinary`, or any unrelated dependency. In particular **do not** attempt to resolve the `next-cloudinary` peer mismatch or the `handlebars` dev advisory here.
- **OI-9 / OI-11** — the pre-existing SSR failures. They are separate work; do not fix them in this plan.
- A Next.js minor/major migration (17.x, or 16.3+ if it appears) — this plan is a patch bump within 16.2.x.

## Git workflow

- Branch: `advisor/057-upgrade-next`
- Commit style: `chore(deps): upgrade next to ^16.2.x (GHSA-26hh-7cqf-hhc6)`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Raise the floor and reinstall

Confirm the latest 16.2.x first:

```
bun info next version
```

In `package.json:80`, change `"next": "^16.2.1"` to the latest `16.2.x` (at planning time `^16.2.10`; **the floor must be at least `^16.2.5`** — that is the fixed version the advisories name). Then:

```
bun install
```

**Verify**: `bun install` exits 0 and the lock now resolves `next` to `>= 16.2.5`. Check both:
- `grep -A2 '"next"' bun.lock | head`
- `grep '"version"' node_modules/next/package.json | head -1`

> Peer warnings naming `next-cloudinary` are expected and pre-existing — see "Pre-existing conditions" above. A peer *error* that aborts the install is a STOP condition.

### Step 2: Typecheck + the middleware regression gate

**Verify**:
- `bunx tsc --noEmit` → exit 0 (no new type errors from the Next types)
- `bun run test -- src/middleware.test.ts` → all pass

`src/middleware.test.ts` is the direct regression gate for the gate this advisory attacks. If it fails because a mock shape changed, adjust **only the test mock** — not production code. If production code must change, STOP.

### Step 3: Confirm the advisories are cleared

**Verify**: `bun audit` no longer lists the three `next` advisories:

```
bun audit 2>&1 | grep -c "26hh-7cqf-hhc6"   # expect 0
bun audit 2>&1 | grep -c "8h8q-6873-q5fj"   # expect 0
bun audit 2>&1 | grep -c "3g8h-86w9-wvmq"   # expect 0
```

The `next  >=16.0.0 <16.2.5` block should be gone entirely. Remaining unrelated findings (notably the `handlebars` CRITICAL via `ts-jest`) are expected — see pre-existing condition 3. Do not chase them here.

### Step 4: Full test + lint

**Verify**:
- `bun run test` → all pass (baseline at planning time: **1685 passed / 1688 total / 174 suites**, 3 skipped)
- `bun run lint` → exit 0 (0 errors; ~15 warnings are the known baseline)

### Step 5: Manual protected-route smoke (report-only)

This cannot be fully automated in the executor sandbox. With the dev server running (`bun run dev`), an **unauthenticated** request to `/dashboard` must redirect to sign-in rather than render the dashboard shell:

```
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000/dashboard
```

Expect a redirect to the Clerk sign-in URL, not `200` with dashboard markup. If you can run the dev server, confirm and note the result; if not, record in your report that this manual check is pending.

> This is a smoke check of the gate, **not** a proof that the segment-prefetch bypass is closed — reproducing the advisory's prefetch vector is out of scope. The version bump is the fix; this only confirms the gate still functions normally after it.

## Test plan

- No new automated tests are required (this is a version bump). The regression gate is the existing suite: `src/middleware.test.ts` plus the full unit run must stay green.
- If a mock had to change, note exactly which mock and why in the commit body.
- Verification: `bun run test` all pass; `bun audit` shows no `next` advisories.

## Done criteria

ALL must hold:

- [ ] `package.json` declares `next` with a floor `>= ^16.2.5`
- [ ] `bun.lock` and `node_modules/next/package.json` both resolve `next` to `>= 16.2.5`
- [ ] `bun audit` reports none of GHSA-26hh-7cqf-hhc6 / GHSA-8h8q-6873-q5fj / GHSA-3g8h-86w9-wvmq
- [ ] `bunx tsc --noEmit` exits 0
- [ ] `bun run test -- src/middleware.test.ts` passes
- [ ] `bun run test` exits 0 (full unit suite green; expect 1685/1688 unless other work landed)
- [ ] `bun run lint` exits 0
- [ ] No files under `src/` were modified (`git status` shows only `package.json` + `bun.lock`)
- [ ] `plans/README.md` status row for 057 updated
- [ ] Step 5 smoke result recorded (done, or explicitly flagged pending)

## STOP conditions

Stop and report if:

- The upgrade requires changing any `src/` production file — report the file + error; do not attempt a migration.
- `bun install` **fails** (not merely warns) to resolve peers — report the conflict. A `next-cloudinary` peer *warning* is pre-existing and is **not** a STOP condition.
- `bunx tsc --noEmit` reports new errors originating in Next.js types.
- `src/middleware.test.ts` fails in a way implying a real API change rather than a mock-shape tweak.
- `bun run build` fails with a **new** signature — i.e. anything other than the known OI-9 (`window` in `featured.tsx`) or OI-11 (`self is not defined` via `CldUploadWidget`) failures.
- The latest 16.2.x is still inside an advisory range (i.e. a newer advisory has superseded this one) — report rather than bumping to 16.3/17.x on your own initiative.

## Maintenance notes

- **Do not bundle other upgrades.** The `handlebars` CRITICAL (dev-only, DEPS-05) and the Prisma 5→6 major (DEPS-04) are separate, deliberately deferred items — keep this diff version-only.
- `next-cloudinary`'s missing 16.x peer declaration is a real (pre-existing) latent issue and is entangled with **OI-11**; if it is ever addressed, do it in the OI-11 work, not in a security bump.
- Watch for the `middleware`→`proxy` migration Next.js is signposting — the repo has a documented decision NOT to rename `src/middleware.ts` until Clerk officially supports `proxy.ts` (`.claude/steering/tech.md`). Do not act on that deprecation warning here.
- Reviewer should confirm the diff is version-only (plus lockfile) and that the unauthenticated `/dashboard` smoke was performed or explicitly flagged pending.
- Lesson from plan 004's own text worth carrying: when an advisory names a fixed version, pin/floor **that exact version or newer** — a range that still admits the vulnerable version is not a fix.
