/**
 * テストシナリオデータ
 * 複雑なビジネスルール検証用のパターンデータ
 */

// ---- 注文ステータス遷移パターン ----
export const ORDER_STATUS_TRANSITIONS = {
    // 有効な遷移: [現在のステータス, 遷移先ステータス]
    valid: [
        ["Pending", "Confirmed"],
        ["Pending", "Processing"],
        ["Pending", "Canceled"],
        ["Confirmed", "Processing"],
        ["Processing", "Shipped"],
        ["Processing", "PartiallyShipped"],
        ["Shipped", "OutForDelivery"],
        ["Shipped", "Delivered"],
        ["OutForDelivery", "Delivered"],
    ] as const,

    // 無効な遷移（ビジネスルール違反）
    invalid: [
        ["Pending", "Delivered"],
        ["Pending", "Shipped"],
        ["Canceled", "Processing"],
        ["Canceled", "Shipped"],
        ["Delivered", "Pending"],
        ["Refunded", "Shipped"],
        ["Refunded", "Delivered"],
    ] as const,

    // 終端ステータス（これ以上遷移不可）
    terminal: ["Delivered", "Canceled", "Refunded", "Failed"] as const,
};

// ---- クーポン検証シナリオ ----
// 相対日付を使用し、時間経過でテストが破綻しないようにする
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const now = Date.now();

export const COUPON_SCENARIOS = {
    // 期限切れパターン（1〜2年前）
    expired: {
        startDate: new Date(now - 2 * ONE_YEAR_MS),
        endDate: new Date(now - ONE_YEAR_MS),
    },

    // 有効期間内パターン（1年前〜1年後）
    active: {
        startDate: new Date(now - ONE_YEAR_MS),
        endDate: new Date(now + ONE_YEAR_MS),
    },

    // 開始前パターン（1〜2年後）
    notStarted: {
        startDate: new Date(now + ONE_YEAR_MS),
        endDate: new Date(now + 2 * ONE_YEAR_MS),
    },

    // 割引率パターン
    discountRates: [
        { discount: 1, description: "最小割引率 1%" },
        { discount: 10, description: "通常割引率 10%" },
        { discount: 50, description: "半額割引率 50%" },
        { discount: 99, description: "最大割引率 99%" },
    ] as const,
};

// ---- 価格計算境界値 ----
export const PRICE_BOUNDARIES = {
    // 正常値
    validPrices: [0.01, 1.0, 9.99, 29.99, 99.99, 999.99, 9999.99] as const,

    // 境界値
    edgeCases: [
        { price: 0, discount: 0, expected: 0 },
        { price: 0.01, discount: 0, expected: 0.01 },
        { price: 100, discount: 50, expected: 50 },
        { price: 100, discount: 99, expected: 1 },
        { price: 100, discount: 100, expected: 0 },
    ] as const,

    // 配送料計算
    shippingFee: {
        ITEM: {
            feePerItem: 5.0,
            feeForAdditional: 2.0,
            cases: [
                { quantity: 1, expected: 5.0 },
                { quantity: 2, expected: 7.0 },
                { quantity: 5, expected: 13.0 },
            ],
        },
        WEIGHT: {
            feePerKg: 3.0,
            cases: [
                { weight: 0.5, quantity: 1, expected: 1.5 },
                { weight: 1.0, quantity: 2, expected: 6.0 },
                { weight: 2.5, quantity: 1, expected: 7.5 },
            ],
        },
        FIXED: {
            fixedFee: 15.0,
            cases: [
                { quantity: 1, expected: 15.0 },
                { quantity: 5, expected: 15.0 },
            ],
        },
    },
};

// ---- 在庫境界値 ----
export const STOCK_BOUNDARIES = {
    // 在庫0: 購入不可
    outOfStock: { quantity: 0 },
    // 在庫1: 境界値
    lastOne: { quantity: 1 },
    // 通常在庫
    normalStock: { quantity: 50 },
    // 大量在庫
    largeStock: { quantity: 10000 },
};

// ---- 無効な入力パターン ----
export const INVALID_INPUTS = {
    nullish: [
        { input: null, description: "null" },
        { input: undefined, description: "undefined" },
    ] as const,

    emptyStrings: [
        { input: "", description: "空文字列" },
        { input: "   ", description: "空白文字のみ" },
    ] as const,

    invalidIds: [
        { input: "", description: "空のID" },
        { input: "invalid-uuid", description: "無効なUUID" },
    ] as const,
};
