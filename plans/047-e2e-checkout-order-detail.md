# Plan 047: チェックアウト異常系（住所未選択）を un-skip し、注文詳細ページの金額明細検証を追加する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6ad7b05..HEAD -- tests/e2e/payment-error.spec.ts tests/e2e/platform-coupon.spec.ts tests/e2e/helpers/auth.ts src/components/store/cards/place-order.tsx src/components/store/order-page/ src/components/store/cards/order/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1（§20 P0「複数店舗購入 → 分割注文 / **請求** / 在庫更新」の請求側を固定する）
- **Effort**: M
- **Risk**: MED（金額表示のセレクタ契約が薄い — 構造 assert + 算術不変条件で吸収する）
- **Depends on**: `plans/042-e2e-signin-helper-repair.md`（認証セッションが機能することが前提）
- **Category**: tests
- **Planned at**: commit `6ad7b05`, 2026-07-11

## Why this matters

(1) `tests/e2e/payment-error.spec.ts:29` の「住所未選択で注文ボタン → エラーメッセージ」は
「Clerk 認証セッションが必要」という **`createCustomerSession()` ヘルパー登場前の理由**で
skip されたまま（期限 2026-04-30 超過）。今は同等セットアップが `a11y/checkout.spec.ts` で
稼働しており、解消可能。チェックアウトの入力検証（購入不能系）を E2E で固定する。

(2) 注文詳細ページ（`/order/[orderId]`）は `platform-coupon.spec.ts:162` が
「`Order Id:` が 2 件（OrderGroup 分割）」までしか検証しておらず、**顧客が見る請求金額**
（グループ毎の Subtotal / Shipping Fees / Total・全体合計・クーポン割引額）は未固定。
Integration テストは DB 値を固定するが、表示値との一致は E2E でしか検証できない
（`plans/audit/findings-16-e2e-coverage.md` TESTS-30 / TESTS-31）。

## Current state

- **住所未選択エラーの実装**（アサート対象の文言）:

```typescript
// src/components/store/cards/place-order.tsx:33
toast.error('Select a shipping address before placing your order.')
```

- **skip 中のテスト**: `tests/e2e/payment-error.spec.ts:29-51` — テスト本文（商品→サイズ選択→
  カート→ /checkout → Place Order → エラー確認）は既に書かれており、
  **認証セッションのセットアップだけが欠けている**。現在は describe 全体が
  `setupClerkTestingToken` のみで `createCustomerSession` を使っていない。
- **認証セットアップの手本**（このパターンをそのまま移植する）:

```typescript
// tests/e2e/a11y/checkout.spec.ts:22-51（要点）
test.skip(() => requiresClerkAdmin, "Requires CLERK_SECRET_KEY for Clerk admin operations.");
const session = createCustomerSession();
test.beforeAll(async () => { await session.create({ role: "USER" }); });
test.afterAll(async () => { await session.cleanup(); });
// 各テスト内: await session.signIn(page); → setupE2ETestState(page, seed); → 商品→カート→ /cart → checkout click
```

  ※ `/checkout` は DB Cart が空だと `/cart` にリダイレクトするため、**直接 goto では
  到達できない**。`/cart` で `getByTestId("checkout")` を押して `saveUserCart` を発火させる
  （`a11y/checkout.spec.ts:67-73` のコメントに理由が明記されている）。
- **注文詳細ページの構成**（`src/app/(fullscreen)/order/[orderId]/page.tsx:1-8`）:
  `OrderHeader` / `OrderUserDetailsCard` / `OrderInfoCard` / **`OrderTotalDetailsCard`** /
  `OrderGroupsContainer`（グループ毎に **`group-table.tsx`**）/ `OrderPayment`（Stripe/PayPal）。
- **グループ毎の金額表示**（アサート対象）:

```tsx
// src/components/store/order-page/group-table.tsx:100-127（抜粋）
Subtotal:   ${subTotal.toNumber().toFixed(2)}
Shipping Fees: ${shippingFees.toNumber().toFixed(2)}
Coupon ({coupon.code}) (-${discountedAmount.toFixed(2)})   // クーポン適用時のみ
Total price:   ${total.toNumber().toFixed(2)}
```

