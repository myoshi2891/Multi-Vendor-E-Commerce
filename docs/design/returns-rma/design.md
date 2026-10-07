# 返品（RMA）ワークフロー — 設計（design.md）

> plan [018](../../../plans/018-spike-returns-rma-workflow.md)（design/spike）の成果物。
> **本ドキュメントは設計のみ。`src/` / `prisma/schema.prisma` は 1 行も変更しない。**
> 実装手順は後続の実装プラン [088](../../../plans/088-implement-returns-rma.md) に書く。
>
> - 調査日: 2026-10-07 / 対象 HEAD: `cfbcd9a6`（branch `dev`）
> - ドリフトチェック（`86c04a1..HEAD`）: `schema.prisma` / `order.ts` / `returns-exchange` は変わっている。
>   ただし **RMA / Return 系のモデルは無く、`SupportTicket.status` も `String` のまま**（[`schema.prisma:938-964`](../../../prisma/schema.prisma)）なので、STOP 条件には当たらない。
> - 前提にする設計:
>   - 在庫復元: [`inventory-restock/design.md`](../inventory-restock/design.md)（plan 012 → 実装 087）。**部分返品は「差し引き方式」で組み合わせる**（§4.3。2026-10-07 にユーザーが選択）。
>   - 通知: [`notification-foundation/design.md`](../notification-foundation/design.md)（plan 021 → 実装 086・実装済み）。
>
> 用語: 本書の「RMA」は `ReturnRequest` 1 件（店舗単位の返品申請）を指す。

---

## 0. 設計の前提（実コードで確認した事実）

| #   | 事実 | 出典 |
| --- | ---- | ---- |
| 0-1 | 返品の受付は自由記述の `SupportTicket`（`category = RETURN_REQUEST`）だけ。対象 item・数量・理由は `message` 本文に埋もれる。`status` は `String @default("OPEN")` で、閲覧 UI は無い | [`schema.prisma:938-971`](../../../prisma/schema.prisma) |
| 0-2 | `createSupportTicket` はゲストでも送れる公開 action。ログイン中なら `userId` を付ける。**`orderId` は形式チェックだけで、送信者が注文の所有者かは確かめない** | [`support.ts:16-79`](../../../src/queries/support.ts) / [`schemas.ts:697-740`](../../../src/lib/schemas.ts) |
| 0-3 | 受付ページは静的なポリシー要約（`RETURNS_POLICY_SUMMARY`。「商品到着から 30 日以内」）と `<SupportForm category="RETURN_REQUEST">` | [`returns-exchange/page.tsx`](../../../src/app/(store)/returns-exchange/page.tsx) / [`content/returns.ts:12-14`](../../../src/components/store/static/content/returns.ts) |
| 0-4 | `OrderItem.status` は `ProductStatus`。`Returned` / `Refunded` / `ExchangeRequested` はあるが、遷移のガードは無い。seller / admin が任意の値に書き換えられる | [`schema.prisma:743-772, 795-816`](../../../prisma/schema.prisma) / [`order.ts:281, 566`](../../../src/queries/order.ts) |
| 0-5 | 在庫復元は plan 087 で `settleOrderItems` に一本化される（印は `OrderItem.status`・終端は吸収状態） | [`inventory-restock/design.md` §2](../inventory-restock/design.md) |
| 0-6 | `Order.userId` は **NOT NULL**。ゲストの注文は存在しない | [`schema.prisma:682-709`](../../../prisma/schema.prisma) |
| 0-7 | `OrderGroup` は店舗単位の出荷の単位で、`storeId`・`shippingDeliveryMin/Max`（日数）を持つ。**配達完了の時刻（`deliveredAt`）は無い**（findings-10 O-5） | [`schema.prisma:711-741`](../../../prisma/schema.prisma) |
| 0-8 | `PaymentDetails` は注文ごとに 1 行（`orderId @unique`）。`paymentIntentId`・`amount Decimal(12,2)`・`currency` を持つ | [`schema.prisma:876-895`](../../../prisma/schema.prisma) |
| 0-9 | 返品ポリシーは `Store.returnPolicy String @default("Return in 30 days.")` と `ShippingRate.returnPolicy String` だけで、どちらも表示用の自由記述 | [`schema.prisma:140, 494`](../../../prisma/schema.prisma) |
| 0-10 | 通知の対応表に `rma.requested`（seller）/ `rma.approved` / `rma.rejected` / `rma.refunded`（customer）が**予約済み**（配線は未着手） | [`notifications/mapping.ts:59-78`](../../../src/lib/notifications/mapping.ts) |
| 0-11 | 通知の記録は主処理と同じ tx の中で `recordNotifications` を呼び、commit 後に `scheduleDispatch` で送る（原子的 Outbox） | [`order-events.ts`](../../../src/lib/notifications/order-events.ts) / [`order.ts:158-166`](../../../src/queries/order.ts) |
| 0-12 | 認可ヘルパーは `requireUser` / `requireAdmin` / `requireSeller` / `requireStoreOwner(storeUrl)` | [`auth-guards.ts:30-87`](../../../src/lib/auth-guards.ts) |
| 0-13 | 顧客の注文詳細は `/order/[orderId]`、注文一覧は `/profile/orders` | [`(fullscreen)/order/[orderId]/page.tsx`](../../../src/app/(fullscreen)/order/[orderId]/page.tsx) / [`profile/orders`](../../../src/app/(store)/profile/orders/page.tsx) |

