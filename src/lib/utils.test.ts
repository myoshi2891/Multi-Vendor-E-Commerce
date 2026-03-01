import {
    getGridClassName,
    getShippingDatesRange,
    isProductValidToAdd,
    censorName,
    getTimeUntil,
} from "./utils";
import { CartProductType } from "./types";

// テスト用カート商品データ
const createValidCartProduct = (
    overrides: Partial<CartProductType> = {}
): CartProductType => ({
    productId: "product-001",
    variantId: "variant-001",
    productSlug: "test-product",
    variantSlug: "test-variant",
    name: "Test Product",
    variantName: "Black",
    image: "https://example.com/img.jpg",
    variantImage: "https://example.com/variant.jpg",
    sizeId: "size-001",
    size: "M",
    quantity: 1,
    price: 29.99,
    stock: 10,
    weight: 0.5,
    shippingMethod: "ITEM",
    shippingService: "Standard",
    shippingFee: 5.0,
    extraShippingFee: 2.0,
    deliveryTimeMin: 3,
    deliveryTimeMax: 7,
    isFreeShipping: false,
    ...overrides,
});

// ==================================================
// getGridClassName
// ==================================================
describe("getGridClassName", () => {
    it.each([
        [2, "grid-cols-2"],
        [3, "grid-cols-2 grid-rows-2"],
        [4, "grid-cols-2 grid-rows-1"],
        [5, "grid-cols-2 grid-rows-6"],
        [6, "grid-cols-2"],
    ])("length=%i の場合 '%s' を返す", (length, expected) => {
        expect(getGridClassName(length)).toBe(expected);
    });

    it("未定義のlengthの場合空文字を返す", () => {
        expect(getGridClassName(1)).toBe("");
        expect(getGridClassName(0)).toBe("");
        expect(getGridClassName(7)).toBe("");
    });
});

// ==================================================
// getShippingDatesRange
// ==================================================
describe("getShippingDatesRange", () => {
    const baseDate = new Date("2024-06-15");

    it("指定日数を加算した配送日範囲を返す", () => {
        const result = getShippingDatesRange(3, 7, baseDate);

        expect(result.minDate).toBe(new Date("2024-06-18").toDateString());
        expect(result.maxDate).toBe(new Date("2024-06-22").toDateString());
    });

    it("月末を跨ぐ場合に正しく計算する", () => {
        const endOfMonth = new Date("2024-06-28");
        const result = getShippingDatesRange(5, 10, endOfMonth);

        expect(result.minDate).toBe(new Date("2024-07-03").toDateString());
        expect(result.maxDate).toBe(new Date("2024-07-08").toDateString());
    });

    it("年末を跨ぐ場合に正しく計算する", () => {
        const endOfYear = new Date("2024-12-28");
        const result = getShippingDatesRange(5, 10, endOfYear);

        expect(result.minDate).toBe(new Date("2025-01-02").toDateString());
        expect(result.maxDate).toBe(new Date("2025-01-07").toDateString());
    });

    it("minDays=0の場合、当日が最小日になる", () => {
        const result = getShippingDatesRange(0, 3, baseDate);

        expect(result.minDate).toBe(baseDate.toDateString());
    });

    it("toDateString形式で返す", () => {
        const result = getShippingDatesRange(1, 2, baseDate);

        // toDateString()は 'Mon Jun 16 2024' 形式
        expect(result.minDate).toMatch(/^\w{3} \w{3} \d{2} \d{4}$/);
        expect(result.maxDate).toMatch(/^\w{3} \w{3} \d{2} \d{4}$/);
    });
});

