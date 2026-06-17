-- AddCheckConstraint
-- scope='STORE' なら storeId は必須、scope='PLATFORM' なら storeId は NULL であることを保証する。
-- 既存データは旧スキーマの NOT NULL 制約により全件 storeId 非null（=STORE）のため、追加時に違反は発生しない。
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_scope_storeId_check" CHECK (
    ("scope" = 'STORE' AND "storeId" IS NOT NULL) OR ("scope" = 'PLATFORM' AND "storeId" IS NULL)
);
