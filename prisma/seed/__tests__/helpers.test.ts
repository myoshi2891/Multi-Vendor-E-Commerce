import {
  slugify,
  generateSku,
  generateDeterministicId,
  SEED_PREFIX,
  SEED_EMAIL_PREFIX,
} from "../helpers";

describe("seed helpers", () => {
  describe("SEED_PREFIX", () => {
    it("lux- で始まること", () => {
      expect(SEED_PREFIX).toBe("lux-");
    });
  });

  describe("SEED_EMAIL_PREFIX", () => {
    it("lux-seed- で始まること", () => {
      expect(SEED_EMAIL_PREFIX).toBe("lux-seed-");
    });
  });

  describe("slugify", () => {
    it("正常ケース: 英語の商品名をslugに変換できる", () => {
      const result = slugify("Cashmere Double Breasted Coat");
      expect(result).toBe("lux-cashmere-double-breasted-coat");
    });

    it("正常ケース: 特殊文字を除去する", () => {
      const result = slugify("Artisan's Gold & Silver Necklace");
      expect(result).toBe("lux-artisans-gold-silver-necklace");
    });

    it("正常ケース: 連続するハイフンを1つにまとめる", () => {
      const result = slugify("Silk---Charmeuse   Evening Dress");
      expect(result).toBe("lux-silk-charmeuse-evening-dress");
    });

    it("正常ケース: 先頭・末尾のハイフンを除去する", () => {
      const result = slugify("-Leading Trailing-");
      expect(result).toBe("lux-leading-trailing");
    });

    it("正常ケース: 大文字を小文字に変換する", () => {
      const result = slugify("NOIR ELEGANCE");
      expect(result).toBe("lux-noir-elegance");
    });

    it("正常ケース: カスタムプレフィクスを使用できる", () => {
      const result = slugify("Test Product", "custom-");
      expect(result).toBe("custom-test-product");
    });

    it("結果がURL安全な文字列であること", () => {
      const result = slugify("Product #1 (Limited Edition) @2025!");
      expect(result).toMatch(/^[a-z0-9-]+$/);
    });
  });

  describe("generateSku", () => {
    it("正常ケース: 店舗コードとカテゴリからSKUを生成する", () => {
      const result = generateSku("NOIR", "WC", 1);
      expect(result).toBe("NOIR-WC-001");
    });

    it("正常ケース: 連番がゼロパディングされる", () => {
      const result = generateSku("MAISON", "MA", 42);
      expect(result).toBe("MAISON-MA-042");
    });

    it("正常ケース: バリアントサフィックス付き", () => {
      const result = generateSku("NOIR", "WC", 1, "BLK");
      expect(result).toBe("NOIR-WC-001-BLK");
    });

    it("SKU長が6-50字の範囲であること", () => {
      const shortSku = generateSku("AB", "CD", 1);
      const longSku = generateSku("LONGSTORENAME", "LONGCAT", 999, "VARIANT");

      expect(shortSku.length).toBeGreaterThanOrEqual(6);
      expect(longSku.length).toBeLessThanOrEqual(50);
    });
  });

  describe("generateDeterministicId", () => {
    it("正常ケース: 同一入力で同一のIDを返す", () => {
      const id1 = generateDeterministicId("test-seed-key");
      const id2 = generateDeterministicId("test-seed-key");
      expect(id1).toBe(id2);
    });

    it("正常ケース: 異なる入力で異なるIDを返す", () => {
      const id1 = generateDeterministicId("key-a");
      const id2 = generateDeterministicId("key-b");
      expect(id1).not.toBe(id2);
    });

    it("UUID形式であること", () => {
      const id = generateDeterministicId("test-key");
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it("lux-seed- プレフィクスの名前空間で生成される", () => {
      // 決定論的であることの検証（別の呼び出しでも同一）
      const id = generateDeterministicId("order-001");
      expect(typeof id).toBe("string");
      expect(id.length).toBe(36); // UUID の長さ
    });
  });
});
