# Plan 031: 注文キャンセル/返金の子連動・在庫復元（restock）を実 DB 統合テストで固定する

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 1750ef2..HEAD -- src/queries/order.ts src/lib/auth-guards.ts tests/integration/`
> If any in-scope/referenced file changed since this plan was written, compare
> the "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **前提チェック（Step 0）**: 本プランは Docker（testcontainers）必須。
> `docker info` が失敗する環境では **STOP**（`plans/README.md` の status 列に
> `BLOCKED (Docker unavailable)` と記録して終了）。

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW（テスト新設 + seed ヘルパー追加のみ。`src/` 本体は 1 行も変更しない）
- **Depends on**: none（plan 027 と独立・並行可。ただし両プランとも
  `tests/integration/setup/seed.ts` を拡張するため、027 と同時実行する場合は
  マージ時に seed.ts の追記が両方残っていることを確認する）
- **Category**: tests
- **Planned at**: commit `1750ef2`, 2026-07-11
- **出典 finding**: TESTS-15（`plans/audit/findings-13-integration-coverage.md`。
  Round 1 raw TESTS-06 の昇格・拡張）

## Why this matters

`placeOrder` は注文確定時に在庫を**減算**する（decrement — plan 027 が検証予定）。その対となる
**復元（restock = increment）** は管理者のキャンセル/返金操作で走るが、実 DB では一度も検証されて
いない。restock には二重実行ガードが 2 系統あり（`updateOrderPaymentStatus` の条件付き
`updateMany` + `count===1` 判定、`updateOrderGroupStatusAsAdmin` の「非終端 → 終端」遷移ガード）、
これが破れると**幽霊在庫**（実在しない在庫の復元 → オーバーセル誘発）や**部分連動**
（paymentStatus だけ Refunded で子 OrderGroup/OrderItem が Pending のまま）というマーケット
プレイスで最も高額な障害クラスに直結する。unit テスト（`src/queries/order.test.ts`）は全モックで
「呼び出し構造」しか検証できず、「2 回目の呼び出しで `updateMany` が実際に count=0 を返す」
「`Size.quantity` が実際に increment される」という実 DB セマンティクスは未検証のまま。

## Current state

- `src/queries/order.ts` — 検証対象。**変更しない。** 3 つの検証対象ロジック:

(1) 在庫復元ヘルパーと終端判定（`order.ts:15-33`）:

```typescript
const isRestockTerminalOrderStatus = (status: OrderStatus | undefined): boolean =>
    status === OrderStatus.Canceled || status === OrderStatus.Refunded;

