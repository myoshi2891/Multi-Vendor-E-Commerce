# Profile Messages — 設計（design.md）

> 中核設計。実装者（Sonnet）が**該当行を特定して差分実装できる**粒度で記述する。
> 要件 ID は [requirements.md](./requirements.md)、手順は [tasks.md](./tasks.md)。

---

## 0. 設計の前提（実コードで確認済みの事実）

| # | 事実 | 出典 |
|---|------|------|
| 0-1 | メッセージング用モデル（Conversation/Message/Chat）は**存在しない**。新規追加が必要 | `prisma/schema.prisma` 全走査 |
| 0-2 | 認可ヘルパーは `requireUser(): Promise<User>` / `requireStoreOwner(storeUrl): Promise<{user, store}>`。会話参加者の検証はどちらでも表現できない → カスタムが必要 | [`src/lib/auth-guards.ts`](../../../src/lib/auth-guards.ts) |
| 0-3 | server action の典型: 認可は try の外 → Zod `safeParse` → `db.$transaction`/`updateMany`（IDOR 防止 where 句）→ `catch` で `[Module:Fn]` 構造化ログ → 汎用メッセージ throw | [`src/queries/inventory.ts`](../../../src/queries/inventory.ts)（`updateSizeStock`） |
| 0-4 | ユニットテストは AAA + `src/config/`（test-config / test-fixtures / test-helpers）。`AssertionHelpers.expectAuthError` 等が認可エラー文字列と整合 | [`src/queries/store.test.ts`](../../../src/queries/store.test.ts) |
| 0-5 | `/profile/messages` リンクは [user-menu.tsx:146-150](../../../src/components/store/layout/header/user-menu/user-menu.tsx#L146-L150) に**既存**（ページのみ未実装）。sidebar には未追加（[sidebar.tsx:63-96](../../../src/components/store/layout/profile-sidebar/sidebar.tsx#L63-L96)） |
| 0-6 | ページ雛形は `force-dynamic` + async server component + container（[`profile/reviews/page.tsx`](../../../src/app/(store)/profile/reviews/page.tsx)）。useEffect の `cancelled` フラグ非同期パターンは [tech.md](../../../.claude/steering/tech.md)・[`profile/history/[page]/page.tsx`](../../../src/app/(store)/profile/history/) |
| 0-7 | 型は `Prisma.PromiseReturnType<typeof fn>` で導出（admin の `AdminOrderType` と同型） | [`src/lib/types.ts`](../../../src/lib/types.ts) |

---

## 1. 共通設計

### 1.1 ディレクトリ構成（新規/変更）

```
prisma/schema.prisma                                    ← 変更（Conversation/Message + 逆リレーション）
prisma/migrations/<timestamp>_add_conversation_message/ ← 新規（safe-migration が生成）
docs/architecture/data-model.drawio                     ← 再生成（erd:generate）

src/queries/message.ts                                  ← 新規（6 server actions + private 参加者helper）
src/queries/message.test.ts                             ← 新規（ユニット・IDOR 3階層）
src/lib/schemas.ts                                      ← 変更（SendMessageSchema / StartConversationSchema 追加）
src/lib/types.ts                                        ← 変更（ConversationWithLatest / MessageType）

src/app/(store)/profile/messages/page.tsx               ← 新規（顧客側・force-dynamic）
src/components/store/profile/messages/
  ├─ messages-container.tsx                              ← 新規（'use client'・2ペイン・ポーリング）
  └─ conversation-thread.tsx                             ← 新規（バブル + composer）

src/app/dashboard/seller/stores/[storeUrl]/messages/page.tsx ← 新規（販売者側・force-dynamic）
src/components/dashboard/seller/messages/
  └─ seller-messages-container.tsx                       ← 新規（thread 流用）

src/components/store/layout/profile-sidebar/sidebar.tsx ← 変更（Messages エントリ追加）
```

### 1.2 再利用元マトリクス

| 流用するもの | 出典 | 用途 |
|-------------|------|------|
| server action 雛形（認可外置き・Zod・$transaction・構造化ログ） | `inventory.ts` `updateSizeStock` | `message.ts` 各関数 |
| 認可ヘルパー | `auth-guards.ts` | `requireUser`（購入者）/ `requireStoreOwner`（販売者） |
| テスト雛形（AAA・モック・フィクスチャ） | `store.test.ts` + `src/config/*` | `message.test.ts` |
| ページ雛形（force-dynamic + container） | `profile/reviews/page.tsx` | `messages/page.tsx` |
| 非同期 cancelled パターン | tech.md / `profile/history/[page]/page.tsx` | ポーリング |
| RHF + zodResolver + shadcn Form | `shipping-addresses/address-details.tsx` | composer |
| リエントランシーガード（useRef） | tech.md / `newsletter.tsx` | 送信多重実行防止 |

### 1.3 認可方針（IDOR の核心）

- **購入者一覧**: `requireUser()` → `where: { userId: user.id }`。
- **販売者一覧**: `requireStoreOwner(storeUrl)` → `where: { storeId: store.id }`。
- **会話単位（取得/送信/既読）**: `requireUser()` で本人取得後、**private 参加者ヘルパー** `assertParticipant(conversationId, userId)` で
  `conversation.userId === userId || conversation.store.userId === userId` を検証。不一致は `"Forbidden: not a participant of this conversation."` を throw。
  → これが **AC-M3 の IDOR 3階層テスト**対象（(a)スロー (b)`where`/引数構造 (c)副作用なし）。

---

## 2. データモデル（schema 変更・safe-migration）

> **非破壊 additive**（新規テーブル + 逆リレーションのみ・既存カラム変更なし）。それでも `safe-migration` skill で承認 → `migrate dev` → `erd:generate`（rule 03）。

```prisma
/// 購入者(User)と店舗(Store)間の1スレッド。任意で注文(Order)起点。
model Conversation {
  id        String   @id @default(uuid())
  userId    String                 // 購入者
  user      User     @relation("UserConversations", fields: [userId], references: [id], onDelete: Cascade)
  storeId   String                 // 販売店舗
  store     Store    @relation("StoreConversations", fields: [storeId], references: [id], onDelete: Cascade)
  orderId   String?                // 任意: 注文起点
  order     Order?   @relation("OrderConversations", fields: [orderId], references: [id], onDelete: SetNull)
  messages  Message[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, storeId])      // 購入者×店舗で1スレッド = getOrCreate の冪等キー
  @@index([userId])
  @@index([storeId])
  @@index([updatedAt])             // 一覧の updatedAt desc ソート用
}

/// 会話内の1メッセージ。senderId が conversation.userId と一致すれば購入者発、else 販売者発。
model Message {
  id             String       @id @default(uuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  senderId       String                 // User.id（購入者 or 店舗オーナー）
  sender         User         @relation("UserMessages", fields: [senderId], references: [id], onDelete: Cascade)
  content        String       @db.Text
  isRead         Boolean      @default(false)
  readAt         DateTime?
  createdAt      DateTime     @default(now())

  @@index([conversationId])
  @@index([senderId])
}
```

**既存モデルへの逆リレーション追加**（フィールドのみ・本体定義は上記）:

```prisma
// model User { ... に追加 }
conversations Conversation[] @relation("UserConversations")
messages      Message[]      @relation("UserMessages")

// model Store { ... に追加 }
conversations Conversation[] @relation("StoreConversations")

// model Order { ... に追加 }
conversations Conversation[] @relation("OrderConversations")
```

> **判断**: `senderRole` カラムは持たない（[判断2](#判断2-senderrole-を持たない理由)）。`@@unique([userId, storeId])` により注文ごとのスレッド分離はしない（[判断3](#判断3-会話の一意キーを-userid-storeid-とする理由)）。

---

## 3. Server Actions（`src/queries/message.ts` 新規）

> 全関数 `"use server"`。認可は try の外。Zod `safeParse`。DB は try/catch + `[Message:Fn]` 構造化ログ。金額無しのため Decimal 不使用。

### 3.0 private 参加者ヘルパー（エクスポートしない）

```typescript
/**
 * 会話の参加者（購入者本人 or 店舗オーナー）であることを検証する。
 * IDOR 防止の中核。会話と店舗オーナーを1クエリで取得し、不一致なら throw。
 * @returns 検証済みの conversation（store.userId 含む）
 * @throws "Conversation not found." 会話が存在しない
 * @throws "Forbidden: not a participant of this conversation." 参加者でない
 */
async function assertParticipant(conversationId: string, userId: string) {
    const conversation = await db.conversation.findUnique({
        where: { id: conversationId },
        include: { store: { select: { userId: true } } },
    });
    if (!conversation) throw new Error("Conversation not found.");
    const isBuyer = conversation.userId === userId;
    const isSeller = conversation.store.userId === userId;
    if (!isBuyer && !isSeller) {
        throw new Error("Forbidden: not a participant of this conversation.");
    }
    return conversation;
}
```

### 3.1 関数一覧

| 関数 | 認可 | 入力 | 振る舞い |
|------|------|------|----------|
| `getOrCreateConversation(storeId, orderId?)` | `requireUser` | `StartConversationSchema` | `db.conversation.upsert({ where: { userId_storeId: { userId, storeId } }, ... })`（`@@unique` 複合キー）。冪等（AC-M5） |
| `getUserConversations()` | `requireUser` | — | `where: { userId: user.id }`・`include` 最新 message + store(name/logo)・`orderBy: { updatedAt: "desc" }` |
| `getStoreConversations(storeUrl)` | `requireStoreOwner` | `storeUrl` | `where: { storeId: store.id }`・同上 include |
| `getConversationMessages(conversationId)` | **`assertParticipant`** | `conversationId` | 参加者検証後 `db.message.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } })`（AC-M3） |
| `sendMessage(conversationId, content)` | **`assertParticipant`** | `SendMessageSchema` | 参加者検証 → `db.$transaction([ message.create, conversation.update({ updatedAt }) ])`（AC-M4/M6） |
| `markConversationRead(conversationId)` | **`assertParticipant`** | `conversationId` | `db.message.updateMany({ where: { conversationId, senderId: { not: user.id }, isRead: false }, data: { isRead: true, readAt: new Date() } })`（**相手発のみ**・冪等・AC-M7） |

### 3.2 実装テンプレート（`sendMessage` 例 — 他関数も同型）

```typescript
"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-guards";
import { SendMessageSchema } from "@/lib/schemas";

export const sendMessage = async (
    conversationId: string,
    content: string
): Promise<{ id: string }> => {
    // 1. 認可（try の外 — 認可エラーを汎用エラーで上書きしない）
    const user = await requireUser();

    // 2. 入力バリデーション
    const parsed = SendMessageSchema.safeParse({ conversationId, content });
    if (!parsed.success) {
        throw new Error("メッセージの内容が不正です。");
    }

    // 3. 参加者検証（IDOR 防止・try の外: Forbidden を汎用エラーで隠さない）
    await assertParticipant(conversationId, user.id);

    try {
        // 4. アトミック更新（Message 作成 + Conversation.updatedAt）
        const [message] = await db.$transaction([
            db.message.create({
                data: {
                    conversationId,
                    senderId: user.id,
                    content: parsed.data.content,
                },
                select: { id: true },
            }),
            db.conversation.update({
                where: { id: conversationId },
                data: { updatedAt: new Date() },
            }),
        ]);
        return { id: message.id };
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("[Message:sendMessage] Failed to send message", {
                error: error.message,
                stack: error.stack,
            });
        } else {
            console.error("[Message:sendMessage] Unknown error", { error });
        }
        throw new Error("メッセージの送信に失敗しました。");
    }
};
```

> **`assertParticipant` を try の外に置く理由**: tech.md「認可ガードは try/catch の外に置く」と同じ意図。`"Forbidden: ..."` を汎用 DB エラーで上書きしないため。ただし `assertParticipant` 内部の `db.conversation.findUnique` 自体は読み取り専用で、失敗時は Prisma エラーがそのまま伝播する（テストでは存在/参加者の分岐を検証）。

### 3.3 Zod スキーマ（`src/lib/schemas.ts` 追加）

```typescript
export const SendMessageSchema = z.object({
    conversationId: z.string().min(1),
    content: z.string().min(1, "メッセージを入力してください。").max(2000, "メッセージは2000文字以内です。"),
});

export const StartConversationSchema = z.object({
    storeId: z.string().min(1),
    orderId: z.string().min(1).optional(),
});
```

### 3.4 型（`src/lib/types.ts` 追加）

```typescript
import { Prisma } from "@prisma/client";
import { getUserConversations, getConversationMessages } from "@/queries/message";

export type ConversationWithLatest =
    Prisma.PromiseReturnType<typeof getUserConversations>[number];
export type MessageType =
    Prisma.PromiseReturnType<typeof getConversationMessages>[number];
```

---

## 4. UI 設計

### 4.1 顧客ページ `src/app/(store)/profile/messages/page.tsx`

```tsx
import MessagesContainer from "@/components/store/profile/messages/messages-container";
import { getUserConversations } from "@/queries/message";

export const dynamic = "force-dynamic";   // NFR-M4

export default async function ProfileMessagesPage() {
    const conversations = await getUserConversations();
    return (
        <div className="bg-white px-6 py-4">
            <h1 className="mb-3 text-lg font-bold">Messages</h1>
            <MessagesContainer initialConversations={conversations} />
        </div>
    );
}
```

### 4.2 `messages-container.tsx`（`'use client'`・2ペイン・ポーリング）

- 左ペイン: 会話一覧（`initialConversations` を state 初期値に）。選択中 `conversationId` を state 管理。
- 右ペイン: `<ConversationThread conversationId={selected} />`。
- **ポーリング**（NFR-M5・tech.md cancelled パターン）:

```typescript
useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;

    const poll = async () => {
        if (document.hidden) return;          // バックグラウンド時は停止
        try {
            const msgs = await getConversationMessages(selectedId);
            if (!cancelled) setMessages(msgs);
        } catch (error: unknown) {
            if (error instanceof Error) {
                console.error("[Messages:poll]", error.message, error.stack);
            }
        }
    };

    poll();                                   // 初回即時
    const id = setInterval(poll, 5000);       // 5s 間隔
    return () => { cancelled = true; clearInterval(id); };
}, [selectedId]);
```

> `getConversationMessages` / `sendMessage` は server action のため client から直接 import 可（`"use server"`）。UI コンポーネントから `src/queries` を呼ぶのは**サーバーアクション呼び出し**であり、structure.md の「UI から queries を直接 import 禁止」は**データ取得関数の同期 import** を指す。本パターンは Server Action 呼び出しなので許容（既存 `address-details.tsx` 等と同様）。実装時に既存の呼び出し慣行に合わせる。

### 4.3 `conversation-thread.tsx`（バブル + composer）

- メッセージを `senderId === conversation.userId` で左右振り分け表示。
- composer: RHF + `zodResolver(SendMessageSchema)`。送信は **useRef リエントランシーガード**（tech.md）。送信成功後に `markConversationRead` + 楽観的追加 or 再フェッチ。

### 4.4 販売者側 `dashboard/seller/stores/[storeUrl]/messages/page.tsx`

- `getStoreConversations(storeUrl)` → `SellerMessagesContainer`（`conversation-thread.tsx` を流用）。`force-dynamic`。
- 返信は同じ `sendMessage`（`assertParticipant` が店舗オーナーを許可）。

### 4.5 導線

- `sidebar.tsx` の `menu`（[63-96](../../../src/components/store/layout/profile-sidebar/sidebar.tsx#L63-L96)）に `{ title: "Messages", link: "/profile/messages" }` 追加。
- user-menu の `/profile/messages` リンクは既存（変更不要・事実 0-5）。

---

## 判断1. 新規モデルを作る理由（既存への相乗り却下）

- 既存 User/Store/Order にメッセージ配列を持たせると、参加者スコープの表現・既読管理・スレッド一意性が破綻し IDOR リスクが高い。
- `Conversation`/`Message` を分離することで `@@unique([userId, storeId])` による冪等起票、`onDelete: Cascade` による整合、インデックス最適化が可能。

## 判断2. `senderRole` を持たない理由

- 参加者は購入者（`conversation.userId`）か店舗オーナー（`conversation.store.userId`）の2者のみ。`senderId === conversation.userId` で一意に判定でき、冗長カラムは不整合の温床になる。表示の左右振り分けも同式で導出。

## 判断3. 会話の一意キーを `(userId, storeId)` とする理由

- **採用**: 購入者×店舗で1スレッド（`orderId` は任意メタ情報）。
  - メリット: 起票が冪等、一覧がシンプル、未読集計が容易。
  - デメリット: 注文ごとの文脈分離ができない。
- **代替（却下）**: `(userId, storeId, orderId)` で注文ごとスレッド。
  - デメリット: 注文外問い合わせの扱いが複雑化、一覧が冗長。MVP には過剰。
- **結論**: MVP は `(userId, storeId)`。注文文脈は将来 `orderId` 表示やフィルタで補完可能。

## 判断4. ポーリングを採用する理由（リアルタイム却下）

- **採用**: 5s ポーリング。外部依存ゼロ、CI 安定（tech.md「プロンプトキャッシュ安定」「決定論的出力」の優先順位とも整合）、`cancelled` パターン既存。
- **代替（却下）**: WebSocket/Pusher。UX は最良だが外部サービス依存追加（tech.md 外部サービス表に新規行）・環境変数・接続管理・CI 設定が必要でスコープ過大。
- **結論**: MVP はポーリング。将来リアルタイム化は server action を温存したまま差し替え可能。

## 判断5. 販売者返信をどこに置くか

- 顧客メニュー（`/profile/messages`）だけでは会話が一方向で E2E 検証不能。seller dashboard に最小ページを設け、**同一 server actions を共有**して双方向を成立させる。運営サポート窓口（ADMIN）は `ConversationType` enum 追加で将来拡張（スコープ外）。

---

## 影響箇所マトリクス

| パス | 変更種別 | 理由 | リスク |
|------|---------|------|--------|
| `prisma/schema.prisma` | 変更 | Conversation/Message + 逆リレーション | 中（migration・**safe-migration 必須**） |
| `prisma/migrations/<ts>_add_conversation_message/` | 新規 | migrate dev 生成物 | 中（非破壊だが本番は migrate deploy） |
| `docs/architecture/data-model.drawio` | 再生成 | rule 03（同一コミット） | 低 |
| `src/queries/message.ts` / `.test.ts` | 新規 | server actions + IDOR テスト | 中（認可の正しさが核心） |
| `src/lib/schemas.ts` | 変更 | Send/Start スキーマ追加 | 低 |
| `src/lib/types.ts` | 変更 | Conversation/Message 型 | 低 |
| `src/app/(store)/profile/messages/page.tsx` (+2 components) | 新規 | 顧客 UI | 低〜中（ポーリング） |
| `src/app/dashboard/seller/.../messages/page.tsx` (+container) | 新規 | 販売者 UI | 低 |
| `src/components/store/layout/profile-sidebar/sidebar.tsx` | 変更 | Messages エントリ | 低 |

---

## リスク分析

| リスク | 区分 | 緩和策 |
|--------|------|--------|
| 会話への不正アクセス（IDOR） | セキュリティ | `assertParticipant` を取得/送信/既読の全関数で必須。3階層テスト（AC-M3） |
| ポーリング負荷 | パフォーマンス | 5s 間隔・`document.hidden` 停止・選択会話のみ取得 |
| migration 本番適用 | データ | 本番は `migrate deploy`（`db push` 禁止・tech.md）。非破壊 additive で後方互換 |
| `$transaction` 漏れ | 整合性 | Message 作成 + Conversation 更新を必ず `$transaction`（AC-M6 でモック検証） |
| 既読の自分発混入 | ロジック | `senderId: { not: user.id }` で相手発のみ（AC-M7） |

---

## Verification（実装後の検証手順）

1. `safe-migration` 適用後 `bunx prisma generate` → `bun run erd:generate`。
2. `bun run test`（`message.test.ts`: 認可・IDOR 3階層・冪等・$transaction）/ `bun run lint` / `bunx tsc --noEmit` / `bun run build`。
3. `bun run dev`: 購入者で `/profile/messages` から店舗へ送信 → 販売者 dashboard で受信・返信 → 購入者側 5s ポーリングで受信を確認。
4. `bunx playwright test` で往復フロー E2E（AC-M8）。Chromium/Firefox/WebKit。
