# Plan 086: 通知基盤を入れ、店舗単位の発送状態（Shipped / Delivered）を顧客へ通知する

> **Executor instructions**: このプランを Step 順に進める。各 Step の Verify を実行し、期待どおりの結果を確認してから次へ進む。
> 「STOP conditions」に当たったら止まって報告する（その場で工夫しない）。
> 完了したら `plans/README.md` の 086 の行を更新する。
>
> **設計の正本**: [`docs/design/notification-foundation/design.md`](../docs/design/notification-foundation/design.md)（以下 design）。
> 本プランは design の決定を実装するだけで、決定は変えない。変えたくなったら STOP する。
>
> **Drift check（最初に実行）**:
> ```bash
> git diff --stat ca737ec5 -- prisma/schema.prisma package.json src/queries/order.ts src/lib/ src/components/store/layout/header/
> git status --porcelain -- prisma/ src/ package.json
> ```
> 対象のファイルが変わっていたら、下の「Current state」の抜粋を現行コードと突き合わせる。食い違っていたら STOP する。

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MED（スキーマの追加と、seller の注文更新を tx へ書き換える。送信は tx の外なので、通知の失敗が注文更新を壊すことはない）
- **Depends on**: [021](021-spike-notification-foundation.md)（spike・決定済み）
- **Category**: direction（実装）
- **Planned at**: commit `ca737ec5`, 2026-10-07

## Why this matters

顧客が注文の進み具合を知る手段は、自分から画面を見に行くことしかない。016（審査）・018（返品）・チケット返信は
いずれも通知を必要としている。それぞれが個別にメールを送ると、発火点・文面・送信停止の管理が散らばる。
本プランで共通の基盤（記録・送信・マッピング）を入れ、最初の利用者として「店舗ごとの発送・配達」を配線する。
以降の機能は、マッピング表に行を足して `recordNotifications` を呼ぶだけで済む。

## Current state

- `src/queries/order.ts:159-229` — seller の `updateOrderGroupStatus`。**tx を使わない**単発の `db.orderGroup.update`（`:214`）で、
  更新前の状態を確認しない。親 `Order` への連動も無い
  ```ts
  const updatedOrder = await db.orderGroup.update({   // order.ts:214
      where: { id: groupId },
      data: { status },
  });
  return updatedOrder.status;
  ```
- `src/queries/order.ts:451-474` — `updateOrderGroupStatusAsAdmin`。`db.$transaction(async (tx) => …)` の中で group を更新し、
  `reconcileParentOrderStatus(tx, group.orderId)` を呼ぶ
- `src/queries/order.ts:548-610` — `updateOrderPaymentStatus`。条件付き `updateMany` で `didTransition` を判定する**手本**
- `src/queries/order.ts:401-405` — `OrderTransactionClient`（Accelerate 拡張済みの tx の型。`$transaction` から導き出したもの）。
  通知の `NotificationTx` もこの型を使う
- `src/queries/store.ts:598-680` — 外部呼び出し（Clerk）を tx の commit 後に置く手本
- `src/lib/utils.ts` — `normalizePositiveIntParam`（一覧の件数の上限クランプに使う）
- 規約: 認可ガードは `try/catch` の外に置く（`src/lib/auth-guards.ts`）。ログは `"[Module:Function] msg", { error, stack }` の 2 引数形式。
  `src/` で `console.log` は禁止。スキーマを変えたら `bun run erd:generate`（`.claude/rules/03-data-model-diagram-sync.md`）
- 設計上の決定（design から引用）:
  - 「`dedupeKey` は **NOT NULL**。挿入は `createMany({ skipDuplicates: true })`」（§2.2）
  - 「送信済みを送信の前に書かない。送る前に書くのは `SENDING` とリースだけ」（§4.3）
  - 「sweeper は `firstAttemptAt` から 23 時間を過ぎた行を再試行しない」（§4.4）
  - 「宛先・本文・params はログに出さない」（§7.2）

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Prisma client | `bunx prisma generate` | exit 0 |
| Migration（ローカル） | `bunx prisma migrate dev --name add_notifications` | 新しいマイグレーションが 1 つ作られる |
| ERD | `bun run erd:generate` | stderr に orphan WARNING が出ない |
| Typecheck | `bunx tsc --noEmit` | exit 0 |
| Lint | `bun run lint` | 0 errors |
| Unit tests | `bunx jest src/lib/notifications src/queries/order.test.ts src/queries/notification.test.ts` | all pass |
| Integration | `bun run test:integration -- tests/integration/notification-outbox.test.ts` | all pass（Docker が必要） |

## Suggested executor toolkit