const restockOrderItems = async (
    tx: OrderTransactionClient,
    items: { sizeId: string; quantity: number }[]
): Promise<void> => {
    for (const item of items) {
        await tx.size.update({
            where: { id: item.sizeId },
            data: { quantity: { increment: item.quantity } },
        });
    }
};
```

(2) `updateOrderPaymentStatus`（`order.ts:562-651`）— TOCTOU ガード付きキャンセル/返金連動。
要点（`:588-638`）:

```typescript
let didTransition = false;
if (isCancelOrRefund) {
    const transition = await tx.order.updateMany({
        where: {
            id: orderId,
            paymentStatus: { notIn: [PaymentStatus.Cancelled, PaymentStatus.Refunded] },
        },
        data: { paymentStatus: status, orderStatus: childOrderStatus },
    });
    didTransition = transition.count === 1;
}
// ...子連動・在庫復元は実際に遷移が起きた場合のみ（冪等・二重復元防止）
if (isCancelOrRefund && didTransition) {
    await tx.orderGroup.updateMany({ where: { orderId }, data: { status: childOrderStatus } });
    await tx.orderItem.updateMany({ where: { orderGroup: { orderId } }, data: { status: childItemStatus } });
}
// ...
if (isCancelOrRefund && didTransition) {
    const items = await tx.orderItem.findMany({
        where: { orderGroup: { orderId } },
        select: { sizeId: true, quantity: true },
    });
    await restockOrderItems(tx, items);
}
```

enum スペル注意（`order.ts:569-581` コメントより）: 親 `PaymentStatus` は **"Cancelled"（l 2つ）**、
子 `OrderStatus` は **"Canceled"（l 1つ）**。`PaymentStatus.Refunded` → 子 `OrderStatus.Refunded` /
`ProductStatus.Refunded`、`PaymentStatus.Cancelled` → 子 `Canceled`。

(3) `updateOrderGroupStatusAsAdmin`（`order.ts:459-510`）— グループ単位の遷移ガード + 親集約:

```typescript
return await db.$transaction(async (tx) => {
    const prev = await tx.orderGroup.findUnique({
        where: { id: groupId },
        select: { status: true, items: { select: { sizeId: true, quantity: true } } },
    });
    const group = await tx.orderGroup.update({ where: { id: groupId }, data: { status }, ... });
    await reconcileParentOrderStatus(tx, group.orderId);
    // ...
    if (!isRestockTerminalOrderStatus(prev?.status as OrderStatus | undefined) &&
        isRestockTerminalOrderStatus(status)) {
        await restockOrderItems(tx, prev?.items ?? []);
    }
    return group.status as OrderStatus;
});
```

親集約規則（`reconcileParentOrderStatus`、`order.ts:415-448`）: 全 Delivered→Delivered /
全 Shipped→Shipped / 全 Canceled→Canceled / 全 Refunded→Refunded /
一部 Shipped or Delivered→PartiallyShipped / それ以外→Processing。

- **認可**: 両関数とも冒頭で `await requireAdmin()`（`src/lib/auth-guards.ts:53-59`）を呼ぶ。
  `requireAdmin` は `currentUser()`（`@clerk/nextjs/server`）を使い、
  `user.privateMetadata?.role !== "ADMIN"` なら `"Only admins can perform this action."` を throw。
  → テストでは `currentUser` をモックし `{ id: "admin-1", privateMetadata: { role: "ADMIN" } }`
  を resolve させる（既存の `tests/integration/order-placement.test.ts:31-33` と同じ
  `jest.mock("@clerk/nextjs/server", () => ({ currentUser: jest.fn() }))` パターン）。
- **テスト基盤**（すべて確立済み・変更不要）:
  - `tests/integration/setup/db.ts` — `getTestDb()` / `disconnectTestDb()`
  - `tests/integration/setup/reset-db.ts` — `resetDb(db)`（TRUNCATE。Order / OrderGroup /
    OrderItem / Size 系テーブルは対象済み）
  - `tests/integration/setup/seed.ts` — `seedUser` / `seedStore` / `seedCategoryWithSubcategory` /
    `seedProductWithVariantAndSize` / `seedCountry` / `seedShippingAddress` など。
    **Order を直接 seed するヘルパーは未実装** → Step 2 で追加する。
  - 実行系: `bun run test:integration`（`jest.integration.config.js`。`bun run test` の集計外）
- **構造の手本**: `tests/integration/order-placement.test.ts` — ファイル冒頭 JSDoc で検証境界を
  列挙し、`describe("Scenario N: ...")` 単位で AAA を書く。Scenario 5（`:436-483`）の
  「throw/遷移 + 副作用なし検証（count アサート）」3 点セットを踏襲する。
- **Prisma スキーマ**（`prisma/schema.prisma`）— Order seed に必要な必須フィールド:
  - `Order`: `subTotal` / `total`（Decimal）、`shippingAddressId`、`userId`
    （`orderStatus` / `paymentStatus` / `shippingFees` はデフォルトあり）
  - `OrderGroup`: `shippingService`（String）、`shippingDeliveryMin` / `shippingDeliveryMax`（Int）、
    `shippingFees` / `subTotal` / `total`（Decimal）、`orderId`、`storeId`
  - `OrderItem`: `productId` / `variantId` / `sizeId` / `productSlug` / `variantSlug` / `sku` /
    `name` / `image` / `size`（String 群）、`price` / `totalPrice`（Decimal）、`orderGroupId`
    （`quantity` default 1、`shippingFee` default 0、`status` default Pending）

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Docker 確認 | `docker info` | exit 0（失敗なら STOP） |
| 統合テスト全体 | `bun run test:integration` | 全 pass（既存 17 + 新規） |
| 単一ファイル | `bun run test:integration -- tests/integration/order-lifecycle.test.ts` | all pass |
| 型チェック | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run lint` | exit 0 |
| unit 回帰 | `bun run test` | 全 pass（集計不変のはず） |

## Scope

**In scope**（変更してよいファイル）:
- `tests/integration/order-lifecycle.test.ts` — **新規作成**
- `tests/integration/setup/seed.ts` — `seedOrderWithGroupAndItem` ヘルパー追加のみ
  （既存 export の変更禁止。追加の前例: commit `78a20c9` の `seedShippingAddress` 追加）

