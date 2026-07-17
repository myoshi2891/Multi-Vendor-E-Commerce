# Plan 025 (Spike): Design a rate-limiting seam for public, unauthenticated endpoints

> **Executor instructions**: This is a **design spike**, not an implementation
> plan. Your deliverable is a design document plus a follow-up implementation
> plan — **you must not change any application source code** (`src/`,
> `next.config.mjs`, `package.json`, etc.). If the spike surfaces a decision the
> maintainer must make (e.g. "adopt Upstash" vs "in-memory only"), record it as
> an open question and STOP; do not decide it unilaterally. When done, update
> the status row for this plan in
> `plans/audit/findings-11-security-followup.md`.
>
> **Drift check (run first)**:
> `git diff --stat 78397dc..HEAD -- src/app/api next.config.mjs`
> If the public API routes changed since this plan was written, note the deltas
> in your design doc's "current state" section before proceeding.

## Status

- **Priority**: P3
- **Effort**: M (design only)
- **Risk**: LOW-MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `78397dc`, 2026-07-10
- **Type**: **design/spike** — produces a design doc + a follow-up implementation plan, then STOPS.

## Why this matters

There is **no rate limiting anywhere** in the codebase (a repo-wide search for
`ratelimit` / `upstash` / `throttle` returns zero implementation hits). Several
**public, unauthenticated** endpoints are abusable, but **for different reasons —
do not lump them into one "DB load" bucket**:

- **The two full-text search routes** run comparatively expensive **database work**
  (tsvector queries) on every call → a single client can drive heavy DB load
  without authenticating, compounding with the unbounded pagination in `plans/023`.
- **The cookie-set route** (`POST /api/setUserCountryInCookies`) does **no database
  work** — it validates the body and writes a cookie. Its abuse profile is
  **write/CPU/cookie-bloat spam**, not DB load. Rate-limiting it is still warranted,
  but the rationale and limits differ from the search routes (see `plans/024` for
  its input hardening).

This is a cross-cutting defense-in-depth gap, not a single bug — and whether/how to
add rate limiting (in-memory vs a shared store like Upstash vs edge/WAF) is a
maintainer decision with real trade-offs. So the right first step is a **design
spike**, not a code change.

## Current state (facts to inline into the design doc)

Public, unauthenticated endpoints (verified at `78397dc`):

- `src/app/api/index-products/route.ts` — `POST` (suggestion search, `take: 50`) and `GET` (paginated search). Both run Prisma `findMany` with full-text `search` and a `contains` fallback.
- `src/app/api/search-products/route.ts` — `GET`, runs `db.$queryRaw` with `to_tsvector` / `plainto_tsquery` (fixed `LIMIT 50`).
- `src/app/api/setUserCountryInCookies/route.ts` — `POST`, sets a cookie.

Signed/authenticated endpoints that should **not** need app-level rate limiting
(they have their own protections; note but exclude):

- `src/app/api/webhooks/route.ts` (Clerk/Svix signature-verified), `src/app/api/webhooks/stripe/route.ts`, `src/app/api/webhooks/paypal/route.ts`.

Relevant constraints (inline into the doc — the reader may not have these):

- `.claude/steering/product.md` "スコープ外（現フェーズ）" lists multi-currency, tax engine, advanced analytics, and third-party shipping-carrier integration. **Rate limiting is NOT listed** — so it is neither in-scope-approved nor explicitly out-of-scope. Flag this: the maintainer must decide whether rate limiting is in the current phase's scope.
- Hosting/runtime: Next.js 16 (App Router), deployed target per `docs/` (Vercel-style serverless assumed). In serverless, **in-memory counters do not share state across instances** — call this out as the key trade-off.
- DB is Prisma + Prisma Accelerate over Neon (connection-pooled). Note that Accelerate has its own limits but is not a substitute for request-level rate limiting.
- ADR process: `docs/architecture/decisions/` (MADR format, template at `docs/architecture/decisions/template.md`). A rate-limiting decision that compares alternatives and affects the whole app **meets the ADR bar** (`.claude/steering/documentation-guide.md`: multiple alternatives + team-wide + future reference + trade-offs). The spike should recommend whether to open an ADR.

## Commands you will need

| Purpose        | Command                                                        | Expected            |
|----------------|----------------------------------------------------------------|---------------------|
| Enumerate routes | `find src/app/api -name route.ts`                            | lists the 6 routes  |
| Confirm no rate limit exists | `grep -rniE "ratelimit|upstash|throttle" src`     | no matches          |
| Inspect deps   | `grep -iE "upstash|rate" package.json`                         | (likely no matches) |

This spike is read-only analysis — do not run installs or builds.

## Scope

**In scope** (the only files you may create):
- `docs/architecture/rate-limiting-spike.md` — the design document (see "Deliverable" below). (If the repo prefers spikes under `plans/`, create `plans/direction/rate-limiting-spike.md` instead and say which you chose.)
- A follow-up implementation plan file at the **next free plan number at execution time** (e.g. `plans/0NN-implement-rate-limit-...md`) — created only after the design doc's open questions are answered by the maintainer. If the maintainer has not answered them, STOP after the design doc and do not write the implementation plan yet.