- **全体合計カード**（アサート対象）:

```tsx
// src/components/store/cards/order/total.tsx:17-38（抜粋）
Subtotal ${subTotal.toFixed(2)} / Shipping Fee +${shippingFees.toFixed(2)} / Total ${total.toFixed(2)}
```

- **到達フローの手本**: `tests/e2e/platform-coupon.spec.ts:106-168` — 2 店舗の商品を
  カート投入 → クーポン適用 → `Place order` → `/order/` 到達 → `Order Id:` ×2 と
  `Coupon (<code>)` ×2 を確認済み。**本プランはこの spec に金額 assert を追記する**。
- E2E 実行の前提: `CLERK_SECRET_KEY` 必須（無いと skip）。:3000 空き。`workers: 1`。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| 型 / Lint | `bunx tsc --noEmit` / `bun run lint` | exit 0 |
| payment-error（chromium） | `bash scripts/e2e/run-local.sh tests/e2e/payment-error.spec.ts --project=chromium` | 2 passed / 2 skipped（:58 :70 は据え置き） |
| platform-coupon（chromium） | `bash scripts/e2e/run-local.sh tests/e2e/platform-coupon.spec.ts --project=chromium` | 1 passed |
| 3 ブラウザ | `bash scripts/e2e/run-local.sh tests/e2e/payment-error.spec.ts tests/e2e/platform-coupon.spec.ts` | all passed（据え置き skip 除く） |

## Scope

**In scope — テスト（コミット 1〜2）**:
- `tests/e2e/payment-error.spec.ts` — `:29` テストの un-skip + 認証セットアップ追加のみ
- `tests/e2e/platform-coupon.spec.ts` — 既存テストへの金額 assert 追記のみ

**In scope — ドキュメント同期（後続の別コミット）**:
- `spec-sync-after-test` の成果物一式 — **un-skip により E2E の passed / skipped 件数が
  変動する**ため、`.claude/rules/02-tdd-step-commit.md` の MUST に従い同期する。
  SSOT は `docs/testing/QA_HANDOFF.md`、伝播先は
  `specs/multi-vendor-ecommerce/07-testing.md` / `docs/testing/COVERAGE_REPORT.md` /
  `docs/PROGRESS.md` + `bun run coverage:dashboard` 再生成の `docs/coverage-dashboard.html`。
- `plans/README.md` の 047 行を DONE に更新。**テストとは別コミット**。

**Out of scope**:
- `payment-error.spec.ts:58`（在庫切れ表示 — 機能未実装）/ `:70`（二重送信 — plan 006 依存）は
  **skip のまま触らない**（findings-16 Deferred 節）。
- `src/` 配下（金額表示に testid が無くても、下記のテキストベース戦略で検証する。
  それで不足なら STOP）。
- Stripe / PayPal の実決済操作（`OrderPayment` はコンポーネントの存在確認まで）。

## Git workflow

- Branch: `advisor/047-e2e-checkout-order-detail`
- コミット分割: (1) `test(e2e): enable address-required checkout error spec`
  (2) `test(e2e): assert order detail amount breakdown in platform-coupon spec`
  (3) ドキュメント同期
- push / PR はオペレーター指示があるときのみ。

## Steps

### Step 1: payment-error に認証セッションを導入し :29 を un-skip する

`tests/e2e/payment-error.spec.ts` で:

1. import に `createCustomerSession, requiresClerkAdmin`（`./helpers/auth`）を追加。
2. describe 内に a11y/checkout と同じ `session` セットアップ（beforeAll create /
   afterAll cleanup / `requiresClerkAdmin` の describe-level skip）を追加。
   ※ 既存の「未認証でチェックアウト → sign-in リダイレクト」テスト（`:17`）は
   **サインインしない前提**なので、`session.signIn` は :29 のテスト内でのみ呼ぶこと。
