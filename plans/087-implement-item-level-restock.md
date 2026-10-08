# Plan 087: 注文の取り消し・返金・返品で、在庫が経路を問わず「ちょうど 1 回」戻るようにする

> **Executor instructions**: このプランを Step 順に進める。各 Step の Verify を実行し、期待どおりの結果を確認してから次へ進む。
> 「STOP conditions」に当たったら止まって報告する（その場で工夫しない）。
> 完了したら `plans/README.md` の 087 の行を更新する。
>
> **設計の正本**: [`docs/design/inventory-restock/design.md`](../docs/design/inventory-restock/design.md)（以下 design）。
> 本プランは design の決定を実装するだけで、決定は変えない。変えたくなったら STOP する。
>
> **Drift check（最初に実行）**:
> ```bash
> git diff --stat cfbcd9a6 -- src/queries/order.ts src/queries/product.ts prisma/schema.prisma tests/integration/order-lifecycle.test.ts
> git status --porcelain -- src/queries/ prisma/ tests/integration/
> ```
> 対象のファイルが変わっていたら、design §0 の事実表（file:line）を現行コードと突き合わせる。食い違っていたら STOP する。

## Status

- **Priority**: P3（F-1 / F-3 は現行の欠陥なので、direction の中では先に片付ける価値がある）
- **Effort**: M
- **Risk**: MED（在庫の正しさに関わる。5 経路の書き換えを含む。スキーマ変更は無い）
- **Depends on**: [012](012-spike-item-level-inventory-restock.md)（spike・決定済み）
- **Category**: direction（実装）
- **Planned at**: commit `cfbcd9a6`, 2026-10-07

## Why this matters

注文の在庫は `placeOrder` で減り、取り消し・返金で戻る。ただし戻す経路が 3 本（order / group / item）あり、
それぞれが別の印（`paymentStatus` / group status / なし）を見ている。そのため、

- group を取り消したあとに注文を返金すると、同じ在庫が 2 回戻る（design F-1）
- group を取り消して再オープンし、もう一度取り消すと、また戻る（F-2）
- 注文後に商品を編集すると Size が作り直され、取り消しそのものが失敗する（F-3）
- item 単位の取り消しでは在庫が戻らない（F-4）

という状態になっている。在庫の水増しは売り越しを、在庫の過少は「在庫切れに見える商品」を生む。
本プランでは、印を `OrderItem.status` の 1 か所にまとめ、すべての経路を同じヘルパーに通す。

## Current state

design §0 の事実表が正本である。要点だけ抜き出す。

- `restockOrderItems`（[`order.ts:31-42`](../src/queries/order.ts)）は `tx.size.update` を使う。Size が無いと throw する。
- 経路 A `updateOrderPaymentStatus`（[`order.ts:604-690`](../src/queries/order.ts)）は、`didTransition` のときに**全 item** を書き換えて戻す。
- 経路 B `updateOrderGroupStatusAsAdmin`（[`order.ts:489-552`](../src/queries/order.ts)）は、group status の遷移だけを見て、group の全 item を戻す（item の status は変えない）。
- 経路 C `updateOrderItemStatusAsAdmin`（[`order.ts:566-595`](../src/queries/order.ts)）は tx が無く、復元も無い（TODO `:583`）。
- 経路 D `updateOrderItemStatus`（[`order.ts:281-335`](../src/queries/order.ts)）と経路 E `updateOrderGroupStatus`（[`order.ts:180-273`](../src/queries/order.ts)）は seller の経路で、復元が無い。

## Commands you will need

| 目的 | コマンド | 期待 |
| --- | --- | --- |
| ユニット | `bun run test -- src/queries/order.test.ts` | 全件 pass |
| 統合（Docker 必須） | `bun run test:integration -- tests/integration/order-lifecycle.test.ts` | 全件 pass |
| 型 | `bunx tsc --noEmit` | 0 エラー |
| Lint | `bun run lint` | 0 エラー |
| 吸収状態の確認 | `grep -n "already settled" src/queries/order.ts` | 経路 C / D に 1 か所ずつ以上 |

## Scope