### 0.1 調査で見つけたこと（即時の悪用につながる認可欠陥は無し）

- **顧客が他人の注文の状態を変えられる経路は見つからなかった**（plan 018 の P1 STOP には当たらない）。状態を書き換える action はすべて seller（所有店舗にスコープ）か admin である。
- 0-2 の `SupportTicket.orderId` は**所有者を確かめていない**。保存するだけなので、今のところ情報は漏れない。ただし DIRECTION-03（サポートコンソール）で「チケットの `orderId` = 申請者の注文」と扱うと誤る。本書の RMA は、この値を所有の証拠に**使わない**（§3）。

## 1. 現行フロー（Step 1）

| 段階 | 誰が | 何を | どのデータで | 構造化の欠落 |
| --- | --- | --- | --- | --- |
| 受付 | 顧客（ゲスト可） | 返品フォームを送る | `SupportTicket.message`（自由記述）+ `orderId`（任意の文字列） | 対象 item・数量・理由・希望の解決方法が無い。所有者を確かめていない |
| 確認 | 運営 | チケットを読む | **閲覧 UI が無い**（DB を直接見る） | キューが無い |
| 承認・返送 | 運営 / seller | メール等で個別にやり取りする | システム外 | 状態も追跡番号も残らない |
| 解決 | seller / admin | `OrderItem.status` を `Returned` / `Refunded` に手で書き換える | `updateOrderItemStatus(AsAdmin)` | 部分数量を表せない。在庫は戻らない（087 で直る） |
| 返金 | 運営 | 決済サービスの管理画面で返金する | システム外。webhook で `paymentStatus` だけが変わる | RMA と返金額の対応が残らない |

findings-10 O-1 の記述（「自由記述チケット受付のみ・構造化 RMA なし」）と一致する。

## 2. Q1 — RMA エンティティの形

### 2.1 決定: **店舗単位（OrderGroup）のヘッダ + item 単位の明細**

```prisma
model ReturnRequest {
  id              String              @id @default(uuid())
  orderGroupId    String              // 店舗単位。1 件の RMA は 1 つの OrderGroup の item だけを含む
  storeId         String              // seller のキュー用に OrderGroup から写す（作成時に tx 内で取得。入力からは受け取らない）
  userId          String              // NOT NULL（§2.3）。requireUser() の主体
  status          ReturnRequestStatus @default(REQUESTED)
  resolution      ReturnResolution    // 顧客の希望。MVP は REFUND のみ受け付ける（§2.4）
  idempotencyKey  String              // NOT NULL。クライアントが生成する
  requestHash     String              // 正規化した申請内容の SHA-256（不変）
  customerNote    String?             @db.Text
  sellerNote      String?             @db.Text
  returnTrackingNumber String?        // 顧客が手入力する（配送業者との連携はスコープ外）
  refundAmount    Decimal?            @db.Decimal(12, 2)   // RESOLVED のときに確定（§5）
  supportTicketId String?             // 任意。運営がチケットと手で結び付ける（§3）
  approvedAt DateTime? / rejectedAt DateTime? / receivedAt DateTime? / resolvedAt DateTime? / canceledAt DateTime?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  items ReturnRequestItem[]

  @@unique([userId, idempotencyKey])
  @@index([storeId, status])
  @@index([orderGroupId])
}

model ReturnRequestItem {
  id               String           @id @default(uuid())
  returnRequestId  String           // onDelete: Cascade
  orderItemId      String           // onDelete: Restrict（注文側の削除で返品の記録を消さない）
  quantity         Int              // 1 以上（Zod と CHECK 相当の検証）
  reasonCode       ReturnReasonCode
  condition        ReturnItemCondition?  // RECEIVED のときに seller が記録（RESELLABLE / DAMAGED）
  restockedQuantity Int @default(0) // RECEIVED のときに確定。RESELLABLE なら quantity、DAMAGED なら 0

  @@unique([returnRequestId, orderItemId])
  @@index([orderItemId])
}

enum ReturnRequestStatus { REQUESTED APPROVED REJECTED RECEIVED RESOLVED CANCELED }
enum ReturnResolution    { REFUND EXCHANGE }
enum ReturnReasonCode    { DAMAGED DEFECTIVE WRONG_ITEM NOT_AS_DESCRIBED SIZE_FIT CHANGED_MIND OTHER }
enum ReturnItemCondition { RESELLABLE DAMAGED }
```

**根拠**

- **店舗単位にする理由**: 返品を判断し、品物を受け取り、返金額を負担するのは店舗（seller）である。`OrderGroup` は配送の単位でもあり、返送先の住所も店舗ごとに異なる。注文（`Order`）単位にすると、複数店舗にまたがる RMA を 1 人の seller が承認できない。
- **明細に分ける理由（「複数の OrderItem を含められるか」への答え: 含められる）**: 同じ店舗から複数の商品を買い、まとめて返送するのが自然だからである。冪等性の制約は、plan 018 の注記どおり**ヘッダ側**の `@@unique([userId, idempotencyKey])` に置く。ヘッダに `orderItemId` は無いので、3 列の複合キーは使わない。
- 理由コードは明細ごとに持つ（「1 つは破損、1 つはサイズ違い」がありうる）。
- 事実の時刻（`approvedAt` など）を最初から持たせる。plan 022（セラーパフォーマンス）の「返品処理の速さ」の指標に、そのまま使える。

### 2.2 数量の上限（不変条件 R-1）と、並行時の原子性

> **R-1**: ある `OrderItem` について、**有効な RMA**（`status ∉ {REJECTED, CANCELED}`）の明細の `quantity` の合計は、`OrderItem.quantity` 以下である。

**決定: 作成の tx の中で、対象の OrderItem 行を `FOR UPDATE` でロックしてから合計を数える。** カウンタ列は足さない。

```ts
await db.$transaction(async (tx) => {
    // 1. 所有の確認とロックを 1 文で行う（他人の item や別の店舗の item は 0 行になる）
    const locked = await tx.$queryRaw<{ id: string; quantity: number; status: string }[]>`
        SELECT oi."id", oi."quantity", oi."status"
        FROM "OrderItem" oi
        JOIN "OrderGroup" og ON og."id" = oi."orderGroupId"
        JOIN "Order" o ON o."id" = og."orderId"
        WHERE oi."id" IN (${Prisma.join(itemIds)})
          AND og."id" = ${orderGroupId}
          AND o."userId" = ${user.id}
        ORDER BY oi."id"            -- ロックの順序を固定してデッドロックを避ける
        FOR UPDATE OF oi
    `;
    if (locked.length !== itemIds.length) throw new Error("Order item not found");   // IDOR: 存在しないのと同じ応答にする
    // 2. 有効な RMA の数量を合計する（ロック中なので、ほかの作成はここで待つ）
    const active = await tx.returnRequestItem.groupBy({
        by: ["orderItemId"],
        where: { orderItemId: { in: itemIds }, returnRequest: { status: { notIn: ["REJECTED", "CANCELED"] } } },
        _sum: { quantity: true },
    });
    // 3. 各明細について、既存の合計 + 申請数 <= quantity と、適格性（§4）を確かめる。満たさなければ throw
    // 4. ヘッダと明細を作る
});
```

