-- plan 064 / TESTS-21: 「1 ユーザーにつき default: true の住所は最大 1 件」を DB 層で強制する。
--
-- アプリ層（src/queries/user.ts の upsertShippingAddress）は他住所の default 解除と
-- 対象住所の作成/更新を 1 トランザクションで行うが、それはこの関数を通る書き込みしか
-- 守らない。将来別の経路（シーダー・管理画面・手動 SQL）が default を立てたときに
-- 不変条件を破らせないため、部分 unique index を最終防衛線として張る。
--
-- Prisma のスキーマ構文は部分 unique index（WHERE 句付き）を表現できないため、
-- `prisma migrate dev --create-only` で空のマイグレーションを作って手書きしている。
-- schema.prisma には現れないので、以後 `prisma migrate dev` がこの index の DROP を
-- 提案しないことを確認すること（plan 064 の Done criteria）。
--
-- 適用前提: `default = true` を 2 件以上持つユーザーが 0 件であること（plan 064 Step 0 で実測）。
CREATE UNIQUE INDEX "ShippingAddress_userId_single_default_key"
    ON "ShippingAddress" ("userId")
    WHERE "default";
