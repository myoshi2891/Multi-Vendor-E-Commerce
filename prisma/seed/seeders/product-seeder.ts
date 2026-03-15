/**
 * 商品seeder: Product + ProductVariant + Size + Image + Color + Spec + Question
 */

import { PrismaClient } from "@prisma/client";
import { ALL_SEED_PRODUCTS } from "../constants/products";
import type { SeedMaps } from "../types";

export async function seedProducts(
  prisma: PrismaClient,
  maps: Pick<
    SeedMaps,
    "stores" | "categories" | "subCategories" | "offerTags" | "countries"
  >
): Promise<{
  products: Map<string, string>;
  variants: Map<string, string>;
  sizes: Map<string, string>;
}> {
  const products = new Map<string, string>();
  const variants = new Map<string, string>();
  const sizes = new Map<string, string>();

  for (const p of ALL_SEED_PRODUCTS) {
    const storeId = maps.stores.get(p.storeUrl);
    if (!storeId) {
      throw new Error(
        `ストアが見つかりません: ${p.storeUrl}（商品: ${p.name}）`
      );
    }

    const categoryId = maps.categories.get(p.categoryUrl);
    if (!categoryId) {
      throw new Error(
        `カテゴリが見つかりません: ${p.categoryUrl}（商品: ${p.name}）`
      );
    }

    const subCategoryId = maps.subCategories.get(p.subCategoryUrl);
    if (!subCategoryId) {
      throw new Error(
        `サブカテゴリが見つかりません: ${p.subCategoryUrl}（商品: ${p.name}）`
      );
    }

    let offerTagId: string | null = null;
    if (p.offerTagUrl) {
      const resolved = maps.offerTags.get(p.offerTagUrl);
      if (!resolved) {
        throw new Error(
          `オファータグが見つかりません: ${p.offerTagUrl}（商品: ${p.slug}）`
        );
      }
      offerTagId = resolved;
    }

    // Product upsert
    const productRecord = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description,
        brand: p.brand,
        shippingFeeMethod: p.shippingFeeMethod,
        storeId,
        categoryId,
        subCategoryId,
        offerTagId,
      },
      create: {
        name: p.name,
        description: p.description,
        slug: p.slug,
        brand: p.brand,
        shippingFeeMethod: p.shippingFeeMethod,
        storeId,
        categoryId,
        subCategoryId,
        offerTagId,
      },
    });
    products.set(p.slug, productRecord.id);

    // Question: deleteMany → createMany
    await prisma.question.deleteMany({
      where: { productId: productRecord.id },
    });
    if (p.questions.length > 0) {
      await prisma.question.createMany({
        data: p.questions.map((q) => ({
          question: q.question,
          answer: q.answer,
          productId: productRecord.id,
        })),
      });
    }

    // Spec（商品レベル）: deleteMany（バリアントレベルは後で処理）
    await prisma.spec.deleteMany({
      where: { productId: productRecord.id, variantId: null },
    });

    // 定義に含まれないバリアントを削除（ダングリング防止）
    const expectedSlugs = p.variants.map((v) => v.slug);
    await prisma.productVariant.deleteMany({
      where: {
        productId: productRecord.id,
        slug: { notIn: expectedSlugs },
      },
    });

    // 各バリアント
    for (const v of p.variants) {
      const variantRecord = await prisma.productVariant.upsert({
        where: { slug: v.slug },
        update: {
          variantName: v.variantName,
          variantDescription: v.variantDescription,
          variantImage: v.images[0]?.url ?? "",
          isSale: v.isSale,
          saleEndDate: v.saleEndDate ?? null,
          keywords: v.keywords.join(", "),
          sku: v.sku,
          weight: v.weight,
          productId: productRecord.id,
        },
        create: {
          variantName: v.variantName,
          variantDescription: v.variantDescription,
          variantImage: v.images[0]?.url ?? "",
          slug: v.slug,
          isSale: v.isSale,
          saleEndDate: v.saleEndDate ?? null,
          keywords: v.keywords.join(", "),
          sku: v.sku,
          weight: v.weight,
          productId: productRecord.id,
        },
      });
      variants.set(v.slug, variantRecord.id);

      // Size: deleteMany → createMany
      await prisma.size.deleteMany({
        where: { productVariantId: variantRecord.id },
      });
      const sizeRecords = await Promise.all(
        v.sizes.map((s) =>
          prisma.size.create({
            data: {
              size: s.size,
              quantity: s.quantity,
              price: s.price,
              discount: s.discount,
              productVariantId: variantRecord.id,
            },
          })
        )
      );
      for (let i = 0; i < v.sizes.length; i++) {
        sizes.set(
          `${v.slug}:${v.sizes[i].size}`,
          sizeRecords[i].id
        );
      }

      // Image: deleteMany → createMany
      await prisma.productVariantImage.deleteMany({
        where: { productVariantId: variantRecord.id },
      });
      if (v.images.length > 0) {
        await prisma.productVariantImage.createMany({
          data: v.images.map((img) => ({
            url: img.url,
            alt: img.alt,
            productVariantId: variantRecord.id,
          })),
        });
      }

      // Color: deleteMany → createMany
      await prisma.color.deleteMany({
        where: { productVariantId: variantRecord.id },
      });
      if (v.colors.length > 0) {
        await prisma.color.createMany({
          data: v.colors.map((c) => ({
            name: c.name,
            productVariantId: variantRecord.id,
          })),
        });
      }

      // Spec（バリアントレベル）: deleteMany → createMany
      await prisma.spec.deleteMany({
        where: { variantId: variantRecord.id },
      });
      if (v.specs.length > 0) {
        await prisma.spec.createMany({
          data: v.specs.map((s) => ({
            name: s.name,
            value: s.value,
            variantId: variantRecord.id,
          })),
        });
      }
    }

    // FreeShipping: 常に既存を削除（冪等性）
    await prisma.freeShipping.deleteMany({
      where: { productId: productRecord.id },
    });

    // 対象国が指定されている場合のみ再作成
    if (p.freeShippingCountryCodes && p.freeShippingCountryCodes.length > 0) {
      // 全コードを検証（不明なコードはエラー）
      const countryIds: string[] = [];
      for (const code of p.freeShippingCountryCodes) {
        const countryId = maps.countries.get(code);
        if (!countryId) {
          throw new Error(
            `国コードが見つかりません: ${code}（商品: ${p.slug}）`
          );
        }
        countryIds.push(countryId);
      }

      const freeShipping = await prisma.freeShipping.create({
        data: { productId: productRecord.id },
      });
      await prisma.freeShippingCountry.createMany({
        data: countryIds.map((countryId) => ({
          freeShippingId: freeShipping.id,
          countryId,
        })),
      });
    }
  }

  return { products, variants, sizes };
}
