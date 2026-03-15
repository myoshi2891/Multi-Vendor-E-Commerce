/**
 * 基底seeder: Country, User, Category, SubCategory, OfferTag
 * 依存関係のない独立エンティティを投入する
 */

import { PrismaClient } from "@prisma/client";
import { SEED_COUNTRIES } from "../constants/countries";
import { SEED_USERS } from "../constants/users";
import {
  SEED_CATEGORIES,
  SEED_SUB_CATEGORIES,
} from "../constants/categories";
import { SEED_OFFER_TAGS } from "../constants/offer-tags";
import type { SeedMaps } from "../types";

export type BaseSeedResult = Pick<
  SeedMaps,
  "countries" | "users" | "categories" | "subCategories" | "offerTags"
>;

/**
 * Seed base entities (countries, users, categories, subcategories, and offer tags) and return maps of their record IDs.
 *
 * Subcategories are created after categories so each subcategory's `categoryUrl` is resolved to a category ID.
 *
 * @returns An object with maps that associate canonical identifiers to record IDs:
 * - `countries`: country code -> country id
 * - `users`: user email -> user id
 * - `categories`: category URL -> category id
 * - `subCategories`: subcategory URL -> subcategory id
 * - `offerTags`: offer tag URL -> offer tag id
 *
 * @throws Error if a subcategory references a `categoryUrl` that was not created or found. 
 */
export async function seedBase(prisma: PrismaClient): Promise<BaseSeedResult> {
  // Country（並列化）
  const countryRecords = await Promise.all(
    SEED_COUNTRIES.map((c) =>
      prisma.country.upsert({
        where: { code: c.code },
        update: { name: c.name },
        create: { name: c.name, code: c.code },
      })
    )
  );
  const countries = new Map(
    SEED_COUNTRIES.map((c, i) => [c.code, countryRecords[i].id])
  );

  // User（並列化）
  const userRecords = await Promise.all(
    SEED_USERS.map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        update: { name: u.name, picture: u.picture, role: u.role },
        create: {
          name: u.name,
          email: u.email,
          picture: u.picture,
          role: u.role,
        },
      })
    )
  );
  const users = new Map(
    SEED_USERS.map((u, i) => [u.email, userRecords[i].id])
  );

  // Category（並列化）
  const categoryRecords = await Promise.all(
    SEED_CATEGORIES.map((cat) =>
      prisma.category.upsert({
        where: { url: cat.url },
        update: { name: cat.name, image: cat.image, featured: cat.featured },
        create: {
          name: cat.name,
          url: cat.url,
          image: cat.image,
          featured: cat.featured,
        },
      })
    )
  );
  const categories = new Map(
    SEED_CATEGORIES.map((cat, i) => [cat.url, categoryRecords[i].id])
  );

  // SubCategory（依存関係あり、逐次のまま）
  const subCategories = new Map<string, string>();
  for (const sub of SEED_SUB_CATEGORIES) {
    const categoryId = categories.get(sub.categoryUrl);
    if (!categoryId) {
      throw new Error(
        `カテゴリが見つかりません: ${sub.categoryUrl}（サブカテゴリ: ${sub.name}）`
      );
    }
    const record = await prisma.subCategory.upsert({
      where: { url: sub.url },
      update: {
        name: sub.name,
        image: sub.image,
        featured: sub.featured,
        categoryId,
      },
      create: {
        name: sub.name,
        url: sub.url,
        image: sub.image,
        featured: sub.featured,
        categoryId,
      },
    });
    subCategories.set(sub.url, record.id);
  }

  // OfferTag（並列化）
  const offerTagRecords = await Promise.all(
    SEED_OFFER_TAGS.map((tag) =>
      prisma.offerTag.upsert({
        where: { url: tag.url },
        update: { name: tag.name },
        create: { name: tag.name, url: tag.url },
      })
    )
  );
  const offerTags = new Map(
    SEED_OFFER_TAGS.map((tag, i) => [tag.url, offerTagRecords[i].id])
  );

  return { countries, users, categories, subCategories, offerTags };
}
