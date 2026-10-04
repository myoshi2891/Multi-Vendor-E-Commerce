# 077: Server Action の userCountry cookie 読み取りを Next 16 の async cookies() へ移行

## Context

`/checkout` で `updateCheckoutProductWithLatest` が 500 になり、画面に「We couldn't refresh checkout details」が出る。

- 根本原因: `src/queries/user.ts` が `cookies-next@4.3.0` の同期 `getCookie("userCountry", { cookies })` を使っている。cookies-next は内部で `cookies().getAll()` を同期で呼ぶ。Next 16 では、`cookies()` が返す Promise の `getAll` プロパティは警告を出して `undefined` を返すだけ（`node_modules/next/dist/server/request/cookies.js:195-201`）。そのため cookie は**常に undefined** になる。
- `src/proxy.ts` がすべてのリクエストで `userCountry` cookie を付けているので、cookie 自体は存在する。読めていないだけ。
- 影響範囲は同じパターンの 3 箇所:
  1. `saveUserCart`（user.ts:368 付近）: 国が `null` のまま送料計算に進み、送料が誤って 0 になりうる（**サイレントな金額誤り**）
  2. `updateCartWithLatest`（user.ts:1169 付近）: `if (countryCookie)` が常に偽になり、配送詳細が初期値（送料 0）のまま
  3. `updateCheckoutProductWithLatest`（user.ts:1363 付近）: 住所 0 件だと `"Couldn't retrieve country data."` で throw → 今回の 500
- 既存のユニットテストは `cookies-next` の `getCookie` 自体をモックしていた。このため、ライブラリと Next 16 の組み合わせで起きる不具合を検出できなかった。

ゴール: 3 箇所とも `await cookies()` で cookie を正しく読み、テストのモック対象を `next/headers` に移して同種の回帰を検出できるようにする。

## 方針（最小差分）

`src/app/(store)/checkout/page.tsx` で既に使っている、正しい書き方に揃える:

```ts
const cookieStore = await cookies();
const countryCookie = cookieStore.get("userCountry")?.value;
```

- 3 箇所とも、cookie の読み取りを **`Promise.all(map(...))` の外へ出して 1 回だけ**行う（ループ内で毎回 `getCookie` していた冗長も解消）。以降のロジック（`parseUserCountryCookie`、`address` 優先、null のときの throw / スキップ）は**変更しない**。
- `user.ts` の `import { getCookie } from "cookies-next";` を削除する。
- `cookies-next` の依存は残す。`src/components/store/product-page/container.tsx` のクライアント側 `setCookie` は document.cookie 経由で正しく動くため。依存の追加・更新は行わない。
- 再利用: `parseUserCountryCookie`（`src/lib/utils.ts`）、`cookies`（`next/headers`、import 済み）。新しいヘルパーは作らない。

## 変更ファイル

| ファイル | 変更 |
|---|---|
| `src/queries/user.ts` | 3 箇所の `getCookie` を `(await cookies()).get("userCountry")?.value` に置き換え、ループ外へ出す。`getCookie` の import を削除 |
| `src/queries/user.test.ts` | `jest.mock("cookies-next")` と `mockGetCookie` を削除。`next/headers` の `cookies` を `mockResolvedValue({ get })` でモックするヘルパー `mockCountryCookie(value?: string)` を追加し、既存の `mockGetCookie.mockReturnValue(...)`（8 箇所）を置き換える。トップレベルの `beforeEach` で既定値「cookie なし」を設定 |
| `plans/077-fix-server-action-country-cookie.md` | 本計画を保存（ルール 04: 実装前に計画を保存） |

`src/queries/product.test.ts` にある、使われていない `cookies-next` モックはスコープ外とし、触らない。

## TDD 手順

1. **Red**: `user.test.ts` に回帰テストを追加する。`next/headers` の `cookies` だけで `userCountry`（Japan/JP）を返し、`getCookie` はスタブしない状態で:
   - `updateCheckoutProductWithLatest(items, undefined)` が throw せず、`getProductShippingFee` が `{ name: "Japan", code: "JP", ... }` を受け取る
   - `saveUserCart` が `getShippingDetails` を呼ぶ（国が解決されている）
   - `updateCartWithLatest` が `getShippingDetails` を呼ぶ
   → 修正前は `"Couldn't retrieve country data."` や未呼び出しで**意図どおり失敗する**ことを確認する（環境エラーを Red の証跡にしない）
2. **Green**: `user.ts` の 3 箇所を修正し、既存テストのモックを `mockCountryCookie` に移す。既存の「cookie なしなら throw」「cookie ありなら送料計算」系テストが引き続き通ることを確認する
3. **Refactor**: 不要になった `cookies-next` のモックや import を除去し、prettier をかける

## 検証

- `bun run test -- src/queries/user.test.ts`（Red → Green の遷移を確認）
- `bun run test`（全体）、`bunx tsc --noEmit`、`bun run lint` → `test-complete` skill
- 実機: dev サーバーで住所 0 件のユーザーが `/checkout` を開き、
  - エラーオーバーレイと「We couldn't refresh…」が出ないこと
  - `.next/dev/logs/next-development.log` に `used cookies().getAll` の WARN と `Couldn't retrieve country data.` が新たに出ないこと
  - `/cart` でも同 WARN が消えること
  （確認は Playwright の `browser_take_screenshot` + `browser_console_messages` で行う。snapshot は使わない）
- テスト数が変わるため `spec-sync-after-test` skill を実行する（QA_HANDOFF.md（SSOT）→ 07-testing.md / COVERAGE_REPORT.md / PROGRESS.md、`bun run coverage:dashboard`）

## コミット（ユーザーから依頼された場合のみ）

1. `docs(plans): add 077 plan for async cookie read in server actions`
2. `test(user): add regression tests for country cookie via next/headers`（Red）
3. `fix(user): read userCountry cookie via async cookies() for Next 16`（Green、テストのモック移行を含む）
4. `docs: sync test stats and coverage dashboard`
