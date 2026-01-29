/**
 * Server Action テストテンプレート
 *
 * このテンプレートは Server Actions（"use server" マークされた関数）の
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
import { currentUser } from "@clerk/nextjs/server";
import { TEST_CONFIG } from "@/config/test-config";
// TODO: テスト対象の関数をインポート
// import { targetFunction } from "./target-file";

// =====================================
// モック設定
// =====================================

// Clerk 認証モック
jest.mock("@clerk/nextjs/server", () => ({
	currentUser: jest.fn(),
}));

// Prisma DB モック
jest.mock("@/lib/db", () => ({
	db: {
		// TODO: 必要なモデルのメソッドを追加
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
		// 他のモデル例:
		// product: { findUnique: jest.fn(), ... },
		// user: { findUnique: jest.fn(), ... },
	},
}));

// =====================================
// テストデータファクトリー
// =====================================
const TestDataFactory = {
	/**
	 * 認証済みユーザーを生成
	 * @param role - ユーザーロール（USER, SELLER, ADMIN）
	 * @param overrides - 上書きするプロパティ
	 */
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

	adminUser: (overrides = {}) => TestDataFactory.validUser("ADMIN", overrides),

	// TODO: テスト対象に合わせてデータファクトリーを追加
	/**
	 * 有効なストアデータを生成
	 */
	validStoreData: (overrides = {}) => ({
		name: "Test Store",
		description:
			"A test store description that meets the minimum length requirement",
		email: TEST_CONFIG.TEST_EMAIL,
		phone: TEST_CONFIG.TEST_PHONE,
		url: TEST_CONFIG.TEST_STORE_URL,
		logo: "https://example.com/logo.png",
		cover: "https://example.com/cover.png",
		...overrides,
	}),

	/**
	 * 既存のストアデータを生成
	 */
	existingStore: (overrides = {}) => ({
		id: TEST_CONFIG.DEFAULT_STORE_ID,
		...TestDataFactory.validStoreData(),
		userId: TEST_CONFIG.DEFAULT_USER_ID,
		status: "ACTIVE",
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	}),
};

// =====================================
// テストヘルパークラス
// =====================================
class TestHelpers {
	/**
	 * 認証済みユーザーをモック
	 */
	static mockCurrentUser(user: ReturnType<typeof TestDataFactory.validUser>) {
		(currentUser as jest.Mock).mockResolvedValue(user);
	}

	/**
	 * 未認証状態をモック
	 */
	static mockUnauthenticated() {
		(currentUser as jest.Mock).mockResolvedValue(null);
	}

	/**
	 * 認証済み一般ユーザーをモック
	 */
	static mockAuthenticatedUser() {
		this.mockCurrentUser(TestDataFactory.validUser());
	}

	/**
	 * 認証済みセラーをモック
	 */
	static mockAuthenticatedSeller() {
		this.mockCurrentUser(TestDataFactory.sellerUser());
	}

	/**
	 * 認証済み管理者をモック
	 */
	static mockAuthenticatedAdmin() {
		this.mockCurrentUser(TestDataFactory.adminUser());
	}

	/**
	 * エラーをスローすることを期待するヘルパー
	 */
	static async expectToThrowError(
		promise: Promise<unknown>,
		expectedError: string | RegExp
	) {
		await expect(promise).rejects.toThrow(expectedError);
	}

	/**
	 * 未認証エラーを期待するヘルパー
	 */
	static async expectToThrowUnauthenticated(promise: Promise<unknown>) {
		await this.expectToThrowError(promise, "Unauthenticated.");
	}

	/**
	 * 権限不足エラーを期待するヘルパー
	 */
	static async expectToThrowUnauthorized(promise: Promise<unknown>) {
		await this.expectToThrowError(
			promise,
			"Only sellers can perform this action."
		);
	}
}

// =====================================
// テスト本体
// =====================================

