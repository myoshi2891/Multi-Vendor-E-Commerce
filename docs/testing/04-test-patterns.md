# テストパターン集

このドキュメントでは、プロジェクトで頻繁に使用するテストパターンを紹介します。
コピー&ペーストして活用してください。

---

## 1. 認証・認可テストパターン

### 1.1 未認証ユーザーのテスト

```typescript
describe("認証・認可", () => {
    it("未認証ユーザーの場合、Unauthenticatedエラーをスローすること", async () => {
        // Arrange
        TestHelpers.mockUnauthenticated();

        // Act & Assert
        await expect(targetFunction()).rejects.toThrow("Unauthenticated.");

        // DBが呼ばれていないことを確認
        expect(mockDb.store.findUnique).not.toHaveBeenCalled();
    });
});
```

### 1.2 権限不足ユーザーのテスト（SELLER専用機能）

```typescript
it("USERロールの場合、権限エラーをスローすること", async () => {
    // Arrange
    TestHelpers.mockCurrentUser(TestDataFactory.validUser("USER"));

    // Act & Assert
    await expect(targetFunction()).rejects.toThrow(
        "Only sellers can perform this action."
    );
});

it("ADMINロールでもSELLER専用機能は使用できないこと", async () => {
    // Arrange
    TestHelpers.mockCurrentUser(TestDataFactory.adminUser());

    // Act & Assert
    await expect(targetFunction()).rejects.toThrow(
        "Only sellers can perform this action."
    );
});
```

### 1.3 権限不足ユーザーのテスト（ADMIN専用機能）

```typescript
it("ADMIN以外のロールの場合、権限エラーをスローすること", async () => {
    // Arrange
    TestHelpers.mockCurrentUser(TestDataFactory.sellerUser());

    // Act & Assert
    await expect(adminOnlyFunction()).rejects.toThrow(
        "Only admins can perform this action."
    );
});
```

### 1.4 所有権検証のテスト

```typescript
it("他のユーザーのリソースにはアクセスできないこと", async () => {
    // Arrange
    TestHelpers.mockAuthenticatedSeller();

    // 別のユーザーが所有するストア
    mockDb.store.findUnique.mockResolvedValue({
        id: "store123",
        userId: "different_user_id", // 異なるユーザー
    });

    // Act & Assert
    await expect(updateStore("store123", data)).rejects.toThrow(
        "You don't have permission to modify this store."
    );
});
```

---

## 2. CRUD操作テストパターン

### 2.1 作成（Create）

```typescript
describe("新規作成", () => {
    it("有効なデータで新規レコードを作成できること", async () => {
        // Arrange
        TestHelpers.mockAuthenticatedSeller();
        const inputData = TestDataFactory.validStoreData();
        const expectedResult = {
            id: "new-store-id",
            ...inputData,
            userId: TEST_CONFIG.DEFAULT_USER_ID,
            createdAt: expect.any(Date),
        };

        mockDb.store.findFirst.mockResolvedValue(null); // 重複なし
        mockDb.store.create.mockResolvedValue(expectedResult);

        // Act
        const result = await createStore(inputData);

        // Assert
        expect(result).toEqual(expectedResult);
        expect(mockDb.store.create).toHaveBeenCalledTimes(1);
        expect(mockDb.store.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                name: inputData.name,
                email: inputData.email,
                userId: TEST_CONFIG.DEFAULT_USER_ID,
            }),
        });
    });

    it("デフォルト値が正しく設定されること", async () => {
        // Arrange
        TestHelpers.mockAuthenticatedSeller();
        mockDb.store.findFirst.mockResolvedValue(null);
        mockDb.store.create.mockResolvedValue({
            id: "new-id",
            status: "PENDING", // デフォルト値
        });

        // Act
        const result = await createStore(TestDataFactory.validStoreData());

        // Assert
        expect(result.status).toBe("PENDING");
    });
});
```

### 2.2 読み取り（Read）

