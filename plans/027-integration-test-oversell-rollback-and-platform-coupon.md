# Plan 027: `placeOrder` 統合テストにオーバーセルロールバックと PLATFORM クーポン端数吸収のシナリオを追加する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat b6591f9..HEAD -- src/queries/user.ts tests/integration/order-placement.test.ts tests/integration/setup/seed.ts`
> If any in-scope/referenced file changed since this plan was written, compare
> the "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **前提チェック（Step 0）**: 本プランは Docker（testcontainers）必須。
> `docker info` が失敗する環境では **STOP**（実行不能を README の status 列に
> `BLOCKED (Docker unavailable)` と記録して終了）。

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW（テスト + seed ヘルパー拡張のみ。`src/` 本体は 1 行も変更しない）
- **Depends on**: none（plan 026 と独立・並行可）
- **Category**: tests
- **Planned at**: commit `b6591f9`, 2026-07-10
- **出典 finding**: TESTS-05 + TESTS-08（`plans/audit/findings-12-test-coverage.md` / 原本 `findings-04-test-coverage.md`）

## Why this matters

`placeOrder`（`src/queries/user.ts`）には実 DB でしか検証できない 2 つの金銭・在庫クリティカルな
分岐が未テストのまま残っている:

1. **オーバーセルロールバック（TESTS-05）**: 条件付き `updateMany` + `count === 0` throw の
   TOCTOU ガード。既存 Scenario 3 は事前キャップ（`Math.min`）を検証するため decrement は
   **常に成功**し、`$transaction` 全体がロールバックされる経路と「減算後の `Size.quantity`」が
   一度も assert されていない。オーバーセル（在庫マイナス）と部分確定（Order だけ残る）は
   マーケットプレイスで最も高額な障害クラス。
2. **PLATFORM クーポンの端数吸収（TESTS-08）**: 割り切れない割引額のとき最終店舗グループが
   残差を吸収する設計（決定論的 `localeCompare` ソートの存在理由）に、セント単位の
   固定 assert がない。丸め回帰は「合計が 1 セント合わない」形で顧客に直接露出する。

既存の `tests/integration/order-placement.test.ts`（6 シナリオ / testcontainers 実 PostgreSQL）に
シナリオを追加するだけで両方を閉じられる。基盤・パターン・seed ヘルパーはすべて確立済み。

## Current state

- `src/queries/user.ts` — `placeOrder` 本体。**変更しない。** 検証対象の 2 分岐:

オーバーセルガード（`user.ts:716-728`）:

```typescript
// F3: 在庫のアトミック減算（check-and-decrement）
// 条件付き updateMany で「読み取り → 減算」を単一 UPDATE に畳み込み、
// count===0（条件を満たす行なし）を在庫不足として検知する（TOCTOU レース回避）。
const stock = await tx.size.updateMany({
    where: { id: item.sizeId, quantity: { gte: item.quantity } },
    data: { quantity: { decrement: item.quantity } },
});
if (stock.count === 0) {
    // $transaction 全体をロールバック（部分確定なし）
    throw new Error("在庫が不足しています");
}
```

**重要な前提**: `placeOrder` は L494 相当で `validQuantity = Math.min(quantity, size.quantity)` の
事前キャップを行うため、**単純な在庫不足では throw に到達しない**。throw させるには
「検証時点とdecrement時点の間に在庫が減る」レースを再現する必要がある（Step 3 の手法参照）。

PLATFORM クーポン端数吸収（`user.ts:627-676`、要点）:

```typescript
const isPlatformCoupon = cartCoupon?.scope === 'PLATFORM' && cartCouponValid
const platformTotalDiscount = isPlatformCoupon && cartCoupon
    ? cartTotalPrice.mul(cartCoupon.discount).div(100)
    : new Prisma.Decimal("0")
// 端数吸収するストアが実行ごとにブレないよう、storeId でソートして決定論的な順序にする
const storeEntries = Object.entries(groupedItems).sort(([a], [b]) => a.localeCompare(b))
// ...ループ内:
if (isPlatformCoupon && index === storeEntries.length - 1) {
    discountedAmount = platformTotalDiscount.sub(cumulativePlatformDiscount)   // ← 最終グループが残差吸収
} else {
    discountedAmount = groupedTotalPrice.mul(cartCoupon.discount).div(100)
    if (isPlatformCoupon) cumulativePlatformDiscount = cumulativePlatformDiscount.add(discountedAmount)
}
```

