# 顧客メッセージ機能 — 詳細設計書 (design.md)

## 1. データベーススキーマ (Prisma Schema)

チャット機能をサポートするため、`MessageThread` と `Message` モデルを新設します。

```prisma
model MessageThread {
  id         String    @id @default(uuid())
  customerId String
  storeId    String
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  customer   User      @relation(fields: [customerId], references: [id], onDelete: Cascade)
  store      Store     @relation(fields: [storeId], references: [id], onDelete: Cascade)
  messages   Message[]

  @@unique([customerId, storeId])
  @@index([customerId])
  @@index([storeId])
}

model Message {
  id         String        @id @default(uuid())
  threadId   String
  senderId   String
  content    String
  isRead     Boolean       @default(false)
  createdAt  DateTime      @default(now())

  thread     MessageThread @relation(fields: [threadId], references: [id], onDelete: Cascade)
  sender     User          @relation(fields: [senderId], references: [id], onDelete: Cascade)

  @@index([threadId])
  @@index([senderId])
}
```

---

## 2. API & Server Actions

### F1: `getThreads()`
- 現在ログインしているユーザー（`userId`）が顧客または販売者であるスレッドの一覧を全件取得。
- SQLレベルで最新のメッセージ (`messages`) と関連店舗名/ユーザー名情報をJOINして返す。

### F2: `getMessages(threadId: string)`
- `threadId` を指定して、該当スレッドに紐づく全メッセージを取得。
- **認可ガード**: スレッドの `customerId` または `store.userId` がリクエストユーザーのIDと一致していることを厳密に検証する。

### F3: `sendMessage(threadId: string, content: string)`
- メッセージを送信。
- 新規メッセージレコードを作成し、親スレッドの `updatedAt` を更新する。

---

## 3. コンポーネント構成

`/profile/messages` では、以下のコンポーネント構造を持ちます。

```
ProfileMessagesPage (app/profile/messages/page.tsx)
 ├── ThreadList (左側: スレッド一覧。ストア名、最新メッセージの抜粋、未読表示)
 └── ChatWindow (右側: 選択中のスレッド)
      ├── ChatHeader (ストア名、ステータス)
      ├── MessageHistory (メッセージ履歴、自動スクロール)
      └── MessageInput (テキストエリア、送信ボタン)
```