```typescript
describe("取得", () => {
    it("有効なIDでレコードを取得できること", async () => {
        // Arrange
        const expectedRecord = TestDataFactory.existingStore();
        mockDb.store.findUnique.mockResolvedValue(expectedRecord);

        // Act
        const result = await getStore("store123");

        // Assert
        expect(result).toEqual(expectedRecord);
        expect(mockDb.store.findUnique).toHaveBeenCalledWith({
            where: { id: "store123" },
        });
    });

    it("存在しないIDの場合、nullを返すこと", async () => {
        // Arrange
        mockDb.store.findUnique.mockResolvedValue(null);

        // Act
        const result = await getStore("nonexistent-id");

        // Assert
        expect(result).toBeNull();
    });

    it("関連データを含めて取得できること", async () => {
        // Arrange
        const storeWithProducts = {
            ...TestDataFactory.existingStore(),
            products: [{ id: "prod1", name: "Product 1" }],
        };
        mockDb.store.findUnique.mockResolvedValue(storeWithProducts);

        // Act
        const result = await getStoreWithProducts("store123");

        // Assert
        expect(result.products).toHaveLength(1);
        expect(mockDb.store.findUnique).toHaveBeenCalledWith({
            where: { id: "store123" },
            include: { products: true },
        });
    });
});
```

### 2.3 更新（Update）

```typescript
describe("更新", () => {
    it("既存レコードを更新できること", async () => {
        // Arrange
        TestHelpers.mockAuthenticatedSeller();
        const existingStore = TestDataFactory.existingStore();
        const updateData = { name: "Updated Store Name" };
        const updatedStore = { ...existingStore, ...updateData };

        mockDb.store.findUnique.mockResolvedValue(existingStore);
        mockDb.store.update.mockResolvedValue(updatedStore);

        // Act
        const result = await updateStore("store123", updateData);

        // Assert
        expect(result.name).toBe("Updated Store Name");
        expect(mockDb.store.update).toHaveBeenCalledWith({
            where: { id: "store123" },
            data: updateData,
        });
    });

    it("存在しないレコードの更新はエラーになること", async () => {
        // Arrange
        TestHelpers.mockAuthenticatedSeller();
        mockDb.store.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(updateStore("nonexistent", {})).rejects.toThrow(
            "Store not found."
        );
        expect(mockDb.store.update).not.toHaveBeenCalled();
    });
});
```

### 2.4 削除（Delete）

```typescript
describe("削除", () => {
    it("レコードを削除できること", async () => {
        // Arrange
        TestHelpers.mockAuthenticatedAdmin();
        const existingStore = TestDataFactory.existingStore();
        mockDb.store.findUnique.mockResolvedValue(existingStore);
        mockDb.store.delete.mockResolvedValue(existingStore);

        // Act
        const result = await deleteStore("store123");

        // Assert
        expect(mockDb.store.delete).toHaveBeenCalledWith({
            where: { id: "store123" },
        });
    });

    it("ソフトデリートの場合、isDeletedフラグが設定されること", async () => {
        // Arrange
        TestHelpers.mockAuthenticatedAdmin();
        mockDb.store.findUnique.mockResolvedValue(
            TestDataFactory.existingStore()
        );
        mockDb.store.update.mockResolvedValue({
            isDeleted: true,
            deletedAt: expect.any(Date),
        });

        // Act
        const result = await softDeleteStore("store123");

        // Assert
        expect(mockDb.store.update).toHaveBeenCalledWith({
            where: { id: "store123" },
            data: {
                isDeleted: true,
                deletedAt: expect.any(Date),
            },
        });
    });
});
```

---

## 3. 重複チェックテストパターン

### 3.1 パラメータ化テスト

```typescript
describe("重複チェック", () => {
    const duplicateCases = [
        {
            field: "name",
            value: "Existing Store",
            error: "A store with this name already exists.",
        },
        {
            field: "email",
            value: "existing@example.com",
            error: "A store with this email already exists.",
        },
        {
            field: "url",
            value: "existing-store",
            error: "A store with this URL already exists.",
        },
        {
            field: "phone",
            value: "1234567890",
            error: "A store with this phone number already exists.",
        },
    ];

    beforeEach(() => {
        TestHelpers.mockAuthenticatedSeller();
    });

    duplicateCases.forEach(({ field, value, error }) => {
        it(`${field}が重複している場合、エラーをスローすること`, async () => {
            // Arrange
            const inputData = TestDataFactory.validStoreData({
                [field]: value,
            });

            // 重複するストアを返す
            mockDb.store.findFirst.mockImplementation(({ where }) => {
                if (where[field] === value) {
                    return Promise.resolve({ id: "existing", [field]: value });
                }
                return Promise.resolve(null);
            });

            // Act & Assert
            await expect(createStore(inputData)).rejects.toThrow(error);
        });
    });

    it("すべてのフィールドがユニークな場合、正常に作成されること", async () => {
        // Arrange
        mockDb.store.findFirst.mockResolvedValue(null); // 重複なし
        mockDb.store.create.mockResolvedValue({ id: "new-id" });

        // Act
        const result = await createStore(TestDataFactory.validStoreData());

        // Assert
        expect(result).toBeDefined();
    });
});
```

