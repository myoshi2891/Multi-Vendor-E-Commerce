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
`findMany` の `where` 引数に `createdAt: { gte: <Date> }` 条件が含まれることを assert
（既存のフィルタ系テストの assert 形式を踏襲。日付値そのものは `expect.any(Date)` でよい）。

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
