# Plan 042: E2E signIn ヘルパーを Clerk 現行 UI に追従させ、認証依存 E2E 16 件を回復する（+ フッター SVG の a11y 違反是正）

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6ad7b05..HEAD -- tests/e2e/helpers/auth.ts tests/e2e/stock-decrement.spec.ts tests/e2e/messages.spec.ts tests/e2e/seller-onboarding.spec.ts tests/e2e/platform-coupon.spec.ts src/components/store/icons/ src/components/store/layout/footer/newsletter.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M（当初 S — 壊れた locator が 4 spec にインライン複製されていると判明し、
  共有関数抽出 + 5 サイト置換にスコープ拡大）
- **Risk**: MED（Clerk コンポーネントの DOM 構造は Clerk 側更新で再ドリフトし得る）
- **Depends on**: none（**逆に plans 047〜050 がすべて本プランに依存する**）
- **Category**: tests
- **Planned at**: commit `6ad7b05`, 2026-07-11

## Why this matters

2026-07-11 の 3 ブラウザフル実測（`plans/audit/findings-16-e2e-coverage.md` 実測 #2）で、
認証セッションを前提とする E2E **16 テスト instance（13 failed + 3 did not run）が全滅**して
いることが判明した。根本原因は単一: `tests/e2e/helpers/auth.ts` の `signIn()` が Clerk の
旧 2 ステップ UI（Email → Continue → Password → Continue）を前提としているが、現行 Clerk は
**識別子ラベル "Email address or username" + Password 同時表示の 1 画面統合型**に変わっており、
`getByLabel("Email address")` がフッター Newsletter の入力欄（アクセシブル名が完全一致）へ
誤解決する。本プランで在庫減算・PLATFORM クーポン・メッセージング・販売者オンボーディング・
a11y checkout/profile が回復し、認証系の新規 E2E プラン（047〜050）の前提が解除される。

あわせて、a11y sign-in を fail させている**実 WCAG 違反**（フッター SendIcon の
`svg[role="img"]` に代替テキスト無し / serious）を是正する。これを直さない限り、
signIn 修復後も a11y checkout / profile は同じフッター違反で fail する（直列ブロッカー）。

## Current state

- `tests/e2e/helpers/auth.ts` — Clerk テストユーザーを動的作成しサインインするヘルパー。
  問題箇所は `signIn()`（92 行目〜）:

```typescript
// tests/e2e/helpers/auth.ts:92-113（現状 = 修正対象）
async signIn(page) {
    if (!session.email || !session.password) {
        throw new Error(
            "Call create() in beforeAll before signIn()."
        );
    }
    await setupClerkTestingToken({ page });
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(session.email);   // ← 誤爆点
    await page
        .getByRole("button", { name: "Continue", exact: true })
        .click();
    await page
        .getByLabel("Password", { exact: true })
        .fill(session.password);
    await page
        .getByRole("button", { name: "Continue", exact: true })
        .click();
    // サインイン後、Clerk が「Sign in」ボタンを非表示にするのを待つ
    await expect(
        page.getByRole("button", { name: "Sign in" })
    ).toBeHidden({ timeout: 20000 });
```

- **誤爆のメカニズム**（実測 #2 の `test-results/a11y-checkout-*-chromium/error-context.md` で確認済み）:
  1. `/sign-in` は共通ヘッダー/フッター付き（`tests/e2e/layout-chrome.spec.ts:47` が仕様として検証）。
  2. フッターの Newsletter フォームに `src/components/store/layout/footer/newsletter.tsx:64` の
     `<label htmlFor="newsletter-email" className="sr-only">Email address</label>` がある。
  3. 本番ビルドでは Clerk ウィジェット（client-only）のハイドレーションより先に Newsletter 欄が
     存在するため、`getByLabel("Email address")` は Newsletter 欄に解決してメールを入力する。
  4. Clerk 現行フォームの識別子フィールドはアクセシブル名 **"Email address or username"**、
     Password フィールドは同一画面に表示される。Password の fill は成功するが識別子が空のため
     サインインは成立せず、`toBeHidden` が 20s でタイムアウトする（失敗 signature ~22.5s）。
- 失敗時スナップショットでの Clerk フォーム構造（error-context.md より）:
  - 見出し: `Sign in to multivendor_ecommerce`
  - 識別子: `textbox "Email address or username"` / placeholder `Enter email or username`
  - パスワード: `textbox "Password"` / placeholder `Enter your password`
  - 送信: `button "Continue"`（矢印アイコン付き・1 個のみ）
  - Google ソーシャルボタン: `button "Sign in with Google Continue with Google"`
    （旧実装の `getByRole("button", { name: "Sign in" })` はこれに部分一致していた）
