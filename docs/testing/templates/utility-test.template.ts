/**
 * ユーティリティ関数テストテンプレート
 *
 * このテンプレートはユーティリティ関数（utils.ts、schemas.ts など）の
 * テストを作成する際の基本構造を提供します。
 *
 * 使用方法:
 * 1. このファイルをコピーして対象ファイルと同じディレクトリに配置
 * 2. ファイル名を [対象ファイル名].test.ts に変更
 * 3. TODO コメントを実際の実装に置き換え
 */

// =====================================
// インポート
// =====================================
import { TEST_CONFIG } from "@/config/test-config";
// TODO: テスト対象の関数をインポート
// import { targetFunction, anotherFunction } from "./utils";
// import { SomeSchema } from "./schemas";

// =====================================
// モック設定（必要に応じて）
// =====================================

// 外部API（fetch）のモック
const originalFetch = global.fetch;

// LocalStorage のモック
const localStorageMock = {
	store: {} as Record<string, string>,
	getItem: jest.fn((key: string) => localStorageMock.store[key] || null),
	setItem: jest.fn((key: string, value: string) => {
		localStorageMock.store[key] = value;
	}),
	removeItem: jest.fn((key: string) => {
		delete localStorageMock.store[key];
	}),
	clear: jest.fn(() => {
		localStorageMock.store = {};
	}),
};

// =====================================
// テストヘルパー
// =====================================

/**
 * fetch をモックする
 */
function mockFetch(response: unknown, ok: boolean = true) {
	global.fetch = jest.fn().mockResolvedValue({
		ok,
		json: async () => response,
	});
}

/**
 * fetch エラーをモックする
 */
function mockFetchError(error: Error) {
	global.fetch = jest.fn().mockRejectedValue(error);
}

/**
 * 日付を固定する
 */
function mockDate(date: Date) {
	jest.useFakeTimers();
	jest.setSystemTime(date);
}

/**
 * 日付を元に戻す
 */
function restoreDate() {
	jest.useRealTimers();
}

// =====================================
// テストデータファクトリー
// =====================================
const TestDataFactory = {
	/**
	 * 有効な商品データ（isProductValidToAdd 用）
	 */
	validProductForCart: (overrides = {}) => ({
		productId: "product123",
		variantId: "variant123",
		sizeId: "size123",
		productSlug: "test-product",
		variantSlug: "test-variant",
		name: "Test Product",
		variantName: "Test Variant",
		variantImage: "https://example.com/image.png",
		size: "M",
		quantity: 1,
		price: 29.99,
		discount: 0,
		stock: 10,
		weight: 0.5,
		shippingFee: 5.0,
		extraShippingFee: 2.0,
		storeId: "store123",
		storeUrl: "test-store",
		storeName: "Test Store",
		deliveryTimeMin: 3,
		deliveryTimeMax: 7,
		freeShippingCountryCodes: [],
		...overrides,
	}),

	/**
	 * 配送日付範囲計算用のテストケース
	 */
	shippingDateCases: [
		{ minDays: 3, maxDays: 7, description: "標準配送" },
		{ minDays: 1, maxDays: 2, description: "速達配送" },
		{ minDays: 14, maxDays: 21, description: "国際配送" },
	],

	/**
	 * Zodスキーマテスト用の有効なデータ
	 */
	validSchemaData: (overrides = {}) => ({
		name: "Valid Name",
		email: "valid@example.com",
		description: "A".repeat(200), // 最小文字数を満たす
		...overrides,
	}),
};

// =====================================
// テスト本体
// =====================================

// =====================================
// 純粋関数のテスト
// =====================================
describe("Pure Functions", () => {
	// TODO: テスト対象の関数名に変更
	describe("targetFunction", () => {
		describe("正常系", () => {
			it("有効な入力で期待される結果を返すこと", () => {
				// Arrange
				const input = "test-input";
				const expected = "expected-output";

				// Act
				// TODO: テスト対象の関数を呼び出し
				// const result = targetFunction(input);

				// Assert
				// expect(result).toBe(expected);
			});

			// パラメータ化テストの例
			const testCases = [
				{ input: "input1", expected: "output1" },
				{ input: "input2", expected: "output2" },
				{ input: "input3", expected: "output3" },
			];

			testCases.forEach(({ input, expected }) => {
				it(`入力 "${input}" で "${expected}" を返すこと`, () => {
					// Act
					// const result = targetFunction(input);

					// Assert
					// expect(result).toBe(expected);
				});
			});
		});

		describe("境界値", () => {
			it("空文字列の場合、デフォルト値を返すこと", () => {
				// Act
				// const result = targetFunction("");

				// Assert
				// expect(result).toBe(defaultValue);
			});

			it("nullの場合、エラーをスローすること", () => {
				// Act & Assert
				// expect(() => targetFunction(null)).toThrow();
			});

			it("最大長を超える入力の場合、切り詰められること", () => {
				// Arrange
				const longInput = "A".repeat(1000);

				// Act
				// const result = targetFunction(longInput);

				// Assert
				// expect(result.length).toBeLessThanOrEqual(maxLength);
			});
		});
	});
});