- `safe-migration` スキル（マイグレーション）、`server-action-scaffold`（`src/queries/notification.ts`）、`erd-diagram-adjust`（モデル追加後の図）
- `spec-sync-after-test`（テスト数が変わるので必須。`.claude/rules/02-tdd-step-commit.md`）
- Next.js の `after()`: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`

## Scope

**In scope**:
- `prisma/schema.prisma`（`Notification` / `NotificationDelivery` / `DeliveryStatus` と `User` の逆リレーション）+ 新規マイグレーション
- `docs/architecture/data-model.drawio` + `scripts/erd/generate-erd.ts`（`PAGES` に新モデルを追加）
- `src/lib/notifications/`（新規: `types.ts` / `mapping.ts` / `templates.ts` / `dedupe-key.ts` / `record.ts` / `dispatch.ts` / `email-provider.ts` / `stub-provider.ts` と各テスト）
- `src/queries/order.ts`（`updateOrderGroupStatus` / `updateOrderGroupStatusAsAdmin` への配線のみ）と `order.test.ts`
- `src/queries/notification.ts`（新規: 一覧 / 未読件数 / 既読化 / すべて既読）+ テスト
- `src/app/api/cron/notifications/route.ts`（新規）+ テスト
- `src/components/store/layout/header/user-menu/`（ベル）と `src/app/(store)/profile/notifications/page.tsx`（一覧）
- `tests/integration/notification-outbox.test.ts`（新規）
- `.env.example`（`EMAIL_PROVIDER` / `CRON_SECRET` / `EMAIL_FROM`）
- 仕様書: `specs/multi-vendor-ecommerce/03-data-model.md` / `04-interfaces.md`、テスト統計の同期対象
- `plans/README.md`（別の docs コミット）

**Out of scope**:
- `resend` SDK の追加と `ResendEmailProvider`（**ユーザーの承認を得るまで行わない**。Step 9 は承認待ちで止めてよい）
- 支払い・店舗承認・webhook への配線（マッピングに行を置くだけ。後続プランで配線する）
- `sendMessage`（チャット）への配線（design §1 で除外した）
- 販促メールと opt-out の UI（design §7）
- cron のスケジュール設定（`vercel.json` 等。デプロイ先が決まってからオペレーターが行う）

## Git workflow

- ブランチ: `dev`（リポジトリの慣習）。コミットはユーザーが明示的に依頼したときだけ行う
- 1 Step = 1 コミット（Red / Green は分ける）。形式は `feat(notifications): …` / `test(notifications): …`（例: `git log` の `test(api): isolate route module in rate limit tests …`）
- push と PR はオペレーターの指示があるときだけ

## Steps

### Step 0: 前提の確認

- デプロイ先の cron の制約（頻度の上限・`maxDuration`）を確認し、「実施結果」節に書く。分からなければ「未確定」と書いて進む（design は頻度が粗くても成り立つ）
- **Verify**: Drift check の差分が無い、または抜粋と一致する

### Step 1: スキーマとマイグレーション

design §2.1 のモデルをそのまま追加する（`dedupeKey String @unique`。**nullable にしない**）。`safe-migration` スキルで `migrate dev` を実行し（`db push` は禁止）、
`bun run erd:generate` を実行する。

- **Verify**: `bunx prisma validate` が exit 0。`grep -n "dedupeKey" prisma/schema.prisma` → `String @unique`（`?` が付いていない）。ERD の orphan WARNING が 0

### Step 2 (Red → Green): `dedupe-key.ts` と `mapping.ts`

- `buildDedupeKey(event)` は design §2.2 の形式で返す。256 文字を超えたら SHA-256 の hex を返す。空の要素があれば throw する
- `NOTIFICATION_MAPPING` は design §6.1 の表を `as const satisfies` で定義する。`templates.ts` は `Record<NotificationType, …>` で、全種別を網羅する
- **Verify**: 単体テスト（形式 / 長いキーのハッシュ化 / 空要素で throw / テンプレートの網羅）が pass

### Step 3 (Red → Green): `record.ts`

- `recordNotifications(tx, events)`: マッピングに従って `Notification` を `createMany({ skipDuplicates: true })` で作る。
  `email` チャネルを持つ種別には `NotificationDelivery(PENDING)` も作る。新しく作った delivery の ID を返す（重複でスキップされた分は返さない）
- `buildNotificationWrites(events)`: 配列形式の tx 向け（今回は呼び出し元が無い。テストだけ書く）
- **Verify**: 単体テスト（tx のモックへの呼び出し形 / 重複のとき delivery を作らない / in-app のみの種別は delivery を作らない）が pass

### Step 4 (Red → Green): `email-provider.ts` / `stub-provider.ts` / `dispatch.ts`

- `getEmailProvider()` は `EMAIL_PROVIDER` を `trim()` してから判定する。未設定は `stub`。未知の値は throw する（設定ミスを黙って stub にしない）
- `dispatchPendingDeliveries({ deliveryIds?, limit })` は design §4.3 のリース方式で実装する。claim は条件付き更新（`updateMany` か `$queryRaw` の `RETURNING`）で行う
- `firstAttemptAt` から 23 時間を過ぎた行は `FAILED`（`retry_window_exceeded`）にする。`idempotencyWindowMs === 0` のプロバイダでは、リース切れの `SENDING` を再送せず `FAILED` にする
- 宛先は送信の直前に `User.email` から読む。ログには delivery の ID と `errorKind` だけを出す
- **Verify**: 単体テスト（成功で SENT / 再試行できる失敗で PENDING に戻る / 再試行できない失敗で FAILED / リース中の行は claim されない / 23 時間超で FAILED / ログに宛先が含まれない）が pass

### Step 5 (Red → Green): 注文の発送状態への配線

- `updateOrderGroupStatus`（seller）: 所有権の確認は今の位置（try の外）のまま残す。更新を `db.$transaction(async (tx) => …)` に入れ、
  `tx.orderGroup.updateMany({ where: { id: groupId, storeId, status: { not: status } }, data: { status } })` に置き換える。
  `count === 1` で、かつ `status` が `Shipped` / `Delivered` のときだけ、同じ tx の中で `recordNotifications` を呼ぶ。
  受信者は `tx.order.findUnique({ where: { id: order.orderId }, select: { userId: true } })` で求める
- `count === 0`（同じ状態への再設定）のときは、**通知せずに**現在の状態を返す（戻り値の互換を保つ）
- commit 後に `after(() => dispatchPendingDeliveries({ deliveryIds, limit: deliveryIds.length }))` を呼ぶ。`after` の中の失敗はログに出すだけにする（注文更新の結果を変えない）
- admin 版（`updateOrderGroupStatusAsAdmin`）にも同じ配線をする（tx は既にある）
- **Verify**: `order.test.ts` に次のテストを足して pass させる
  - Shipped への遷移で `recordNotifications` が 1 回呼ばれる / 同じ状態への再設定では呼ばれない / Processing への遷移では呼ばれない
  - **`dispatchPendingDeliveries` が reject しても、`updateOrderGroupStatus` は成功して新しい状態を返す**（送信の失敗が主処理を壊さない）
  - **`recordNotifications` が throw したら、`updateOrderGroupStatus` は既存の汎用メッセージ `"Failed to update order group status."` で失敗する**（記録の失敗は主処理を巻き込む = design §4.5）
  - 認可（他店舗 / 未認証）の既存テストが変わらず pass する

### Step 6 (Red → Green): 一覧・既読化の Server Action（`src/queries/notification.ts`）

- `getMyNotifications({ cursor?, limit? })` / `getUnreadNotificationCount()` / `markNotificationRead(id)` / `markAllNotificationsRead()`
- すべて `requireUser()` を try の外で呼ぶ。`where` には必ず `userId: user.id` を入れる（IDOR）。`limit` は `normalizePositiveIntParam(…, { fallback: 20, max: 50 })` でクランプする
- **Verify**: IDOR の 3 階層テスト（(a) 他人の ID で throw または 0 件 / (b) `where` に `userId` が入っている / (c) 他人の行が更新されない — `docs/testing/SECURITY_GAP_REPORT.md` §5.2）が pass

### Step 7 (Red → Green): cron エンドポイント

- `GET /api/cron/notifications`: `CRON_SECRET` が未設定なら 503。`Authorization: Bearer` を `crypto.timingSafeEqual` で比較し、一致しなければ 401。
  一致したら `dispatchPendingDeliveries({ limit: 50 })` を実行し、既読かつ 180 日を過ぎた `Notification` を削除する。件数を JSON で返す
- `export const dynamic = 'force-dynamic'`
- **Verify**: route テスト（503 / 401 / 長さの違うトークンで 401 / 200 で件数を返す）が pass

### Step 8: UI（ベルと一覧）

- design-system-workflow（`.agent/skills/design-system-workflow/SKILL.md`）に従う。ベルは `account-menu.tsx` の近くに置き、未読件数のバッジを付ける。一覧は `/profile/notifications` に置き、`profile/layout.tsx` の認証を通す
- UI コンポーネントから `src/queries/` を直接 import しない（Server Component から渡す）
- **Verify**: コンポーネントテスト（未読 0 でバッジを出さない / 件数を表示する / 既読化で件数が減る）が pass。E2E が必要なら `tests/browser/` の design suite として足す（`.claude/rules/05-playwright-harness.md`）

### Step 9（ユーザー承認が必要）: Resend の導入

- **ユーザーに `resend` の追加の承認を求める。承認が無ければこの Step は飛ばし、「実施結果」節に「未承認」と書く**（Status は `IN PROGRESS（Resend 承認待ち）`）
- 承認されたら `ResendEmailProvider` を追加する（`idempotencyWindowMs = 24h`、`idempotencyKey` は `Idempotency-Key` として渡す）。SDK の呼び出しは `try/catch` で包み、`EmailSendResult` に変換する
- **Verify**: SDK をモックした単体テスト（冪等キーが渡る / 4xx は再試行しない / 5xx は再試行する）が pass

### Step 10: 統合テストと文書の同期

- `tests/integration/notification-outbox.test.ts`（ADR-004 の testcontainers）:
  - group を Shipped にすると `Notification` が 1 行、`NotificationDelivery(PENDING)` が 1 行できる
  - 同じ遷移をもう一度送っても行が増えない（一意制約）
  - 通知の書き込みを失敗させると、`OrderGroup.status` も変わらない（ロールバック）
- `spec-sync-after-test` を実行する（`QA_HANDOFF.md` が SSOT → `07-testing.md` / `COVERAGE_REPORT.md` / `PROGRESS.md`、`bun run coverage:dashboard`）
- `03-data-model.md` / `04-interfaces.md` を更新する。`tech.md` に「新しい状態遷移を足すときは `NOTIFICATION_MAPPING` の更新を検討する」を追記するよう**提案する**（追記はユーザーが判断する）
- **Verify**: `bunx tsc --noEmit` exit 0、`bun run lint` 0 errors、`bun run test` all pass、統合テストが pass

## Test plan

- 単体: `src/lib/notifications/*.test.ts`（Step 2〜4）、`src/queries/order.test.ts`（Step 5）、`src/queries/notification.test.ts`（Step 6）、`src/app/api/cron/notifications/route.test.ts`（Step 7）
- 手本: tx をモックする書き方は `src/queries/order.test.ts` の `updateOrderPaymentStatus` のテスト、route の書き方は `src/app/api/setUserCountryInCookies/route.test.ts`
- 統合: Step 10 の 3 ケース
- **統合テストだけで守った分岐は lcov に載らない**ので、ロールバックの分岐は単体テストでも押さえる（Step 5 の 2 つの太字のテスト）

## Done criteria

- [ ] `bunx tsc --noEmit` exit 0 / `bun run lint` 0 errors / `bun run test` all pass / 統合テストが pass
- [ ] `grep -n "dedupeKey" prisma/schema.prisma` が `String @unique` を示し、nullable ではない
- [ ] **メール送信が失敗しても注文状態の更新が成功することのテスト**がある（Step 5）
- [ ] 通知の記録が失敗したら注文状態の更新も失敗することのテストがある（Step 5・統合 Step 10）
- [ ] `grep -rn "console.log" src/lib/notifications src/queries/notification.ts` → 0 件
- [ ] ERD を再生成した（orphan WARNING 0）
- [ ] **`resend` SDK の追加はユーザーの承認後に行った**（承認が無ければ `package.json` に `resend` が無く、Status が `IN PROGRESS（Resend 承認待ち）`）
- [ ] テスト統計を同期し、ダッシュボードを再生成した
- [ ] `plans/README.md` の 086 の行を更新した

## STOP conditions

- design の決定（P1 Outbox / 23 時間の再試行窓 / NOT NULL の dedupeKey）を変えたくなった → STOP（design を先に改訂する）
- seller の `updateOrderGroupStatus` を tx に入れると、既存のテストが戻り値や例外の文言の変化で落ちる → STOP（互換性の判断が要る）
- `after()` が Server Action の中で使えない（Next.js のバージョン差など）→ STOP（sweeper だけで成り立つかを判断し直す）
- 016 / 018 の spike が先に完了していて、その通知がマッピングの形式で表せない → STOP し、形式の拡張案を添えて報告する

## Maintenance notes

- 新しい発火点を足すときは、(1) 遷移を条件付き更新で判定する、(2) 同じ tx の中で `recordNotifications` を呼ぶ、(3) commit 後に `after()` で送る、の 3 点を守る
- レビュアーが最も見るべき点: **送信（`dispatchPendingDeliveries`）が tx の外にあること**と、**記録（`recordNotifications`）が tx の中にあること**。この 2 つは逆にしてはいけない
- メールのプロバイダを冪等キー非対応のものへ替えるときは、design §4.4 と ADR-010 を先に改訂する
- cron のスケジュール設定（デプロイ先のダッシュボードや `vercel.json`）はオペレーターの作業。設定するまで、取りこぼしは回収されない（`after()` の経路だけで送られる）

## 実施結果

（未着手）