- `src/components/store/icons/send.tsx:10-16` — `<svg viewBox="0 0 14 14" fill="currentColor"
  role="img" xmlns=...>` に `aria-label` / `<title>` が無い。`newsletter.tsx:3,17` で
  `SendIcon` としてフッターに描画され、axe の `svg-img-alt`（serious）違反となる。
  同型の `role="img"` で代替テキスト無しのアイコンが
  `src/components/store/icons/wishlist.tsx:16` と `src/components/store/icons/order.tsx:16` にもある。
- **重要: 壊れた locator は 5 サイトに複製されている。** `createCustomerSession().signIn`
  （auth.ts）を使うのは a11y checkout / profile の 2 spec だけで、以下 4 spec は
  **同じ `getByLabel("Email address")` 手順をインラインで持つ**（auth.ts だけ直しても回復しない）:
  - `tests/e2e/stock-decrement.spec.ts:147`
  - `tests/e2e/messages.spec.ts:60`（買い手/売り手 2 コンテキストで共用のローカル関数）
  - `tests/e2e/seller-onboarding.spec.ts:79` と `:180`
  - `tests/e2e/platform-coupon.spec.ts:114`
- 影響を受けているテスト（実測 #2 の failed/did-not-run 一覧）:
  - `tests/e2e/messages.spec.ts:220`（3 ブラウザ）
  - `tests/e2e/platform-coupon.spec.ts:106`（3 ブラウザ）
  - `tests/e2e/seller-onboarding.spec.ts:74`（3 ブラウザ）+ `:143`（serial 連鎖で did not run ×3）
  - `tests/e2e/stock-decrement.spec.ts:129`（chromium/webkit。firefox はローカルゲート skip）
  - `tests/e2e/a11y/checkout.spec.ts:42` / `tests/e2e/a11y/profile.spec.ts:37`（chromium）
- E2E 実行の前提条件（このリポジトリの規約）:
  - ローカル実測は `bash scripts/e2e/run-local.sh`（Docker Postgres 起動 → migrate → seed →
    `--retries=2` 付き playwright）。**実行前に :3000 で LISTEN しているプロセスが無いこと**
    （`lsof -nP -iTCP:3000 -sTCP:LISTEN` が空。`multivendor-app-dev` コンテナが動いていたら
    `docker compose stop app`）。
  - `CLERK_SECRET_KEY` が `.env` に必要（無いと該当 spec は自動 skip されて検証にならない）。
  - `playwright.config.ts:20` は `workers: 1`（DB/セッション競合防止の直列実行）。変更しない。
  - config の `globalTimeout: 1200s` はフルラン には不足するため、フルラン時は
    `--global-timeout=3600000` を CLI で付ける（plan 044 が恒久化を担当）。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| 型チェック | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| 単一 spec E2E（chromium） | `bash scripts/e2e/run-local.sh tests/e2e/a11y/checkout.spec.ts --project=chromium` | `1 passed` |
| 認証系まとめて（chromium） | `bash scripts/e2e/run-local.sh tests/e2e/stock-decrement.spec.ts tests/e2e/platform-coupon.spec.ts tests/e2e/seller-onboarding.spec.ts tests/e2e/messages.spec.ts --project=chromium` | failed 0 |
| フルラン（3 ブラウザ・最終確認） | `bash scripts/e2e/run-local.sh --global-timeout=3600000` | 認証系 16 件が passed に転じる |

## Scope

**In scope** (the only files you should modify):
- `tests/e2e/helpers/auth.ts` — 共有サインイン関数の抽出 + `signIn()` の locator 修正
- `tests/e2e/stock-decrement.spec.ts` / `tests/e2e/messages.spec.ts` /
  `tests/e2e/seller-onboarding.spec.ts` / `tests/e2e/platform-coupon.spec.ts` —
  **インラインのサインイン手順ブロックを共有関数呼び出しに置換するのみ**
  （各 spec のテストロジック・assert は変更しない）
- `src/components/store/icons/send.tsx` — `aria-label` 追加
- `src/components/store/icons/wishlist.tsx` / `src/components/store/icons/order.tsx` — 同上（同型違反の予防是正）

**Out of scope** (do NOT touch, even though they look related):
- `src/components/store/layout/footer/newsletter.tsx` — Newsletter のラベルを変える方向で
  「解決」しない（UI 文言は仕様。テスト側の locator を堅牢化するのが正）。
- 4 spec のサインイン以外の箇所（ユーザー作成・seed・assert 等）。
- `playwright.config.ts` — globalTimeout の恒久化は plan 044 の担当。
- a11y spec の `disabledRules` に `svg-img-alt` を追加して黙らせる対応（違反の隠蔽）。

## Git workflow

- Branch: `advisor/042-e2e-signin-helper-repair`
- Conventional Commits（例: `fix(e2e): ...` / `fix(a11y): ...`）。Step ごとに 1 コミット。
- push / PR はオペレーター指示があるときのみ。

