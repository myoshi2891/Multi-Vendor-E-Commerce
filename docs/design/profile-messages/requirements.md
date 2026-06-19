# Profile Messages — 要件（requirements.md）

> 記法: EARS 風。受け入れ基準は `AC-M<n>`。
> 設計は [design.md](./design.md)、実装手順は [tasks.md](./tasks.md)。

---

## 1. 機能要件

| ID | 要件（EARS 風） |
|----|-----------------|
| **M-1** | 認証済み購入者が `/profile/messages` にアクセスしたとき、システムは自分が参加する会話の一覧（最新メッセージ・相手店舗名付き）を表示しなければならない。 |
| **M-2** | 購入者が会話を選択したとき、システムは当該会話のメッセージを時系列で表示しなければならない。 |
| **M-3** | 購入者が本文を入力して送信したとき、システムは `Message` を作成し、会話の `updatedAt` を更新しなければならない。 |
| **M-4** | 購入者が店舗（任意で注文起点）に対して新規会話を開始したとき、システムは購入者×店舗で**一意**の会話を取得または作成しなければならない（冪等）。 |
| **M-5** | 販売者（店舗オーナー）が seller dashboard のメッセージ画面にアクセスしたとき、システムは自店舗宛の会話一覧を表示し、返信できなければならない。 |
| **M-6** | 会話を表示したとき、システムは相手が送った未読メッセージを既読化しなければならない（冪等）。 |
| **M-7** | While 会話画面を開いている間、システムは一定間隔（5秒）で新着メッセージをポーリング取得し表示を更新しなければならない。 |

---

## 2. 受け入れ基準（AC）— セキュリティ（IDOR）を最重要とする

| ID | 受け入れ基準 | 検証方法 |
|----|-------------|----------|
| **AC-M1** | `getUserConversations` は `requireUser` を要し、未認証なら `"Unauthenticated."` を throw する。 | ユニット |
| **AC-M2** | `getStoreConversations` は `requireStoreOwner(storeUrl)` を要し、非所有店舗には `"Forbidden: store not owned by current user."` を throw する。 | ユニット |
| **AC-M3**（**IDOR 核心**） | `getConversationMessages` / `sendMessage` / `markConversationRead` は、現在ユーザーが会話の**参加者**（`conversation.userId` または `conversation.store.userId`）でない場合 throw し、**DB 副作用を残さない**。 | ユニット（3階層: (a)スロー (b)where/引数構造 (c)副作用なし） |
| **AC-M4** | `sendMessage` は `content` を Zod（1〜2000 文字）で検証し、空文字/超過を弾く。 | ユニット |
| **AC-M5** | `getOrCreateConversation` は同一 (userId, storeId) で2回呼んでも会話が1件のまま（冪等・`@@unique`）。 | ユニット |
| **AC-M6** | `sendMessage` は `Message` 作成と `conversation.updatedAt` 更新を**同一トランザクション**で行う。 | ユニット（`$transaction` モック検証） |
| **AC-M7** | `markConversationRead` は**相手発**の未読のみ既読化し（自分発は対象外）、再実行しても結果が変わらない（冪等 `updateMany`）。 | ユニット |
| **AC-M8** | `/profile/messages` で送信したメッセージが、販売者画面で受信・返信され、購入者側ポーリングで受信できる（往復）。 | E2E |

---

## 3. 非機能要件（NFR）

| ID | 内容 |
|----|------|
| **NFR-M1**（セキュリティ） | 全 server action は認可必須。会話アクセスは参加者チェックを通す（IDOR 防止）。外部入力は Zod 検証。 |
| **NFR-M2**（アトミック性） | 複数テーブル更新（Message 作成 + Conversation 更新）は `db.$transaction`（tech.md「アトミック操作」必須）。 |
| **NFR-M3**（コード規約） | `any` 禁止。`console.error` は `[Message:Fn]` 構造化2引数形式。外部呼び出しは try/catch + `instanceof Error`。認可ガードは try/catch の**外**。 |
| **NFR-M4**（動的レンダリング） | DB 依存ページ（`messages/page.tsx` 等）は `export const dynamic='force-dynamic';` を宣言（tech.md 規約）。 |
| **NFR-M5**（パフォーマンス） | ポーリングは 5s 間隔・`document.hidden` 時停止・`cancelled` フラグでレース防止。 |
| **NFR-M6**（schema 整合） | schema 変更時は `bun run erd:generate` で ERD を同一コミット再生成（rule 03）。 |
| **NFR-M7**（TDD） | [`.claude/rules/02-tdd-step-commit.md`](../../../.claude/rules/02-tdd-step-commit.md) 遵守。 |

---

## 4. スコープ外（後続フェーズ）

- 運営サポート（ADMIN）との対話チャネル（`ConversationType` enum 追加で拡張可・[design §判断5](./design.md)）。
- リアルタイム配信（WebSocket/Pusher 等の外部依存追加）。
- 添付ファイル・画像・タイピングインジケータ・プッシュ通知。
- 商品ページ/注文画面からの「問い合わせ」起点ボタン（本設計は server action `getOrCreateConversation` を用意するに留め、起点 UI は別 PR）。
