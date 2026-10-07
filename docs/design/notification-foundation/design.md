# 通知・トランザクショナルメッセージ基盤 — 設計（design.md）

> plan [021](../../../plans/021-spike-notification-foundation.md)（design/spike）の成果物。
> **本ドキュメントは設計のみ。`src/` / `prisma/schema.prisma` / `package.json` は 1 行も変更しない。**
> メールプロバイダの選定根拠は [ADR-010](../../architecture/decisions/010-transactional-email-provider.md)（Proposed）、
> 実装手順は後続の実装プラン [086](../../../plans/086-implement-notification-foundation.md) に書く。
>
> - 調査日: 2026-10-07 / 対象 HEAD: `ca737ec5`（branch `dev`）
> - ドリフトチェック（`86c04a1..HEAD`）: `order.ts` / `store.ts` / `message.ts` / header 配下は変更されている。
>   ただし **Notification 系モデルもメール送信 SDK も追加されていない**ので、STOP 条件には当たらない。
>   plan 021 本文の行番号は古くなっているため、本書の file:line は上記 HEAD で取り直した値を使う。
> - 相互参照: plan [018](../../../plans/018-spike-returns-rma-workflow.md) Q6（RMA 通知の原子性）は**本書 §4 のモデルに合わせる**（§4.5 の対応表）。

---

## 0. 設計の前提（実コードで確認した事実）

| #   | 事実 | 出典 |
| --- | ---- | ---- |
| 0-1 | Notification 系モデルは無い。メール SDK（resend / nodemailer / sendgrid / postmark / ses）も無い | `prisma/schema.prisma` / `package.json`（grep 0 件） |
| 0-2 | 既読管理の先例は `Message.isRead` / `readAt` と `@@index([conversationId, isRead])` だけ | [`schema.prisma:918-932`](../../../prisma/schema.prisma) |
| 0-3 | 既読化は `markConversationRead` が行う | [`message.ts:281`](../../../src/queries/message.ts) |
| 0-4 | seller の `updateOrderGroupStatus` は **tx を使わない単発の `update`** で、更新前の状態を確認しない（同じ状態への再設定でも成功する）。親 `Order.orderStatus` への連動も**無い** | [`order.ts:159-229`](../../../src/queries/order.ts)（update は `:214`） |
| 0-5 | seller の `updateOrderItemStatus` は所有店舗にスコープした `updateMany`（tx なし） | [`order.ts:241`](../../../src/queries/order.ts)（`:275`） |
| 0-6 | admin の `updateOrderGroupStatusAsAdmin` は `$transaction` の中で group を更新し、`reconcileParentOrderStatus` で親を連動させる | [`order.ts:451-474`](../../../src/queries/order.ts) / [`order.ts:407-439`](../../../src/queries/order.ts) |
| 0-7 | `updateOrderPaymentStatus` は `$transaction` の中で、条件付き `updateMany` により「実際に遷移したか（`didTransition`）」を判定している | [`order.ts:548-610`](../../../src/queries/order.ts) |
| 0-8 | `updateStoreStatus` は `$transaction` の中で `FOR UPDATE` で更新前の状態を読み、`PENDING → ACTIVE` のときだけロールを昇格させる。**Clerk 呼び出しは tx commit の後**に置いている（外部呼び出しを tx の外に出す先例） | [`store.ts:574-680`](../../../src/queries/store.ts)（tx `:598`、判定 `:631`） |
| 0-9 | `sendMessage` は**配列形式**の `$transaction([...])` を使う（interactive tx ではない） | [`message.ts:231-260`](../../../src/queries/message.ts)（`:246`） |
| 0-10 | Stripe / PayPal の webhook は `$transaction` の中で `PaymentDetails` の upsert と `Order` の更新を行う。Clerk webhook は Svix で署名を検証している | [`webhooks/stripe/route.ts:174`](../../../src/app/api/webhooks/stripe/route.ts) / [`webhooks/paypal/route.ts:240`](../../../src/app/api/webhooks/paypal/route.ts) / [`webhooks/route.ts:8,53`](../../../src/app/api/webhooks/route.ts) |
| 0-11 | `vercel.json` も cron の定義も無い。本番は Vercel Hobby を前提にしている（[ADR-009](../../architecture/decisions/009-public-endpoint-rate-limiting.md)）が、デプロイ先は plan 021 の方針に従い**未確定として扱う** | リポジトリのルート |
| 0-12 | Next.js 16 には `after()`（`next/server`）がある。レスポンスを返した後に処理を走らせられ、Server Function と Route Handler から呼べる。**レスポンスが失敗しても実行される**ため、commit 済みかどうかはコールバックの中で DB を見て判断しなければならない | `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md` |
| 0-13 | ベルを置く場所はヘッダーのユーザーメニュー | [`header/user-menu/account-menu.tsx`](../../../src/components/store/layout/header/user-menu/account-menu.tsx) |

