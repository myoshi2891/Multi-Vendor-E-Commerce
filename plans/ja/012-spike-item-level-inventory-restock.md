# プラン 012（design/spike）: 在庫復元をアイテムレベルの status 遷移まで拡張する

> 原本: [../012-spike-item-level-inventory-restock.md](../012-spike-item-level-inventory-restock.md)

> **Executor 向け指示**: これは **design/spike** プランであり、ビルドプランでは**ない**。
> 成果物は文書化された設計ドキュメントと概念実証の調査である — 決定事項と後続の
> 実装プランを作成するのであって、本プランで機能を出荷**しない**。読み取り専用の調査を行い、
> 未解決の問いにエビデンスとともに答え、設計ドキュメントを書き、STOP する。
> 完了したら `plans/README.md` のこのプランのステータス行を更新する。
>
> **ドリフトチェック（最初に実行）**: `git diff --stat f9752c0..HEAD -- src/queries/order.ts src/queries/user.ts`
> どちらかがこのプラン作成後に変更されていれば、設計する前に現行の
> `updateOrderItemStatusAsAdmin` / `updateOrderPaymentStatus` / `restockOrderItems`
> を再読すること；大きな構造変更があれば設計ドキュメントに記す。

## Status

- **Priority**: P3
- **Effort**: M（spike + 設計ドキュメント；実装は別途フォローアッププラン）
- **Risk**: MED（金銭/在庫の正確性 — これが最初に spike とする理由）
- **Depends on**: none（ただし将来の実装プランの情報源となる）
- **Category**: direction
- **Planned at**: commit `f9752c0`, 2026-07-03

## なぜ重要か

注文が確定した際に在庫は減算される（`placeOrder`、原子的な check-and-decrement）が、逆方向 — キャンセル/返品/返金時に在庫を戻すこと — は**部分的にしか**実装されていない。注文レベルの支払いステータス経路（`updateOrderPaymentStatus`）は既に二重復元ガード付きで原子的に在庫復元している。しかし**アイテムレベル**の admin 経路（`updateOrderItemStatusAsAdmin`）は、明示的な `TODO` とともに単一の `OrderItem` を `Canceled`/`Refunded`/`Returned` に変更するが**在庫復元は行わない**。したがって個別にキャンセルされたアイテムは、販売可能在庫を恒久的に過少計上する — SELLER の「在庫管理の操作性」KPI を損ない、幻の在庫切れで GMV を押し下げる。難しいのは `increment` を書くことではなく、アイテムが2つの異なるコードパス（アイテムレベルと注文レベル）で反転され得るときに**ちょうど一度だけ**の在庫復元を保証することである。本 spike はコードを書く前にこの設計を決める。

## Current state（設計前に必ず読むこと）

### 未実装のフック — `src/queries/order.ts:521-539`（`updateOrderItemStatusAsAdmin`）

```ts
export const updateOrderItemStatusAsAdmin = async (
    orderItemId: string,
    status: ProductStatus
): Promise<ProductStatus> => {
    const admin = await requireAdmin();
    try {
        const updated = await db.orderItem.update({
            where: { id: orderItemId },
            data: { status },
            select: { status: true },
        });
        console.error(`[Admin:updateOrderItemStatus] actor=${admin.id} target=${orderItemId} to=${status}`);
        // TODO(在庫連動・スコープ外): status が Canceled/Returned のとき在庫復元フックをここに（判断5-2）
        return updated.status as ProductStatus;
    } catch (error: unknown) { /* structured log + rethrow */ }
};
```

これは単純な `db.orderItem.update` を使っている点に注意 — **`$transaction` の中ではない**し、アイテムの `sizeId`/`quantity` やその前の status を読んでもいない。

### 既に動作している注文レベルの在庫復元 — `src/queries/order.ts:562-651`（`updateOrderPaymentStatus`）

