# Plan 023: Bound and validate pagination in the `index-products` GET search route

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/audit/findings-11-security-followup.md` (the index for this round;
> `plans/README.md` was intentionally not modified this round).
>
> **Drift check (run first)**:
> `git diff --stat 78397dc..HEAD -- src/app/api/index-products/route.ts`
> If the in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `78397dc`, 2026-07-10

## Why this matters

The GET handler of `src/app/api/index-products/route.ts` is a **public,
unauthenticated** product-search endpoint. It reads `page` and `limit` from the
query string with `parseInt` and no upper bound or validation, then passes
`limit` straight into Prisma's `take`. A client sending `?limit=99999999`
forces an unbounded database scan and a huge JSON response (resource exhaustion
/ DoS); `?page=-1` produces a negative `skip` that makes Prisma throw a 500 —
and this route returns the raw `error.message` on 500, so internal error text
can leak (that error-leak is a separate, pre-existing finding, SECURITY-05, and
is **out of scope here** — this plan only bounds pagination). `?page=abc`
yields `NaN` skip/take. The sibling POST handler already caps at `take: 50`, and
`getAllOrders` already clamps `limit ≤ 100`; this plan brings the GET handler to
the same standard using the repo's documented URL-parameter normalization rule.

## Current state

- `src/app/api/index-products/route.ts` — public product-search route. It
  exports two handlers:
  - `POST` — suggestion search, already bounded (`take: 50`, line ~71). **Do not touch.**
  - `GET` — paginated search, the vulnerable handler (this plan's only target).

Vulnerable code, `src/app/api/index-products/route.ts:169-172` (as of `78397dc`):

```ts
        // ページネーション用パラメータ
        const page = parseInt(url.searchParams.get("page") || "1");
        const limit = parseInt(url.searchParams.get("limit") || "20");
        const skip = (page - 1) * limit;
```

`limit` then flows into `take: limit` at two places in the same GET handler:
- line ~266 (FULLTEXT path): `skip, take: limit,`
- line ~385 (contains fallback path): `skip, take: limit,`

And `page`/`limit` are echoed back in the response (line ~391-398):

```ts
        return NextResponse.json(
            {
                products,
                total: totalCount,
                page,
                limit,
                totalPages: Math.ceil(totalCount / limit),
            },
            { status: 200 }
        );
