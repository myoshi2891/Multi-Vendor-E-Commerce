-- CreateEnum
CREATE TYPE "AttributeType" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN', 'ENUM');

-- CreateEnum
CREATE TYPE "AttributeScope" AS ENUM ('PRODUCT', 'VARIANT');

-- CreateTable
CREATE TABLE "AttributeDefinition" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AttributeType" NOT NULL,
    "scope" "AttributeScope" NOT NULL,
    "unit" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "facetable" BOOLEAN NOT NULL DEFAULT false,
    "multiValued" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttributeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttributeOption" (
    "id" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttributeOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAttributeValue" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "scope" "AttributeScope" NOT NULL DEFAULT 'PRODUCT',
    "type" "AttributeType" NOT NULL,
    "multiValued" BOOLEAN NOT NULL,
    "valueText" TEXT,
    "valueNumber" DECIMAL(18,6),
    "valueBool" BOOLEAN,
    "optionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantAttributeValue" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "scope" "AttributeScope" NOT NULL DEFAULT 'VARIANT',
    "type" "AttributeType" NOT NULL,
    "multiValued" BOOLEAN NOT NULL,
    "valueText" TEXT,
    "valueNumber" DECIMAL(18,6),
    "valueBool" BOOLEAN,
    "optionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariantAttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttributeDefinition_categoryId_facetable_idx" ON "AttributeDefinition"("categoryId", "facetable");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeDefinition_id_scope_type_multiValued_key" ON "AttributeDefinition"("id", "scope", "type", "multiValued");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeOption_definitionId_value_key" ON "AttributeOption"("definitionId", "value");

-- CreateIndex
CREATE UNIQUE INDEX "AttributeOption_id_definitionId_key" ON "AttributeOption"("id", "definitionId");

-- CreateIndex
CREATE INDEX "ProductAttributeValue_productId_definitionId_idx" ON "ProductAttributeValue"("productId", "definitionId");

-- CreateIndex
CREATE INDEX "ProductAttributeValue_definitionId_valueNumber_idx" ON "ProductAttributeValue"("definitionId", "valueNumber");

-- CreateIndex
CREATE INDEX "ProductAttributeValue_definitionId_optionId_idx" ON "ProductAttributeValue"("definitionId", "optionId");

-- CreateIndex
CREATE INDEX "VariantAttributeValue_variantId_definitionId_idx" ON "VariantAttributeValue"("variantId", "definitionId");

-- CreateIndex
CREATE INDEX "VariantAttributeValue_definitionId_valueNumber_idx" ON "VariantAttributeValue"("definitionId", "valueNumber");

-- CreateIndex
CREATE INDEX "VariantAttributeValue_definitionId_optionId_idx" ON "VariantAttributeValue"("definitionId", "optionId");