- `tests/integration/order-placement.test.ts` — 追記先。既存 6 シナリオ
  （single-store / multi-store / stock capping / store-scoped coupon / ownership guard /
  invalid combination）。**構造の手本は Scenario 3（`:276-338`）と Scenario 4（`:344-`）**。
  ファイル冒頭の JSDoc（検証境界の列挙）にも新シナリオを追記すること。
- `tests/integration/setup/seed.ts` — seed ヘルパー。`SeedCouponInput`（`:219-231`）は
  **`scope` 未対応**（Prisma スキーマは `scope CouponScope @default(STORE)`、enum は
  `prisma/schema.prisma:665`）。PLATFORM シナリオ用に optional `scope` を追加する
  （テスト基盤拡張の前例: commit `78a20c9` の `seedShippingAddress` 追加）。
- カートとクーポンの結線: `seedCart(db, { userId, couponId })` → `placeOrder` は
  `cart.coupon`（`user.ts:438,445`）から取得する。
- 実行系: `bun run test:integration`（`jest.integration.config.js`、testcontainers が
  PostgreSQL コンテナを自動起動）。`bun run test` の集計外。
- 設計判断の背景: `docs/architecture/decisions/004-integration-test-db-strategy.md`（ADR-004）。

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Docker 確認 | `docker info` | exit 0（失敗なら STOP） |
| 統合テスト | `bun run test:integration` | 全 pass（既存 17 + 新規） |
| 単一ファイル | `bun run test:integration -- tests/integration/order-placement.test.ts` | all pass |
| 型チェック | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| unit 回帰 | `bun run test` | 全 pass（集計不変のはず） |

## Scope

**In scope — テスト/seed（1〜2 コミット目）**:
- `tests/integration/order-placement.test.ts` — シナリオ追加 + 冒頭 JSDoc 更新
- `tests/integration/setup/seed.ts` — `SeedCouponInput` に optional `scope?: CouponScope` を追加
  （`db.coupon.create` の data に `scope: input.scope`。未指定時の既定は Step 1 で**検証**する）。
  **あわせて `storeId` を `string | null` に広げる**（現状は `storeId: string` で必須・非 null のため
  PLATFORM クーポンを `storeId: null` で seed できない。`prisma/schema.prisma` の `Coupon.storeId` は
  `String?` なので DB 側は元から null 可）。既存の呼び出し側は文字列を渡しており影響を受けない
- `tests/integration/setup/query-mocks.ts`（**新規**）— Scenario 8 の部分モックが使う透過実装
  `actualDeliveryDetails` を集約（Step 3 参照）。`jest.requireActual` 式の三重複を除去する。
  `src/config/` には置かない（`seed.ts` と同じ「shape は踏襲・実体は setup/」規約）

**In scope — ドキュメント同期（後続の別コミット）**:
- `spec-sync-after-test` の成果物一式（Step 6）— Integration テスト数が 17→20 に変動するため
  `.claude/rules/02-tdd-step-commit.md` に従い同期。SSOT は `docs/testing/QA_HANDOFF.md`、
  伝播先 `07-testing.md` / `COVERAGE_REPORT.md` / `docs/PROGRESS.md` +
  `bun run coverage:dashboard` 再生成の `docs/coverage-dashboard.html`。
- `plans/README.md` の 027 行を DONE に更新（Done criteria と一致）。**テストとは別コミット**。

**Out of scope**（触らない）:
- `src/queries/user.ts` — 本体。オーバーセル throw のメッセージ変更等も禁止
- `tests/integration/cart-checkout.test.ts` / `jest.integration.config.js` / `setup/db.ts` /
  `setup/reset-db.ts` — 基盤は変更不要
- TESTS-06（restock 二重実行ガードの実 DB テスト）— 同型だが別ファイル・別プラン候補。混ぜない
- E2E `stock-decrement.spec.ts` — ブラウザ層は既カバー・触らない

## Git workflow

- ブランチ: 現在のブランチ（`dev`）
- コミット規律: `.claude/rules/02-tdd-step-commit.md`。seed ヘルパー拡張とシナリオ追加は
  論理的に独立 → **2 コミット**（seed 拡張 → シナリオ）。ドキュメント同期はさらに別コミット
- コミット例: `test(integration): support coupon scope in seedCoupon` /
  `test(integration): add oversell-rollback and platform-coupon scenarios to placeOrder`