---

## 4. バリデーションテストパターン

### 4.1 必須フィールドのテスト

```typescript
describe("バリデーション", () => {
    const requiredFields = ["name", "email", "url", "phone"];

    requiredFields.forEach((field) => {
        it(`${field}がnullの場合、エラーをスローすること`, async () => {
            // Arrange
            TestHelpers.mockAuthenticatedSeller();
            const inputData = TestDataFactory.validStoreData({
                [field]: null,
            });

            // Act & Assert
            await expect(createStore(inputData)).rejects.toThrow(
                `Please provide ${field}.`
            );
        });

        it(`${field}が空文字の場合、エラーをスローすること`, async () => {
            // Arrange
            TestHelpers.mockAuthenticatedSeller();
            const inputData = TestDataFactory.validStoreData({
                [field]: "",
            });

            // Act & Assert
            await expect(createStore(inputData)).rejects.toThrow();
        });
    });
});
```

### 4.2 Zodスキーマのテスト

```typescript
import { StoreFormSchema } from "@/lib/schemas";

describe("StoreFormSchema", () => {
    describe("正常系", () => {
        it("有効なデータでパースが成功すること", () => {
            const validData = TestDataFactory.validStoreData();

            const result = StoreFormSchema.safeParse(validData);

            expect(result.success).toBe(true);
        });
    });

    describe("name フィールド", () => {
        it("2文字未満の場合、エラーになること", () => {
            const data = TestDataFactory.validStoreData({ name: "A" });

            const result = StoreFormSchema.safeParse(data);

            expect(result.success).toBe(false);
            expect(result.error?.issues[0].path).toContain("name");
        });

        it("50文字を超える場合、エラーになること", () => {
            const data = TestDataFactory.validStoreData({
                name: "A".repeat(51),
            });

            const result = StoreFormSchema.safeParse(data);

            expect(result.success).toBe(false);
        });
    });

    describe("email フィールド", () => {
        const invalidEmails = [
            "invalid",
            "invalid@",
            "@example.com",
            "invalid@.com",
        ];

        invalidEmails.forEach((email) => {
            it(`無効なメール形式（${email}）の場合、エラーになること`, () => {
                const data = TestDataFactory.validStoreData({ email });

                const result = StoreFormSchema.safeParse(data);

                expect(result.success).toBe(false);
            });
        });
    });
});
```

---

## 5. フィルタリング・ページネーションテストパターン

### 5.1 フィルタリングテスト

```typescript
describe("フィルタリング", () => {
    beforeEach(() => {
        mockDb.product.findMany.mockResolvedValue([]);
        mockDb.product.count.mockResolvedValue(0);
    });

    it("カテゴリフィルターが正しく適用されること", async () => {
        // Act
        await getProducts({ category: "electronics" });

        // Assert
        expect(mockDb.product.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    category: { url: "electronics" },
                }),
            })
        );
    });

    it("価格範囲フィルターが正しく適用されること", async () => {
        // Act
        await getProducts({ minPrice: 10, maxPrice: 100 });

        // Assert
        expect(mockDb.product.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    variants: {
                        some: {
                            sizes: {
                                some: {
                                    price: {
                                        gte: 10,
                                        lte: 100,
                                    },
                                },
                            },
                        },
                    },
                }),
            })
        );
    });

    it("複数フィルターを組み合わせて適用できること", async () => {
        // Act
        await getProducts({
            category: "electronics",
            minPrice: 10,
            search: "phone",
        });

        // Assert
        expect(mockDb.product.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    category: { url: "electronics" },
                    OR: expect.arrayContaining([
                        { name: { contains: "phone" } },
                    ]),
                }),
            })
        );
    });
});
```

### 5.2 ソートテスト

```typescript
describe("ソート", () => {
    const sortCases = [
        {
            sortBy: "price-low-to-high",
            expectedOrder: { price: "asc" },
        },
        {
            sortBy: "price-high-to-low",
            expectedOrder: { price: "desc" },
        },
        {
            sortBy: "new-arrivals",
            expectedOrder: { createdAt: "desc" },
        },
        {
            sortBy: "top-rated",
            expectedOrder: { rating: "desc" },
        },
    ];

    sortCases.forEach(({ sortBy, expectedOrder }) => {
        it(`${sortBy}ソートが正しく動作すること`, async () => {
            // Act
            await getProducts({ sortBy });

            // Assert
            expect(mockDb.product.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: expect.objectContaining(expectedOrder),
                })
            );
        });
    });
});
```

