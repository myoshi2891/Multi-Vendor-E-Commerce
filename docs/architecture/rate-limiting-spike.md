# Rate-limiting design spike for public endpoints

- **Status**: Design ready for maintainer decision
- **Date**: 2026-07-16
- **Related plan**: [`plans/025-spike-rate-limit-public-endpoints.md`](../../plans/025-spike-rate-limit-public-endpoints.md)

## Problem and surface

The application has no request-level rate limiting.  This is a defense-in-depth
gap for public, unauthenticated handlers: a client can repeatedly invoke the
expensive search work without first establishing an account or session.  It is
orthogonal to the input and pagination hardening in
[`plans/023`](../../plans/023-bound-and-validate-public-search-pagination.md)
and [`plans/024`](../../plans/024-validate-usercountry-cookie-write.md).
Those plans reduce the cost or validity of an individual request; they do not
bound the number of requests a client can make.

| Route | Method | Per-request work | Abuse concern |
| --- | --- | --- | --- |
| `/api/index-products` | `POST` | Prisma `findMany` full-text search, with case-insensitive `contains` fallback; returns up to 50 products | Repeated search can create substantial database work. |
| `/api/index-products` | `GET` | Paginated Prisma `findMany` full-text search, with `contains` fallback and a count query | Repeated work is expensive and the per-call blast radius also compounds with the currently unbounded pagination addressed by plan 023. |
| `/api/search-products` | `GET` | Prisma `$queryRaw` using PostgreSQL `to_tsvector` / `plainto_tsquery`, fixed `LIMIT 50` | Repeated full-text queries consume database capacity. |
| `/api/setUserCountryInCookies` | `POST` | Parses a JSON body and writes a response cookie; no database query | This is write/CPU/cookie-bloat spam, not a database-load path.  It needs a separately tuned limit. |

The following routes were also enumerated but are excluded from this app-level
public rate-limit surface because they have signature verification appropriate
to their webhook role: `/api/webhooks`, `/api/webhooks/stripe`, and
`/api/webhooks/paypal`.

## Current state and drift check

The required drift check, `git diff --stat 78397dc..HEAD -- src/app/api
next.config.mjs`, produced no output.  Therefore, the public API surface has
not changed from the plan's baseline.

`find src/app/api -name route.ts` enumerated exactly these six handlers:

```text
src/app/api/index-products/route.ts
src/app/api/search-products/route.ts
src/app/api/setUserCountryInCookies/route.ts
src/app/api/webhooks/paypal/route.ts
src/app/api/webhooks/route.ts
src/app/api/webhooks/stripe/route.ts
```

`grep -rniE "ratelimit|upstash|throttle" src` returned no matches, confirming
there is no current implementation in source.  The package dependency check
found no Upstash or rate-limit package.  Its broad `rate` pattern did match the
unrelated `@prisma/extension-accelerate`; Prisma Accelerate over Neon provides
connection pooling and has its own limits, but it is not a request-level
rate-limiter.

The runtime is Next.js 16 App Router and the documented deployment model is
Vercel-style serverless.  Consequently, process-local state is not shared by
serverless instances.  Any design that relies only on memory is not a global
limit when the platform scales out.

## Options compared

### A. In-memory token bucket or small per-instance LRU

**What it is:** Keep counters or token buckets in the Route Handler process.

**Pros:**

- Smallest implementation and operational footprint; no new service or
  environment variables.
- Can shed repeated traffic reaching one warm instance with very low latency.

**Cons:**

- Counters reset on cold starts and are independent on every serverless
  instance.  It therefore does not enforce a reliable client-wide limit under
  scale-out.
- Requires bounded-memory/eviction and test coverage for cleanup.

**Serverless correctness:** unsuitable as the primary control for a
Vercel-style multi-instance deployment.  It is only a coarse, per-instance
safety net if a stronger platform or shared control also exists.

### B. Shared store: Upstash Redis with `@upstash/ratelimit`

