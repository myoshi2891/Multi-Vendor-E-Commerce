# Plan 026: `src/queries/paypal.ts` のエラー経路分岐を unit テストで網羅する（Branches 28.6% → 90%+）

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b6591f9..HEAD -- src/queries/paypal.ts src/queries/paypal.test.ts`
> If either in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW（テスト追加のみ。本体コード `paypal.ts` は 1 行も変更しない）
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `b6591f9`, 2026-07-10

## Why this matters

`src/queries/paypal.ts` は決済（money-critical）モジュールでありながら、lcov 実測で
**Lines 51.3% / Branches 28.6%（16/56）** しかない。未カバーなのは catch 節の全エラー分岐と
PayPal API の非 OK 応答経路 — つまり「決済が失敗したとき何が起きるか」がすべて回帰無検出である。
さらに paypal.ts は `.claude/steering/tech.md` が構造化ログ・エラーハンドリング規約の
**実装例（exemplar）として指名しているファイル**であり、その規約遵守がテストで固定されていないのは
基準線として不健全。既存の `message.test.ts` に同型ギャップを +14 テストで閉じた前例
（Branches 74.5%→100%、commit `2d5ab8a`）があり、同じパターンの横展開で完了できる。

## Current state

- `src/queries/paypal.ts` — 対象モジュール。export は `createPayPalPayment(orderId)` と
  `capturePayPalPayment(orderId, paymentId)` の 2 関数のみ。**このファイルは変更しない。**
- `src/queries/paypal.test.ts` — 既存 17 テスト（happy path / IDOR / fetch reject のみ）。
  ここにテストを追記する。

lcov 実測（2026-07-10, HEAD `b6591f9`）の未カバー行と、対応する分岐:

| 未カバー行 | 分岐の内容 |
|---|---|
| `paypal.ts:22-35` | `createPayPalPayment` の `currentUser()` catch: ①`error.message === "Unauthenticated."` の再 throw ガード ②`instanceof Error` 真（構造化ログ + message 補間）③偽（非 Error ログ） |
| `paypal.ts:49-62` | 同関数の `db.order.findUnique` catch: ①`"Order not found"` 再 throw ガード ②Error 真 ③偽 |
| `paypal.ts:99-100` | `response.ok === false` → `PayPal API responded with status ...` throw → 外側 catch でラップ |
| `paypal.ts:111` | 外側 catch の非 Error 分岐（`console.error("Error in createPayPalPayment:", error)`） |
| `paypal.ts:136-152` | `capturePayPalPayment` の `currentUser()` catch（上と同型 3 分岐） |
| `paypal.ts:166-179` | 同関数の `db.order.findUnique` catch（同型 3 分岐） |
| `paypal.ts:203-204` | `captureResponse.ok === false` → status + errorBody throw |
| `paypal.ts:285-295` | 外側 catch: `clearTimeout` + Error/非 Error 両分岐 → `"Failed to capture PayPal payment"` |

catch 節の実コード形状（`paypal.ts:19-36`、capture 側 `:133-153` も同型）:

```typescript
try {
    user = await currentUser();
} catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthenticated.") {
        throw error;                                     // ← 再 throw ガード分岐
    }
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof Error) {
        console.error(
            "[paypal:createPayPalPayment] Failed to fetch current user",
            error.message,
            error.stack
        );
    } else {                                             // ← 非 Error 分岐
        console.error("[paypal:createPayPalPayment] Failed to fetch current user", error);
    }
    throw new Error(`Failed to fetch current user: ${message}`);
}
```

**注意（message.ts との差分）**: paypal.ts の catch は `message.test.ts` の対象と違い、
冒頭に**特定メッセージの再 throw ガード**（`"Unauthenticated."` / `"Order not found"`）が 1 分岐多い。
このガード分岐（= currentUser 自体が `new Error("Unauthenticated.")` で reject するケース）も
テストすること。

既存テストのモック構成（`paypal.test.ts:1-32` — このまま流用する。新しいモックを追加しない）:

```typescript
jest.mock("@clerk/nextjs/server", () => ({ currentUser: jest.fn() }));
jest.mock("@/lib/db", () => ({
    db: {
        order: { findUnique: jest.fn(), update: jest.fn() },
        paymentDetails: { upsert: jest.fn() },
    },
}));
const mockFetch = jest.fn() as jest.Mock<Promise<Partial<Response>>>;
global.fetch = mockFetch as unknown as typeof fetch;
const mockDb = require("@/lib/db").db;
```

**従うべきパターンの exemplar**: `src/queries/message.test.ts:567-660`
「catch 分岐網羅（Error / unknown 両系統）」describe ブロック。非 Error reject は
`mockRejectedValue("db string error")` や `mockRejectedValue({ code: "P2024" })` のように
文字列/生オブジェクトで行い、`console.error` の呼び出し引数を assert する。
`console.error` の spy は `jest.spyOn(console, "error").mockImplementation(() => {})` を
`beforeEach`/`afterEach` で張る（`message.test.ts` の `consoleErrorMock` 相当。paypal.test.ts に
既存の spy がなければ新設する）。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| 対象テスト実行 | `bun run test -- src/queries/paypal.test.ts` | all pass |
| カバレッジ確認 | `bun run test -- src/queries/paypal.test.ts --coverage --collectCoverageFrom='src/queries/paypal.ts'` | paypal.ts の Branch 90%+ |
| 型チェック | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run lint` | exit 0（既存 15 警告は許容） |
| フルスイート | `bun run test` | 全 pass（回帰なし） |