-- AddForeignKey
ALTER TABLE "AttributeDefinition" ADD CONSTRAINT "AttributeDefinition_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttributeOption" ADD CONSTRAINT "AttributeOption_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "AttributeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_definitionId_scope_type_multiValued_fkey" FOREIGN KEY ("definitionId", "scope", "type", "multiValued") REFERENCES "AttributeDefinition"("id", "scope", "type", "multiValued") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ProductAttributeValue" ADD CONSTRAINT "ProductAttributeValue_optionId_definitionId_fkey" FOREIGN KEY ("optionId", "definitionId") REFERENCES "AttributeOption"("id", "definitionId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "VariantAttributeValue" ADD CONSTRAINT "VariantAttributeValue_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantAttributeValue" ADD CONSTRAINT "VariantAttributeValue_definitionId_scope_type_multiValued_fkey" FOREIGN KEY ("definitionId", "scope", "type", "multiValued") REFERENCES "AttributeDefinition"("id", "scope", "type", "multiValued") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "VariantAttributeValue" ADD CONSTRAINT "VariantAttributeValue_optionId_definitionId_fkey" FOREIGN KEY ("optionId", "definitionId") REFERENCES "AttributeOption"("id", "definitionId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- ===========================================================================
-- plan 069: Prisma スキーマで表現できない制約（ADR-007 D-5 / D-6 / D-7）
--
-- schema.prisma には現れないので、以後 `prisma migrate dev` がこれらの
-- DROP を提案しないことを確認すること（plan 069 Done criteria）。
-- Prisma の camelCase 列は二重引用符が必須（無引用だと小文字に畳まれる）。
-- ===========================================================================

-- 定義の (categoryId, key) 一意はアクティブ行のみ。archive + 同 key 再作成
-- （型変更の経路 2・design.md Q7）を INSERT で落とさないため、素の複合 UNIQUE にしない。
CREATE UNIQUE INDEX "AttributeDefinition_categoryId_key_active_key"
    ON "AttributeDefinition" ("categoryId", "key")
    WHERE "archivedAt" IS NULL;

-- D-7: 多値は ENUM 限定。D-6 の CHECK と合わせて多値行の optionId は NOT NULL になり、
-- 部分 UNIQUE が NULL 同士を別値として扱う罠を踏まない。
ALTER TABLE "AttributeDefinition"
    ADD CONSTRAINT "AttributeDefinition_multi_valued_enum_only"
    CHECK (NOT "multiValued" OR "type" = 'ENUM');

-- D-5: 値テーブルの scope を定数に固定する（複合 FK だけでは scope 列の書き換えで通ってしまう）。
ALTER TABLE "ProductAttributeValue"
    ADD CONSTRAINT "ProductAttributeValue_scope_product"
    CHECK ("scope" = 'PRODUCT');
ALTER TABLE "VariantAttributeValue"
    ADD CONSTRAINT "VariantAttributeValue_scope_variant"
    CHECK ("scope" = 'VARIANT');

-- D-6: type が指す列だけが埋まっている（全列 NULL の行も拒否する）。
ALTER TABLE "ProductAttributeValue"
    ADD CONSTRAINT "ProductAttributeValue_value_matches_type"
    CHECK (
        CASE "type"
            WHEN 'TEXT'    THEN "valueText"   IS NOT NULL AND "valueNumber" IS NULL AND "valueBool" IS NULL   AND "optionId" IS NULL
            WHEN 'NUMBER'  THEN "valueNumber" IS NOT NULL AND "valueText"   IS NULL AND "valueBool" IS NULL   AND "optionId" IS NULL
            WHEN 'BOOLEAN' THEN "valueBool"   IS NOT NULL AND "valueText"   IS NULL AND "valueNumber" IS NULL AND "optionId" IS NULL
            WHEN 'ENUM'    THEN "optionId"    IS NOT NULL AND "valueText"   IS NULL AND "valueNumber" IS NULL AND "valueBool" IS NULL
        END
    );
ALTER TABLE "VariantAttributeValue"
    ADD CONSTRAINT "VariantAttributeValue_value_matches_type"
    CHECK (
        CASE "type"
            WHEN 'TEXT'    THEN "valueText"   IS NOT NULL AND "valueNumber" IS NULL AND "valueBool" IS NULL   AND "optionId" IS NULL
            WHEN 'NUMBER'  THEN "valueNumber" IS NOT NULL AND "valueText"   IS NULL AND "valueBool" IS NULL   AND "optionId" IS NULL
            WHEN 'BOOLEAN' THEN "valueBool"   IS NOT NULL AND "valueText"   IS NULL AND "valueNumber" IS NULL AND "optionId" IS NULL
            WHEN 'ENUM'    THEN "optionId"    IS NOT NULL AND "valueText"   IS NULL AND "valueNumber" IS NULL AND "valueBool" IS NULL
        END
    );

-- D-7: 単値は (所有先, 定義) で 1 行、多値は (所有先, 定義, 選択肢) で 1 行。
CREATE UNIQUE INDEX "ProductAttributeValue_single_key"
    ON "ProductAttributeValue" ("productId", "definitionId")
    WHERE NOT "multiValued";
CREATE UNIQUE INDEX "ProductAttributeValue_multi_key"
    ON "ProductAttributeValue" ("productId", "definitionId", "optionId")
    WHERE "multiValued";
CREATE UNIQUE INDEX "VariantAttributeValue_single_key"
    ON "VariantAttributeValue" ("variantId", "definitionId")
    WHERE NOT "multiValued";
CREATE UNIQUE INDEX "VariantAttributeValue_multi_key"
    ON "VariantAttributeValue" ("variantId", "definitionId", "optionId")
    WHERE "multiValued";