**In scope**
- `src/queries/order.ts`: `settleOrderItems` の新設、`restockOrderItems` の `updateMany` 化、経路 A〜E の書き換え
- `src/queries/order.test.ts`: tx をモックしたユニットテスト
- `tests/integration/order-lifecycle.test.ts`: 経路をまたぐシナリオの追加
- テスト件数が変わるので、`spec-sync-after-test`（`.claude/rules/02-tdd-step-commit.md`）

**Out of scope**
- スキーマの変更（`OrderItem.sizeId` のリレーション化は design §7 のとおり見送り）
- 返金の実行（DIRECTION-01）と、webhook と item の連動
- group status の再オープンの禁止（design §7）
- RMA（plan 018 / 088）

## Git workflow

- ブランチは `dev`。コミットはユーザーが依頼したときだけ行う。
- 依頼があれば Red → Green → Refactor の各フェーズで分ける（`.claude/rules/02-tdd-step-commit.md`）。
  例: `test(order): add cross-path restock exactly-once scenarios` → `fix(order): anchor restock on item status transitions` → `docs: sync test stats`。

## Steps

### Step 0: 前提の確認

- `tx.orderItem.updateManyAndReturn` が Accelerate 拡張済みの `OrderTransactionClient` で型付けされることを確認する（`bunx tsc --noEmit` を一時的なコードで確認するか、`node_modules/.prisma/client/index.d.ts` を grep する）。
- 統合テストの環境（Docker / testcontainers・ADR-004）が動くことを確認する。

**Verify**: 型エラーが無い。`bun run test:integration -- tests/integration/order-lifecycle.test.ts` が現状で green。

### Step 1: Red — 経路をまたぐ統合テストを先に書く

`tests/integration/order-lifecycle.test.ts` に以下のシナリオを足す（既存の `seedPlacedOrder` / `stockOf` / `mockAuthAsAdmin` を再利用する）。

1. **F-1**: `updateOrderGroupStatusAsAdmin(G, Canceled)` → `updateOrderPaymentStatus(order, Refunded)`。G の在庫が `INITIAL_STOCK` に**ちょうど**戻る（2 倍にならない）。G の item は `Canceled` のまま残る。
2. **F-2**: group を `Canceled → Processing → Canceled`。在庫の復元は 1 回だけ。各段階で状態も確かめる。再オープンの後は group が `Processing`、group 内の item は `Canceled` のまま（再活性化しない）。2 回目の取り消しの後は group が `Canceled`、item は `Canceled`。
3. **item → order**（plan 012 の受け入れの要）: `updateOrderItemStatusAsAdmin(X, Canceled)` → `updateOrderPaymentStatus(order, Refunded)`。X の在庫は 1 回だけ戻り、他の item も 1 回だけ戻る。
4. **item → group**: `updateOrderItemStatusAsAdmin(X, Canceled)` → `updateOrderGroupStatusAsAdmin(G, Canceled)`。
5. **並行**: `updateOrderItemStatusAsAdmin(X, Canceled)` と `updateOrderPaymentStatus(order, Cancelled)` を `Promise.all` で同時に流す。在庫は 1 回だけ戻る（既存の並行シナリオ `:288` の書き方にならう）。
6. **吸収状態**: `Canceled` の item を `Processing` へ戻そうとすると `"Order item is already settled."` で拒否され、status と在庫が変わらない。
7. **F-3**: 注文後に Size を削除（`updateProduct` の全置換を模して `db.size.delete`）→ `updateOrderPaymentStatus(order, Cancelled)` が成功し、status が終端になる。
8. **seller 経路**: seller の `updateOrderItemStatus(store, X, Canceled)` で在庫が戻る。他店舗の item を指定すると拒否され、在庫が変わらない（IDOR 3 階層・`docs/testing/SECURITY_GAP_REPORT.md` §5.2）。

**Verify**: 追加したシナリオが**意図どおりの理由で**失敗する（1 / 2 は在庫が多すぎる、3 / 4 / 8 は在庫が戻らない、6 は拒否されない、7 は P2025）。環境エラーを Red として扱わない。

### Step 2: Green — ヘルパーを入れる