```

### Repo convention to follow (inlined — the executor has not read these docs)

From `.claude/steering/tech.md` ("URL パラメータ正規化"):

> ページ番号など数値パラメータは `Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1`
> で正規化すること（`Infinity` / `NaN` / 小数を排除）。

From the same file, the money/number precision section is **not** relevant here
(no `Decimal`), and `any` is banned — use `unknown` + type guards if you ever
need a cast (you will not need one here).

Existing bound-precedent in the codebase: the POST handler in this same file
uses `take: 50`, and `getAllOrders` (`src/queries/order.ts`) clamps `limit` to
`≤ 100`. Use `50` here to match this file's own POST handler.

## Commands you will need

| Purpose   | Command                                             | Expected on success |
|-----------|-----------------------------------------------------|---------------------|
| Typecheck | `bunx tsc --noEmit`                                 | exit 0, no errors   |
| Lint      | `bun run lint`                                      | exit 0              |
| Unit test | `bun run test -- src/app/api/index-products`        | all pass            |

> Note: this repo's Jest config takes the test path as a **positional argument**
> (`bun run test -- <path>`), not `--testPathPattern`. See `CLAUDE.md`.

## Scope

**In scope** (the only files you may modify/create):
- `src/app/api/index-products/route.ts` — normalize `page`/`limit` in the GET handler only.
- `src/app/api/index-products/route.test.ts` — **create** if it does not exist (see Test plan). If a test file already exists under this directory, add cases to it instead of creating a new one.

**Out of scope** (do NOT touch, even though they look related):
- The `POST` handler in the same file — already bounded; changing it risks the suggestion UI.
- `src/app/api/search-products/route.ts` — separate route, already safe (fixed `LIMIT 50`).
- The `{ error: error.message }` 500 response (lines ~134, ~403) — that is SECURITY-05, a separate finding. Do NOT change it here (a future plan may merge with this one).
- Response shape: keep returning `page`, `limit`, `total`, `totalPages`, `products` — clients depend on it. You are changing the **values** (normalized) but not the keys.

## Git workflow

- Branch: `advisor/023-bound-search-pagination` (or the repo's convention if one is evident from `git branch`).
- Commit style: Conventional Commits (repo uses `fix:` / `feat:` / `docs:` — see `git log --oneline -5`). Example: `fix(api): clamp index-products GET pagination bounds`.
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Normalize `page` and clamp `limit` in the GET handler

Replace the three lines at `src/app/api/index-products/route.ts:169-172` with
normalized parsing. Target shape (keep the comment in Japanese to match the file):

```ts
        // ページネーション用パラメータ（NaN / 負値 / 小数 / 過大値を排除）
        const MAX_LIMIT = 50; // POST ハンドラの take:50 と一致させる
        const MAX_PAGE = 10_000; // page の上限（skip 暴走・DB の巨大 OFFSET を防ぐ）
        const rawPage = Number(url.searchParams.get("page"));
        const rawLimit = Number(url.searchParams.get("limit"));
        const page =
            Number.isFinite(rawPage) && rawPage >= 1
                ? Math.min(Math.floor(rawPage), MAX_PAGE)
                : 1; // 下限 1・上限 MAX_PAGE でクランプ
        const limit =
            Number.isFinite(rawLimit) && rawLimit >= 1
                ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
                : 20; // 既定 20、上限 MAX_LIMIT
        const skip = (page - 1) * limit; // page/limit 双方が有界なので skip も有界