**What it is:** Each handler checks a shared Redis-backed limiter using a
stable endpoint-class and client key.

**Pros:**

- A single bucket is observed across serverless instances, so it supplies the
  desired request-level control when the application scales out.
- The library supplies established algorithms and standard rate-limit metadata.

**Cons:**

- Adds a third-party dependency, credentials/configuration, cost, and one
  network operation on the request path.
- Requires an explicit policy for store failures (fail open, fail closed, or a
  constrained fallback), monitoring, and local/test configuration.

**Serverless correctness:** correct across instances provided all production
instances use the same reachable store and namespace.

### C. Edge or platform layer: Vercel WAF, platform middleware, or equivalent

**What it is:** Enforce a policy before the request reaches Route Handlers.

**Pros:**

- Can discard abusive traffic before application and database work.
- The platform is better positioned to identify the client IP and absorb
  volumetric traffic; application code stays smaller.

**Cons:**

- Availability, configurability, observability, and cost depend on the hosting
  plan and provider features.
- A broad edge policy may not express the different search and cookie-write
  budgets without a provider-specific configuration.

**Serverless correctness:** global enforcement is viable when the platform
offers it, because it runs outside individual application instances.  The
deployment's actual plan and feature set must be verified first.

### D. Do nothing in the current phase

**What it is:** Record the risk and defer a limiter until traffic, budget, or
hosting decisions justify it.

**Pros:**

- No new runtime dependency, configuration, or latency.
- Can be reasonable for low-traffic pre-launch work if compensating limits and
monitoring are accepted explicitly.

**Cons:**

- Leaves the public repeated-request risk open, including the amplification
  described in plan 023.
- Makes a later response more urgent and less designed.

**Serverless correctness:** no control is provided; this is an explicit risk
acceptance, not a technical solution.

## Strategy requirements, whichever option is chosen

### Keying and trusted client identity

Public endpoints need a client key, normally an IP-derived key.  The limiter
must **never** use the raw `x-forwarded-for` header string or its left-most
value: it is client-supplied and attackers can rotate it to create arbitrary
buckets.

Before an IP-keyed implementation is approved, the production deployment must
define this trust boundary in its runbook and implementation ADR:

1. Name the trusted proxy/platform that overwrites or appends forwarding
   information and the number of trusted hops (for example, exactly one
   platform proxy hop).
2. Derive the client address only from the platform-provided value or the
   right-most hop appended by that trusted infrastructure; reject any
   assumption that an unprocessed incoming header is trustworthy.
3. Verify the behavior in the deployed environment, including direct-origin
   access.  The application must not accept an arbitrary forwarding header
   when the origin can be reached without the trusted proxy.

If that contract cannot be established for the selected hosting arrangement,
do not use an application-level IP key.  Prefer an edge/WAF control that owns
client identification; for authenticated routes, a stable user/session key is
an alternative.  Authenticated endpoint limits are outside this spike's
surface and should not be added merely for consistency.

The shared limiter must minimize client-address data after the trusted address
has been derived:

- Normalize the address, then derive an opaque bucket identifier with a keyed
  HMAC and a rate-limit-specific secret.  Do not place a raw IP address in the
  Redis key, response, metric label, or application log.
- Give every counter an expiry equal to the algorithm's active window plus
  only the short grace period required for clock or retry handling.  Do not
  retain expired client buckets for analytics or debugging by default.
- Logs and metrics may record the endpoint class, decision, and aggregate
  counts, but not the raw address or the stable bucket identifier.  Any longer
  retention requires a separately approved privacy and incident-response use
  case with an explicit retention period.
- Document HMAC-secret rotation before rollout.  Rotation may intentionally
  reset buckets, but it must not require retaining a raw-IP lookup table.

### Endpoint classes and responses

The future policy must keep at least two classes rather than applying a single
database-load rationale everywhere:

- **Search class:** the two `index-products` methods and `search-products`.
  Establish a shared or separate budget only after normal query traffic and the
  plan-023 pagination bound are known.
- **Cookie-write class:** `setUserCountryInCookies`, with a limit aimed at
  write/CPU/cookie-bloat spam rather than database protection.

The follow-up design must decide whether the two `index-products` methods share
a bucket, since a client can otherwise switch methods.  It must publish the
chosen algorithm, window/burst, and quota per class, rather than inheriting
vendor defaults implicitly.

When a request is limited, return HTTP `429 Too Many Requests` with a
machine-readable error body and `Retry-After`.  Where the selected layer can
provide them reliably, standard rate-limit response headers should accompany
the response.  The implementation must also decide whether valid CORS and
cache headers are needed for these public routes.

### Enforcement location and resilience

An edge control should run before Route Handlers.  A shared-store application
control should be placed in a small reusable helper invoked at the very start
of each selected Route Handler, before parsing bodies or querying Prisma;
middleware should be used only if it can safely express the endpoint classes
and trusted identity contract.  Do not apply it to signature-verified webhook
handlers as part of this work.

For a shared store, outage behavior is a product/security decision:

- **Fail open** preserves search availability but temporarily removes this
  defense and must emit an observable error/metric.
- **Fail closed** protects downstream capacity but can make public search
  unavailable because of a limiter outage.
- A bounded local fallback has the limitations of Option A and must not be
  represented as a global guarantee.

## Scope decision needed

`.claude/steering/product.md` lists multi-currency, tax engine, advanced
analytics, and third-party shipping-carrier integration as out of scope for the
current phase.  Rate limiting is neither listed as approved work nor listed as
out of scope.  The maintainer must explicitly confirm whether an operational
rate-limit control belongs in the current phase before implementation starts.

## Ranked recommendation

1. **Use a platform/edge control (Option C) if the current hosting plan offers
   a configurable per-endpoint policy and a documented trusted client-identity
   boundary.** It protects the database before the application runs and avoids
   relying on application parsing of forwarded headers.
2. **Otherwise use a shared limiter (Option B) if the maintainer approves the
   external-store cost and operating model.** It is the strongest portable
   application-level option for serverless instances; define failure behavior,
   endpoint classes, and trusted key derivation before coding.
3. **Use Option A only as an additional local safety net, never as the stated
   production-wide guarantee.**
4. **Option D is acceptable only as a recorded, time-bounded risk acceptance**
   with a trigger for reconsideration (for example launch or observed traffic).

This choice meets the ADR threshold: it compares multiple alternatives,
affects the whole application, has lasting operational trade-offs, and will be
needed as future public endpoints are added.  Once the maintainer chooses an
option and scope, create an Accepted MADR record in
`docs/architecture/decisions/` from the repository template before or alongside
the implementation plan.  This spike is not itself that decision.

## Open questions for the maintainer

1. Is rate limiting in scope for the current phase, or should the risk be
   explicitly deferred?
2. Which option is approved: platform/edge control, shared Upstash-backed
   limiter, in-memory safety net only, or deferred risk acceptance?
3. If Option B is selected, is there budget and ownership for Upstash (or an
   equivalent shared store), and should store failure fail open or fail closed?
4. What hosting plan/provider feature is available, and what exact trusted
   proxy hop and client-IP contract can be documented and verified?
5. What search and cookie-write quotas/bursts are acceptable after considering
   expected traffic and plan 023's pagination bound?

No follow-up implementation plan has been created.  Plan 025 requires these
answers before an implementation option, limits, or dependencies can be
selected.

## Verification performed

- Confirmed no API-route drift from `78397dc` with the required diff command.
- Enumerated all six `src/app/api/**/route.ts` handlers.
- Confirmed `ratelimit`, `upstash`, and `throttle` have no source matches.
- Performed read-only analysis only; no application source, configuration, or
  dependency files were changed.
