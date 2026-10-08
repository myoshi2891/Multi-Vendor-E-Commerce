# Plan 088: 顧客が注文詳細から返品を申請し、店舗が承認・受け取り・解決まで処理できるようにする（RMA）

> **Executor instructions**: このプランを Step 順に進める。各 Step の Verify を実行し、期待どおりの結果を確認してから次へ進む。
> 「STOP conditions」に当たったら止まって報告する（その場で工夫しない）。
> 完了したら `plans/README.md` の 088 の行を更新する。
>
> **設計の正本**: [`docs/design/returns-rma/design.md`](../docs/design/returns-rma/design.md)（以下 design）。
> 本プランは design の決定を実装するだけで、決定は変えない。変えたくなったら STOP する。
>
> **Drift check（最初に実行）**:
> ```bash
> git diff --stat cfbcd9a6 -- prisma/schema.prisma src/queries/order.ts src/queries/support.ts src/lib/notifications/ "src/app/(store)/returns-exchange" "src/app/(fullscreen)/order"
> git status --porcelain -- prisma/ src/
> ```
> 対象のファイルが変わっていたら、design §0 の事実表を現行コードと突き合わせる。食い違っていたら STOP する。

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MED-HIGH（スキーマの追加、3 つのロールが触る状態機械、在庫との接続を含む。返金 API は呼ばない）
- **Depends on**: [087](087-implement-item-level-restock.md)（`settleOrderItems` を拡張するため）、[086](086-implement-notification-foundation.md)（通知基盤・実装済み）
- **Category**: direction（実装）
- **Planned at**: commit `cfbcd9a6`, 2026-10-07

## Why this matters

今の返品は自由記述のチケットだけで受け付けている。対象・数量・理由がデータとして残らず、運営は本文を読んで
`OrderItem.status` を手で書き換えている。返品が増えるほど手作業が増え、在庫も戻らない。
本プランで、RMA（店舗単位の返品申請）とその状態機械を入れる。在庫の復元（087）と通知（086）にもつなぐ。

## Current state

design §0 の事実表が正本である。要点だけ抜き出す。

- 返品の受付は `createSupportTicket`（[`support.ts:16`](../src/queries/support.ts)）だけ。ゲストも送れ、`orderId` の所有者は確かめていない。
- RMA のモデルは無い。`SupportTicket.status` は `String`（[`schema.prisma:938-964`](../prisma/schema.prisma)）。
- 通知の対応表に `rma.*` が予約済み（[`notifications/mapping.ts:59-78`](../src/lib/notifications/mapping.ts)）。
- 087 の完了後、在庫の復元は `settleOrderItems`（`src/queries/order.ts`）に一本化されている。

## Commands you will need

| 目的 | コマンド | 期待 |
| --- | --- | --- |
| マイグレーション（ローカル） | `bunx prisma migrate dev --name add_return_requests` | 新しいマイグレーションが 1 つ |
| ERD | `bun run erd:generate` | orphan WARNING 0 件 |
| ユニット | `bun run test -- src/queries/returns.test.ts` | 全件 pass |
| 統合（Docker 必須） | `bun run test:integration -- tests/integration/returns-rma.test.ts` | 全件 pass |
| E2E | `bunx playwright test tests/e2e/returns-rma.spec.ts` | pass |
| 型 / Lint | `bunx tsc --noEmit` / `bun run lint` | 0 エラー |

## Scope

**In scope**
- スキーマ: `ReturnRequest` / `ReturnRequestItem` と 4 つの enum（design §2.1）、`Store.returnWindowDays Int?` / `Store.acceptsReturns Boolean @default(true)`（§6）
- `src/queries/returns.ts`（新規）: T1〜T8 の action と読み取り用のクエリ
- `src/lib/schemas.ts`: 申請・各遷移の Zod スキーマ
- `src/lib/returns-policy.ts`（新規）: `resolveReturnWindowDays` / `isReturnEligible`
- `src/queries/order.ts`: `settleOrderItems` の戻す量から「返品済み数量」を差し引く（design §4.3）
- `src/lib/notifications/mapping.ts`: `rma.refunded` を `rma.resolved` に改名し、`rma.canceled` / `rma.received` を追加して配線する
- UI: 注文詳細の申請導線と状態表示、seller ダッシュボードの返品キュー、`/returns-exchange` の案内の差し替え
- テスト（ユニット・統合・E2E）と文書の同期

**Out of scope**
- 返金 API の呼び出し（DIRECTION-01）。交換（EXCHANGE）、店舗クレジット、自動承認（design §8）
- `SupportTicket` の構造変更（DIRECTION-03）
- admin 用のコンソール画面（admin の action は作るが、画面は seller 用の流用か後続で扱う）

## Git workflow

- ブランチは `dev`。コミットはユーザーが依頼したときだけ行う。
- 依頼があれば、スキーマと ERD、action（Red → Green）、UI、文書同期を、それぞれ別のコミットにする（`.claude/rules/02-tdd-step-commit.md` / `03-data-model-diagram-sync.md`）。

## Steps

