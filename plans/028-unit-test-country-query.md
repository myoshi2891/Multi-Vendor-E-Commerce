# Plan 028: `src/queries/country.ts` に unit テストを新設し「全 server action テスト済み」不変条件を回復する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b6591f9..HEAD -- src/queries/country.ts`
> `src/queries/country.test.ts` が既に存在する場合も STOP（誰かが先に閉じた可能性）。

## Status

- **Priority**: P3
- **Effort**: S（1 関数・4 テスト）
- **Risk**: LOW（新規テストファイルのみ。本体無変更）
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `b6591f9`, 2026-07-10
- **出典 finding**: TESTS-12（`plans/audit/findings-12-test-coverage.md`）

## Why this matters

`CLAUDE.md`「テスト要件」は Jest ユニットテストの対象を「**全サーバーアクション**」と定める。
`src/queries/` 全 20 モジュールのうち、テストファイルが無いのは `country.ts` **ただ 1 つ**
（lcov 0%）。モジュール自体は小さいが、この不変条件が破れていると「新しい server action に
テストを書く」基準線が曖昧になる。4 テストで閉じられる最小コストの規約回復。

**紛らわしい隣接ファイルに注意**: `src/lib/country.test.ts` は**別物**
（`src/lib/country.ts` = ユーティリティのテスト）。また `plans/024`（userCountry cookie 検証）の
in-scope は `src/app/api/setUserCountryInCookies/route.ts` + `src/lib/utils.ts` で本モジュールと
重複しない。

## Current state

`src/queries/country.ts` の全文（19 行 — これがテスト対象のすべて）:

```typescript
"use server";

import { db } from "@/lib/db";

export const getAllCountries = async () => {
    try {
        const countries = await db.country.findMany({
            orderBy: { name: "asc" },
        });
        return countries;
    } catch (error) {
        if (error instanceof Error) {
            console.error("Error retrieving countries:", error.message, error.stack);
        } else {
            console.error("Error retrieving countries:", error);
        }
        throw new Error("Failed to retrieve countries.");
    }
};
```

分岐は 3 つ: ①正常（findMany 結果をそのまま返す）②catch の `instanceof Error` 真
③同偽（非 Error reject）。

**従うべきパターンの exemplar**: `src/queries/category.test.ts` — モック設定
（`jest.mock("@/lib/db", ...)` で必要メソッドだけ `jest.fn()` にする形、`:21-30`）と
`describe("getAllCategories")`（`:176-230`）の構造をそのまま踏襲する。
エラー両分岐の assert は `src/queries/message.test.ts:567-660` の
「catch 分岐網羅（Error / unknown 両系統）」を手本にする。
テストは AAA（Arrange-Act-Assert）パターン（`.claude/rules/01-engineering-standards.md`）。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| 対象テスト | `bun run test -- src/queries/country.test.ts` | 4 pass |
| カバレッジ | `bun run test -- src/queries/country.test.ts --coverage --collectCoverageFrom='src/queries/country.ts'` | Lines/Branches 100% |
| 型チェック | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| フルスイート | `bun run test` | 全 pass・スイート数 +1 |

## Scope

**In scope**:
- `src/queries/country.test.ts` — **新規作成**（これのみ）

**Out of scope**:
- `src/queries/country.ts` 本体（PERF-05 の「参照データキャッシュ化」候補だが本プランでは触らない）
- `src/lib/country.ts` / `src/lib/country.test.ts`
- `src/app/api/setUserCountryInCookies/**`（plan 024 の領分）

## Git workflow

- ブランチ: 現在のブランチ（`dev`）
- 1 テストファイル = 1 コミット（rule 02）。docs 同期は別コミット
- コミット例: `test(country): add unit tests for getAllCountries (close last untested server action)`

## Steps

### Step 1: テストファイルを作成

`src/queries/country.test.ts` を新規作成。構成:

```typescript
import { getAllCountries } from "./country";

// ---- モック設定 ----
jest.mock("@/lib/db", () => ({
    db: {
        country: {
            findMany: jest.fn(),
        },
    },
}));

const mockDb = require("@/lib/db").db;

let consoleErrorSpy: jest.SpyInstance;

beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    consoleErrorSpy.mockRestore();
});
```

テストケース 4 本（describe `getAllCountries`）:

1. **正常系**: `findMany` が `[{ id: "c1", name: "Japan", code: "JP" }]` 相当を resolve →
   戻り値がそのまま返り、`findMany` が `{ orderBy: { name: "asc" } }` で呼ばれたことを assert
   （昇順ソートは呼び出し契約として固定する）
2. **DB エラー（Error）**: `mockRejectedValue(new Error("db down"))` →
   `rejects.toThrow("Failed to retrieve countries.")` + `console.error` が
   `("Error retrieving countries:", "db down", expect.any(String))` で呼ばれる
3. **DB エラー（非 Error）**: `mockRejectedValue("boom")` → 同じ汎用メッセージで throw +
   `console.error` が `("Error retrieving countries:", "boom")` で呼ばれる（unknown 分岐）
4. **エラー詳細の非漏洩**: ケース 2 の throw メッセージに `"db down"` が**含まれない**こと
   （`rejects.toThrow` の完全一致 or `.rejects.toMatchObject({ message: "Failed to retrieve countries." })`）
   — ケース 2 に同居させてもよいが assert として明示する

**Verify**: `bun run test -- src/queries/country.test.ts` → 4 pass（ケース 4 を 2 に同居させた場合 3 pass）。

### Step 2: カバレッジと品質ゲート

`bun run test -- src/queries/country.test.ts --coverage --collectCoverageFrom='src/queries/country.ts'`
→ **Lines 100% / Branches 100%**。続けて `bunx tsc --noEmit` / `bun run lint` / `bun run test`。

**Verify**: すべて exit 0。フルスイートのスイート数が 172 → 173 に増えている。コミット。

### Step 3: ドキュメント同期

`spec-sync-after-test` skill を起動（テスト数・スイート数変動のため必須）。別コミット。

**Verify**: QA_HANDOFF.md の統計テーブルが新数値に更新されている。

## Test plan

（Step 1 のケース表が仕様。手本: `category.test.ts:176-230` + `message.test.ts:567-660`）

## Done criteria

- [ ] `src/queries/*.test.ts` の数が `src/queries/*.ts`（README_store.md 除く実装 20 本）と一致
      — `ls src/queries/*.test.ts | wc -l` → **20**
- [ ] country.ts 単体で Lines/Branches 100%
- [ ] `bunx tsc --noEmit` / `bun run lint` / `bun run test` すべて exit 0
- [ ] 変更ファイルが `src/queries/country.test.ts`（+ spec-sync docs 群）のみ
- [ ] `plans/README.md` の 028 行を DONE に更新

## STOP conditions

- `country.test.ts` が既に存在する（先行して閉じられている — 状況を README に反映して終了）
- `country.ts` の形状が Current state の全文と一致しない
- テストを通すために本体変更が必要に見える

## Maintenance notes

- PERF-05（参照データのキャッシュ化）が採用されると `country.ts` に `unstable_cache` 等が入る。
  その際ケース 1 の「findMany が直接呼ばれる」assert は書き換えが必要（このテストが最初の
  回帰検知点になる — それが狙い）。
- レビュー観点: 汎用メッセージへの変換（内部エラー詳細の非漏洩）が assert されているか。
