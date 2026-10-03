/**
 * Seed オーケストレーション
 * 全seederを正しい順序で実行
 */

import { PrismaClient } from "@prisma/client";
import { seedBase } from "./base-seeder";
import { seedAttributes, seedAttributeValues } from "./attribute-seeder";
import { seedStores } from "./store-seeder";
import { seedProducts } from "./product-seeder";
import { seedReviews } from "./review-seeder";
import { seedCommerce } from "./commerce-seeder";
import { productDerivedColumnsUpdateSql } from "../../../src/lib/product-derived-columns";

/**
 * Orchestrates database seeding in five ordered phases: base entities, stores, products, reviews, and commerce.
 *
 * Executes each phase sequentially using the provided Prisma client so later phases receive entities created by earlier phases.
 */
export async function seedAll(prisma: PrismaClient): Promise<void> {
  console.log("🌱 Seed開始...\n");

  // Phase 1: 基底エンティティ
  console.log("📦 Phase 1: Country, User, Category ツリー, OfferTag");
  const baseMaps = await seedBase(prisma);
  console.log(`✅ Phase 1 完了 (${baseMaps.countries.size}カ国, ${baseMaps.users.size}ユーザー, ${baseMaps.categories.size}カテゴリ)\n`);

  // Phase 1.5: カテゴリ別属性定義（カテゴリ id が要るので Phase 1 の直後）
  console.log("🏷️  Phase 1.5: AttributeDefinition, AttributeOption");
  const attributes = await seedAttributes(prisma, baseMaps.categories);
  console.log(`✅ Phase 1.5 完了 (${attributes.definitions.size}定義, ${attributes.optionCount}選択肢)\n`);

  // Phase 2: ストア
  console.log("🏪 Phase 2: Store, ShippingRate");
  const stores = await seedStores(prisma, baseMaps.users, baseMaps.countries);
  console.log(`✅ Phase 2 完了 (${stores.size}店舗)\n`);

  // Phase 3: 商品
  console.log("📦 Phase 3: Product, Variant, Size, Image, Color, Spec, Question");
  const productMaps = await seedProducts(prisma, {
    stores,
    categories: baseMaps.categories,
    offerTags: baseMaps.offerTags,
    countries: baseMaps.countries,
  });
  console.log(`✅ Phase 3 完了 (${productMaps.products.size}商品, ${productMaps.variants.size}バリアント)\n`);

  // Phase 3.5: 属性値（定義と商品・バリアントの id が要るので Phase 3 の後）
  console.log("🏷️  Phase 3.5: ProductAttributeValue, VariantAttributeValue");
  const attributeValues = await seedAttributeValues(prisma, {
    definitions: attributes.definitions,
    products: productMaps.products,
    variants: productMaps.variants,
  });
  console.log(`✅ Phase 3.5 完了 (商品 ${attributeValues.productValues}行, バリアント ${attributeValues.variantValues}行)\n`);

  // Phase 4: レビュー
  console.log("⭐ Phase 4: Review, ReviewImage");
  await seedReviews(prisma, {
    users: baseMaps.users,
    products: productMaps.products,
  });
  console.log("✅ Phase 4 完了\n");

  // Phase 5: コマース
  console.log("💰 Phase 5: Coupon, ShippingAddress, Order, OrderGroup, OrderItem");
  await seedCommerce(prisma, {
    users: baseMaps.users,
    stores,
    countries: baseMaps.countries,
    products: productMaps.products,
    variants: productMaps.variants,
    sizes: productMaps.sizes,
  });
  console.log("✅ Phase 5 完了\n");

  // Phase 6: 非正規化列（searchKeywords / minPrice）の導出（plans 074 / 076）。
  // 商品を upsertProduct を通さずに作っているので、アプリと同じ導出 SQL を全商品へ流す。
  // 省くと seed した商品が keywords で検索に当たらず、価格ソートで末尾に並ぶ。
  console.log("🔎 Phase 6: Product.searchKeywords / minPrice の導出");
  const derived = await prisma.$executeRaw(productDerivedColumnsUpdateSql());
  console.log(`✅ Phase 6 完了 (${derived}商品)\n`);

  console.log("🎉 Seed完了！");
}
