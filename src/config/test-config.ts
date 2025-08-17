export const TEST_CONFIG = {
    DEFAULT_USER_ID: "user123",
    DEFAULT_STORE_ID: "store123",
    DEFAULT_SHIPPING_SERVICE: "International Delivery",
    DEFAULT_RETURN_POLICY: "Return in 30 days.",

    // 追加推奨設定
    TEST_STORE_URL: "test-store",
    TEST_EMAIL: "test@example.com",
    TEST_PHONE: "1234567890",
    ERROR_MESSAGES: {
        DATABASE_ERROR: "Database connection failed",
        VALIDATION_ERROR: "Validation failed",
    },
    MOCK_DELAYS: {
        DB_OPERATION: 100, // ミリ秒
        NETWORK_REQUEST: 200,
    },
    PERFORMANCE_THRESHOLDS: {
        DB_QUERY_MAX_TIME: 100, // ミリ秒
        API_RESPONSE_MAX_TIME: 500,
    }, // TEST_CONFIG に追加
    EDGE_CASES: {
        VERY_LONG_STRING: "a".repeat(1000),
        SPECIAL_CHARACTERS: "!@#$%^&*()[]{}|;':\",./<>?",
        UNICODE_STRING: "テスト用文字列🚀",
    },
} as const;

