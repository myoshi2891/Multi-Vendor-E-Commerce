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
- `.claude/steering/tech.md`（構造化ログ）: 境界での失敗は
  第1引数 `"[Module:Function] Error message"`（文字列）、第2引数
  `{ error: error.message, stack: error.stack }`（オブジェクト）の 2 引数形式でログする。
  ただし**クライアントへは内部詳細を返さない**（汎用メッセージのみ）。
- Error handling: external calls wrapped in `try/catch`; log at the boundary,
  never leak internals to the client.
- 入力起因のエラー（不正な JSON / shape 不一致 / 過大サイズ）は **4xx**（クライアント誤り）で
  返す。`500` は**サーバ内部の予期せぬ失敗**に限定する（下記 Step 2 参照）。

## Commands you will need

| Purpose   | Command                                                       | Expected on success |
|-----------|---------------------------------------------------------------|---------------------|
| Typecheck | `bunx tsc --noEmit`                                           | exit 0, no errors   |
| Lint      | `bun run lint`                                                | exit 0              |
| Unit test | `bun run test -- src/app/api/setUserCountryInCookies`         | all pass            |

## Scope

**In scope — code/test (the only *code* files you may modify/create)**:
- `src/lib/utils.ts` — add `export` to the existing `isCountry` type guard (no logic change).
- `src/app/api/setUserCountryInCookies/route.ts` — validate before writing; add `path: "/"`.
- `src/app/api/setUserCountryInCookies/route.test.ts` — **create** (see Test plan).

**In scope — docs (separate commit(s), AFTER the code commit)**:
- `plans/audit/findings-11-security-followup.md` — update this plan's status row
  (per the Executor instructions header). Doc-only; keep it out of the code commit.
- `spec-sync-after-test` の出力先（`QA_HANDOFF.md` を SSOT とするテスト統計同期先一式）—
  テスト追加で `Tests:` 総数が変わるため、`.claude/rules/02-tdd-step-commit.md` に従い
  **さらに別の docs コミット**で同期する（Maintenance notes と一致）。

> 注: 上の「code/test 3 ファイル」は **1 コミット目**のスコープ、docs 群は
> **後続の別コミット**のスコープ。Done criteria の `git status` チェックは
> **code コミット直前**の状態（3 ファイルのみ）を指す。

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

Rewrite `src/app/api/setUserCountryInCookies/route.ts` so that:

1. **不正な JSON は 400**（`500` ではない）。`request.json()` は本文が JSON でないと throw する。
   これは**クライアント誤り**なので 400 を返す。`500` は shape 検証を通過した後に発生した
   **サーバ内部の予期せぬ失敗**（cookie 設定時の例外等）だけに限定する。
2. **shape は `isCountry` で検証**（読み取り側 `parseUserCountryCookie` と対称）。
3. **保存は明示 projection のみ**（4 フィールド固定）＋**フィールド長上限**でサイズを決定論的に有界化する。
   `isCountry` は「string であること」しか見ないため、`isCountry` 単独ではサイズ上限を満たさない
   （巨大文字列 4 本を渡せば cookie は肥大化しうる）。
4. **境界で構造化ログ**（`tech.md`）。クライアントには汎用メッセージのみ返す。

Target shape（projection + 長さ上限は**必須**。オプションではない）:

```ts
import { NextResponse } from "next/server";
import { isCountry } from "@/lib/utils";

// 各フィールドの最大長（保存前に強制。合計でも cookie の実用上限に十分収まる）
const MAX_FIELD_LEN = 100;

export async function POST(request: Request) {
    // --- 入力パース: JSON 不正はクライアント誤り (400) ---
    let body: unknown;
    try {
        body = await request.json();
    } catch (error: unknown) {
        // パース失敗は 400。内部詳細はクライアントに返さない
        console.error("[setUserCountryInCookies:POST] Invalid JSON body", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        return new NextResponse("Invalid JSON body.", { status: 400 });
    }

    const userCountry =
        typeof body === "object" && body !== null
            ? (body as Record<string, unknown>).userCountry
            : undefined;

    // shape 検証（name/code/city/region がすべて string）
    if (!isCountry(userCountry)) {
        return new NextResponse("Invalid userCountry data.", { status: 400 });
    }

    // 文字列長上限（過大入力の 400 拒否 — cookie 肥大化を確実に防ぐ）
    if (
        userCountry.name.length > MAX_FIELD_LEN ||
        userCountry.code.length > MAX_FIELD_LEN ||
        userCountry.city.length > MAX_FIELD_LEN ||
        userCountry.region.length > MAX_FIELD_LEN
    ) {
        return new NextResponse("userCountry field too long.", { status: 400 });
    }

    try {
        const response = new NextResponse("User country saved successfully", {
            status: 200,
        });

        // 明示 projection: 検証済みの 4 フィールドのみを直列化（余分なフィールドを確実に落とす）
        const serialized = JSON.stringify({
            name: userCountry.name,
            code: userCountry.code,
            city: userCountry.city,
            region: userCountry.region,
        });

        response.cookies.set("userCountry", serialized, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/", // middleware の cookie set と対称化
        });

        return response;
    } catch (error: unknown) {
        // ここに来るのは cookie 設定など内部処理の予期せぬ失敗のみ → 500
        console.error("[setUserCountryInCookies:POST] Failed to set cookie", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        return new NextResponse("Couldn't save data", { status: 500 });
    }
}
```

**設計上の要点**:
- **projection は必須**。`JSON.stringify(userCountry)` はオブジェクト全体を直列化するため
  余分フィールドが残る。上記の明示 projection で 4 フィールドに固定する。
- **長さ上限は必須**。`isCountry` は型のみ検証し長さを見ない。`MAX_FIELD_LEN` で
  serialize 後サイズを決定論的に有界化する（過大入力は 400）。
- `try/catch` は **cookie 設定ブロックのみ**を包む。JSON パースは別 try で 400 に振り分ける。

**Verify**: `bunx tsc --noEmit` → exit 0。

### Step 3: Add the route test

Create `src/app/api/setUserCountryInCookies/route.test.ts`. Call the exported
`POST` with `new Request("http://localhost/api/setUserCountryInCookies", { method: "POST", body: JSON.stringify({...}) })`.

Cases（1〜6 は**すべて必須**。回帰を機械的に守るため条件付きにしない）:
1. **Valid country**: body `{ userCountry: { name, code, city, region } }` → status 200; response `Set-Cookie` header contains `userCountry=` and `Path=/`.
2. **Missing userCountry**: body `{}` → status 400.
3. **Invalid shape**: body `{ userCountry: { name: "X" } }` (missing fields) → status 400, no cookie set.
4. **Malformed JSON**: body が非 JSON（例: `body: "not-json"`）→ status **400**（500 でないこと）、no cookie set。
5. **Extra fields dropped**（**必須** — Step 2 の projection は必須のため）: `userCountry` に余分な `evil: "..."` を含める → 200、かつ直列化された cookie 値に `evil` が**含まれない**。
6. **Oversized field rejected**（**必須**）: いずれかのフィールドが `MAX_FIELD_LEN` 超（例: `name: "x".repeat(101)`）→ status **400**、no cookie set。

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
- Cases: the 6 listed in Step 3 (valid / missing / invalid / malformed-JSON→400 /
  extra-fields-dropped / oversized→400) — all required.
- Verification: `bun run test -- src/app/api/setUserCountryInCookies` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bunx tsc --noEmit` exits 0.
- [ ] `bun run lint` exits 0.
- [ ] `bun run test -- src/app/api/setUserCountryInCookies` exits 0; new cases pass.
- [ ] `grep -n "export function isCountry" src/lib/utils.ts` → one match.
- [ ] `grep -n "isCountry" src/app/api/setUserCountryInCookies/route.ts` → at least one match (route validates).
- [ ] `grep -n 'path: "/"' src/app/api/setUserCountryInCookies/route.ts` → one match.
- [ ] `grep -n "MAX_FIELD_LEN" src/app/api/setUserCountryInCookies/route.ts` → 長さ上限が実装されている。
- [ ] route が `JSON.stringify({ name:..., code:..., city:..., region:... })` の明示 projection を使う
      （`JSON.stringify(userCountry)` の全体直列化ではない）。
- [ ] Before the **code commit**, `git status` shows only the 3 in-scope
      code/test files changed/created (docs updates go in later, separate commits).

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
