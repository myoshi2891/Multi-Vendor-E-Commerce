# Plan 056: Newsletter 購読フォームの現挙動（dormant 404）を characterization E2E で固定する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 99ede89..HEAD -- src/components/store/layout/footer/newsletter.tsx src/app/api/ tests/e2e/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition。**特に `src/app/api/newsletter/` が新設されて
> いたら本プランは前提から無効**（STOP して成功系テストへの書き直しを提案する）。

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW（ただし「壊れた挙動の固定」であることを理解して使うこと — Why 参照）
- **Depends on**: none（ゲスト導線・認証不要）
- **Category**: tests
- **Planned at**: commit `99ede89`, 2026-07-12

## Why this matters

E2E 残余監査（`plans/audit/findings-17-e2e-coverage-r9.md` TESTS-39）で、フッターの
Newsletter フォームが `/api/newsletter` へ POST するのに **route がリポジトリに存在せず
（curl 実測で 404）、スキーマにも購読者モデルが無い**ことを確認した。全ページに
「$10 coupon for first shopping」と共に露出するフォームが 100% 失敗する状態である。

本プランは **characterization テスト**（現挙動の固定）を追加する。目的は 2 つ:
(1) この dormant ギャップを CI で可視化し続ける（テストコメントで機能不在を明文化）、
(2) 将来 route が実装されたとき、このテストが**意図的に fail して**書き直しを強制する
（ドリフトチェックにもなる）。機能実装そのもの（route + migration + 保存先設計）は
本プランのスコープ外で、別途 correctness / feature プランとして起票する。

## Current state

- `src/components/store/layout/footer/newsletter.tsx:27-68` — フォームの実装:
  - `fetch('/api/newsletter', { method: 'POST', body: JSON.stringify({ email }) })`（`:41-46`）
  - `if (!response.ok) throw` → catch で `toast.error("Failed to subscribe.")`（`:48,56`）
  - AbortController による 8s タイムアウト（`:38-39` → タイムアウト時は
    `"Request timed out. Please try again."`）
  - リエントランシーガード `isSubmittingRef`（`:34-36` — tech.md の規約実装例）
  - 成功時のみ `form.reset()`（`:51` — **失敗時は入力値が残る**）
  - 入力欄: `<input id="newsletter-email" type="email" name="email" required ...>`（`:65` —
    sr-only ラベル "Email address"）。送信ボタン: `Sign up`（`:67`）
- `src/app/api/` 配下: `index-products` / `search-products` / `setUserCountryInCookies` /
  `webhooks` のみ。**newsletter route は不在**。`prisma/schema.prisma` にも購読者モデル無し。
- 監査時のスポット実測（2026-07-12）: `curl -X POST http://localhost:3000/api/newsletter`
  → **404**。
- フッターは MinimalHeader 系を除く全ストアフロントページに描画される。テストは
  `/browse` を使う（home は OI-9 の SSR 500 が未解消のため避ける）。
- 本テストは DB seed / 認証に依存しない。実行は
  `bash scripts/e2e/run-local.sh <spec> --project=chromium`（:3000 空き前提）。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| 前提確認（route 不在） | `ls src/app/api/` | `newsletter` ディレクトリが**無い** |
| 型チェック / Lint | `bunx tsc --noEmit` / `bun run lint` | exit 0 |
| 新 spec 単体（chromium） | `bash scripts/e2e/run-local.sh tests/e2e/newsletter.spec.ts --project=chromium` | all passed |
| 3 ブラウザ | `bash scripts/e2e/run-local.sh tests/e2e/newsletter.spec.ts` | all passed |

## Scope

**In scope**:
- `tests/e2e/newsletter.spec.ts`（新規）

**Out of scope**:
- `src/app/api/newsletter/` の新設（機能実装は別プラン — 本プランで route を作ると
  characterization の前提が崩れる）
- `prisma/schema.prisma`・migration（同上）
- `newsletter.tsx` の変更（エラーメッセージ改善等も含め一切しない）

## Git workflow

- Branch: `advisor/056-e2e-newsletter-characterization`
- コミット分割: spec 1 ファイルで 1 コミット
  1. `test(e2e): characterize newsletter dormant 404 behavior`
  2. ドキュメント同期は別コミット（Step 3）
- push / PR はオペレーター指示があるときのみ。

## Steps

### Step 1: newsletter.spec.ts を作成する

`tests/e2e/newsletter.spec.ts` を新規作成。**ファイル冒頭に characterization であることを
明記する docstring を必ず書く**:

```ts
/**
 * Characterization: Newsletter 購読フォームの現挙動を固定する。
 *
 * 2026-07-12 時点で `/api/newsletter` route はリポジトリに存在せず（schema にも
 * 購読者モデル無し）、全購読操作は 404 → "Failed to subscribe." トーストに終わる
 * （dormant 機能ギャップ — plans/audit/findings-17-e2e-coverage-r9.md TESTS-39）。
 *
 * このテストは「壊れた挙動」を意図的に固定している。route が実装されたら
 * このスイートは fail する — その時は成功系テストへ**書き直す**こと（skip で黙らせない）。
 */
```