- **カウンタ列（`OrderItem.returnRequestedQuantity`）を採らない理由**: 却下や取り下げのたびに減算が必要になり、減算漏れで値がずれる。ロックして合計を数える方式なら、正しい値は常に明細から導ける。
- ロックの範囲は**対象の OrderItem 行だけ**である。plan 087 の `settleOrderItems` も同じ行を `UPDATE` で書くので、返品の作成・受け取りと、取り消し・返金とは、この行ロックで直列になる（§4.3）。
- 入口の Zod でも `quantity` は 1 以上の整数とし、上限は `OrderItem.quantity` を超えないこととする（多層防御）。

### 2.3 申請の冪等性（不変条件 R-2）

> **R-2**: 同じ主体が同じ `idempotencyKey` で送った申請からは、RMA が高々 1 件しかできない。

| 項目 | 決定 |
| --- | --- |
| 制約 | `@@unique([userId, idempotencyKey])`（ヘッダ）。**`requestHash` は制約に入れない** |
| `idempotencyKey` | **NOT NULL・クライアント必須**。申請フォームを開いた時点で `crypto.randomUUID()` を作り、再送でも同じ値を送る。省略されたら Zod で拒否する（サーバー側では生成しない。生成すると再送のたびにキーが変わる） |
| `userId` | **NOT NULL**。ゲストの RMA は認めない。注文は必ずユーザーに紐づいている（0-6）ので、ゲストを救う必要がない。**値は `requireUser()` から取り、リクエストボディからは受け取らない** |
| `requestHash` | `orderGroupId`・`resolution`・明細（`orderItemId` の昇順で `[orderItemId, quantity, reasonCode]`）を正規化した JSON の SHA-256。自由記述（`customerNote`）は含めない（誤字を直して再送しても、同じ申請として扱うため） |
| 衝突したとき | 一意制約違反（P2002）は**tx の外で**捕まえる（PostgreSQL では、tx の中でエラーが起きると、その tx は使えなくなる）。`(userId, idempotencyKey)` で既存の行を引いて `requestHash` を比べる。**一致**したら既存の RMA をそのまま返す（作り直さない）。**不一致**なら `"Idempotency key was reused with a different request."` で拒否する（409 相当） |

> **一意制約は認可ではない。** 制約が保証するのは「同じ組の行が 2 つできないこと」だけである。
> 他人の `orderItemId` を指した申請を止めるのは §2.2 の SQL の `o."userId" = ${user.id}` であり、
> 主体を偽れないようにしているのは `requireUser()` である。両方が必要になる。

`dedupeKey`（通知・086 §2.2）との関係: RMA の冪等性キーは**申請**の重複を防ぐ。`dedupeKey` は**通知**の重複を防ぐ。RMA の通知の `dedupeKey` は `rma.<type>:ReturnRequest:<rmaId>:<toStatus>:<recipient>` とし、RMA の ID（冪等性で 1 つに定まる）を元にする。

### 2.4 解決の種類

| 値 | MVP | 理由 |
| --- | --- | --- |
| `REFUND` | **受け付ける** | 返金額は RMA から確定でき（§5）、DIRECTION-01 へ渡せる |
| `EXCHANGE` | enum には定義するが、**Zod で拒否する** | 交換品の出荷には、新しい OrderItem の生成、在庫の減算、送料の扱いが必要になる。顧客は「返品 + 再注文」で代替できる。後続で扱う（§8） |
| 店舗クレジット | **定義しない** | クレジットの台帳（残高・失効・利用）がシステムに無い。台帳の設計はプロモーション（plan 020）と一緒に考える |

## 3. Q2 — SupportTicket との関係

### 決定: **RMA は注文詳細から直接作る。チケットは「相談窓口」として並べて残す（昇格はさせない）**

