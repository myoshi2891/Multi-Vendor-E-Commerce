# Plan 053: 認証サーフェスのスモーク E2E（サインアップウィジェット描画 + サインアウト往復）を追加する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 99ede89..HEAD -- src/app/\(auth\)/ src/components/store/layout/header/user-menu/ tests/e2e/helpers/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition。**例外**: `tests/e2e/helpers/auth.ts` の
> signIn 修復差分は plan 042 の成果（Step 3 の前提）なので STOP 不要。

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: サインアップスモーク（Step 1〜2）は **none**。
  サインアウト往復（Step 3）のみ `plans/042-e2e-signin-helper-repair.md`（signIn 修復）完了が前提。
- **Category**: tests
- **Planned at**: commit `99ede89`, 2026-07-12

## Why this matters

E2E 残余監査（`plans/audit/findings-17-e2e-coverage-r9.md` TESTS-41）で、Clerk サインアップ
ウィジェットの描画とサインアウト導線が E2E ゼロであることを確認した。R8 監査（TESTS-26）では
**サインイン UI のドリフトが認証系 E2E 16 件の全滅として初めて顕在化**した — サインアップ側には
同型のドリフトを早期検出する canary が存在しない（テストインフラはユーザー作成を Clerk API 直で
行うため、サインアップ UI はどのテストも通らない）。ウィジェット描画スモークは Clerk メジャー
アップグレード（plan 004）時の回帰検出器にもなる。

## Current state

- `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx` — Clerk `<SignUp />` を描画するだけの
  ページ。既存カバーは `tests/e2e/layout-chrome.spec.ts:47-48`（ヘッダー/フッターの個数のみ）。
- **セレクタ設計の必須知識（TESTS-26 の教訓）**: `/sign-in` `/sign-up` はヘッダー/フッター付き
  レイアウトで、フッターの Newsletter 入力欄のアクセシブル名が **"Email address"**
  （`src/components/store/layout/footer/newsletter.tsx:64` の sr-only ラベル）。そのため
  `page.getByLabel("Email address")` はページ全体では **Clerk フォームではなく Newsletter 欄に
  解決し得る**。**Clerk 要素への locator は必ず Clerk カード内にスコープする**こと
  （例: `page.locator(".cl-signUp-root")` 内で `getByLabel(...)`。plan 042 が `/sign-in` 側で
  同じ対策 `.cl-signIn-root` を実装済み — 042 完了後はその実装のクラス名選定に合わせる）。
- Register 導線: `src/components/store/layout/header/user-menu/user-menu.tsx` — 未認証時、
  ヘッダーの「Sign in / Register」トリガー（**CSS `group-hover` で開くドロップダウン**）内に
  `<Link href="/sign-up">Register</Link>`（`:95-100` 付近）。認証時は同ドロップダウンに
  `<SignOutButton />`（`:104` — Clerk のボタン。アクセシブル名は既定で "Sign out"）。
- 認証ヘルパー: `tests/e2e/helpers/auth.ts` の `createCustomerSession()` —
  `create()`（Clerk API + Prisma upsert でユーザー作成）/ `signIn(page)` / `cleanup()`。
  `CLERK_SECRET_KEY` 未設定環境向けの skip ゲート `requiresClerkAdmin` もエクスポート済み。
  **現時点の `signIn` は TESTS-26 のドリフトで壊れており、plan 042 が修復する**。
- 実行は `bash scripts/e2e/run-local.sh <spec> --project=chromium`（:3000 空き前提・
  `CLERK_SECRET_KEY` はホスト `.env` に設定済みであること）。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| 型チェック / Lint | `bunx tsc --noEmit` / `bun run lint` | exit 0 |
| 新 spec 単体（chromium） | `bash scripts/e2e/run-local.sh tests/e2e/auth-surface.spec.ts --project=chromium` | all passed |
| 3 ブラウザ | `bash scripts/e2e/run-local.sh tests/e2e/auth-surface.spec.ts` | all passed |

## Scope

**In scope**:
- `tests/e2e/auth-surface.spec.ts`（新規）

