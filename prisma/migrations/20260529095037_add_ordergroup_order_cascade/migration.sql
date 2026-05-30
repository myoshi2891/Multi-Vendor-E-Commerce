-- DropForeignKey
ALTER TABLE "OrderGroup" DROP CONSTRAINT "OrderGroup_orderId_fkey";

-- AddForeignKey
ALTER TABLE "OrderGroup" ADD CONSTRAINT "OrderGroup_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
