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

  it("一部のproductSlugが存在する商品を参照していること（20%以上）", () => {
    const productSlugs = new Set(ALL_SEED_PRODUCTS.map((p) => p.slug));
    const validReviews = SEED_REVIEWS.filter((r) =>
      productSlugs.has(r.productSlug)
    );
    const ratio = validReviews.length / SEED_REVIEWS.length;
    expect(ratio).toBeGreaterThanOrEqual(0.2);
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
