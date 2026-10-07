# 在庫復元（restock）の exactly-once 化 — 設計（design.md）

> plan [012](../../../plans/012-spike-item-level-inventory-restock.md)（design/spike）の成果物。
> **本ドキュメントは設計のみ。`src/` / `prisma/schema.prisma` は 1 行も変更しない。**
> 実装手順は後続の実装プラン [087](../../../plans/087-implement-item-level-restock.md) に書く。
>
> - 調査日: 2026-10-07 / 対象 HEAD: `cfbcd9a6`（branch `dev`）
> - ドリフトチェック（`f9752c0..HEAD -- src/queries/order.ts src/queries/user.ts`）: 2 ファイルとも大きく変わっている（+1240 / −868）。
>   plan 012 本文の行番号と抜粋は古い。本書の file:line は上記 HEAD で取り直した値を使う。
> - STOP 条件の判定: item 単位の遷移で在庫は**まだ戻らない**（`order.ts:583` の TODO は未着手）。spike は有効。
>   ただし plan 012 の起票後に **3 本目の復元経路**（admin の group 単位）が入っており、その経路と order 単位の経路のあいだで
>   **二重復元がすでに起こりうる**（§1.2 F-1）。本書はこれも含めて設計する。
> - 相互参照: plan [018](../../../plans/018-spike-returns-rma-workflow.md)（返品 RMA）は本書 §5 の接続点を前提にする。

---

## 0. 設計の前提（実コードで確認した事実）

| #   | 事実 | 出典 |
| --- | ---- | ---- |
| 0-1 | 在庫は `placeOrder` が tx 内の条件付き `updateMany`（`quantity >= n` のときだけ減算）で減らす。`count === 0` なら tx 全体をロールバックする | [`user.ts:1053-1063`](../../../src/queries/user.ts) |
| 0-2 | 復元のヘルパーは `restockOrderItems`。`tx.size.update`（**`update`**）で `increment` する。対象の Size が無いと P2025 で throw する | [`order.ts:31-42`](../../../src/queries/order.ts) |
| 0-3 | 「復元の対象になる終端」の判定は `isRestockTerminalOrderStatus`（OrderStatus の `Canceled` / `Refunded`）だけ。ProductStatus 用の判定は無い | [`order.ts:21-24`](../../../src/queries/order.ts) |
| 0-4 | **経路 A（order 単位・admin）** `updateOrderPaymentStatus`: tx 内で `Order.paymentStatus` を条件付き `updateMany`（`notIn [Cancelled, Refunded]`）し、`count === 1` のときだけ子の group / item を一括で終端へ書き換え、**注文内の全 item** を復元する | [`order.ts:604-690`](../../../src/queries/order.ts)（遷移 `:632`、子連動 `:659-666`、復元 `:674-680`） |
| 0-5 | **経路 B（group 単位・admin）** `updateOrderGroupStatusAsAdmin`: tx 内で `FOR UPDATE` を取り、更新前の group status が非終端で更新後が終端のときだけ、**その group の全 item** を復元する。**item の status は書き換えない** | [`order.ts:489-552`](../../../src/queries/order.ts)（ロック `:499`、判定と復元 `:525-533`） |
| 0-6 | **経路 C（item 単位・admin）** `updateOrderItemStatusAsAdmin`: tx なしの `db.orderItem.update`。復元は無い（`TODO(在庫連動・スコープ外)`） | [`order.ts:566-595`](../../../src/queries/order.ts)（TODO `:583`） |
| 0-7 | **経路 D（item 単位・seller）** `updateOrderItemStatus`: 所有店舗にスコープした `updateMany`（tx なし）。任意の ProductStatus へ書き換えられ、復元は無い | [`order.ts:281-335`](../../../src/queries/order.ts)（`:315`） |
| 0-8 | **経路 E（group 単位・seller）** `updateOrderGroupStatus`: tx 内で `FOR UPDATE` を取り group を更新し、通知を記録する（plan 086）。復元は無い | [`order.ts:180-273`](../../../src/queries/order.ts)（`:246`） |
| 0-9 | Stripe / PayPal の webhook は `Order.paymentStatus` を `Refunded` 等へ直接書く。子の連動も復元も無い | [`webhooks/stripe/route.ts:23-37`](../../../src/app/api/webhooks/stripe/route.ts) / [`webhooks/paypal/route.ts:264`](../../../src/app/api/webhooks/paypal/route.ts) |
| 0-10 | `updateProduct` は Size を **全削除して再作成**する（ID が変わる）。`OrderItem.sizeId` は Size へのリレーションを持たない素の `String` なので、注文後に商品を編集すると参照先が消える | [`product.ts:719-731`](../../../src/queries/product.ts) / [`schema.prisma:795-816`](../../../prisma/schema.prisma) |
| 0-11 | Prisma は 6.19.3。`updateManyAndReturn` が使える。`*AndReturn` は Accelerate 拡張済みの tx でも動いている（`createManyAndReturn` の先例） | [`package.json:26`](../../../package.json) / [`notifications/record.ts:27`](../../../src/lib/notifications/record.ts) |
| 0-12 | exactly-once の既存テストは経路 A の内部（逐次・並行の二重キャンセル）と経路 B の内部（再キャンセル）だけ。**経路をまたぐ組み合わせのテストは無い** | [`order-lifecycle.test.ts:251-336, 413-501`](../../../tests/integration/order-lifecycle.test.ts) |
| 0-13 | seller の item 用 UI は全 ProductStatus を選択肢に出し、action が throw すれば toast を出す | [`product-status-select.tsx:24-48`](../../../src/components/dashboard/forms/product-status-select.tsx) |