---

## 1. 発火点の棚卸し（Step 1）

| イベント | 発火点 | 受信者の導き方 | tx | 初期スコープ |
| --- | --- | --- | --- | --- |
| 店舗単位の発送状態の遷移（Shipped / Delivered） | `updateOrderGroupStatus`（seller `order.ts:159`）/ `updateOrderGroupStatusAsAdmin`（`:451`） | `OrderGroup.orderId → Order.userId` | seller: **無し**（086 で導入する）/ admin: 有り | ✅ 最初に実配線する |
| 明細の状態遷移 | `updateOrderItemStatus`（`:241`）/ admin 版（`:510`） | `OrderItem → OrderGroup → Order.userId` | 無し | ❌ 粒度が細かすぎてノイズになる。group 単位でまとめて通知する |
| 支払いのキャンセル・返金 | `updateOrderPaymentStatus`（`:548`、`didTransition` のとき） | `Order.userId` | 有り | ✅ マッピングに行を置く（配線は 086 の後半） |
| 支払いの確定・失敗 | Stripe / PayPal webhook（`stripe/route.ts:174` / `paypal/route.ts:240`） | `order.userId`（既に取得済み） | 有り | ✅ 行のみ置く（配線は後続） |
| 店舗の承認 | `updateStoreStatus`（`store.ts:631` の `PENDING → ACTIVE`） | `Store.userId` | 有り | ✅ 行のみ置く（配線は後続） |
| チャットの新着 | `sendMessage`（`message.ts:246`） | 会話の相手方 | 有り（配列形式） | ❌ **in-app の未読は `Message.isRead` が既に担っている**。二重に持たない。メール通知が要るときに再検討する |
| （計画中）出品審査の合否 | spike 016 | `Store.userId` | — | マッピングに行を予約する |
| （計画中）RMA の状態遷移 | spike 018 | 顧客 / 販売者 | — | マッピングに行を予約する |
| （計画中）チケットへの返信 | DIRECTION-03 | 顧客 | — | 将来 |

> **seller 側の group 更新は「遷移」を判定していない（0-4）。** このまま通知を足すと、同じ `Shipped` を 2 回保存したときに
> 通知も 2 回作られそうに見える。実際には `dedupeKey`（§2.2）が行を 1 つに抑えるが、意図は「遷移したときだけ通知する」なので、
> 086 では `updatePaymentStatus` と同じ**条件付き `updateMany`（`status: { not: target }`）**に置き換え、`count === 1` のときだけ通知する。

---

## 2. Q1 — Notification テーブルの形と冪等性

### 2.1 決定: in-app の記録（`Notification`）とチャネルごとの配信（`NotificationDelivery`）を分ける

```prisma
model Notification {
  id         String    @id @default(uuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  type       String    // NotificationType（コード定数。§6 のマッピング表のキー）
  params     Json      // テンプレートの差し込み値（PII は最小限。§7）
  linkUrl    String?   // アプリ内の相対パスのみ（外部 URL は禁止）
  sourceType String    // "OrderGroup" | "Order" | "Store" | ...（ポリモーフィック参照）
  sourceId   String
  dedupeKey  String    @unique   // NOT NULL（§2.2）
  isRead     Boolean   @default(false)
  readAt     DateTime?
  createdAt  DateTime  @default(now())

  deliveries NotificationDelivery[]

  @@index([userId, isRead, createdAt]) // ベルの未読件数と一覧（新しい順）
  @@index([sourceType, sourceId])      // 発生源からの逆引き（RMA 側の表示など）
}

model NotificationDelivery {
  id             String         @id @default(uuid())
  notificationId String
  notification   Notification   @relation(fields: [notificationId], references: [id], onDelete: Cascade)
  channel        String         // "email"（in-app は Notification 行そのものが配信を兼ねる）
  status         DeliveryStatus @default(PENDING)
  attemptCount   Int            @default(0)
  leaseExpiresAt DateTime?
  firstAttemptAt DateTime?
  sentAt         DateTime?
  providerMessageId String?
  lastError      String?        // プロバイダのエラー種別のみ。宛先や本文は入れない
  createdAt      DateTime       @default(now())

  @@unique([notificationId, channel])
  @@index([status, leaseExpiresAt])    // sweeper が拾う対象の抽出
}

enum DeliveryStatus { PENDING SENDING SENT FAILED SKIPPED }
```

