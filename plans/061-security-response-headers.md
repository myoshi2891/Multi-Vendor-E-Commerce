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

**In scope**:
- `next.config.mjs` — add an `async headers()` block
- `tests/e2e/security-headers.spec.ts` — exact-value regression guard (approved scope extension;
  see Test plan)
- `.env.docker.example` — document the `HSTS_ENABLED` / `HSTS_INCLUDE_SUBDOMAINS` / `HSTS_PRELOAD`
  opt-in variables (approved scope extension added by the 2026-07-26 corrections; an env var that
  gates a hard-to-revoke action must be discoverable — see those corrections below)

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
        ];
        // HSTS は **本番ドメインでのみ**付与する。localhost だけはブラウザが無視するが、
        // HTTPS で配信される preview/staging ドメイン（*.vercel.app 等）では実際に記録される。
        //
        // 判定軸は環境名ではなく**配信先**。NODE_ENV=production は「本番ドメインで配信中」を
        // 意味しない（self-host の staging も production ビルドで動く）ため、実際の配信先を
        // 示す明示シグナルを要求する。
        const isProduction = process.env.NODE_ENV === 'production';
        const isVercelPreview = process.env.VERCEL_ENV === 'preview';
        const isVercelProduction = process.env.VERCEL_ENV === 'production';

        const isEnabled = (name) => process.env[name]?.trim() === '1';

        // Vercel は VERCEL_ENV で本番を自己申告する。self-host はドメイン所有者が
        // HSTS_ENABLED=1 を立てる。どちらも無ければ付与しない（fail safe）。
        const isProductionDomain = isVercelProduction || isEnabled('HSTS_ENABLED');

        // 拡張ディレクティブはさらに個別 opt-in。preload はブラウザ要件として
        // includeSubDomains を伴う必要がある。
        const withPreload = isEnabled('HSTS_PRELOAD');
        const withSubDomains = withPreload || isEnabled('HSTS_INCLUDE_SUBDOMAINS');

        // !isVercelPreview は独立した拒否条件（プロジェクト全体に HSTS_ENABLED=1 を
        // 設定すると preview デプロイにも env が渡るため）。
        if (isProduction && !isVercelPreview && isProductionDomain) {
            const directives = ['max-age=63072000']; // 2 年
            if (withSubDomains) directives.push('includeSubDomains');
            if (withPreload) directives.push('preload');

            securityHeaders.push({
                key: 'Strict-Transport-Security',
                value: directives.join('; '),
            });
        }
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

