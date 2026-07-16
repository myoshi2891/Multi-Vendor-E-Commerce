# Plan 055: ゲストカート → サインイン後のカート引き継ぎ E2E を追加する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 99ede89..HEAD -- src/components/store/cart-page/ src/queries/user.ts tests/e2e/helpers/ tests/e2e/purchase-flow.spec.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition。**例外**: `tests/e2e/helpers/auth.ts` の
> signIn 修復差分は plan 042 の成果（本プランの前提）なので STOP 不要。

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED（`saveUserCart` は plan 005 の correctness 修正対象 — assert を粗く保つ）
- **Depends on**: `plans/042-e2e-signin-helper-repair.md`（signIn 修復）— 完了必須
- **Category**: tests
- **Planned at**: commit `99ede89`, 2026-07-12

## Why this matters

E2E 残余監査（`plans/audit/findings-17-e2e-coverage-r9.md` TESTS-42）で、
「**ゲスト状態で構築したカートが、サインイン後もそのまま使えて /checkout に持ち越される**」
という認証遷移をまたぐ導線がどの層でも検証されていないことを確認した。既存カバーは
「未認証で Checkout → 認証エラー表示」（purchase-flow）と「最初から認証済みでカート構築」
（a11y/checkout・plan 047）のみで、**ゲスト→会員化の順序**を踏むテストが無い。
`saveUserCart` の integration テストは plan 005（カート整合性修正）待ちで deferred 継続中の
ため、この経路は現状ノーガードである。

## Current state

- カートのクライアント状態は Zustand + localStorage 永続（ゲストでもカート構築可能）。
  カート構築の UI 操作パターン（**この関数をコピーして使う**）:

```ts
// tests/e2e/visual/cart.spec.ts:19-43 の addItemToCart（要約）
await page.goto(`/product/${productSlug}/${variantSlug}`);
await page.locator('[data-testid^="size-option-"]').first().click();
await page.waitForURL(new RegExp(`/product/.../\\?size=`));  // 実装はエスケープ付き
await page.getByTestId("add-to-cart").click();
await expect(page.getByText(/Product added to cart/i)).toBeVisible();
await waitForCartPersist(page);  // @/config/test-helpers
```

- Checkout ボタンの挙動: `src/components/store/cart-page/summary.tsx:25-36` —
  `saveUserCart(cartItems)`（server action `src/queries/user.ts`）が成功したときのみ
  `router.push("/checkout")`。未認証だと throw され toast にエラーが出る
  （その分岐は `purchase-flow.spec.ts`「未認証ユーザーがチェックアウトに進むと認証エラーが
  表示される」が固定済み — **重複させない**）。
  ボタンは `data-testid="checkout"`、合計は `data-testid="cart-total"`（`summary.tsx:77,85`）。
- 認証ヘルパー: `tests/e2e/helpers/auth.ts` の `createCustomerSession()`
  （`create` / `signIn` / `cleanup`、skip ゲート `requiresClerkAdmin`）。
  **plan 042 で修復済みであることが前提**（未修復だと signIn がフッターの Newsletter 欄に
  誤入力して失敗する — TESTS-26）。
- seed 値は `buildE2ESeed({ parallelIndex, projectName })`（`tests/e2e/seed/constants.ts`）。
  各テスト冒頭で `setupE2ETestState(page, seed)`（`@/config/test-helpers`）を呼ぶ
  （purchase-flow.spec.ts の beforeEach が手本）。
- 実行は `bash scripts/e2e/run-local.sh <spec> --project=chromium`（:3000 空き前提・
  `CLERK_SECRET_KEY` 設定済み前提）。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| 前提確認（042 完了） | `plans/README.md` の 042 行が DONE | — |
| 型チェック / Lint | `bunx tsc --noEmit` / `bun run lint` | exit 0 |
| 新 spec 単体（chromium） | `bash scripts/e2e/run-local.sh tests/e2e/cart-login-handoff.spec.ts --project=chromium` | all passed |
| 3 ブラウザ | `bash scripts/e2e/run-local.sh tests/e2e/cart-login-handoff.spec.ts` | all passed（ローカルゲート skip 除く） |
| 既存回帰確認 | `bash scripts/e2e/run-local.sh tests/e2e/purchase-flow.spec.ts --project=chromium` | 既存分 passed |

## Scope

**In scope**:
- `tests/e2e/cart-login-handoff.spec.ts`（新規）

**Out of scope**:
- `src/` 配下すべて（`saveUserCart` の挙動修正は plan 005 の担当）
- `tests/e2e/helpers/auth.ts`（読み取り専用）
- 「未認証で Checkout → エラー」の再検証（purchase-flow が担当済み）
- /checkout 以降の操作（住所選択・Place Order — plan 047 / 既存 platform-coupon の担当）
- DB の Cart 行を Prisma で直接検証すること（UI 往復での検証に留める —
  DB レベルの整合は deferred の saveUserCart integration テストの担当領域）

## Git workflow

- Branch: `advisor/055-e2e-guest-cart-login-handoff`
- コミット分割: spec 1 ファイルで 1 コミット
  1. `test(e2e): add guest cart to login handoff spec`
  2. ドキュメント同期は別コミット（Step 4）