- push / PR はオペレーター指示があるまで行わない

## Steps

### Step 0: 前提確認

`docker info` → exit 0 を確認。`bun run test:integration` を実行し既存 17 テストが緑であることを確認。

**Verify**: `Tests: 17 passed` 相当の出力。

### Step 1: `seedCoupon` に scope を追加し、storeId を nullable にする

まず `scope` 未指定時の既定を**推測せず確認**する:
`grep -n "scope" prisma/schema.prisma` で `Coupon.scope` に `@default(STORE)` が付いていることを
確認する（付いていなければ `undefined` を渡すと NOT NULL 違反になるため、`input.scope ?? "STORE"` の
明示フォールバックに切り替える）。

確認後、`SeedCouponInput` に
`/** クーポンスコープ。未指定時は下記 create の挙動に従う（Step 1 で schema 既定を確認済み） */ scope?: CouponScope;`
を追加し、`db.coupon.create` の `data` に `scope: input.scope` を渡す。`CouponScope` は
`@prisma/client` から import。

> 根拠: `scope: undefined` を Prisma の create に渡すと「その列を省略」扱いになり、**列に
> `@default` があるときだけ**既定値が入る。`@default` が無い場合は省略が NOT NULL 違反になる。
> よって「undefined → 既定 STORE」は schema を確認してからでないと断定できない。

あわせて `SeedCouponInput.storeId` を **`string` から `string | null` へ広げる**（Step 4 の
PLATFORM クーポンを `storeId: null` で seed するため。理由は Step 4 の blockquote 参照）。
`prisma/schema.prisma` の `Coupon.storeId` は `String?` なので DB 側は元から null を許容しており、
ヘルパーの型だけが不必要に狭かった。`storeId` は必須プロパティのまま（`?` は付けない） ——
**PLATFORM/STORE いずれの場合も呼び出し側に明示させる**ことで、書き忘れによる暗黙の紐付けを防ぐ。
既存の呼び出し側（`order-placement.test.ts:379` / `cart-checkout.test.ts:373`）は文字列を渡して
おり、型の緩和による影響を受けない。

**Verify**: `grep` で `Coupon.scope @default(STORE)` を確認 → `bunx tsc --noEmit` exit 0 →
`bun run test:integration` 既存 17 全 pass（回帰なし）。ここで 1 コミット目。

### Step 2: Scenario 7 — 減算後の `Size.quantity` を assert（TESTS-05 前半）

`order-placement.test.ts` 末尾に `describe("Scenario 7: atomic stock decrement", ...)` を追加。
Arrange は Scenario 3（`:276-338`）をコピーして調整: 在庫 10・カート数量 4（キャップ非発動）。
Act 後に `db.size.findUniqueOrThrow({ where: { id: size.id } })` で
**`quantity === 6`（10 − 4）** を assert する。

**Verify**: `bun run test:integration -- tests/integration/order-placement.test.ts` → 18 pass。

### Step 3: Scenario 8 — オーバーセルロールバック（TESTS-05 後半・本命）

**割り込み点の根拠**: 事前キャップ（`Math.min`, `user.ts:494` 付近）はカート検証ループ内で行われ、
decrement は `$transaction` 内（`:720`）。この間に **`getDeliveryDetailsForStoreByCountry` が
「トランザクション外」で呼ばれる**（`user.ts:598-606`、コメントに「事前にdelivery詳細を
全store分取得（トランザクション外）」と明記）。ここに割り込んで在庫を減らせば、
「検証はキャップなしで通過 → decrement 時点では在庫不足」というレースを**決定論的に**再現できる。

