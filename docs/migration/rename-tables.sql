-- pgloader が生成する小文字テーブル名を Prisma の PascalCase に変換
-- 使用方法: psql "$DIRECT_URL" -f docs/migration/rename-tables.sql
--
-- 注意: トランザクション内で実行するため、エラー時は自動ロールバックされます。

BEGIN;

ALTER TABLE "user"                  RENAME TO "User";
ALTER TABLE "category"              RENAME TO "Category";
ALTER TABLE "subcategory"           RENAME TO "SubCategory";
ALTER TABLE "store"                 RENAME TO "Store";
ALTER TABLE "product"               RENAME TO "Product";
ALTER TABLE "productvariant"        RENAME TO "ProductVariant";
ALTER TABLE "size"                  RENAME TO "Size";
ALTER TABLE "productvariantimage"   RENAME TO "ProductVariantImage";
ALTER TABLE "color"                 RENAME TO "Color";
ALTER TABLE "offertag"              RENAME TO "OfferTag";
ALTER TABLE "spec"                  RENAME TO "Spec";
ALTER TABLE "question"              RENAME TO "Question";
ALTER TABLE "country"               RENAME TO "Country";
ALTER TABLE "shippingrate"          RENAME TO "ShippingRate";
ALTER TABLE "freeshipping"          RENAME TO "FreeShipping";
ALTER TABLE "freeshippingcountry"   RENAME TO "FreeShippingCountry";
ALTER TABLE "review"                RENAME TO "Review";
ALTER TABLE "reviewimage"           RENAME TO "ReviewImage";
ALTER TABLE "cart"                  RENAME TO "Cart";
ALTER TABLE "cartitem"              RENAME TO "CartItem";
ALTER TABLE "shippingaddress"       RENAME TO "ShippingAddress";
ALTER TABLE "order"                 RENAME TO "Order";
ALTER TABLE "ordergroup"            RENAME TO "OrderGroup";
ALTER TABLE "orderitem"             RENAME TO "OrderItem";
ALTER TABLE "wishlist"              RENAME TO "Wishlist";
ALTER TABLE "coupon"                RENAME TO "Coupon";
ALTER TABLE "paymentdetails"        RENAME TO "PaymentDetails";

-- Enum テーブルの確認
-- Prisma は以下の enum を定義しています。pgloader は enum 型を PostgreSQL の
-- ネイティブ型として作成しますが、テーブルではないためリネーム不要です。
-- ただし、名前が変わっていないか確認してください:
--
--   Role, StoreStatus, ShippingFeeMethod, OrderStatus,
--   PaymentStatus, PaymentMethod, ProductStatus
--
-- 確認クエリ:
SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname;

COMMIT;
