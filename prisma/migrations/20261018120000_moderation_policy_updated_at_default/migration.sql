-- raw SQL の INSERT（@updatedAt は Prisma Client 側でしか埋まらない）でも値が入るよう DB 既定値を付ける。
-- AlterTable
ALTER TABLE "ModerationPolicy" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