**Out of scope**（触らない）:
- `src/queries/order.ts` — 検証対象本体。**バグを見つけても修正せず STOP して報告**
- `src/queries/order.test.ts`（unit テスト）・`tests/integration/order-placement.test.ts`
- `jest.integration.config.js` / `tests/integration/setup/` の seed.ts 以外
- `prisma/`（schema・migrations・seed）

## Git workflow

- ブランチ指定なし（現行ブランチ `dev` 上で作業してよい。リポジトリ運用に従う）
- コミット規律は `.claude/rules/02-tdd-step-commit.md` に従う:
  1. seed ヘルパー追加で 1 コミット（例: `test(integration): add seedOrderWithGroupAndItem helper`）
  2. テストファイル新設で 1 コミット（例: `test(integration): add order lifecycle restock scenarios`）
  3. docs 同期（下記 Test plan 末尾）は別コミット
- 各コミット時点で `bunx tsc --noEmit` が通ること。push / PR はオペレーターの指示があるまで行わない。

## Steps

### Step 1: 既存基盤の把握と drift check

冒頭の Drift check を実行。`tests/integration/order-placement.test.ts` と
`tests/integration/setup/seed.ts` を読み、mock / lifecycle（`afterAll` で `disconnectTestDb`、
`beforeEach` で `resetDb` + mock リセット）の型を確認する。

**Verify**: `bun run test:integration` → 既存 17 テスト all pass（ベースライン確認）

### Step 2: `seedOrderWithGroupAndItem` ヘルパーを追加

`tests/integration/setup/seed.ts` 末尾に追加。既存ヘルパーの規約に合わせる
（JSDoc 必須・`uniq()` サフィックス・`Prisma.Decimal` で金額指定・input interface を export）。

目標シグネチャ（load-bearing な形。細部は既存規約に合わせてよい）:

```typescript
export interface SeedOrderInput {
    userId: string;
    shippingAddressId: string;
    storeId: string;
    /** OrderItem が参照する商品一式（seedProductWithVariantAndSize の戻り値） */
    product: Product;
    variant: ProductVariant;
    size: Size;
    /** 注文数量（default 1）。Size.quantity はこの値ぶん減算済みの前提で作る */
    quantity?: number;
    /** Order.paymentStatus / OrderGroup.status の初期値（default Pending） */
    paymentStatus?: PaymentStatus;
    groupStatus?: OrderStatus;
}

/** Order + OrderGroup(1) + OrderItem(1) を一括生成する（restock 検証用の最小注文） */
export async function seedOrderWithGroupAndItem(
    db: PrismaClient,
    input: SeedOrderInput
): Promise<{ order: Order; group: OrderGroup; item: OrderItem }> { ... }
```

実装要件（金額は必ず `Prisma.Decimal` のメソッドで計算。`×`/`*` の生演算は
`.claude/steering/tech.md`（金額・数値精度）で禁止）:
- `db.order.create` → `db.orderGroup.create` → `db.orderItem.create` の順で FK を結線
- 金額の基準値をまず Decimal で定義:
  `const price = new Prisma.Decimal(size.price);`
  `const qty = input.quantity ?? 1;`
  `const lineTotal = price.mul(qty);`（`price × qty` は書かない）
- Order: `subTotal` / `total` は `lineTotal`（= `price.mul(qty)`）を用いた整合値、
  `shippingAddressId` / `userId` は input から
- OrderGroup: `shippingService: "Standard"`、`shippingDeliveryMin: 7` / `shippingDeliveryMax: 14`、
  `shippingFees: new Prisma.Decimal(0)`、`subTotal`/`total` は Order と整合、`storeId` は input から
- OrderItem: `productSlug: product.slug` / `variantSlug: variant.slug` / `sku: variant.sku` /
  `name: product.name` / `image: variant.variantImage` / `size: size.size` /
  `price: price` / `totalPrice: lineTotal`（`price.mul(qty)`）/ `quantity: qty`
- enum import は `@prisma/client` から（`OrderStatus` / `PaymentStatus`）

**Verify**: `bunx tsc --noEmit` → exit 0

### Step 3: `tests/integration/order-lifecycle.test.ts` を新設

ファイル冒頭 JSDoc に検証境界を列挙（order-placement.test.ts と同じ形式。ADR-004 への参照を含める）。
mock は `jest.mock("@clerk/nextjs/server", () => ({ currentUser: jest.fn() }))` のみ。
ADMIN 認証ヘルパーを定義:

```typescript
function mockAuthAsAdmin(): void {
    (currentUser as unknown as jest.Mock).mockResolvedValue({
        id: "admin-integration",
        privateMetadata: { role: "ADMIN" },
    });
}
```

