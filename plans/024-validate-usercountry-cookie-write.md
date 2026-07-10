# Plan 024: Validate the `userCountry` cookie on the write path (make write symmetric with read)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `plans/audit/findings-11-security-followup.md` (the index for this round;
> `plans/README.md` was intentionally not modified this round).
>
> **Drift check (run first)**:
> `git diff --stat 78397dc..HEAD -- src/app/api/setUserCountryInCookies/route.ts src/lib/utils.ts`
> If either in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `78397dc`, 2026-07-10

## Why this matters

`POST /api/setUserCountryInCookies` is a **public, unauthenticated** endpoint
that takes `userCountry` straight from the request body and writes
`JSON.stringify(userCountry)` into a cookie with **no shape validation, no size
limit, and no `path` attribute**. The read path (`parseUserCountryCookie` in
`src/lib/utils.ts`) already validates with `isCountry` and falls back to
`DEFAULT_COUNTRY`, so malformed data cannot corrupt downstream logic — the
injection risk is contained, which is why this is low severity. But the write
side being unvalidated means a client can store an arbitrarily large JSON blob
that is then **sent on every subsequent request** (cookie bloat), and the
missing `path` makes this endpoint's cookie scope inconsistent with the
middleware's own cookie write (`src/middleware.ts` sets `path: "/"`). This plan
makes the write path validate symmetrically with the read path and pins the
cookie attributes to match the middleware.

## Current state

- `src/app/api/setUserCountryInCookies/route.ts` — the endpoint to harden.
- `src/lib/utils.ts` — home of the country cookie helpers. `isCountry` is a
  **module-private** type guard (NOT exported); `parseUserCountryCookie` is
  exported. This plan needs `isCountry` on the write side, so Step 1 exports it.

Current endpoint, `src/app/api/setUserCountryInCookies/route.ts` (as of `78397dc`):

```ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userCountry } = body

        if (!userCountry)
            return new NextResponse("Please provide userCountry data.", {status: 400})

        const response = new NextResponse("User country saved successfully", { status: 200 });

        response.cookies.set('userCountry', JSON.stringify(userCountry), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
        })

        return response;
    } catch (error) {
        return new NextResponse("Couldn't save data", {status: 500})
    }
}
```

Read-side guard, `src/lib/utils.ts` (as of `78397dc`):

```ts
function isCountry(value: unknown): value is Country {
    if (typeof value !== "object" || value === null) return false;
    const obj = value as Record<string, unknown>;
    return (
        typeof obj.name === "string" &&
        typeof obj.code === "string" &&
        typeof obj.city === "string" &&
        typeof obj.region === "string"
    );
}
```

The `Country` type (`src/lib/types.ts:142`) has exactly four string fields:
`name`, `code`, `city`, `region`. The middleware write for comparison,
`src/middleware.ts:28-33`:

```ts
response.cookies.set("userCountry", serialized, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
});
```

### Repo convention to follow (inlined)

- `.claude/steering/tech.md` ("cookie パース"): 外部 cookie の JSON パースは必ず
  `parseUserCountryCookie()` を使う。この設計意図（`isCountry` で name/code/city/region
  を検証）を**書き込み側にも対称適用**する。
- `.claude/steering/tech.md`: `any` 禁止（`unknown` + 型ガード）。`request.json()` の戻り値は
  `unknown` として扱い、`isCountry` で絞り込む。
- Error handling: external calls wrapped in `try/catch`; log at the boundary,
  never leak internals to the client.

## Commands you will need

| Purpose   | Command                                                       | Expected on success |
|-----------|---------------------------------------------------------------|---------------------|
| Typecheck | `bunx tsc --noEmit`                                           | exit 0, no errors   |
| Lint      | `bun run lint`                                                | exit 0              |
| Unit test | `bun run test -- src/app/api/setUserCountryInCookies`         | all pass            |

## Scope

**In scope** (the only files you may modify/create):
- `src/lib/utils.ts` — add `export` to the existing `isCountry` type guard (no logic change).
- `src/app/api/setUserCountryInCookies/route.ts` — validate before writing; add `path: "/"`.
- `src/app/api/setUserCountryInCookies/route.test.ts` — **create** (see Test plan).

**Out of scope** (do NOT touch, even though they look related):
- `parseUserCountryCookie` and `DEFAULT_COUNTRY` — the read path is already correct.
- `src/middleware.ts` cookie write — already correct; do not change it.
- The `Country` type or `isCountry`'s validation logic — only add the `export` keyword.

## Git workflow

