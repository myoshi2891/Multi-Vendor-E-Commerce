# プラン 001: `updateOrderItemStatus` の order-item lookup を所有店舗にスコープする（クロスストア IDOR 修正）

> 原本: [../001-scope-order-item-status-to-owned-store.md](../001-scope-order-item-status-to-owned-store.md)

> **Executor 向け指示**: このプランを順番どおりに実行すること。各検証コマンドを実行し、
> 次のステップに進む前に期待結果を確認する。「STOP 条件」に該当する事象が起きたら、
> 停止して報告すること — 独自判断で進めない。完了したら `plans/README.md` の
> このプランのステータス行を更新する。
>
> **ドリフトチェック（最初に実行）**: `git diff --stat f9752c0..HEAD -- src/queries/order.ts src/queries/order.test.ts`
> 対象ファイルのいずれかがこのプラン作成後に変更されていれば、「Current state」の
> 抜粋を実コードと比較すること。不一致があれば STOP 条件として扱う。

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `f9752c0`, 2026-07-03

## なぜ重要か

`updateOrderItemStatus` は呼び出し元が `storeId` で渡した店舗を所有していることを検証するが、その後 `id` のみで対象の order item を検索しており、そのアイテムが実際にその店舗に属することを一切確認していない。**何らかの**店舗を所有する SELLER は自分の `storeId`（所有権ゲートを通過）と被害店舗の `orderItemId` を組み合わせて渡すことで、そのアイテムのフルフィルメントステータス（Shipped / Delivered / Canceled / Refunded）を書き換えられる。これは他の販売者の注文状態を破壊するクロステナント IDOR である。兄弟関数 `updateOrderGroupStatus` は既に正しくスコープされており（`findUnique({ where: { id: groupId, storeId } })`）、本プランはリポジトリの原子的所有権チェーンパターンを用いて item レベルの更新を同じ水準に引き上げる。

## Current state

- `src/queries/order.ts` — 注文用のサーバーアクション群。`updateOrderItemStatus` が脆弱な関数であり、同ファイルの `updateOrderGroupStatus` が模範とすべき正しい兄弟関数。

脆弱なコード、`src/queries/order.ts:229-280`（`f9752c0` 時点）:

```ts
export const updateOrderItemStatus = async (
    storeId: string,
    orderItemId: string,
    status: ProductStatus
) => {
    // Retrieve the current user
    const user = await currentUser();
    if (!user) throw new Error("Unauthenticated.");
    if (user.privateMetadata.role !== "SELLER")
        throw new Error("Only sellers can perform this action.");

    // Ensure the user is a seller of the specified store
    const store = await db.store.findUnique({
        where: { id: storeId, userId: user.id },
    });
    if (!store) {
        throw new Error("Unauthorized to update order item status.");
    }

    // Retrieve the product item to be updated
    const product = await db.orderItem.findUnique({
        where: { id: orderItemId },          // ← NOT scoped to the store
    });
    if (!product) {
        throw new Error("Order item not found");
    }

    // Update the order status
    const updatedProduct = await db.orderItem.update({
        where: { id: orderItemId },
        data: { status },
    });
    return updatedProduct.status;
};
```

参照すべき正しい兄弟関数、`src/queries/order.ts:193-215`:

```ts
const order = await db.orderGroup.findUnique({
    where: { id: groupId, storeId: storeId },
});
if (!order) { throw new Error("Order not found"); }
const updatedOrder = await db.orderGroup.update({
    where: { id: groupId },
    data: { status },
});
```

### 必要なデータモデルの事実

`OrderItem` は親の `OrderGroup` を経由して店舗に紐づく: `OrderItem.orderGroup` → `OrderGroup.storeId`。**`OrderItem` に直接の `storeId` カラムは無い**。したがって所有権スコープはリレーション経由（`orderGroup: { storeId }`）で行う必要がある。

### 適用すべきリポジトリ規約

- **原子的所有権チェーンパターン**（模倣すべき手本）: `src/queries/inventory.ts:104-138`（`updateSizeStock`）は所有権チェックを単一の `updateMany` の where 句に折り込み、`result.count === 0` を forbidden 扱いにしている — 別立ての read-then-write もなく、TOCTOU の隙間もない:

  ```ts
  const result = await db.size.updateMany({
      where: { id: sizeId, productVariant: { product: { storeId: store.id } } },
      data: { quantity: parsed.data.quantity },
  });
  if (result.count === 0) {
      throw new Error("Forbidden: size not owned by current store.");
  }
  ```

- **この関数の既存の認可スタイルを維持すること。** `updateOrderItemStatus` は現在インラインの `currentUser()` + role チェックを使用している（既存のもの。新しい `src/lib/auth-guards.ts` のヘルパーは*新規*アクション向け）。本プランで認可ブロックをリファクタリング**しない**こと — それは別課題であり diff/risk を拡大する。lookup+update のみを店舗スコープ化する。
- **戻り値の型は不変**: 関数は `updatedProduct.status`（`ProductStatus`）を返す。この契約を維持する。

## 必要なコマンド

