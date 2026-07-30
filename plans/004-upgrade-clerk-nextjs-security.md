# Plan 004: Upgrade `@clerk/nextjs` off the CRITICAL middleware auth-bypass advisory

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f9752c0..HEAD -- package.json bun.lock src/middleware.ts plans/README.md`
> If `package.json`/`bun.lock` already show `@clerk/nextjs` at 7.2.1 or newer, the **CRITICAL**
> advisory (GHSA-vqx2-fgx2-5wq9, 7.x range `>=7.0.0 <7.2.1`) is cleared.
>
> **STOP only when *both* advisories are clear** — i.e. `@clerk/nextjs` >= 7.2.1 **and** the
> `js-cookie` resolved in `bun.lock` is a fixed version. Do **not** stop on the `@clerk/nextjs`
> number alone: that closes the plan with the HIGH advisory unverified, since the two are decided
> by different packages (see the next paragraph). If only the CRITICAL is clear, **continue** —
> skip the `@clerk/nextjs` bump, verify and if necessary remediate the `js-cookie` path, and
> report which of the two was already satisfied.
>
> **A `@clerk/nextjs` version alone is not a sufficient condition for *both* advisories.** The HIGH
> `js-cookie` advisory is a **transitive** dependency reached through `@clerk/shared`, so it is the
> **resolved `js-cookie` version in `bun.lock`** that decides it — not the `@clerk/nextjs` number.
> A given `@clerk/nextjs` release can still resolve an unfixed `js-cookie` depending on how the
> lockfile pins `@clerk/shared`. Check the two independently:
>
> ```bash
> # CRITICAL / the path that pulls js-cookie. `node -p` は不在時に非 0 で loud に失敗するため、
> # 「パッケージが消えていた」を「合格」と読み違えない。
> node -p "require('./node_modules/@clerk/nextjs/package.json').version"   # CRITICAL: need >= 7.2.1
> node -p "require('./node_modules/@clerk/shared/package.json').version"   # the path that pulls js-cookie
> node -p "require('./node_modules/js-cookie/package.json').version"       # HIGH: installed js-cookie
>
> # HIGH: lockfile 側の**解決済み**バージョン（node_modules と二重に確認する）
> resolved=$(grep -oE '"js-cookie": \["js-cookie@[^"]+"' bun.lock \
>   | sed -E 's/.*js-cookie@//; s/"$//' | sort -u)
> if [ -z "$resolved" ]; then
>     echo "FAIL: no resolved js-cookie entry in bun.lock"; false
> else
>     echo "OK: js-cookie resolved to: $resolved"
> fi
> ```
>
> **旧版の `grep -oE '"js-cookie": "[^"]*"' bun.lock | sort -u` は 2 つの理由で成立しない**
> （どちらも実測で確認済み）:
>
> 1. **見ている対象が違う。** そのパターンが当たるのは `@clerk/shared` の依存宣言
>    （`"js-cookie": "3.0.7"`）であって、本文が「これが決める」と言っている**解決済みエントリ**
>    （`"js-cookie": ["js-cookie@3.0.7", …]`、`bun.lock` のパッケージ表）ではない。宣言レンジと
>    解決結果は一致しないことがあり、まさにその乖離を検出したいのだからここは致命的。
> 2. **空振りが成功として現れる（fail open）。** `grep` が 0 件でも末尾の `sort` が exit 0 を
>    返すため、lockfile 形式の変更や依存の消滅で**何も照合できていない**状態が「合格」になる。
>    上の形は結果を変数へ束ね `[ -z … ]` で判定するので、空振り = exit 1 になる
>    （`if … then FAIL … else OK … fi` 形の根拠は [`plans/023`](023-bound-and-validate-public-search-pagination.md)
>    の Done criteria blockquote と同じ）。
>
> **Measured (2026-07-31)**: `@clerk/nextjs@7.5.19` (range `^7.5.0`), `@clerk/shared@4.25.4`,
> `js-cookie@3.0.7` — both advisories clear（値は 2026-07-26 の実測から不変）。ゲート自体も
> 合格側 exit 0 / 空振り側 exit 1 の**両方向**を再確認済み（2026-07-30 に本節のゲート、
> 2026-07-31 に Step 1 の js-cookie ゲート）。Authoritative advisory ranges are
> recorded in [`plans/audit/findings-06-dependencies.md`](audit/findings-06-dependencies.md); do not
> restate them here (same GHSA carries different ranges per major series — 6.x is `<6.39.2`, 5.x is
> `<5.7.6`).

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW-MED
- **Depends on**: none
- **Category**: dependencies
- **Planned at**: commit `f9752c0`, 2026-07-03

## Why this matters

`@clerk/nextjs` is pinned at `^7.0.7` and resolves to `7.0.7`, which is inside the affected range of **GHSA-vqx2-fgx2-5wq9** (CRITICAL, middleware-based route-protection bypass, affects `>=7.0.0 <7.2.1`, fixed in `7.2.1`) plus HIGH GHSA-w24r-5266-9c3c. This repo's `src/middleware.ts` uses exactly the pattern the advisory targets: `createRouteMatcher([...])` + `await auth.protect()` gating `/dashboard`, `/checkout`, `/profile`. An attacker could reach those protected route shells without a valid session. Defense-in-depth (server actions re-check via `src/lib/auth-guards.ts`, dashboard layouts call `currentUser()`) reduces but does not eliminate exposure — any page that relies on middleware as its only gate is at risk. Upgrading within the v7 line closes the advisory with a small, well-contained blast radius. This upgrade also lifts the transitive HIGH `js-cookie@3.0.5` (via `@clerk/shared`) when Clerk pulls a patched `@clerk/shared`.

## Current state

- `package.json:21` — `"@clerk/nextjs": "^7.0.7"`; `bun.lock` resolves to `7.0.7`.
- `package.json:116` — `"@clerk/testing": "^2.0.7"` (keep compatible).
- `src/middleware.ts` — the protected-route gate (full file is short; the relevant lines):

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

- Clerk is imported at ~55 sites across `src/` (middleware, `ClerkProvider` in `layout.tsx`, `SignIn`/`SignUp`/`UserProfile` UI, `clerkClient` in `webhooks/route.ts` and `store.ts`, and `currentUser()` in dashboard layouts + many `src/queries/*`). None use APIs removed between 7.0 and 7.5 (this is a same-major upgrade).
- `src/middleware.test.ts` exists (4 tests) and Clerk is mocked in the `src/queries/*.test.ts` suites.

### Repo conventions / constraints

- **Package manager is Bun** (`bun.lock`). Install with `bun install`.
- **Do not** change `src/middleware.ts` logic — the fix is the dependency version. The `clerkMiddleware` + `auth.protect()` pattern is intentional and remains valid in 7.5.x (see `.claude/steering/tech.md`, "Clerk v7 非同期 API"). The `middleware`→`proxy` deprecation is a **documented non-action** — do not rename the file.
- Peer requirement: `@clerk/nextjs` 7.x peers `next: ^16.1.0-0`; repo runs `next@16.2.1` — satisfied. Do not bump Next.

## Commands you will need

| Purpose         | Command                                        | Expected            |
|-----------------|------------------------------------------------|---------------------|
| Install         | `bun install`                                  | exit 0, lock updated|
| Audit (check)   | `bun audit`                                     | Clerk CRITICAL gone |
| Typecheck       | `bunx tsc --noEmit`                            | exit 0              |
| Middleware test | `bun run test -- src/middleware.test.ts`       | all pass            |
| Clerk-mocked    | `bun run test -- src/queries/user.test.ts`     | all pass            |
| Lint            | `bun run lint`                                 | exit 0 (warns ok)   |

## Scope

**In scope**:
- `package.json` — bump `@clerk/nextjs` (and `@clerk/testing` only if peer-required)
- `bun.lock` — regenerated by `bun install`
- `plans/README.md` — update plan 004 status when complete

**Out of scope**:
- `src/middleware.ts` and any Clerk-using source file — no code changes expected. If the upgrade forces a code change, that is a STOP condition (report it; do not improvise a broad refactor).
- Prisma, Next.js, or any unrelated dependency.
- The `js-cookie` override (only add it if step 3's audit still shows the HIGH after the bump — see step 3).

## Git workflow

- Branch: `advisor/004-upgrade-clerk`
- Commit style: `chore(deps): upgrade @clerk/nextjs to ^7.5.x (GHSA-vqx2-fgx2-5wq9)`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Bump the version and reinstall

In `package.json`, change `"@clerk/nextjs": "^7.0.7"` to the latest `7.x` (target `^7.5.0` or newer; confirm the exact latest 7.x with `bun info @clerk/nextjs version` or npm view). Then:

```
bun install
```

**Verify**: `bun install` exits 0 and `bun.lock` now resolves `@clerk/nextjs` to a version `>= 7.2.1`
(CRITICAL) **and** resolves `js-cookie` to a fixed version (HIGH — transitive via `@clerk/shared`,
so it must be checked separately rather than inferred from the `@clerk/nextjs` number):

```bash
grep -A2 '"@clerk/nextjs"' bun.lock | head
grep -oE '"js-cookie@[0-9][^"]*"' bun.lock | tr -d '"' | sort -u   # → js-cookie@3.0.7
```

> **なぜ `'"js-cookie": "[^"]*"'` ではないか。** `bun.lock` は同じキー名を 2 つの意味で使う:
>
> - **宣言レンジ** — 依存元の `dependencies` 内。`"js-cookie": "3.0.7"`（コロンの後は文字列）
> - **解決済みエントリ** — トップレベルのパッケージ表。`"js-cookie": ["js-cookie@3.0.7", …]`
>   （コロンの後は**配列**）
>
> 旧コマンドはコロン直後に `"` を要求するため、**構造的に宣言レンジ側にしか当たらない**。
> ここで確かめたいのは「`bun install` が実際に何を解決したか」なので、宣言を見ていては
> 検査の主張が成立しない（レンジは patched 版を許すが、lock が古い版に留まる状況こそが
> このステップの警戒対象）。`"js-cookie@<version>"` の形は解決済みエントリにしか現れない。
>
> **両方向を確認済み（2026-07-31）**: 合格側は `js-cookie@3.0.7` を 1 行出力。パッケージ名を
> 実在しないものに差し替えると出力が空になり、`[ -z … ]` 判定側で exit 1 に落ちる
> （空振りが PASS にならないこと＝ fail closed であることの確認）。

### Step 2: Typecheck + run the Clerk-touching tests

**Verify**:
- `bunx tsc --noEmit` → exit 0 (no new type errors from the Clerk types)
- `bun run test -- src/middleware.test.ts` → all pass
- `bun run test -- src/queries/user.test.ts` → all pass (a representative Clerk-mocked suite)

If any Clerk-mocked test fails because the mock shape changed, adjust **only the test mock** to match the new Clerk surface — not production code. If production code must change, STOP.

### Step 3: Confirm the advisory is cleared

**Verify**: `bun audit` no longer lists the `@clerk/nextjs` CRITICAL GHSA-vqx2-fgx2-5wq9. Then check `js-cookie`:
- `grep -A2 'js-cookie' bun.lock | head` — if `@clerk/shared` advanced to a release pinning a patched `js-cookie` (the exact fixed version the advisory names), the HIGH is gone.
- **Only if** `bun audit` still shows the `js-cookie` HIGH after the bump, add a
  temporary override to `package.json` and reinstall. If the bump already
  cleared it (the expected case — Clerk pulls a patched `@clerk/shared`),
  **skip this step entirely**: an unnecessary override pins a transitive
  dependency that upstream is otherwise free to advance, and it silently holds
  back future patches.

  When it *is* needed, pin the exact patched version the advisory names rather
  than a caret range:

  ```json
  "overrides": { "js-cookie": "3.0.6" }
  ```

  (Replace `3.0.6` with whatever exact version the advisory lists as fixed.)
  Re-run `bun audit`. If it cannot be resolved without breaking Clerk, STOP and
  report — do not force-downgrade Clerk.

  > **Correction (2026-07-18)**: an earlier revision justified the exact pin by
  > claiming a range like `^3.0.5` "still resolves to the vulnerable `3.0.5`".
  > That is not how caret ranges work — `^3.0.5` means `>=3.0.5 <4.0.0`, and a
  > fresh resolution picks the newest matching `3.x`, i.e. it *would* pick up
  > the patched release. The instruction (pin exactly) stands, but for different
  > reasons: a range does not **guarantee** the patched version, because an
  > already-satisfying entry in `bun.lock` is left in place and the audit can
  > still fail after reinstall; and an override is meant to be a temporary,
  > auditable assertion of one known-good version — a floating range makes it
  > impossible to tell later whether the override is still doing anything.

### Step 4: Full test + lint

**Verify**:
- `bun run test` → all pass (full unit suite; confirms no Clerk-mock regressions elsewhere)
- `bun run lint` → exit 0

### Step 5: Manual protected-route smoke (report-only)

This step cannot be fully automated in the executor sandbox. Document for the reviewer: with the dev server running (`bun run dev`), an **unauthenticated** request to `/dashboard` must redirect to sign-in (not render the dashboard shell). If you can run the dev server, confirm and note the result; if not, record in your report that this manual check is pending.

## Test plan

- No new automated tests are strictly required (this is a version bump), but the existing `src/middleware.test.ts` and Clerk-mocked query suites are the regression gate — they must stay green.
- If a Clerk mock had to change, note exactly which mock and why in the commit body.
- Verification: `bun run test` all pass; `bun audit` CRITICAL cleared.

## Done criteria

ALL must hold:

- [ ] `package.json` shows `@clerk/nextjs` at `>= 7.2.1` (target `^7.5.x`)
- [ ] `bun.lock` resolves `@clerk/nextjs` to `>= 7.2.1` — clears the **CRITICAL** advisory
- [ ] **Separately**, `bun.lock` resolves `js-cookie` to a fixed version — clears the **HIGH**
      transitive advisory. This is **not implied** by the `@clerk/nextjs` number; it is reached via
      `@clerk/shared`, so verify it on its own:
      `grep -oE '"js-cookie": "[^"]*"' bun.lock | sort -u`
- [ ] `bun audit` no longer reports GHSA-vqx2-fgx2-5wq9 for `@clerk/nextjs`
- [ ] `bunx tsc --noEmit` exits 0
- [ ] `bun run test` exits 0 (full unit suite green)
- [ ] `bun run lint` exits 0
- [ ] No source files under `src/` were modified — before the **bump commit**, `git status` shows only `package.json` + `bun.lock` (and optionally test-mock files if a mock changed)
- [ ] `plans/README.md` status row for 004 updated — in a **separate docs commit**, after the bump commit

## STOP conditions

Stop and report if:

- The upgrade requires changing any `src/` production file (a real breaking change between 7.0 and the target) — report the file + error; do not attempt a broad migration.
- `bun install` fails to resolve peers (e.g. it demands a Next.js bump) — report the peer conflict.
- `bun audit` shows the `js-cookie` HIGH persists and no clean override resolves it — report; do not downgrade Clerk.
- More than a couple of Clerk-mocked tests fail in a way that implies a real API change, not just a mock-shape tweak.

## Maintenance notes

- Keep `@clerk/testing` compatible with the `@clerk/nextjs` major; bump it only if the peer range requires it.
- Watch for the `middleware`→`proxy` migration Clerk is signposting — the repo has a documented decision NOT to rename `src/middleware.ts` until Clerk officially supports `proxy.ts` (`.claude/steering/tech.md`). Do not act on that deprecation warning here.
- Reviewer should confirm the diff is version-only (plus lockfile) and that the manual unauthenticated `/dashboard` smoke was performed or explicitly flagged pending.
- Follow-up: the Prisma 5→6 major lag (DEPS-04) is a separate, larger upgrade — do not bundle it with this security bump.

### Resolution status (last verified 2026-07-31)

This plan is **DONE** and **both advisories are closed in the current tree**.
The "Why this matters" and "Current state" sections above describe the tree at
commit `f9752c0` and are left as the historical record — do not read them as
the present state:

> **Dates in this document (2026-07-27 clarification, updated 2026-07-31).** This file
> carries more than one verification timestamp and they are *not* interchangeable —
> always read the one attached to the claim you are checking:
>
> - **2026-07-18** — when the resolution was *first* confirmed and this section written.
> - **2026-07-31** — the most recent re-measurement, recorded in the "Measured" note at
>   the top of this plan (`@clerk/nextjs@7.5.19` / `@clerk/shared@4.25.4` / `js-cookie@3.0.7`
>   — unchanged from the 2026-07-26 run). The table below reflects **this** run.
>
> The heading previously read "verified 2026-07-18" while the table already carried newer
> values, so the section looked staler than it was. Later re-measurements must update the
> heading date, the table column header, **and** the "Measured" note together, or they
> drift apart again. The 2026-07-30 entry that briefly sat only in the "Measured" note was
> this same failure recurring; it is folded in above.

| Item | As planned (`f9752c0`) | Current tree (2026-07-31) |
|---|---|---|
| `@clerk/nextjs` | `^7.0.7` → resolves `7.0.7` (inside GHSA-vqx2-fgx2-5wq9, `>=7.0.0 <7.2.1`) | `^7.5.0` → resolves `7.5.19` — outside the affected range |
| `@clerk/testing` | `^2.0.7` | `^2.2.9` |
| `js-cookie` (transitive) | `3.0.5` via `@clerk/shared` (HIGH) | `3.0.7` via `@clerk/shared@4.25.4` |

Consequently **no `js-cookie` override was required**, and none should be added:
the Clerk bump carried a patched `@clerk/shared`, which is exactly the outcome
Step 3 anticipates. Step 3's override block therefore remains a conditional
contingency, not a step to execute.

Later Clerk work: `plans/057` bumped `next` (not Clerk) — the `middleware`→`proxy`
deprecation noted above is still deliberately unaddressed per
`.claude/steering/tech.md`.