**根拠**

- `Message` の `isRead` / `readAt` と複合インデックスの形（0-2）をそのまま使う。違いは、絞り込みのキーが `conversationId` ではなく `userId` になることと、一覧で新しい順に並べるため `createdAt` を末尾に足すことだけ。
- 発生源は FK ではなく `sourceType` / `sourceId` で持つ。通知は Order / Store / RMA / Ticket と種類の違う行を指すので、FK 列を並べると、発生源が増えるたびにスキーマを変えることになる。整合性は「発生源が消えても通知は履歴として残す」でよい（リンク先が 404 になるのは許容）。
- メール配信の状態を `Notification` に直接持たせない。チャネルが増えたとき（push 等）に、行ごとに状態列が増えてしまうため。

**保持・ページング・既読の一括化**

- 一覧は `(userId, createdAt desc)` のカーソルページングで、1 ページ 20 件とする（`normalizePositiveIntParam` で上限を 50 にクランプする）。
- 「すべて既読にする」は `updateMany({ where: { userId, isRead: false } })` で行う（`markConversationRead` と同じ形）。
- 保持期間は **180 日**とする。既読かつ 180 日を過ぎた行は sweeper が削除する（§4 の cron に相乗りする）。未読は削除しない。

### 2.2 決定: `dedupeKey` の共通生成規則（016 / 018 も同じ規則で作る）

```
dedupeKey = `${type}:${sourceType}:${sourceId}:${transition}:${recipientUserId}`
// 例: "order.group.shipped:OrderGroup:7f3c…:Shipped:user_2a…"
//     "store.approved:Store:91ab…:PENDING->ACTIVE:user_9d…"
```

- `transition` は「遷移後の状態」か「遷移前->遷移後」のどちらかで書く。webhook の再送は provider のイベント ID ではなく**遷移**で重複を抑える（Stripe と PayPal で同じ遷移が来ても 1 行にするため）。
- 長さが 256 文字を超えうる場合は SHA-256 の hex にする（`node:crypto`。依存は増えない）。
- `dedupeKey` は **NOT NULL**。NULL にすると PostgreSQL の一意制約を通り抜けてしまい、制約が無いのと同じになる。キーを作れないイベントは `notify()` が投入前に throw する。
- 挿入は `createMany({ skipDuplicates: true })`（PostgreSQL の `ON CONFLICT DO NOTHING`）で行う。重複のときに主処理を失敗させないため。

**既知のトレードオフ**: `Shipped → Processing → Shipped` のように同じ遷移をやり直すと、2 回目は通知されない。差し戻しは運用上まれなので許容し、必要になったら `transition` に遷移の連番（`OrderGroup.updatedAt` のエポック値など）を足す。

---

## 3. Q2 — チャネルの差し替え口（seam）

### 3.1 決定: 入口は 1 つ、「記録」と「送信」は別の関数にする

```ts
// src/lib/notifications/types.ts（086 で新設）
export type NotificationEvent = {
    type: NotificationType;               // §6 の定数キー
    recipientUserId: string;
    source: { type: string; id: string };
    transition: string;
    params: Record<string, string | number>;
    linkUrl?: `/${string}`;
};

// 記録: 主処理と同じ tx の中で呼ぶ（§4 の P1）。送信はしない。
export const recordNotifications: (
    tx: NotificationTx,                   // interactive tx のクライアント
    events: readonly NotificationEvent[]
) => Promise<{ deliveryIds: string[] }>;

// 配列形式の $transaction（sendMessage など）向け。tx に混ぜられる Prisma の操作を返す。
export const buildNotificationWrites: (
    events: readonly NotificationEvent[]
) => Prisma.PrismaPromise<unknown>[];

// 送信: tx の外で呼ぶ。after() と cron の sweeper の両方から呼ばれる。
export const dispatchPendingDeliveries: (
    opts: { deliveryIds?: string[]; limit: number }
) => Promise<{ sent: number; failed: number; skipped: number }>;

// src/lib/notifications/email-provider.ts
export interface EmailProvider {
    readonly name: string;
    /** プロバイダ側で冪等キーを保持する時間。0 なら非対応（§4.4） */
    readonly idempotencyWindowMs: number;
    send(input: {
        to: string;
        templateKey: NotificationType;
        params: Record<string, string | number>;
        idempotencyKey: string;           // = `${dedupeKey}:email`
    }): Promise<EmailSendResult>;
}

// リポジトリに汎用の Result 型は無いので、判別共用体をここで定義する
export type EmailSendResult =
    | { ok: true; providerMessageId: string }
    | { ok: false; retryable: boolean; errorKind: string }; // errorKind に宛先・本文を含めない
```