テスト（ゲスト・seed 不要・`/browse` で実施）:

1. **購読の試行は 404 に終わり、失敗トーストが表示される** —
   - `/browse` へ goto → フッターまでスクロール
     （`page.locator("#newsletter-email").scrollIntoViewIfNeeded()`）
   - `page.locator("#newsletter-email")` に `e2e-newsletter@example.com` を fill
   - `waitForResponse` を**先に**仕掛けてから `Sign up` ボタンを click:

```ts
const responsePromise = page.waitForResponse(
    (r) => r.url().includes("/api/newsletter") && r.request().method() === "POST"
);
await page.getByRole("button", { name: "Sign up" }).click();
const response = await responsePromise;
expect(response.status()).toBe(404); // characterization: route 不在
await expect(page.getByText("Failed to subscribe.")).toBeVisible({ timeout: 10000 });
```

2. **失敗時は入力値が保持される（`form.reset()` は成功時のみ）** — テスト 1 の続きで
   `await expect(page.locator("#newsletter-email")).toHaveValue("e2e-newsletter@example.com")`。
   （テスト 1 と同一 `test()` 内の連続 assert としてよい）
3. **空メールでは送信されない（HTML5 required）** — 別テスト。入力欄を空のまま
   `Sign up` を click → `/api/newsletter` への POST が発生しないことを確認
   （`page.waitForResponse` の代わりに、click 後 1s 程度の
   `page.waitForTimeout` + リクエスト監視、または `page.on("request")` で収集した
   リクエストに newsletter POST が無いことを assert）。

注意:
- ボタンのアクセシブル名 `Sign up` はフッターの Newsletter 見出し
  「Sign up to Newsletter」と別要素。`getByRole("button", { name: "Sign up" })` で
  ボタンのみに解決されるが、strict mode violation が出たら
  `page.locator("form").getByRole("button", { name: "Sign up" })` にスコープする。
- toast（react-hot-toast）は自動消滅するため、click 直後に assert する。

**Verify**: `bunx tsc --noEmit` / `bun run lint` → exit 0

### Step 2: chromium → 3 ブラウザで green にする

**Verify**: `bash scripts/e2e/run-local.sh tests/e2e/newsletter.spec.ts --project=chromium`
→ 2 passed。続けて 3 ブラウザ → all passed

### Step 3: ドキュメント同期

テスト数が増えるため `spec-sync-after-test` skill を起動する
（`.claude/rules/02-tdd-step-commit.md` の MUST）。E2E 統計は
`docs/testing/QA_HANDOFF.md` が SSOT。あわせて QA_HANDOFF の Open Issues 節に
「Newsletter dormant 404（TESTS-39）— 機能実装待ち。characterization spec 有り」の
1 行が既に存在するか確認し、無ければ追記する（重複起票はしない）。

**Verify**: 同期コミットに QA_HANDOFF.md / coverage-dashboard.html が含まれる

## Test plan

- 新規: `tests/e2e/newsletter.spec.ts` に 2 テスト（404 + 失敗トースト + 入力保持 /
  required による送信抑止）。
- 構造の手本: `tests/e2e/layout-chrome.spec.ts`（ゲスト・seed 不要）。

## Done criteria

- [ ] `bunx tsc --noEmit` / `bun run lint` exit 0
- [ ] chromium で 2 passed、3 ブラウザで all passed
- [ ] spec 冒頭に characterization の docstring（route 実装時は書き直す旨）がある
- [ ] `src/app/api/newsletter/` が作られていない（`ls src/app/api/` で確認）
- [ ] `git status` で in-scope 外の変更なし
- [ ] `plans/README.md` の 056 行を DONE に更新

## STOP conditions

- `src/app/api/newsletter/` が既に存在する（機能が実装済み — characterization は無効。
  成功系テストへの書き直しを提案して報告）。
- POST のレスポンスが 404 以外（405 / 500 等）— characterization の前提が違う。実測値を
  記録して報告（テストの expect を実測に合わせて書き直すのは**報告後**）。
- toast が 10s 待っても出ない（AbortController のタイムアウト 8s と競合している可能性 —
  trace を添えて報告）。

## Maintenance notes

- **機能実装プラン（別途起票）への引き継ぎ事項**: route 新設 + 購読者の保存先
  （スキーマ migration or 外部 ESP 連携）+ 二重登録の扱い + 成功時 `form.reset()` の
  検証。実装されたら本 spec は fail する — skip にせず成功系へ書き直すこと。
- `newsletter.tsx` はリエントランシーガードの規約実装例として tech.md から参照されている。
  フォーム構造を変える変更はこの spec と tech.md の両方に波及する。
