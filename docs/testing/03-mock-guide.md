# モック作成ガイド

このドキュメントでは、テストで使用するモックの作成方法を説明します。

---

## 1. データベース（Prisma）モック

### 1.1 基本セットアップ

```typescript
// テストファイルの先頭でモック設定
jest.mock("@/lib/db", () => ({
    db: {
        store: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            upsert: jest.fn(),
            count: jest.fn(),
        },
        product: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        user: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        order: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        cart: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        coupon: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        review: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            aggregate: jest.fn(),
            count: jest.fn(),
        },
        size: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            count: jest.fn(),
        },
        // 他のモデル...
    },
}));
```

### 1.2 モック値の設定

```typescript
// テスト内でモックの戻り値を設定
const mockDb = require("@/lib/db").db;

// 成功ケース
mockDb.store.findUnique.mockResolvedValue({
    id: "store123",
    name: "Test Store",
    url: "test-store",
});

// 失敗ケース（エラー）
mockDb.store.findUnique.mockRejectedValue(
    new Error("Database connection failed")
);

// 存在しない場合
mockDb.store.findUnique.mockResolvedValue(null);

// 複数回の呼び出しで異なる値を返す
mockDb.store.findFirst
    .mockResolvedValueOnce(null) // 1回目の呼び出し
    .mockResolvedValueOnce({ id: "123" }); // 2回目の呼び出し
```

### 1.3 モック呼び出しの検証

```typescript
// 呼び出し回数の検証
expect(mockDb.store.create).toHaveBeenCalledTimes(1);

// 引数の検証
expect(mockDb.store.create).toHaveBeenCalledWith({
    data: {
        name: "Test Store",
        email: "test@example.com",
        userId: "user123",
    },
});

// 部分一致での引数検証
expect(mockDb.store.create).toHaveBeenCalledWith(
    expect.objectContaining({
        data: expect.objectContaining({
            name: "Test Store",
        }),
    })
);

// 呼び出されていないことの検証
expect(mockDb.store.delete).not.toHaveBeenCalled();
```

### 1.4 複雑なクエリのモック

```typescript
// include/select を使用したクエリ
mockDb.product.findMany.mockResolvedValue([
    {
        id: "prod1",
        name: "Product 1",
        variants: [
            {
                id: "var1",
                sizes: [{ id: "size1", size: "M", quantity: 10 }],
            },
        ],
        store: {
            id: "store1",
            name: "Store 1",
        },
    },
]);

// aggregate のモック
mockDb.review.aggregate.mockResolvedValue({
    _avg: { rating: 4.5 },
    _count: { rating: 100 },
});
```

---

## 2. Clerk認証モック

### 2.1 基本セットアップ

```typescript
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
    clerkClient: {
        users: {
            updateUserMetadata: jest.fn(),
        },
    },
}));

import { currentUser, clerkClient } from "@clerk/nextjs/server";
```

### 2.2 認証済みユーザーのモック

```typescript
// 一般ユーザー
(currentUser as jest.Mock).mockResolvedValue({
    id: "user_123",
    firstName: "Test",
    lastName: "User",
    emailAddresses: [{ emailAddress: "test@example.com" }],
    imageUrl: "https://example.com/avatar.png",
    privateMetadata: { role: "USER" },
});

// SELLERユーザー
(currentUser as jest.Mock).mockResolvedValue({
    id: "seller_123",
    firstName: "Seller",
    lastName: "User",
    emailAddresses: [{ emailAddress: "seller@example.com" }],
    privateMetadata: { role: "SELLER" },
});

// ADMINユーザー
(currentUser as jest.Mock).mockResolvedValue({
    id: "admin_123",
    firstName: "Admin",
    lastName: "User",
    emailAddresses: [{ emailAddress: "admin@example.com" }],
    privateMetadata: { role: "ADMIN" },
});
```

### 2.3 未認証ユーザーのモック

```typescript
(currentUser as jest.Mock).mockResolvedValue(null);
```

### 2.4 Clerkクライアントのモック

```typescript
// メタデータ更新のモック
(clerkClient.users.updateUserMetadata as jest.Mock).mockResolvedValue({
    id: "user_123",
    privateMetadata: { role: "SELLER" },
});
```

---

## 3. 外部API モック

### 3.1 PayPal API

```typescript
// グローバルfetchのモック
const mockPayPalResponse = {
    id: "PAYPAL-ORDER-123",
    status: "COMPLETED",
    purchase_units: [
        {
            payments: {
                captures: [
                    {
                        id: "CAPTURE-123",
                        amount: {
                            value: "100.00",
                            currency_code: "USD",
                        },
                    },
                ],
            },
        },
    ],
};

global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => mockPayPalResponse,
});

// エラーケース
global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => ({ error: "Internal Server Error" }),
});
```

