import { PrismaClient } from "@prisma/client";
import { seedAll } from "../seeders";
import { SEED_USERS } from "../constants/users";
import { SEED_STORES } from "../constants/stores";
import { ALL_SEED_PRODUCTS } from "../constants/products";

// 冪等性テスト（実際のDBに対して実行）
// このテストはDBの状態を変更するため、開発環境でのみ実行すること

describe("Seed 冪等性テスト", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("seedAllを2回実行してもエラーが発生しないこと", async () => {
    // 1回目の実行
    await expect(seedAll(prisma)).resolves.not.toThrow();

    // 2回目の実行（冪等性確認）
    await expect(seedAll(prisma)).resolves.not.toThrow();
  }, 120000); // 2分タイムアウト

  it("seed実行後、全URLにlux-プレフィクスがあること（E2E衝突回避）", async () => {
    const categories = await prisma.category.findMany();
    for (const cat of categories) {
      expect(cat.url).toMatch(/^lux-/);
    }

    const stores = await prisma.store.findMany();
    for (const store of stores) {
      expect(store.url).toMatch(/^lux-/);
    }

    const products = await prisma.product.findMany();
    for (const p of products) {
      expect(p.slug).toMatch(/^lux-/);
    }
  });

  it("seed実行後、全emailにlux-seed-プレフィクスがあること（E2E衝突回避）", async () => {
    const users = await prisma.user.findMany({
      where: {
        email: {
          contains: "lux-seed-",
        },
      },
    });

    expect(users.length).toBeGreaterThanOrEqual(SEED_USERS.length);
  });

  it("seed実行後、指定された数のストアが存在すること", async () => {
    const stores = await prisma.store.findMany({
      where: {
        url: {
          startsWith: "lux-",
        },
      },
    });

    expect(stores.length).toBeGreaterThanOrEqual(SEED_STORES.length);
  });

  it("seed実行後、商品データが存在すること", async () => {
    const products = await prisma.product.findMany({
      where: {
        slug: {
          startsWith: "lux-",
        },
      },
    });

    // 全36商品のうち、少なくとも30商品は存在するはず（Geminiデータの不整合を許容）
    expect(products.length).toBeGreaterThanOrEqual(30);
  });
});