## 1. 問題の全体像

### 1.1 不変条件

> **I-1**: ある `OrderItem` の `quantity` は、`placeOrder` で減算された後、**高々 1 回だけ** `Size.quantity` へ戻る。

復元の判断材料が経路ごとに違う。経路 A は `Order.paymentStatus`、経路 B は `OrderGroup.status` を見ている。
そのため、ある経路が「もう戻した」ことを別の経路は知らない。これが二重復元の根本原因である。

### 1.2 発見事項（現行コードの欠陥）

| ID | 内容 | 再現手順 | 重大度 |
| --- | --- | --- | --- |
| F-1 | **経路 B → 経路 A の二重復元** | admin が group G を `Canceled` にする（G の在庫が戻る。item の status は元のまま）→ 同じ注文の支払いを `Refunded` にする（`paymentStatus` は非終端なので遷移し、**G を含む全 item** が戻る）→ G の在庫が 2 回戻る | 中（在庫の水増し → 売り越し） |
| F-2 | **経路 B の再オープンによる二重復元** | group を `Canceled` → `Processing` → `Canceled` と変える。2 回目も「非終端 → 終端」と判定されて再び戻る（item の status は変わらないので痕跡が残らない） | 中 |
| F-3 | **Size が無いと取り消しそのものが失敗する** | 注文後に seller が商品を編集する（Size が作り直される）→ admin が取り消す → `tx.size.update` が P2025 で throw → tx 全体がロールバックし、**取り消しも支払い状態の更新もできない** | 中（運用が止まる） |
| F-4 | 経路 C / D / E は在庫を戻さない | item を `Canceled` にしても在庫は減ったまま（plan 012 の当初の論点） | 低〜中（在庫の過少） |

いずれも認可の欠陥ではないため、plan 012 の P1 STOP には当たらない。F-1 から F-3 は本書の設計で一緒に直す。

## 2. Q1 — exactly-once の仕組み

### 決定: (b) を採る。印は **OrderItem.status** に置き、item 単位の条件付き更新を唯一の入口にする

**復元済みの印は `OrderItem.status ∈ RESTOCK_TERMINAL` そのものとする。** 新しい列は足さない（マイグレーション無し）。