### Step 0: 前提の確認

- 087 が完了していること（`grep -c "settleOrderItems(" src/queries/order.ts` が 6 以上）。完了していなければ STOP する。
- UI の作業の前に、`.agent/skills/design-system-workflow/SKILL.md` を読む（`.claude/rules/04-design-system-workflow.md`）。

### Step 1: スキーマと ERD

design §2.1 のモデルを追加する。`orderItemId` の外部キーは `onDelete: Restrict` にする。`userId` / `idempotencyKey` / `requestHash` は NOT NULL にする。
`safe-migration` スキルの手順で `migrate dev` を実行し、`bun run erd:generate` で ERD を作り直す。`scripts/erd/generate-erd.ts` の `PAGES` に新しいモデルを足す。

**Verify**: `bunx prisma validate` が成功する。ERD の orphan WARNING が 0 件。`grep -n "@@unique(\[userId, idempotencyKey\])" prisma/schema.prisma` が 1 件。

### Step 2: Red — 統合テスト `tests/integration/returns-rma.test.ts`

testcontainers（ADR-004）で次のシナリオを書く。

1. **IDOR（3 階層・`docs/testing/SECURITY_GAP_REPORT.md` §5.2）**: 顧客 B が顧客 A の `orderItemId` で申請すると、(a) `"Order item not found"` で拒否され、(b) クエリの条件に `o."userId"` が含まれ、(c) `ReturnRequest` が 0 件のまま。
2. **店舗のスコープ**: 店舗 X の seller が、店舗 Y の RMA を承認しようとしても拒否され、状態が変わらない。
3. **自分では承認できない**: 顧客が自分の RMA に T2 / T6 / T7 を実行しようとしても拒否される。
4. **数量の上限 R-1**: 購入数 3 に対し、2 個と 2 個の申請を `Promise.all` で同時に送る。片方だけが成功する。
5. **冪等性 R-2**: 同じキーと同じ内容で 2 回送ると、同じ RMA の ID が返り、行は 1 件。同じキーで内容を変えると `"Idempotency key was reused with a different request."` で拒否される。キーを省略すると Zod で拒否される。
6. **遷移の冪等性**: T2 を 2 回実行しても、`approvedAt` と通知は 1 回だけ。
7. **在庫の差し引き**: 3 個買い、1 個を返品（RESELLABLE）→ T6 で在庫が +1。その後 `updateOrderPaymentStatus(order, Refunded)` を実行すると +2。合計でちょうど +3。
8. **DAMAGED**: 受け取りで DAMAGED にすると在庫は戻らない。その後に注文を返金しても、その 1 個は戻らない。
9. **すでに終端の item**: 先に注文を取り消した後で T6 を実行しても、在庫は戻らない（`restockedQuantity = 0`）。
10. **全数の返品**: 全数を T7 で解決すると `OrderItem.status = Returned` になり、在庫は二重に戻らない。
11. **適格性**: `Delivered` 以外の item、期限切れ、`acceptsReturns = false` の店舗は拒否される。
12. **通知**: T1 で seller に `rma.requested`、T2 で顧客に `rma.approved` が記録される。送信のプロバイダが失敗しても、RMA の遷移は残る。

**Verify**: すべて意図どおりの理由で失敗する（action が無い、または期待と違う）。

### Step 3: Green — ポリシーと action

- `src/lib/returns-policy.ts`: 環境変数 `RETURN_WINDOW_DAYS_DEFAULT` は `trim()` → `Number` → 空なら 30、不正な値なら throw（tech.md）。`.env.example` に追記する。期限の計算は design §6 の式で行う。
- `src/queries/returns.ts`（`"use server"`）:
  - `createReturnRequest`: `requireUser()` は try/catch の外に置く。Zod の後、design §2.2 の tx（`FOR UPDATE` + `groupBy`）で作成する。P2002 は tx の外で捕まえて、`requestHash` を比べる（§2.3）。
  - `approveReturnRequest` / `rejectReturnRequest` / `receiveReturnRequest` / `resolveReturnRequest`（seller: `requireStoreOwner(storeUrl)` + `where.storeId`）と、それぞれの admin 版（`requireAdmin()`）。
  - `cancelReturnRequest` / `setReturnTrackingNumber`（顧客: `requireUser()` + `where.userId`）。
  - どの遷移も「遷移元を固定した `updateMany` → `count === 1` のときだけ副作用」の形にする。通知は同じ tx で記録し、commit 後に `scheduleDispatch` する（`order.ts` の `dispatchAfterCommit` と同じ扱い）。
  - 返金額は `Prisma.Decimal` で計算する。ログは `logError` を使い、PII（`customerNote`）は出さない。
- `src/queries/order.ts`: `settleOrderItems` で、`RETURNING` で得た各 item について、`status ∈ {RECEIVED, RESOLVED}` の RMA 明細の数量を差し引いてから戻す（design §4.3）。

**Verify**: Step 2 の統合テストと 087 の統合テストがすべて green。

### Step 4: ユニットテスト `src/queries/returns.test.ts`