// =====================================
// 非同期関数のテスト（外部API呼び出し）
// =====================================
describe("Async Functions with External API", () => {
	afterEach(() => {
		global.fetch = originalFetch;
	});

	// TODO: テスト対象の関数名に変更
	describe("getUserCountry", () => {
		it("APIから国情報を正しく取得できること", async () => {
			// Arrange
			const mockResponse = {
				country: "US",
				country_name: "United States",
			};
			mockFetch(mockResponse);

			// Act
			// const result = await getUserCountry();

			// Assert
			// expect(result).toEqual({
			//     code: "US",
			//     name: "United States",
			// });
		});

		it("API失敗時にデフォルト国を返すこと", async () => {
			// Arrange
			mockFetchError(new Error("Network error"));

			// Act
			// const result = await getUserCountry();

			// Assert
			// expect(result).toEqual({
			//     code: "US",
			//     name: "United States",
			// });
		});

		it("不正なレスポンスの場合にデフォルト国を返すこと", async () => {
			// Arrange
			mockFetch({ invalid: "response" });

			// Act
			// const result = await getUserCountry();

			// Assert
			// expect(result).toBeDefined();
		});
	});
});

// =====================================
// 日付関連関数のテスト
// =====================================
describe("Date Functions", () => {
	const fixedDate = new Date("2024-01-15T10:00:00Z");

	beforeEach(() => {
		mockDate(fixedDate);
	});

	afterEach(() => {
		restoreDate();
	});

	// TODO: テスト対象の関数名に変更
	describe("getShippingDatesRange", () => {
		TestDataFactory.shippingDateCases.forEach(
			({ minDays, maxDays, description }) => {
				it(`${description}（${minDays}-${maxDays}日）で正しい日付範囲を計算すること`, () => {
					// Arrange
					const expectedMinDate = new Date(fixedDate);
					expectedMinDate.setDate(expectedMinDate.getDate() + minDays);

					const expectedMaxDate = new Date(fixedDate);
					expectedMaxDate.setDate(expectedMaxDate.getDate() + maxDays);

					// Act
					// const result = getShippingDatesRange(minDays, maxDays);

					// Assert
					// expect(result.minDate).toEqual(expectedMinDate);
					// expect(result.maxDate).toEqual(expectedMaxDate);
				});
			}
		);
	});

	// TODO: テスト対象の関数名に変更
	describe("getTimeUntil", () => {
		it("未来の日付までの時間を正しく計算すること", () => {
			// Arrange
			const futureDate = new Date("2024-01-20T10:00:00Z"); // 5日後

			// Act
			// const result = getTimeUntil(futureDate);

			// Assert
			// expect(result.days).toBe(5);
			// expect(result.hours).toBe(0);
		});

		it("過去の日付の場合、ゼロを返すこと", () => {
			// Arrange
			const pastDate = new Date("2024-01-10T10:00:00Z"); // 5日前

			// Act
			// const result = getTimeUntil(pastDate);

			// Assert
			// expect(result.days).toBe(0);
			// expect(result.hours).toBe(0);
		});
	});
});

// =====================================
// LocalStorage関連関数のテスト
// =====================================
describe("LocalStorage Functions", () => {
	beforeEach(() => {
		Object.defineProperty(window, "localStorage", {
			value: localStorageMock,
			writable: true,
		});
		localStorageMock.clear();
	});

	// TODO: テスト対象の関数名に変更
	describe("updateProductHistory", () => {
		it("商品履歴を保存できること", () => {
			// Arrange
			const productId = "product123";

			// Act
			// updateProductHistory(productId);

			// Assert
			// expect(localStorageMock.setItem).toHaveBeenCalled();
			// const stored = JSON.parse(localStorageMock.getItem("productHistory") || "[]");
			// expect(stored).toContain(productId);
		});

		it("重複する商品は先頭に移動すること", () => {
			// Arrange
			localStorageMock.store["productHistory"] = JSON.stringify([
				"product1",
				"product2",
				"product3",
			]);

			// Act
			// updateProductHistory("product2");

			// Assert
			// const stored = JSON.parse(localStorageMock.store["productHistory"]);
			// expect(stored[0]).toBe("product2");
		});

		it("100件を超えた場合、古い履歴が削除されること", () => {
			// Arrange
			const existingHistory = Array.from({ length: 100 }, (_, i) => `old-${i}`);
			localStorageMock.store["productHistory"] =
				JSON.stringify(existingHistory);

			// Act
			// updateProductHistory("new-product");

			// Assert
			// const stored = JSON.parse(localStorageMock.store["productHistory"]);
			// expect(stored.length).toBe(100);
			// expect(stored[0]).toBe("new-product");
		});
	});
});