3. `:29` の `test.skip(` を `test(` に変更し、テスト冒頭に
   `await session.signIn(page);` と `test.setTimeout(90000);` を追加（サインイン + 本番
   ビルドのナビゲーションを含むため。値は `a11y/checkout.spec.ts:45` の前例に合わせる）。
4. `/checkout` への到達を「直接 goto」から「`/cart` → `getByTestId("checkout")` クリック」
   方式に直す（Current state の DB Cart 同期の制約。既存本文の `await page.goto("/checkout")`
   を置き換える）。
5. 期待メッセージは実装文言に合わせる:
   `await expect(page.getByText(/Select a shipping address/i)).toBeVisible({ timeout: 5000 })`
   （`place-order.tsx:33` と一致することを確認済み）。
   ※ このテストのシード顧客は住所未登録のため「住所未選択」状態が既定で成立する。
   万一デフォルト住所が自動生成されて Place order が成功してしまう場合は STOP。

**Verify**: `bash scripts/e2e/run-local.sh tests/e2e/payment-error.spec.ts --project=chromium`
→ 2 passed / 2 skipped

### Step 2: platform-coupon spec に金額明細 assert を追記する

`tests/e2e/platform-coupon.spec.ts` の既存テスト末尾（`Coupon (${...})` ×2 の確認の後）に
追加する。**表示金額のハードコードはしない**。検証の経路は 2 つあり、
**経路ごとに使うべき算術が違う**ので取り違えないこと:

| 経路 | 何をするか | 使う算術 |
|---|---|---|
| **A: 期待値を seed から導出** | seed の価格・配送料・割引率から期待金額を**計算**し、表示と突き合わせる | **`Prisma.Decimal`**（下記） |
| **B: DOM の算術不変条件**（推奨・以下の実装） | 表示された値どうしの関係（`subtotal + shipping - discount === total` 等）を検証する | **セント整数**（下記） |

> **経路 A を採る場合は `Prisma.Decimal` で計算すること。** これは表示文字列の話ではなく
> **サーバー側と同じ金額演算**であり、`.claude/steering/tech.md` の規約がそのまま適用される:
> 金額は `Decimal(12,2)`、演算は `.add()` / `.mul()` / `.sub()` 等の `Prisma.Decimal` メソッド、
> **中間集計で `.toNumber()` して `number` 同士で加算するのは禁止**（各ステップで IEEE 754 の
> 丸め誤差が蓄積するため）、`.toNumber()` は**最後の比較境界でのみ**呼ぶ。
> 割引率の乗算と配送料の加算を挟む本ケースは、まさに誤差が蓄積する形なので `number` で
> 積み上げないこと。配送料は必ず `src/lib/shipping-utils.ts` の `computeShippingTotal` を
> 使う（計算ロジックの一元管理）。
>
> **経路 B のセント整数は規約違反ではない —— 規約の適用範囲の外側にある。**
> `.claude/steering/tech.md` の金額規約（`Decimal(12,2)` 必須 / 演算は `Prisma.Decimal`
> メソッド / 中間集計での `.toNumber()` 禁止）が縛るのは、**`Decimal` 列に対するサーバー側の
> 金額演算**である。規約が防ごうとしているのは「DB の正確な 10 進値を `number` に落として
> 積み上げ、丸め誤差を蓄積させること」であり、その誤差はサーバー側の集計でしか生まれない。
>
> 経路 B が触るのは DOM に届いた**表示文字列**で、これは既にサーバーで丸め済みの終端値である
> （`src/components/store/cards/order/total.tsx:29` /
> `src/components/store/order-page/group-table.tsx` はいずれも `.toFixed(2)` で描画。
> 桁区切りカンマは入らず常に `$X.XX` 形式）。**失われた精度は `Decimal` を被せても戻らない**ため、
> ここで `Prisma.Decimal` を使っても厳密性は 1 ビットも増えず、依存だけが増える。
> 小数第 2 位までと決まった文字列は、**パース時に 1 度だけ丸めてセント整数化**すれば
> 以降の加減算が厳密（整数演算）になる。これが下記の実装である。
>
> **境界の要約**: `Decimal` 列の値を計算する → 規約適用（経路 A）。
> 丸め済みの表示文字列どうしの関係を検算する → 規約対象外・セント整数（経路 B）。
> 経路 A で `number` に落として積み上げることは、E2E であっても禁止のままである。

