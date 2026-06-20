-- DropIndex
-- Message_conversationId_idx は Message_conversationId_createdAt_idx の前方一致でカバーされるため冗長。
-- 挿入時の書き込みオーバーヘッド削減のため削除する。
DROP INDEX "Message_conversationId_idx";
