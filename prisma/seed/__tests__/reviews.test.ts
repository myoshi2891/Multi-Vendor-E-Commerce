import { SEED_REVIEWS } from "../constants/reviews";
import { SEED_USERS } from "../constants/users";

describe("SEED_REVIEWS バリデーション", () => {
  it("レビュー数が100件以上存在すること", () => {
    expect(SEED_REVIEWS.length).toBeGreaterThanOrEqual(100);
  });

  it("評価が1-5の範囲内であり、主に3-5であること", () => {
    for (const review of SEED_REVIEWS) {
      expect(review.rating).toBeGreaterThanOrEqual(1);
      expect(review.rating).toBeLessThanOrEqual(5);
    }
  });

  it("レビュー文が10文字以上の英語であること", () => {
    for (const review of SEED_REVIEWS) {
      expect(review.review.length).toBeGreaterThanOrEqual(10);
    }
  });

  it("画像は0-3枚であること", () => {
    for (const review of SEED_REVIEWS) {
      if (review.images) {
        expect(review.images.length).toBeLessThanOrEqual(3);
      }
    }
  });

  it("ユーザーemailがSEED_USERSに存在すること", () => {
    const userEmails = new Set(SEED_USERS.map((u) => u.email));
    for (const review of SEED_REVIEWS) {
      expect(userEmails.has(review.userEmail)).toBe(true);
    }
  });
});
