import { PrismaClient } from "@prisma/client";
import { E2E_SEED } from "./constants";

const databaseUrl =
  process.env.E2E_DATABASE_URL || process.env.DATABASE_URL || "";

if (!databaseUrl) {
  throw new Error("E2E_DATABASE_URL or DATABASE_URL must be set.");
}

const prisma = new PrismaClient({
  datasources: {
    db: { url: databaseUrl },
  },
});

/**
 * Creates or updates a complete end-to-end seed dataset (country, user, store, category, subCategory, product, productVariant)
 * and recreates associated variant data (sizes, variant images, colors).
 *
 * @returns An object containing the upserted or created entities: `country`, `user`, `store`, `category`, `subCategory`, `product`, and `variant`.
 */
async function main() {
  const country = await prisma.country.upsert({
    where: { code: E2E_SEED.country.code },
    create: {
      name: E2E_SEED.country.name,
      code: E2E_SEED.country.code,
    },
    update: {
      name: E2E_SEED.country.name,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: E2E_SEED.user.email },
    create: {
      name: E2E_SEED.user.name,
      email: E2E_SEED.user.email,
      picture: E2E_SEED.user.picture,
    },
    update: {
      name: E2E_SEED.user.name,
      picture: E2E_SEED.user.picture,
    },
  });

  const store = await prisma.store.upsert({
    where: { url: E2E_SEED.store.url },
    create: {
      name: E2E_SEED.store.name,
      description: E2E_SEED.store.description,
      email: E2E_SEED.store.email,
      phone: E2E_SEED.store.phone,
      url: E2E_SEED.store.url,
      logo: E2E_SEED.store.logo,
      cover: E2E_SEED.store.cover,
      status: "ACTIVE",
      defaultShippingService: "International Delivery",
      defaultShippingFeePerItem: 0,
      defaultShippingFeeForAdditionalItem: 0,
      defaultShippingFeePerKg: 0,
      defaultShippingFeeFixed: 0,
      defaultDeliveryTimeMin: 3,
      defaultDeliveryTimeMax: 7,
      returnPolicy: "Return in 30 days.",
      userId: user.id,
    },
    update: {
      name: E2E_SEED.store.name,
      description: E2E_SEED.store.description,
      email: E2E_SEED.store.email,
      phone: E2E_SEED.store.phone,
      logo: E2E_SEED.store.logo,
      cover: E2E_SEED.store.cover,
      status: "ACTIVE",
      defaultShippingService: "International Delivery",
      defaultShippingFeePerItem: 0,
      defaultShippingFeeForAdditionalItem: 0,
      defaultShippingFeePerKg: 0,
      defaultShippingFeeFixed: 0,
      defaultDeliveryTimeMin: 3,
      defaultDeliveryTimeMax: 7,
      returnPolicy: "Return in 30 days.",
      userId: user.id,
    },
  });

  const category = await prisma.category.upsert({
    where: { url: E2E_SEED.category.url },
    create: {
      name: E2E_SEED.category.name,
      url: E2E_SEED.category.url,
      image: E2E_SEED.category.image,
      featured: false,
    },
    update: {
      name: E2E_SEED.category.name,
      image: E2E_SEED.category.image,
      featured: false,
    },
  });

  const subCategory = await prisma.subCategory.upsert({
    where: { url: E2E_SEED.subCategory.url },
    create: {
      name: E2E_SEED.subCategory.name,
      url: E2E_SEED.subCategory.url,
      image: E2E_SEED.subCategory.image,
      featured: false,
      categoryId: category.id,
    },
    update: {
      name: E2E_SEED.subCategory.name,
      image: E2E_SEED.subCategory.image,
      featured: false,
      categoryId: category.id,
    },
  });

  const product = await prisma.product.upsert({
    where: { slug: E2E_SEED.product.slug },
    create: {
      name: E2E_SEED.product.name,
      description: E2E_SEED.product.description,
      slug: E2E_SEED.product.slug,
      brand: E2E_SEED.product.brand,
      shippingFeeMethod: "ITEM",
      storeId: store.id,
      categoryId: category.id,
      subCategoryId: subCategory.id,
    },
    update: {
      name: E2E_SEED.product.name,
      description: E2E_SEED.product.description,
      brand: E2E_SEED.product.brand,
      shippingFeeMethod: "ITEM",
      storeId: store.id,
      categoryId: category.id,
      subCategoryId: subCategory.id,
    },
  });

  const variant = await prisma.productVariant.upsert({
    where: { slug: E2E_SEED.variant.slug },
    create: {
      variantName: E2E_SEED.variant.name,
      variantDescription: E2E_SEED.variant.description,
      variantImage: E2E_SEED.variant.image,
      slug: E2E_SEED.variant.slug,
      sku: E2E_SEED.variant.sku,
      weight: E2E_SEED.variant.weight,
      productId: product.id,
    },
    update: {
      variantName: E2E_SEED.variant.name,
      variantDescription: E2E_SEED.variant.description,
      variantImage: E2E_SEED.variant.image,
      sku: E2E_SEED.variant.sku,
      weight: E2E_SEED.variant.weight,
      productId: product.id,
    },
  });

  await prisma.size.deleteMany({ where: { productVariantId: variant.id } });
  await prisma.productVariantImage.deleteMany({
    where: { productVariantId: variant.id },
  });
  await prisma.color.deleteMany({ where: { productVariantId: variant.id } });

  await prisma.size.create({
    data: {
      size: E2E_SEED.size.size,
      quantity: E2E_SEED.size.quantity,
      price: E2E_SEED.size.price,
      discount: E2E_SEED.size.discount,
      productVariantId: variant.id,
    },
  });

  await prisma.productVariantImage.create({
    data: {
      url: E2E_SEED.variantImage.url,
      alt: E2E_SEED.variantImage.alt,
      productVariantId: variant.id,
    },
  });

  await prisma.color.create({
    data: {
      name: E2E_SEED.color.name,
      productVariantId: variant.id,
    },
  });

  return { country, user, store, category, subCategory, product, variant };
}

main()
  .then(() => {
    console.log("E2E seed completed.");
  })
  .catch((error) => {
    console.error("E2E seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });