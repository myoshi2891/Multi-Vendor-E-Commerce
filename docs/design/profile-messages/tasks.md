# 顧客メッセージ機能 — 実装タスクカード (tasks.md)

## タスクリスト

### Phase 1: データベースマイグレーション
- [ ] `prisma/schema.prisma` に `MessageThread` と `Message` モデルを追加
- [ ] `bunx prisma migrate dev` の実行と Prisma クライアントの再生成
- [ ] シードスクリプト (`prisma/seed.ts`) にテスト用メッセージスレッドデータの追加

### Phase 2: データアクセスと Server Actions
- [ ] 認可ガード付きの `getThreads`, `getMessages`, `sendMessage` クエリ関数の作成
- [ ] クエリ関数のユニットテストの記述 (`src/queries/messages.test.ts`)
  - 認証済みユーザーが自分のスレッド情報のみを取得できるテスト
  - 他人のスレッド情報へアクセスした際にエラーとなるテスト (IDOR ガード検証)

### Phase 3: チャット画面 UI の構築
- [ ] `/profile/messages` ルートのプレビュー用ページ作成
- [ ] `ThreadList` コンポーネントおよび `ChatWindow` コンポーネントの構築
- [ ] メッセージ履歴の末尾への自動スクロール機能の実装
- [ ] 送信アクション呼び出しとUI上の即時反映

### Phase 4: ポーリングとリアルタイム化
- [ ] クライアントサイドでの定期的なポーリング機能 (5秒間隔) の実装
- [ ] 新着メッセージ受信時の未読フラグ管理およびバッジの追加

---

## コミット指針
- `feat: add MessageThread and Message models to schema`
- `feat: implement query actions for message thread operations with security checks`
- `feat: build chat UI components for thread list and chat history`
- `feat: add messaging update polling and unread indicator support`
