/**
 * API Route テストテンプレート
 *
 * このテンプレートは Next.js App Router の API Routes（route.ts）の
 * テストを作成する際の基本構造を提供します。
 *
 * 使用方法:
 * 1. このファイルをコピーして対象ファイルと同じディレクトリに配置
 * 2. ファイル名を route.test.ts に変更
 * 3. TODO コメントを実際の実装に置き換え
 */

// =====================================
// インポート
// =====================================
import { NextRequest } from "next/server";
import { TEST_CONFIG } from "@/config/test-config";
// TODO: テスト対象のハンドラーをインポート
// import { GET, POST } from "./route";

// =====================================
// モック設定
// =====================================

// Prisma DB モック
jest.mock("@/lib/db", () => ({
	db: {
		// TODO: 必要なモデルのメソッドを追加
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
			upsert: jest.fn(),
			delete: jest.fn(),
		},
		$queryRaw: jest.fn(),
	},
}));

// next/headers モック（必要に応じて）
jest.mock("next/headers", () => ({
	headers: jest.fn().mockReturnValue({
		get: jest.fn().mockImplementation((name: string) => {
			const headerMap: Record<string, string> = {
				"svix-id": "test-svix-id",
				"svix-timestamp": "1234567890",
				"svix-signature": "test-signature",
				"content-type": "application/json",
			};
			return headerMap[name] || null;
		}),
	}),
}));

// 環境変数モック（必要に応じて）
const originalEnv = process.env;

// =====================================
// テストヘルパー
// =====================================

/**
 * NextRequest を作成するヘルパー
 */
function createMockRequest(
	url: string,
	options: {
		method?: string;
		body?: object;
		headers?: Record<string, string>;
		searchParams?: Record<string, string>;
	} = {}
): NextRequest {
	const { method = "GET", body, headers = {}, searchParams = {} } = options;

	// URLにクエリパラメータを追加
	const urlObj = new URL(url, "http://localhost:3000");
	Object.entries(searchParams).forEach(([key, value]) => {
		urlObj.searchParams.set(key, value);
	});

	const requestInit: RequestInit = {
		method,
		headers: {
			"Content-Type": "application/json",
			...headers,
		},
	};

	if (body) {
		requestInit.body = JSON.stringify(body);
	}

	return new NextRequest(urlObj, requestInit);
}

/**
 * レスポンスをパースするヘルパー
 */
async function parseResponse<T>(response: Response): Promise<T> {
	return response.json() as Promise<T>;
}

// =====================================
// テストデータファクトリー
// =====================================
const TestDataFactory = {
	/**
	 * 検索クエリ用のリクエストを生成
	 */
	searchRequest: (query: string) =>
		createMockRequest("/api/search-products", {
			searchParams: { q: query },
		}),

	/**
	 * Webhook リクエストを生成
	 */
	webhookRequest: (eventType: string, data: object) =>
		createMockRequest("/api/webhooks", {
			method: "POST",
			body: {
				type: eventType,
				data,
			},
			headers: {
				"svix-id": "test-svix-id",
				"svix-timestamp": "1234567890",
				"svix-signature": "valid-signature",
			},
		}),

	/**
	 * ユーザーデータを生成
	 */
	userData: (overrides = {}) => ({
		id: TEST_CONFIG.DEFAULT_USER_ID,
		email_addresses: [{ email_address: TEST_CONFIG.TEST_EMAIL }],
		first_name: "Test",
		last_name: "User",
		image_url: "https://example.com/avatar.png",
		...overrides,
	}),

	/**
	 * 商品検索結果を生成
	 */
	searchResults: (count: number = 3) =>
		Array.from({ length: count }, (_, i) => ({
			id: `product-${i + 1}`,
			name: `Product ${i + 1}`,
			slug: `product-${i + 1}`,
			relevance: 1 - i * 0.1,
		})),
};

// =====================================
// テスト本体
// =====================================