```ts
// 新設（src/lib/order-restock.ts などの非 "use server" モジュール。order.ts の非公開ヘルパーでもよい）
export const RESTOCK_TERMINAL_ITEM_STATUSES = [
    ProductStatus.Canceled,
    ProductStatus.Refunded,
    ProductStatus.Returned,
] as const;

/**
 * 対象 item のうち「まだ終端でないもの」だけを終端へ遷移させ、遷移した行の在庫だけを戻す。
 * 遷移と復元は呼び出し側の tx の中で行う。戻り値は実際に遷移した item。
 */
const settleOrderItems = async (
    tx: OrderTransactionClient,
    where: Prisma.OrderItemWhereInput,          // { id } / { orderGroupId } / { orderGroup: { orderId } }
    status: (typeof RESTOCK_TERMINAL_ITEM_STATUSES)[number],
    options: { restock: boolean } = { restock: true }
) => {
    const settled = await tx.orderItem.updateManyAndReturn({
        where: { AND: [where, { status: { notIn: [...RESTOCK_TERMINAL_ITEM_STATUSES] } }] },
        data: { status },
        select: { id: true, sizeId: true, quantity: true },
    });
    if (options.restock) await restockOrderItems(tx, settled);
    return settled;
};
```

**根拠**

- **経路をまたいでも二重にならない。** どの経路も同じ item 行の同じ列を条件付きで書き換える。2 本目の経路では、すでに終端の item が `RETURNING` に出てこないため、その item は戻らない。plan 012 Q1 の注記（「単一エンティティの遷移ガードは別経路を守らない。item に錨を置け」）をそのまま満たす。
- **並行しても二重にならない。** PostgreSQL の READ COMMITTED では、`UPDATE … WHERE status NOT IN (…)` が行ロックを待ったあと、**ロック取得後の行に対して WHERE を評価し直す**（EvalPlanQual）。先に commit した tx が終端にした行は、後の tx の `RETURNING` に含まれない。`placeOrder` の条件付き減算（0-1）や経路 A の `count === 1`（0-4）と同じ性質で、明示の `FOR UPDATE` は要らない。
- **(a) の `restockedAt` 列を採らない理由。** 印が status と別の列にあると、「status は Canceled なのに restockedAt が NULL」という組み合わせが作れてしまい、どちらを正とするかの規則がまた必要になる。status を印にすれば矛盾した状態を表現できない。マイグレーションも不要になる。
- **`count` ではなく `updateManyAndReturn` を使う理由。** 経路 A / B は複数の item を一度に扱う。どの行が遷移したかが分からないと、「遷移した行だけ戻す」ができない（0-11 で使えることを確認した）。

### 2.1 付随する規則: 終端は**吸収状態**にする

印を status に置く以上、**終端から非終端へ戻すことを禁じる**（I-2）。戻せてしまうと、`Canceled → Processing → Canceled` で 2 回戻る（F-2 の item 版）。

| 遷移 | 扱い |
| --- | --- |
| 非終端 → 終端 | `settleOrderItems` 経由で遷移し、在庫を戻す |
| 終端 → 別の終端（例: `Canceled → Refunded`） | 許可する（表示の付け替え）。在庫は**戻さない** |
| 終端 → 非終端 | **拒否する**（`"Order item is already settled."` を throw。UI は既存の toast で表示する。0-13） |
| 非終端 → 非終端 | 従来どおり（条件なしで更新） |

再出荷が必要な業務は、終端の item を再オープンして扱わない。返品・交換は plan 018 の RMA が新しい行として扱う（§5）。

## 3. Q2 — 復元の対象になる終端 status（綴りを含む）

| enum | 復元の対象 | 備考 |
| --- | --- | --- |
| `ProductStatus`（OrderItem） | **`Canceled`, `Refunded`, `Returned`** | L は 1 つ（`Canceled`）。[`schema.prisma:743-772`](../../../prisma/schema.prisma) |
| `OrderStatus`（OrderGroup / Order.orderStatus） | `Canceled`, `Refunded`（**現行の `isRestockTerminalOrderStatus` のまま**） | L は 1 つ。`Returned` も存在するが、group 単位の返品は RMA（018）が item 単位で扱うので対象に加えない |
| `PaymentStatus`（Order.paymentStatus） | `Cancelled`, `Refunded`（経路 A のトリガー） | **L が 2 つ**（`Cancelled`）。[`schema.prisma:666-675`](../../../prisma/schema.prisma) |

