# Plan 061: Add response-hardening headers (clickjacking / MIME / referrer / HSTS) across the app

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> ```bash
> git diff --stat d2aff76 -- next.config.mjs
> git status --porcelain -- next.config.mjs
> ```
> Use `d2aff76` (not `d2aff76..HEAD`) so working-tree/staged changes are also seen.
> If `next.config.mjs` already has an `async headers()` block, compare it against this plan's
> target and treat any conflict as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `d2aff76`, 2026-07-17

## Why this matters

The app sends **no response-hardening headers**. `next.config.mjs` defines only
`images.remotePatterns`, and `src/middleware.ts` sets no security headers on any path. The protected
route `/checkout` (`src/middleware.ts:9`) renders the Stripe payment UI
(`src/components/store/cards/payment/stripe/stripe-payment.tsx`) — a payment/PII surface with **no
`X-Frame-Options` / `frame-ancestors`**, so it has no clickjacking protection, and no
`Referrer-Policy` / `X-Content-Type-Options` / HSTS anywhere.

This plan adds the broadly-safe hardening headers globally via Next.js's `headers()` config. It
deliberately **does not** ship a full `Content-Security-Policy` — a real CSP for this app must
allowlist Clerk, Stripe, PayPal, and Cloudinary and be rolled out in Report-Only first, which is its
own investigation (see Maintenance notes). Shipping the frame/MIME/referrer/HSTS headers now closes
the highest-value, lowest-risk gap immediately.

## Current state

- **`next.config.mjs` (entire file today)**:

  ```js
  /** @type {import('next').NextConfig} */
  const nextConfig = {
      reactStrictMode: false,
      images: {
          remotePatterns: [
              { protocol: 'https', hostname: 'res.cloudinary.com' },
              { protocol: 'https', hostname: 'img.clerk.com' },
          ],
      },
  }

  export default nextConfig;
  ```

- `src/middleware.ts` — sets the `userCountry` cookie with `httpOnly/secure/sameSite/path` but adds
  **no** response headers. Do not move header logic here; the framework `headers()` config is the
  right layer (applies to all routes including static assets and API routes).

- There is no existing header test in the repo (nothing to update).

### Repo conventions / constraints

- **`reactStrictMode: false` is intentional** (`.claude/steering/structure.md` 既知の制約) — do NOT
  change it while editing this file.
- `next.config.mjs` is ESM (`export default`). Keep it JS (not TS); it is not typechecked by `tsc`.
- The `middleware`→`proxy` deprecation is a documented non-action — do not rename `src/middleware.ts`.
- CI runs `next build` with a stub `DATABASE_URL` (`.claude/steering/tech.md`) — a `headers()` block
  does not touch the DB and is safe for that build.

## Commands you will need

| Purpose        | Command                                             | Expected on success                     |
|----------------|-----------------------------------------------------|-----------------------------------------|
| Lint           | `bun run lint`                                       | exit 0 (warnings ok)                    |
| Config parses  | `node --input-type=module -e "import('./next.config.mjs').then(m=>console.log(typeof m.default.headers))"` | prints `function`     |
| Dev smoke      | `bun run dev` then the curl below                    | headers present on `/` and `/checkout`  |

> **Build note**: `bun run build` may already fail on pre-existing SSR issues unrelated to this
> change — **OI-9** (home `/` — `window` in `featured.tsx`) and **OI-11** (`/dashboard/seller` —
> `self is not defined` via `CldUploadWidget`), both tracked in `docs/testing/QA_HANDOFF.md`. A
> build failure with **either** of those signatures is NOT caused by this plan. Only a new,
> different failure is a STOP condition.

## Scope

**In scope** (the only file you should modify):
- `next.config.mjs` — add an `async headers()` block

**Out of scope** (do NOT touch):
- `src/middleware.ts` — no header logic here.
- `reactStrictMode` and `images` config — leave unchanged.
- A full `Content-Security-Policy` header — deliberately deferred (needs Clerk/Stripe/PayPal/
  Cloudinary allowlisting + Report-Only rollout). Do not add a `Content-Security-Policy` (enforcing)
  header in this plan; if you believe one is required, STOP and report.
- Any source file under `src/`.

## Git workflow

- Branch: `advisor/061-security-headers`
- Commit style: `feat(security): add response-hardening headers`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Add the `headers()` block to `next.config.mjs`