推奨実装（経路 B）:

```typescript
// グループ毎の金額行が両 OrderGroup に揃っていること（構造検証）
await expect(page.getByText("Subtotal:", { exact: false })).toHaveCount(2);
await expect(page.getByText("Shipping Fees:", { exact: false })).toHaveCount(2);
await expect(page.getByText("Total price:", { exact: false })).toHaveCount(2);

// 金額は **セント整数** に正規化してから検算する（Number の小数演算をしない）。
// 表示は $X.XX 固定なので、1 回だけ丸めて整数化すれば以降の加減算は誤差ゼロになる。
const parseMoneyToCents = (text: string): number => {
    // 通貨トークン（`$X.XX`）を取る。行内の別の数値（"2 items" の点数等）を先に拾わないよう
    // `$` にアンカーする。表示は常に小数 2 桁なので `[0-9]{2}` で固定。
    //
    // トークンの**末尾もアンカーする**こと。両端を留めないと、桁が想定と違ったときに
    // 例外ではなく「静かに間違った値」を返し、検算式が偽の緑になる:
    //   - `$12.345`    → 末尾アンカー無しだと `12.34`（3 桁目を切り落とす）
    //   - `$12.34.56`  → 数字だけを拒否する境界だと `12.34`（後続の小数部を落とす）
    //   - `$12.34abc`  → 同上。数値でない後続を素通しして値だけ返す
    //   - `$1,234.56`  → 桁区切りを想定していないと `234.56`（上位桁を落とす）
    // 境界は `(?![\w.,])` とする。`\w`（数字・英字・`_`）と `.` `,` の続きを拒否し、
    // 空白・`)`・文字列末尾は許容するので、`Total: $12.34 USD` や
    // `Subtotal $12.34 (2 items)` のような実 locator テキストでも取りこぼさない。
    const matched = text.match(/\$\s*([0-9]+(?:,[0-9]{3})*\.[0-9]{2})(?![\w.,])/);
    if (!matched) throw new Error(`金額を抽出できません: ${text}`);
    return Math.round(Number(matched[1].replace(/,/g, "")) * 100); // 丸めはここ 1 回だけ
};
```

> **境界を `(?![0-9])` にしないこと（2026-07-27 修正）。** 以前の版は `(?![0-9])` を
> 「末尾アンカー」と説明していたが、これは**数字の続きしか拒否しない**。上のコメントが
> 防ぐと謳っている「静かに間違った値を返す」ケースがそのまま残っていた。実測:
>
> | 入力 | `(?![0-9])` | `(?![\w.,])` |
> |---|---|---|
> | `$12.345` | throw | throw |
> | `$12.34.56` | **`1234` を返す** | throw |
> | `$12.34abc` | **`1234` を返す** | throw |
> | `Total: $12.34 USD` | `1234` | `1234` |
> | `Subtotal $12.34 (2 items)` | `1234` | `1234` |
>
> 末尾を `\s*$`（文字列末端）で留める案は却下した。上表の下 2 行のように
> 通貨単位や件数が後ろに付く実 locator テキストで false-fail するため
> （実測で両方 throw になることを確認済み）。`\w` と `.` `,` の続きだけを拒否する
> `(?![\w.,])` が、異常書式の fail-fast と実テキストの許容を両立する。

```ts

// 算術不変条件: 各グループで subtotal + shipping - discount === total（**完全一致**）
// … locator で各グループの 4 行を取得し、各行を parseMoneyToCents で整数化してから
// expect(subtotalCents + shippingCents - discountCents).toBe(totalCents) を両グループで確認

// 全体合計カード（cards/order/total.tsx）:
// Total(全体) === 各グループ Total の合計（セント整数で **完全一致**）
```