// TODO: テスト対象のルートパスに変更
describe("API Route: /api/example", () => {
	// DBモックの参照を取得
	const mockDb = require("@/lib/db").db;

	// 各テスト前にモックをリセット
	beforeEach(() => {
		jest.clearAllMocks();
		process.env = { ...originalEnv };
	});

	afterAll(() => {
		process.env = originalEnv;
	});

	// =====================================
	// GET リクエストのテスト
	// =====================================
	describe("GET", () => {
		describe("正常系", () => {
			it("有効なクエリパラメータで結果を返すこと", async () => {
				// Arrange
				const mockResults = TestDataFactory.searchResults(3);
				mockDb.$queryRaw.mockResolvedValue(mockResults);

				const request = createMockRequest("/api/search-products", {
					searchParams: { q: "test" },
				});

				// Act
				// TODO: ハンドラーを呼び出し
				// const response = await GET(request);
				// const data = await parseResponse(response);

				// Assert
				// expect(response.status).toBe(200);
				// expect(data).toHaveLength(3);
			});

			it("結果が関連度でソートされていること", async () => {
				// Arrange
				const mockResults = TestDataFactory.searchResults(3);
				mockDb.$queryRaw.mockResolvedValue(mockResults);

				const request = createMockRequest("/api/search-products", {
					searchParams: { q: "test" },
				});

				// Act
				// TODO: ハンドラーを呼び出し
				// const response = await GET(request);
				// const data = await parseResponse<Array<{ relevance: number }>>(response);

				// Assert
				// data.forEach((item, index) => {
				//     if (index > 0) {
				//         expect(item.relevance).toBeLessThanOrEqual(data[index - 1].relevance);
				//     }
				// });
			});
		});

		describe("境界値", () => {
			it("クエリパラメータが空の場合、空配列を返すこと", async () => {
				// Arrange
				const request = createMockRequest("/api/search-products", {
					searchParams: { q: "" },
				});

				// Act
				// TODO: ハンドラーを呼び出し
				// const response = await GET(request);
				// const data = await parseResponse(response);

				// Assert
				// expect(response.status).toBe(200);
				// expect(data).toEqual([]);
			});

			it("クエリパラメータがない場合、空配列を返すこと", async () => {
				// Arrange
				const request = createMockRequest("/api/search-products");

				// Act
				// TODO: ハンドラーを呼び出し
				// const response = await GET(request);
				// const data = await parseResponse(response);

				// Assert
				// expect(response.status).toBe(200);
				// expect(data).toEqual([]);
			});

			it("最大件数（50件）の制限が適用されること", async () => {
				// Arrange
				const mockResults = TestDataFactory.searchResults(100);
				mockDb.$queryRaw.mockResolvedValue(mockResults.slice(0, 50));

				const request = createMockRequest("/api/search-products", {
					searchParams: { q: "test" },
				});

				// Act
				// TODO: ハンドラーを呼び出し
				// const response = await GET(request);
				// const data = await parseResponse<Array<unknown>>(response);

				// Assert
				// expect(data.length).toBeLessThanOrEqual(50);
			});
		});

		describe("セキュリティ", () => {
			const sqlInjectionPatterns = [
				"'; DROP TABLE products; --",
				"1 OR 1=1",
				"<script>alert('xss')</script>",
				"UNION SELECT * FROM users",
			];

			sqlInjectionPatterns.forEach((pattern) => {
				it(`SQLインジェクションパターン "${pattern.substring(0, 20)}..." が無害化されること`, async () => {
					// Arrange
					mockDb.$queryRaw.mockResolvedValue([]);

					const request = createMockRequest("/api/search-products", {
						searchParams: { q: pattern },
					});

					// Act
					// TODO: ハンドラーを呼び出し
					// const response = await GET(request);

					// Assert
					// expect(response.status).toBe(200);
					// DBが安全に呼び出されたことを確認
					// expect(mockDb.$queryRaw).toHaveBeenCalled();
				});
			});
		});

		describe("エラーハンドリング", () => {
			it("データベースエラー時に500エラーを返すこと", async () => {
				// Arrange
				mockDb.$queryRaw.mockRejectedValue(
					new Error(TEST_CONFIG.ERROR_MESSAGES.DATABASE_ERROR)
				);

				const request = createMockRequest("/api/search-products", {
					searchParams: { q: "test" },
				});

				// Act
				// TODO: ハンドラーを呼び出し
				// const response = await GET(request);

				// Assert
				// expect(response.status).toBe(500);
			});
		});
	});

	// =====================================
	// POST リクエストのテスト
	// =====================================
	describe("POST", () => {
		describe("正常系", () => {
			it("有効なリクエストボディで処理が成功すること", async () => {
				// Arrange
				const requestBody = { key: "value" };
				const request = createMockRequest("/api/example", {
					method: "POST",
					body: requestBody,
				});

				// Act
				// TODO: ハンドラーを呼び出し
				// const response = await POST(request);

				// Assert
				// expect(response.status).toBe(200);
			});
		});

		describe("バリデーション", () => {
			it("リクエストボディが空の場合、400エラーを返すこと", async () => {
				// Arrange
				const request = createMockRequest("/api/example", {
					method: "POST",
					body: {},
				});

				// Act
				// TODO: ハンドラーを呼び出し
				// const response = await POST(request);

				// Assert
				// expect(response.status).toBe(400);
			});
		});
	});

	// =====================================
	// Webhook テスト（該当する場合）
	// =====================================
	describe("Webhook", () => {
		beforeEach(() => {
			process.env.WEBHOOK_SECRET = "test_webhook_secret";
		});

		describe("署名検証", () => {
			it("WEBHOOK_SECRETが設定されていない場合、エラーをスローすること", async () => {
				// Arrange
				delete process.env.WEBHOOK_SECRET;
				const request = TestDataFactory.webhookRequest(
					"user.created",
					TestDataFactory.userData()
				);

				// Act & Assert
				// TODO: ハンドラーを呼び出し
				// await expect(POST(request)).rejects.toThrow();
			});

			it("svixヘッダーが欠けている場合、400エラーを返すこと", async () => {
				// Arrange
				const request = createMockRequest("/api/webhooks", {
					method: "POST",
					body: { type: "user.created", data: {} },
					// svixヘッダーなし
				});

				// Act
				// TODO: ハンドラーを呼び出し
				// const response = await POST(request);

				// Assert
				// expect(response.status).toBe(400);
			});
		});

		describe("イベント処理", () => {
			it("user.created イベントを正しく処理すること", async () => {
				// Arrange
				const userData = TestDataFactory.userData();
				mockDb.user.upsert.mockResolvedValue({ id: userData.id });

				// Note: 実際のテストでは svix の検証をモックする必要があります

				// Act
				// TODO: ハンドラーを呼び出し（svix検証をモック）
				// const response = await POST(request);

				// Assert
				// expect(mockDb.user.upsert).toHaveBeenCalledWith(
				//     expect.objectContaining({
				//         where: { clerkId: userData.id },
				//     })
				// );
			});

			it("user.deleted イベントを正しく処理すること", async () => {
				// Arrange
				const userData = TestDataFactory.userData();
				mockDb.user.delete.mockResolvedValue({ id: userData.id });

				// Act
				// TODO: ハンドラーを呼び出し

				// Assert
				// expect(mockDb.user.delete).toHaveBeenCalledWith({
				//     where: { clerkId: userData.id },
				// });
			});
		});
	});
});

// =====================================
// 型定義（必要に応じて）
// =====================================
interface SearchResult {
	id: string;
	name: string;
	slug: string;
	relevance: number;
}

interface WebhookPayload {
	type: string;
	data: Record<string, unknown>;
}