`ExchangeRequested` / `FailedDelivery` / `OnHold` は終端ではない（品物はまだ顧客側か配送中にある）ので対象外。

## 4. Q3 / Q4 — 経路ごとの tx の形と、経路の組み合わせ

### 4.1 各経路の目標の形

すべての経路が「復元を判断するときは `settleOrderItems` だけを見る」形にそろえる。

**経路 C（item・admin）** — tx が無いので包む（Q4）。

```ts
return db.$transaction(async (tx) => {
    const current = await tx.orderItem.findUnique({ where: { id }, select: { status: true } });
    if (!current) throw new Error("Order item not found");
    if (isRestockTerminalItem(current.status) && !isRestockTerminalItem(status)) {
        throw new Error("Order item is already settled.");      // I-2
    }
    if (isRestockTerminalItem(status)) {
        const settled = await settleOrderItems(tx, { id }, status);
        // 遷移しなかった（すでに終端）= 終端 → 終端の付け替え。在庫は戻さない
        if (settled.length === 0) await tx.orderItem.update({ where: { id }, data: { status } });
    } else {
        // 非終端への更新は「現在も非終端であること」を条件にする（I-2 の判定と書き込みの隙間を塞ぐ）
        const r = await tx.orderItem.updateMany({
            where: { id, status: { notIn: [...RESTOCK_TERMINAL_ITEM_STATUSES] } },
            data: { status },
        });
        if (r.count === 0) throw new Error("Order item is already settled.");
    }
    return status;
});
```

**経路 D（item・seller）** — 経路 C と同じ形にする。`where` には所有店舗のスコープ（`orderGroup: { storeId }`）を必ず足す（IDOR 対策の現行の形を保つ）。

**経路 B（group・admin）** — group status の判定（`isRestockTerminalOrderStatus`）は**通知の遷移判定にだけ**使う。復元は次の 1 行に置き換える。

```ts
if (isRestockTerminalOrderStatus(status)) {
    await settleOrderItems(tx, { orderGroupId: groupId }, toItemStatus(status));   // Canceled→Canceled, Refunded→Refunded
}
```

group を `Canceled → Processing → Canceled` と動かしても、item はすでに終端なので 2 回目は何も戻らない（F-2 が直る）。

**経路 E（group・seller）** — 経路 B と同じ 1 行を足す（Q5）。

**経路 A（order・admin）** — `paymentStatus` の条件付き遷移（`didTransition`）は**残す**（`Order.orderStatus` と group の連動を 1 回に絞るため）。ただし、子 item の一括更新と復元は `settleOrderItems` に置き換え、`didTransition` には依存させない。

```ts
if (isCancelOrRefund) {
    if (didTransition) await tx.orderGroup.updateMany({ where: { orderId }, data: { status: childOrderStatus } });
    await settleOrderItems(tx, { orderGroup: { orderId } }, childItemStatus);
}
```

- 終端になっていない item だけが遷移する。経路 B / C / D で先に戻した item は対象にならない（F-1 が直る）。
- **挙動の変更点**: 現行は子 item を全部 `Refunded` で上書きする。新しい形では、先に `Canceled` だった item は `Canceled` のまま残る（item ごとの履歴を保つ）。経路 A を `didTransition` から切り離すため、webhook が先に `paymentStatus = Refunded` を書いていても（0-9）、admin の操作で item が終端になり在庫が戻る。現行では、この場合に在庫が戻らない。

**`restockOrderItems` の変更（F-3）** — `tx.size.update` を `tx.size.updateMany({ where: { id } })` に変える。`count === 0`（Size が作り直された・削除された）のときは `console.warn` に構造化ログを残し、処理を続ける。消えた SKU の在庫を戻す先は無いので、取り消しを止める理由にはならない。