> **訂正（2026-07-26 / CodeRabbit 指摘）— `includeSubDomains; preload` を環境名だけで
> 有効化しないこと。** 当初の実装は `NODE_ENV=production && VERCEL_ENV!=='preview'` の
> 条件だけで拡張ディレクティブまで付与していたが、**`NODE_ENV=production` は「本番ドメインで
> 配信されている」ことを意味しない**。self-host の staging・社内環境・レビュー環境も
> production ビルドで動くため、Vercel preview 以外の非本番 HTTPS ドメインで
> **全サブドメインの HTTPS 強制と preload リスト登録**（取り消しに数週間〜数ヶ月かかる
> 非可逆操作）が誤発火する。
>
> 対策として拡張ディレクティブを環境変数の**明示 opt-in** に切り出した
> （`HSTS_INCLUDE_SUBDOMAINS=1` / `HSTS_PRELOAD=1`。`HSTS_PRELOAD` はブラウザ要件から
> `includeSubDomains` を自動で伴う）。値は `.claude/steering/tech.md` の環境変数方針に従い
> `trim()` 後に比較する（`"true"` 等の想定外値は**無効側**に倒れる = fail safe）。
> 変数は `.env.docker.example` に記載済み。
>
> ---
>
> **訂正その 2（2026-07-26 / CodeRabbit 指摘）— base の `max-age` も環境名だけでは付与しない。**
> 上の訂正 1 は拡張ディレクティブのみを opt-in にし、base の `max-age=63072000` は
> `NODE_ENV=production && VERCEL_ENV!=='preview'` のままにしていた。これは**同じ根拠の
> 適用漏れ**である —— 「`NODE_ENV=production` は本番ドメインで配信中を意味しない」が
> 真なら、self-host の staging・社内環境にも 2 年の `max-age` が付く。
>
> base の `max-age` も取り消しは容易ではない: そのホストから `max-age=0` を**残存 TTL の間
> ずっと**配信する必要があり、しかも**再訪したブラウザにしか**届かない。preload ほどではない
> にせよ「環境名の誤りで踏んでよい」性質の設定ではない。
>
> そこで判定軸を「環境名」から「**配信先**」へ移した。HSTS は次の 3 条件がすべて揃ったときだけ
> 付与する: (1) `NODE_ENV=production`、(2) `VERCEL_ENV!=='preview'`、(3) 配信先が本番である
> 明示シグナル（`VERCEL_ENV==='production'` **または** `HSTS_ENABLED=1`）。Vercel の本番デプロイは
> (3) を自動で満たし、self-host はドメイン所有者が `HSTS_ENABLED=1` を立てる。
> (2) は (3) と重複しない拒否条件として残す —— Vercel でプロジェクト全体に `HSTS_ENABLED=1` を
> 設定すると preview デプロイにも env が渡るため。
>
> 実測（`next.config.mjs` を env 別に読み込み、9 ケース）:
>
> | 環境 | 出力 |
> |---|---|
> | dev（シグナルなし） | （付与なし） |
> | production ビルド・**シグナルなし** | （付与なし）← 訂正 2 の要点 |
> | `HSTS_ENABLED=1` | `max-age=63072000` |
> | `VERCEL_ENV=production` | `max-age=63072000` |
> | `VERCEL_ENV=preview` + `HSTS_ENABLED=1` | （付与なし）← preview 拒否が優先 |
> | `HSTS_ENABLED=1` + `HSTS_INCLUDE_SUBDOMAINS=1` | `max-age=63072000; includeSubDomains` |
> | `HSTS_ENABLED=1` + `HSTS_PRELOAD=1` | `max-age=63072000; includeSubDomains; preload` |
> | `HSTS_ENABLED="true"` | （付与なし・fail safe） |
> | `HSTS_INCLUDE_SUBDOMAINS=1` のみ | （付与なし）← 拡張だけでは HSTS を有効化できない |

**Verify**:
- `node --input-type=module -e "import('./next.config.mjs').then(m=>console.log(typeof m.default.headers))"`
  → prints `function`
- `bun run lint` → exit 0

### Step 2: Smoke-check the headers on a running server (report-only if sandbox can't run dev)

Start the dev server (`bun run dev`) and confirm the headers are present **with the exact expected
values**. A name-only `grep` is not sufficient: it matches `X-Frame-Options: ALLOWALL` just as
happily as `SAMEORIGIN`, so a weakened value would pass silently. The check below extracts the
headers, normalizes only the **name** casing (HTTP header names are case-insensitive; values are
not — `SAMEORIGIN` must keep its casing), and compares the whole set against the expected set.

**HSTS is environment-gated, so the expected count differs by environment** (see the blockquote
below): `bun run dev` runs with `NODE_ENV !== 'production'`, so it emits **4 headers (no HSTS)** —
demanding 5/5 against the dev server would always fail. Pass `expect_hsts=1` only when checking a
production-equivalent server (`next start` with `NODE_ENV=production` and not a Vercel preview),
where **5 headers** are expected.