**Out of scope** (do NOT touch):
- All of `src/`, `next.config.mjs`, `package.json`, `bun.lock` — no code, no deps.
- The webhook routes — signature-verified; excluded from the rate-limit surface.
- `plans/023` / `plans/024` scope (they fix distinct issues; reference them, don't duplicate).

## Git workflow

- Commit style: `docs(...)` for the design doc (Conventional Commits). Example: `docs(architecture): rate-limiting design spike`.
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Confirm the surface and the gap

Run the three commands above. Record in the doc: the exact public-endpoint list,
confirmation that no rate limiting exists, and whether any rate-limit dependency
is already present.

**Verify**: the design doc's "Current state" section lists the endpoints from the `find` output and states the `grep` returned no matches.

### Step 2: Write the design document

`docs/architecture/rate-limiting-spike.md` must contain:

1. **Problem & surface** — the public endpoints, their per-call cost, the abuse scenario (compounds with `plans/023`).
2. **Options compared**, each with pros/cons and a serverless-correctness note:
   - **A. In-memory token bucket** (e.g. a small LRU per instance) — simplest, zero deps; **does not share state across serverless instances** (weak under scale-out). Good as a coarse per-instance safety net only.
   - **B. Shared store (Upstash Redis / `@upstash/ratelimit`)** — correct across instances; adds an external dependency + env config + latency per check.
   - **C. Edge/platform layer (Vercel WAF / middleware-level limiting)** — offloads to infra; may not be available on the current plan; least app code.
   - **D. Do nothing now** — accept the risk this phase; document why (valid if traffic is low / pre-launch).
3. **Key strategy questions** to answer regardless of option: keying (per-IP vs per-user for authenticated routes), limits per endpoint class (search vs cookie-set), what response to return (429 + `Retry-After`), and where the limiter runs (middleware vs per-route).
   - **`x-forwarded-for` trust boundary (must design, not skip)**: `x-forwarded-for`
     is a **client-supplied, spoofable header**. Using the raw header as the
     rate-limit key lets an attacker rotate it to get unlimited fresh buckets,
     defeating the limiter. The design must specify how a **trusted** client IP is
     derived: e.g. take the value the platform's trusted proxy appends (on Vercel,
     the platform-provided client IP / the right-most hop added by infra you
     control), not the left-most attacker-controlled entry. Define how many proxy
     hops are trusted and where the boundary sits. If a trustworthy client IP
     cannot be established for a given deployment, prefer keying that doesn't rely
     on the header (e.g. edge/WAF layer, or per-session for authenticated routes)
     and record that limitation. **Never key the limiter on the raw
     `x-forwarded-for` string.**
4. **Scope decision needed** — explicitly ask the maintainer whether rate limiting is in the current phase (given `product.md` doesn't list it either way).
5. **Recommendation** — a ranked recommendation with rationale, and whether to open an ADR under `docs/architecture/decisions/` (MADR format).
6. **Open questions** — the decisions only the maintainer can make (option choice, scope, budget for an external store).

### Step 3: Gate — decide whether to write the follow-up plan

If (and only if) the maintainer has answered the open questions (option chosen,
scope confirmed), write the follow-up implementation plan at the next free
number, sized to the chosen option, following `plans/`'s template
(`.agent/skills/improve/references/plan-template.md`): in/out scope, per-step
verification, tests, done criteria, STOP conditions.

If the questions are unanswered, **STOP** after Step 2 and report that the design
doc is ready for maintainer review.

## Done criteria

- [ ] `docs/architecture/rate-limiting-spike.md` (or the `plans/direction/` variant) exists and contains all six sections from Step 2.
- [ ] The doc lists the exact public endpoints from `find src/app/api -name route.ts` and confirms `grep -rniE "ratelimit|upstash|throttle" src` returned no matches.
- [ ] No files under `src/`, `next.config.mjs`, or `package.json` were modified (`git status` shows only the new doc, the `plans/audit/findings-11-security-followup.md` status row, and the follow-up plan — the last only if the gate in Step 3 was passed).
- [ ] The doc contains an explicit "Open questions for the maintainer" section.

## STOP conditions

Stop and report back (do not improvise) if:

- You find yourself editing any `src/` file or adding a dependency — this spike is design-only; that means the scope was misread.
- The public-endpoint surface changed materially since `78397dc` (new unauthenticated routes) — note them and confirm the surface list before recommending.
- The maintainer's answers to the open questions are not available — STOP after the design doc; do not pick an option or write the implementation plan.

## Maintenance notes

- This spike intentionally produces **no runtime change**. The value is a decided, documented approach the maintainer can green-light.
- If Option B (Upstash) is chosen, the follow-up plan must cover: dependency pin (SHA/version per `.claude/rules/01-engineering-standards.md` CI pinning if it touches workflows), env vars (`.env.example` update per the repo's env-docs convention), and a fail-open vs fail-closed decision when the store is unreachable.
- Cross-refs: `plans/023` (bounds `index-products` pagination — reduces the per-call blast radius) and `plans/024` (validates the cookie-set endpoint). Rate limiting is the orthogonal, cross-cutting layer on top of both.
