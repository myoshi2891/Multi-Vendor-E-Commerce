import {
    CategoryFormSchema,
    SubCategoryFormSchema,
    StoreFormSchema,
    ProductFormSchema,
    OfferTagFormSchema,
    CouponFormSchema,
    AddReviewSchema,
    ShippingAddressSchema,
} from "./schemas";

// ==================================================
// CategoryFormSchema
// ==================================================
describe("CategoryFormSchema", () => {
    const validData = {
        name: "Electronics",
        image: [{ url: "https://example.com/img.jpg" }],
        url: "electronics",
        featured: false,
    };

    it("有効なデータでパースが成功する", () => {
        expect(() => CategoryFormSchema.parse(validData)).not.toThrow();
    });

    it("nameが2文字未満の場合エラー", () => {
        const result = CategoryFormSchema.safeParse({ ...validData, name: "A" });
        expect(result.success).toBe(false);
    });

    it("nameに特殊文字が含まれる場合エラー", () => {
        const result = CategoryFormSchema.safeParse({
            ...validData,
            name: "Electronics!@#",
        });
        expect(result.success).toBe(false);
    });

    it("imageが1枚でない場合エラー", () => {
        const result = CategoryFormSchema.safeParse({
            ...validData,
            image: [],
        });
        expect(result.success).toBe(false);
    });

    it("urlに連続ハイフンが含まれる場合エラー", () => {
        const result = CategoryFormSchema.safeParse({
            ...validData,
            url: "elec--tronics",
        });
        expect(result.success).toBe(false);
    });

    it("featuredのデフォルト値はfalse", () => {
        const { featured, ...withoutFeatured } = validData;
        const result = CategoryFormSchema.parse(withoutFeatured);
        expect(result.featured).toBe(false);
    });
});

// ==================================================
// SubCategoryFormSchema
// ==================================================
describe("SubCategoryFormSchema", () => {
    const validData = {
        name: "Smartphones",
        image: [{ url: "https://example.com/img.jpg" }],
        url: "smartphones",
        featured: false,
        categoryId: "123e4567-e89b-12d3-a456-426614174000",
    };

    it("有効なデータでパースが成功する", () => {
        expect(() => SubCategoryFormSchema.parse(validData)).not.toThrow();
    });

    it("categoryIdがUUID形式でない場合エラー", () => {
        const result = SubCategoryFormSchema.safeParse({
            ...validData,
            categoryId: "not-uuid",
        });
        expect(result.success).toBe(false);
    });
});

// ==================================================
// StoreFormSchema
// ==================================================
describe("StoreFormSchema", () => {
    const validData = {
        name: "My Store",
        description:
            "A great store description that is at least 30 characters long for validation.",
        email: "store@example.com",
        phone: "+1234567890",
        logo: [{ url: "https://example.com/logo.jpg" }],
        cover: [{ url: "https://example.com/cover.jpg" }],
        url: "my-store",
    };

    it("有効なデータでパースが成功する", () => {
        expect(() => StoreFormSchema.parse(validData)).not.toThrow();
    });

    it("descriptionが30文字未満の場合エラー", () => {
        const result = StoreFormSchema.safeParse({
            ...validData,
            description: "Short desc",
        });
        expect(result.success).toBe(false);
    });

    it("emailが無効な形式の場合エラー", () => {
        const result = StoreFormSchema.safeParse({
            ...validData,
            email: "not-email",
        });
        expect(result.success).toBe(false);
    });

    it("phoneが無効な形式の場合エラー", () => {
        const result = StoreFormSchema.safeParse({
            ...validData,
            phone: "abc-not-phone",
        });
        expect(result.success).toBe(false);
    });

    it("phoneに+プレフィックスが許可される", () => {
        const result = StoreFormSchema.safeParse({
            ...validData,
            phone: "+81901234567",
        });
        expect(result.success).toBe(true);
    });
});