- push / PR はオペレーター指示があるときのみ。

## Steps

### Step 1: cart-login-handoff.spec.ts を作成する

`tests/e2e/cart-login-handoff.spec.ts` を新規作成。構成:

- `test.describe` 冒頭で `test.skip(requiresClerkAdmin, "CLERK_SECRET_KEY 未設定のため skip")`。
- `createCustomerSession()` を `beforeAll` で `create({ role: "USER" })`、
  `afterAll` で `cleanup()`（`tests/e2e/a11y/checkout.spec.ts` の利用パターンが手本）。
- beforeEach で `buildE2ESeed` + `setupE2ETestState(page, seed)`（purchase-flow と同じ）。
- テスト本体（1 本のテストに直列で書く — カート状態を引き継ぐ必要があるため）:

1. **ゲストでカート構築** — `addItemToCart`（Current state のパターンをコピー）で
   `seed.product.slug` / `seed.variant.slug` を追加 → `/cart` へ goto →
   商品名（`seed.product.name`）と `data-testid="cart-total"` が visible。
2. **サインイン** — `auth.signIn(page)`。
3. **カートが引き継がれている** — `/cart` へ goto → 商品名が引き続き visible
   （localStorage はコンテキスト共有のため残っている想定 — 消えていたら STOP 条件）。
4. **Checkout でサーバー保存 → /checkout 遷移** — `page.getByTestId("checkout")` を click →
   `await page.waitForURL(/\/checkout/, { timeout: 15000 })` →
   /checkout ページに商品名（`seed.product.name`）が visible。
5. **サーバー往復の確認** — `page.reload()` → /checkout に商品名が引き続き visible
   （表示元がサーバー DB の Cart になっていることの粗い検証）。

注意:
- 金額の厳密検証はしない（`saveUserCart` は plan 005 の correctness 修正対象のため、
  修正が入っても壊れない「アイテムが存在する」レベルの assert に留める — 意図的な設計）。
- toast の文言 assert も最小限にする（表示タイミングのフレーク源）。

**Verify**: `bunx tsc --noEmit` / `bun run lint` → exit 0

### Step 2: chromium で green にする

**Verify**: `bash scripts/e2e/run-local.sh tests/e2e/cart-login-handoff.spec.ts --project=chromium`
→ 1 passed

### Step 3: 3 ブラウザで確認する

**Verify**: `bash scripts/e2e/run-local.sh tests/e2e/cart-login-handoff.spec.ts` → all passed。
purchase-flow / stock-decrement には firefox のローカルゲート前例
（`test.skip(testInfo.project.name === "firefox" && !process.env.CI, ...)`）がある —
同様の症状が出た場合のみ踏襲し、判断をコミットメッセージに記録する。

### Step 4: ドキュメント同期

テスト数が増えるため `spec-sync-after-test` skill を起動する
（`.claude/rules/02-tdd-step-commit.md` の MUST）。E2E 統計は
`docs/testing/QA_HANDOFF.md` が SSOT。

**Verify**: 同期コミットに QA_HANDOFF.md / coverage-dashboard.html が含まれる

## Test plan

- 新規: `tests/e2e/cart-login-handoff.spec.ts` に 1 テスト（ゲスト構築 → サインイン →
  引き継ぎ → サーバー保存 → リロード永続の直列検証）。
- 構造の手本: カート構築は `tests/e2e/visual/cart.spec.ts` の `addItemToCart`、
  認証ライフサイクルは `tests/e2e/a11y/checkout.spec.ts`。
- 回帰: purchase-flow が引き続き passed。

## Done criteria

- [ ] `bunx tsc --noEmit` / `bun run lint` exit 0
- [ ] chromium で 1 passed、3 ブラウザで all passed（正当なローカルゲート skip を除く）
- [ ] `bash scripts/e2e/run-local.sh tests/e2e/purchase-flow.spec.ts --project=chromium` 既存分 passed
- [ ] `git status` で in-scope 外の変更なし
- [ ] `plans/README.md` の 055 行を DONE に更新

## STOP conditions

- `auth.signIn` が失敗する（plan 042 の修復が不完全 — 042 側の問題として報告）。
- Step 1-3 でサインイン後にカートが空になる（サインイン処理がストレージを クリアしている
  可能性 — 実挙動を error-context で確認し、**仕様か バグかの裁定が必要**なため報告。
  勝手に「空になるのが正しい」とテストを書き換えない）。
- Checkout click 後 15s 待っても /checkout に遷移しない（`saveUserCart` の失敗 —
  サーバーログの構造化エラー `[Module:Function]` を添えて報告）。
- /checkout に商品が表示されない・リロードで消える（DB 保存の不整合 — plan 005 の
  correctness 領域のため、再現手順を添えて報告）。

## Maintenance notes

- **plan 005（カート整合性の atomic save）が実装されたら**、本テストの Step 5（リロード永続）
  はより厳密な検証（数量・金額の一致）に強化できる。005 の executor はこの spec を
  回帰テストとして使うこと。
- deferred の「saveUserCart integration テスト」（R5〜R7 台帳）が起票されたら、
  DB レベルの検証はそちらへ、UI 往復は本 spec へ、と責務を分けて重複させない。