1. ファイル冒頭（既存の `jest.mock("@clerk/nextjs/server", ...)` の隣）に部分モックを追加:

   ```typescript
   // Scenario 8 がカート検証後・$transaction 前に在庫を横取りするための seam。
   // デフォルトは実装透過（jest.fn が actual をそのまま呼ぶ）なので他シナリオに影響しない。
   jest.mock("@/queries/product", () => {
       const actual = jest.requireActual("@/queries/product");
       return {
           ...actual,
           getDeliveryDetailsForStoreByCountry: jest.fn(
               actual.getDeliveryDetailsForStoreByCountry
           ),
       };
   });
   ```

   import に `import { getDeliveryDetailsForStoreByCountry } from "@/queries/product";` を追加。

   > **透過実装は共通ヘルパーに切り出すこと（アドホックな部分モックをテスト本文に散らさない）。**
   > 上の factory・下の `mockImplementationOnce`・`afterEach` の張り直しで、
   > `jest.requireActual<typeof import("@/queries/product")>("@/queries/product")
   > .getDeliveryDetailsForStoreByCountry` という同じ式が **3 回** 現れる。この三重複が、
   > 「reset したが張り直し忘れ」というリークの温床になる（実際、手順 5 の注意書きは
   > まさにその事故を防ぐためのもの）。
   >
   > **置き場所**: `tests/integration/setup/query-mocks.ts`（新規）。`src/config/` **ではない**。
   > `jest.integration.config.js` は `^@/(.*)$ → src/$1` を map しているので `src/config/*` は
   > *解決自体はできる*が、本リポジトリの規約は「`src/config/` の shape を**踏襲**しつつ
   > integration 固有の実体は `tests/integration/setup/` に置く」である
   > （`tests/integration/setup/seed.ts` の冒頭 JSDoc が
   > 「既存 `src/config/test-fixtures.ts` の shape を踏襲しつつ、メモリ上 fixture ではなく」と
   > 明記している先例）。integration 専用の mock seam を unit/component 共通層に持ち込まないこと。
   >
   > **落とし穴 — `jest.mock` の宣言自体はテストファイルに残す必要がある**:
   > `jest.mock()` は **import より上へ巻き上げられる**ため、factory の内部から import した
   > ヘルパーを参照すると、その時点でヘルパーは未初期化である。babel-jest はこれを
   > 「not allowed to reference any out-of-scope variables」として検出する（`mock` 始まりの
   > 識別子のみ許可）が、本設定は `preset: "ts-jest"` であり ts-jest の巻き上げは**この検証を
   > 行わない**ため、同じ誤りが分かりにくい実行時エラーとして現れる。
   > したがって切り出すのは **factory 本体ではなく透過実装（と割り込みヘルパー）** に限る:
   >
   > ```typescript
   > // tests/integration/setup/query-mocks.ts
   > // 型注釈はインライン import 型クエリで完結させる（別途 `import type { … }` を置いて
   > // `typeof <名前>` で参照する形は避ける — 型のみインポートの値名に対する `typeof` は
   > // 環境設定によって解釈が割れるため、`typeof import("…").fn` で一意にコンパイルさせる）。
   >
   > /** 実装透過の delivery 取得（requireActual の三重複を 1 箇所に集約） */
   > export const actualDeliveryDetails: typeof import("@/queries/product")["getDeliveryDetailsForStoreByCountry"] = (
   >     ...args
   > ) =>
   >     jest
   >         .requireActual<typeof import("@/queries/product")>("@/queries/product")
   >         .getDeliveryDetailsForStoreByCountry(...args);
   > ```
   >
   > テスト側は `jest.mock(...)` の 1 行だけをファイル冒頭に残し、`mockImplementationOnce` /
   > `afterEach` の張り直しは `actualDeliveryDetails` を参照する（これらは巻き上げの影響を
   > 受けない通常のコードなので import 参照で問題ない）。

2. Arrange: 在庫 **5**・カート数量 **5**（検証時はキャップ非発動で quantity 5 のまま通過）を seed。
   モックは **実関数の型で宣言**する（`as jest.Mock` は型を消すので使わない）。
   テスト内で `mockImplementationOnce` により一度だけ割り込む:

   ```typescript
   // 実関数のシグネチャを保つ型付きモック（jest.Mock への曖昧キャストは禁止）
   const mockedDelivery =
       getDeliveryDetailsForStoreByCountry as jest.MockedFunction<
           typeof getDeliveryDetailsForStoreByCountry
       >;
   mockedDelivery.mockImplementationOnce(async (storeId, countryId) => {
       // カート検証（キャップ）通過後・decrement 前に、別トランザクションで在庫を 2 に減らす
       await db.size.update({ where: { id: size.id }, data: { quantity: 2 } });
       return actualDeliveryDetails(storeId, countryId);
   });
   ```

   （`actualDeliveryDetails` は上記 `tests/integration/setup/query-mocks.ts` から import する。）

3. Act: `await expect(placeOrder(address as ShippingAddress, cart.id)).rejects.toThrow("在庫が不足しています")`
   （decrement は `where: { quantity: { gte: 5 } }` に対し在庫 2 → `count === 0` → throw → 全ロールバック）