これが鏡写しにすべきパターンである。`db.$transaction` の中で実行され、「非終端 → Cancelled/Refunded」の遷移を原子的にするために**条件付き `updateMany`**（`didTransition = transition.count === 1`）を使い、実際に遷移が起きた場合のみ在庫を復元する:

```ts
const transition = await tx.order.updateMany({
    where: { id: orderId, paymentStatus: { notIn: [Cancelled, Refunded] } },
    data: { paymentStatus: status, orderStatus: childOrderStatus },
});
didTransition = transition.count === 1;
// ...
if (isCancelOrRefund && didTransition) {
    const items = await tx.orderItem.findMany({ where: { orderGroup: { orderId } }, select: { sizeId: true, quantity: true } });
    await restockOrderItems(tx, items);
}
```

### 在庫復元ヘルパー — `src/queries/order.ts:23-33`

```ts
const restockOrderItems = async (
    tx: OrderTransactionClient,
    items: { sizeId: string; quantity: number }[]
): Promise<void> => {
    for (const item of items) {
        await tx.size.update({ where: { id: item.sizeId }, data: { quantity: { increment: item.quantity } } });
    }
};
```

### 減算側（鏡写しにする対象） — `src/queries/user.ts:716-727`（`placeOrder`）

`count === 0` = 在庫切れロールバックとなる原子的な条件付き減算。在庫復元はその逆である。

### 兄弟の seller 経路

`updateOrderItemStatus`（seller、`src/queries/order.ts:229`）もアイテムの status を変更しており、同様に在庫復元が欠けている — 設計は最終的な実装において seller 経路がスコープ内か外かを述べるべきである。

### ちょうど一度だけの問題（設計上の中核的な問い）

`OrderItem` は**2つ**の経路で終端の反転状態に移り得る:
1. `updateOrderItemStatusAsAdmin`（アイテム粒度）、そして
2. `updateOrderPaymentStatus`（注文粒度 — `restockOrderItems` 経由で全アイテムを復元）。

アイテム X が個別にキャンセルされ（経路1が在庫を復元）、後に注文全体が返金された場合（経路2が再度在庫を復元）、在庫は**二重に**加算される。注文レベルの経路は*それ自身の中で*二重復元をガードする（`notIn` 遷移ガード）が、個々のアイテムがアイテムレベルの経路で既に復元済みかどうかは**知らない**。これが本 spike が解決すべき相互作用である。

### 最終的な実装が守るべきリポジトリ規約

- 複数テーブルの書き込みは `db.$transaction` を使う（`.claude/steering/tech.md`）。
- check-and-act には原子的な条件付き `updateMany`（read-then-write の TOCTOU を回避）— `placeOrder` と `updateOrderPaymentStatus` の両方で確立されたパターン。
- 金額には `Prisma.Decimal`；ただしここでの数量は `Int`。
- Admin アクションは `requireAdmin` でガードされる（既に存在）。
- IDOR テストは3階層パターン（`docs/testing/SECURITY_GAP_REPORT.md` §5.2）を使用；統合テストは testcontainers を使用（ADR-004）。

## 必要なコマンド（読み取り専用の調査）

| 目的               | コマンド                                       | 期待結果            |
|-----------------------|-----------------------------------------------|---------------------|
| スキーマを読む           | `prisma/schema.prisma` の `OrderItem` を確認    | 下記のフィールドを見る    |
| status enum を見つける      | `grep -n "Returned\|Canceled\|Refunded" src/lib/types.ts prisma/schema.prisma` | enum 値 |
| 既存の在庫復元テスト| `grep -rn "restock" src/queries/order.test.ts tests/integration/` | 現行カバレッジ |

（本プランでのプロダクション編集はなし — 調査 + 設計ドキュメントのみ。）

## Scope

**対象内**（本 spike が生成するもの）:
- `docs/design/inventory-restock/design.md` の設計ドキュメント（ディレクトリを新規作成）— 以下の未解決の問いに、リポジトリの設計ドキュメント規約に従って答える（構造は既存の `docs/design/*/design.md` を参照）。
- 後続の**実装**プランファイルを**次に空いている番号**で `plans/<next-free-number>-implement-item-level-restock.md` として作成する。実行時に `plans/` 配下の数字 prefix を調べ、使用済み番号を再利用しないこと。他のプランと同じテンプレート水準で executor が実行できるよう書く — ただし設計判断が確定した後に限る。

**対象外**（本プランで行わないこと）:
- `src/queries/order.ts`、`src/queries/user.ts`、スキーマへの変更。これは設計のみ。
- 下流の実際の資金移動を伴う返金実行（Stripe/PayPal 返金 API）— それは別の direction（DIRECTION-01）；在庫復元と返金実行は組み合わさるよう設計すべきだが別物である。

## Spike が必ず答えるべき未解決の問い（エビデンスとともに）

1. **ちょうど一度だけのメカニズム。** 以下のいずれかを選び正当化する:
   - (a) すべての在庫復元経路が同じ `$transaction` 内で check-and-set を原子的に行う `OrderItem.restockedAt` / `restocked: Boolean` カラム（スキーマ移行）；または
   - (b) status 履歴から「既に復元済み」を導出する — すなわち終端状態への*遷移時にのみ*在庫を復元し、両経路がアイテムに対する条件付き `updateMany`（`where: { id, status: { notIn: [terminal...] } }`）を使うことで、2回目の試行が `count === 0` を見るようにする。
   既存の `updateMany` 遷移パターンを踏まえてどちらがよりシンプルで安全かを述べる。（選択肢 (b) は既存コードを鏡写しにしマイグレーションを回避する；選択肢 (a) は明示的だがスキーマの表面を増やす。どちらか一方を推奨すること。）
   - **選択肢 (b) の注意点**: 単一エンティティの status 遷移ガードだけでは、アイテムレベルの `updateOrderItemStatusAsAdmin` と注文レベルの `updateOrderPaymentStatus` のような**異なる経路間**の二重在庫復元を防げない。両者は異なる行を遷移させるためである。(b) を選ぶ場合も、exactly-once の根拠は**アイテムレベル**に置き、両経路が同じ `$transaction` 内で check-and-set するアイテム単位の条件付き `updateMany` または marker を使うこと。注文/order-group の status 遷移だけを根拠にしてはならない。Q3 も参照。
2. **どの終端 status が在庫復元をトリガーするか？** `Canceled`、`Refunded`、`Returned` — 正確な `ProductStatus`/`OrderStatus` の enum 綴りを確認する（既存コードの `PaymentStatus` と `OrderStatus` の間の `Cancelled` vs `Canceled` の二重l/単一lの違いに注意）。正確な値を列挙すること。
3. **アイテムレベル vs 注文レベルの相互作用。** `updateOrderItemStatusAsAdmin` と `updateOrderPaymentStatus` が同じアイテムへの二重クレジットをどう回避するかを specify する（ここで選択肢 (a)/(b) が効いてくる）。具体的なトランザクション形状を示す。
4. **トランザクション境界。** `updateOrderItemStatusAsAdmin` は現在 `$transaction` の中にない。実装が status 更新 + 在庫復元を原子的に包む必要があることを確認し、遷移を冪等にする `where` ガードを specify する。
5. **Seller 経路。** `updateOrderItemStatus`（seller）を最初の実装に含めるか先送りするかを決め、正当化する。
6. **返金との結合。** 在庫復元が status 単独で発火するのか、DIRECTION-01 の返金確認を待つ必要があるのかを述べ、その理由を示す（推奨: 在庫復元は決済返金とは別関心事であるため、フルフィルメントステータスの遷移で発火し、決済返金から独立させる）。

## Steps

### Step 1: 調査

