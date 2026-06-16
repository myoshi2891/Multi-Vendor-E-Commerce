-- CreateEnum
CREATE TYPE "CouponScope" AS ENUM ('STORE', 'PLATFORM');

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "scope" "CouponScope" NOT NULL DEFAULT 'STORE',
ALTER COLUMN "storeId" DROP NOT NULL;