### 5.3 ページネーションテスト

```typescript
describe("ページネーション", () => {
    it("ページ番号とページサイズが正しく適用されること", async () => {
        // Arrange
        mockDb.product.findMany.mockResolvedValue([]);
        mockDb.product.count.mockResolvedValue(100);

        // Act
        await getProducts({ page: 3, pageSize: 20 });

        // Assert
        expect(mockDb.product.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                skip: 40, // (3 - 1) * 20
                take: 20,
            })
        );
    });

    it("総件数が正しく返されること", async () => {
        // Arrange
        mockDb.product.findMany.mockResolvedValue([{ id: "1" }, { id: "2" }]);
        mockDb.product.count.mockResolvedValue(50);

        // Act
        const result = await getProducts({ page: 1, pageSize: 10 });

        // Assert
        expect(result.total).toBe(50);
        expect(result.totalPages).toBe(5);
    });

    it("最初のページではskipが0であること", async () => {
        // Act
        await getProducts({ page: 1, pageSize: 10 });

        // Assert
        expect(mockDb.product.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                skip: 0,
            })
        );
    });
});
```

---

## 6. 計算ロジックテストパターン

### 6.1 割引計算

```typescript
describe("割引計算", () => {
    const discountCases = [
        { price: 100, discount: 0, expected: 100 },
        { price: 100, discount: 10, expected: 90 },
        { price: 100, discount: 50, expected: 50 },
        { price: 100, discount: 100, expected: 0 },
        { price: 50.5, discount: 20, expected: 40.4 },
        { price: 99.99, discount: 15, expected: 84.99 }, // 小数点処理
    ];

    discountCases.forEach(({ price, discount, expected }) => {
        it(`価格${price}、割引${discount}%の場合、${expected}を返すこと`, () => {
            const result = calculateDiscountedPrice(price, discount);
            expect(result).toBeCloseTo(expected, 2);
        });
    });
});
```

### 6.2 配送料計算

```typescript
describe("配送料計算", () => {
    describe("ITEM方式", () => {
        it("1個目は基本料金、2個目以降は追加料金が適用されること", () => {
            const config = {
                method: "ITEM",
                feePerItem: 5,
                feeForAdditional: 2,
            };

            expect(calculateShipping(config, 1)).toBe(5); // 5
            expect(calculateShipping(config, 2)).toBe(7); // 5 + 2
            expect(calculateShipping(config, 5)).toBe(13); // 5 + (2 * 4)
        });
    });

    describe("WEIGHT方式", () => {
        it("重量×単価で計算されること", () => {
            const config = {
                method: "WEIGHT",
                feePerKg: 3,
            };

            expect(calculateShipping(config, 1, 0.5)).toBe(1.5); // 0.5kg * 3
            expect(calculateShipping(config, 2, 1.5)).toBe(9); // 1.5kg * 2 * 3
        });
    });

    describe("FIXED方式", () => {
        it("数量に関係なく固定料金になること", () => {
            const config = {
                method: "FIXED",
                fixedFee: 10,
            };

            expect(calculateShipping(config, 1)).toBe(10);
            expect(calculateShipping(config, 5)).toBe(10);
            expect(calculateShipping(config, 100)).toBe(10);
        });
    });
});
```

### 6.3 平均評価の計算

```typescript
describe("平均評価計算", () => {
    it("レビューから平均評価を正しく計算すること", async () => {
        // Arrange
        mockDb.review.aggregate.mockResolvedValue({
            _avg: { rating: 4.2 },
            _count: { rating: 50 },
        });

        // Act
        const result = await calculateProductRating("product123");

        // Assert
        expect(result.averageRating).toBe(4.2);
        expect(result.reviewCount).toBe(50);
    });

    it("レビューがない場合、デフォルト値を返すこと", async () => {
        // Arrange
        mockDb.review.aggregate.mockResolvedValue({
            _avg: { rating: null },
            _count: { rating: 0 },
        });

        // Act
        const result = await calculateProductRating("product123");

        // Assert
        expect(result.averageRating).toBe(0);
        expect(result.reviewCount).toBe(0);
    });
});
```

---

## 7. エラーハンドリングテストパターン

### 7.1 データベースエラー