// =====================================
// バリデーション関数のテスト
// =====================================
describe("Validation Functions", () => {
	// TODO: テスト対象の関数名に変更
	describe("isProductValidToAdd", () => {
		it("有効な商品データでtrueを返すこと", () => {
			// Arrange
			const validProduct = TestDataFactory.validProductForCart();

			// Act
			// const result = isProductValidToAdd(validProduct);

			// Assert
			// expect(result).toBe(true);
		});

		describe("必須フィールドのチェック", () => {
			const requiredFields = [
				"productId",
				"variantId",
				"sizeId",
				"name",
				"price",
			];

			requiredFields.forEach((field) => {
				it(`${field}がnullの場合、falseを返すこと`, () => {
					// Arrange
					const invalidProduct = TestDataFactory.validProductForCart({
						[field]: null,
					});

					// Act
					// const result = isProductValidToAdd(invalidProduct);

					// Assert
					// expect(result).toBe(false);
				});
			});
		});

		describe("数値フィールドのチェック", () => {
			const numericFields = [
				{ field: "quantity", invalidValue: 0, description: "数量が0" },
				{ field: "price", invalidValue: -1, description: "価格が負" },
				{ field: "stock", invalidValue: 0, description: "在庫が0" },
				{ field: "weight", invalidValue: -0.1, description: "重量が負" },
			];

			numericFields.forEach(({ field, invalidValue, description }) => {
				it(`${description}の場合、falseを返すこと`, () => {
					// Arrange
					const invalidProduct = TestDataFactory.validProductForCart({
						[field]: invalidValue,
					});

					// Act
					// const result = isProductValidToAdd(invalidProduct);

					// Assert
					// expect(result).toBe(false);
				});
			});
		});

		it("配送時間の範囲が不正な場合、falseを返すこと", () => {
			// Arrange
			const invalidProduct = TestDataFactory.validProductForCart({
				deliveryTimeMin: 10,
				deliveryTimeMax: 5, // min > max
			});

			// Act
			// const result = isProductValidToAdd(invalidProduct);

			// Assert
			// expect(result).toBe(false);
		});
	});
});

// =====================================
// Zodスキーマのテスト
// =====================================
describe("Zod Schemas", () => {
	// TODO: テスト対象のスキーマをインポート
	// import { StoreFormSchema } from "@/lib/schemas";

	describe("StoreFormSchema", () => {
		describe("正常系", () => {
			it("有効なデータでパースが成功すること", () => {
				// Arrange
				const validData = TestDataFactory.validSchemaData();

				// Act
				// const result = StoreFormSchema.safeParse(validData);

				// Assert
				// expect(result.success).toBe(true);
			});
		});

		describe("name フィールド", () => {
			const nameCases = [
				{ value: "A", valid: false, description: "1文字（最小未満）" },
				{ value: "AB", valid: true, description: "2文字（最小）" },
				{ value: "A".repeat(50), valid: true, description: "50文字（最大）" },
				{ value: "A".repeat(51), valid: false, description: "51文字（最大超過）" },
			];

			nameCases.forEach(({ value, valid, description }) => {
				it(`name が ${description} の場合、${valid ? "成功" : "失敗"}すること`, () => {
					// Arrange
					const data = TestDataFactory.validSchemaData({ name: value });

					// Act
					// const result = StoreFormSchema.safeParse(data);

					// Assert
					// expect(result.success).toBe(valid);
				});
			});
		});

		describe("email フィールド", () => {
			const emailCases = [
				{ value: "valid@example.com", valid: true },
				{ value: "invalid", valid: false },
				{ value: "invalid@", valid: false },
				{ value: "@example.com", valid: false },
			];

			emailCases.forEach(({ value, valid }) => {
				it(`email "${value}" は ${valid ? "有効" : "無効"}であること`, () => {
					// Arrange
					const data = TestDataFactory.validSchemaData({ email: value });

					// Act
					// const result = StoreFormSchema.safeParse(data);

					// Assert
					// expect(result.success).toBe(valid);
				});
			});
		});
	});
});

// =====================================
// ユーティリティクラスのテスト（該当する場合）
// =====================================
describe("Utility Classes", () => {
	// TODO: テスト対象のクラスをインポート
	// class ExampleClass { ... }

	describe("ExampleClass", () => {
		it("インスタンスが正しく作成されること", () => {
			// Arrange & Act
			// const instance = new ExampleClass();

			// Assert
			// expect(instance).toBeDefined();
		});
	});
});