```bash
# usage: check_security_headers <url> <expect_hsts:0|1>
check_security_headers() {
  local url="$1" expect_hsts="${2:-0}" got want
  got=$(curl -sS -D - -o /dev/null "$url" | tr -d '\r' \
    | awk 'index($0, ": ") > 0 {
        name = tolower(substr($0, 1, index($0, ": ") - 1));
        value = substr($0, index($0, ": ") + 2);
        if (name ~ /^(x-frame-options|x-content-type-options|referrer-policy|permissions-policy|strict-transport-security)$/)
          print name ": " value;
      }' | sort)
  local base hsts n
  base=$(printf '%s\n' \
    'permissions-policy: camera=(), microphone=(), geolocation=()' \
    'referrer-policy: strict-origin-when-cross-origin' \
    'x-content-type-options: nosniff' \
    'x-frame-options: SAMEORIGIN')
  if [ "$expect_hsts" = 1 ]; then
    # 拡張ディレクティブは opt-in なので、期待値も同じ規則で組み立てる
    # （HSTS_PRELOAD=1 は includeSubDomains を自動で伴う）
    hsts='strict-transport-security: max-age=63072000'
    if [ "$(printf '%s' "${HSTS_PRELOAD:-}" | tr -d '[:space:]')" = 1 ]; then
      hsts="$hsts; includeSubDomains; preload"
    elif [ "$(printf '%s' "${HSTS_INCLUDE_SUBDOMAINS:-}" | tr -d '[:space:]')" = 1 ]; then
      hsts="$hsts; includeSubDomains"
    fi
    want=$(printf '%s\n%s\n' "$base" "$hsts" | sort); n=5
  else
    want=$(printf '%s\n' "$base" | sort); n=4
  fi
  if [ "$got" = "$want" ]; then
    echo "OK   $url ($n/$n headers match exactly)"
  else
    echo "FAIL $url"; diff <(echo "$want") <(echo "$got"); return 1
  fi
}

# dev server (bun run dev): HSTS is gated OFF -> expect 4 headers
check_security_headers http://localhost:3000/          0
check_security_headers http://localhost:3000/checkout  0
# A bare `next start` also expects 4: NODE_ENV=production alone no longer emits HSTS.
# To reach 5 the production-domain signal must be present **at build time**
# (VERCEL_ENV=production, or HSTS_ENABLED=1 for self-host) — see the correction below:
# HSTS_ENABLED=1 bun run build  &&  bun run start
# check_security_headers http://localhost:3000/        1
# check_security_headers https://<prod-host>/          1
```

