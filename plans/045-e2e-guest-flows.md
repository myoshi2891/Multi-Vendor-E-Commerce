# Plan 045: ゲスト導線（compare / track-order / offers / 静的ページ）の E2E を追加する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6ad7b05..HEAD -- src/app/\(store\)/compare src/app/\(store\)/track-order src/app/\(store\)/offers src/components/store/compare src/components/store/track-order src/components/store/cards/product/product-card.tsx tests/e2e/seed/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW（認証不要・CLERK_SECRET_KEY 無し環境でも動く）
- **Depends on**: none（plan 042 と独立に並行着手可能）
- **Category**: tests
- **Planned at**: commit `6ad7b05`, 2026-07-11

## Why this matters

E2E 実測（`plans/audit/findings-16-e2e-coverage.md` TESTS-33）で、2026-06 に追加された
ゲスト向け機能ページ群（compare / track-order / offers / 静的ページ）の**機能導線**が
E2E ゼロであることを確認した（既存の `layout-chrome.spec.ts` はヘッダー/フッターの個数
検証のみ）。これらは認証不要のため、認証系 E2E が復旧途上（plan 042）でも安定して回る
価値がある。compare は Zustand ストア（`src/compare-store/`）の永続化を伴う顧客導線で、
カート永続化（purchase-flow）と同格の主要フロー。

## Current state

- **compare**: `src/app/(store)/compare/page.tsx` + `src/components/store/compare/compare-grid.tsx`。
  空状態の契約: `compare-grid.tsx:58` `<p data-testid="compare-empty">No products to compare yet. ...`。
  非空時は「Clear all」ボタン（`compare-grid.tsx:67`）+ 商品カードグリッド。
  追加トリガーは product-card のアクションボタン（**hover で出現するオーバーレイ内**）:

```tsx
// src/components/store/cards/product/product-card.tsx:103（オーバーレイは hover 時のみ表示）
<div className="absolute -left-px z-30 hidden ... group-hover:block">
// :119-135 アクションボタン群
<Button variant="black" size="icon"
    aria-label={isComparing ? "Remove from compare" : "Add to compare"}
    aria-pressed={isComparing}
    onClick={() => handleToggleCompare()}
```

  カード本体には `data-testid={`product-card-${slug}`}`（`product-card.tsx:70`）。
  compare は最大 4 件（`product-card.tsx:55` で `>= 4` を弾く）。
- **track-order**: `src/app/(store)/track-order/page.tsx`（h1 "Track your order"）+
  `src/components/store/track-order/track-order-form.tsx`。契約:
  - 入力: placeholder `注文番号` / `メールアドレス`（`track-order-form.tsx:79,94`）
  - 送信ボタン: `追跡する`
  - 不存在時: `注文が見つかりませんでした。`（`<output>` 要素）
  - 入力スキーマは `src/lib/schemas.ts:720-723` — orderId は `min(1)` のみ（形式制約なし）、
    email は `.email()`。**存在しない orderId でも形式エラーにならず null → not-found 表示**になる。
- **offers**: `src/app/(store)/offers/page.tsx` — `getAllOfferTags()` の一覧。タグ 0 件なら
  `現在ご紹介できるオファーはありません。`、1 件以上なら `/browse?offer=<url>` への
  リンクカード（`<h2>{tag.name}</h2>` + `{tag.products.length} 商品`）。
  **現状の E2E シード（`tests/e2e/seed/seed-e2e.ts`）は OfferTag を作らない**ため、
  決定的なテストにはシード拡張が必要（Step 1）。
- **静的ページ**: `src/app/(store)/` 配下に about / contact / customer-service / dispute /
  report-problem / faqs / legal 等。`layout-chrome.spec.ts:20` が /compare・/returns-exchange・
  /product-support のヘッダー/フッター数を検証済み — 本プランでは**未カバーのページの
  コンテンツ表示スモーク**のみ足す（重複させない）。