- `EmailProvider` は `getEmailProvider()` が env（`EMAIL_PROVIDER=stub|resend`）で選ぶ。**ローカルと CI の既定は `stub`** で実送信しない（送った内容をメモリに残し、テストで検証できるようにする）。spike 017 の `getRelatedProducts(strategy)` と同じ考え方。
- 送信の結果は `EmailSendResult` で返し、throw しない（プロバイダ実装の中で SDK 呼び出しを `try/catch` し、`instanceof Error` で絞り込んでから変換する）。sweeper が 1 件の失敗で止まらないようにするため。
- 宛先メールアドレスは送信の直前に `User.email` から読む。`Notification.params` には入れない（PII を通知行に複製しない）。

### 3.2 初期方針の検証: in-app は必須、email は種別ごとに opt-in

- **妥当と判断する。** 注文・支払いの状態は画面（注文詳細・履歴）から必ず確認できるので、in-app が届けば必要な情報は欠けない。email は補助の扱いにでき、§4.4 の「配信は best-effort」と矛盾しない。
- 種別ごとの email の有無は §6 のマッピング表が決める（ユーザーの opt-out は §7）。

---

## 4. Q3 / Q4 — プロバイダと実行モデル

### 4.1 プロバイダ（Q3）

**第一候補は Resend**（ADR-010・Proposed）。冪等キーに対応していることを確認できた（保持は 24 時間）。導入するかどうかは **086 の時点でユーザーが承認する**。比較の詳細は ADR に書く。

### 4.2 決定: 軸 1 は (A) inline と (B) sweeper の併用、軸 2 は (P1) 原子的 Outbox

| | (P1) 原子的 Outbox | (P2) 永続キュー | (P3) 主処理を失敗させる | (P0) ログのみ |
|---|---|---|---|---|
| **(A) inline 送信** | 成立（※1） | 成立（※1） | 成立（※1） | ❌ 排除済み |
| **(B) 遅延ワーカー** | **✅ 採用（A の再試行経路として）** | 成立 | ❌ 成立しない（※2） | ❌ 排除済み |

※1・※2 の意味は plan 021 Q4 のとおり。採用する構成は **※1 の (i)「未送信の行を拾う sweeper を持つ」** にあたる。plan の指示どおり、これは「(A) 単独」ではなく **(A) + (B) の併用**だと明記しておく。

**流れ**

1. 主処理の `$transaction` の中で状態を更新し、遷移したときだけ `recordNotifications(tx, events)` を呼ぶ。`Notification` 行と `NotificationDelivery(PENDING)` 行が、主処理と一緒に commit されるか、一緒にロールバックされる（P1）。
2. tx が commit したら `after(() => dispatchPendingDeliveries({ deliveryIds, limit }))` を呼び、レスポンスを返した後に送る（A の速い経路）。`after` はレスポンスが失敗しても動く（0-12）が、tx がロールバックしていれば対象の行が存在しないので何もしない。
3. cron の sweeper（`/api/cron/notifications`）が、`PENDING` の行と、リース切れの `SENDING` の行を拾って送り直す（B）。

**根拠**