各シナリオの共通 Arrange: `seedUser` → `seedCountry` → `seedShippingAddress` → `seedStore` →
`seedCategoryWithSubcategory` → `seedProductWithVariantAndSize`（`sizeQuantity: 8` など） →
在庫減算を模して `db.size.update({ where: { id: size.id }, data: { quantity: { decrement: qty } } })`
→ `seedOrderWithGroupAndItem`。

**Scenario 1: キャンセル遷移の子連動 + 在庫復元**
`updateOrderPaymentStatus(order.id, PaymentStatus.Cancelled)` を実行し、以下を assert:
- 戻り値 = `PaymentStatus.Cancelled`
- Order 再取得: `paymentStatus === "Cancelled"` かつ `orderStatus === "Canceled"`（親連動）
- OrderGroup: `status === "Canceled"`、OrderItem: `status === "Canceled"`（子連動）
- `Size.quantity` が減算前の値に**復元**されている（例: 8 → decrement 3 → 5 → restock → 8）

**Scenario 2: 二重キャンセルの冪等性（TOCTOU ガード）— 逐次のみ**
Scenario 1 と同じ Arrange の後、`updateOrderPaymentStatus(order.id, PaymentStatus.Cancelled)` を
**2 回逐次**実行し、以下を assert:
- 2 回とも throw しない（戻り値は両方 `Cancelled` — 関数は遷移スキップ時も status を返す設計）
- `Size.quantity` の復元は **1 回ぶんのみ**（8 のまま。16 になっていたら二重復元バグ）
- `Cancelled` → `Refunded` の再遷移でも復元が走らないこと（quantity 不変）を追加 assert

> **並行実行時の二重 restock は本シナリオの対象外（既知の TOCTOU 制約）**。この逐次テストは
> 「読んで→分岐して→復元する」の *逐次* 冪等性のみを保証する。同一注文への
> `Promise.all([updateOrderPaymentStatus(...), updateOrderPaymentStatus(...)])` のような
> **並行**呼び出しでは、両者が「まだ Cancelled でない」を読んでから両者が復元し、二重 restock が
> 起こりうる（現実装のガードが `SELECT`→分岐→`UPDATE` を単一の条件付き更新に畳んでいない場合）。
> これを塞ぐには「終端状態への遷移＋在庫復元」を条件付き `updateMany`（`where` に現ステータス条件）
> や行ロックで原子化する本体修正が必要で、**本プラン（テスト追加のみ）の scope 外**。
> 並行 restock ガードの実 DB テストは別プラン候補として Maintenance notes / README deferred に記録する
> （下記参照）。ここで並行テストは書かない（本体が未対応のため意図的に赤くしない）。

**Scenario 3: Refunded 遷移の子連動**
`updateOrderPaymentStatus(order.id, PaymentStatus.Refunded)` で
親 `orderStatus === "Refunded"` / 子 group `"Refunded"` / item `"Refunded"` + 在庫復元を assert
（Cancelled とのマッピング差分を固定）。

**Scenario 4: 非キャンセル遷移は子連動・復元なし**
`updateOrderPaymentStatus(order.id, PaymentStatus.Paid)` で:
- `paymentStatus === "Paid"` に更新される
- `orderStatus` / OrderGroup.status / OrderItem.status は **Pending のまま**
- `Size.quantity` は減算されたまま（復元されない）

**Scenario 5: `updateOrderGroupStatusAsAdmin` の遷移ガード + 親集約**
2 店舗 2 OrderGroup の注文を Arrange（seedOrderWithGroupAndItem を 2 回は使えないので、
2 つ目の group + item は helper を 2 度呼ばず `db.orderGroup.create` / `db.orderItem.create` を
直接使ってよい。または helper を 1 Order に複数 group を張れる形にしてもよい — その場合も
既存 export の互換を壊さないこと）:
- groupA を `Canceled` に更新 → groupA の商品在庫のみ復元・groupB は不変、
  親 Order.orderStatus は集約規則により `"Processing"`（混在）
- groupA をもう一度 `Canceled` に更新（終端 → 終端）→ 在庫の追加復元なし（冪等）
- groupB も `Canceled` に更新 → 親 Order.orderStatus が `"Canceled"`（全 Canceled）