- Branch: `advisor/024-validate-country-cookie-write` (or the repo's convention).
- Commit style: Conventional Commits. Example: `fix(api): validate userCountry cookie before write`.
- Do NOT push or open a PR unless the operator instructs it.

## Steps

### Step 1: Export the `isCountry` type guard

In `src/lib/utils.ts`, change the declaration from `function isCountry(` to
`export function isCountry(`. No other change. This lets the route reuse the
exact same validation the read path uses (single source of truth for shape).

**Verify**: `grep -n "export function isCountry" src/lib/utils.ts` → one match.
Then `bunx tsc --noEmit` → exit 0.

### Step 2: Validate the body and pin cookie attributes in the route

Rewrite `src/app/api/setUserCountryInCookies/route.ts` to validate with
`isCountry` before writing, and add `path: "/"`. Target shape:

```ts
import { NextResponse } from "next/server";
import { isCountry } from "@/lib/utils";

export async function POST(request: Request) {
    try {
        const body: unknown = await request.json();
        const userCountry =
            typeof body === "object" && body !== null
                ? (body as Record<string, unknown>).userCountry
                : undefined;

        // 読み取り側 parseUserCountryCookie と対称に shape 検証（name/code/city/region）
        if (!isCountry(userCountry)) {
            return new NextResponse("Invalid userCountry data.", { status: 400 });
        }

        const response = new NextResponse("User country saved successfully", {
            status: 200,
        });

        // 検証済み Country のみを直列化（固定4フィールドのためサイズは実質有界）
        response.cookies.set("userCountry", JSON.stringify(userCountry), {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/", // middleware の cookie set と対称化
        });

        return response;
    } catch (error) {
        // 内部詳細はクライアントに漏らさない
        return new NextResponse("Couldn't save data", { status: 500 });
    }
}
```

Note: validating with `isCountry` (four required string fields) means the
serialized cookie is now a fixed small shape — extra client-supplied fields are
dropped is NOT automatic (`JSON.stringify(userCountry)` still serializes the
whole object). If you want to guarantee only the four fields are stored,
serialize an explicit projection instead:
`JSON.stringify({ name: userCountry.name, code: userCountry.code, city: userCountry.city, region: userCountry.region })`.
**Prefer the explicit projection** — it also caps size deterministically. Use it
in place of `JSON.stringify(userCountry)` above.

**Verify**: `bunx tsc --noEmit` → exit 0.

### Step 3: Add the route test

Create `src/app/api/setUserCountryInCookies/route.test.ts`. Call the exported
`POST` with `new Request("http://localhost/api/setUserCountryInCookies", { method: "POST", body: JSON.stringify({...}) })`.

Cases:
1. **Valid country**: body `{ userCountry: { name, code, city, region } }` → status 200; response `Set-Cookie` header contains `userCountry=` and `Path=/`.
2. **Missing userCountry**: body `{}` → status 400.
3. **Invalid shape**: body `{ userCountry: { name: "X" } }` (missing fields) → status 400, no cookie set.
4. **Extra fields dropped** (only if you used the explicit projection in Step 2): body with an extra `evil: "..."` field → 200, and the serialized cookie does not contain `evil`.

Read the `Set-Cookie` header via `response.headers.get("set-cookie")`.

**Verify**: `bun run test -- src/app/api/setUserCountryInCookies` → all pass.

### Step 4: Full gate

**Verify**:
- `bunx tsc --noEmit` → exit 0
- `bun run lint` → exit 0
- `bun run test -- src/app/api/setUserCountryInCookies` → all pass

## Test plan

- New file: `src/app/api/setUserCountryInCookies/route.test.ts`.
- Structural pattern: a route/handler test that constructs a `Request` and calls the exported handler directly. If no API-route test exists to copy, model the mock-free structure after any `src/queries/*.test.ts` (Arrange–Act–Assert).
- Cases: the 3–4 listed in Step 3 (valid / missing / invalid / extra-fields-dropped).
- Verification: `bun run test -- src/app/api/setUserCountryInCookies` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bunx tsc --noEmit` exits 0.
- [ ] `bun run lint` exits 0.
- [ ] `bun run test -- src/app/api/setUserCountryInCookies` exits 0; new cases pass.
- [ ] `grep -n "export function isCountry" src/lib/utils.ts` → one match.
- [ ] `grep -n "isCountry" src/app/api/setUserCountryInCookies/route.ts` → at least one match (route validates).
- [ ] `grep -n 'path: "/"' src/app/api/setUserCountryInCookies/route.ts` → one match.
- [ ] `git status` shows only the 3 in-scope files changed/created.

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows `src/lib/utils.ts` or the route changed since `78397dc` and the "Current state" excerpts no longer match (e.g. `isCountry` was already exported, or its field set changed).
- `Country` no longer has exactly `name`/`code`/`city`/`region` — the projection in Step 2 would then drop or miss a field; re-derive the field list from `src/lib/types.ts` and report.
- Any step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- **Test-stats sync**: adding tests changes the `Tests:` total. Per `.claude/rules/02-tdd-step-commit.md`, run `spec-sync-after-test` afterward in a **separate docs commit**.
- If a new field is ever added to `Country`, update **both** `isCountry` (read-side guard) and the explicit projection in this route (write-side), or the field will be silently dropped on write.
- **Reviewer focus**: confirm the endpoint returns 400 (not 500) on invalid input, that the cookie now carries `Path=/`, and that no internal error text is returned on the 500 branch.
- Follow-up explicitly deferred: rate limiting of this (and other public) endpoints is tracked separately in `plans/025-spike-rate-limit-public-endpoints.md`.