### 4.2 経路の組み合わせ表（1 本目 × 2 本目 → 2 本目で戻る量）

対象は「同じ item X を含む注文」。「—」は 2 本目で何も戻らないことを表す。

| 1 本目 \ 2 本目 | C/D: item X を終端へ | B/E: X の group を終端へ | A: 注文を Cancelled/Refunded へ |
| --- | --- | --- | --- |
| **C/D: item X を終端へ** | —（すでに終端。付け替えのみ） | X 以外の group 内 item だけ | X 以外の注文内 item だけ |
| **B/E: X の group を終端へ** | —（X はすでに終端） | —（group 内の item はすべて終端） | 他の group の item だけ（**現行は X も戻る = F-1**） |
| **A: 注文を終端へ** | —（すでに終端） | —（すでに終端） | —（すでに終端） |
| **並行（同じ組み合わせ）** | 行ロック後の再評価で片方だけが X を `RETURNING` する | 同左 | 同左 |

どの組み合わせでも、X の在庫は**ちょうど 1 回**だけ戻る（I-1）。

## 5. Q5 — seller の経路を含めるか

### 決定: **含める**（経路 D と経路 E の両方）

根拠は、**印を status に置くと、seller の経路を外すことが在庫の消失につながる**ことにある。seller が item を `Canceled` にして復元を伴わない場合、その item はすでに終端なので、後から admin が注文を返金しても `settleOrderItems` に拾われない。在庫は永遠に戻らない（現行では経路 A が全 item を戻すので、たまたま救われている）。I-1 と「終端 ⇔ 戻した」という対応を守るには、**終端へ書き込む経路をすべて** `settleOrderItems` に通す必要がある。

seller が自分の在庫を増やせてしまう点は悪用にならない。seller は商品編集で `Size.quantity` を直接書けるからである。

## 6. Q6 — 返金との結合

### 決定: 復元は**履行状態（item status）の遷移**だけで行い、返金の確定（DIRECTION-01）は待たない

- 在庫は「品物が売れる状態に戻ったか」の問題で、お金が戻ったかとは別の関心事である。経路 C / D は決済と無関係な履行状態の操作だと明記されている（[`order.ts:557-560`](../../../src/queries/order.ts) の JSDoc）。
- webhook による返金（0-9）は `paymentStatus` だけを書き、item には触れない。**この挙動は変えない。** 部分返金や、品物を回収しない返金（破損品の返金など）で在庫を戻すと水増しになるからである。
- 品物を回収しない返金のための口として、`settleOrderItems` の `options.restock = false` を用意しておく（012 の範囲では、どの呼び出し元も `true` を渡す）。plan 018 の RMA は部分返品を扱うため、この口ではなく「差し引き方式」で組み合わせる。返品の受け取り時に明細の数量だけ在庫を戻し、`settleOrderItems` は `quantity − 返品済み数量` だけを戻す（[`returns-rma/design.md` §4.3](../returns-rma/design.md)。088 で本ヘルパーを拡張する）。

## 7. 範囲外と後続

- **実装**: [plan 087](../../../plans/087-implement-item-level-restock.md)（受け入れの要は「経路をまたいでも在庫がちょうど 1 回だけ戻る」統合テスト）。
- 部分返品との組み合わせ: [`returns-rma/design.md` §4.3](../returns-rma/design.md)（印を status に置く本書の決定は変えない）。
- 返金の実行（Stripe / PayPal の返金 API）は DIRECTION-01 で扱う。webhook と item の連動も同じ。
- group status の再オープン（`Canceled → Processing`）は、表示用として引き続き許す。item は吸収状態なので在庫には影響しない。運用で混乱するなら、group 側にも I-2 を適用する（後続で判断する）。
- `OrderItem.sizeId` を Size へのリレーション（`onDelete: SetNull`）にするかどうかは、スキーマ変更を伴うので本書では決めない。F-3 は `updateMany` への変更で解消する。