- **昇格させない理由**: チケットはゲストでも送れて、`orderId` の所有者を確かめていない（0-2）。チケットから RMA を作ると、所有の証明を後から取り直すことになる。注文詳細（`/order/[orderId]`。ログインが必要）から作れば、作成の時点で所有が確定する。
- **受付ページ（`/returns-exchange`）は残す**。ただし役割を変える:
  - ポリシーの表示は、§6 の構造化された値（返品できる期間）から描く（定数の「30 日」と食い違わないようにする）。
  - 「ログイン中の方は注文詳細から返品を申請できます」という案内とリンクを置く。
  - フォームは「相談・その他」として残す（ゲストの問い合わせ、ポリシー外の相談、紛争の前段階）。
- `ReturnRequest.supportTicketId` は任意の列で、運営が手で結び付けるだけに使う。DIRECTION-03 のコンソールで、チケットと RMA を並べて表示するための足場になる。
- **`SupportTicket.status` の enum 化は本設計では行わない**。DIRECTION-03 の設計に任せ、競合を避ける（plan 018 の STOP 条件 4 に当たらない）。

## 4. Q3 — 状態機械

### 4.1 遷移表

すべての遷移は「`where: { id, status: <遷移元>, <スコープ> }` を条件にした `updateMany` → `count === 1` のときだけ副作用」で行う（087 / 経路 A と同じ形）。`count === 0` は「すでに遷移済み、または権限が無い」で、副作用は起きない。

| # | 現在の状態 | 操作 | 実行できるロール（スコープ） | 次の状態 | 副作用（同じ tx の中） | OrderItem.status |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | （なし） | 申請 | 顧客（`requireUser`・注文の所有者） | REQUESTED | §2.2 のロックと検証、通知 `rma.requested` → seller | 変えない |
| T2 | REQUESTED | 承認 | seller（`requireStoreOwner`・`storeId` 一致）/ admin | APPROVED | `approvedAt`、通知 `rma.approved` → 顧客 | 変えない |
| T3 | REQUESTED | 却下 | seller / admin | REJECTED | `rejectedAt`・`sellerNote`（必須）、通知 `rma.rejected` → 顧客 | 変えない |
| T4 | REQUESTED / APPROVED | 取り下げ | 顧客（所有者） | CANCELED | `canceledAt`、通知 `rma.canceled` → seller（in-app のみ） | 変えない |
| T5 | APPROVED | 追跡番号の入力 | 顧客（所有者） | APPROVED（変えない） | `returnTrackingNumber` を書く | 変えない |
| T6 | APPROVED | 受け取り | seller / admin | RECEIVED | `receivedAt`。明細ごとに `condition` と `restockedQuantity` を記録し、**RESELLABLE の数量だけ在庫を戻す**（§4.3）。通知 `rma.received` → 顧客（in-app のみ） | 変えない（全数がそろったら T7 で終端へ） |
| T7 | RECEIVED | 解決（返金） | seller / admin | RESOLVED | `resolvedAt`・`refundAmount` を確定し（§5）、通知 `rma.resolved` → 顧客。**返品が全数になった OrderItem** は `settleOrderItems(tx, { id }, Returned)` で終端にする（戻す量は 0。§4.3） | 全数なら `Returned` |
| T8 | REQUESTED / APPROVED | 運営による取り消し | admin | CANCELED | T4 と同じ（通知の受信者は顧客と seller） | 変えない |

**禁止する遷移**: 顧客による T2 / T3 / T6 / T7（自分で承認できない）。終端（REJECTED / RESOLVED / CANCELED）からの遷移はすべて禁止する。RECEIVED からの取り下げも禁止する（品物はもう店舗にある）。

**`ExchangeRequested` は使わない**。申請中の状態は RMA が持つ。OrderItem に書き込むと、却下されたときに元の履行状態（`Delivered` など）へ戻す手段が無い。

### 4.2 現行の `updateOrderItemStatus` の問題を再生産しない

- RMA の状態は、上の表の action を通してしか変えられない。「任意の状態を受け取る更新 action」は作らない。各 action は**遷移元を固定**した条件付き更新である。
- seller の action は `requireStoreOwner(storeUrl)` の後、`where` に `storeId: store.id` を必ず入れる。admin の action は `requireAdmin()`。