- **サーバーレスでも常駐でもそのまま動く。** 必要なのは「外から定期的に叩かれる HTTP エンドポイント」だけ。叩く手段は実行モデルごとに選べる。プラットフォームの cron（Vercel Cron 等）、常駐スケジューラ（Docker 環境なら `make` の補助コンテナで curl をループさせる）、外部スケジューラのどれでもよい。
- **(B) だけにしない理由。** 送信までの遅れが cron の間隔で決まってしまう。プラットフォームによっては cron の頻度が粗い（Vercel Hobby は 1 日 1 回が上限。**086 の Step 0 でデプロイ先の現行の制約を確認する**）。`after()` があるので、通常は数秒以内に送れる。cron は「取りこぼしの回収」だけを受け持てばよく、頻度が粗くても成り立つ。
- **(A) だけにしない理由。** ※1 のとおり、再試行の経路が無いと「行はあるのに届いていない」状態から回復できない。
- **(P1) を選ぶ理由。** 既存の発火点のうち admin / 支払い / 店舗承認 / webhook は**既に interactive tx の中**にある（0-6〜0-8・0-10）。行を 1〜2 件足すだけで済む。tx が無いのは seller の group 更新だけ（0-4）で、そこは §1 の条件付き更新に置き換えるときに tx で包む。

### 4.3 送信の手順（リース方式）

```text
claim:   UPDATE NotificationDelivery
         SET status='SENDING', attemptCount=attemptCount+1,
             leaseExpiresAt=now()+interval '2 minutes',
             firstAttemptAt=COALESCE(firstAttemptAt, now())
         WHERE id IN (…) AND (status='PENDING' OR (status='SENDING' AND leaseExpiresAt < now()))
         RETURNING id
send:    provider.send({ …, idempotencyKey: `${dedupeKey}:email` })
success: status='SENT', sentAt=now(), providerMessageId=…, leaseExpiresAt=NULL
failure: 再試行できるエラーなら status='PENDING'（attemptCount で backoff）
         再試行できないエラー（宛先不正など）なら status='FAILED'
```

- **「送信済み」を送信の前に書かない。** 送る前に書くのは `SENDING` とリースだけ。プロセスが落ちても、リースが切れれば別の sweeper が拾い直す。**「送っていないのに SENT になっている」状態は起きない**（不変条件）。
- `after()` と sweeper が同時に同じ行を処理しても、claim の条件付き UPDATE が 1 回しか通らないので二重には claim されない（`updatePaymentStatus` の条件付き `updateMany` と同じ考え方）。

### 4.4 決定: 配信の約束 — プロバイダの冪等キーに任せ、再試行は冪等キーの保持期間内に限る

plan 021 が示す 2 つの選択肢のうち、**1（プロバイダの冪等キーに任せる）**を採る。

- Resend は `Idempotency-Key` に対応し、同じキーの送信を **24 時間**保持する（2026-10-07 にベンダー文書で確認）。
- sweeper は `firstAttemptAt` から **23 時間**を過ぎた行を再試行しない。`FAILED`（`lastError='retry_window_exceeded'`）にする。こうすると、再送は常に冪等キーの保持期間内に収まる。**SENT 直前に落ちて再送しても、プロバイダは新しいメールを送らず前回の結果を返す**ので、受信箱には 1 通しか届かない。
- 23 時間を過ぎてもメールが届かないことはありうる。ただしこれは**黙って消えたのではなく**、`FAILED` として行に残り、in-app の `Notification` 行はそのまま残る。そこで「**記録（in-app）が権威で、email は best-effort**」を契約として併記する。メールのリンクからしか辿れない操作は作らない。
- **この約束は Resend（`idempotencyWindowMs > 0` のプロバイダ）を使う間だけ成り立つ。** 冪等キーに対応しないプロバイダ（Postmark・SES の `SendEmail`）へ替えるときは、約束を 2（「まれに同じ通知が 2 通届く」at-least-once）に書き換える。`EmailProvider.idempotencyWindowMs === 0` のときは、sweeper がリース切れの `SENDING` 行を**再送しない**（`FAILED` にする）ことで、二重送信を避ける側に倒す。
- **`dedupeKey` が防ぐのは行の二重作成だけ**であり、それ自体は二重送信を防がない。二重送信を防いでいるのは上のプロバイダ冪等キーと再試行窓の組み合わせである（取り違えないこと）。

### 4.5 障害挙動表

