import {
    cn,
    getGridClassName,
    getShippingDatesRange,
    isProductValidToAdd,
    censorName,
    getTimeUntil,
    getStockStatus,
    normalizePositiveIntParam,
    normalizePageParam,
    MAX_PAGE,
} from "./utils";
import { createMockCartProduct } from "@/config/test-fixtures";

// ==================================================
// cn
// ==================================================
describe("cn", () => {
    it("[P2] 単一クラス名を返す", () => {
        expect(cn("px-4")).toBe("px-4");
    });

    it("[P2] 複数クラス名をマージする", () => {
        expect(cn("px-4", "py-2")).toBe("px-4 py-2");
    });

    it("[P2] Tailwind 競合を解決する ('p-2 p-4' → 'p-4')", () => {
        expect(cn("p-2", "p-4")).toBe("p-4");
        expect(cn("px-2 py-1", "p-4")).toBe("p-4");
    });

    it("[P2] 条件付きクラス名を処理する (clsx 形式)", () => {
        expect(cn("p-4", { "bg-red-500": true, "bg-blue-500": false })).toBe(
            "p-4 bg-red-500"
        );
    });

    it("[P2] undefined/null/false を無視する", () => {
        expect(cn("p-4", undefined, null, false, "flex")).toBe("p-4 flex");
    });

    it("[P2] 引数なしで空文字を返す", () => {
        expect(cn()).toBe("");
    });
});

// 共有ファクトリを再利用し、テスト固有のデフォルト値を適用
const createValidCartProduct = (
    overrides: Parameters<typeof createMockCartProduct>[0] = {}
) =>
    createMockCartProduct({
        quantity: 1,
        stock: 10,
        shippingService: "Standard",
        deliveryTimeMax: 7,
        ...overrides,
    });

// ==================================================
// normalizePositiveIntParam
// ==================================================
describe("normalizePositiveIntParam", () => {
    it.each([
        ["3", 3],
        ["1", 1],
        [3, 3],
    ])("正の整数 %p はそのまま %i を返す", (raw, expected) => {
        // Arrange / Act
        const actual = normalizePositiveIntParam(raw);

        // Assert
        expect(actual).toBe(expected);
    });

    it.each([
        ["未定義", undefined],
        ["空文字", ""],
        ["非数値", "abc"],
        ["ゼロ", "0"],
        ["負値", "-5"],
        ["1 未満の小数", "0.9"],
        ["NaN", NaN],
        ["Infinity", Infinity],
        ["-Infinity", -Infinity],
        ["null", null],
    ])("%s (%p) は fallback へ落ちる", (_label, raw) => {
        // Arrange / Act / Assert
        expect(normalizePositiveIntParam(raw)).toBe(1);
    });

    it("小数は切り捨てる（1.9 → 1）", () => {
        expect(normalizePositiveIntParam("1.9")).toBe(1);
        expect(normalizePositiveIntParam("2.9")).toBe(2);
    });

    it("配列は先頭要素を採る（?page=2&page=5 → 2）", () => {
        expect(normalizePositiveIntParam(["2", "5"])).toBe(2);
    });

    it("fallback を指定するとその値へ落ちる", () => {
        expect(normalizePositiveIntParam("abc", { fallback: 20 })).toBe(20);
    });

    it("max 指定時は上限でクランプする", () => {
        expect(normalizePositiveIntParam("500", { max: 50 })).toBe(50);
        expect(normalizePositiveIntParam("10", { max: 50 })).toBe(10);
    });

    it("max: 0 は falsy でも上限として機能する", () => {
        // `max ? ... : ...` 実装だと 0 が無視されて 1 が返ってしまう回帰ガード
        expect(normalizePositiveIntParam("5", { max: 0 })).toBe(0);
    });

    it("max 未指定なら上限クランプしない", () => {
        expect(normalizePositiveIntParam("999999")).toBe(999999);
    });
});

// ==================================================
// normalizePageParam
// ==================================================
describe("normalizePageParam", () => {
    it("正常なページ番号はそのまま返す", () => {
        expect(normalizePageParam("3")).toBe(3);
    });

    it.each([undefined, "abc", "0", "-1", Infinity, NaN])(
        "不正な値 %p は 1 ページ目へフォールバックする",
        (raw) => {
            expect(normalizePageParam(raw)).toBe(1);
        }
    );

    it("MAX_PAGE を超える値はクランプする（skip 暴走の防止）", () => {
        // Number.isSafeInteger でも通過してしまう 1e15 と、通過しない 1e21 の両方を確認
        expect(normalizePageParam("1e15")).toBe(MAX_PAGE);
        expect(normalizePageParam("1e21")).toBe(MAX_PAGE);
        expect(normalizePageParam(String(Number.MAX_SAFE_INTEGER))).toBe(
            MAX_PAGE
        );
    });

    it("max を明示指定すればその上限が優先される", () => {
        expect(normalizePageParam("500", 100)).toBe(100);
    });
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
    // 時刻を固定してフレイキーテストを防止
    const FIXED_NOW = new Date("2025-06-15T12:00:00Z");

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(FIXED_NOW);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("過去の日時の場合 { days: 0, hours: 0 } を返す", () => {
        expect(getTimeUntil("2025-06-14T12:00:00Z")).toEqual({
            days: 0,
            hours: 0,
        });
    });

    it("現在時刻と同じ場合 { days: 0, hours: 0 } を返す", () => {
        expect(getTimeUntil("2025-06-15T12:00:00Z")).toEqual({
            days: 0,
            hours: 0,
        });
    });

    it("未来の日時の場合、日数と時間を返す", () => {
        // 2日12時間後 = 2025-06-18T00:00:00Z
        const result = getTimeUntil("2025-06-18T00:00:00Z");
        expect(result.days).toBe(2);
        expect(result.hours).toBe(12);
    });

    it("hoursは24時間未満（余り）を返す", () => {
        // 3日5時間後 = 2025-06-18T17:00:00Z
        const result = getTimeUntil("2025-06-18T17:00:00Z");
        expect(result.days).toBe(3);
        expect(result.hours).toBe(5);
    });
});

// ==================================================
// getStockStatus（AC-F2-5 在庫ステータス境界）
// ==================================================
describe("getStockStatus", () => {
    const THRESHOLD = 5;

    it("[AC-F2-5] quantity=0 は 'out'（在庫切れ）", () => {
        expect(getStockStatus(0, THRESHOLD)).toBe("out");
    });

    it("[AC-F2-5] quantity=threshold は 'low'（過小在庫の上限）", () => {
        expect(getStockStatus(THRESHOLD, THRESHOLD)).toBe("low");
    });

    it("[AC-F2-5] quantity=threshold+1 は 'ok'（十分）", () => {
        expect(getStockStatus(THRESHOLD + 1, THRESHOLD)).toBe("ok");
    });

    it("0 < quantity < threshold は 'low'", () => {
        expect(getStockStatus(1, THRESHOLD)).toBe("low");
        expect(getStockStatus(THRESHOLD - 1, THRESHOLD)).toBe("low");
    });

    it("負の在庫数は 'out'（在庫切れ優先）", () => {
        expect(getStockStatus(-1, THRESHOLD)).toBe("out");
    });

    it("threshold=0 のとき quantity=0 は 'low' ではなく 'out'", () => {
        // 在庫切れ判定が過小在庫判定より優先される
        expect(getStockStatus(0, 0)).toBe("out");
        expect(getStockStatus(1, 0)).toBe("ok");
    });
});