### 4.3 在庫復元との接続（差し引き方式）

| 時点 | 在庫の動き | 二重にならない理由 |
| --- | --- | --- |
| T6 受け取り | 明細ごとに `restockedQuantity`（RESELLABLE なら `quantity`、DAMAGED なら 0）だけ `Size` を `increment` する。087 の `restockOrderItems`（`updateMany` 化済み）を数量指定で再利用する | T6 自体が `status: APPROVED` を条件にした遷移で、`count === 1` のときだけ動く。tx の最初に対象の OrderItem 行を `FOR UPDATE` でロックし、**その OrderItem がすでに終端なら戻さない**（`restockedQuantity = 0` と記録し、警告ログを出す。取り消し・返金のほうで全数が戻っているため） |
| 取り消し・返金（087 の `settleOrderItems`） | 戻す量を **`OrderItem.quantity − 返品済み数量`** に変える。返品済み数量は、`status ∈ {RECEIVED, RESOLVED}` の RMA 明細の `quantity` の合計（RESELLABLE と DAMAGED の両方を含む。DAMAGED の分は廃棄済みなので、戻してはいけない） | `settleOrderItems` の `UPDATE … RETURNING` が OrderItem 行をロックしてから合計を読む。T6 と同じ行ロックで直列になる |
| T7 で全数がそろったとき | `settleOrderItems(tx, { id }, Returned)` が呼ばれ、戻す量は `quantity − quantity = 0` | 吸収状態になるので、以後どの経路でも戻らない |

**例**: 3 個買い、1 個を返品（RESELLABLE）→ T6 で +1。その後、注文全体を返金 → `settleOrderItems` は 3 − 1 = 2 を戻す。合計 +3 で、ちょうど購入数に一致する。

**088 で必要な 087 の変更**: `settleOrderItems` の戻す量の計算に「返品済み数量」を差し引く処理を足す。087 の「印は status」「吸収状態」という決定は変えない。

## 5. 接続点の定義

| 接続先 | 方向 | 受け渡すデータ | 発火の条件 | MVP での扱い |
| --- | --- | --- | --- | --- |
| DIRECTION-03（サポートコンソール） | チケット → RMA | `supportTicketId`（任意）、`orderId` | 運営が手で結び付ける | 列だけ用意する。コンソールは後続 |
| plan 087（在庫復元） | RMA → 在庫 | `orderItemId`・`restockedQuantity`・`condition` | T6 受け取り / T7 全数 | §4.3 のとおり実装する |
| DIRECTION-01（返金の実行） | RMA → 決済 | RMA ID、`orderId`、`PaymentDetails.paymentIntentId` / `paymentMethod`、`refundAmount`（`Decimal`）、`currency` | T7 解決（REFUND） | **返金 API は呼ばない**。`refundAmount` を確定して画面に表示し、運営が決済サービスで手動で返金する。webhook は従来どおり `paymentStatus` を `PartiallyRefunded` / `Refunded` にする。DIRECTION-01 は「RESOLVED かつ未返金の RMA」を入力にできる |
| plan 086（通知） | RMA → 通知 | §7 の表 | 各遷移の `count === 1` | 同じ tx で記録し、commit 後に送る |

**返金額の計算**: `refundAmount = Σ(明細の quantity × OrderItem.price)`。`Prisma.Decimal` の `.mul()` / `.add()` で計算し、`number` にしない（tech.md の金額規約）。送料とクーポンの按分は MVP では含めない。含めるかどうかは DIRECTION-01 で決める（`refundAmount` は「商品代金の目安」と表示する）。

`PaymentDetails.paymentIntentId` は、Stripe の部分返金ではそのまま使える。PayPal の部分返金には capture ID が要るので、DIRECTION-01 で取り方を確かめる必要がある（注意点として残す）。

## 6. Q4 — 返品ポリシーのデータ化

### 決定: **プラットフォームの既定値 + 店舗ごとの上書き（2 層）**

