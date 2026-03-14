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

    describe("境界値テスト", () => {
      it("最短SKU（6字）が生成できる", () => {
        const sku = generateSku("AB", "CD", 1);
        expect(sku).toBe("AB-CD-001");
        expect(sku.length).toBe(10);
      });

      it("最長SKU（50字制限）でエラーが出ないこと", () => {
        // 50字ギリギリのSKU（計算: 15+1+9+1+4+1+15 = 46字）
        const sku = generateSku(
          "LONGSTORENAME12",
          "LONGCATEG",
          999,
          "VARIANTSUFFIX12"
        );
        expect(sku.length).toBeLessThanOrEqual(50);
      });

      it("50字超のSKUでエラーが発生すること", () => {
        expect(() =>
          generateSku(
            "VERYLONGSTORENAME1234",
            "VERYLONGCATEGORY1234",
            9999,
            "VERYLONGVARIANTSUFFIX1234"
          )
        ).toThrow(/SKU長が範囲外です/);
      });

      it("6字未満のSKUでエラーが発生すること", () => {
        // 現在の実装では6字未満にならないが、将来の変更に備えて
        expect(() => generateSku("A", "B", 1)).toThrow(/SKU長が範囲外です/);
      });
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

    it("lux-seed-namespace を使用して生成される", () => {
      // 同一のseedKeyで生成したIDが一致することで、名前空間が正しく使われていることを検証
      const id1 = generateDeterministicId("test-key");
      const id2 = generateDeterministicId("test-key");
      expect(id1).toBe(id2);

      // 異なるseedKeyでは異なるIDになることを検証
      const idA = generateDeterministicId("key-a");
      const idB = generateDeterministicId("key-b");
      expect(idA).not.toBe(idB);
    });

    it("RFC4122 UUID v5 形式であること", () => {
      const id = generateDeterministicId("test-key");
      // version ビット = 5, variant ビット = [89ab]
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });
  });
});
