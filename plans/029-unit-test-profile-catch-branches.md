# Plan 029: `src/queries/profile.ts` の catch 分岐と期間フィルタ分岐を unit テストで網羅する（Branches 69.2% → 95%+）

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat b6591f9..HEAD -- src/queries/profile.ts src/queries/profile.test.ts`
> 変更があれば "Current state" の行番号・メッセージ表と突合し、不一致なら STOP。

## Status

- **Priority**: P3
- **Effort**: S–M（+29 テスト = catch 20 + 期間フィルタ 9・機械的な横展開）
- **Risk**: LOW（テスト追記のみ。本体無変更）
- **Depends on**: none（plan 026 と同型パターン。どちらが先でもよい）
- **Category**: tests
- **Planned at**: commit `b6591f9`, 2026-07-10
- **出典 finding**: TESTS-13（`plans/audit/findings-12-test-coverage.md`）

## Why this matters

プロフィール系 5 テーブル（注文 / 決済 / レビュー / ウィッシュリスト / フォロー店舗）を供給する
`profile.ts` は、lcov 実測で Branches 69.2%（59/87）。未カバーは **5 関数すべての
「currentUser catch」「DB catch」× Error/非 Error の計 20 分岐**と、
`getUserOrders` / `getUserPayments` / `getUserReviews` の**期間フィルタ分岐**
（last-6-months / last-1-year / last-2-years）。エラー時に内部詳細を漏らさず汎用メッセージへ
縮退する契約（PII 非漏洩）が現在まったく検証されていない。`message.test.ts` に確立済みの
パターン（+14 テストで Branches 74.5%→100%、commit `2d5ab8a`）の機械的な横展開で閉じられる。

## Current state

- `src/queries/profile.ts` — 対象。export は 5 関数（`getUserOrders:32` / `getUserPayments:199` /
  `getUserReviews:336` / `getUserWishlist:454` / `getUserFollowedStores:579`）。**変更しない。**
- `src/queries/profile.test.ts` — 既存 34 テスト（正常系・ページング・フィルタ主要経路）。追記先。
  モック設定は冒頭にあり（`@clerk/nextjs/server` + `@/lib/db` の
  order/paymentDetails/review/wishlist ほか）。**新しい jest.mock を増やさず既存を使う。**

各関数の catch 構造は全関数同型（`currentUser` 用と DB フェッチ用の 2 つの try/catch、
それぞれ `instanceof Error` 真偽で別ログ）。**関数別のログ prefix と汎用メッセージ**（実コードから転記）:

| 関数 | currentUser catch ログ（`:行`） | DB catch ログ（`:行`） | throw される汎用メッセージ |
|---|---|---|---|
| getUserOrders | `[Profile:getUserOrders] Error retrieving current user:`（45,47） | `[Profile:getUserOrders] Error fetching orders:`（161,163） | `Failed to get user orders.` |
| getUserPayments | `[Profile:getUserPayments] Error retrieving current user:`（212,214） | `[Profile:getUserPayments] Error fetching payments:`（294,296） | `Failed to get user payments.` |
| getUserReviews | `[Profile:getUserReviews] Error retrieving current user:`（349,351） | `[Profile:getUserReviews] Error fetching reviews:`（422,424） | `Failed to get user reviews.` |
| getUserWishlist | `[Profile:getUserWishlist] Error retrieving current user:`（464,466） | `[Profile:getUserWishlist] Error fetching wishlist:`（559,561） | `Failed to fetch wishlist.` |
| getUserFollowedStores | `[Profile:getUserFollowedStores] Error retrieving current user:`（589,591） | `[Profile:getUserFollowedStores] Error fetching followed stores:`（658,660） | `Failed to fetch followed stores.` |

catch の形状（`profile.ts:41-51`、全関数同型）:

```typescript
let user: Awaited<ReturnType<typeof currentUser>>;
try {
    user = await currentUser();
} catch (error: unknown) {
    if (error instanceof Error) {
        console.error("[Profile:getUserOrders] Error retrieving current user:", error.message, error.stack);
    } else {
        console.error("[Profile:getUserOrders] Error retrieving current user:", error);
    }
    // 内部エラー詳細はログのみに留め、呼び出し側へは汎用メッセージを返す
    throw new Error("Failed to get user orders.");
}
```

期間フィルタ分岐（`getUserOrders:76-91` / `getUserPayments:239-255` / `getUserReviews:371-387`、同型）:

```typescript
const now = new Date();
if (period === "last-6-months") {
    andConditions.push({ createdAt: { gte: subMonths(now, 6) } });
}
if (period === "last-1-year") {
    andConditions.push({ createdAt: { gte: subYears(now, 1) } });
}
if (period === "last-2-years") {
    andConditions.push({ createdAt: { gte: subYears(now, 2) } });
}
```

lcov 未カバー（2026-07-10 実測）: `44-50, 160-166, 211-217, 293-299, 348-354, 421-427,
463-469, 558-564, 588-594, 657-663`（catch 群）+ `84, 89, 242, 247, 252, 374, 379, 384`
（期間フィルタの一部）。

**従うべきパターンの exemplar**: `src/queries/message.test.ts:567-660`
「catch 分岐網羅（Error / unknown 両系統）」describe。非 Error reject は文字列や
`{ code: "P2024" }` のような生オブジェクトで行う。`console.error` spy の張り方も同ファイル準拠
（profile.test.ts に既存 spy がなければ `jest.spyOn(console, "error").mockImplementation(() => {})`
を beforeEach/afterEach で追加）。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| 対象テスト | `bun run test -- src/queries/profile.test.ts` | all pass（34 → 63: 既存 34 + catch 20 + 期間フィルタ 9） |
| カバレッジ | `bun run test -- src/queries/profile.test.ts --coverage --collectCoverageFrom='src/queries/profile.ts'` | Branches ≥ 95% |
| 型チェック | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| フルスイート | `bun run test` | 全 pass |

## Scope

**In scope**:
- `src/queries/profile.test.ts` — テスト追記のみ

**Out of scope**:
- `src/queries/profile.ts` 本体
- `src/components/store/profile/**`（UI 層は既存テストあり・TECHDEBT-03 の領分）
- ページング正規化ロジックの本体改修（現挙動を仕様として固定する）

## Git workflow

- ブランチ: `dev` / 1 テストファイル = 1 コミット + docs 同期別コミット（rule 02）
- コミット例: `test(profile): cover catch branches and period filters across 5 query functions`

## Steps

### Step 1: catch 分岐網羅 describe を追加

`profile.test.ts` 末尾に `describe("catch 分岐網羅（Error / unknown 両系統）")` を新設。
必要テスト数は**機械的に定義**する（lcov の実測任せ・「間引いてよい」を排除する）:

> **必須テスト数 = 5 関数 × 4 ケース = 20 テスト**。
> 4 ケースは各関数につき固定: ①currentUser reject（Error）②currentUser reject（非 Error）
> ③DB reject（Error）④DB reject（非 Error）。

- 全 5 関数: 「currentUser reject（Error）→ 汎用メッセージ throw + Error 分岐ログ」（5 テスト）
- 全 5 関数: 「currentUser reject（非 Error）→ 汎用メッセージ + unknown 分岐ログ」（5 テスト）
- 全 5 関数: 「DB reject（Error）→ 汎用メッセージ throw + Error 分岐ログ」（5 テスト）
- 全 5 関数: 「DB reject（非 Error）→ 汎用メッセージ + unknown 分岐ログ」（5 テスト）

> currentUser catch は 5 関数で同型だが、**同型だからと 2 関数に間引かない**。回帰検知点は
> 関数ごとに独立している必要がある（片方だけリファクタで壊れたケースを検出できるように）。
> lcov が同型分岐を「カバー済み」と表示しても、20 テストはすべて残す。

各テストで assert すること: ①throw が**表の汎用メッセージと完全一致** ②`console.error` が
表のログ prefix で呼ばれる ③throw メッセージに元エラーの詳細（"db down" 等）が含まれない。
DB reject は各関数が最初に呼ぶ mock（order.findMany / paymentDetails.findMany / review.findMany /
wishlist.findMany / user.findUnique 等 — 既存正常系テストが使っている mock と同じもの）に
`mockRejectedValue` を仕込む。

**Verify**: `bun run test -- src/queries/profile.test.ts` → 既存 34 + 新規 **20** all pass。

### Step 2: 期間フィルタ分岐テストを追加

`getUserOrders` / `getUserPayments` / `getUserReviews` に対し、`period` 引数
`"last-6-months"` / `"last-1-year"` / `"last-2-years"` の各値で呼び、対応する mock
`findMany` の `where` 引数に `createdAt: { gte: <Date> }` 条件が含まれることを assert する。
**日付値は `expect.any(Date)` で済ませず、実際の境界を検証すること** — 時刻を固定
（`jest.useFakeTimers().setSystemTime(new Date("2026-07-01T00:00:00Z"))` 等）した上で、
各期間が生む `gte` の**具体値**（6 か月前 / 1 年前 / 2 年前）を assert する。

> **fake timer は必ず復元すること（必須）。** `jest.useFakeTimers()` はモジュール/グローバルの
> タイマーと `Date` を差し替えるため、復元しないと**同一ファイルの後続テストと他スイート**へ
> 固定時刻が漏れる。相対日付を使う共有フィクスチャ（`src/config/test-scenarios.ts` は
> 相対日付ベース）が偽の "now" を見て、原因がこのテストの外にある失敗を生む。
>
> ```typescript
> afterEach(() => {
>     jest.useRealTimers();   // 例外で落ちたテストの後でも必ず実行される
> });
> ```
>
> `afterEach` に置くこと（テスト末尾の呼び出しでは、assert が失敗した時点で到達しない）。
> 期間フィルタのテストだけを別の `describe` に隔離し、その `describe` 内で
> `beforeEach(() => jest.useFakeTimers().setSystemTime(...))` / `afterEach(() => jest.useRealTimers())`
> を対で置くのが最も安全。
>
> **(必須) 期間境界のタイムゾーン契約。** `gte` の**具体値**を assert する以上、
> その具体値が何に依存するかを先に固定しなければテストは環境依存で落ちる。
> 実装（`src/queries/profile.ts:76-92`）は `date-fns` の `subMonths` / `subYears` を使うが、
> **これらはローカル時刻で月・年を減算する**ため、結果は**実行環境の TZ に依存する**。
>
> **`setSystemTime` に UTC の瞬間を与えるだけでは不十分**（これが最も間違えやすい点）。
> 同じ UTC 瞬間でも TZ が違えば結果が変わることを実測で確認した:
>
> | TZ | `subMonths(new Date("2026-07-01T00:00:00Z"), 6)` |
> |---|---|
> | `UTC` | `2026-01-01T00:00:00.000Z` |
> | `Asia/Tokyo` | `2026-01-01T00:00:00.000Z` |
> | `America/New_York` | **`2025-12-31T01:00:00.000Z`** ← 日付も時刻もずれる |
>
> `America/New_York` では、UTC 深夜の瞬間がローカルでは**前日**（`2026-06-30 20:00 EDT`）に
> なり、そこから 6 か月引くため日付が 1 日戻る。さらに戻り先が EST（冬時間）なので
> **DST 差の 1 時間**が UTC 表現に現れる。テスト契約として次の 3 点を定める:
>
> 1. **TZ を UTC に固定する。** `process.env.TZ = "UTC"` をテストプロセスで固定するか
>    （`jest.config.js` の `globalSetup` / npm script の `TZ=UTC` 前置）、当該 `describe` の
>    `beforeAll` で設定する。**固定しないなら具体値 assert 自体を採らない**
>    （CI と開発機で TZ が違えば同じコードが片方でだけ落ちる）。`setSystemTime` は
>    「いつか」を固定するだけで「どの TZ から見るか」は固定しないため、両方要る。
> 2. **期待値は実装と同じ導出関数で作らない。** `expect(...).toEqual(subMonths(now, 6))` は
>    実装と同じ `subMonths` を呼ぶため、**月数の取り違えも境界の誤りもそのまま両辺に伝播して
>    常に一致する**（トートロジー）。期待値は `new Date("2026-01-01T00:00:00.000Z")` のような
>    **リテラル**で書き、人間が読んで正しさを判断できる形にすること。
> 3. **月末クランプ挙動を明記する。** `subMonths` は減算先の月に同じ日が無い場合、
>    **その月の末日へクランプ**する（実測: `subMonths(2026-08-31T00:00:00Z, 6)` は
>    2 月 31 日が無いため `2026-02-28T00:00:00.000Z`）。固定時刻を月末に置くか月央に置くかで
>    テストの意味が変わるため、**どちらを検証しているのかをテスト名かコメントに書く**。
>    月末クランプ自体を検証したい場合は、クランプが起きる固定時刻（例: 8/31）を別テストとして
>    明示的に持つこと。

`expect.any(Date)`
は「Date であること」しか見ず、下の必須テスト数の根拠である**月数の取り違え・年跨ぎの誤り**を
まさに素通しさせる（型は緑でも境界がズレる）。

Step 1 と**同じ規則**で必要テスト数を機械的に定義する（lcov の実測任せ・「間引いてよい」を排除する）:

> **必須テスト数 = 3 関数 × 3 期間 = 9 テスト**。
> 3 期間は固定: ①`"last-6-months"` ②`"last-1-year"` ③`"last-2-years"`。
>
> **lcov が「カバー済み」と表示しても 9 テストはすべて残す**（Step 1 の「同型だからと間引かない」と
> 同じ理由）。行カバレッジは「その行を通ったか」しか見ないため、異なる期間値が同じ行を通れば
> 1 つ書いた時点でカバー済みに見える。しかし**境界計算の誤り（月数の取り違え・年跨ぎ）は期間値ごとに
> 独立して起きる**ため、行が緑でも他の値は無検出のまま残る。カバレッジ率に最適化すると
> 「行を通す最小テスト」になり、検知力ではなく指標を買うことになる。

**Verify**: `bun run test -- src/queries/profile.test.ts` → 計 **63** テスト（34 + 20 + 9）all pass。

### Step 3: カバレッジ実測と補完

`bun run test -- src/queries/profile.test.ts --coverage --collectCoverageFrom='src/queries/profile.ts'`
→ text レポートの Uncovered Line #s を確認。上記ケース表の範囲内でのみ補完し、**Branches ≥ 95%**
（87 分岐中 83+）に到達させる。95% に届かない残余が「ケース表の範囲外」なら無理に埋めず
報告事項として記録（100% は要件でない）。

**Verify**: Branches ≥ 95%。

### Step 4: 品質ゲート・コミット・docs 同期

`bunx tsc --noEmit` / `bun run lint` / `bun run test` → すべて exit 0 → テストコミット →
`spec-sync-after-test` skill 起動（別コミット）。

**Verify**: `git log --oneline -2` で 2 コミットに分離。

## Test plan

（Step 1〜2 のケース表が仕様。手本: `message.test.ts:567-660`）

## Done criteria

- [ ] `bun run test -- src/queries/profile.test.ts` exit 0、テスト数 34 → **63**
      （catch 網羅 20 本 + 期間フィルタ 9 本。いずれも lcov の結果にかかわらず間引かない）
- [ ] profile.ts 単体 Branches ≥ 95%
- [ ] 全 5 関数で「currentUser reject / DB reject の Error・非 Error 4 ケース」が揃っている（各関数 4 本・計 20 本）
- [ ] 3 関数（`getUserOrders` / `getUserPayments` / `getUserReviews`）で 3 期間すべてが揃っている（各関数 3 本・計 9 本）
- [ ] fake timer を使う箇所に `afterEach(() => jest.useRealTimers())` が**対で**存在する
      （テスト末尾での復元は不可 — assert 失敗時に到達しない）。
      検証: `bun run test`（全スイート）が exit 0、かつ `profile.test.ts` を単独実行した場合と
      全体実行した場合で結果が変わらない（時刻の漏れがあると他スイートの相対日付が壊れる）
- [ ] 全 5 関数で「汎用メッセージ完全一致 + 詳細非漏洩」の assert が存在する
- [ ] `bunx tsc --noEmit` / `bun run lint` / `bun run test` exit 0
- [ ] 変更が `src/queries/profile.test.ts`（+ spec-sync docs 群）のみ
- [ ] `plans/README.md` の 029 行を DONE に更新

## STOP conditions

- Drift check で catch のログ prefix / 汎用メッセージが表と一致しない
- テストを通すために profile.ts 本体の変更が必要に見える
- Step 3 で 2 回補完しても Branches が **95% を下回る**（Done criteria / Step 3 の閾値と一致。
  未カバー行の一覧を添えて報告）

## Maintenance notes

- TECHDEBT-03（3 つのプロフィールテーブルからの `usePaginatedFilteredList` 抽出）が実施されると
  本テストの対象は UI 層と分離されたまま安定して残る（server action 側の契約テストとして機能）。
- plan 007（`logError` ヘルパー集約）が実施されると `console.error` の呼び出し形状が変わる。
  その移行 PR ではこのテストの assert が**意図的に**落ちる — ログ形状の回帰検知が役割なので、
  移行に合わせて assert を新形式へ更新すること。