| 層 | 置き場所 | 項目 |
| --- | --- | --- |
| プラットフォームの既定値 | 環境変数 `RETURN_WINDOW_DAYS_DEFAULT`（`trim()` → 数値化 → 空なら 30。tech.md の環境変数の規約） | 返品できる日数 |
| 店舗の上書き | `Store.returnWindowDays Int?`（NULL ならプラットフォームの既定値）、`Store.acceptsReturns Boolean @default(true)` | 日数、返品を受け付けるかどうか |
| 表示用 | `Store.returnPolicy String`（**残す**） | 店舗の説明文 |

- **コードを変えずにブランドごとに差し替えられる**: プラットフォームの値は環境変数、店舗の値は DB にある。受付ページの「30 日」も同じ関数（`resolveReturnWindowDays(store)`）から描く。
- 1 層（店舗の列だけ）にしない理由: 店舗が 0 件の状態でも、受付ページにプラットフォームの方針を出す必要がある。
- カテゴリごとの対象外（下着・食品など）は MVP では扱わない。必要になったら `Category.returnable Boolean` を足す（§8）。

**期限の判定の基準時刻**: 配達完了の時刻が無い（0-7）。MVP では**配達予定日の上限**を近似値にする。

```
期限 = Order.createdAt + OrderGroup.shippingDeliveryMax 日 + returnWindowDays 日
適格 = OrderItem.status === Delivered && now <= 期限 && store.acceptsReturns
```

- `updatedAt` を使わない理由: 後からの書き換えで値が動き、期限が延びてしまう。`createdAt` と `shippingDeliveryMax` は注文時に確定し、変わらない。
- plan 022 で `deliveredAt` が入ったら、`deliveredAt + returnWindowDays` に置き換える（後続の作業として記録する）。

## 7. Q5 / Q6 — 自動承認と通知

### 7.1 自動承認: **初期スコープに含めない**

- 判断の材料が足りない。配達の事実の時刻が無い（§6 は近似値）。不正のシグナル（返品の頻度など）も無い。
- 最初は件数が少ないので、seller の手作業で回る。T2 の action を 1 つにしておけば、後から「方針が満たされたら T2 を自動で呼ぶ」形で足せる。
- 見直すタイミング: plan 022（`deliveredAt`）が入った後、または RMA が月に一定の件数を超えた後。

### 7.2 通知: **(β) Outbox を採る**（086 の実装に合わせる）

| イベント | 受信者 | チャネル | 遷移 |
| --- | --- | --- | --- |
| `rma.requested` | seller（店舗の所有者） | in-app + email | T1 |
| `rma.approved` | 顧客 | in-app + email | T2 |
| `rma.rejected` | 顧客 | in-app + email | T3 |
| `rma.canceled` | seller（T8 では顧客にも） | in-app | T4 / T8 |
| `rma.received` | 顧客 | in-app | T6 |
| `rma.resolved` | 顧客 | in-app + email | T7 |

- 予約済みの `rma.refunded`（0-10）は **`rma.resolved` に改名する**。「refunded」という名前だと、お金が実際に戻ったように読めるからである（返金の実行は DIRECTION-01 の範囲）。まだどこからも呼ばれていないので、改名しても影響は無い。
- `dedupeKey` は 086 design §2.2 の規則に従う（§2.3 の末尾）。
- **原子性の不変条件**:
  - **送信の失敗は RMA の遷移をロールバックさせない**（送信は commit の後、tx の外で行う）。
  - **記録の失敗は RMA の遷移もロールバックさせる**（記録は同じ tx の中で行う。086 design §4.6）。この 2 つを区別すること。

## 8. 範囲外と、将来の拡張

- **交換（EXCHANGE）**: 交換品の出荷は、新しい OrderItem を生成する形で扱う。終端の item を再オープンしない（087 の吸収状態と整合させる）。
- 店舗クレジット、カテゴリごとの対象外、自動承認、返送ラベルの発行、配送業者との連携（`product.md` でスコープ外）。
- DIRECTION-03 のコンソールに RMA のキューを並べること。
- plan 022 の `deliveredAt` による期限判定の置き換え（§6）。
- 実装: [plan 088](../../../plans/088-implement-returns-rma.md)。