```

Rationale for `Number()` over `parseInt`: `parseInt("20abc")` returns `20`
(silent truncation of junk); `Number("20abc")` returns `NaN`, which the
`Number.isFinite` guard then rejects — stricter and matches the tech.md intent.

Rationale for clamping `page` (not just the lower bound): without an upper bound,
`?page=999999999` yields `skip = (page-1)*limit` — an enormous OFFSET that makes
Postgres scan/skip millions of rows (DoS-ish) or risks exceeding safe integer
range. `page` and `limit` must **both** be bounded so `skip` is bounded. If a
deeper page than `MAX_PAGE` is ever legitimately needed, switch to keyset
(cursor) pagination rather than raising the OFFSET ceiling.

Leave the two `take: limit` usages and the response block unchanged — they now
receive the normalized `limit` automatically.

**Verify**: `bunx tsc --noEmit` → exit 0, no errors.

### Step 2: Add/extend the route test

Create `src/app/api/index-products/route.test.ts` (or extend an existing test
file in that directory). Because the handler calls `db.product.findMany`, mock
`@/lib/db` so the test asserts the **normalized `take`/`skip`** passed to Prisma
without a real database. Model the mock style after an existing query test that
mocks `@/lib/db` — for example `src/queries/store.test.ts` (see how it does
`jest.mock("@/lib/db", ...)`).

Cases to cover (all against the GET handler). Assert **both** the Prisma call
args (`take`/`skip`) **and** the normalized values echoed in the response body:
1. **Happy path**: `?search=foo&page=2&limit=10` → `findMany` called with `take: 10, skip: 10`;
   response body's `page === 2` / `limit === 10`.
2. **Over-large limit**: `?search=foo&limit=99999999` → `findMany` `take: 50` (clamped);
   response body's `limit === 50` (the clamped value, not the raw input).
3. **Negative page**: `?search=foo&page=-1` → `page` normalized to `1`, `skip: 0` (no throw);
   response body's `page === 1`.
4. **Non-numeric page/limit**: `?search=foo&page=abc&limit=xyz` → `page: 1`, `take: 20`, `skip: 0`;
   response body's `page === 1` / `limit === 20`.
5. **Over-large page (upper clamp)**: `?search=foo&page=999999999&limit=10` →
   `page` clamped to `MAX_PAGE`, `skip === (MAX_PAGE-1)*10`（skip が有界であること）;
   response body's `page === MAX_PAGE`.

> レスポンス正規化の確認理由: `totalPages = ceil(total/limit)` などがクランプ後の `limit`/`page`
> を使う必要がある。Prisma 引数だけでなく**返却されるページング値**も正規化済みであることを固定する
> （Maintenance notes「Reviewer focus」と一致）。レスポンスに `page`/`limit` フィールドが無い実装なら、
> 何が正規化結果として返るか（`totalPages` 等）を Current state で確認し、それを assert 対象にする。

Construct requests with `new Request("http://localhost/api/index-products?...")`
and call the exported `GET` directly.

**Verify**: `bun run test -- src/app/api/index-products` → all pass, including the 5 new cases.

### Step 3: Full gate

Run the full local gate before committing.

**Verify**:
- `bunx tsc --noEmit` → exit 0
- `bun run lint` → exit 0
- `bun run test -- src/app/api/index-products` → all pass

## Test plan

- New file: `src/app/api/index-products/route.test.ts` (or added cases to an existing test in that dir).
- Structural pattern to copy: `src/queries/store.test.ts` (its `jest.mock("@/lib/db", ...)` setup).
- Cases: the 5 listed in Step 2 (happy path + 4 abuse/robustness inputs).
- Verification: `bun run test -- src/app/api/index-products` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bunx tsc --noEmit` exits 0.
- [ ] `bun run lint` exits 0.
- [ ] `bun run test -- src/app/api/index-products` exits 0; the 5 new cases exist and pass.
- [ ] `grep -n "parseInt" src/app/api/index-products/route.ts` returns **no matches** in the GET handler's pagination block (the normalized code uses `Number(...)`).
- [ ] `grep -n "MAX_LIMIT" src/app/api/index-products/route.ts` returns a match.
- [ ] `git status` shows only `src/app/api/index-products/route.ts` and its test file changed — no other files.

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows `src/app/api/index-products/route.ts` changed since `78397dc` and the "Current state" excerpts no longer match.
- The GET handler no longer reads `page`/`limit` from `url.searchParams` (the route was refactored) — the fix location is gone.
- Mocking `@/lib/db` for the route test proves infeasible in this repo's Jest setup after one reasonable attempt (e.g. the route imports the db singleton in a way the existing mocks don't cover). Report what blocked you instead of adding a real-DB integration test.
- Any step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **Test-stats sync**: adding tests changes the project's `Tests:` total. Per `.claude/rules/02-tdd-step-commit.md`, after this lands you must run the `spec-sync-after-test` skill (regenerate `docs/coverage-dashboard.html` + sync `QA_HANDOFF.md` etc.) in a **separate docs commit**. Keep the test-code commit and the docs-sync commit distinct.
- **SECURITY-05 overlap**: the raw `{ error: error.message }` 500 responses (lines ~134, ~403) remain — a future plan should replace them with a constant, user-safe string and log details **server-side only, using the repo's structured-log convention** (`.claude/steering/tech.md`「構造化ログ」): first arg the string `"[Module:Function] Error message"`, second arg the object `{ error: error.message, stack: error.stack }` — not an ad-hoc `console.error(error)`. If you fix SECURITY-05 in the same PR later, keep it a separate commit from this pagination change.
- **Reviewer focus**: confirm the response `page`/`limit` values are the **normalized** ones (so `totalPages = ceil(total/limit)` uses the clamped `limit`), and that the POST handler was untouched.
- If real pagination limits ever need to differ per caller (e.g. an internal caller wanting more than 50), introduce an explicit allowlist rather than removing the clamp.