### 3.2 Stripe API

```typescript
// Stripeモジュールのモック
jest.mock("stripe", () => {
    return jest.fn().mockImplementation(() => ({
        paymentIntents: {
            create: jest.fn().mockResolvedValue({
                id: "pi_test123",
                client_secret: "secret_test123",
                status: "requires_payment_method",
                amount: 10000, // $100.00 in cents
            }),
            retrieve: jest.fn().mockResolvedValue({
                id: "pi_test123",
                status: "succeeded",
            }),
        },
        customers: {
            create: jest.fn().mockResolvedValue({
                id: "cus_test123",
            }),
        },
    }));
});

// 使用例
import Stripe from "stripe";
const stripe = new Stripe("test_key");

// テスト内
it("PaymentIntentを正常に作成すること", async () => {
    const result = await createStripePaymentIntent("order123");
    expect(result.client_secret).toBe("secret_test123");
});
```

### 3.3 IPInfo API（国情報取得）

```typescript
global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
        ip: "8.8.8.8",
        country: "US",
        country_name: "United States",
        city: "Mountain View",
        region: "California",
    }),
});

// エラーケース（デフォルト国を返す）
global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));
```

---

## 4. Cookie/ヘッダーモック

### 4.1 cookies-next

```typescript
jest.mock("cookies-next", () => ({
    getCookie: jest.fn(),
    setCookie: jest.fn(),
    deleteCookie: jest.fn(),
}));

import { getCookie, setCookie } from "cookies-next";

// 国情報Cookieのモック
(getCookie as jest.Mock).mockReturnValue(
    JSON.stringify({
        name: "United States",
        code: "US",
    })
);

// Cookieが存在しない場合
(getCookie as jest.Mock).mockReturnValue(undefined);
```

### 4.2 next/headers

```typescript
jest.mock("next/headers", () => ({
    cookies: jest.fn().mockReturnValue({
        get: jest.fn().mockReturnValue({ value: "cookie-value" }),
        set: jest.fn(),
        delete: jest.fn(),
    }),
    headers: jest.fn().mockReturnValue({
        get: jest.fn().mockImplementation((name) => {
            const headerMap: Record<string, string> = {
                "x-forwarded-for": "192.168.1.1",
                "user-agent": "Mozilla/5.0",
                "content-type": "application/json",
            };
            return headerMap[name] || null;
        }),
    }),
}));
```

---

## 5. TestDataFactory パターン

再利用可能なテストデータを生成するファクトリーパターンを使用します。

### 5.1 基本構造

