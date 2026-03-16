/*
  Warnings:

  - You are about to alter the column `shippingFeesTotal` on the `Cart` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `subTotal` on the `Cart` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `total` on the `Cart` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `price` on the `CartItem` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `shippingFee` on the `CartItem` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `totalPrice` on the `CartItem` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `shippingFeesTotal` on the `Order` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `subTotal` on the `Order` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `total` on the `Order` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `shippingFees` on the `OrderGroup` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `subTotal` on the `OrderGroup` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `total` on the `OrderGroup` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `shippingFee` on the `OrderItem` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `price` on the `OrderItem` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `totalPrice` on the `OrderItem` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `amount` on the `PaymentDetails` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `shippingFeePerItem` on the `ShippingRate` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `shippingFeeForAdditionalItem` on the `ShippingRate` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `shippingFeePerKg` on the `ShippingRate` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `shippingFeeFixed` on the `ShippingRate` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `price` on the `Size` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `defaultShippingFeePerItem` on the `Store` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `defaultShippingFeeForAdditionalItem` on the `Store` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `defaultShippingFeePerKg` on the `Store` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.
  - You are about to alter the column `defaultShippingFeeFixed` on the `Store` table. The data in that column will be cast from `DoublePrecision` to `Decimal(12,2)`.

*/
-- AlterTable
ALTER TABLE "Cart"
  ALTER COLUMN "shippingFeesTotal" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "subTotal" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "total" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "CartItem"
  ALTER COLUMN "price" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "shippingFee" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "totalPrice" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Order"
  ALTER COLUMN "shippingFeesTotal" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "subTotal" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "total" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "OrderGroup"
  ALTER COLUMN "shippingFees" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "subTotal" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "total" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "OrderItem"
  ALTER COLUMN "shippingFee" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "price" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "totalPrice" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "PaymentDetails"
  ALTER COLUMN "amount" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "ShippingRate"
  ALTER COLUMN "shippingFeePerItem" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "shippingFeeForAdditionalItem" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "shippingFeePerKg" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "shippingFeeFixed" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Size"
  ALTER COLUMN "price" SET DATA TYPE DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Store"
  ALTER COLUMN "defaultShippingFeePerItem" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "defaultShippingFeeForAdditionalItem" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "defaultShippingFeePerKg" SET DATA TYPE DECIMAL(12,2),
  ALTER COLUMN "defaultShippingFeeFixed" SET DATA TYPE DECIMAL(12,2);
