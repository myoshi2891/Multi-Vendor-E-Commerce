/**
 * Seed オーケストレーション
 * 全seederを正しい順序で実行
 */

import { PrismaClient } from "@prisma/client";
import { seedBase } from "./base-seeder";
import { seedStores } from "./store-seeder";
import { seedProducts } from "./product-seeder";
import { seedReviews } from "./review-seeder";
import { seedCommerce } from "./commerce-seeder";

export async function seedAll(prisma: PrismaClient): Promise<void> {
  console.log("🌱 Seed開始...\n");

  // Phase 1: 基底エンティティ
  console.log("📦 Phase 1: Country, User, Category, SubCategory, OfferTag");
  const baseMaps = await seedBase(prisma);
  console.log(`✅ Phase 1 完了 (${baseMaps.countries.size}カ国, ${baseMaps.users.size}ユーザー, ${baseMaps.categories.size}カテゴリ)\n`);

  // Phase 2: ストア
  console.log("🏪 Phase 2: Store, ShippingRate");
  const stores = await seedStores(prisma, baseMaps.users, baseMaps.countries);
  console.log(`✅ Phase 2 完了 (${stores.size}店舗)\n`);

  // Phase 3: 商品
  console.log("📦 Phase 3: Product, Variant, Size, Image, Color, Spec, Question");
  const productMaps = await seedProducts(prisma, {
    stores,
    categories: baseMaps.categories,
    subCategories: baseMaps.subCategories,
    offerTags: baseMaps.offerTags,
    countries: baseMaps.countries,
  });
  console.log(`✅ Phase 3 完了 (${productMaps.products.size}商品, ${productMaps.variants.size}バリアント)\n`);

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

  console.log("🎉 Seed完了！");
}
