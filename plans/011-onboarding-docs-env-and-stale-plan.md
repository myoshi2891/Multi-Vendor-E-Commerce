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

Plus vars used via library config rather than direct `process.env` (present in `.env.docker.example`): the Clerk publishable/secret keys, the Clerk sign-in/up URL vars, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_CLOUDINARY_PRESET_NAME`, and `NEXT_PUBLIC_APP_URL`. **Use `.env.docker.example` as the authoritative superset of variable names** (strip the Docker-specific hostnames).

> **Clerk URL vars — one treatment, applied everywhere.** `NEXT_PUBLIC_CLERK_SIGN_IN_URL`,
> `NEXT_PUBLIC_CLERK_SIGN_UP_URL` and `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`
> (`.env.docker.example:26-28`) are **optional**: nothing in `src/` reads them
> (`grep -rn 'CLERK_SIGN_IN_URL\|CLERK_SIGN_UP_URL\|AFTER_SIGN_IN' src/` → 0 hits) — Clerk consumes
> them as library config and falls back to its own defaults when they are absent. They are worth
> shipping in `.env.example` anyway because this repo serves **custom** auth pages at
> `src/app/(auth)/sign-in` and `sign-up`, so the values are not arbitrary.
>
> Treat them as **optional-with-defaults in all three places** in this plan: the superset above,
> the "missing from the README" list below (they are *not* listed there — that list is for vars the
> code requires), and the `.env.example` template in Step 2 (present, with the repo's real values,
> and marked optional). Do **not** call the superset "required" and then comment them out as
> 「必要に応じて」 — that is the inconsistency this note exists to close. `AFTER_SIGN_IN_URL` must
> appear alongside the other two; omitting it while listing its siblings is the same defect.

Missing from the README that the code **requires**: **`STRIPE_WEBHOOK_SECRET`**, **`PAYPAL_API_BASE`**, **`PAYPAL_WEBHOOK_ID`**, **`IPINFO_TOKEN`**, **`NEXT_PUBLIC_APP_URL`**, and the **`NEXT_PUBLIC_CLOUDINARY_*`** pair (README even lists Cloudinary as a prerequisite but omits its vars). The Clerk URL vars are deliberately absent from this list per the note above.

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
`grep -rn "unimplemented-screens-plan" . --include="*.md" | grep -v node_modules` — fix or remove each reference (e.g. recon/roadmap docs that cite it as a direction source).

**References are written in two path forms. Update both** (measured at audit time):

| Form | Example | After the move |
|---|---|---|
| Repo-root relative | `docs/unimplemented-screens-plan.md` | `docs/archive/unimplemented-screens-plan.md` |
| Relative link | `../../unimplemented-screens-plan.md` | `../../archive/unimplemented-screens-plan.md` |

The relative-link form appears in **9 files** under `docs/design/*/README.md` (`offers`,
`admin-dashboard`, `profile-settings`, `track-order`, `storefront-static-pages`, `compare`,
`profile-messages`, `support-forms`, `seller-dashboard`). A grep rooted at `docs/` misses them.

> **Search the whole repo, not a hand-picked subset.** An earlier revision of this step scanned only
> `docs/ README.md .claude/ specs/`, which is **narrower than the Verify command below** — so a
> reference outside those four paths survives the fix and then fails the gate. That is not
> hypothetical: `plans/` alone holds ~15 references (`plans/ADVISOR_STATE.md`,
> `plans/audit/recon.md`, `plans/audit/findings-07-dx-docs.md`, `plans/audit/VETTED_FINDINGS.md`,
> and this plan's own EN/ja copies), and `docs/design/*/README.md` holds ~11 more. Keep the fix
> scope and the verify scope identical.
>
> References inside `plans/audit/findings-*` and this plan itself are **expected to remain** — they
> cite the file as the audit's own evidence. Point them at the new archive path rather than deleting
> them; the Verify command below accepts that (it only requires no live references to the *old* path).

**Verify**:

```bash
# Exclude this plan itself (it quotes the old token as a "moved from … to archive/…" example)
# and plans/audit/* (the audit trail). Per the note above these are references that are
# *expected to remain*; scanning them makes the illustrative old-path tokens in their prose
# match forever, so the gate fails structurally (a false positive).
#
# Keep `-n` (NOT `-h`): filenames must survive extraction so the exclusions can be applied
# **per path**. `--exclude=` matches the *basename* only, so `--exclude="011-…​.md"` would also
# drop `plans/ja/011-…​.md` — silently hiding any live old-path reference in the ja copy.
leftovers=$(
  grep -rnoE "[^ )\"'\`]*unimplemented-screens-plan[^ )\"'\`]*" . --include="*.md" \
    | grep -v "/node_modules/" \
    | grep -vE "^(\./)?plans/(ja/)?011-onboarding-docs-env-and-stale-plan\.md:" \
    | grep -vE "^(\./)?plans/audit/" \
    | awk '{ tok = $0; sub(/^[^:]*:[0-9]+:/, "", tok);
             if (index(tok, "archive/unimplemented-screens-plan") == 0) print }'
)
if [ -n "$leftovers" ]; then
  printf '%s\n' "$leftovers"
  echo "FAIL: live references to the OLD path remain"
  exit 1