**Scenario 6: 認可ガード（副作用なし）— 両 admin 関数を対象**
`currentUser` を `{ id: "user-1", privateMetadata: { role: "USER" } }` にして、
**両方の admin 関数**を個別に検証する（片方だけでは、もう一方の `requireAdmin` 欠落を
検出できない）:
- 6a: `updateOrderPaymentStatus(order.id, PaymentStatus.Cancelled)` →
  `/Only admins can perform this action/` で reject + Order / Size が一切変化していない。
- 6b: `updateOrderGroupStatusAsAdmin(group.id, OrderStatus.Canceled)`（同引数形状は
  Current state / 実装シグネチャに合わせる）→ 同じく `/Only admins can perform this action/` で
  reject + Order / OrderGroup / OrderItem / Size が一切変化していない。

> 根拠: 両関数とも冒頭で `requireAdmin()` を呼ぶ設計（本プラン「認可」節）。認可回帰は関数ごとに
> 独立して検知できる必要があるため、`updateOrderGroupStatusAsAdmin` の非管理者拒否も必須テストとする。

**Verify**: `bun run test:integration -- tests/integration/order-lifecycle.test.ts` → 全 pass

### Step 4: 全体回帰

**Verify**:
1. `bun run test:integration` → 既存 17 + 新規（Scenario 1〜6、テスト数はシナリオ内の
   it 分割に応じて 6〜10 本）全 pass
2. `bunx tsc --noEmit` → exit 0
3. `bun run lint` → exit 0
4. `bun run test` → unit 全 pass（集計不変）

## Test plan

上記 Step 3 のシナリオ 1〜6 が本体。構造の手本は `tests/integration/order-placement.test.ts`
（特に Scenario 5 の「reject + 副作用なし count 検証」）。完了後、テスト統計が変わるため
**`spec-sync-after-test` skill を必ず起動**（`.claude/rules/02-tdd-step-commit.md` の MUST。
Integration テスト数の SSOT は `docs/testing/QA_HANDOFF.md` のテスト統計テーブル）。

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `bun run test:integration` exits 0; `order-lifecycle.test.ts` の新規テストが全 pass
- [ ] `bunx tsc --noEmit` exits 0 / `bun run lint` exits 0
- [ ] `bun run test`（unit）exits 0 で**テスト数が増減しない**（integration は unit 集計外）
- [ ] `git status` で in-scope 外のファイルに変更がない
- [ ] `git log --oneline -- src/queries/order.ts` に新規コミットがない（本体無変更）
- [ ] docs 同期（QA_HANDOFF 統計 + ダッシュボード再生成）が別コミットで完了
- [ ] `plans/README.md` の 031 行が DONE に更新済み

## STOP conditions

Stop and report back (do not improvise) if:

- `docker info` が失敗する（→ status を `BLOCKED (Docker unavailable)` に）
- Drift check で `src/queries/order.ts` の該当行が本プランの抜粋と一致しない
- Scenario 2 で在庫が二重復元される、または Scenario 1 で子連動が部分的にしか起きない
  — **これは本体バグの発見**。テストを削除・skip して合わせ込まず、失敗するテストの内容と
  実測値を添えて報告する（`src/` の修正は本プランのスコープ外）
- `seedOrderWithGroupAndItem` の追加が既存 seed export のシグネチャ変更を要求する
- 検証コマンドが 2 回の修正試行後も失敗する

## Maintenance notes

- plan 012（restock spike）が item-level 遷移に在庫連動を広げる設計を出した場合、
  本テストのシナリオ 5 は「group-level のみ復元」という現仕様を固定しているため、
  実装変更時に期待値の更新が必要になる（テストが正しく赤くなる、が意図）。
- plan 027 実行後は `order-placement.test.ts`（減算側）と本ファイル（復元側）で
  在庫整合の両側が閉じる。レビュー時は両ファイルの JSDoc 境界列挙が重複しないことを確認。
- **並行 restock（TOCTOU）ガードは未カバー**（Scenario 2 の注記参照）。同一注文への並行キャンセルで
  二重復元が起きうる現実装の制約を塞ぐには、「終端遷移＋在庫復元」を条件付き `updateMany` /
  行ロックで原子化する**本体修正**が必要。これは別プラン候補として README の deferred に残す
  （本プランは逐次冪等性のみを固定する）。
- `updateOrderGroupStatusAsAdmin` の遷移ガードは read-then-act（条件付き updateMany ではない）。
  並行実行の完全な TOCTOU 耐性はスコープ外とし、逐次 2 回呼び出しの冪等性のみ固定した。
  並行キャンセルの厳密な検証が必要になったら別プランで扱う。