4. Assert（ロールバックの 3 点検証 — SECURITY_GAP_REPORT §5.2 の「副作用なし」思想と同型）:
   - `db.order.count()` / `db.orderGroup.count()` / `db.orderItem.count()` がすべて **0**
   - `db.size.findUniqueOrThrow(...)` の quantity が **2 のまま**（decrement されていない）
5. 後始末（**strict-safe**）: `afterEach` で `mockedDelivery.mockReset()` した後、
   **透過実装を張り直す**: `mockedDelivery.mockImplementation(actualDeliveryDetails)`
   （共通ヘルパー経由。生の `jest.requireActual(...)` 式をここで再度書かないこと — 三重複が
   まさに張り直し忘れの温床である）。

   > 重要: `mockClear()` は `mock.calls` を消すだけで、**`mockImplementationOnce` のキューや
   > `mockImplementation` はリセットしない**。もし Act が once 実装を消費する前に throw すると、
   > 未消費の once 実装が次テストに漏れる。これを確実に防ぐには `mockReset()`（実装ごと消去）
   > → 透過実装を張り直す、の 2 段が必要。`beforeEach` で透過実装を張る形でもよいが、
   > 「reset だけ」で放置しないこと（全モック消去状態になり他シナリオが実装欠落で落ちる）。

**Verify**: 該当テストが緑 + 上記 3 点 assert がすべて通る + 既存 Scenario 1〜7 も緑のまま
（部分モックのデフォルト透過を確認）。19 pass。

### Step 4: Scenario 9 — PLATFORM クーポン端数吸収（TESTS-08）

`describe("Scenario 9: PLATFORM coupon remainder absorption", ...)` を追加。
Arrange は Scenario 4（store-scoped coupon）を手本に **2 店舗**を seed:

- store X（storeId ソートで先になるよう seed 順は不問 — assert 側でソートして特定する）:
  商品 $33.33 × 1（sizePrice: 33.33, quantity 1）
- store Y: 商品 $66.67 × 1
- クーポン: `seedCoupon(db, { storeId: null, discount: 10, scope: "PLATFORM" })`
  → `seedCart(db, { userId, couponId: coupon.id })`

  > **`storeId` は `null` に固定すること**（店舗 X / Y のどちらかを入れない）。理由は 3 つ:
  > 1. **テストの識別力**（最重要）。`user.ts:671` の判定は論理和である:
  >    `const check = isPlatformCoupon || (storeId === cartCoupon?.storeId && cartCouponValid)`
  >    `storeId` に店舗 X を入れると、**X への割引は 2 つの項のどちらからでも到達できる**ため、
  >    「PLATFORM 分岐が効いた」ことを assert で証明できない（STORE 一致の項で通っただけかもしれず、
  >    Scenario 9 が主張する内容を検証していないことになる）。`null` ならどの店舗の `storeId` とも
  >    一致しないので、**割引が生じる経路が `isPlatformCoupon` に一意に絞られる**。
  > 2. **ドメイン意味論**。PLATFORM スコープのクーポンは特定店舗に所有されない。実装も PLATFORM 時は
  >    `storeId` を参照しない（`user.ts:671` の短絡 / `:1153-1155` は全 item を対象にする）。
  >    非 null を入れた fixture はモデルを誤って教える。
  > 3. **Cascade の巻き添え**。`Coupon.store` は `onDelete: Cascade`（`prisma/schema.prisma`）。
  >    PLATFORM クーポンに `storeId` を持たせると、**その店舗の削除で全社クーポンごと消える**。
  >    fixture がこの形を再現すべきではない。
- 商品小計 = $100.00、PLATFORM 10% → `platformTotalDiscount = $10.00`
- 各グループの単純 10% は 3.333 / 6.667 と割り切れない → 端数吸収の検証に適する

Assert（**金額は Decimal の厳密比較**。`.toNumber()` + `toBeCloseTo` の浮動小数点比較は
`.claude/steering/tech.md`（金額・数値精度）で禁止 — セント単位でも IEEE754 誤差が出るため）:

金額の等価判定は次のいずれかで行う（浮動小数点を介さない）:
- 文字列比較: `expect(new Prisma.Decimal(actual).toFixed(2)).toBe("10.00")`
- Decimal 比較: `expect(new Prisma.Decimal(actual).equals(new Prisma.Decimal("10.00"))).toBe(true)`

