-- AlterTable
ALTER TABLE "_CouponToUser" ADD CONSTRAINT "_CouponToUser_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_CouponToUser_AB_unique";

-- AlterTable
ALTER TABLE "_UserFollowingStore" ADD CONSTRAINT "_UserFollowingStore_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_UserFollowingStore_AB_unique";