## Steps

### Step 1: 共有サインイン関数を抽出し、Clerk 現行 UI + Clerk スコープに堅牢化する

`tests/e2e/helpers/auth.ts` に **export された共有関数** `signInWithPassword(page, email, password)`
を新設し、`session.signIn()` はそれを呼ぶ薄いラッパーにする（Step 2 で 4 spec からも
同じ関数を使うため）。関数本体は次の形（要点: **Clerk コンポーネント内にスコープしてから
操作**し、フッター Newsletter への誤爆を構造的に排除する。ステップ数の仮定
（1 画面 or 2 画面）にも依存させない）:

```typescript
export async function signInWithPassword(
    page: Page,
    email: string,
    password: string
): Promise<void> {
    await setupClerkTestingToken({ page });
    await page.goto("/sign-in");

    // Clerk ウィジェットのハイドレーション完了を待つ（フッター Newsletter への誤爆防止）
    const clerkRoot = page.locator(".cl-signIn-root");
    await clerkRoot.waitFor({ state: "visible", timeout: 15000 });

    // 識別子: Clerk は input[name="identifier"] を使う（現行 UI のラベルは
    // "Email address or username" だが、name 属性はラベル文言より安定）
    await clerkRoot.locator('input[name="identifier"]').fill(email);

    // 現行 UI は識別子 + パスワード同一画面。パスワード欄が同時に見えていれば埋める。
    const passwordInput = clerkRoot.locator('input[name="password"]');
    if (await passwordInput.isVisible()) {
        await passwordInput.fill(password);
        await clerkRoot.getByRole("button", { name: "Continue" }).click();
    } else {
        // 旧 2 ステップ UI へのフォールバック（Clerk 設定差分に備える）
        await clerkRoot.getByRole("button", { name: "Continue" }).click();
        await passwordInput.waitFor({ state: "visible", timeout: 10000 });
        await passwordInput.fill(password);
        await clerkRoot.getByRole("button", { name: "Continue" }).click();
    }

    // サインイン成立 = Clerk フォームが DOM から消える
    await expect(clerkRoot).toBeHidden({ timeout: 20000 });
    // /sign-in からの離脱確認（現行 signIn() 末尾の waitForURL ブロックをここへ移設）
}
// session.signIn() は null チェック後に
// signInWithPassword(page, session.email, session.password) を呼ぶだけにする
```

注意:
- 既存の `getByRole("button", { name: "Sign in" })` の `toBeHidden` 待ちは
  **Google ソーシャルボタン（"Sign in with Google"）への部分一致**という偶発挙動に依存して
  いたので、上記のとおり `clerkRoot` の非表示待ちに置き換える。
- `.cl-signIn-root` が存在しない場合（Clerk のクラス名変更）は、失敗時の
  `test-results/**/error-context.md` で実 DOM を確認し、`[data-clerk-component]` 等の
  代替アンカーを検討する — ただしそれは STOP 条件（下記）として報告してから。

**Verify**: `bunx tsc --noEmit` → exit 0

### Step 2: 4 spec のインラインサインイン手順を共有関数へ置換する

以下の各サイトで「`/sign-in` へ goto → `getByLabel("Email address").fill` → Continue →
Password → Continue → 完了待ち」に相当する一連のブロックを特定し、
`signInWithPassword(page, <その spec のメール変数>, <パスワード変数>)` の 1 呼び出しに置換する
（import を `./helpers/auth` から追加。ユーザー作成・その前後のロジックは触らない）:

- `tests/e2e/stock-decrement.spec.ts:147` 周辺
- `tests/e2e/messages.spec.ts:60` 周辺（ローカル関数内 — 買い手/売り手の 2 コンテキストで
  共用されているため、そのローカル関数の**中身**を置換する）
- `tests/e2e/seller-onboarding.spec.ts:79` と `:180` の 2 箇所
- `tests/e2e/platform-coupon.spec.ts:114` 周辺

置換後、`grep -rn 'getByLabel("Email address")' tests/e2e/` が **0 件**になること。
`setupClerkTestingToken` の呼び出しが spec 側と共有関数で二重になる場合は spec 側を消す
（同一 page への複数回呼び出しは無害だが冗長）。

**Verify**: `grep -rn 'getByLabel("Email address")' tests/e2e/` → no matches、
`bunx tsc --noEmit` → exit 0

### Step 3: a11y checkout を単発実行してサインイン成立を確認する

**Verify**: `bash scripts/e2e/run-local.sh tests/e2e/a11y/checkout.spec.ts --project=chromium`
→ サインインは成立する（`toBeHidden` タイムアウトが消える）。
このステップでは **axe 違反（svg-img-alt）による fail は想定内**（Step 4 で解消）。
それ以外の理由（例: `waitForURL /checkout` 不達）で fail する場合は STOP。