tx をモックし、各 action について次を確かめる（AAA）: 認可の失敗が汎用メッセージで上書きされないこと。`count === 0` で副作用が無いこと。Zod の境界（`quantity` が 0 / 負 / 小数、`resolution = EXCHANGE`、キーの省略）。

**Verify**: `bun run test -- src/queries/returns.test.ts` が green。

### Step 5: UI

- 注文詳細（`src/app/(fullscreen)/order/[orderId]/page.tsx`）: 適格な item がある店舗のグループに「返品を申請」を置く。申請フォーム（明細ごとの数量・理由、メモ）では、`idempotencyKey` をフォームを開いた時点で作り、二重送信を防ぐ（`useRef` のリエントランシーガード・tech.md）。既存の RMA の状態を表示する。
- seller ダッシュボード: `src/app/dashboard/seller/stores/[storeUrl]/returns/` に返品キュー（状態で絞り込み、承認・却下・受け取り・解決の操作）を置く。
- `/returns-exchange`: 返品できる日数を `resolveReturnWindowDays` から描く。ログイン中の人向けに、注文詳細への案内を足す（design §3）。
- UI から `src/queries/` を直接 import しない規約（tech.md の禁止事項）に従い、Server Component を経由する。

**Verify**: `design-system-workflow` の実装後の検証を行う。`DESIGN_SUITE=<suite> bun run test:design`（新しい suite は `playwright.design.config.ts` の `DESIGN_SUITES` に 1 行足す・`.claude/rules/05-playwright-harness.md`）。

### Step 6: E2E

`tests/e2e/returns-rma.spec.ts`: 顧客が申請 → seller が承認 → 受け取り → 解決 → 顧客の画面で「解決済み」と表示される。`bun run seed:e2e` に、Delivered の注文を 1 件足す。

### Step 7: 文書の同期

- `spec-sync-after-test`（テスト件数が変わるため）。
- `specs/multi-vendor-ecommerce/03-data-model.md`（モデル）、`04-interfaces.md`（action）、`05-workflows.md`（RMA の遷移表）。
- `docs/design/returns-rma/design.md` に「§9 実装で確定した差分」を追記する（差分があれば）。
- `docs/design/design-system/PROGRESS.md`（UI の状態）。

## Test plan

| 層 | 対象 | 件数の目安 |
| --- | --- | --- |
| 統合 | Step 2 の 12 シナリオ | +14〜18 |
| ユニット | Step 4 | +20〜30 |
| E2E | Step 6 | +1 spec |

## Done criteria

- [ ] 統合テスト「他人の OrderItem に対する RMA 申請が拒否され、副作用が無い」（IDOR 3 階層）が green
- [ ] 統合テスト: 店舗のスコープ、自分では承認できない、R-1 の並行、R-2 の冪等性、在庫の差し引き（+3 ちょうど）が green
- [ ] `grep -rnF "rma.refunded" src/` が 0 件（`rma.resolved` に改名済み）
- [ ] `grep -n "idempotencyKey" prisma/schema.prisma` が `String`（`?` なし）
- [ ] `bun run erd:generate` を実行し、`docs/architecture/data-model.drawio` が同じコミットに含まれている
- [ ] `bunx tsc --noEmit` 0 エラー、`bun run lint` 0 エラー、`bun run test` 全件 pass
- [ ] 返金 API（`stripe.refunds` / PayPal の refund）を呼ぶコードが追加されていない（`git diff cfbcd9a6 -- src | grep -i "refunds\.create\|/refund"` が 0 件）
- [ ] テスト統計の同期ドキュメントが実測値で更新されている
- [ ] `plans/README.md` の 088 の行を更新した

## STOP conditions

- 087 が未完了。
- `FOR UPDATE OF oi` を含む `$queryRaw` が Accelerate 経由で動かない（ローカルの直接接続では動き、Accelerate では動かない場合も含む）。代わりの方式は判断を仰ぐ。
- `orderItemId` の `onDelete: Restrict` が既存の削除フロー（商品の削除・ユーザーの削除 webhook）を壊す。`tests/integration/product-deletion.test.ts` / `user-deletion-webhook.test.ts` が落ちたら STOP する。
- 返金額に送料やクーポンを含める必要が生じた（DIRECTION-01 の設計判断になる）。
- `SupportTicket` の構造を変える必要が生じた（DIRECTION-03 と競合する）。

## Maintenance notes

- レビューで最も精査すべき点:
  - (1) 遷移 action の権限の対応表（顧客が APPROVED を付けられないこと、seller の `where.storeId`）。
  - (2) `createReturnRequest` の SQL に `o."userId" = ${user.id}` があること。
  - (3) T6 と `settleOrderItems` が、同じ OrderItem の行ロックで直列になっていること。
  - (4) 通知の記録が tx の中、送信が tx の外にあること。
- plan 022 で `deliveredAt` が入ったら、`isReturnEligible` の基準時刻を置き換える（design §6）。
- 交換を入れるときは、終端の item を再オープンせず、新しい OrderItem を作る（087 の吸収状態）。