1. `order.groups` を **storeId 昇順（`localeCompare`）にソート**し、非最終グループの
   `total` = `groupedTotalPrice + shipping − groupedTotalPrice×0.10`（`Prisma.Decimal`
   の `.mul()/.sub()/.add()` で計算し `.toFixed(2)` で比較）
2. 最終グループの割引 = `10.00 − (非最終グループ割引の合計)`（残差吸収。Decimal で減算）
3. **全グループ割引の合計がちょうど $10.00**
   （`groups.reduce((acc, g) => acc.add(discount(g)), new Prisma.Decimal(0)).toFixed(2) === "10.00"`）
4. `order.total` = `subTotal + shippingFees`（Order レベル集計の整合。`.toFixed(2)` で比較）

> 補足: 中間集計は `.toNumber()` せず `Prisma.Decimal` のまま `.add()` で畳み込み、
> **比較の直前にだけ** `.toFixed(2)`（文字列）へ変換する（`tech.md`「toNumber() は return 境界のみ」）。

送料は Scenario 1〜4 と同じく `computeShippingTotal` で独立に pin する。

**Verify**: `bun run test:integration -- tests/integration/order-placement.test.ts` → 20 pass。

### Step 5: ファイル冒頭 JSDoc の更新と品質ゲート

冒頭 JSDoc の検証境界リストに「オーバーセルロールバック（check-and-decrement）」
「PLATFORM クーポンの端数吸収（最終グループ残差）」の 2 行を追記。
`bunx tsc --noEmit` / `bun run lint` / `bun run test`（unit 回帰）/ `bun run test:integration` を実行。

**Verify**: すべて exit 0。ここで 2 コミット目（シナリオ追加）。

### Step 6: ドキュメント同期

`spec-sync-after-test` skill を起動（Integration テスト数 17 → 20 / QA_HANDOFF の
Integration 行更新 / `bun run coverage:dashboard` 再生成）。**別コミット**。

**Verify**: QA_HANDOFF.md の Integration 行が 20 / 2 スイートに更新されている。

## Test plan

（本プラン自体がテスト追加。Step 2〜4 のシナリオ表が仕様）
- 構造の手本: Scenario 3（`order-placement.test.ts:276-338`）・Scenario 4（`:344-`）
- 検証: `bun run test:integration` → 20 pass（17 + 3）

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run test:integration` exit 0、order-placement のテスト数 6 → 9
- [ ] Scenario 8 で Order/OrderGroup/OrderItem の count 0 + Size.quantity 不変を assert している
- [ ] Scenario 9 で全グループ割引合計 = platformTotalDiscount をセント精度で assert している
- [ ] `bunx tsc --noEmit` exit 0 / `bun run lint` exit 0 / `bun run test` 全 pass
- [ ] `git diff --stat` の変更が in-scope 2 ファイル（+ spec-sync docs 群）のみ
- [ ] `plans/README.md` の 027 行を DONE に更新

## STOP conditions

Stop and report back (do not improvise) if:

- `docker info` が失敗する（testcontainers 起動不能）→ status を `BLOCKED (Docker unavailable)` に
- Drift check で `user.ts` の decrement ブロック（`:716-728`）または PLATFORM 分岐（`:627-676`）の
  形状が変わっている
- Step 3 の部分モック（`jest.mock("@/queries/product")` + `requireActual` 透過）で
  既存シナリオ 1〜7 のいずれかが落ちる、または割り込みが decrement 前に効いていない
  （= 本体に別の seam が必要。リファクタは out of scope）
- Scenario 9 の残差計算が期待とズレて 2 回修正しても合わない（実際の Decimal 丸め挙動を
  観察結果として報告する）

## Maintenance notes

- plan 006（place-order 二重送信ガード）と plan 003（決済信頼境界）が近傍の `user.ts` を変更する。
  それらのマージ後は本シナリオの行番号参照（JSDoc 内）を目視確認すること。
- TESTS-06（restock 二重実行ガード）は本プランで拡張した seed 基盤をそのまま使える。
  次の統合テスト候補として README の deferred に残してある。
- レビュー観点: Scenario 8 の割り込みが「カート検証後・decrement 前」に本当に入っているか
  （spy 内で在庫を変えた後に既存実装を透過呼び出ししているか）。