> **なぜセント整数か**: `Number(...)` のまま `subtotal + shipping - discount - total` を
> 計算して `< 0.02` で許容するのは、`.claude/steering/tech.md` の金額演算規約
> （`Float` 禁止 / 中間集計で `.toNumber()` して `number` 加算するのは禁止 /
> `toNumber()` は境界のみ）と正面から矛盾する。許容誤差 ±0.01〜0.02 は
> **誤差を隠すと同時に、1 セントの実バグも見逃す**（例: 割引の丸め方向の誤りは
> ちょうど 0.01 ずれる）。表示値は小数第 2 位までと決まっているので、パース時に
> 1 度だけ丸めて整数化すれば、以降の加減算は厳密になり **`toBe` で完全一致**を
> 主張できる。許容誤差そのものが不要になる。
>
> 上記正規表現が安全である根拠も実装で確認済み: 金額描画は
> `total.tsx` / `group-table.tsx` / `pdf-invoice.tsx` いずれも `.toFixed(2)` であり、
> `toLocaleString` / `Intl.NumberFormat` は使われていない。したがって現状は
> `$1234.56` 形式だが、**パーサは桁区切りカンマを先回りして許容している**
> （`(?:,[0-9]{3})*` で受け、`.replace(/,/g, "")` で除去する）。`$1,234.56` に
> 書式が変わってもこのパーサは正しく `123456` を返す。
>
> **それでも書式変更時に見直すべき点**（カンマ以外はカバーしていない）:
>
> - **通貨記号の位置・種類**: 正規表現は `$` に前方アンカーしている。`USD 1,234.56` や
>   `1.234,56 €`（記号が後置／小数点がカンマ）になると `!matched` で例外を投げる。
>   これは**静かに壊れない**（意図的に fail fast）が、テストは赤くなる。
> - **負値の表現**: 割引行が `-$12.00` ではなく `($12.00)` 形式になると、
>   符号を落として絶対値を返す。検算式 `subtotal + shipping - discount === total` が
>   通ってしまう可能性があるため、負値書式を導入する際は符号の扱いを明示的に足すこと。
> - **小数桁数**: `[0-9]{2}` に固定しているため、3 桁通貨（例: KWD）や 0 桁通貨（例: JPY）を
>   導入すると全件で例外になる。多通貨対応は現フェーズのスコープ外
>   （`.claude/steering/product.md`「スコープ外」）だが、着手時はここが最初に壊れる。

実装の細部（locator の切り方）は executor に委ねるが、**検証内容は上記 3 点**
（構造 2 グループ分・グループ内検算・全体合計との一致）を必ず含めること。
加えて **支払い領域（`OrderPayment`）の存在**を 1 assert 確認する — 実決済操作はしない。

> **支払い領域のセレクタは決済プロバイダ非依存にすること**。`OrderPayment` は
> Stripe と PayPal の**両方**を収容するコンテナ（Current state `:66` 参照）であり、
> Stripe 固有の要素（`.StripeElement` / iframe 等）を掴むと、
> (a) PayPal のみ表示される構成や既定プロバイダの変更で落ちる、
> (b) Stripe.js の遅延ロードに依存してフレークする。
> **汎用コンテナ**（`OrderPayment` の描画するランドマーク / 見出しテキスト、
> または実装に `data-testid` があればそれ）を 1 つ選んで存在確認に留め、
> 「どのプロバイダが載っているか」は本プランの検証対象にしない。
> 適切なアンカーが実装に無い場合は STOP して報告すること（`src/` の変更は Out of scope）。

**Verify**: `bash scripts/e2e/run-local.sh tests/e2e/platform-coupon.spec.ts --project=chromium`
→ 1 passed

### Step 3: 3 ブラウザ確認

**Verify**: `bash scripts/e2e/run-local.sh tests/e2e/payment-error.spec.ts tests/e2e/platform-coupon.spec.ts`
→ payment-error 6 passed / 6 skipped、platform-coupon 3 passed

### Step 4: ドキュメント同期

skip 数（-3: :29 ×3 ブラウザ）とテスト内容が変わるため `spec-sync-after-test` skill を起動。
`payment-error.spec.ts:24-28` の TODO コメント（アンブロック条件・期限）は un-skip と同時に
削除する。