- **E2E の共通パターン**（このリポジトリの規約 — 必ず踏襲）:
  - seed 値は `buildE2ESeed({ parallelIndex, projectName })`（`tests/e2e/seed/constants.ts`）から
    取得する。slug 等はワーカー毎サフィックス付きなのでハードコードしない。
  - 各テスト冒頭で `setupE2ETestState(page, seed)`（`@/config/test-helpers`）を呼ぶ。
  - 構造の手本: `tests/e2e/purchase-flow.spec.ts`（goto → testid 操作 → expect）。
  - 実行は `bash scripts/e2e/run-local.sh <spec> --project=chromium`（:3000 空き前提）。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| seed 再投入 | `bun run seed:e2e` | `E2E seed completed` |
| 型チェック / Lint | `bunx tsc --noEmit` / `bun run lint` | exit 0 |
| 新 spec 単体（chromium） | `bash scripts/e2e/run-local.sh tests/e2e/guest-flows.spec.ts --project=chromium` | all passed |
| 3 ブラウザ | `bash scripts/e2e/run-local.sh tests/e2e/guest-flows.spec.ts` | all passed |
| 既存 spec の回帰確認 | `bash scripts/e2e/run-local.sh tests/e2e/search-filter.spec.ts tests/e2e/layout-chrome.spec.ts --project=chromium` | 既存分 passed |

## Scope

**In scope**:
- `tests/e2e/guest-flows.spec.ts`（新規）
- `tests/e2e/seed/seed-e2e.ts` — OfferTag 1 件の upsert 追加のみ
- `tests/e2e/seed/constants.ts` — OfferTag 定数（name/url）の追加のみ

**Out of scope**:
- `src/` 配下すべて（UI にセレクタが不足していても src を変更しない — STOP して報告）
- `tests/e2e/layout-chrome.spec.ts`（既存のヘッダー/フッター検証と重複させない）
- ウィッシュリスト・フォロー等の認証系導線（plan 048 の担当）

## Git workflow

- Branch: `advisor/045-e2e-guest-flows`
- コミット分割（`.claude/rules/02-tdd-step-commit.md` 準拠）:
  1. `test(e2e): add offer tag to e2e seed`
  2. `test(e2e): add guest-flows spec (compare / track-order / offers / static pages)`
  3. ドキュメント同期は別コミット（Step 5）
- push / PR はオペレーター指示があるときのみ。

## Steps

### Step 1: E2E シードに OfferTag を 1 件追加する

1. `tests/e2e/seed/constants.ts` の `BASE_E2E_SEED` に追加（既存エントリの形式に合わせる。
   `withSuffix` の適用有無は `category` の扱いと同じにする — 既存コードを読んで一致させる）:

```typescript
offerTag: {
    name: "E2E Offer",
    url: "e2e-offer",
},
```

2. `tests/e2e/seed/seed-e2e.ts` の productB upsert（351 行目付近）の後に、既存 upsert 群と
   同じパターンで OfferTag を upsert し、`productB` に接続する:

```typescript
const offerTag = await prisma.offerTag.upsert({
    where: { url: seed.offerTag.url },
    update: { name: seed.offerTag.name },
    create: { name: seed.offerTag.name, url: seed.offerTag.url },
});
await prisma.product.update({
    where: { id: productB.id },
    data: { offerTagId: offerTag.id },
});
```

※ `OfferTag` のフィールド名・unique キーは `prisma/schema.prisma` の `model OfferTag` を
開いて確認し、上記が実スキーマと違う場合はスキーマに合わせる（`url` が unique である
ことを前提にしている）。

**Verify**: `bun run seed:e2e` → exit 0（2 回連続実行して冪等であることも確認）。
`bunx tsc --noEmit` → exit 0

### Step 2: guest-flows.spec.ts を作成する

`tests/e2e/guest-flows.spec.ts` を新規作成。`purchase-flow.spec.ts` と同じ
beforeEach 構造（`buildE2ESeed` + `setupE2ETestState`）で、以下のテストを書く:

1. **compare: 空状態表示** — `/compare` へ goto →
   `expect(page.getByTestId("compare-empty")).toBeVisible()`
