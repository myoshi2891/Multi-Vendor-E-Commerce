import {
    getPlatformReturnWindowDays,
    getReturnDeadline,
    isReturnEligible,
    resolveReturnWindowDays,
} from "./returns-policy";
import { ProductStatus } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("getPlatformReturnWindowDays", () => {
    const original = process.env.RETURN_WINDOW_DAYS_DEFAULT;

    afterEach(() => {
        if (original === undefined)
            delete process.env.RETURN_WINDOW_DAYS_DEFAULT;
        else process.env.RETURN_WINDOW_DAYS_DEFAULT = original;
    });

    it.each([
        ["未設定", undefined],
        ["空文字", ""],
        ["空白のみ", "   "],
    ])("%s なら 30 日", (_label, value) => {
        // Arrange
        if (value === undefined) delete process.env.RETURN_WINDOW_DAYS_DEFAULT;
        else process.env.RETURN_WINDOW_DAYS_DEFAULT = value;

        // Act & Assert
        expect(getPlatformReturnWindowDays()).toBe(30);
    });

    it("前後の空白を除いた整数を使う", () => {
        // Arrange
        process.env.RETURN_WINDOW_DAYS_DEFAULT = " 14 ";

        // Act & Assert
        expect(getPlatformReturnWindowDays()).toBe(14);
    });

    it.each([["abc"], ["-1"], ["1.5"], ["Infinity"]])(
        "不正な値（%s）なら throw する",
        (value) => {
            // Arrange
            process.env.RETURN_WINDOW_DAYS_DEFAULT = value;

            // Act & Assert
            expect(() => getPlatformReturnWindowDays()).toThrow(
                "Invalid RETURN_WINDOW_DAYS_DEFAULT"
            );
        }
    );
});

describe("resolveReturnWindowDays", () => {
    it("店舗の上書きがあればそれを使う（0 日も上書きとして扱う）", () => {
        expect(resolveReturnWindowDays({ returnWindowDays: 7 })).toBe(7);
        expect(resolveReturnWindowDays({ returnWindowDays: 0 })).toBe(0);
    });

    it("上書きが無い・店舗が無いならプラットフォームの既定値", () => {
        delete process.env.RETURN_WINDOW_DAYS_DEFAULT;
        expect(resolveReturnWindowDays({ returnWindowDays: null })).toBe(30);
        expect(resolveReturnWindowDays(null)).toBe(30);
    });
});

describe("isReturnEligible", () => {
    const orderCreatedAt = new Date("2026-01-01T00:00:00Z");
    const base = {
        itemStatus: ProductStatus.Delivered,
        orderCreatedAt,
        shippingDeliveryMax: 14,
        acceptsReturns: true,
        returnWindowDays: 30,
    };

    it("期限 = 注文日 + 配達予定日数の上限 + 返品日数", () => {
        expect(getReturnDeadline(base).getTime()).toBe(
            orderCreatedAt.getTime() + 44 * DAY_MS
        );
    });

    it("期限ちょうどまでは適格、1 ms 過ぎたら不適格", () => {
        const deadline = getReturnDeadline(base);
        expect(isReturnEligible(base, deadline)).toBe(true);
        expect(isReturnEligible(base, new Date(deadline.getTime() + 1))).toBe(
            false
        );
    });

    it("Delivered 以外の item は不適格", () => {
        expect(
            isReturnEligible(
                { ...base, itemStatus: ProductStatus.Shipped },
                orderCreatedAt
            )
        ).toBe(false);
    });

    it("店舗が返品を受け付けていなければ不適格", () => {
        expect(
            isReturnEligible({ ...base, acceptsReturns: false }, orderCreatedAt)
        ).toBe(false);
    });
});