```typescript
describe("エラーハンドリング", () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    it("データベースエラー時にログ出力しエラーを再スローすること", async () => {
        // Arrange
        const dbError = new Error("Database connection failed");
        mockDb.store.findUnique.mockRejectedValue(dbError);

        // Act & Assert
        await expect(getStore("store123")).rejects.toThrow(
            "Database connection failed"
        );

        // ログ出力の確認
        expect(consoleLogSpy).toHaveBeenCalledWith(dbError);
    });

    it("エラー時にトランザクションがロールバックされること", async () => {
        // Arrange
        TestHelpers.mockAuthenticatedSeller();
        mockDb.store.create.mockResolvedValue({ id: "new-id" });
        mockDb.product.create.mockRejectedValue(
            new Error("Product creation failed")
        );

        // Act & Assert
        await expect(createStoreWithProduct(data)).rejects.toThrow();

        // ストア作成もロールバックされていることを確認
        // (トランザクションの仕組みに依存)
    });
});
```

### 7.2 外部APIエラー

```typescript
describe("外部APIエラー", () => {
    it("PayPal APIエラー時に適切なエラーメッセージを返すこと", async () => {
        // Arrange
        TestHelpers.mockFetchFailure(500, { error: "Internal Server Error" });

        // Act & Assert
        await expect(createPayPalPayment("order123")).rejects.toThrow(
            "Failed to create PayPal payment"
        );
    });

    it("ネットワークエラー時にリトライ後にエラーをスローすること", async () => {
        // Arrange
        global.fetch = jest
            .fn()
            .mockRejectedValueOnce(new Error("Network error"))
            .mockRejectedValueOnce(new Error("Network error"))
            .mockRejectedValueOnce(new Error("Network error"));

        // Act & Assert
        await expect(callExternalApiWithRetry()).rejects.toThrow(
            "Network error"
        );
        expect(fetch).toHaveBeenCalledTimes(3); // 3回リトライ
    });
});
```

---

## 8. 外部APIテストパターン

### 8.1 成功ケース

```typescript
describe("外部API連携", () => {
    it("API呼び出しが成功した場合、正しいデータを返すこと", async () => {
        // Arrange
        const mockResponse = {
            id: "PAYMENT-123",
            status: "COMPLETED",
        };
        TestHelpers.mockFetch(mockResponse);

        // Act
        const result = await capturePayment("order123");

        // Assert
        expect(result.status).toBe("COMPLETED");
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining("/payments/"),
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({
                    "Content-Type": "application/json",
                }),
            })
        );
    });
});
```

### 8.2 リクエストボディの検証

```typescript
it("正しいリクエストボディでAPIを呼び出すこと", async () => {
    // Arrange
    TestHelpers.mockFetch({ success: true });
    const expectedBody = {
        amount: {
            value: "100.00",
            currency_code: "USD",
        },
    };

    // Act
    await createPayment({ amount: 100, currency: "USD" });

    // Assert
    expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
            body: JSON.stringify(expectedBody),
        })
    );
});
```

---

## 9. 日付・時間関連テストパターン

### 9.1 日付のモック

```typescript
describe("日付関連", () => {
    beforeEach(() => {
        // 固定の日付を設定
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2024-01-15T10:00:00Z"));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("クーポンの有効期限が正しく判定されること", () => {
        const validCoupon = {
            startDate: new Date("2024-01-01"),
            endDate: new Date("2024-01-31"),
        };

        const expiredCoupon = {
            startDate: new Date("2023-12-01"),
            endDate: new Date("2024-01-10"),
        };

        expect(isCouponValid(validCoupon)).toBe(true);
        expect(isCouponValid(expiredCoupon)).toBe(false);
    });

    it("配送日の計算が正しいこと", () => {
        const result = getShippingDatesRange(3, 7);

        expect(result.minDate).toEqual(new Date("2024-01-18T10:00:00Z"));
        expect(result.maxDate).toEqual(new Date("2024-01-22T10:00:00Z"));
    });
});
```

---

## 10. スナップショットテストパターン

### 10.1 オブジェクト構造のスナップショット

```typescript
describe("レスポンス構造", () => {
    it("商品詳細のレスポンス構造が正しいこと", async () => {
        // Arrange
        mockDb.product.findUnique.mockResolvedValue(
            TestDataFactory.productWithVariant()
        );

        // Act
        const result = await getProductDetails("product123");

        // Assert
        expect(result).toMatchSnapshot();
    });
});
```

### 10.2 動的な値を含むスナップショット

```typescript
it("日付を含むレスポンスのスナップショット", async () => {
    const result = await createOrder(orderData);

    // 動的な値を固定値に置換
    expect({
        ...result,
        id: expect.any(String),
        createdAt: expect.any(Date),
    }).toMatchSnapshot();
});
```