// ==================================================
// ProductFormSchema
// ==================================================
describe("ProductFormSchema", () => {
    const validData = {
        name: "Test Product",
        description: "A".repeat(200),
        variantName: "Black Edition",
        images: [
            { url: "img1.jpg" },
            { url: "img2.jpg" },
            { url: "img3.jpg" },
        ],
        variantImage: [{ url: "variant.jpg" }],
        categoryId: "123e4567-e89b-12d3-a456-426614174000",
        subCategoryId: "123e4567-e89b-12d3-a456-426614174001",
        brand: "TestBrand",
        sku: "SKU123456",
        weight: 0.5,
        keywords: ["kw1", "kw2", "kw3", "kw4", "kw5"],
        colors: [{ color: "Black" }],
        sizes: [{ size: "M", quantity: 10, price: 29.99, discount: 0 }],
        product_specs: [{ name: "Material", value: "Cotton" }],
        variant_specs: [{ name: "Color Type", value: "Solid" }],
        shippingFeeMethod: "ITEM",
    };

    it("有効なデータでパースが成功する", () => {
        expect(() => ProductFormSchema.parse(validData)).not.toThrow();
    });

    it("descriptionが200文字未満の場合エラー", () => {
        const result = ProductFormSchema.safeParse({
            ...validData,
            description: "A".repeat(199),
        });
        expect(result.success).toBe(false);
    });

    it("imagesが3枚未満の場合エラー", () => {
        const result = ProductFormSchema.safeParse({
            ...validData,
            images: [{ url: "img1.jpg" }, { url: "img2.jpg" }],
        });
        expect(result.success).toBe(false);
    });

    it("imagesが6枚を超える場合エラー", () => {
        const result = ProductFormSchema.safeParse({
            ...validData,
            images: Array(7)
                .fill(null)
                .map((_, i) => ({ url: `img${i}.jpg` })),
        });
        expect(result.success).toBe(false);
    });

    it("keywordsが5個未満の場合エラー", () => {
        const result = ProductFormSchema.safeParse({
            ...validData,
            keywords: ["kw1", "kw2", "kw3", "kw4"],
        });
        expect(result.success).toBe(false);
    });

    it("keywordsが10個を超える場合エラー", () => {
        const result = ProductFormSchema.safeParse({
            ...validData,
            keywords: Array(11)
                .fill(null)
                .map((_, i) => `kw${i}`),
        });
        expect(result.success).toBe(false);
    });

    it("sizesが空配列の場合エラー", () => {
        const result = ProductFormSchema.safeParse({
            ...validData,
            sizes: [],
        });
        expect(result.success).toBe(false);
    });

    it("colorsが空配列の場合エラー", () => {
        const result = ProductFormSchema.safeParse({
            ...validData,
            colors: [],
        });
        expect(result.success).toBe(false);
    });

    it("weightが0.01未満の場合エラー", () => {
        const result = ProductFormSchema.safeParse({
            ...validData,
            weight: 0,
        });
        expect(result.success).toBe(false);
    });

    it("priceが0以下の場合エラー", () => {
        const result = ProductFormSchema.safeParse({
            ...validData,
            sizes: [{ size: "M", quantity: 10, price: 0, discount: 0 }],
        });
        expect(result.success).toBe(false);
    });
});

// ==================================================
// OfferTagFormSchema
// ==================================================
describe("OfferTagFormSchema", () => {
    it("有効なデータでパースが成功する", () => {
        expect(() =>
            OfferTagFormSchema.parse({
                name: "Summer Sale 50%",
                url: "summer-sale",
            })
        ).not.toThrow();
    });

    it("nameに&$%等の特殊文字が許可される", () => {
        const result = OfferTagFormSchema.safeParse({
            name: "50% Off & More",
            url: "sale",
        });
        expect(result.success).toBe(true);
    });

    it("nameが2文字未満の場合エラー", () => {
        const result = OfferTagFormSchema.safeParse({
            name: "A",
            url: "sale",
        });
        expect(result.success).toBe(false);
    });
});