- `RESTOCK_TERMINAL_ITEM_STATUSES` と `isRestockTerminalItem` を定義する。
- `settleOrderItems(tx, where, status, { restock })` を design §2 の形で実装する。`order.ts` の非公開ヘルパーにする。`"use server"` モジュールから非 async の値を export しないこと。
- `restockOrderItems` を `tx.size.updateMany({ where: { id } })` に変える。`count === 0` のときは `console.warn("[Order:restockOrderItems] Size not found, skip restock", { sizeId })` を出す（PII は含めない）。

### Step 3: Green — 経路を書き換える（design §4.1）

- 経路 C: `$transaction` で包み、吸収状態の判定と `settleOrderItems` を入れる。TODO コメントを削除する。監査ログ（`console.error` の `actor=`）は残す。
- 経路 D: 経路 C と同じ形にする。`where` に `orderGroup: { storeId }` を必ず含める。所有店舗の判定（`!store`）と not found の判定は、現行どおり try/catch の外に置く。
- 経路 B: 復元を `settleOrderItems(tx, { orderGroupId }, …)` に置き換える。通知の遷移判定（`recordOrderGroupStatusNotification`）はそのまま残す。
  - **精算後の再オープン（終端 → 非終端。例: `Canceled → Processing`）の扱い**: group の状態の更新は**許可**する（design §7）。ただし group 内の item は**再活性化しない**。終端の item は吸収状態のまま残し、在庫の再減算もしない。
  - このため、非終端への遷移では `settleOrderItems` も item の更新も呼ばない（group の行だけを更新する）。
  - 再オープンした group の item を再び出荷したい場合は、新しい注文（交換）として扱う。group の再オープンを禁止するかどうかは design §7 の後続判断であり、本プランでは変えない。
  - 検証は Step 1 の F-2（group と item の両方の状態を確認する）で行う。
- 経路 E: 既存の tx の中に、経路 B と同じ 1 行を足す。
- 経路 A: item の一括 `updateMany` と `findMany` → `restockOrderItems` を `settleOrderItems(tx, { orderGroup: { orderId } }, childItemStatus)` に置き換え、`didTransition` から切り離す。group の連動は `didTransition` のときだけにする。

**Verify**: Step 1 のシナリオと既存の Scenario 1〜6 がすべて green になる。

### Step 4: ユニットテスト

`src/queries/order.test.ts` に、tx をモックした分岐テストを足す（AAA）。

- 経路 C / D: 非終端 → 終端で `updateManyAndReturn` と `size.updateMany` が呼ばれること
- 終端 → 終端で在庫が戻らないこと
- 終端 → 非終端で throw され、書き込みが無いこと
- `size.updateMany` が `count: 0` を返しても throw しないこと

既存のテストのうち、経路 A の `orderItem.updateMany` 呼び出しを固定しているものは、新しい形に合わせて直す（期待の変更理由を PR に書く）。

**Verify**: `bun run test -- src/queries/order.test.ts` が green。

### Step 5: 仕上げ

- `bunx tsc --noEmit` と `bun run lint` を実行する。
- `spec-sync-after-test` を実行する（`QA_HANDOFF.md`（SSOT）/ `07-testing.md` / `COVERAGE_REPORT.md` / `PROGRESS.md` / ダッシュボードの再生成）。
- `specs/multi-vendor-ecommerce/05-workflows.md` の注文状態遷移の節に、「item の終端は吸収状態」と「在庫復元は item status の遷移で 1 回」を追記する。

## Test plan

| 層 | 対象 | 件数の目安 |
| --- | --- | --- |
| 統合（testcontainers） | Step 1 の 8 シナリオ | +8〜10 |
| ユニット（tx モック） | Step 4 の分岐 | +6〜8 |

## Done criteria