fi
echo "PASS: no live references to the old path"
```

→ **zero hits / exit 0**. Any hit (outside this plan, its ja copy, and the audit trail) is a live
reference to the *old* path, and the gate exits **1**. Before the move lands this gate is expected
to fail — that is the Red state it is written to detect.

**(Auxiliary) audit-directory-only scan**: the main gate above excludes `plans/audit/*` **entirely**
(`grep -vE "^(\./)?plans/audit/"`), but the caveat above still requires that audit-trail references be
**re-pointed** at the new archive path. Excluding the directory wholesale means a **live old-path
reference** left inside `plans/audit/` (i.e. one not pointing at the archive path) is never surfaced.
So scan `audit` alone for old-path tokens that are **not** aimed at the archive path. This one
**does not fail the gate** — it produces a list for human review:

```bash
# plans/audit only. References already aimed at archive/ count as re-pointed and are excluded;
# whatever remains is still on the old path. Zero lines = re-pointing complete.
grep -rnoE "[^ )\"'\`]*unimplemented-screens-plan[^ )\"'\`]*" plans/audit --include="*.md" \
  | grep -vE "(^|/)archive/unimplemented-screens-plan" \
  || true
# Each line printed is either an intentional historical quotation (showing the old token as an
# example) or a missed re-point. The former may stay; the latter must be corrected to the archive
# path. A human decides — this scan deliberately does not fail mechanically.
```

> **Exclude by path, not by basename.** `grep --exclude=` matches the **basename**, so the earlier
> gate's `--exclude="011-onboarding-docs-env-and-stale-plan.md"` dropped **both** `plans/011-…​.md`
> **and** `plans/ja/011-…​.md`. The ja copy is a translation, not the audit trail — a genuine
> leftover old-path reference in it would never have been reported. The same applies to
> `--exclude-dir="audit"`, which drops *any* directory named `audit` anywhere in the tree. Keeping
> `-n` and filtering on the path prefix (`^(\./)?plans/ja/011-…`, `^(\./)?plans/audit/`) makes the
> exclusion say exactly what it means.
>
> **Exclude on `archive/unimplemented-screens-plan`, not on `docs/archive`.** The earlier gate used
> `grep -v docs/archive`, which **fails references that were correctly updated**. As the table above
> shows, the 9 files under `docs/design/*/README.md` use the relative-link form, so after the fix
> they read `../../archive/unimplemented-screens-plan.md` — a string that contains `archive/` but
> **not** `docs/archive`. Under the old gate all 9 counted as leftovers. Excluding on the path
> segment immediately before the filename (`archive/`) is agnostic to whether the reference is
> repo-root relative or link-relative.
>
> This also makes the gate **binary**. The old wording's escape hatch ("or all remaining references
> point to the new archive path") could not be decided by the command itself and required a human to
> eyeball the output, so it is removed.
>
> **Match per occurrence, not per line.** A line-oriented `grep -v` (`grep "…" | grep -v
> "archive/…"`) drops the *whole line* when it contains the archive string — so a line that mentions
> **both** paths (e.g. "moved from `unimplemented-screens-plan.md` to
> `archive/unimplemented-screens-plan.md`") hides the live old reference sitting on the same line.
> The `grep -oE` above extracts each path token separately, so the old-path token survives the
> `archive/` exclusion and the gate still catches it.

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
# 任意 (未設定なら Clerk の既定値)。src/ は参照せず Clerk がライブラリ設定として読む。
# 下記 3 つは Clerk の既定値と同一だが、既定値の変更に依存しないよう明示的にピンする。
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/

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

Cross-check against the live env-name grep + `.env.docker.example` so nothing required is missing and nothing abandoned (Elasticsearch) is added.

**Empty-value vs literal-value policy** (resolve the apparent contradiction with the block above).
Note this axis is **secret vs non-secret**, *not* optional vs required — the two must not be conflated:

- **Secrets / deployment-specific values** (`DATABASE_URL`, `CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`,
  `PAYPAL_SECRET`, tokens, webhook signing secrets, URLs that vary per environment) are left **empty**
  (`NAME=`) — never a real credential.
- **Non-secret config** (`NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `…SIGN_UP_URL=/sign-up`,
  `…AFTER_SIGN_IN_URL=/`, **and `PAYPAL_API_BASE=https://api-m.sandbox.paypal.com`**) carries its
  **literal** value. The sandbox base URL is an endpoint, not a credential, so it is a
  **non-secret default** rather than a blank.

So the rule is **not** "no values ever": it is **"no secrets"** — non-secret config keeps its literal value.

> **Correction — the three Clerk URL vars are *optional*, not required.** An earlier version of this
> policy justified their literal values with "the app ships custom `src/app/(auth)/` pages and the
> Clerk defaults would point elsewhere — an empty value here breaks auth". **That is factually
> wrong**, and it contradicted the env block's own inline comment ("任意 (未設定なら Clerk の既定値)").
> The repo's custom pages resolve to `/sign-in` and `/sign-up`
> (`src/app/(auth)/sign-in/[[...sign-in]]/page.tsx` / `…/sign-up/[[...sign-up]]/page.tsx`), which are
> **exactly Clerk's defaults**; `AFTER_SIGN_IN_URL=/` is the default too. Leaving them empty does not
> break auth.
>
> The real reason to pin them is **defensive**: it fixes the routing contract in the repo so a future
> change to Clerk's defaults cannot silently reroute auth. Both the inline comment and this policy now
> state the same thing — optional, pinned deliberately, and non-secret.

**Both files apply the same classification.** `PAYPAL_API_BASE` is a non-secret default in the README
block (step 2) *and* in `.env.example` (step 3): it carries `https://api-m.sandbox.paypal.com` in both,
never blanked. This removes the apparent contradiction where step 3's example set it while step 2's
policy left routing config unclassified — the classification (secret ⇒ empty / non-secret ⇒ literal
default) is authoritative for both files.

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