| 失敗 | 主処理（注文更新など） | Notification 行 | メール | 回復 |
| --- | --- | --- | --- | --- |
| **行の書き込み失敗**（制約違反以外の DB エラー） | **ロールバックして失敗する**（P1 の意図された挙動） | 残らない（主処理も残らない） | 送られない | 呼び出し側が従来どおりエラーを表示し、利用者が再操作する。「主処理は成立したのに通知の記録が無い」状態は起きない |
| 行の重複（同じ `dedupeKey`） | 成功する | 既存の 1 行のまま（`skipDuplicates`） | 追加されない | 不要 |
| プロバイダ停止（5xx / 接続不可） | 成功する（送信は tx の外） | 残る | `PENDING` に戻る | sweeper が backoff しながら再試行する。23 時間を過ぎたら `FAILED` |
| タイムアウト（プロバイダが受け付けたか分からない） | 成功する | 残る | `SENDING` のままリースが切れる | sweeper が同じ冪等キーで再送する。プロバイダが重複を抑える（§4.4） |
| 部分失敗（一括処理の一部だけ失敗） | 成功する | 残る | 行ごとに独立して状態を持つ | 失敗した行だけが再試行の対象になる |
| `after()` が動かなかった（プロセス終了など） | 成功する | 残る | `PENDING` のまま | sweeper が拾う |
| 再試行できないエラー（宛先不正・バウンス） | 成功する | 残る | `FAILED` | 再試行しない。バウンスの webhook は将来の項目（§8） |

> **送信の失敗は主処理を失敗させない**（plan 021「遵守すべきリポジトリ規約」）。送信は常に tx の外（`after()` / sweeper）で行う。
> **記録の失敗は主処理を巻き込む**（P1）。この 2 つは別の失敗モードであり、上の表でも行を分けている。

### 4.6 plan 018（RMA）Q6 との対応

| plan 018 Q6 の選択肢 | 本書での位置 | 018 で採るべきもの |
| --- | --- | --- |
| (α) commit 後に発火（best-effort） | 軸 1 の (A) | 単独では採らない |
| (β) outbox（tx 内に行を書き、別ワーカーが送る） | (B) × (P1) | **これを採る**。本書と同じく `after()` による速い経路を併用し、`dedupeKey` も §2.2 の規則で作る |

018 の「通知の送信可否が RMA の状態遷移をロールバックさせない」という不変条件は、本書の「送信は tx の外」で満たされる。一方で記録の失敗は RMA の遷移もロールバックさせる。018 の design doc はこの区別を明記すること。

---

## 5. cron エンドポイント

- `GET /api/cron/notifications`（Route Handler）。`Authorization: Bearer ${CRON_SECRET}` を定数時間で比較し、一致しなければ 401 を返す。`CRON_SECRET` が未設定なら 503 を返して何もしない（設定漏れのまま公開しないため）。
- 1 回の実行で最大 50 件を処理する（`maxDuration` の範囲に収める）。保持期間を過ぎた既読行の削除もここで行う。
- 公開エンドポイントだが、副作用は認証付きの呼び出しだけ。レート制限（ADR-009）の対象には入れない。

---

## 6. Q5 — イベントと通知のマッピング

### 6.1 決定: コード内の定数にする（DB テーブルにはしない）

```ts
// src/lib/notifications/mapping.ts（086 で新設）
export const NOTIFICATION_MAPPING = {
    "order.group.shipped":   { recipient: "customer", channels: ["in_app", "email"], category: "transactional" },
    "order.group.delivered": { recipient: "customer", channels: ["in_app", "email"], category: "transactional" },
    // ↓ 以下は行のみ定義し、配線は後続プラン
    "order.payment.refunded":  { recipient: "customer", channels: ["in_app", "email"], category: "transactional" },
    "order.payment.cancelled": { recipient: "customer", channels: ["in_app", "email"], category: "transactional" },
    "store.approved":          { recipient: "seller",   channels: ["in_app", "email"], category: "transactional" },
    // 予約（spike 016 / 018 が確定させる）
    "catalog.review.approved": { recipient: "seller",   channels: ["in_app"],          category: "transactional" },
    "catalog.review.rejected": { recipient: "seller",   channels: ["in_app", "email"], category: "transactional" },
    "rma.requested":           { recipient: "seller",   channels: ["in_app", "email"], category: "transactional" },
    "rma.approved":            { recipient: "customer", channels: ["in_app", "email"], category: "transactional" },
    "rma.rejected":            { recipient: "customer", channels: ["in_app", "email"], category: "transactional" },
    "rma.refunded":            { recipient: "customer", channels: ["in_app", "email"], category: "transactional" },
} as const satisfies Record<string, NotificationRule>;

export type NotificationType = keyof typeof NOTIFICATION_MAPPING;
```

**根拠**