**Verify**: 同期コミットに QA_HANDOFF.md / coverage-dashboard.html が含まれる

## Test plan

- un-skip: 住所未選択エラー（3 ブラウザで +3 実行）。
- 追記 assert: 金額明細の構造 ×2 グループ / グループ内検算（セント整数・完全一致） /
  全体合計一致（同上） / 支払い領域存在（プロバイダ非依存セレクタ）。
- 回帰: platform-coupon の既存 assert（Order Id ×2 / Coupon ×2）が引き続き green。

## Done criteria

- [ ] `bunx tsc --noEmit` / `bun run lint` exit 0
- [ ] payment-error: 3 ブラウザで 6 passed / 6 skipped（:58 :70 のみ skip 残存）
- [ ] platform-coupon: 3 ブラウザで 3 passed（金額 assert 込み）
- [ ] `grep -n "test.skip" tests/e2e/payment-error.spec.ts` の結果が :58 :70 相当の 2 件のみ
- [ ] 金額検算が**セント整数**で行われ `toBe` による完全一致を主張している
      （`Math.abs(...) < 0.0x` のような許容誤差付き浮動小数点比較が無いこと。
      tech.md の金額演算規約と整合させるため）
- [ ] 支払い領域の assert が**決済プロバイダ非依存**のセレクタである
      （`.StripeElement` 等 Stripe 固有要素に依存していないこと）
- [ ] docs 同期（QA_HANDOFF 統計 + ダッシュボード再生成）が**別コミット**で完了
      — un-skip により E2E の passed/skipped 件数が変動するため
- [ ] **コードコミットの直前**で、`git status` に in-scope 外の変更がない（プラン index の更新と `spec-sync-after-test` の docs 同期は、後続の別コミット）
- [ ] `plans/README.md` の 047 行を DONE に更新

## STOP conditions

- plan 042 が未完了（signIn が壊れたまま）— 本プランの前提を欠く。
- Step 1 で Place order が成功してしまう（シード顧客に住所が存在する — シード設計の
  確認が必要）。
- 金額行のテキスト抽出が DOM 構造上不可能（`Subtotal:` 行が想定の要素構成でない）で、
  `src/` への testid 追加なしに検証できない — 必要な testid の一覧を添えて STOP
  （src 変更の可否はオペレーター判断）。
- グループ内検算（`subtotalCents + shippingCents - discountCents === totalCents`）が
  **不一致**（許容誤差は持たない契約なので、1 セントのズレでも該当する）。
  表示値は小数第 2 位までに丸め済みで、セント整数化後の加減算は厳密なはずのため、
  **不一致はテストの問題ではなくアプリ側の丸め・計算のバグの可能性が高い**。
  期待値・実測値の両方を添えて報告する（**閾値を緩めて green にしないこと** —
  1 セントのズレこそが検出したい対象。例: 割引の丸め方向の誤りはちょうど 0.01 ずれる）。

## Maintenance notes

- 金額はセント整数で検算しているため許容誤差を持たない。UI の表示桁数が小数第 2 位から
  変わった場合（多通貨対応など）は `parseMoneyToCents` の丸め前提を見直すこと。
- 金額検証は「表示値の検算」方式のため、将来 UI が金額行の文言（`Subtotal:` 等）を変えると
  fail する。文言変更時はこの spec の追随が必要（意図的な契約）。
- `group-table.tsx:28` の `discountedAmount` は `.toNumber()` 後に number 演算しており、
  steering の Decimal 規約（return 境界まで Prisma.Decimal）とのズレがある。ただし
  **本 spec の検算はこのズレの影響を受けない** — 表示値は小数第 2 位までに丸め済みで、
  それをセント整数へ正規化してから加減算するため、比較は `toBe` の完全一致で成立する
  （許容誤差は持たない。Step 2 の契約を参照）。
  アプリ側を Decimal 演算に直す改善は本プランのスコープ外として意図的に見送った。
- :58（在庫切れ）と :70（二重送信）の skip は機能実装（後者は plan 006）が入り次第、
  同じ認証セットアップを流用して解消できる。
