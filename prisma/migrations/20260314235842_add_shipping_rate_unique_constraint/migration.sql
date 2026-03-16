/*
  Warnings:

  - You are about to alter the column `shippingFeesTotal` on the `Cart` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `subTotal` on the `Cart` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `total` on the `Cart` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `price` on the `CartItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `shippingFee` on the `CartItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `totalPrice` on the `CartItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `shippingFeesTotal` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `subTotal` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `total` on the `Order` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `shippingFees` on the `OrderGroup` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `subTotal` on the `OrderGroup` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `total` on the `OrderGroup` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `shippingFee` on the `OrderItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `price` on the `OrderItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `totalPrice` on the `OrderItem` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `amount` on the `PaymentDetails` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `shippingFeePerItem` on the `ShippingRate` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `shippingFeeForAdditionalItem` on the `ShippingRate` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `shippingFeePerKg` on the `ShippingRate` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `shippingFeeFixed` on the `ShippingRate` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `price` on the `Size` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `discount` on the `Size` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `defaultShippingFeePerItem` on the `Store` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `defaultShippingFeeForAdditionalItem` on the `Store` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `defaultShippingFeePerKg` on the `Store` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - You are about to alter the column `defaultShippingFeeFixed` on the `Store` table. The data in that column could be lost. The data in that column will be cast from `Decimal(12,2)` to `DoublePrecision`.
  - A unique constraint covering the columns `[storeId,countryId]` on the table `ShippingRate` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Cart" ALTER COLUMN "shippingFeesTotal" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "subTotal" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "total" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "CartItem" ALTER COLUMN "price" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "shippingFee" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "totalPrice" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Coupon" ALTER COLUMN "startDate" SET DATA TYPE TEXT,
ALTER COLUMN "endDate" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Order" ALTER COLUMN "shippingFeesTotal" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "subTotal" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "total" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "OrderGroup" ALTER COLUMN "shippingFees" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "subTotal" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "total" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "OrderItem" ALTER COLUMN "shippingFee" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "price" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "totalPrice" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "PaymentDetails" ALTER COLUMN "amount" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "ProductVariant" ALTER COLUMN "saleEndDate" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "ShippingRate" ALTER COLUMN "shippingFeePerItem" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "shippingFeeForAdditionalItem" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "shippingFeePerKg" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "shippingFeeFixed" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Size" ALTER COLUMN "price" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "discount" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Store" ALTER COLUMN "defaultShippingFeePerItem" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "defaultShippingFeeForAdditionalItem" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "defaultShippingFeePerKg" SET DATA TYPE DOUBLE PRECISION,
ALTER COLUMN "defaultShippingFeeFixed" SET DATA TYPE DOUBLE PRECISION;

-- CreateIndex
CREATE UNIQUE INDEX "ShippingRate_storeId_countryId_key" ON "ShippingRate"("storeId", "countryId");