Each must print `OK ... (N/N headers match exactly)` for the appropriate N (4 on dev, 5 on
production-equivalent). A missing header, an extra-but-wrong value, or
a typo all surface as a `diff` showing exactly which line differs. `/checkout` will redirect to
sign-in when unauthenticated — that's fine; the headers should still be present on that redirect
response (do **not** add `-L`, so the redirect's own headers are what gets checked). If you cannot
run the dev server in your environment, record in your report that this smoke check is **pending**
rather than skipping it silently.

> HSTS is emitted **only when `NODE_ENV === 'production'`, `VERCEL_ENV !== 'preview'`, and the
> deployment target is named explicitly** (`VERCEL_ENV === 'production'` or `HSTS_ENABLED=1`) — see
> the config above. On local `http://localhost` browsers ignore the header anyway, but a
> preview/staging deployment served over **HTTPS** would honor it. Do not remove the gate to "make
> the header show up locally"; set `HSTS_ENABLED=1` on the **build** you actually want to check.
>
> **Correction (2026-07-27): these env vars are read at BUILD time, not at runtime.**
> An earlier revision of the smoke check above ran `HSTS_ENABLED=1 bun run start`, which
> **cannot work**. Next.js evaluates `headers()` once during `next build` and serialises the
> result into `.next/routes-manifest.json`; `next start` only replays that manifest, so the
> serving process never re-reads `HSTS_ENABLED`. Verify with:
>
> ```bash
> node -p "JSON.stringify(require('./.next/routes-manifest.json').headers)"
> ```
>
> The same applies to deployment: `docker run -e HSTS_ENABLED=1` has no effect, and a self-host
> pipeline must pass the flag to the build step (`HSTS_ENABLED=1 bun run build`). Vercel is
> unaffected because it injects `VERCEL_ENV` into the build environment as well.
> `next dev` re-reads the config on each start, but `isProduction` is false there so HSTS is
> gated off regardless — dev can never be used to observe the header.
>
> **`NODE_ENV=production` is not a domain signal.** It only tells you a production *build* is
> running, not that it is served on the production *domain* — a self-hosted staging host outside
> Vercel passes that check. This is why the base `max-age` needs the explicit signal (correction 2)
> and `includeSubDomains; preload` need their own further opt-in (correction 1): the base directive
> is revoked only by serving `max-age=0` for the remaining TTL to returning browsers, and preload
> registration takes weeks-to-months to undo.
>
> **Resolved (was OPEN).** The shipped `next.config.mjs` previously pushed HSTS *unconditionally*
> (all environments / all subdomains). It is now gated on the three conditions above, and
> `tests/e2e/security-headers.spec.ts` mirrors the same env signals (`E2E_USE_DEV` / `VERCEL_ENV` /
> `HSTS_ENABLED`) so it asserts HSTS **absent** in dev, in preview, and under a bare `next start`,
> and **present** only when the signal is set — catching both a regression back to unconditional
> HSTS and an accidental production drop.

## Test plan

- No unit test framework exists for Next.js response headers in this repo; verification is the
  config-parses check (Step 1) plus the exact-value curl smoke (Step 2).
- **Regression guard (added, approved scope extension)**: `tests/e2e/security-headers.spec.ts`
  asserts all five headers' exact values on `/` and `/checkout`. It uses the `request`
  (APIRequestContext) fixture rather than `page` — no DOM rendering is needed — with
  `maxRedirects: 0` so the `/checkout` redirect response's own headers are what gets asserted.
  Playwright lowercases header names in `response.headers()`, so the expectation map is keyed in
  lowercase. The spec is Clerk-independent and therefore runs in all environments. No test-infra
  changes were required.

## Done criteria

ALL must hold:

- [x] `next.config.mjs` has an `async headers()` returning the five headers above for `source: '/:path*'`
- [x] `reactStrictMode: false` and the `images.remotePatterns` block are unchanged
- [x] `node --input-type=module -e "import('./next.config.mjs').then(m=>console.log(typeof m.default.headers))"` prints `function`
- [x] `bun run lint` exits 0
- [x] **`check_security_headers` reports `N/N headers match exactly` for BOTH `/` and `/checkout`**
      with the environment-correct N — **4/4 on the dev server (`bun run dev`, HSTS gated OFF)**,
      **4/4 on a bare `next start`** (production build without the domain signal), and **5/5 with
      the production-domain signal set** (`VERCEL_ENV=production`, or `HSTS_ENABLED=1` for
      self-host) — i.e. every applicable name **and value** pair is asserted, not merely the presence
      of a header name (or the check is explicitly flagged pending in the report):
  - [x] `x-frame-options: SAMEORIGIN`
  - [x] `x-content-type-options: nosniff`
  - [x] `referrer-policy: strict-origin-when-cross-origin`
  - [x] `permissions-policy: camera=(), microphone=(), geolocation=()`
  - [x] `strict-transport-security: max-age=63072000` **(only with the production-domain signal)**.
        `; includeSubDomains` / `; preload` are appended **only** when `HSTS_INCLUDE_SUBDOMAINS=1` /
        `HSTS_PRELOAD=1` is additionally set — see the two 2026-07-26 corrections above.
- [x] **`tests/e2e/security-headers.spec.ts` asserts those same five exact values on `/` and
      `/checkout` and passes** (regression guard, so the values cannot be weakened later without a
      failing test)
- [x] No `Content-Security-Policy` (enforcing) header was added
- [x] Only `next.config.mjs`, `tests/e2e/security-headers.spec.ts` and `.env.docker.example` are
      modified (`git status`). Two approved extensions over the original "next.config.mjs only"
      constraint: the E2E spec (regression guard), and `.env.docker.example` — the `HSTS_ENABLED` /
      `HSTS_INCLUDE_SUBDOMAINS` / `HSTS_PRELOAD` opt-in variables introduced by the 2026-07-26
      corrections must be discoverable, since an env var that gates a hard-to-revoke action
      (a 2-year `max-age`, or preload-list registration) is useless if operators cannot find it
      (`66ed444f`, and the correction-2 commit)
- [x] `plans/README.md` status row for 061 updated

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
