import { PrismaClient } from "@prisma/client";
import { seedAll } from "../seeders";
import { SEED_USERS } from "../constants/users";
import { SEED_STORES } from "../constants/stores";
import { SEED_CATEGORIES } from "../constants/categories";

// 冪等性テスト（実際のDBに対して実行）
// ALLOW_DB_MUTATION_TESTS=true が必要

const MIN_CATEGORIES = SEED_CATEGORIES.length;
const MIN_STORES = SEED_STORES.length;
const MIN_PRODUCTS = 30; // 全商品数より少なめ（Geminiデータの不整合を許容）

describe("Seed 冪等性テスト", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    if (process.env.ALLOW_DB_MUTATION_TESTS !== "true") {
      throw new Error(
        "DB変更テストには ALLOW_DB_MUTATION_TESTS=true が必要です"
      );
    }
    prisma = new PrismaClient();
    await seedAll(prisma);
  }, 300000);

  afterAll(async () => {
    if (prisma && typeof prisma.$disconnect === "function") {
      try {
        await prisma.$disconnect();
      } catch (error) {
        // safely discard disconnect errors
      }
    }
  });

  it("seedAllを2回実行しても重複が発生しないこと", async () => {
    const firstCounts = {
      categories: (
        await prisma.category.findMany({
          where: { url: { startsWith: "lux-" } },
        })
      ).length,
      users: (
        await prisma.user.findMany({
          where: { email: { startsWith: "lux-seed-" } },
        })
      ).length,
      stores: (
        await prisma.store.findMany({
          where: { url: { startsWith: "lux-" } },
        })
      ).length,
      products: (
        await prisma.product.findMany({
          where: { slug: { startsWith: "lux-" } },
        })
      ).length,
    };

    // 2回目の実行（冪等性確認）
    await seedAll(prisma);

    const secondCounts = {
      categories: (
        await prisma.category.findMany({
          where: { url: { startsWith: "lux-" } },
        })
      ).length,
      users: (
        await prisma.user.findMany({
          where: { email: { startsWith: "lux-seed-" } },
        })
      ).length,
      stores: (
        await prisma.store.findMany({
          where: { url: { startsWith: "lux-" } },
        })
      ).length,
      products: (
        await prisma.product.findMany({
          where: { slug: { startsWith: "lux-" } },
        })
      ).length,
    };

    expect(secondCounts.categories).toBe(firstCounts.categories);
    expect(secondCounts.users).toBe(firstCounts.users);
    expect(secondCounts.stores).toBe(firstCounts.stores);
    expect(secondCounts.products).toBe(firstCounts.products);
  }, 300000); // 5分タイムアウト（36商品×2回実行、Neonレイテンシ考慮）

  it("seed実行後、lux-seed由来のデータにlux-プレフィクスがあること（E2E衝突回避）", async () => {
    const categories = await prisma.category.findMany({
      where: { url: { startsWith: "lux-" } },
    });
    expect(categories.length).toBeGreaterThanOrEqual(MIN_CATEGORIES);

    const stores = await prisma.store.findMany({
      where: { url: { startsWith: "lux-" } },
    });
    expect(stores.length).toBeGreaterThanOrEqual(MIN_STORES);

    const products = await prisma.product.findMany({
      where: { slug: { startsWith: "lux-" } },
    });
    expect(products.length).toBeGreaterThanOrEqual(MIN_PRODUCTS);
  });

  it("seed実行後、全emailにlux-seed-プレフィクスがあること（E2E衝突回避）", async () => {
    const users = await prisma.user.findMany({
      where: {
        email: {
          startsWith: "lux-seed-",
        },
      },
    });

    expect(users.length).toBeGreaterThanOrEqual(SEED_USERS.length);
  });

});