**Out of scope**:
- `src/` 配下すべて
- `tests/e2e/helpers/auth.ts`（修復は plan 042 の担当 — 本プランでは読み取り専用）
- フルサインアップ（確認コード入力 → セッション成立）— findings-17 Rejected 節の判断:
  Clerk 自身のテスト責務に近く、ウィジェット描画スモークで UI ドリフト検出の目的は達成できる
- サインイン UI の検証（plan 042 の修復対象と重複）

## Git workflow

- Branch: `advisor/053-e2e-auth-surface-smoke`
- コミット分割: spec 1 ファイルで 1 コミット
  1. `test(e2e): add auth surface smoke spec (sign-up widget / register link / sign-out)`
  2. ドキュメント同期は別コミット（Step 5）
- push / PR はオペレーター指示があるときのみ。

## Steps

### Step 1: サインアップウィジェットの描画スモークを書く

`tests/e2e/auth-surface.spec.ts` を新規作成し、まず認証不要の 2 テストを書く:

1. **サインアップウィジェットが描画される** — `/sign-up` へ goto →
   Clerk ルート要素の出現を待つ（ハイドレーション後に出るため timeout は 20s 程度）:

```ts
const clerkRoot = page.locator('[class*="cl-signUp"], .cl-rootBox').first();
await expect(clerkRoot).toBeVisible({ timeout: 20000 });
```

   その **クラス内にスコープして**、識別子入力（`getByRole("textbox").first()` など
   実 DOM に合わせる）と `Continue` ボタンが visible であることを assert する。
   実 DOM のクラス名・ラベルは初回実行の error-context か
   `bunx playwright codegen http://localhost:3000/sign-up` で確認して合わせる
   （**ページ全体への `getByLabel("Email address")` は Newsletter 欄に誤解決するため禁止** —
   Current state 参照）。
2. **Register 導線** — `/browse` へ goto →
   `page.getByText("Sign in / Register").hover()` でユーザーメニューを開く →
   `getByRole("link", { name: "Register" })` を click →
   `await page.waitForURL(/\/sign-up/)`。

**Verify**: `bunx tsc --noEmit` / `bun run lint` → exit 0。
`bash scripts/e2e/run-local.sh tests/e2e/auth-surface.spec.ts --project=chromium` → 2 passed

### Step 2: 3 ブラウザで確認する

**Verify**: `bash scripts/e2e/run-local.sh tests/e2e/auth-surface.spec.ts` → 6 passed
（firefox の hover フレークが出た場合は purchase-flow 前例のローカルゲートを検討し、
判断をコミットメッセージに記録）

### Step 3: サインアウト往復を追加する（plan 042 完了後のみ）

**前提確認**: plan 042 が DONE か `plans/README.md` で確認する。未完了なら本ステップを
スキップし、その旨を README の 053 行に `DONE (Step 3 deferred: 042 未完了)` と記録して
Step 5 へ進む。

同 spec に `test.describe` を追加:

```ts
import { createCustomerSession, requiresClerkAdmin } from "./helpers/auth";

test.describe("sign-out", () => {
    test.skip(requiresClerkAdmin, "CLERK_SECRET_KEY 未設定のため skip");
    const auth = createCustomerSession();
    test.beforeAll(async () => { await auth.create({ role: "USER" }); });
    test.afterAll(async () => { await auth.cleanup(); });

    test("サインアウトするとゲスト状態に戻る", async ({ page }) => {
        await auth.signIn(page);
        await page.goto("/browse");
        // 認証成立の裏付け: 未認証時の "Sign in / Register" が消えている
        await expect(page.getByText("Sign in / Register")).toBeHidden();

        // ドロップダウンは user-menu.tsx:74 の `hidden group-hover:block` で制御される。
        // つまり **トリガーを hover するまで Sign out は DOM 上 hidden** であり、
        // いきなり click するとメニューが開かないまま可視性待ちでタイムアウトする。
        // 必ず「トリガーを hover → メニューが開いたのを確認 → click」の順に行う。
        // 認証時のトリガーは user-menu.tsx:87 の <UserButton />（Clerk のアバターボタン）。
        // Clerk が付与する .cl-userButtonTrigger をアンカーにする。
        // 実 DOM でクラス名を確認し、変わっていれば STOP して報告すること
        // （plan 042 が .cl-signIn-root で同種の Clerk クラス依存を導入済み）。
        const userMenuTrigger = page.locator(".cl-userButtonTrigger");
        await userMenuTrigger.hover();

        const signOut = page.getByRole("button", { name: "Sign out" });
        await expect(signOut).toBeVisible(); // group-hover でメニューが開いたことの確認
        await signOut.click();
        await expect(page.getByText("Sign in / Register")).toBeVisible({ timeout: 15000 });
    });
});
```