```typescript
// src/config/test-data-factory.ts または テストファイル内に定義

import { TEST_CONFIG } from "@/config/test-config";

export const TestDataFactory = {
    // =====================================
    // ユーザーデータ
    // =====================================
    validUser: (role: string = "USER", overrides = {}) => ({
        id: TEST_CONFIG.DEFAULT_USER_ID,
        firstName: "Test",
        lastName: "User",
        emailAddresses: [{ emailAddress: TEST_CONFIG.TEST_EMAIL }],
        imageUrl: "https://example.com/avatar.png",
        privateMetadata: { role },
        ...overrides,
    }),

    sellerUser: (overrides = {}) =>
        TestDataFactory.validUser("SELLER", overrides),

    adminUser: (overrides = {}) =>
        TestDataFactory.validUser("ADMIN", overrides),

    // =====================================
    // ストアデータ
    // =====================================
    validStoreData: (overrides = {}) => ({
        name: "Test Store",
        description:
            "A test store description that meets the minimum length requirement for validation",
        email: TEST_CONFIG.TEST_EMAIL,
        phone: TEST_CONFIG.TEST_PHONE,
        url: TEST_CONFIG.TEST_STORE_URL,
        logo: "https://example.com/logo.png",
        cover: "https://example.com/cover.png",
        ...overrides,
    }),

    existingStore: (overrides = {}) => ({
        id: TEST_CONFIG.DEFAULT_STORE_ID,
        ...TestDataFactory.validStoreData(),
        userId: TEST_CONFIG.DEFAULT_USER_ID,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...overrides,
    }),

    // =====================================
    // 商品データ
    // =====================================
    validProductData: (overrides = {}) => ({
        name: "Test Product",
        description:
            "A detailed test product description that provides enough information about the product features and specifications to meet validation requirements.",
        brand: "Test Brand",
        sku: "TEST-SKU-001",
        keywords: ["test", "product", "sample", "demo", "example"],
        ...overrides,
    }),

    productWithVariant: (overrides = {}) => ({
        id: "product123",
        ...TestDataFactory.validProductData(),
        variants: [TestDataFactory.validVariantData()],
        ...overrides,
    }),

    validVariantData: (overrides = {}) => ({
        variantName: "Default Variant",
        variantDescription: "Default variant description",
        images: [
            { url: "https://example.com/img1.png" },
            { url: "https://example.com/img2.png" },
            { url: "https://example.com/img3.png" },
        ],
        colors: [{ name: "Black" }],
        sizes: [
            { size: "M", quantity: 10, price: 29.99, discount: 0 },
            { size: "L", quantity: 15, price: 29.99, discount: 10 },
        ],
        weight: 0.5,
        ...overrides,
    }),

    // =====================================
    // 注文データ
    // =====================================
    validOrderData: (overrides = {}) => ({
        id: "order123",
        userId: TEST_CONFIG.DEFAULT_USER_ID,
        total: 100.0,
        shippingFee: 10.0,
        paymentStatus: "Pending",
        createdAt: new Date(),
        ...overrides,
    }),

    paidOrder: (overrides = {}) => ({
        ...TestDataFactory.validOrderData(),
        paymentStatus: "Paid",
        ...overrides,
    }),

    // =====================================
    // カートデータ
    // =====================================
    validCartItem: (overrides = {}) => ({
        productId: "product123",
        variantId: "variant123",
        sizeId: "size123",
        quantity: 1,
        price: 29.99,
        shippingFee: 5.0,
        ...overrides,
    }),

    validCart: (overrides = {}) => ({
        id: "cart123",
        userId: TEST_CONFIG.DEFAULT_USER_ID,
        cartItems: [TestDataFactory.validCartItem()],
        ...overrides,
    }),

    // =====================================
    // クーポンデータ
    // =====================================
    validCouponData: (overrides = {}) => ({
        code: "TESTCOUPON",
        discount: 10,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30日後
        ...overrides,
    }),

    expiredCoupon: (overrides = {}) => ({
        ...TestDataFactory.validCouponData(),
        endDate: new Date(Date.now() - 1000), // 過去の日付
        ...overrides,
    }),

    // =====================================
    // レビューデータ
    // =====================================
    validReviewData: (overrides = {}) => ({
        rating: 5,
        review: "This is a great product! I highly recommend it to everyone.",
        images: [],
        ...overrides,
    }),

    // =====================================
    // 配送関連データ
    // =====================================
    shippingDetails: (overrides = {}) => ({
        defaultShippingService: TEST_CONFIG.DEFAULT_SHIPPING_SERVICE,
        defaultShippingFeePerItem: 5.0,
        defaultShippingFeeForAdditionalItem: 2.0,
        defaultShippingFeePerKg: 3.0,
        defaultShippingFeeFixed: 10.0,
        defaultDeliveryTimeMin: 3,
        defaultDeliveryTimeMax: 7,
        defaultReturnPolicy: TEST_CONFIG.DEFAULT_RETURN_POLICY,
        ...overrides,
    }),

    shippingAddress: (overrides = {}) => ({
        firstName: "Test",
        lastName: "User",
        phone: "+1234567890",
        address1: "123 Test Street",
        address2: "Apt 4B",
        city: "Test City",
        state: "Test State",
        zipCode: "12345",
        countryId: "country123",
        isDefault: true,
        ...overrides,
    }),
};
```

### 5.2 使用例

```typescript
describe("upsertStore", () => {
    it("有効なデータで新規ストアを作成できること", async () => {
        // Arrange
        const mockUser = TestDataFactory.sellerUser();
        const mockStoreData = TestDataFactory.validStoreData({
            name: "Custom Store Name", // オーバーライド
        });

        TestHelpers.mockCurrentUser(mockUser);
        mockDb.store.findFirst.mockResolvedValue(null);
        mockDb.store.create.mockResolvedValue({
            id: "new-store-id",
            ...mockStoreData,
        });

        // Act
        const result = await upsertStore(mockStoreData);

        // Assert
        expect(result.name).toBe("Custom Store Name");
    });
});
```

---

## 6. TestHelpers クラス

よく使用するモック操作をヘルパークラスにまとめます。