## Suggested executor toolkit

- `test-gen` skill（テストケース生成の repo 標準手順）があれば参照可。ただし本プランのケース表が優先。
- 完了後は `spec-sync-after-test` skill を必ず起動（テスト数が変動するため。rule
  `.claude/rules/02-tdd-step-commit.md` の MUST）。

## Scope

**In scope**（変更してよいファイル）:
- `src/queries/paypal.test.ts` — テスト追記のみ

**Out of scope**（触らない。関連して見えても変更禁止）:
- `src/queries/paypal.ts` — 本体。テストのために本体を変えたくなったら STOP
- `src/config/test-fixtures.ts` 等のテストインフラ — 既存ファクトリで足りる
- `plans/003-server-side-payment-and-address-trust.md` が扱う stripe.ts / 非原子 2 書き込みの修正
  （TESTS-02）— 本プランは unit 層のみ
- sandbox URL ハードコード（`paypal.ts:72,189`）の是正 — SECURITY-07 として investigate 扱い済み

## Git workflow

- ブランチ: 現在のブランチ（`dev`）でよい（repo は plan 単位ブランチを強制していない）
- コミット規律: `.claude/rules/02-tdd-step-commit.md` に従う。テストコードのコミットと
  ドキュメント同期（`spec-sync-after-test` の成果物）は**別コミット**
- コミット例: `test(paypal): cover error-path branches in createPayPalPayment/capturePayPalPayment`
- push / PR はオペレーターの指示があるまで行わない

## Steps

### Step 1: 既存テストの緑を確認（ベースライン）

`bun run test -- src/queries/paypal.test.ts` を実行。

**Verify**: 17 テスト all pass。

### Step 2: `createPayPalPayment` のエラー分岐テストを追加

`paypal.test.ts` 末尾に `describe("catch 分岐網羅（Error / unknown 両系統）")` を新設し、
以下 8 ケースを追加（describe 冒頭に `message.test.ts:567-570` と同趣旨のコメントを付ける）:

1. `currentUser` が `new Error("Unauthenticated.")` で reject → **そのまま** `"Unauthenticated."` が
   throw される（再 throw ガード。`Failed to fetch current user:` にラップされないことを assert）
2. `currentUser` が `new Error("clerk down")` で reject → `"Failed to fetch current user: clerk down"`
   が throw され、`console.error` が `"[paypal:createPayPalPayment] Failed to fetch current user"` +
   message + stack で呼ばれる
3. `currentUser` が非 Error（例 `"boom"`）で reject → `"Failed to fetch current user: boom"` が throw され、
   `console.error` が第 2 引数に生値 `"boom"` で呼ばれる
4. `db.order.findUnique` が `new Error("db down")` で reject → `"Failed to fetch order: db down"`
5. `db.order.findUnique` が非 Error（例 `{ code: "P2024" }`）で reject → `"Failed to fetch order: [object Object]"`
   （`String(error)` の結果。実挙動に合わせて assert）