// ==================================================
// isProductValidToAdd
// ==================================================
describe("isProductValidToAdd", () => {
    it("有効な商品データの場合trueを返す", () => {
        expect(isProductValidToAdd(createValidCartProduct())).toBe(true);
    });

    describe("必須文字列フィールドが空の場合falseを返す", () => {
        const stringFields = [
            "productId",
            "variantId",
            "productSlug",
            "variantSlug",
            "name",
            "variantName",
            "image",
            "variantImage",
            "sizeId",
            "size",
            "shippingMethod",
        ] as const;

        stringFields.forEach((field) => {
            it(`${field}が空の場合falseを返す`, () => {
                expect(
                    isProductValidToAdd(createValidCartProduct({ [field]: "" }))
                ).toBe(false);
            });
        });
    });

    describe("数値バリデーション", () => {
        it("quantity <= 0 の場合falseを返す", () => {
            expect(
                isProductValidToAdd(createValidCartProduct({ quantity: 0 }))
            ).toBe(false);
            expect(
                isProductValidToAdd(createValidCartProduct({ quantity: -1 }))
            ).toBe(false);
        });

        it("price <= 0 の場合falseを返す", () => {
            expect(
                isProductValidToAdd(createValidCartProduct({ price: 0 }))
            ).toBe(false);
        });

        it("stock <= 0 の場合falseを返す", () => {
            expect(
                isProductValidToAdd(createValidCartProduct({ stock: 0 }))
            ).toBe(false);
        });

        it("weight <= 0 の場合falseを返す", () => {
            expect(
                isProductValidToAdd(createValidCartProduct({ weight: 0 }))
            ).toBe(false);
        });

        it("shippingFee < 0 の場合falseを返す", () => {
            expect(
                isProductValidToAdd(createValidCartProduct({ shippingFee: -1 }))
            ).toBe(false);
        });

        it("shippingFee = 0 は許可される", () => {
            expect(
                isProductValidToAdd(createValidCartProduct({ shippingFee: 0 }))
            ).toBe(true);
        });

        it("deliveryTimeMin < 0 の場合falseを返す", () => {
            expect(
                isProductValidToAdd(
                    createValidCartProduct({ deliveryTimeMin: -1 })
                )
            ).toBe(false);
        });

        it("deliveryTimeMax < deliveryTimeMin の場合falseを返す", () => {
            expect(
                isProductValidToAdd(
                    createValidCartProduct({
                        deliveryTimeMin: 5,
                        deliveryTimeMax: 3,
                    })
                )
            ).toBe(false);
        });

        it("deliveryTimeMin = deliveryTimeMax は許可される", () => {
            expect(
                isProductValidToAdd(
                    createValidCartProduct({
                        deliveryTimeMin: 5,
                        deliveryTimeMax: 5,
                    })
                )
            ).toBe(true);
        });
    });
});

// ==================================================
// censorName
// ==================================================
describe("censorName", () => {
    it("名前の中央部分をマスクする", () => {
        const result = censorName("Taro", "Yamada");

        expect(result.firstName).toBe("T**o");
        expect(result.lastName).toBe("Y****a");
    });

    it("2文字以下の名前はそのまま返す", () => {
        const result = censorName("AB", "CD");

        expect(result.firstName).toBe("AB");
        expect(result.lastName).toBe("CD");
    });

    it("fullNameは先頭1文字 + *** + 末尾1文字の形式", () => {
        const result = censorName("John", "Smith");

        expect(result.fullName).toBe("J***h");
    });

    it("3文字の名前は中央1文字のみマスクされる", () => {
        const result = censorName("Tom", "Lee");

        expect(result.firstName).toBe("T*m");
        expect(result.lastName).toBe("L*e");
    });
});

// ==================================================
// getTimeUntil
// ==================================================
describe("getTimeUntil", () => {
    it("過去の日時の場合 { days: 0, hours: 0 } を返す", () => {
        const pastDate = new Date(Date.now() - 86400000).toISOString();

        expect(getTimeUntil(pastDate)).toEqual({ days: 0, hours: 0 });
    });

    it("現在時刻と同じ場合 { days: 0, hours: 0 } を返す", () => {
        // Dateのコンストラクタが呼ばれるタイミングの差でtarget <= nowになる
        const now = new Date().toISOString();

        const result = getTimeUntil(now);
        expect(result.days).toBe(0);
        expect(result.hours).toBe(0);
    });

    it("未来の日時の場合、日数と時間を返す", () => {
        // 2日と12時間後
        const futureDate = new Date(
            Date.now() + 2 * 86400000 + 12 * 3600000
        ).toISOString();

        const result = getTimeUntil(futureDate);
        expect(result.days).toBe(2);
        expect(result.hours).toBe(12);
    });

    it("hoursは24時間未満（余り）を返す", () => {
        // 3日と5時間後
        const futureDate = new Date(
            Date.now() + 3 * 86400000 + 5 * 3600000
        ).toISOString();

        const result = getTimeUntil(futureDate);
        expect(result.days).toBe(3);
        expect(result.hours).toBe(5);
    });
});