- **型で守れる。** `NotificationType` が union になるので、存在しない種別を発火しようとするとコンパイルエラーになる。テンプレートの欠落も `Record<NotificationType, Template>` で検出できる。
- **レビューできる。** 「どのイベントで誰に何を送るか」の変更が PR の差分として残る。DB テーブルにすると、無停止で変更できる代わりに、変更の経緯がコードレビューの外に出てしまう。
- **ポリシーを差し替える原則との整合。** ブランドが未定のうちは文面と送信の有無が変わりうる。ただし変更の頻度はデプロイの頻度で十分に追いつく。無停止で変更する要件が出たら、この定数を DB の初期値（seed）に昇格させる。その移行は「定数の型 = テーブルの行の型」なので素直にできる。
- 016 / 018 は、この表に**行を足すだけ**で通知を定義できる（plan 021 の狙い）。

### 6.2 文面（テンプレート）

- `templates.ts` に `Record<NotificationType, { title(params): string; body(params): string; emailSubject(params): string }>` として置く。最初はプレーンテキストのメール（HTML テンプレートや React Email は後で検討する）。
- 文言は日本語と英語のどちらにするか、i18n の方針（`docs/design/i18n-localization/`）に従う。初期は英語の UI 文言に合わせる。

---

## 7. Q6 — ユーザーの通知設定（opt-out）

### 7.1 決定: 初期スコープでは opt-out の UI を作らない。ただしカテゴリの線は最初から引く

- 初期の種別は**すべて `category: "transactional"`**（注文・支払い・審査・返品）。利用者が行った取引に対する連絡なので、送信の停止を求める法令上の義務は販促メールより弱い。サービス運営に必要な連絡として送る。
- **販促（`category: "marketing"`）は本基盤では送らない。** 既存のニュースレターの登録（`newsletter.tsx`）とも混ぜない。販促メールを送るときは、同意の取得・配信停止リンク・特定電子メール法 / CAN-SPAM への対応が必要になる。そのため別のプランで、`NotificationPreference`（`userId × category × channel`）を追加してから始める。
- 将来 opt-out を足すとき、判定を差し込む場所は `recordNotifications` の中だけでよい。delivery 行を作らずに `SKIPPED` にする。in-app の記録は opt-out の対象にしない（取引の記録だから）。

### 7.2 ログと PII

- `console.error` の構造化ログ（`"[Notifications:dispatch] …", { error, stack }`）には、delivery の ID とエラー種別だけを出す。**宛先・本文・params は出さない**（`.claude/rules/01-engineering-standards.md`「never log secrets or PII」）。
- `params` には注文番号・店舗名など、画面に出す値だけを入れる。住所・電話番号・決済情報は入れない。

---

## 8. 範囲外と将来の項目

- push 通知（Web Push / モバイル）と SMS: `NotificationDelivery.channel` を増やせば足せる。初期は in-app と email の 2 つに絞る。
- バウンスと苦情の webhook: Resend の webhook を受けて `FAILED` にし、繰り返しバウンスする宛先の送信を止める。Svix の検証パターン（0-10）を使う（Resend の webhook が Svix 形式の署名かどうかは、導入時にベンダー文書で確認する）。
- チャットの新着メール: §1 で除外した。メールが要るようになったら、`buildNotificationWrites` を `sendMessage` の配列 tx に足す。
- 通知一覧ページの無限スクロールやリアルタイム更新（SSE / ポーリング）: 初期はページを開いたときに読み込むだけ。

## 8.5 実装で確定した差分（plan 086・2026-10-07）

- §1 の「seller の group 更新を条件付き `updateMany` にする」は採らなかった。同じ `update` を `$transaction` に入れ、遷移の判定は tx の外で読んだ更新前の状態で行う。並行する更新で両方が遷移と判定しても、§2.2 の一意制約で行は 1 つになる。
- §3.1 の `buildNotificationWrites`（配列形式の tx 向け）は実装しない。配列形式では、重複でスキップされた通知の ID を配信行へ渡せず、FK 違反で主処理ごと失敗するため。必要になったら呼び出し元を interactive tx に移す。

## 9. 後続

- 実装プラン: [plans/086-implement-notification-foundation.md](../../../plans/086-implement-notification-foundation.md)
- 「新しい状態遷移を足すときはマッピング表の更新を検討する」という一文を、086 の完了時に `tech.md` へ追記するよう提案する（plan 021 Maintenance notes）。