// ==================================================
// CouponFormSchema
// ==================================================
describe("CouponFormSchema", () => {
    const validData = {
        code: "SUMMER2024",
        startDate: "2024-06-01",
        endDate: "2024-06-30",
        discount: 20,
    };

    it("有効なデータでパースが成功する", () => {
        expect(() => CouponFormSchema.parse(validData)).not.toThrow();
    });

    it("codeが英数字以外を含む場合エラー", () => {
        const result = CouponFormSchema.safeParse({
            ...validData,
            code: "SUMMER-2024",
        });
        expect(result.success).toBe(false);
    });

    it("discountが1未満の場合エラー", () => {
        const result = CouponFormSchema.safeParse({
            ...validData,
            discount: 0,
        });
        expect(result.success).toBe(false);
    });

    it("discountが99を超える場合エラー", () => {
        const result = CouponFormSchema.safeParse({
            ...validData,
            discount: 100,
        });
        expect(result.success).toBe(false);
    });
});

// ==================================================
// AddReviewSchema
// ==================================================
describe("AddReviewSchema", () => {
    const validData = {
        variantName: "Black",
        rating: 5,
        size: "M",
        review: "This is a great product, highly recommend it!",
        quantity: "1",
        images: [{ url: "https://example.com/review.jpg" }],
        color: "Black",
    };

    it("有効なデータでパースが成功する", () => {
        expect(() => AddReviewSchema.parse(validData)).not.toThrow();
    });

    it("ratingが1未満の場合エラー", () => {
        const result = AddReviewSchema.safeParse({
            ...validData,
            rating: 0,
        });
        expect(result.success).toBe(false);
    });

    it("reviewが10文字未満の場合エラー", () => {
        const result = AddReviewSchema.safeParse({
            ...validData,
            review: "Short",
        });
        expect(result.success).toBe(false);
    });

    it("imagesが3枚を超える場合エラー", () => {
        const result = AddReviewSchema.safeParse({
            ...validData,
            images: Array(4)
                .fill(null)
                .map((_, i) => ({ url: `img${i}.jpg` })),
        });
        expect(result.success).toBe(false);
    });

    it("imagesが0枚は許可される", () => {
        const result = AddReviewSchema.safeParse({
            ...validData,
            images: [],
        });
        expect(result.success).toBe(true);
    });
});

// ==================================================
// ShippingAddressSchema
// ==================================================
describe("ShippingAddressSchema", () => {
    const validData = {
        countryId: "123e4567-e89b-12d3-a456-426614174000",
        firstName: "John",
        lastName: "Smith",
        phone: "+1234567890",
        address1: "123 Main Street",
        state: "California",
        city: "Los Angeles",
        zip_code: "90001",
    };

    it("有効なデータでパースが成功する", () => {
        expect(() => ShippingAddressSchema.parse(validData)).not.toThrow();
    });

    it("firstNameに数字が含まれる場合エラー", () => {
        const result = ShippingAddressSchema.safeParse({
            ...validData,
            firstName: "John123",
        });
        expect(result.success).toBe(false);
    });

    it("lastNameに数字が含まれる場合エラー", () => {
        const result = ShippingAddressSchema.safeParse({
            ...validData,
            lastName: "Smith456",
        });
        expect(result.success).toBe(false);
    });

    it("phoneの最大15桁が許可される", () => {
        const result = ShippingAddressSchema.safeParse({
            ...validData,
            phone: "+123456789012345",
        });
        expect(result.success).toBe(true);
    });

    it("phoneが16桁の場合エラー", () => {
        const result = ShippingAddressSchema.safeParse({
            ...validData,
            phone: "+1234567890123456",
        });
        expect(result.success).toBe(false);
    });

    it("address1が5文字未満の場合エラー", () => {
        const result = ShippingAddressSchema.safeParse({
            ...validData,
            address1: "123",
        });
        expect(result.success).toBe(false);
    });

    it("address2はオプショナル", () => {
        const result = ShippingAddressSchema.safeParse(validData);
        expect(result.success).toBe(true);
    });

    it("countryIdがUUID形式でない場合エラー", () => {
        const result = ShippingAddressSchema.safeParse({
            ...validData,
            countryId: "not-uuid",
        });
        expect(result.success).toBe(false);
    });

    it("defaultのデフォルト値はfalse", () => {
        const result = ShippingAddressSchema.parse(validData);
        expect(result.default).toBe(false);
    });
});
