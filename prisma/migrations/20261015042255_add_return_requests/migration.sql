-- CreateEnum
CREATE TYPE "ReturnRequestStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'RECEIVED', 'RESOLVED', 'CANCELED');

-- CreateEnum
CREATE TYPE "ReturnResolution" AS ENUM ('REFUND', 'EXCHANGE');

-- CreateEnum
CREATE TYPE "ReturnReasonCode" AS ENUM ('DAMAGED', 'DEFECTIVE', 'WRONG_ITEM', 'NOT_AS_DESCRIBED', 'SIZE_FIT', 'CHANGED_MIND', 'OTHER');

-- CreateEnum
CREATE TYPE "ReturnItemCondition" AS ENUM ('RESELLABLE', 'DAMAGED');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "acceptsReturns" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "returnWindowDays" INTEGER;

-- CreateTable
CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL,
    "orderGroupId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ReturnRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "resolution" "ReturnResolution" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "customerNote" TEXT,
    "sellerNote" TEXT,
    "returnTrackingNumber" TEXT,
    "refundAmount" DECIMAL(12,2),
    "supportTicketId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnRequestItem" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reasonCode" "ReturnReasonCode" NOT NULL,
    "condition" "ReturnItemCondition",
    "restockedQuantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReturnRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReturnRequest_storeId_status_idx" ON "ReturnRequest"("storeId", "status");

-- CreateIndex
CREATE INDEX "ReturnRequest_orderGroupId_idx" ON "ReturnRequest"("orderGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRequest_userId_idempotencyKey_key" ON "ReturnRequest"("userId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ReturnRequestItem_orderItemId_idx" ON "ReturnRequestItem"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRequestItem_returnRequestId_orderItemId_key" ON "ReturnRequestItem"("returnRequestId", "orderItemId");

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderGroupId_fkey" FOREIGN KEY ("orderGroupId") REFERENCES "OrderGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequestItem" ADD CONSTRAINT "ReturnRequestItem_returnRequestId_fkey" FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequestItem" ADD CONSTRAINT "ReturnRequestItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- R-1 の入口の多層防御（design §2.2）。Prisma スキーマでは CHECK を表現できないため手で追加する
ALTER TABLE "ReturnRequestItem" ADD CONSTRAINT "ReturnRequestItem_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "ReturnRequestItem" ADD CONSTRAINT "ReturnRequestItem_restocked_within_quantity" CHECK ("restockedQuantity" >= 0 AND "restockedQuantity" <= "quantity");
