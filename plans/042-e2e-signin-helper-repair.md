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

    // 送信ボタンは exact: true 必須（理由は下記「注意」参照）
    const continueButton = clerkRoot.getByRole("button", { name: "Continue", exact: true });

    // 現行 UI は識別子 + パスワード同一画面（Why this matters で実測確定済み）。
    // UI 形式は Clerk の「設定」で決まる静的な性質なので、時間で推測せず assert する。
    // 形式が変わったらここで大声で失敗させ、helper を意図的に更新させる（下記「注意」参照）。
    const passwordInput = clerkRoot.locator('input[name="password"]');
    await expect(passwordInput).toBeVisible({ timeout: 15000 });

    await passwordInput.fill(password);
    await continueButton.click();

    // サインイン成立 = Clerk フォームが DOM から消える
    await expect(clerkRoot).toBeHidden({ timeout: 20000 });

    // /sign-in からの離脱確認（現行 signIn() 末尾の waitForURL ブロックをここへ移設）
    // toBeHidden だけでは「フォームが消えた」ことしか言えず、遷移完了は保証されない。
    // 後続の goto/click がリダイレクト途中に走るのを防ぐため URL 遷移まで待ち切る。
    await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 20000 });
}
// session.signIn() は null チェック後に
// signInWithPassword(page, session.email, session.password) を呼ぶだけにする
```

注意:
- **`{ exact: true }` は必須**。`/sign-in` には Google ソーシャルボタンがあり、その
  アクセシブル名は **`Sign in with Google Continue with Google`**（Current state で採取済み）。
  `getByRole("button", { name: "Continue" })` は既定で**部分一致**のため、この Google
  ボタンにもマッチして **strict mode violation**（2 要素ヒット）になるか、最悪
  Google ボタンをクリックして OAuth へ飛ぶ。既存コード（Current state の抜粋）が
  `exact: true` を付けているのは偶然ではないので、書き換え時に落とさないこと。
- **1 段 / 2 段を「時間」で判定しない**（`isVisible()` の即時評価も、短い timeout 付き
  `waitFor` の `.then(true)/.catch(false)` も**どちらも不可**）。
  `clerkRoot` が visible になった時点では Clerk ウィジェット内部のフォームがまだ描画途中で
  ありうるため、その瞬間の `isVisible()` は `false` を返し、**実際は 1 段 UI なのに 2 段
  フォールバックへ分岐**する。識別子だけ入れて Continue を押し、パスワード欄の出現を待って
  失敗する（現行の失敗と似た症状に化けるため原因究明が難しくなる）。
  **短い timeout（例: 3s）付きの `waitFor` に置き換えても、これは緩和であって解決ではない** ——
  遅い CI・コールドスタート・初回コンパイルで描画が閾値を超えれば同じ誤分岐が起き、
  しかも**閾値付近でのみ再現する**ため最悪の形のフレークになる。空パスワードのまま Continue が
  押される経路が残る限り、本プランが撲滅対象にしている不安定さを修復コード自身が再導入する。
  タイムアウトが測っているのは「時間」であって「UI 形式」ではない。
  **UI 形式は Clerk の設定で決まる静的な性質**なので、現行形式（1 段 = 識別子 + パスワード同一画面。
  Why this matters で実測確定済み）を **`expect(passwordInput).toBeVisible()` で assert し、
  分岐そのものを持たない**こと。待ち時間は「描画を待つ」ためだけに使い、判定には使わない。
  将来 Clerk 設定が 2 段へ変わった場合はこの assert が**明確なメッセージで失敗**するので、
  helper を意図的に更新できる（黙って誤分岐してフレークするより、失敗が早く・原因が自明）。
  投機的な 2 段フォールバックは、実際に 2 段 UI を使う環境が現れるまで**書かない**。
- **`toBeHidden` の後に `waitForURL` を必ず置く**。フォームの消滅は「Clerk が受理した」
  ことしか意味せず、リダイレクト完了は保証しない。ここで待たないと、呼び出し側の
  最初の `goto` / `click` がリダイレクト途中に割り込み、`/sign-in` へ差し戻される
  レースが残る（helper 内で待ち切ることで全呼び出し側が恩恵を受ける）。
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
- [ ] `signInWithPassword` の Continue 取得が `{ exact: true }` 付き
      （`grep -n 'name: "Continue"' tests/e2e/helpers/*.ts` の全ヒットに `exact: true` がある。
      Google ボタンの名前 `Sign in with Google Continue with Google` に部分一致するため）
- [ ] `signInWithPassword` に **1 段 / 2 段の分岐が存在しない**
      （チェックは **sign-in ヘルパー本体に限定**すること — `helpers/*.ts` 全体を対象にすると
      他ヘルパーが正当に `isVisible()` を使っていても false-fail する。関数本体だけを
      取り出して検査する:

  ```bash
  # 宣言行から、波括弧の深さが 0 に戻る行までを抜き出す。終端文字列に依存しないので、
  # `}` / `};` / `},` のいずれで閉じても、object メソッドとしてインデントされていても効く。
  # 抜き出した本体は tr で 1 行へ正規化してから照合する（下の「行単位で照合しない」参照）。
  #
  # 宣言の検出は「宣言らしさ」で行い、**宣言行が `{` で終わることを要求しない**。
  # Prettier が引数を折り返すとシグネチャが複数行になり `{` が次行以降へ移るため
  # （下の「空抽出を PASS にしないこと」参照）。深さ計測は最初の `{` が現れてから始まる。
  # 抽出の**前**に非コードを潰し、以降の検査を実行コードだけに限定する。
  # 潰す対象は**コメントと文字列リテラルの中身の両方**。文字列リテラルを交替の
  # 左側で捕まえるのは `"a//b"` / `"https://…"` を行コメントと誤認しないためだが、
  # **捕まえたうえで中身まで温存してはならない**（`[^:]` のような一点狙いの
  # ガードが不十分なのと同じ理由で、中身の温存も検査を壊す）:
  #
  #   const hint = "if the field is missing call isVisible() first";
  #
  # 温存すると下の禁止パターンがこの文字列に当たり、**分岐が無いのに FAIL** する。
  # 逆に [`plans/044`](044-e2e-run-guardrails.md) 側では、文字列の中に書いただけの
  # 偽実装が**実装として PASS** する。同じ穴の裏表なので両プランで同一の関数を使う。
  #
  # クォートの対（`""` `''` ` `` `）は残して中身だけを空白へ潰す。構文の骨格が
  # 保たれるので `page.getByLabel("        ")` は呼び出しのまま残り、改行も維持して
  # 行番号がずれない。
  strip_code() {
      perl -0777 -pe '
        s{
           ("(?:\\.|[^"\\])*")            # 二重引用符文字列
         | (\x27(?:\\.|[^\x27\\])*\x27)   # 単一引用符文字列
         | (`(?:\\.|[^`\\])*`)            # テンプレートリテラル
         | (/\*.*?\*/)                    # ブロックコメント
         | (//[^\n]*)                     # 行コメント
        }{
           my $lit = defined($1) ? $1 : defined($2) ? $2 : $3;
           if (defined $lit) {
               my $q = substr($lit, 0, 1);
               my $body = substr($lit, 1, -1);
               $body =~ s/[^\n]/ /g;      # 改行は残し行番号を保つ
               $q . $body . $q;
           } else {
               my $c = $&; $c =~ s/[^\n]/ /g; $c;
           }
        }gexs
      ' "$1"
  }

  body=$(strip_code tests/e2e/helpers/auth.ts | awk '
    !f && /(function[[:space:]]+signInWithPassword|signInWithPassword[[:space:]]*[=:]|async[[:space:]]+signInWithPassword)/ \
        && !/^[[:space:]]*\*/ && !/^[[:space:]]*\/\// { f=1 }
    f { print; n+=gsub(/\{/,"{"); n-=gsub(/\}/,"}"); if (seen && n==0) exit; if (n>0) seen=1 }
  ')

  # ⚠️ 空抽出の判定は **同じ if 連鎖の中**に置くこと（2026-08-02 修正）。
  #    旧形は独立した `[ -n "$body" ] || { echo FAIL; false; }` で、`set -e` の無い
  #    素の shell では `false` が**実行を止めない**。$? をセットするだけなので、
  #    直後の `if/else` が空の body に対して「OK」を出し、$? を 0 で上書きする。
  #    結果、**FAIL メッセージを出しながら exit 0 を返す**（＝第 5 弾が閉じたはずの
  #    vacuous PASS がそのまま残っていた）。
  #
  # ⚠️ `grep -qE … && { echo FAIL; false; }` の形にもしないこと。禁止パターンが
  #    **不在（＝合格）** のとき grep は exit 1 を返し、`&&` が短絡して右辺が実行されない
  #    ため、リスト全体の終了ステータスは grep の 1（＝失敗）になる。合格が exit 0 に
  #    ならないゲートは CI で使えない（plans/023 の Done criteria が同じ形を検証のうえ
  #    否定済み）。
  #
  # 正しい形は **単一の if/elif/else** —— 終了ステータスを決める枝がちょうど 1 つになる。
  if [ -z "$body" ]; then
      echo "FAIL: signInWithPassword の本体を抽出できなかった（ゲートが無効化されている）"; false;
  elif printf '%s' "$body" \
       | tr '\n' ' ' \
       | grep -qE 'isVisible[[:space:]]*\(|\.count[[:space:]]*\(|waitFor[[:space:]]*\([^;]*\)[[:space:]]*\.catch|Promise\.race|\.or[[:space:]]*\('; then
      echo "FAIL: signInWithPassword に実行時分岐が残っている"; false;
  else
      echo "OK: 実行時分岐なし";
  fi
  ```

  > **`set -o pipefail` 有効下で 3 状態すべてを実行して確認（2026-08-02）。**
  > フィクスチャは (a) 分岐なしの本体 / (b) `isVisible()` を含む本体 /
  > (c) `signInWithPassword` が存在しないファイル、の 3 本。
  >
  > | 状態 | 旧形 | 新形 |
  > |---|---|---|
  > | (a) 合格 | `OK` / exit **0** | `OK` / exit **0** |
  > | (b) 違反 | `FAIL` / exit **1** | `FAIL` / exit **1** |
  > | (c) 空抽出 | `FAIL` と `OK` を**両方**出力 / exit **0** ← fail open | `FAIL` / exit **1** |
  >
  > 現行ツリーは plan 未実施のため `signInWithPassword` が存在せず、実行すると
  > 状態 (c) になる。旧形はそこで exit 0 を返していた。
  >
  > なお `printf … | tr … | grep -q` のパイプを `if` 条件に置くこと自体は
  > pipefail 下でも安全である（`tr '\n' ' '` の出力は 1 行なので `grep -q` は
  > 全入力を読み切り、SIGPIPE による中断が起きない。実測 `PIPESTATUS=0 0 0`）。

- [ ] `signInWithPassword` に **`expect(passwordInput).toBeVisible()` が存在する**
      （`:219` が必須と定めたアサーション）。上の 3 本は「分岐が**無い**こと」しか見ておらず、
      **アサーションごと消しても全部 PASS する** —— 分岐を消す最も簡単な方法は待機そのものを
      削ることなので、禁止だけを検査するゲートは「直し方を間違えた実装」を素通しする。
      不在検査と存在検査は別物なので、同じ `$body` に対して別に掛ける:

  ```bash
  # 上のブロックで抽出済みの $body を再利用する（抽出失敗は既に FAIL 済み）。
  # $body は strip_code 済みなので、**コメントアウトされたアサーションは
  # 存在扱いにならない**。生の本文を grep していた旧形は
  # `// await expect(passwordInput).toBeVisible();` でも PASS しており、
  # 「アサーションを消す」より簡単な「アサーションをコメントにする」を素通しした。
  # `expect(passwordInput)` と `.toBeVisible(` の間で Prettier が改行しうるため、
  # ここでも tr で 1 行化してから照合する。
  if printf '%s' "$body" \
       | tr '\n' ' ' \
       | grep -qE 'expect\([[:space:]]*passwordInput[[:space:]]*\)[[:space:]]*\.toBeVisible[[:space:]]*\('; then
      echo "OK: passwordInput の可視性アサーションが存在する";
  else
      echo "FAIL: 必須の expect(passwordInput).toBeVisible() が無い"; false;
  fi
  ```

  > **実測（2026-08-01・三方向）**: plan 042 は未実装で `signInWithPassword` がまだ無いため、
  > 実装後の状態を模した fixture で両方向を確認した。アサーションを持つ本体 → `OK` / exit 0、
  > 同じ本体でアサーションを `//` でコメントアウト → `FAIL` / exit 1、現行の
  > `tests/e2e/helpers/auth.ts`（関数が存在しない）→ 抽出空で exit 1（＝「検査できていない」を
  > PASS にしない既定動作）。`strip_code` は抽出の前段に置いてあるので、**上の
  > 「実行時分岐が存在しない」検査も同じく実行コードだけを見る** —— コメント内の
  > `isVisible()` を根拠に false-fail することもなくなる。
  >
  > **追加実測（2026-08-01・文字列リテラル対応後の三方向）**: 旧 `strip_comments` は
  > コメントだけを潰し**文字列リテラルの中身を温存**していたため、
  > `const hint = "if the field is missing call isVisible() first";` を本体に持つ
  > フィクスチャで **偽 FAIL** した（分岐は存在しないのに「実行時分岐が残っている」）。
  > 中身まで潰す `strip_code` では: 実コードのみ → `OK` / exit 0、
  > **禁止トークンが文字列内にあるだけ** → `OK` / exit 0（旧形は FAIL）、
  > 実コード上に `isVisible()` の分岐 → `FAIL` / exit 1。
  > 潰した後も `page.getByLabel("        ")` は呼び出しのまま残るので、awk の
  > 括弧深さ計測と `$body` 抽出は影響を受けない。

  実測（2026-07-31）: `signInWithPassword` を持つ合成フィクスチャに対し、
  アサーションあり = **exit 0** / アサーションを削除した版 = **exit 1**。
  改行チェーン（`await expect(passwordInput)\n    .toBeVisible({ … })`）でも合格側を検出することを確認済み。

  **空抽出を PASS にしないこと（2026-07-28 修正）。** 旧形は awk の起動条件に
  `/\{[[:space:]]*$/`（宣言行が `{` で終わる）を要求していた。Prettier が引数を
  折り返してシグネチャが複数行になると、この条件が成立せず `f=1` が立たない:

  ```ts
  export async function signInWithPassword(
      page: Page,
      email: string,
  ) {                          // ← `{` は宣言行ではなくこの行にある
  ```

  awk は何も出力せず、`grep -q` は当然ヒットせず、`&& { echo FAIL; false; }` は
  実行されない。**禁止パターンが本体に残っていてもゲートは黙って PASS する**。
  実際、本プラン未実行の現時点で上の旧コマンドを走らせると抽出行数は **0** である
  （`signInWithPassword` はまだ存在しない）。「検査対象が見つからない」と
  「禁止パターンが無い」は別の結果であり、前者は必ず FAIL にしなければならない。

  **行単位で照合しないこと（2026-07-27 修正）。** 元の形は `awk … | grep -cE …` と
  行単位だったため、チェーンを改行で折るだけで検査をすり抜けた:

  ```ts
  await passwordInput.waitFor({ timeout: 1000 })
      .catch(() => …);          // waitFor と .catch が別行 → ヒット 0 件と報告される
  ```

  Prettier の折り返し幅次第で**同じコードが検出されたりされなかったり**するため、
  ゲートとして成立しない。`tr '\n' ' '` で本体を 1 行へ正規化してから照合する。
  正規化後は `.*` がファイル全体を跨いで貪欲マッチしうるので、`waitFor(...).catch`
  の中間は `[^;]*` として**文の境界で止める**（無関係な `waitFor(` と後方の `.catch`
  が結合する偽陽性を防ぐ）。

  併せて **`grep -c … → 0` を合格条件にしないこと**。`grep` は 0 件のとき exit 1 を返すため、
  合格が失敗として扱われる（`tr` で 1 行化した後は `-c` の返り値が 0/1 に潰れ件数としても
  意味を失う）。不在ゲートは上のコマンド本体と同じ

  ```bash
  if printf '%s' "$body" | tr '\n' ' ' | grep -qE '<禁止パターン>'; then
      echo "FAIL: …"; false;
  else
      echo "OK: …";
  fi
  ```

  の **`if … then FAIL … else OK … fi` 形**で表現する（`exit 1` は対話シェルに貼ると
  セッションを落とすため `false` を使う）。

  **`grep -qE … && { echo FAIL; false; }` の形にはしないこと。** 禁止パターンが
  **不在（＝合格）** のとき `grep` は exit 1 を返し、`&&` が短絡して右辺が実行されないため、
  リスト全体の終了ステータスは grep の 1（＝失敗）のまま残る。**合格が exit 0 にならない
  ゲートは CI で使えない**。この点は上のコマンド本体のコメント（`⚠️` 注記）と
  [`plans/023`](023-bound-and-validate-public-search-pagination.md) の Done criteria blockquote が
  検証のうえ既に否定しており、本節もそれに揃える。

  **`isVisible` だけを見ないこと** —— このゲートが排除したいのは「UI が 1 段か 2 段かを
  実行時に見分ける分岐」であって、`isVisible` という特定の API 名ではない。同じ分岐は
  以下の形でも書けてしまい、`isVisible` 単独のパターンはそのすべてを見逃す:

  | 見逃す書き方 | なぜ同じ問題か |
  |---|---|
  | `if (await locator.count()) { … }` | 存在チェックで分岐。要素が遅延描画なら 0 を見て誤った枝へ入る |
  | `await locator.waitFor({ timeout: 1000 }).catch(() => …)` | タイムアウトを分岐条件に使う典型形。まさに時間ベースの判定 |
  | `await Promise.race([oneStep, twoStep])` | どちらが先に解決したかで枝が決まる（実行時レース） |
  | `page.locator(a).or(page.locator(b))` | 1 段/2 段の両方を許容してしまい、ドリフトを検知しない |

  上の和集合パターンはこれらを一括で拾う。**ヒット 0 が要求値**である。

  **終端を `/^}/` に固定しないこと** — 現行 `auth.ts` の sign-in は object メソッド
  （`async signIn(page) {` … `},`）で、閉じ括弧が字下げされている。`/^}/` は
  これを飛び越してファクトリ関数の末尾まで拾い、他ヘルパーの `isVisible()` を
  巻き込んで false-fail する。`signInWithPassword` を関数宣言で書くか
  メソッドのまま残すかは実装時に決まるため、ゲートは宣言形に依存させない。

  **パターンは `isVisible()`（空括弧）完全一致ではなく `isVisible[[:space:]]*\(` に
  すること** — 前者は排除対象そのものである `isVisible({ timeout: … })`（引数付き変種）を
  見逃して false-pass する。`\s` は POSIX ERE に無い GNU 拡張で解釈が実装依存
  （macOS 26 の `/usr/bin/grep` は解釈するが、これに寄りかからない）なので、
  移植性のため POSIX の `[[:space:]]` を使う。
  UI 形式は Clerk 設定で決まる静的な性質なので、`expect(passwordInput).toBeVisible()`
  で 1 段を assert し、時間ベースの判定を一切持たない — 根拠は Step 1）
- [ ] `toBeHidden` の後に `page.waitForURL`（`/sign-in` 離脱）が**実装されている**
      （コメントだけで終わっていないこと）
- [ ] chromium で a11y 4 spec / messages / platform-coupon / seller-onboarding / stock-decrement すべて passed
- [ ] 3 ブラウザフルランで visual 3 件（plan 043 対象）以外の failed が 0
- [ ] **コードコミットの直前**で、`git status` に in-scope 外の変更がない（プラン index の更新と `spec-sync-after-test` の docs 同期は、後続の別コミット）
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
- レビュー観点: signIn に 2 ステップ UI のフォールバック分岐が**入っていない**ことを
  確認する。これは削り忘れではなく Step 1 の設計判断であり、「保険として残す」形へ
  戻さないこと。理由は、分岐を持つには「今どちらの UI か」を実行時に判定する必要が
  あり、その判定手段（`isVisible()` の即時評価も短い timeout 付き `waitFor` も）が
  いずれも「時間」を測っているだけで「UI 形式」を測っていないため。遅い CI や
  コールドスタートで描画が閾値を超えると、1 段 UI なのに 2 段へ誤分岐し、本プランが
  撲滅しようとしている閾値付近フレークを修復コード自身が再導入する。
  将来 Clerk 設定が 2 段へ変わったら `expect(passwordInput).toBeVisible()` が明確な
  メッセージで失敗するので、そのとき helper を意図的に更新すればよい。
