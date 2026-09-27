import { seedReviews } from "../seeders/review-seeder";
import { SEED_REVIEWS } from "../constants/reviews";
import { ALL_SEED_PRODUCTS } from "../constants/products";
import { SEED_USERS } from "../constants/users";

describe("SEED_REVIEWS バリデーション", () => {
  it("120件以上のレビューが存在すること", () => {
    expect(SEED_REVIEWS.length).toBeGreaterThanOrEqual(120);
  });

  it("全レビュー文が10文字以上であること", () => {
    for (const r of SEED_REVIEWS) {
      expect(r.review.length).toBeGreaterThanOrEqual(10);
    }
  });

  it("全ratingが1-5の範囲であること", () => {
    for (const r of SEED_REVIEWS) {
      expect(r.rating).toBeGreaterThanOrEqual(1);
      expect(r.rating).toBeLessThanOrEqual(5);
    }
  });

  it("評価の大半が4-5星であること（80%以上）", () => {
    const highRatings = SEED_REVIEWS.filter((r) => r.rating >= 4).length;
    const ratio = highRatings / SEED_REVIEWS.length;
    expect(ratio).toBeGreaterThanOrEqual(0.8);
  });

  it("全productSlugが存在する商品を参照していること", () => {
    const productSlugs = new Set(ALL_SEED_PRODUCTS.map((p) => p.slug));
    for (const r of SEED_REVIEWS) {
      expect(productSlugs.has(r.productSlug)).toBe(true);
    }
  });

  it("全userEmailが存在するUSERロールユーザーを参照していること", () => {
    const userEmails = new Set(
      SEED_USERS.filter((u) => u.role === "USER").map((u) => u.email)
    );
    for (const r of SEED_REVIEWS) {
      expect(userEmails.has(r.userEmail)).toBe(true);
    }
  });

  it("同じユーザーが同じ商品に複数レビューしていないこと", () => {
    const combinations = new Set<string>();
    for (const r of SEED_REVIEWS) {
      const key = `${r.userEmail}:${r.productSlug}`;
      expect(combinations.has(key)).toBe(false);
      combinations.add(key);
    }
  });

  it("一部の商品にレビューがあること（20%以上）", () => {
    const reviewedProducts = new Set(SEED_REVIEWS.map((r) => r.productSlug));
    const productsWithReviews = ALL_SEED_PRODUCTS.filter((p) =>
      reviewedProducts.has(p.slug)
    );
    const ratio = productsWithReviews.length / ALL_SEED_PRODUCTS.length;
    expect(ratio).toBeGreaterThanOrEqual(0.2);
  });

  it("画像は0-3枚の範囲であること", () => {
    for (const r of SEED_REVIEWS) {
      expect(r.images.length).toBeGreaterThanOrEqual(0);
      expect(r.images.length).toBeLessThanOrEqual(3);
    }
  });

  it("likesが0以上であること", () => {
    for (const r of SEED_REVIEWS) {
      expect(r.likes).toBeGreaterThanOrEqual(0);
    }
  });

  it("quantityが文字列形式の数値であること", () => {
    for (const r of SEED_REVIEWS) {
      expect(r.quantity).toMatch(/^\d+$/);
      expect(parseInt(r.quantity, 10)).toBeGreaterThan(0);
    }
  });
});

describe("seedReviews", () => {
  // 遅延のある DB（Neon）では、対話的トランザクション内のクエリ数 × 往復時間が
  // 既定タイムアウト 5 秒を超えて P2028 になる。件数に比例しない一括書き込みを固定する。
  const deleteMany = jest.fn();
  const reviewCreateMany = jest.fn();
  const reviewCreate = jest.fn();
  const imageCreateMany = jest.fn();
  const tx = {
    review: { deleteMany, createMany: reviewCreateMany, create: reviewCreate },
    reviewImage: { createMany: imageCreateMany },
  };
  const prisma = {
    $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx)
    ),
  } as unknown as import("@prisma/client").PrismaClient;

  const maps = () => ({
    users: new Map(SEED_USERS.map((u) => [u.email, `u:${u.email}`])),
    products: new Map(ALL_SEED_PRODUCTS.map((p) => [p.slug, `p:${p.slug}`])),
  });

  beforeEach(() => jest.clearAllMocks());

  it("レビュー件数に関係なく、トランザクション内のクエリは削除 1 + 一括作成 2 に収まる", async () => {
    // Act
    await seedReviews(prisma, maps());

    // Assert
    expect(deleteMany).toHaveBeenCalledTimes(1);
    expect(reviewCreate).not.toHaveBeenCalled();
    expect(reviewCreateMany).toHaveBeenCalledTimes(1);
    expect(imageCreateMany).toHaveBeenCalledTimes(1);
    expect(reviewCreateMany.mock.calls[0][0].data).toHaveLength(
      SEED_REVIEWS.length
    );
  });

  it("画像は同じ呼び出しで作ったレビューの id を参照する", async () => {
    await seedReviews(prisma, maps());

    const reviews: { id: string; productId: string; userId: string }[] =
      reviewCreateMany.mock.calls[0][0].data;
    const images: { reviewId: string; url: string }[] =
      imageCreateMany.mock.calls[0][0].data;
    const reviewIds = new Set(reviews.map((r) => r.id));
    expect(reviewIds.size).toBe(reviews.length);
    expect(images).toHaveLength(
      SEED_REVIEWS.reduce((sum, r) => sum + r.images.length, 0)
    );
    for (const image of images) {
      expect(reviewIds.has(image.reviewId)).toBe(true);
    }
    // 元データの対応（何番目のレビューの画像か）が保たれている
    const first = SEED_REVIEWS.findIndex((r) => r.images.length > 0);
    expect(
      images
        .filter((i) => i.reviewId === reviews[first].id)
        .map((i) => i.url)
    ).toEqual(SEED_REVIEWS[first].images.map((i) => i.url));
  });

  it("存在しない商品へのレビューはスキップし、未知のユーザーは throw する", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const partial = maps();
    partial.products.delete(SEED_REVIEWS[0].productSlug);

    await seedReviews(prisma, partial);

    const created = reviewCreateMany.mock.calls[0][0].data;
    expect(
      created.some(
        (r: { productId: string }) =>
          r.productId === `p:${SEED_REVIEWS[0].productSlug}`
      )
    ).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();

    await expect(
      seedReviews(prisma, { ...maps(), users: new Map() })
    ).rejects.toThrow("ユーザーが見つかりません");
  });
});