- [x] `grep -n "TODO(在庫連動" src/queries/order.ts` が 0 件
- [x] `grep -c "settleOrderItems(" src/queries/order.ts` が 4（経路 A / B / E の直接呼び出し 3 + 共通ヘルパー `applyOrderItemStatus` 内の 1）、かつ `grep -c "applyOrderItemStatus(" src/queries/order.ts` が 2（経路 C / D）。※ 当初の基準「6 以上（定義 1 + 経路 A〜E の 5）」からの逸脱: 経路 C / D を `applyOrderItemStatus` に集約し、定義 `settleOrderItems = async (` は grep に掛からないため（「実施結果」Step 2〜3 参照）
- [x] `grep -n "tx.size.update(" src/queries/order.ts` が 0 件（`updateMany` に置き換わっている）
- [x] 統合テスト「item を取り消したあと注文を返金しても在庫がちょうど 1 回だけ戻る」（Step 1-3）が green
- [x] 統合テスト F-1 / F-2 / 並行 / F-3 / 吸収状態 / seller の IDOR が green
- [x] `bunx tsc --noEmit` 0 エラー、`bun run lint` 0 エラー、`bun run test` 全件 pass
- [x] `git diff --stat cfbcd9a6 -- prisma/` が空（スキーマ変更なし）
- [x] テスト統計の同期ドキュメントが実測値で更新されている
- [x] `plans/README.md` の 087 の行を更新した

## 実施結果（2026-10-08・HEAD `b7b3333e` 上の作業ツリー・未コミット）

- **Step 0**: drift 無し。`updateManyAndReturn` は Accelerate 拡張済み tx で型・実行時とも利用可。統合 baseline 8/8 green。STOP 条件の事前確認: seller の `product-status-select.tsx` は全 enum を選択肢に出すが、終端 → 非終端に**依存する**処理は無い（拒否は既存の toast に出る）。
- **Step 1（Red）**: 統合 +10。8 件が意図どおりの理由で失敗（F-1 = 在庫 11、F-2 = item が Pending のまま、item 経路 / seller = 在庫 5、吸収状態 = 拒否されない、F-3 = P2025）。並行と IDOR の 2 件は回帰ガードで実装前から green（Verify の Red 対象外）。
- **Step 2〜3（Green）**: plan どおり。差分は 1 点 —— 経路 C / D の遷移表（design §2.1）を非公開ヘルパー `applyOrderItemStatus` に共通化した。経路 D は判定結果（`not_found` / `settled`）を tx から返し、throw を try/catch の外に置いて汎用メッセージで潰さない。`isRestockTerminalOrderStatus` を型ガード化し、`toSettledItemStatus` で group → item の終端を写す。
- **Step 4**: ユニット 84 → 94。旧呼び出し形を固定していた 11 件（経路 A の無条件 `orderItem.updateMany`、経路 C の `orderItem.update`、経路 D の単発 `updateMany`、経路 B の `prev.items`）を新しい形へ更新。いずれも呼び出し形の固定で、「先に Canceled の item が Refunded に上書きされる」挙動に依存するテスト・画面は 0 件（STOP 条件の閾値 3 未満）。
- **実測**: Jest 3038/3041（3 skipped）・316 スイート、Integration 238/238・18 スイート、tsc 0、lint 0 errors（既存 warnings 8）。

## STOP conditions

- `updateManyAndReturn` が Accelerate 拡張済みの tx で使えない（型でも実行時でも）。代わりに `$queryRaw` の `UPDATE … RETURNING` を使うかどうかは判断を仰ぐ（raw SQL は enum のキャストが要るため）。
- 既存の UI（admin / seller の status select）や E2E が「終端から非終端へ戻す」操作に依存していると判明した場合。I-2 を緩めるかどうかは design の変更になる。
- Step 1 のシナリオが、実装前から green になる（前提が崩れている。design §1.2 を見直す）。
- 経路 A の挙動の変更（先に `Canceled` だった item が `Refunded` に上書きされなくなる）に依存する画面やテストが、想定より多い（3 か所を超える）。

## Maintenance notes

- レビューで最も精査すべき点: (1) すべての「item を終端へ書く」経路が `settleOrderItems` を通っているか。(2) 経路 D のスコープ（`orderGroup: { storeId }`）が `where` に残っているか。
- plan 088 の RMA は `settleOrderItems(tx, { id }, ProductStatus.Returned, { restock })` を呼ぶ。`restock = false` は「品物を回収しない返金」や「再販できない返品」に使う。ヘルパーの署名を変えるときは 018 / 088 と揃える。
- 終端 item の再出荷が必要になったら、再オープンではなく新しい OrderItem（交換）として扱う。