### Step 4: フッター系アイコン SVG に代替テキストを追加する

`src/components/store/icons/send.tsx` / `wishlist.tsx` / `order.tsx` の
`role="img"` を持つ `<svg>` に `aria-label` を追加する（表示に影響しない属性のみの変更）:

```tsx
// send.tsx — 例
<svg
    viewBox="0 0 14 14"
    fill="currentColor"
    role="img"
    aria-label="Send"
    xmlns="http://www.w3.org/2000/svg"
>
```

`wishlist.tsx` は `aria-label="Wishlist"`、`order.tsx` は `aria-label="Orders"` とする。
（このリポジトリの UI 文言は英語 — 既存ページの文言（"Shopping Cart" 等）に合わせる。）

**Verify**: `bash scripts/e2e/run-local.sh tests/e2e/a11y/sign-in.spec.ts --project=chromium`
→ `1 passed`（svg-img-alt 違反が解消）

### Step 5: 認証依存 spec を chromium で一括確認する

**Verify**:
`bash scripts/e2e/run-local.sh tests/e2e/stock-decrement.spec.ts tests/e2e/platform-coupon.spec.ts tests/e2e/seller-onboarding.spec.ts tests/e2e/messages.spec.ts tests/e2e/a11y --project=chromium`
→ failed 0（skip はブラウザ限定分のみ）

### Step 6: 3 ブラウザフルランで回復を確認する

**Verify**: `bash scripts/e2e/run-local.sh --global-timeout=3600000`
→ ベースライン（52 passed / 17 failed / 39 skipped / 3 did not run）から
**認証系 13 failed + did-not-run 3 が passed へ、a11y sign-in が passed へ**転じる。
期待値: **69 passed / 3 failed（visual 3 枚 = plan 043 担当・既知）/ 39 skipped**。
visual 3 件以外の fail が残る場合は STOP。

### Step 7: テスト統計ドキュメントを同期する

E2E の pass/fail 実測値が変わるため、`spec-sync-after-test` skill（`.claude/skills/spec-sync-after-test/SKILL.md`）
を起動し、`docs/testing/QA_HANDOFF.md` のテスト統計（SSOT）に E2E 実測行を反映する。
skill が使えない環境では QA_HANDOFF.md の「テスト統計」テーブルの Playwright 行に
実測結果（passed/failed/skipped と実測日）を手動追記し、`docs/PROGRESS.md` に同期する。

**Verify**: `git diff --stat` に docs/testing/QA_HANDOFF.md が含まれる

## Test plan

- 本プランはテストコード自体の修復であり、新規テスト追加は無い。
- 回復対象: findings-16 記載の 16 instance + a11y sign-in 1 instance。
- 最終検証はフルラン（Step 6）の期待値到達。

## Done criteria

- [ ] `bunx tsc --noEmit` exit 0 / `bun run lint` exit 0
- [ ] `grep -rn 'getByLabel("Email address")' tests/e2e/` → no matches（5 サイト全滅）
- [ ] chromium で a11y 4 spec / messages / platform-coupon / seller-onboarding / stock-decrement すべて passed
- [ ] 3 ブラウザフルランで visual 3 件（plan 043 対象）以外の failed が 0
- [ ] `git status` で in-scope 外のファイル変更が無い
- [ ] `plans/README.md` の 042 行を DONE に更新

## STOP conditions

Stop and report back (do not improvise) if:

- `.cl-signIn-root` が `/sign-in` に存在しない（Clerk のクラス名がさらに変わった）。
  error-context.md の実 DOM を添えて報告する。
- Step 3 で「サインイン自体は成立するが `/checkout` に到達しない」等、locator 以外の
  失敗モードが出た（アプリ側の退行の可能性 — 本プランの範囲外）。
- Step 6 のフルランで visual 3 件以外の fail が残った。
- 修正が spec ファイル本体（messages 等）の変更を要求すると判明した。
- `CLERK_SECRET_KEY` が未設定で認証系 spec が skip される（検証にならない）。

## Maintenance notes

- Clerk の UI/DOM は Clerk 側アップデートで再ドリフトし得る。`signIn()` は
  「Clerk ルートにスコープ → `input[name=...]` で特定」の 2 段構えを維持すること
  （ラベル文言へのグローバルマッチに戻さない）。
- CI には Playwright ジョブが無く（`.github/workflows/ci.yml` の e2e ジョブは seed 冪等性のみ）、
  この種の退行は CI で検出されない。CI への E2E 導入判断は findings-16 の Rejected 節
  （chromium 限定 + nightly 案）を参照。
- レビュー観点: signIn の フォールバック分岐（2 ステップ UI）はデッドコードに見えるが
  Clerk インスタンス設定差分への保険として意図的。