| 目的   | コマンド                                   | 成功時の期待結果 |
|-----------|-------------------------------------------|---------------------|
| 型チェック | `bunx tsc --noEmit`                       | exit 0, エラーなし   |
| ユニットテスト | `bun run test -- src/queries/order.test.ts` | 全件 pass          |
| Lint      | `bun run lint`                            | exit 0（警告は許容）|

## Scope

**対象内**（変更してよいファイルはこれのみ）:
- `src/queries/order.ts` — `updateOrderItemStatus` のみ修正
- `src/queries/order.test.ts` — 新しいスコープ化に対応するテストを追加/調整

**対象外**（触らないこと）:
- `updateOrderItemStatus` 内のインライン `currentUser()` + role チェックの認可ブロック — 現状維持（auth-guard への移行は別作業）。
- `updateOrderGroupStatus`、`updateOrderItemStatusAsAdmin`、その他 `order.ts` 内の関数。
- `ProductStatus` enum / `src/lib/types.ts`。

## Git ワークフロー

- Branch: `advisor/001-scope-order-item-status`
- コミットスタイル: Conventional Commits、例 `fix(order): scope updateOrderItemStatus to owned store (IDOR)`
- 指示がない限り push や PR は作成しないこと。

## Steps

### Step 1: スコープなしの read+update を単一のスコープ付き `updateMany` に置換

`src/queries/order.ts` の `updateOrderItemStatus` 内で、`db.orderItem.findUnique(...)` + not-found throw + `db.orderItem.update(...)` のブロック（店舗所有権チェック後のコード、おおよそ 257-277 行目）を、`updateSizeStock` を鏡写しにした原子的な所有権スコープ付き更新に置き換える:

```ts
// IDOR 防止: 対象 OrderItem を所有店舗にスコープする。
// OrderItem → OrderGroup.storeId の関係で絞り込み、検証と更新を単一の原子的更新にする。
// count === 0 は他店舗のアイテムか不存在を意味し、いずれも副作用なしで拒否される。
const result = await db.orderItem.updateMany({
    where: {
        id: orderItemId,
        orderGroup: { storeId: storeId },
    },
    data: { status },
});

if (result.count === 0) {
    throw new Error("Order item not found");
}

return status;
```

補足:
- `updateMany` は更新後の行を返さないため、`status` 引数（書き込んだばかりの値）をそのまま返す。これにより `Promise<ProductStatus>` の戻り値形状を維持できる。
- `throw new Error("Order item not found")` のメッセージは同一に保つ。これに依存するテスト/呼び出し元が引き続き通るようにするため。クロスストアのアイテムは更新されずに正しくこの分岐（count 0）に落ちるようになる。

**検証**: `bunx tsc --noEmit` → exit 0。

### Step 2: IDOR 回帰テストの追加 + happy-path アサーションの更新

`src/queries/order.test.ts` の `describe("updateOrderItemStatus", ...)` ブロック（339行目開始）は現在 `mockDb.orderItem.findUnique` / `mockDb.orderItem.update` をモックしている。実装が `orderItem.updateMany` を使うようになったため、これらのテストを更新する:

1. **Happy path**（既存の「OrderItemのステータスを正常に更新する」、~423行目）: `mockDb.orderItem.updateMany.mockResolvedValue({ count: 1 })` をモックし、以下を assert する:
   ```ts
   expect(mockDb.orderItem.updateMany).toHaveBeenCalledWith({
       where: { id: "order-item-001", orderGroup: { storeId: TEST_CONFIG.DEFAULT_STORE_ID } },
       data: { status: "Processing" },
   });
   expect(result).toBe("Processing");
   ```
2. **新規 IDOR テスト** — 同じ describe 内に、このファイルの他所で使われている 3 階層 IDOR パターン（`docs/testing/SECURITY_GAP_REPORT.md` §5.2 と 219・369 行目の `describe("IDOR防止（ストア所有権検証）")` ブロック参照）に従って追加する。カバー対象:
   - **(a) スロー検証**: アイテムが他店舗に属する場合（`updateMany` が `{ count: 0 }` を返す経路）に "Order item not found" を throw する
   - **(b) where 句の構造検証**: `updateMany` の where 句が `orderGroup: { storeId }` を伴う
   - **(c) 副作用なし検証**: ガード失敗時に**下流の書き込みが呼ばれない** — ここでは**スコープ無しの `orderItem.update` が呼ばれていない**こと

   ```ts
   it("他店舗の OrderItem は更新できない（count 0 → not found）", async () => {
       mockDb.orderItem.updateMany.mockResolvedValue({ count: 0 });
       await expect(
           updateOrderItemStatus(TEST_CONFIG.DEFAULT_STORE_ID, "victim-item", "Shipped")
       ).rejects.toThrow("Order item not found");                          // (a)
       expect(mockDb.orderItem.updateMany).toHaveBeenCalledWith({          // (b)
           where: { id: "victim-item", orderGroup: { storeId: TEST_CONFIG.DEFAULT_STORE_ID } },
           data: { status: "Shipped" },
       });
       expect(mockDb.orderItem.update).not.toHaveBeenCalled();             // (c)
   });
   ```

   > **(c) を「`{ count: 0 }` の経路で throw する」と書かないこと**（それは (a) の言い換えであり、
   > 副作用の検証になっていない）。`updateMany` は**モックなのでそもそも何も書き込まない** ——
   > その戻り値を `{ count: 0 }` にして throw を確認しても、「副作用が漏れない」ことは何も示せない。
   > `SECURITY_GAP_REPORT.md` §5.2 の (c) は **「ガード失敗時に下流の `upsert` / `create` /
   > `delete` / 関連 `findMany` が呼ばれないこと」**を担保する階層で、**別の呼び出しの不在**を
   > 見るもの。本関数では Step 1 でスコープ無しの `orderItem.update` からスコープ付きの
   > `orderItem.updateMany` へ移行するため、**`update` の非呼び出し**がまさに検証すべき
   > 「下流の意図しない実行」にあたる（将来 `update` へ戻す変更を検知できる）。
   > `mockDb.orderItem` には `update` / `updateMany` の**両方が既に宣言済み**（`order.test.ts:49-53`）
   > なのでモックの追加は不要。