Insert an `async headers()` method into `nextConfig`, alongside the existing `images` key (do not
remove `reactStrictMode` or `images`):

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: false,
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'res.cloudinary.com' },
            { protocol: 'https', hostname: 'img.clerk.com' },
        ],
    },
    async headers() {
        const securityHeaders = [
            // クリックジャッキング防御（/checkout の決済面が第三者に frame されるのを防ぐ）
            { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
            // MIME スニッフィング防御
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            // リファラ漏洩の最小化
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            // 未使用のブラウザ機能を無効化
            {
                key: 'Permissions-Policy',
                value: 'camera=(), microphone=(), geolocation=()',
            },
            // HTTPS 強制（本番のみ意味を持つ。max-age は 2 年）
            {
                key: 'Strict-Transport-Security',
                value: 'max-age=63072000; includeSubDomains; preload',
            },
        ];
        return [
            {
                // すべてのルート（ページ・API・静的アセット）に適用
                source: '/:path*',
                headers: securityHeaders,
            },
        ];
    },
}

export default nextConfig;
```

**Verify**:
- `node --input-type=module -e "import('./next.config.mjs').then(m=>console.log(typeof m.default.headers))"`
  → prints `function`
- `bun run lint` → exit 0

### Step 2: Smoke-check the headers on a running server (report-only if sandbox can't run dev)

Start the dev server (`bun run dev`) and confirm the headers are present:

```bash
curl -sS -D - -o /dev/null http://localhost:3000/ | grep -iE 'x-frame-options|x-content-type-options|referrer-policy|permissions-policy|strict-transport-security'
curl -sS -D - -o /dev/null http://localhost:3000/checkout | grep -iE 'x-frame-options'
```

Expect `X-Frame-Options: SAMEORIGIN` (and the others) on both. `/checkout` will redirect to sign-in
when unauthenticated — that's fine; the header should still be present on the response. If you
cannot run the dev server in your environment, record in your report that this smoke check is
**pending** rather than skipping it silently.

> HSTS only takes effect over HTTPS in production; on local `http://localhost` the header is sent
> but browsers ignore it. That is expected — do not try to "fix" it locally.

## Test plan

- No unit test framework exists for Next.js response headers in this repo; verification is the
  config-parses check (Step 1) plus the curl smoke (Step 2).
- If you want a regression guard, an optional Playwright check under `tests/e2e/` asserting
  `response.headers()['x-frame-options'] === 'SAMEORIGIN'` on `/` is acceptable **but out of the
  minimal scope** — if you add one, note it in your report; do not let it expand the diff into test
  infra changes.

## Done criteria

ALL must hold:

- [ ] `next.config.mjs` has an `async headers()` returning the five headers above for `source: '/:path*'`
- [ ] `reactStrictMode: false` and the `images.remotePatterns` block are unchanged
- [ ] `node --input-type=module -e "import('./next.config.mjs').then(m=>console.log(typeof m.default.headers))"` prints `function`
- [ ] `bun run lint` exits 0
- [ ] Curl smoke shows `X-Frame-Options: SAMEORIGIN` on `/` and `/checkout` (or the check is
      explicitly flagged pending in the report)
- [ ] No `Content-Security-Policy` (enforcing) header was added
- [ ] No files other than `next.config.mjs` are modified (`git status`)
- [ ] `plans/README.md` status row for 061 updated

## STOP conditions

Stop and report (do not improvise) if:

- `next.config.mjs` already contains a `headers()` block (drift) — report its contents.
- Adding the headers breaks the dev server startup or produces a new `bun run build` failure whose
  signature is **not** OI-9 or OI-11.
- Any header visibly breaks a flow in the smoke check (e.g. `/checkout` fails to render the Stripe
  widget specifically because of a header) — report which header; do not weaken it silently.
- You conclude a full CSP is needed to satisfy the finding — that is deliberately out of scope;
  report rather than adding one.

## Maintenance notes

- **Deferred follow-up — Content-Security-Policy.** A real CSP for this app must allowlist: Clerk
  (`*.clerk.accounts.dev` / `img.clerk.com` / its scripts), Stripe (`js.stripe.com`, its frames),
  PayPal (`*.paypal.com`), Cloudinary (`res.cloudinary.com`), and account for the inline `<style>`
  in `src/components/ui/chart.tsx` and Next.js's inline bootstrap. Roll it out as
  `Content-Security-Policy-Report-Only` first, watch for violations, then enforce. Track this as the
  CSP portion of SECURITY-06.
- `X-Frame-Options: SAMEORIGIN` controls whether **our** pages can be framed by others; it does not
  affect our ability to embed Stripe/PayPal iframes (those are us framing them) — so it is safe for
  the payment flow. If a future feature must be embedded by a partner site, revisit this.
- Reviewer should confirm the header block applies to all routes (`/:path*`) and that no enforcing
  CSP slipped in.