※ 上記は骨子。hover 対象（認証時のトリガー表示）は `user-menu.tsx` の実装を開いて
実 DOM に合わせること。Sign out 後のリダイレクト先は Clerk 既定（現ページ or `/`）で、
assert は「ゲスト表示（Sign in / Register）の復帰」に限定する。

**Verify**: `bash scripts/e2e/run-local.sh tests/e2e/auth-surface.spec.ts --project=chromium`
→ 3 passed

### Step 4: 3 ブラウザで再確認する

**Verify**: `bash scripts/e2e/run-local.sh tests/e2e/auth-surface.spec.ts` → all passed

### Step 5: ドキュメント同期

テスト数が増えるため `spec-sync-after-test` skill を起動する
（`.claude/rules/02-tdd-step-commit.md` の MUST）。E2E 統計は
`docs/testing/QA_HANDOFF.md` が SSOT。

**Verify**: 同期コミットに QA_HANDOFF.md / coverage-dashboard.html が含まれる

## Test plan

- 新規: `tests/e2e/auth-surface.spec.ts` に 2〜3 テスト（ウィジェットスモーク / Register 導線 /
  サインアウト往復〔042 完了後〕）。
- 構造の手本: ゲスト部は `tests/e2e/layout-chrome.spec.ts`、認証部は
  `tests/e2e/a11y/checkout.spec.ts` の `createCustomerSession` 利用パターン。

## Done criteria

- [ ] `bunx tsc --noEmit` / `bun run lint` exit 0
- [ ] chromium で 2 passed（042 完了環境では 3 passed）、3 ブラウザで all passed
- [ ] サインアウトのテストが **トリガーを `hover()` してメニューを開いてから**
      `Sign out` を click している（`user-menu.tsx:74` の `hidden group-hover:block` により、
      hover 無しでは Sign out は不可視でありクリックできない）
- [ ] spec 内に「ページ全体スコープの `getByLabel("Email address")`」が存在しない
      （`grep -n 'getByLabel("Email address")' tests/e2e/auth-surface.spec.ts` → 0 件、
      または Clerk ルートにスコープされたチェーンのみ）
- [ ] **コードコミットの直前**で、`git status` に in-scope 外の変更がない（プラン index の更新と `spec-sync-after-test` の docs 同期は、後続の別コミット）
- [ ] `plans/README.md` の 053 行を更新（Step 3 の実施/延期を明記）

## STOP conditions

- `/sign-up` で Clerk ルート要素（`cl-` プレフィックスのクラス）が 20s 待っても出現しない
  （publishable key 未設定 or ウィジェット破損の可能性 — サーバーログと error-context を
  添えて報告）。
- ユーザーメニューの hover ドロップダウンが開かない（CSS 構造変更 — 報告）。
- `.cl-userButtonTrigger` が存在しない（Clerk のクラス名変更 — hover 対象を実 DOM から
  特定し直す必要があるため報告。`user-menu.tsx:40` の `.group` 配下のトリガー領域が
  代替候補）。
- Step 3 で `auth.signIn` が失敗する（plan 042 の修復が不完全 — 042 側の問題として報告し、
  本プランでは signIn を修正しない）。

## Maintenance notes

- Clerk アップグレード（plan 004）実施時は本 spec が最初に壊れる想定の canary。
  ウィジェットの DOM 変更なら本 spec の locator を、サインインフローの変更なら
  `helpers/auth.ts`（042 の共有ヘルパー）を直す — 役割を混ぜないこと。
- フルサインアップ E2E は意図的に見送った（findings-17 Rejected 節）。将来必要になったら
  Clerk test mode の固定確認コード（424242）+ `+clerk_test` メールで別 spec として設計する。
