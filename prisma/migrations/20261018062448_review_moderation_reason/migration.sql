-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "moderatedAt" TIMESTAMP(3),
ADD COLUMN     "moderationReason" VARCHAR(500);