```typescript
// テストファイル内または共通ファイルに定義

class TestHelpers {
    // =====================================
    // 認証モック
    // =====================================
    static mockCurrentUser(user: any) {
        (currentUser as jest.Mock).mockResolvedValue(user);
    }

    static mockUnauthenticated() {
        (currentUser as jest.Mock).mockResolvedValue(null);
    }

    static mockAuthenticatedUser() {
        this.mockCurrentUser(TestDataFactory.validUser());
    }

    static mockAuthenticatedSeller() {
        this.mockCurrentUser(TestDataFactory.sellerUser());
    }

    static mockAuthenticatedAdmin() {
        this.mockCurrentUser(TestDataFactory.adminUser());
    }

    // =====================================
    // データベースモック
    // =====================================
    static mockDbMethods() {
        const mockDb = require("@/lib/db").db;
        return mockDb;
    }

    static resetAllMocks() {
        jest.clearAllMocks();
    }

    // =====================================
    // アサーションヘルパー
    // =====================================
    static async expectToThrowError(
        promise: Promise<any>,
        expectedError: string | RegExp
    ) {
        await expect(promise).rejects.toThrow(expectedError);
    }

    static async expectToThrowUnauthenticated(promise: Promise<any>) {
        await this.expectToThrowError(promise, "Unauthenticated.");
    }

    static async expectToThrowUnauthorized(promise: Promise<any>) {
        await this.expectToThrowError(
            promise,
            "Only sellers can perform this action."
        );
    }

    // =====================================
    // コンソールモック
    // =====================================
    static mockConsole() {
        return {
            log: jest.spyOn(console, "log").mockImplementation(),
            error: jest.spyOn(console, "error").mockImplementation(),
            warn: jest.spyOn(console, "warn").mockImplementation(),
        };
    }

    static restoreConsole(spies: {
        log: jest.SpyInstance;
        error: jest.SpyInstance;
        warn: jest.SpyInstance;
    }) {
        spies.log.mockRestore();
        spies.error.mockRestore();
        spies.warn.mockRestore();
    }

    // =====================================
    // 日付モック
    // =====================================
    static mockDate(date: Date) {
        jest.useFakeTimers();
        jest.setSystemTime(date);
    }

    static restoreDate() {
        jest.useRealTimers();
    }

    // =====================================
    // Fetch モック
    // =====================================
    static mockFetch(response: any) {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: async () => response,
        });
    }

    static mockFetchError(error: Error) {
        global.fetch = jest.fn().mockRejectedValue(error);
    }

    static mockFetchFailure(status: number, body: any) {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status,
            json: async () => body,
        });
    }
}
```

### 使用例

```typescript
describe("upsertStore", () => {
    let consoleSpy: ReturnType<typeof TestHelpers.mockConsole>;
    const mockDb = TestHelpers.mockDbMethods();

    beforeEach(() => {
        TestHelpers.resetAllMocks();
        consoleSpy = TestHelpers.mockConsole();
    });

    afterEach(() => {
        TestHelpers.restoreConsole(consoleSpy);
    });

    describe("認証・認可", () => {
        it("未認証ユーザーの場合、エラーをスローすること", async () => {
            TestHelpers.mockUnauthenticated();

            await TestHelpers.expectToThrowUnauthenticated(
                upsertStore(TestDataFactory.validStoreData())
            );
        });

        it("SELLER以外のロールの場合、エラーをスローすること", async () => {
            TestHelpers.mockAuthenticatedUser(); // USERロール

            await TestHelpers.expectToThrowUnauthorized(
                upsertStore(TestDataFactory.validStoreData())
            );
        });
    });
});
```

---

## 7. モックのリセットとクリーンアップ

### 7.1 各テスト前にモックをリセット

```typescript
describe("TestSuite", () => {
    beforeEach(() => {
        // すべてのモック関数の呼び出し履歴をクリア
        jest.clearAllMocks();
    });

    afterEach(() => {
        // モックの実装をリセット（必要な場合）
        jest.resetAllMocks();
    });

    afterAll(() => {
        // すべてのモックを元の実装に戻す
        jest.restoreAllMocks();
    });
});
```

### 7.2 モック関数のリセット方法の違い

| メソッド                 | 説明                               |
| ------------------------ | ---------------------------------- |
| `jest.clearAllMocks()`   | 呼び出し履歴をクリア（実装は保持） |
| `jest.resetAllMocks()`   | 呼び出し履歴と実装をリセット       |
| `jest.restoreAllMocks()` | 元の実装に戻す（`jest.spyOn`用）   |
| `mockFn.mockClear()`     | 特定のモック関数の履歴をクリア     |
| `mockFn.mockReset()`     | 特定のモック関数をリセット         |
| `mockFn.mockRestore()`   | 特定のモック関数を元に戻す         |

---

## 8. 一般的なモックパターン

### 8.1 環境変数のモック

```typescript
describe("環境変数を使用する関数", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it("WEBHOOK_SECRETが設定されている場合", () => {
        process.env.WEBHOOK_SECRET = "test_secret";
        // テスト実行
    });

    it("WEBHOOK_SECRETが設定されていない場合", () => {
        delete process.env.WEBHOOK_SECRET;
        // テスト実行
    });
});
```

### 8.2 トランザクションのモック

```typescript
// Prisma $transaction のモック
mockDb.$transaction = jest.fn().mockImplementation(async (callback) => {
    // コールバック関数を実行
    return await callback(mockDb);
});
```

### 8.3 LocalStorage のモック

```typescript
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
};

Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
});

// 使用
localStorageMock.getItem.mockReturnValue(JSON.stringify({ key: "value" }));
```