// TODO: テスト対象の関数名に変更
describe("targetFunction", () => {
	// DBモックの参照を取得
	const mockDb = require("@/lib/db").db;

	// 各テスト前にモックをリセット
	beforeEach(() => {
		jest.clearAllMocks();
	});

	// =====================================
	// 認証・認可テスト
	// =====================================
	describe("認証・認可", () => {
		it("未認証ユーザーの場合、Unauthenticatedエラーをスローすること", async () => {
			// Arrange
			TestHelpers.mockUnauthenticated();

			// Act & Assert
			// TODO: テスト対象の関数を呼び出し
			// await TestHelpers.expectToThrowUnauthenticated(
			//     targetFunction(TestDataFactory.validStoreData())
			// );

			// DBが呼ばれていないことを確認
			expect(mockDb.store.findUnique).not.toHaveBeenCalled();
		});

		it("SELLER以外のロールの場合、権限エラーをスローすること", async () => {
			// Arrange
			TestHelpers.mockAuthenticatedUser(); // USERロール

			// Act & Assert
			// TODO: テスト対象の関数を呼び出し
			// await TestHelpers.expectToThrowUnauthorized(
			//     targetFunction(TestDataFactory.validStoreData())
			// );
		});
	});

	// =====================================
	// バリデーションテスト
	// =====================================
	describe("バリデーション", () => {
		beforeEach(() => {
			TestHelpers.mockAuthenticatedSeller();
		});

		it("データがnullの場合、エラーをスローすること", async () => {
			// Arrange & Act & Assert
			// TODO: テスト対象の関数を呼び出し
			// await expect(targetFunction(null)).rejects.toThrow(
			//     "Please provide data."
			// );
		});

		it("必須フィールドが欠けている場合、エラーをスローすること", async () => {
			// Arrange
			const invalidData = TestDataFactory.validStoreData({
				name: null, // 必須フィールドをnullに
			});

			// Act & Assert
			// TODO: テスト対象の関数を呼び出し
			// await expect(targetFunction(invalidData)).rejects.toThrow();
		});
	});

	// =====================================
	// 重複チェックテスト
	// =====================================
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
			// TODO: 必要に応じてケースを追加
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

				mockDb.store.findFirst.mockResolvedValue({
					id: "existing-id",
					[field]: value,
				});

				// Act & Assert
				// TODO: テスト対象の関数を呼び出し
				// await expect(targetFunction(inputData)).rejects.toThrow(error);
			});
		});
	});

	// =====================================
	// 正常系テスト
	// =====================================
	describe("正常系", () => {
		beforeEach(() => {
			TestHelpers.mockAuthenticatedSeller();
		});

		it("有効なデータで新規レコードを作成できること", async () => {
			// Arrange
			const inputData = TestDataFactory.validStoreData();
			const expectedResult = {
				id: "new-id",
				...inputData,
				userId: TEST_CONFIG.DEFAULT_USER_ID,
			};

			mockDb.store.findFirst.mockResolvedValue(null); // 重複なし
			mockDb.store.create.mockResolvedValue(expectedResult);

			// Act
			// TODO: テスト対象の関数を呼び出し
			// const result = await targetFunction(inputData);

			// Assert
			// expect(result).toEqual(expectedResult);
			// expect(mockDb.store.create).toHaveBeenCalledTimes(1);
			// expect(mockDb.store.create).toHaveBeenCalledWith({
			//     data: expect.objectContaining({
			//         name: inputData.name,
			//         userId: TEST_CONFIG.DEFAULT_USER_ID,
			//     }),
			// });
		});

		it("既存レコードを更新できること", async () => {
			// Arrange
			const existingStore = TestDataFactory.existingStore();
			const updateData = { name: "Updated Store Name" };
			const expectedResult = { ...existingStore, ...updateData };

			mockDb.store.findUnique.mockResolvedValue(existingStore);
			mockDb.store.findFirst.mockResolvedValue(null); // 重複なし
			mockDb.store.update.mockResolvedValue(expectedResult);

			// Act
			// TODO: テスト対象の関数を呼び出し
			// const result = await targetFunction(updateData, existingStore.id);

			// Assert
			// expect(result.name).toBe("Updated Store Name");
			// expect(mockDb.store.update).toHaveBeenCalledTimes(1);
		});
	});

	// =====================================
	// エラーハンドリングテスト
	// =====================================
	describe("エラーハンドリング", () => {
		let consoleLogSpy: jest.SpyInstance;

		beforeEach(() => {
			TestHelpers.mockAuthenticatedSeller();
			consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
		});

		afterEach(() => {
			consoleLogSpy.mockRestore();
		});

		it("データベースエラー時にログ出力しエラーを再スローすること", async () => {
			// Arrange
			const dbError = new Error(TEST_CONFIG.ERROR_MESSAGES.DATABASE_ERROR);
			mockDb.store.findFirst.mockRejectedValue(dbError);

			// Act & Assert
			// TODO: テスト対象の関数を呼び出し
			// await expect(targetFunction(TestDataFactory.validStoreData())).rejects.toThrow(
			//     TEST_CONFIG.ERROR_MESSAGES.DATABASE_ERROR
			// );

			// ログ出力の確認
			// expect(consoleLogSpy).toHaveBeenCalledWith(dbError);
		});
	});
});
