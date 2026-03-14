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

export type BaseSeedResult = {
  countries: Map<string, string>; // code -> id
  users: Map<string, string>; // email -> id
  categories: Map<string, string>; // url -> id
  subCategories: Map<string, string>; // url -> id
  offerTags: Map<string, string>; // url -> id
};

export async function seedBase(prisma: PrismaClient): Promise<BaseSeedResult> {
  // Country
  const countries = new Map<string, string>();
  for (const c of SEED_COUNTRIES) {
    const record = await prisma.country.upsert({
      where: { code: c.code },
      update: { name: c.name },
      create: { name: c.name, code: c.code },
    });
    countries.set(c.code, record.id);
  }

  // User
  const users = new Map<string, string>();
  for (const u of SEED_USERS) {
    const record = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, picture: u.picture, role: u.role },
      create: {
        name: u.name,
        email: u.email,
        picture: u.picture,
        role: u.role,
      },
    });
    users.set(u.email, record.id);
  }

  // Category
  const categories = new Map<string, string>();
  for (const cat of SEED_CATEGORIES) {
    const record = await prisma.category.upsert({
      where: { url: cat.url },
      update: { name: cat.name, image: cat.image, featured: cat.featured },
      create: {
        name: cat.name,
        url: cat.url,
        image: cat.image,
        featured: cat.featured,
      },
    });
    categories.set(cat.url, record.id);
  }

  // SubCategory
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

  // OfferTag
  const offerTags = new Map<string, string>();
  for (const tag of SEED_OFFER_TAGS) {
    const record = await prisma.offerTag.upsert({
      where: { url: tag.url },
      update: { name: tag.name },
      create: { name: tag.name, url: tag.url },
    });
    offerTags.set(tag.url, record.id);
  }

  return { countries, users, categories, subCategories, offerTags };
}