「Current state」内のファイル、加えて `prisma/schema.prisma`（`OrderItem`、`Size`、status enum 群）と既存の在庫復元テストを読む。enum の綴りと利用可能な正確なトランザクションプリミティブ（`OrderTransactionClient` 型、`tx.size.update` / `updateMany`）を確認する。

**検証**: `file:line` のエビデンスとともに、`updateOrderPaymentStatus` が使うちょうど一度だけのガードと、それが現状アイテムレベルの経路をカバーしていない理由を述べられること。

### Step 2: 設計ドキュメントを書く

`docs/design/inventory-restock/design.md` を作成し、6つの未解決の問いすべてに推奨判断とともに答え、`updateOrderItemStatusAsAdmin` の具体的な目標トランザクション形状と、二重在庫復元の相互作用マトリクス（アイテム経路 × 注文経路）を記す。既存の `docs/design/*/design.md` の構造に従うこと。

**検証**: すべての未解決の問いに判断 + 根拠 + エビデンスがある；ドキュメントが正確な enum 値と選択したちょうど一度だけのメカニズムを名指ししている。

### Step 3: 後続の実装プランを書く

`plan-template.md` の水準（自己完結、ドリフトチェック、検証ゲート、STOP conditions）を使い、実行時点の次の空き番号を選んで `plans/<next-free-number>-implement-item-level-restock.md` を書く。executor がこれを実行して*決定済みの*設計 — トランザクションラップ、ガード、`restockOrderItems` の再利用、テスト計画（モックした `tx` によるユニット；ADR-004 に従い `tests/integration/` 配下で両経路にわたり在庫がちょうど一度だけ増分することを assert する統合テスト）— を実装できるようにする。

**検証**: フォローアッププランが具体的な `file:line` を引用し、機械的に検証可能な done criteria を持ち、その scope が DIRECTION-01 の返金実行を除外している。

## Done criteria

以下すべてを満たすこと:

- [ ] `docs/design/inventory-restock/design.md` が存在し、6つの未解決の問いすべてに判断 + エビデンスとともに答えている
- [ ] 設計が、在庫復元をトリガーする正確な enum 値と、選択したちょうど一度だけのメカニズム（a または b）を正当化とともに名指ししている
- [ ] `plans/<next-free-number>-implement-item-level-restock.md` が作成時点で空いていた番号に存在し、テンプレート準拠で、zero-context executor 向けに準備されている
- [ ] ソースファイルやスキーマが変更されていない（`git status` は新規 docs/plan ファイルと、下記の `plans/README.md` の索引更新のみを示す）
- [ ] `plans/README.md` の 012 のステータス行が更新され、新しい後続プランが選択した番号で索引に追加されている

## STOP conditions

以下に該当する場合は停止して報告すること:

- 現行コードが既にアイテムレベルの遷移で在庫復元している（`order.ts:538` の TODO が埋められている）— その場合本 spike は不要；報告してクローズする。
- ちょうど一度だけの設計が、安全性に確信が持てないスキーマ移行を要求する — 選択肢 (b)（移行なし）を推奨し、spike 内でマイグレーションにコミットするのではなくトレードオフをフラグする。
- 在庫復元と DIRECTION-01 の返金フローが既に設計を変えるような形で結合していることを発見する — 文書化して報告する。

## Maintenance notes

- この在庫復元設計を、もし並行して進められるなら DIRECTION-01 の返金実行設計と整合させ続けること — 両者は同じキャンセル/返金遷移に触れ、（フルフィルメントステータスで在庫復元、決済ステータスで返金という形で）組み合わさるべきであり、衝突すべきではない。
- 最終的な実装は `restockOrderItems`（`order.ts:23`）を再利用する — increment ロジックを重複させないこと。
- 後続の実装のレビュアーは、ちょうど一度だけのガードを最も厳しく精査すべきである: アイテムがアイテムレベルでキャンセルされ、その後注文が注文レベルで返金された際に在庫が**ちょうど一度だけ**増分することを証明する統合テストが、鍵となる受け入れゲートである。