3. この describe 共有の `beforeEach` が引き続き `mockDb.store.findUnique.mockResolvedValue(createMockStore())` を設定していることを確認する（店舗所有権ゲートは不変）。このファイルの mock `db` オブジェクトに `orderItem.updateMany` が無ければ、`orderItem` のモックに `updateMany: jest.fn()` を追加する（mock db は既に `order`/`orderGroup`/`orderItem` に `updateMany` を宣言済み、~38-53行目 — `orderItem` にあるか確認）。

**検証**: `bun run test -- src/queries/order.test.ts` → 新規 IDOR テストを含め全件 pass。

### Step 3: 完全な型チェック + lint

**検証**:
- `bunx tsc --noEmit` → exit 0
- `bun run lint` → exit 0（既存の警告は許容。新規エラーがないこと）

## Test plan

- `src/queries/order.test.ts` の `describe("updateOrderItemStatus")` 内に、上記のクロスストア拒否ケース（throw + where 句 + 更新成功なしを assert）を新規追加。
- 同 describe 内の既存 happy-path・遷移テストを `findUnique`/`update` モックから `updateMany` モックへ調整。
- 従うべき構造パターン: 同ファイル内の既存 IDOR describe ブロック（219、369行目）と、`src/queries/inventory.test.ts` にあれば `updateSizeStock` のテスト。
- 検証: `bun run test -- src/queries/order.test.ts` → 全件 pass。

## Done criteria

以下すべてを満たすこと:

- [ ] `bunx tsc --noEmit` が exit 0
- [ ] `bun run test -- src/queries/order.test.ts` が exit 0；新規クロスストア IDOR テストが存在し pass する
- [ ] スコープなしの read が **`updateOrderItemStatus` から確実に**消えている。ファイル全体への素の `grep` では関数スコープを証明できない（別の関数が正当に `orderItem.findUnique` を使っている可能性があるため）ので、先に関数本体を切り出すこと: `awk '/export const updateOrderItemStatus/,/^};/' src/queries/order.ts | grep -c "orderItem.findUnique"` → `0` を期待
- [ ] `grep -n "orderGroup: { storeId" src/queries/order.ts` が新しいスコープ付き where 句を示す
- [ ] **コードコミットの時点で**、対象外リストのファイルが一切変更されていない（`git status`）— `plans/README.md` のステータス行更新は別の docs コミットで行う
- [ ] `plans/README.md` の 001 のステータス行が DONE に更新されている

## STOP conditions

以下に該当する場合は停止して報告すること（独自判断で進めない）:

- `src/queries/order.ts` の `updateOrderItemStatus` のコードが「Current state」の抜粋と一致しない（`f9752c0` 以降のドリフト）。
- `prisma/schema.prisma` の `OrderItem` に直接の `storeId` カラムが追加されている（その場合リレーション経由の `orderGroup: { storeId }` フィルタは直接の `storeId` に変える必要があるかもしれない — どちらか報告する）。
- 妥当な修正を試みても `bun run test -- src/queries/order.test.ts` が2回失敗する。
- この修正に認可ブロックや他の関数の変更が必要に見える（対象外）。

## Maintenance notes

- admin 側の item status 更新が将来この seller 関数経由になった場合、スコープを再検討すること（admin は設計上クロスストアで動作し `count === 0` に当たる）。
- レビュアーは `updateMany` の where 句が**リレーション**経由の `orderGroup: { storeId }` を使っており、存在しない `OrderItem.storeId` ではないことを確認すること。
- 並行する admin 関数 `updateOrderItemStatusAsAdmin` は既に `requireAdmin` + スコープ付き更新を使用しており、意図的にここでは触れていない。
- 先送り事項: この関数のインライン `currentUser()` + role チェックを `requireSeller`/`requireStoreOwner` へ移行すること（別途追跡。このセキュリティ修正を最小限に保つため）。