2. **compare: 追加 → 比較表示 → クリア** —
   - `/browse` へ goto → 対象カードを `data-testid` で**先に掴んでから** hover する
     （アクションボタンは hover オーバーレイ内のため hover は必須）
   - **`Add to compare` は必ずカード locator 配下にスコープする**:

```typescript
const card = page.getByTestId(`product-card-${seed.product.slug}`);
await card.hover();
// page.getByRole(...) ではなく card.getByRole(...)。/browse には複数の商品カードが
// 並び、各カードが同名のアクションボタンを持つため、page スコープだと
// strict mode violation になるか、別商品のボタンを押してしまう。
await card.getByRole("button", { name: "Add to compare" }).click();
```

   - toast（`Added to compare` 系）または対象カードの `aria-pressed="true"` を確認
     （`aria-pressed` を見る場合も `card.getByRole(...)` 配下で確認すること）
   - `/compare` へ goto → 商品名（`seed.product.name`）が表示される
   - `Clear all` click → `compare-empty` が再表示される
3. **track-order: 不存在注文で not-found メッセージ** — `/track-order` へ goto →
   placeholder `注文番号` に `nonexistent-order-id`、`メールアドレス` に
   `guest-e2e@example.com` を入力 → `追跡する` click →
   `expect(page.getByText("注文が見つかりませんでした。")).toBeVisible()`
4. **track-order: 不正メールでバリデーションエラー** — email に `not-an-email` →
   `追跡する` → `有効なメールアドレスを入力してください。` が表示される
5. **offers: シードのオファーが表示され /browse へ誘導する** — `/offers` へ goto →
   **シード値から**オファー名・URL を参照する（`E2E Offer` / `e2e-offer` を
   テスト内にハードコードしない。seed 定義が変わったとき、テストが
   「実装のバグ」ではなく「文言の食い違い」で落ちるのを防ぐ）:

```typescript
await page.getByRole("heading", { name: seed.offerTag.name }).click();
// URL も seed 値から組み立てる。正規表現メタ文字を含む可能性に備えて必ずエスケープする
const offerUrlPattern = new RegExp(
    `/browse\\?offer=${seed.offerTag.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`
);
await page.waitForURL(offerUrlPattern);
```
6. **静的ページのコンテンツスモーク** — `/about`・`/contact`・`/customer-service` の各ページで
   **HTTP ステータス 200** を assert した上で、`page.getByRole("main")` 内に見出しが
   visible であることを for ループで確認する:

```typescript
for (const path of ["/about", "/contact", "/customer-service"]) {
    const response = await page.goto(path);
    // 目的は 404 / 空白ページの検出。見出しの存在だけでは達成できない（下記参照）
    expect(response?.status(), `${path} should return 200`).toBe(200);
    await expect(page.getByRole("main").getByRole("heading").first()).toBeVisible();
}
```

   > **なぜ status の assert が必要か**: 「404 の検出が目的」と書きながら見出しの
   > visible だけを見ると、目的を達成できない。Next.js の `not-found` ページにも
   > `main` と `heading` があるため、**ページが 404 でもこのテストは green になる**。
   > `response.status() === 200` を assert して初めて「ページが存在する」ことを言える。
   > ステータスを取れない事情がある場合は、代わりに**各ページ固有のテキスト**
   > （実装から採取した見出し文言など）を assert すること — どちらか一方は必須で、
   > 「main に heading がある」だけで済ませない。

注意:
- compare の追加操作（テスト 2）でカードの hover オーバーレイが開かない場合、viewport が
  モバイル幅でないこと（デフォルトの Desktop projects なら問題ない）を確認する。
- **アクションボタンの取得は必ずカード locator 配下**（`card.getByRole(...)`）。
  `/browse` は複数カードを描画するため、`page.getByRole("button", { name: "Add to compare" })`
  は strict mode violation を起こすか、意図しない商品を compare に入れる。
- **seed 由来の値（オファー名 / URL / 商品 slug）をテストへ literal で埋め込まない**。
  `tests/e2e/seed/` の定義を単一の出所とし、正規表現に埋める際はメタ文字を
  エスケープすること。
- toast 文言は `product-card.tsx:52` の `toast("Removed from compare")` と対になる追加時
  文言を実装から確認して合わせる（推測で書かない）。

**Verify**: `bunx tsc --noEmit` / `bun run lint` → exit 0

### Step 3: chromium で新 spec を green にする

**Verify**: `bash scripts/e2e/run-local.sh tests/e2e/guest-flows.spec.ts --project=chromium`
→ 6 passed

### Step 4: 3 ブラウザで確認する

**Verify**: `bash scripts/e2e/run-local.sh tests/e2e/guest-flows.spec.ts` → 18 passed
（firefox 固有のハング等が出た場合のみ、purchase-flow の前例
`test.skip(testInfo.project.name === "firefox" && !process.env.CI, ...)` に合わせた
ローカルゲートを検討し、その判断をコミットメッセージに記録する）

### Step 5: ドキュメント同期

テスト数が増えるため `spec-sync-after-test` skill を起動する
（`.claude/rules/02-tdd-step-commit.md` の MUST）。E2E 統計は
`docs/testing/QA_HANDOFF.md` が SSOT。

**Verify**: 同期コミットに QA_HANDOFF.md / coverage-dashboard.html が含まれる

## Test plan

- 新規: `tests/e2e/guest-flows.spec.ts` に 6 テスト（compare 2 / track-order 2 / offers 1 /
  静的スモーク 1）。
- 構造の手本: `tests/e2e/purchase-flow.spec.ts`。
- 回帰: search-filter / layout-chrome が引き続き passed（シード拡張の副作用が無いこと）。

## Done criteria

- [ ] `bunx tsc --noEmit` / `bun run lint` exit 0
- [ ] `bun run seed:e2e` が 2 回連続 exit 0（冪等）
- [ ] テスト 2 の `Add to compare` 取得が**カード locator 配下**にスコープされている
      （`page.getByRole("button", { name: "Add to compare" })` の page 直下呼び出しが無いこと）
- [ ] テスト 5 のオファー名 / URL が `seed.offerTag.*` 由来で、literal（`E2E Offer` /
      `e2e-offer`）をテストに埋め込んでいない
- [ ] テスト 6 が `response.status() === 200`（または各ページ固有テキスト）を assert して
      いる — 見出しの visible だけでは 404 ページでも green になり、目的を達成できない
- [ ] chromium で 6 passed、3 ブラウザで 18 passed（正当なローカルゲート skip を除く）
- [ ] `bash scripts/e2e/run-local.sh tests/e2e/search-filter.spec.ts --project=chromium` 既存分 passed
- [ ] `git status` で in-scope 外の変更なし
- [ ] `plans/README.md` の 045 行を DONE に更新

## STOP conditions

- `prisma/schema.prisma` の `OfferTag` に `url` unique が無い等、Step 1 の前提が崩れる。
- compare のカード hover オーバーレイが Playwright の `hover()` で出現しない
  （CSS 構造変更の可能性 — 実 DOM を error-context で確認して報告）。
- 追加が必要なセレクタ（testid）が UI 側に無く、`src/` の変更なしにテスト不能と判明した
  （どの要素にどの testid が必要かを列挙して報告）。
- シード拡張が既存 spec（search-filter の件数系 assert 等）を fail させた。

## Maintenance notes

- **plan 046 も `tests/e2e/seed/` を拡張する**（ページネーション用の商品追加）。両プランを
  同時期に実行する場合は 046 側が本プランの diff を先に取り込むこと（コンフリクト源は
  constants.ts / seed-e2e.ts の末尾追加部分）。
- compare の上限（4 件）境界テストは今回スコープ外として意図的に省いた（UI の toast
  文言契約が薄く、フレーク源になりやすい）。追加するなら toast ではなく
  `aria-pressed` の状態で assert すること。
