# Plan 011: Fix onboarding — retire the stale screens doc, complete the README env list, add `.env.example`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise.
> When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f9752c0..HEAD -- README.md docs/unimplemented-screens-plan.md .env.docker.example .gitignore`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts to live code; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `f9752c0`, 2026-07-03

## Why this matters

Three onboarding/documentation defects, all doc-only (no code risk):

1. **Actively-wrong doc**: `docs/unimplemented-screens-plan.md` lists ~19 routes as unimplemented, but **every one now exists** (admin orders/coupons, seller inventory, dashboard tops, profile settings/messages, track-order, support-forms, offers, compare, and the static pages). It's cited as a roadmap/direction source, so a reader would schedule already-shipped work. Its embedded Gantt dates are in the past.
2. **Incomplete README env list**: the README setup block documents 9 env vars but omits several the code actually reads — a new dev following the README gets a partially-booting app (broken Cloudinary uploads, unverifiable Stripe webhooks) with no signal.
3. **Missing `.env.example`**: `.gitignore` whitelists `!.env.example`, signaling one is expected, but only `.env.docker.example` (container-oriented) and `.env.test.example` exist — a bare-metal `bun run dev` contributor has no template to copy.

## Current state

### Stale doc

`docs/unimplemented-screens-plan.md` opens by claiming screens have "ディレクトリ未作成 / プレースホルダー" and tables routes like `/dashboard/admin`, `/dashboard/admin/orders`, `/dashboard/admin/coupons`. All of these now have real `page.tsx` files under `src/app/` (verified during the audit). No entry remains valid.

### README env block, `README.md:486-495`

```env
DATABASE_URL=                    # Prisma Accelerate 接続 URL
DIRECT_URL=                      # マイグレーション用の直接 PostgreSQL URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
WEBHOOK_SECRET=                  # Clerk Webhook 署名
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=
PAYPAL_SECRET=
NEXT_PUBLIC_PAYPAL_CLIENT_ID=
```

Env var **names** actually referenced in `src/` (from `grep -rho 'process\.env\.[A-Z_][A-Z0-9_]*' src/ | sort -u`), minus the abandoned Elasticsearch path:

```
IPINFO_TOKEN
NEXT_PUBLIC_PAYPAL_CLIENT_ID
NEXT_PUBLIC_STRIPE_PUBLIC_KEY
PAYPAL_API_BASE
PAYPAL_SECRET
PAYPAL_WEBHOOK_ID
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
WEBHOOK_SECRET
```

Plus vars used via library config rather than direct `process.env` (present in `.env.docker.example`): the Clerk publishable/secret keys, the Clerk sign-in/up URL vars, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_PRESET_NAME`, and `NEXT_PUBLIC_APP_URL`. **Use `.env.docker.example` as the authoritative superset of required variable names** (strip the Docker-specific hostnames).

Missing from the README that the code needs: **`STRIPE_WEBHOOK_SECRET`**, **`PAYPAL_API_BASE`**, **`PAYPAL_WEBHOOK_ID`**, **`IPINFO_TOKEN`**, **`NEXT_PUBLIC_APP_URL`**, and the **`NEXT_PUBLIC_CLOUDINARY_*`** pair (README even lists Cloudinary as a prerequisite but omits its vars).

### `.env.example`

Absent. `.gitignore:37` whitelists it (`!.env.example`). `.env.docker.example` (2718 B) and `.env.test.example` (2018 B) exist.

### Convention (documentation-guide)

- Stale docs should be deleted or archived (`.claude/steering/documentation-guide.md` — "古い情報の放置" is called out as an anti-pattern). Genuinely-open work goes into `specs/.../08-open-questions.md`, not a stale plan doc.
- **Secrets rule (Hard)**: reference variable **names** only. Never copy real values from any `.env*` file into the README or `.env.example`. Placeholders/empty values only.

## Commands you will need

| Purpose        | Command                                        | Expected            |
|----------------|------------------------------------------------|---------------------|
| Env name diff  | `grep -rho 'process\.env\.[A-Z_][A-Z0-9_]*' src/ \| sort -u` | list of names |
| Verify example | `git check-ignore .env.example`                | prints nothing (whitelisted, will be tracked) |

(No build/test gate — this plan changes only docs and a template file.)

## Scope

**In scope**:
- `docs/unimplemented-screens-plan.md` — delete or archive
- `README.md` — complete the env var block
- `.env.example` (create) — template with names + empty/placeholder values

**Out of scope**:
- Any source file, any `.env*` file that already exists (do not edit `.env.docker.example` / `.env.test.example`).
- The Elasticsearch env vars (`ELASTICSEARCH_*`) — abandoned path; do not add them to onboarding docs.
- `specs/` content, unless you choose to move a genuinely-open item there (only if one exists; the audit found none outstanding).

## Git workflow

- Branch: `advisor/011-onboarding-docs`
- Commit style: e.g. `docs: retire stale screens plan; complete env docs; add .env.example`
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Retire the stale screens doc

Preferred: archive rather than hard-delete, so history/context is visible. Create `docs/archive/` if absent and move the file, prepending a header:

```markdown
> **SUPERSEDED (2026-07): すべての画面は実装済み。** この計画書に列挙された未実装画面
> （admin orders/coupons、seller inventory、dashboard トップ、profile settings/messages、
> track-order、support-forms、offers、compare、静的ページ群）は 2026-06 までに実装された。
> 未解決の作業がある場合は specs/multi-vendor-ecommerce/08-open-questions.md を参照。
```

Then `git mv docs/unimplemented-screens-plan.md docs/archive/unimplemented-screens-plan.md` (or `git rm` it if the team prefers deletion — archiving is the safer default).

After moving, update any doc that links to the old path:
`grep -rn "unimplemented-screens-plan" docs/ README.md .claude/ specs/` — fix or remove each reference (e.g. recon/roadmap docs that cite it as a direction source).

**Verify**: `grep -rn "unimplemented-screens-plan" --include=*.md . | grep -v docs/archive` → no live references outside the archive (or all remaining references point to the new archive path).

### Step 2: Complete the README env block

Replace the `README.md:486-495` env block with the full set (names + empty values, grouped). Use `.env.docker.example` as the superset, stripping container hostnames. Target shape:

```env
# --- Database (Prisma + Accelerate) ---
DATABASE_URL=
DIRECT_URL=

# --- Clerk (auth) ---
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
WEBHOOK_SECRET=                     # Clerk Webhook 署名 (Svix)
# 必要に応じて: NEXT_PUBLIC_CLERK_SIGN_IN_URL / NEXT_PUBLIC_CLERK_SIGN_UP_URL

# --- Stripe ---
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=
STRIPE_WEBHOOK_SECRET=              # Stripe Webhook 署名検証

# --- PayPal ---
PAYPAL_SECRET=
NEXT_PUBLIC_PAYPAL_CLIENT_ID=
PAYPAL_API_BASE=                    # 例: https://api-m.sandbox.paypal.com
PAYPAL_WEBHOOK_ID=

# --- Cloudinary (画像) ---
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
NEXT_PUBLIC_CLOUDINARY_PRESET_NAME=

# --- その他 ---
IPINFO_TOKEN=                       # 地域判定 (userCountry)
NEXT_PUBLIC_APP_URL=                # 例: http://localhost:3000
```

Cross-check against the live env-name grep + `.env.docker.example` so nothing required is missing and nothing abandoned (Elasticsearch) is added. Names/placeholders only — no real values.

**Verify**: every name from `grep -rho 'process\.env\.[A-Z_][A-Z0-9_]*' src/ | sort -u` (except `ELASTICSEARCH_*`, `NODE_ENV`, `E2E_BASE_URL`) appears in the README block.

### Step 3: Add `.env.example`

Create `.env.example` at the repo root with the same variable names as step 2 and **empty or clearly-placeholder** values (e.g. `PAYPAL_API_BASE=https://api-m.sandbox.paypal.com` as a non-secret default; all secrets left empty). Derive names from `.env.docker.example` but replace any Docker container hostnames with localhost equivalents and blank every credential.

**Verify**: `git check-ignore .env.example` prints nothing (it is whitelisted and will be tracked); open the file and confirm no real secret values are present (every key is empty or a non-secret placeholder).

### Step 4: Reference `.env.example` from the README setup section

Add one line in the README setup steps pointing bare-metal users at it, e.g. `cp .env.example .env.local` (match the repo's env-file convention — `.gitignore` ignores `.env*.local`, so `.env.local` is the local override target).

**Verify**: `grep -n ".env.example" README.md` → shows the reference.

## Test plan

- No automated tests (docs + template only). Verification is the grep checks in each step plus a manual read confirming no secret values leaked into the README or `.env.example`.

## Done criteria

ALL must hold:

- [ ] `docs/unimplemented-screens-plan.md` is archived (moved to `docs/archive/` with the SUPERSEDED header) or deleted, and no live doc links to the old path
- [ ] README env block lists all source-referenced vars incl. `STRIPE_WEBHOOK_SECRET`, `PAYPAL_API_BASE`, `PAYPAL_WEBHOOK_ID`, `IPINFO_TOKEN`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CLOUDINARY_*`
- [ ] `.env.example` exists at repo root, is git-trackable (`git check-ignore` prints nothing), and contains **no real secret values**
- [ ] README references `.env.example` in the setup steps
- [ ] No source files or existing `.env*.example` files modified (`git status`)
- [ ] `plans/README.md` status row for 011 updated

## STOP conditions

Stop and report if:

- Any "Current state" excerpt doesn't match live files (drift) — e.g. the README env block or `.env.docker.example` has already been updated.
- You find a route in `docs/unimplemented-screens-plan.md` that is genuinely still unimplemented (contradicts the audit) — do NOT delete the doc; report which route so it can be moved to `08-open-questions.md` instead.
- `git check-ignore .env.example` shows it would be ignored (the whitelist isn't working) — report; do not force-add.
- Any existing `.env*` file contains real credentials you'd be tempted to copy — never copy values; use empty placeholders and note it.

## Maintenance notes

- Keep the README env block and `.env.example` in sync with `.env.docker.example`; ideally a future CI check greps `process.env.*` names against the template to prevent re-drift (a possible follow-up DX task).
- Reviewer should scan the README diff and `.env.example` for any accidentally-pasted secret value (names/placeholders only).
- If Elasticsearch is ever revived (currently commented out), add its vars then — not now.