6. fetch が `{ ok: false, status: 500, text: async () => "server err" }` を resolve →
   外側 catch 経由で `"Failed to create PayPal payment"` が throw され、`console.error` の
   メッセージに `PayPal API responded with status 500` が含まれる
7. fetch が非 Error（例 `"network boom"`）で reject → 外側 catch の非 Error 分岐
   （`console.error("Error in createPayPalPayment:", "network boom")`）→ `"Failed to create PayPal payment"`
8. ケース 2〜7 で PII（user email 等）がログ引数に含まれないこと（ケース 2 の assert に同居可）

認証済みユーザーと所有 order のモックは既存テスト（`paypal.test.ts:64-96` 付近の
`createMockOrder` 利用箇所）と同じ手順を流用する。

**Verify**: `bun run test -- src/queries/paypal.test.ts` → 既存 17 + 新規 7〜8 all pass。

### Step 3: `capturePayPalPayment` の同型テストを追加

同 describe 内にサブ describe を切り、Step 2 の 1〜7 と同型の 7 ケースを
`capturePayPalPayment("order-1", "pay-1")` に対して追加。相違点のみ:

- ログ prefix は `[paypal:capturePayPalPayment]`
- fetch 非 OK（`captureResponse.ok === false`）→ 最終メッセージは `"Failed to capture PayPal payment"`
- 外側 catch の非 Error 分岐 → `console.error("Error in capturePayPalPayment:", ...)`

**Verify**: `bun run test -- src/queries/paypal.test.ts` → 計 31〜32 テスト all pass。

### Step 4: 分岐カバレッジを確認

`bun run test -- src/queries/paypal.test.ts --coverage --collectCoverageFrom='src/queries/paypal.ts'`

**Verify**: paypal.ts の **Branch ≥ 90%**（56 分岐中 51+）。残余があれば text レポートの
Uncovered Line #s を確認し、上記ケース表の漏れのみ補う（新しい種類のテストを発明しない）。

### Step 5: 品質ゲートとコミット

`bunx tsc --noEmit` → exit 0、`bun run lint` → exit 0、`bun run test` → 全 pass を確認して
テストコードをコミット。その後 `spec-sync-after-test` skill を起動し、統計同期
（QA_HANDOFF.md ほか + `bun run coverage:dashboard`）を**別コミット**で行う。

**Verify**: `git log --oneline -2` にテストコミットと docs 同期コミットが分かれて並ぶ。

## Test plan

（本プラン自体がテスト追加。上記 Step 2〜3 のケース表が仕様）
- 構造の手本: `src/queries/message.test.ts:567-660`
- 検証: `bun run test -- src/queries/paypal.test.ts` → 31〜32 テスト all pass

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run test -- src/queries/paypal.test.ts` exit 0、テスト数が 17 → 31 以上
- [ ] paypal.ts 単体の Branch カバレッジ ≥ 90%（Step 4 のコマンドで確認）
- [ ] `bunx tsc --noEmit` exit 0
- [ ] `git diff --stat` で変更ファイルが `src/queries/paypal.test.ts`（+ spec-sync の docs 群）のみ
- [ ] `plans/README.md` の 026 行を DONE に更新

## STOP conditions

Stop and report back (do not improvise) if:

- Drift check で `paypal.ts` 本体が変わっている（特に catch 節の形状・ログ prefix）
- テストを通すために `paypal.ts` 本体の変更が必要に見える（本体のバグ発見 = 報告対象。
  修正はこのプランのスコープ外）
- ケース 5 の `String(error)` 結果が期待とズレて 2 回修正しても合わない
  （実挙動の観察結果を報告して指示を仰ぐ）
- `bun run test` フルスイートで**本プランと無関係のテスト**が落ちる

## Maintenance notes

- plan 003（Stripe サーバー側信頼導出）が paypal.ts の兄弟 stripe.ts を変更する。
  003 実行後に同型のエラー分岐テストを stripe.test.ts にも横展開すると対称性が保てる。
- TESTS-02（capture 経路の非原子 2 書き込みの統合テスト）は本プランのスコープ外のまま残る。
  `db.paymentDetails.upsert` 成功後の `db.order.update` 失敗ケースは unit では意味検証にならないため
  意図的に含めていない。
- レビュー観点: 新規テストが `console.error` の**引数形状**（構造化ログ規約）まで assert しているか。
