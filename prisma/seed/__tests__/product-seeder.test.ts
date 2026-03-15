import { ALL_SEED_PRODUCTS } from "../constants/products";
import { SEED_STORES } from "../constants/stores";
import { SEED_CATEGORIES, SEED_SUB_CATEGORIES } from "../constants/categories";
import { SEED_OFFER_TAGS } from "../constants/offer-tags";
import { NAME_REGEX, URL_REGEX } from "../helpers";

describe("ALL_SEED_PRODUCTS バリデーション", () => {
  it("36商品のデータが存在すること", () => {
    expect(ALL_SEED_PRODUCTS.length).toBe(36);
  });

  it("各店舗に6商品ずつ割り当てられていること", () => {
    const grouped = new Map<string, number>();
    for (const p of ALL_SEED_PRODUCTS) {
      grouped.set(p.storeUrl, (grouped.get(p.storeUrl) ?? 0) + 1);
    }
    for (const store of SEED_STORES) {
      expect(grouped.get(store.url)).toBe(6);
    }
  });

  it("全てのnameがZod制約を満たすこと（2-200字）", () => {
    for (const p of ALL_SEED_PRODUCTS) {
      expect(p.name.length).toBeGreaterThanOrEqual(2);
      expect(p.name.length).toBeLessThanOrEqual(200);
      expect(p.name).toMatch(NAME_REGEX);
    }
  });

  it("全てのdescriptionが200字以上であること", () => {
    for (const p of ALL_SEED_PRODUCTS) {
      expect(p.description.length).toBeGreaterThanOrEqual(200);
    }
  });

  it("全slugがlux-プレフィクスを持ち、一意であること", () => {
    const slugs = ALL_SEED_PRODUCTS.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const p of ALL_SEED_PRODUCTS) {
      expect(p.slug).toMatch(/^lux-/);
      expect(p.slug).toMatch(URL_REGEX);
    }
  });

  it("全storeUrlが存在するストアを参照していること", () => {
    const storeUrls = new Set(SEED_STORES.map((s) => s.url));
    for (const p of ALL_SEED_PRODUCTS) {
      expect(storeUrls.has(p.storeUrl)).toBe(true);
    }
  });

  it("全categoryUrlが存在するカテゴリを参照していること", () => {
    const catUrls = new Set(SEED_CATEGORIES.map((c) => c.url));
    for (const p of ALL_SEED_PRODUCTS) {
      expect(catUrls.has(p.categoryUrl)).toBe(true);
    }
  });

  it("全subCategoryUrlが存在するサブカテゴリを参照していること", () => {
    const subCatUrls = new Set(SEED_SUB_CATEGORIES.map((s) => s.url));
    for (const p of ALL_SEED_PRODUCTS) {
      expect(subCatUrls.has(p.subCategoryUrl)).toBe(true);
    }
  });

  it("全subCategoryUrlが対応するcategoryUrlの子であること", () => {
    const subCatMap = new Map(
      SEED_SUB_CATEGORIES.map((s) => [s.url, s.categoryUrl])
    );
    for (const p of ALL_SEED_PRODUCTS) {
      expect(subCatMap.get(p.subCategoryUrl)).toBe(p.categoryUrl);
    }
  });

  it("offerTagUrlが指定されている場合、存在するオファータグを参照していること", () => {
    const tagUrls = new Set(SEED_OFFER_TAGS.map((t) => t.url));
    for (const p of ALL_SEED_PRODUCTS) {
      if (p.offerTagUrl) {
        expect(tagUrls.has(p.offerTagUrl)).toBe(true);
      }
    }
  });

  it("全商品に最低1つのバリアントがあること", () => {
    for (const p of ALL_SEED_PRODUCTS) {
      expect(p.variants.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("全商品に最低2つのQuestionがあること", () => {
    for (const p of ALL_SEED_PRODUCTS) {
      expect(p.questions.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("バリアント バリデーション", () => {
  const allVariants = ALL_SEED_PRODUCTS.flatMap((p) =>
    p.variants.map((v) => ({ ...v, productName: p.name }))
  );

  it("全バリアントslugがlux-プレフィクスを持ち、一意であること", () => {
    const slugs = allVariants.map((v) => v.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const v of allVariants) {
      expect(v.slug).toMatch(/^lux-/);
      expect(v.slug).toMatch(URL_REGEX);
    }
  });

  it("全バリアントslugが商品slugとも重複しないこと", () => {
    const productSlugs = new Set(ALL_SEED_PRODUCTS.map((p) => p.slug));
    for (const v of allVariants) {
      expect(productSlugs.has(v.slug)).toBe(false);
    }
  });

  it("全SKUがZod制約を満たすこと（6-50字）", () => {
    for (const v of allVariants) {
      expect(v.sku.length).toBeGreaterThanOrEqual(6);
      expect(v.sku.length).toBeLessThanOrEqual(50);
    }
  });

  it("全SKUが一意であること", () => {
    const skus = allVariants.map((v) => v.sku);
    expect(new Set(skus).size).toBe(skus.length);
  });

  it("全バリアントに画像3-6枚があること", () => {
    for (const v of allVariants) {
      expect(v.images.length).toBeGreaterThanOrEqual(3);
      expect(v.images.length).toBeLessThanOrEqual(6);
    }
  });

  it("全バリアントにキーワード5-10個があること", () => {
    for (const v of allVariants) {
      expect(v.keywords.length).toBeGreaterThanOrEqual(5);
      expect(v.keywords.length).toBeLessThanOrEqual(10);
    }
  });

  it("全バリアントに最低1色があること", () => {
    for (const v of allVariants) {
      expect(v.colors.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("全バリアントに最低1サイズがあること", () => {
    for (const v of allVariants) {
      expect(v.sizes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("全サイズのpriceが0.01より大きいこと", () => {
    for (const v of allVariants) {
      for (const s of v.sizes) {
        expect(s.price).toBeGreaterThan(0.01);
      }
    }
  });

  it("全サイズのquantityが1以上であること", () => {
    for (const v of allVariants) {
      for (const s of v.sizes) {
        expect(s.quantity).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("全サイズのdiscountが0-99の範囲であること", () => {
    for (const v of allVariants) {
      for (const s of v.sizes) {
        expect(s.discount).toBeGreaterThanOrEqual(0);
        expect(s.discount).toBeLessThanOrEqual(99);
      }
    }
  });

  it("全バリアントにspecが最低1つあること", () => {
    for (const v of allVariants) {
      expect(v.specs.length).toBeGreaterThanOrEqual(1);
    }
  });
});
