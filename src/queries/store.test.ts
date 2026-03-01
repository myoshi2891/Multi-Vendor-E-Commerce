import { currentUser } from "@clerk/nextjs/server";
import {
    getStoreDefaultShippingDetails,
    upsertStore,
    updateStoreDefaultShippingDetails,
    getStoreShippingRates,
    upsertShippingRate,
    getStoreOrders,
    applySeller,
    getAllStores,
    updateStoreStatus,
    deleteStore,
    getStorePageDetails,
} from "./store";
import { TEST_CONFIG } from "../config/test-config";

// Mock the database
jest.mock("@/lib/db", () => ({
    db: {
        store: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
        country: {
            findMany: jest.fn(),
        },
        shippingRate: {
            findMany: jest.fn(),
            upsert: jest.fn(),
        },
        orderGroup: {
            findMany: jest.fn(),
        },
        user: {
            update: jest.fn(),
        },
    },
}));

// Mock Clerk
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

// テストデータファクトリー
const TestDataFactory = {
    validUser: (role: string = "SELLER") => ({
        id: TEST_CONFIG.DEFAULT_USER_ID,
        privateMetadata: { role },
    }),

    invalidUser: () => null,

    validStoreData: (overrides = {}) => ({
        name: "Test Store",
        email: TEST_CONFIG.TEST_EMAIL,
        url: TEST_CONFIG.TEST_STORE_URL,
        phone: TEST_CONFIG.TEST_PHONE,
        ...overrides,
    }),

    existingStore: (overrides = {}) => ({
        id: TEST_CONFIG.DEFAULT_STORE_ID,
        name: "Existing Store",
        url: "existing-store",
        email: "existing@example.com",
        phone: TEST_CONFIG.TEST_PHONE,
        description: "",
        logo: "",
        cover: "",
        featured: false,
        status: "PENDING",
        defaultShippingService: TEST_CONFIG.DEFAULT_SHIPPING_SERVICE,
        returnPolicy: TEST_CONFIG.DEFAULT_RETURN_POLICY,
        userId: TEST_CONFIG.DEFAULT_USER_ID,
        ...overrides,
    }),

    shippingDetails: (overrides = {}) => ({
        defaultShippingService: "Express Delivery",
        defaultShippingFeePerItem: 10.5,
        defaultShippingFeeForAdditionalItem: 5.25,
        defaultShippingFeePerKg: 2.75,
        defaultShippingFeeFixed: 15.0,
        defaultDeliveryTimeMin: 3,
        defaultDeliveryTimeMax: 7,
        returnPolicy: "Return within 14 days with receipt.",
        ...overrides,
    }),

    createStoreExpectedData: (
        storeData: {
            name: string;
            email: string;
            url: string;
            phone?: string;
            description?: string;
            logo?: string;
            cover?: string;
            featured?: boolean;
            status?: string;
            defaultShippingService?: string;
            returnPolicy?: string;
        },
        userId: string = TEST_CONFIG.DEFAULT_USER_ID
    ) => ({
        name: storeData.name,
        email: storeData.email,
        url: storeData.url,
        phone: storeData.phone || "",
        description: storeData.description || "",
        logo: storeData.logo || "",
        cover: storeData.cover || "",
        featured: storeData.featured || false,
        status: storeData.status || "PENDING",
        defaultShippingService:
            storeData.defaultShippingService ||
            TEST_CONFIG.DEFAULT_SHIPPING_SERVICE,
        returnPolicy:
            storeData.returnPolicy || TEST_CONFIG.DEFAULT_RETURN_POLICY,
        userId,
    }),

    databaseError: (
        message: string = TEST_CONFIG.ERROR_MESSAGES.DATABASE_ERROR
    ) => new Error(message),

    validationError: (
        message: string = TEST_CONFIG.ERROR_MESSAGES.VALIDATION_ERROR
    ) => new Error(message),
};

// テストヘルパー
class TestHelpers {
    static mockCurrentUser(user: Record<string, unknown> | null) {
        (currentUser as jest.Mock).mockResolvedValue(user);
    }

    static mockAuthenticatedSeller() {
        this.mockCurrentUser(TestDataFactory.validUser());
    }

    static mockUnauthenticatedUser() {
        this.mockCurrentUser(TestDataFactory.invalidUser());
    }

    static mockUserWithRole(role: string) {
        this.mockCurrentUser(TestDataFactory.validUser(role));
    }

    static mockDbMethods() {
        const mockDb = require("@/lib/db").db.store;
        return {
            findFirst: jest.spyOn(mockDb, "findFirst"),
            findUnique: jest.spyOn(mockDb, "findUnique"),
            create: jest.spyOn(mockDb, "create"),
            update: jest.spyOn(mockDb, "update"),
        };
    }

    static mockConsoleError() {
        return jest.spyOn(console, "error").mockImplementation(() => {});
    }

    static async expectThrowError(
        promise: Promise<unknown>,
        expectedError: string
    ) {
        await expect(promise).rejects.toThrow(expectedError);
    }

    static expectDbMethodNotCalled(method: jest.SpyInstance) {
        expect(method).not.toHaveBeenCalled();
    }

    static expectDbMethodCalledTimes(method: jest.SpyInstance, times: number) {
        expect(method).toHaveBeenCalledTimes(times);
    }

    static expectStoreCreatedWith(
        mockCreate: jest.SpyInstance,
        expectedData: any
    ) {
        expect(mockCreate).toHaveBeenCalledWith({
            data: expectedData,
        });
    }

    static expectStoreUpdatedWith(
        mockUpdate: jest.SpyInstance,
        storeId: string,
        expectedData: any
    ) {
        expect(mockUpdate).toHaveBeenCalledWith({
            where: { id: storeId },
            data: expectedData,
        });
    }

    static expectOwnershipCheck(
        mockFindFirst: jest.SpyInstance,
        storeId: string,
        userId: string
    ) {
        expect(mockFindFirst).toHaveBeenCalledWith({
            where: {
                id: storeId,
                userId: userId,
            },
        });
    }

    static expectDuplicateCheck(
        mockFindFirst: jest.SpyInstance,
        storeData: any,
        excludeId?: string
    ) {
        const whereCondition = excludeId
            ? {
                  AND: [
                      {
                          OR: [
                              { name: storeData.name },
                              { url: storeData.url },
                              { email: storeData.email },
                              { phone: storeData.phone },
                          ],
                      },
                      {
                          NOT: {
                              id: excludeId,
                          },
                      },
                  ],
              }
            : {
                  OR: [
                      { name: storeData.name },
                      { url: storeData.url },
                      { email: storeData.email },
                      { phone: storeData.phone },
                  ],
              };

        expect(mockFindFirst).toHaveBeenCalledWith({
            where: whereCondition,
        });
    }

    static expectShippingDetailsQuery(
        mockFindUnique: jest.SpyInstance,
        url: string
    ) {
        expect(mockFindUnique).toHaveBeenCalledWith({
            where: { url },
            select: {
                defaultShippingService: true,
                defaultShippingFeePerItem: true,
                defaultShippingFeeForAdditionalItem: true,
                defaultShippingFeePerKg: true,
                defaultShippingFeeFixed: true,
                defaultDeliveryTimeMin: true,
                defaultDeliveryTimeMax: true,
                returnPolicy: true,
            },
        });
    }

    static expectResultToContainShippingFields(result: any) {
        const expectedFields = [
            "defaultShippingService",
            "defaultShippingFeePerItem",
            "defaultShippingFeeForAdditionalItem",
            "defaultShippingFeePerKg",
            "defaultShippingFeeFixed",
            "defaultDeliveryTimeMin",
            "defaultDeliveryTimeMax",
            "returnPolicy",
        ];

        expect(Object.keys(result)).toEqual(expectedFields);
    }

    static expectResultToExcludeStoreFields(result: any) {
        const excludedFields = [
            "id",
            "name",
            "email",
            "url",
            "phone",
            "description",
            "logo",
            "cover",
            "featured",
            "status",
            "userId",
            "createdAt",
            "updatedAt",
        ];

        excludedFields.forEach((field) => {
            expect(result).not.toHaveProperty(field);
        });
    }

    static expectUpdateStoreShippingWith(
        mockUpdate: jest.SpyInstance,
        storeUrl: string,
        userId: string,
        shippingDetails: any
    ) {
        expect(mockUpdate).toHaveBeenCalledWith({
            where: {
                url: storeUrl,
                userId: userId,
            },
            data: shippingDetails,
        });
    }

    static expectStoreOwnershipCheck(
        mockFindUnique: jest.SpyInstance,
        storeUrl: string,
        userId: string
    ) {
        expect(mockFindUnique).toHaveBeenCalledWith({
            where: {
                url: storeUrl,
                userId: userId,
            },
        });
    }
}

// テスト定数
const TEST_ERRORS = {
    UNAUTHENTICATED: "Unauthenticated.",
    UNAUTHORIZED_ROLE: "Only sellers can perform this action.",
    MISSING_STORE_DATA: "Please provide store data.",
    DUPLICATE_NAME: "A store with the same name already exists.",
    DUPLICATE_URL: "A store with the same URL already exists.",
    DUPLICATE_PHONE: "A store with the same phone number already exists.",
    MISSING_STORE_URL: "Please provide store URL.",
    MISSING_SHIPPING_DETAILS: "Please provide shipping details.",
    UNAUTHORIZED_STORE_UPDATE: "You are not authorized to update this store.",
    STORE_NOT_FOUND: (url: string) => `Store with URL "${url}" not found.`,
} as const;

// テストスイート設定
const DUPLICATE_TEST_CASES = [
    {
        field: "name",
        conflictingStore: { name: "Test Store" },
        error: TEST_ERRORS.DUPLICATE_NAME,
    },
    {
        field: "url",
        conflictingStore: { url: TEST_CONFIG.TEST_STORE_URL },
        error: TEST_ERRORS.DUPLICATE_URL,
    },
    {
        field: "phone",
        conflictingStore: { phone: TEST_CONFIG.TEST_PHONE },
        error: TEST_ERRORS.DUPLICATE_PHONE,
    },
] as const;

const INVALID_URL_INPUTS = [
    { input: null, description: "null" },
    { input: undefined, description: "undefined" },
    { input: "", description: "空文字列" },
    { input: "   ", description: "空白文字のみ" },
] as const;

beforeEach(() => {
    jest.clearAllMocks();
});

describe("upsertStore", () => {
    describe("認証・権限エラー", () => {
        it("ユーザーが未認証の場合はエラーをスローする", async () => {
            TestHelpers.mockUnauthenticatedUser();
            const storeData = TestDataFactory.validStoreData();

            await TestHelpers.expectThrowError(
                upsertStore(storeData),
                TEST_ERRORS.UNAUTHENTICATED
            );
        });

        it("ユーザーロールがSELLERでない場合はエラーをスローする", async () => {
            TestHelpers.mockUserWithRole("BUYER");
            const storeData = TestDataFactory.validStoreData();

            await TestHelpers.expectThrowError(
                upsertStore(storeData),
                TEST_ERRORS.UNAUTHORIZED_ROLE
            );
        });
    });

    describe("バリデーションエラー", () => {
        beforeEach(() => {
            TestHelpers.mockAuthenticatedSeller();
        });

        it("ストアデータが提供されない場合はエラーをスローする", async () => {
            await TestHelpers.expectThrowError(
                upsertStore(null as any),
                TEST_ERRORS.MISSING_STORE_DATA
            );
        });

        describe("重複チェック", () => {
            DUPLICATE_TEST_CASES.forEach(
                ({ field, conflictingStore, error }) => {
                    it(`${field}が重複している場合はエラーをスローする`, async () => {
                        const mockDb = TestHelpers.mockDbMethods();
                        mockDb.findFirst.mockResolvedValue(
                            TestDataFactory.existingStore(conflictingStore)
                        );

                        const storeData = TestDataFactory.validStoreData();

                        await TestHelpers.expectThrowError(
                            upsertStore(storeData),
                            error
                        );
                        TestHelpers.expectDuplicateCheck(
                            mockDb.findFirst,
                            storeData
                        );
                    });
                }
            );
        });
    });

    describe("新規ストア作成", () => {
        beforeEach(() => {
            TestHelpers.mockAuthenticatedSeller();
        });

        it("必須フィールド付きで新しいストアを正常に作成する", async () => {
            const mockDb = TestHelpers.mockDbMethods();
            mockDb.findFirst.mockResolvedValue(null);

            const storeData = TestDataFactory.validStoreData();
            const expectedStore = TestDataFactory.existingStore({
                ...storeData,
                id: TEST_CONFIG.DEFAULT_STORE_ID,
            });
            mockDb.create.mockResolvedValue(expectedStore);

            const result = await upsertStore(storeData);

            expect(result).toEqual(expectedStore);
            TestHelpers.expectStoreCreatedWith(
                mockDb.create,
                TestDataFactory.createStoreExpectedData(storeData)
            );
            TestHelpers.expectDuplicateCheck(mockDb.findFirst, storeData);
        });

        it("オプショナルフィールドが未提供の場合はデフォルト値で新しいストアを作成する", async () => {
            const mockDb = TestHelpers.mockDbMethods();
            mockDb.findFirst.mockResolvedValue(null);

            const storeData = TestDataFactory.validStoreData();
            delete (storeData as any).phone;

            const expectedStore = TestDataFactory.existingStore({
                ...storeData,
                phone: "",
                id: TEST_CONFIG.DEFAULT_STORE_ID,
            });
            mockDb.create.mockResolvedValue(expectedStore);

            const result = await upsertStore(storeData);

            expect(result).toEqual(expectedStore);
            TestHelpers.expectStoreCreatedWith(
                mockDb.create,
                TestDataFactory.createStoreExpectedData(storeData)
            );
        });
    });

    describe("ストア更新", () => {
        beforeEach(() => {
            TestHelpers.mockAuthenticatedSeller();
        });

        it("ストアIDが提供された場合は既存のストアを正常に更新する", async () => {
            const mockDb = TestHelpers.mockDbMethods();

            const existingStore = TestDataFactory.existingStore();
            mockDb.findFirst
                .mockResolvedValueOnce(existingStore) // 所有権チェック
                .mockResolvedValueOnce(null); // 重複チェック

            const updateData = {
                id: TEST_CONFIG.DEFAULT_STORE_ID,
                name: "Updated Store Name",
                email: "updated@example.com",
                url: "updated-store",
                phone: "9876543210",
                status: "ACTIVE" as any,
                description: "Updated description",
            };

            const updatedStore = TestDataFactory.existingStore(updateData);
            mockDb.update.mockResolvedValue(updatedStore);

            const result = await upsertStore(updateData);

            expect(result).toEqual(updatedStore);
            TestHelpers.expectDbMethodCalledTimes(mockDb.findFirst, 2);

            // 所有権チェックの確認
            TestHelpers.expectOwnershipCheck(
                mockDb.findFirst,
                TEST_CONFIG.DEFAULT_STORE_ID,
                TEST_CONFIG.DEFAULT_USER_ID
            );

            // 重複チェックの確認
            TestHelpers.expectDuplicateCheck(
                mockDb.findFirst,
                updateData,
                TEST_CONFIG.DEFAULT_STORE_ID
            );

            TestHelpers.expectStoreUpdatedWith(
                mockDb.update,
                TEST_CONFIG.DEFAULT_STORE_ID,
                expect.objectContaining({
                    name: "Updated Store Name",
                    email: "updated@example.com",
                    status: "ACTIVE",
                })
            );

            TestHelpers.expectDbMethodNotCalled(mockDb.create);
        });
    });
});

describe("updateStoreDefaultShippingDetails", () => {
    describe("認証・権限エラー", () => {
        it("ユーザーが未認証の場合はエラーをスローする", async () => {
            TestHelpers.mockUnauthenticatedUser();
            const mockDb = TestHelpers.mockDbMethods();
            const shippingDetails = TestDataFactory.shippingDetails();

            await TestHelpers.expectThrowError(
                updateStoreDefaultShippingDetails(
                    TEST_CONFIG.TEST_STORE_URL,
                    shippingDetails
                ),
                TEST_ERRORS.UNAUTHENTICATED
            );

            TestHelpers.expectDbMethodNotCalled(mockDb.findUnique);
            TestHelpers.expectDbMethodNotCalled(mockDb.update);
        });

        it("ユーザーロールがSELLERでない場合はエラーをスローする", async () => {
            TestHelpers.mockUserWithRole("BUYER");
            const mockDb = TestHelpers.mockDbMethods();
            const shippingDetails = TestDataFactory.shippingDetails();

            await TestHelpers.expectThrowError(
                updateStoreDefaultShippingDetails(
                    TEST_CONFIG.TEST_STORE_URL,
                    shippingDetails
                ),
                TEST_ERRORS.UNAUTHORIZED_ROLE
            );

            TestHelpers.expectDbMethodNotCalled(mockDb.findUnique);
            TestHelpers.expectDbMethodNotCalled(mockDb.update);
        });
    });

    describe("パラメータバリデーション", () => {
        beforeEach(() => {
            TestHelpers.mockAuthenticatedSeller();
        });

        it("storeUrlが提供されない場合はエラーをスローする", async () => {
            const mockDb = TestHelpers.mockDbMethods();
            const shippingDetails = TestDataFactory.shippingDetails();

            await TestHelpers.expectThrowError(
                updateStoreDefaultShippingDetails(null as any, shippingDetails),
                TEST_ERRORS.MISSING_STORE_URL
            );

            TestHelpers.expectDbMethodNotCalled(mockDb.findUnique);
            TestHelpers.expectDbMethodNotCalled(mockDb.update);
        });

        it("detailsが提供されない場合はエラーをスローする", async () => {
            const mockDb = TestHelpers.mockDbMethods();

            await TestHelpers.expectThrowError(
                updateStoreDefaultShippingDetails(
                    TEST_CONFIG.TEST_STORE_URL,
                    null as any
                ),
                TEST_ERRORS.MISSING_SHIPPING_DETAILS
            );

            TestHelpers.expectDbMethodNotCalled(mockDb.findUnique);
            TestHelpers.expectDbMethodNotCalled(mockDb.update);
        });
    });

    describe("認可チェック", () => {
        beforeEach(() => {
            TestHelpers.mockAuthenticatedSeller();
        });

        it("所有権チェックで指定されたストアが見つからない場合はエラーをスローする", async () => {
            const mockDb = TestHelpers.mockDbMethods();
            const shippingDetails = TestDataFactory.shippingDetails();

            mockDb.findUnique.mockResolvedValue(null);

            await TestHelpers.expectThrowError(
                updateStoreDefaultShippingDetails(
                    TEST_CONFIG.TEST_STORE_URL,
                    shippingDetails
                ),
                TEST_ERRORS.UNAUTHORIZED_STORE_UPDATE
            );

            TestHelpers.expectStoreOwnershipCheck(
                mockDb.findUnique,
                TEST_CONFIG.TEST_STORE_URL,
                TEST_CONFIG.DEFAULT_USER_ID
            );

            TestHelpers.expectDbMethodNotCalled(mockDb.update);
        });
    });

    describe("正常な更新処理", () => {
        beforeEach(() => {
            TestHelpers.mockAuthenticatedSeller();
        });

        it("ストアの所有者が有効なパラメータを提供した場合にストアを正常に更新する", async () => {
            const mockDb = TestHelpers.mockDbMethods();
            const shippingDetails = TestDataFactory.shippingDetails();
            const existingStore = TestDataFactory.existingStore();
            const updatedStore = TestDataFactory.existingStore(shippingDetails);

            mockDb.findUnique.mockResolvedValue(existingStore);
            mockDb.update.mockResolvedValue(updatedStore);

            const result = await updateStoreDefaultShippingDetails(
                TEST_CONFIG.TEST_STORE_URL,
                shippingDetails
            );

            expect(result).toEqual(updatedStore);

            TestHelpers.expectStoreOwnershipCheck(
                mockDb.findUnique,
                TEST_CONFIG.TEST_STORE_URL,
                TEST_CONFIG.DEFAULT_USER_ID
            );

            TestHelpers.expectUpdateStoreShippingWith(
                mockDb.update,
                TEST_CONFIG.TEST_STORE_URL,
                TEST_CONFIG.DEFAULT_USER_ID,
                shippingDetails
            );

            TestHelpers.expectDbMethodCalledTimes(mockDb.findUnique, 1);
            TestHelpers.expectDbMethodCalledTimes(mockDb.update, 1);
        });
    });

    describe("エラーハンドリング", () => {
        let consoleErrorSpy: jest.SpyInstance;

        beforeEach(() => {
            TestHelpers.mockAuthenticatedSeller();
            consoleErrorSpy = TestHelpers.mockConsoleError();
        });

        afterEach(() => {
            consoleErrorSpy.mockRestore();
        });

        it("所有権チェック中にデータベースエラーが発生した場合はエラーをログに出力し、エラーを再スローする", async () => {
            const mockDb = TestHelpers.mockDbMethods();
            const shippingDetails = TestDataFactory.shippingDetails();
            const mockError = TestDataFactory.databaseError(
                "Database connection failed during ownership check"
            );

            mockDb.findUnique.mockRejectedValue(mockError);

            await TestHelpers.expectThrowError(
                updateStoreDefaultShippingDetails(
                    TEST_CONFIG.TEST_STORE_URL,
                    shippingDetails
                ),
                "Database connection failed during ownership check"
            );

            TestHelpers.expectStoreOwnershipCheck(
                mockDb.findUnique,
                TEST_CONFIG.TEST_STORE_URL,
                TEST_CONFIG.DEFAULT_USER_ID
            );

            expect(consoleErrorSpy).toHaveBeenCalledWith(mockError);
            TestHelpers.expectDbMethodNotCalled(mockDb.update);
        });

        it("更新操作中にデータベースエラーが発生した場合はエラーをログに出力し、エラーを再スローする", async () => {
            const mockDb = TestHelpers.mockDbMethods();
            const shippingDetails = TestDataFactory.shippingDetails();
            const existingStore = TestDataFactory.existingStore();
            const mockError = TestDataFactory.databaseError(
                "Database connection failed during store update"
            );

            mockDb.findUnique.mockResolvedValue(existingStore);
            mockDb.update.mockRejectedValue(mockError);

            await TestHelpers.expectThrowError(
                updateStoreDefaultShippingDetails(
                    TEST_CONFIG.TEST_STORE_URL,
                    shippingDetails
                ),
                "Database connection failed during store update"
            );

            TestHelpers.expectStoreOwnershipCheck(
                mockDb.findUnique,
                TEST_CONFIG.TEST_STORE_URL,
                TEST_CONFIG.DEFAULT_USER_ID
            );

            TestHelpers.expectUpdateStoreShippingWith(
                mockDb.update,
                TEST_CONFIG.TEST_STORE_URL,
                TEST_CONFIG.DEFAULT_USER_ID,
                shippingDetails
            );

            expect(consoleErrorSpy).toHaveBeenCalledWith(mockError);
            TestHelpers.expectDbMethodCalledTimes(mockDb.findUnique, 1);
            TestHelpers.expectDbMethodCalledTimes(mockDb.update, 1);
        });
    });
});

describe("getStoreDefaultShippingDetails", () => {
    describe("パラメータバリデーション", () => {
        INVALID_URL_INPUTS.forEach(({ input, description }) => {
            it(`storeUrlが${description}の場合はエラーをスローする`, async () => {
                const mockDb = TestHelpers.mockDbMethods();

                await TestHelpers.expectThrowError(
                    getStoreDefaultShippingDetails(input as any),
                    TEST_ERRORS.MISSING_STORE_URL
                );

                TestHelpers.expectDbMethodNotCalled(mockDb.findUnique);
            });
        });
    });

    describe("ストア存在チェック", () => {
        it("指定されたURLのストアが存在しない場合はエラーをスローする", async () => {
            const mockDb = TestHelpers.mockDbMethods();
            mockDb.findUnique.mockResolvedValue(null);

            const storeUrl = "non-existent-store";

            await TestHelpers.expectThrowError(
                getStoreDefaultShippingDetails(storeUrl),
                TEST_ERRORS.STORE_NOT_FOUND(storeUrl)
            );

            TestHelpers.expectShippingDetailsQuery(mockDb.findUnique, storeUrl);
        });
    });

    describe("正常なデータ取得", () => {
        it("全フィールドが入力されているストアの配送詳細を正常に返す", async () => {
            const mockDb = TestHelpers.mockDbMethods();
            const mockStore = TestDataFactory.shippingDetails();
            mockDb.findUnique.mockResolvedValue(mockStore);

            const result = await getStoreDefaultShippingDetails(
                TEST_CONFIG.TEST_STORE_URL
            );

            expect(result).toEqual(mockStore);
            expect(result).toMatchObject({
                defaultShippingService: "Express Delivery",
                defaultShippingFeePerItem: 10.5,
                returnPolicy: "Return within 14 days with receipt.",
            });

            TestHelpers.expectShippingDetailsQuery(
                mockDb.findUnique,
                TEST_CONFIG.TEST_STORE_URL
            );
        });

        it("一部フィールドがnullのストアの配送詳細を正常に返す", async () => {
            const mockDb = TestHelpers.mockDbMethods();
            const mockStore = TestDataFactory.shippingDetails({
                defaultShippingFeePerItem: null,
                defaultShippingFeePerKg: null,
                defaultDeliveryTimeMin: null,
                returnPolicy: null,
            });
            mockDb.findUnique.mockResolvedValue(mockStore);

            const result = await getStoreDefaultShippingDetails(
                "test-store-with-nulls"
            );

            expect(result).toEqual(mockStore);
            expect(result.defaultShippingFeePerItem).toBeNull();
            expect(result.returnPolicy).toBeNull();

            TestHelpers.expectShippingDetailsQuery(
                mockDb.findUnique,
                "test-store-with-nulls"
            );
        });

        it("配送関連フィールドのみを選択し、他のストアプロパティは除外する", async () => {
            const mockDb = TestHelpers.mockDbMethods();
            const mockStore = TestDataFactory.shippingDetails();
            mockDb.findUnique.mockResolvedValue(mockStore);

            const result = await getStoreDefaultShippingDetails(
                TEST_CONFIG.TEST_STORE_URL
            );

            TestHelpers.expectResultToContainShippingFields(result);
            TestHelpers.expectResultToExcludeStoreFields(result);
        });
    });

    describe("エラーハンドリング", () => {
        let consoleErrorSpy: jest.SpyInstance;

        beforeEach(() => {
            consoleErrorSpy = TestHelpers.mockConsoleError();
        });

        afterEach(() => {
            consoleErrorSpy.mockRestore();
        });

        it("データベース接続エラーを適切に処理し、エラーを再スローする", async () => {
            const mockDb = TestHelpers.mockDbMethods();
            const mockError = TestDataFactory.databaseError();
            mockDb.findUnique.mockRejectedValue(mockError);

            await TestHelpers.expectThrowError(
                getStoreDefaultShippingDetails(TEST_CONFIG.TEST_STORE_URL),
                TEST_CONFIG.ERROR_MESSAGES.DATABASE_ERROR
            );

            TestHelpers.expectShippingDetailsQuery(
                mockDb.findUnique,
                TEST_CONFIG.TEST_STORE_URL
            );
        });

        it("実行中にエラーが発生した場合はコンソールにログを出力する", async () => {
            const mockDb = TestHelpers.mockDbMethods();
            const mockError = new Error("Test error for logging");
            mockDb.findUnique.mockRejectedValue(mockError);

            await TestHelpers.expectThrowError(
                getStoreDefaultShippingDetails(TEST_CONFIG.TEST_STORE_URL),
                "Test error for logging"
            );

            expect(consoleErrorSpy).toHaveBeenCalledWith(mockError);
        });

        it("バリデーションエラーを適切に処理する", async () => {
            const validationError = TestDataFactory.validationError(
                "Invalid store URL format"
            );
            const mockDb = TestHelpers.mockDbMethods();
            mockDb.findUnique.mockRejectedValue(validationError);

            await TestHelpers.expectThrowError(
                getStoreDefaultShippingDetails(TEST_CONFIG.TEST_STORE_URL),
                "Invalid store URL format"
            );

            expect(consoleErrorSpy).toHaveBeenCalledWith(validationError);
        });
    });
});

// ==================================================
// 以降: 未テスト関数の追加テスト
// ==================================================
// 注: 前半の TestHelpers.mockDbMethods() は db.store のスパイラッパーを返す。
// ここでは db 全体（store, country, shippingRate 等）を参照するため別変数を使用。
const mockPrisma = require("@/lib/db").db;

// ==================================================
// getStoreShippingRates
// ==================================================
describe("getStoreShippingRates", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            TestHelpers.mockUnauthenticatedUser();

            await expect(
                getStoreShippingRates("test-store")
            ).rejects.toThrow("Unauthenticated.");
        });

        it("SELLERロール以外の場合エラーをスローする", async () => {
            TestHelpers.mockUserWithRole("USER");

            await expect(
                getStoreShippingRates("test-store")
            ).rejects.toThrow("Only sellers can perform this action.");
        });
    });

    describe("IDOR防止（ストア所有権検証）", () => {
        it("他人のストアの配送レートを取得できない", async () => {
            TestHelpers.mockAuthenticatedSeller();
            mockPrisma.store.findUnique.mockResolvedValue(null);

            await expect(
                getStoreShippingRates("other-store")
            ).rejects.toThrow(
                "You are not authorized to update this store."
            );
        });
    });

    describe("正常系", () => {
        it("全国と配送レートのマッピングを返す", async () => {
            TestHelpers.mockAuthenticatedSeller();
            const store = TestDataFactory.existingStore();
            mockPrisma.store.findUnique.mockResolvedValue(store);

            const countries = [
                { id: "c1", name: "Japan" },
                { id: "c2", name: "USA" },
            ];
            mockPrisma.country.findMany.mockResolvedValue(countries);

            const rates = [
                { countryId: "c1", shippingFeePerItem: 10.0 },
            ];
            mockPrisma.shippingRate.findMany.mockResolvedValue(rates);

            const result = await getStoreShippingRates(
                TEST_CONFIG.TEST_STORE_URL
            );

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                countryId: "c1",
                countryName: "Japan",
                shippingRate: rates[0],
            });
            // レートが無い国はnull
            expect(result[1]).toEqual({
                countryId: "c2",
                countryName: "USA",
                shippingRate: null,
            });
        });

        it("国を名前昇順でクエリする", async () => {
            TestHelpers.mockAuthenticatedSeller();
            mockPrisma.store.findUnique.mockResolvedValue(
                TestDataFactory.existingStore()
            );
            mockPrisma.country.findMany.mockResolvedValue([]);
            mockPrisma.shippingRate.findMany.mockResolvedValue([]);

            await getStoreShippingRates(TEST_CONFIG.TEST_STORE_URL);

            expect(mockPrisma.country.findMany).toHaveBeenCalledWith({
                orderBy: { name: "asc" },
            });
        });
    });
});

// ==================================================
// upsertShippingRate
// ==================================================
describe("upsertShippingRate", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            TestHelpers.mockUnauthenticatedUser();

            await expect(
                upsertShippingRate(
                    "test-store",
                    { countryId: "c1" } as never
                )
            ).rejects.toThrow("Unauthenticated.");
        });

        it("SELLERロール以外の場合エラーをスローする", async () => {
            TestHelpers.mockUserWithRole("USER");

            await expect(
                upsertShippingRate(
                    "test-store",
                    { countryId: "c1" } as never
                )
            ).rejects.toThrow("Only sellers can perform this action.");
        });
    });

    describe("IDOR防止", () => {
        it("他人のストアの配送レートを更新できない", async () => {
            TestHelpers.mockAuthenticatedSeller();
            mockPrisma.store.findUnique.mockResolvedValue(null);

            await expect(
                upsertShippingRate(
                    "other-store",
                    { countryId: "c1" } as never
                )
            ).rejects.toThrow(
                "You are not authorized to update this store."
            );
        });
    });

    describe("バリデーション", () => {
        beforeEach(() => {
            TestHelpers.mockAuthenticatedSeller();
            mockPrisma.store.findUnique.mockResolvedValue(
                TestDataFactory.existingStore()
            );
        });

        it("配送レートデータがnullの場合エラーをスローする", async () => {
            await expect(
                upsertShippingRate("test-store", null as never)
            ).rejects.toThrow("Please provide shipping rate data.");
        });

        it("countryIdがない場合エラーをスローする", async () => {
            await expect(
                upsertShippingRate("test-store", {} as never)
            ).rejects.toThrow("Please provide country ID.");
        });
    });

    describe("正常系", () => {
        it("配送レートを正常にupsertする", async () => {
            TestHelpers.mockAuthenticatedSeller();
            const store = TestDataFactory.existingStore();
            mockPrisma.store.findUnique.mockResolvedValue(store);

            const rateData = {
                id: "rate-001",
                countryId: "c1",
                shippingFeePerItem: 8.0,
            };
            const upsertedRate = { ...rateData, storeId: store.id };
            mockPrisma.shippingRate.upsert.mockResolvedValue(upsertedRate);

            const result = await upsertShippingRate(
                TEST_CONFIG.TEST_STORE_URL,
                rateData as never
            );

            expect(result).toEqual(upsertedRate);
            expect(mockPrisma.shippingRate.upsert).toHaveBeenCalledWith({
                where: { id: "rate-001" },
                update: expect.objectContaining({
                    storeId: store.id,
                }),
                create: expect.objectContaining({
                    storeId: store.id,
                }),
            });
        });
    });
});

// ==================================================
// getStoreOrders
// ==================================================
describe("getStoreOrders", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            TestHelpers.mockUnauthenticatedUser();

            await expect(
                getStoreOrders("test-store")
            ).rejects.toThrow("Unauthenticated.");
        });

        it("SELLERロール以外の場合エラーをスローする", async () => {
            TestHelpers.mockUserWithRole("USER");

            await expect(
                getStoreOrders("test-store")
            ).rejects.toThrow("Only sellers can perform this action.");
        });
    });

    describe("ストア検証", () => {
        beforeEach(() => {
            TestHelpers.mockAuthenticatedSeller();
        });

        it("存在しないストアの場合エラーをスローする", async () => {
            mockPrisma.store.findUnique.mockResolvedValue(null);

            await expect(
                getStoreOrders("nonexistent")
            ).rejects.toThrow("Store not found.");
        });

        it("他人のストアの注文を取得できない（IDOR防止）", async () => {
            mockPrisma.store.findUnique.mockResolvedValue(
                TestDataFactory.existingStore({
                    userId: "other-user-id",
                })
            );

            await expect(
                getStoreOrders("test-store")
            ).rejects.toThrow(
                "You are not authorized to view this store's orders."
            );
        });
    });

    describe("正常系", () => {
        it("ストアの注文一覧をupdatedAt降順で取得する", async () => {
            TestHelpers.mockAuthenticatedSeller();
            mockPrisma.store.findUnique.mockResolvedValue(
                TestDataFactory.existingStore()
            );

            const orders = [
                { id: "og-1", items: [], coupon: null, order: {} },
                { id: "og-2", items: [], coupon: null, order: {} },
            ];
            mockPrisma.orderGroup.findMany.mockResolvedValue(orders);

            const result = await getStoreOrders(TEST_CONFIG.TEST_STORE_URL);

            expect(result).toHaveLength(2);
            expect(mockPrisma.orderGroup.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { storeId: TEST_CONFIG.DEFAULT_STORE_ID },
                    include: expect.objectContaining({
                        items: true,
                        coupon: true,
                        order: expect.any(Object),
                    }),
                    orderBy: { updatedAt: "desc" },
                })
            );
        });
    });
});

// ==================================================
// applySeller
// ==================================================
describe("applySeller", () => {
    describe("認証エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            TestHelpers.mockUnauthenticatedUser();

            await expect(
                applySeller(TestDataFactory.validStoreData() as never)
            ).rejects.toThrow("Unauthenticated.");
        });
    });

    describe("バリデーション", () => {
        beforeEach(() => {
            TestHelpers.mockCurrentUser({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
        });

        it("ストアデータがnullの場合エラーをスローする", async () => {
            await expect(
                applySeller(null as never)
            ).rejects.toThrow("Please provide store data.");
        });

        it("同名のストアが既に存在する場合エラーをスローする", async () => {
            mockPrisma.store.findFirst.mockResolvedValue({
                name: "Test Store",
                url: "other-url",
                email: "other@example.com",
                phone: "999-0000",
            });

            await expect(
                applySeller(TestDataFactory.validStoreData() as never)
            ).rejects.toThrow(
                "A store with the same name already exists."
            );
        });

        it("同URLのストアが既に存在する場合エラーをスローする", async () => {
            mockPrisma.store.findFirst.mockResolvedValue({
                name: "Different Name",
                url: TEST_CONFIG.TEST_STORE_URL,
                email: "other@example.com",
                phone: "999-0000",
            });

            await expect(
                applySeller(TestDataFactory.validStoreData() as never)
            ).rejects.toThrow(
                "A store with the same URL already exists."
            );
        });
    });

    describe("正常系", () => {
        it("新しいストアを作成しデフォルト値を設定する", async () => {
            TestHelpers.mockCurrentUser({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            mockPrisma.store.findFirst.mockResolvedValue(null);

            const storeData = TestDataFactory.validStoreData();
            const createdStore = {
                ...storeData,
                id: "new-store-id",
                userId: TEST_CONFIG.DEFAULT_USER_ID,
            };
            mockPrisma.store.create.mockResolvedValue(createdStore);

            const result = await applySeller(storeData as never);

            expect(result).toEqual(createdStore);
            expect(mockPrisma.store.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    ...storeData,
                    defaultShippingService: "International Delivery",
                    returnPolicy: "Return in 30 days.",
                    userId: TEST_CONFIG.DEFAULT_USER_ID,
                }),
            });
        });
    });
});

// ==================================================
// getAllStores
// ==================================================
describe("getAllStores", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            TestHelpers.mockUnauthenticatedUser();

            await expect(getAllStores()).rejects.toThrow("Unauthenticated.");
        });

        it("ADMINロール以外の場合エラーをスローする", async () => {
            TestHelpers.mockUserWithRole("SELLER");

            await expect(getAllStores()).rejects.toThrow(
                "Unauthorized Access: Admin Privileges Required to View Stores."
            );
        });
    });

    describe("正常系", () => {
        it("全ストアをcreatedAt降順で取得する", async () => {
            TestHelpers.mockUserWithRole("ADMIN");

            const stores = [
                { id: "s1", name: "Store 1", user: {} },
                { id: "s2", name: "Store 2", user: {} },
            ];
            mockPrisma.store.findMany.mockResolvedValue(stores);

            const result = await getAllStores();

            expect(result).toHaveLength(2);
            expect(mockPrisma.store.findMany).toHaveBeenCalledWith({
                include: { user: true },
                orderBy: { createdAt: "desc" },
            });
        });
    });
});

// ==================================================
// updateStoreStatus
// ==================================================
describe("updateStoreStatus", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            TestHelpers.mockUnauthenticatedUser();

            await expect(
                updateStoreStatus("store-001", "ACTIVE" as never)
            ).rejects.toThrow("Unauthenticated.");
        });

        it("ADMINロール以外の場合エラーをスローする", async () => {
            TestHelpers.mockUserWithRole("SELLER");

            await expect(
                updateStoreStatus("store-001", "ACTIVE" as never)
            ).rejects.toThrow("Only admins can perform this action.");
        });
    });

    describe("バリデーション", () => {
        it("存在しないストアの場合エラーをスローする", async () => {
            TestHelpers.mockUserWithRole("ADMIN");
            mockPrisma.store.findUnique.mockResolvedValue(null);

            await expect(
                updateStoreStatus("nonexistent", "ACTIVE" as never)
            ).rejects.toThrow("Store not found.");
        });
    });

    describe("正常系", () => {
        beforeEach(() => {
            TestHelpers.mockUserWithRole("ADMIN");
        });

        it("ストアのステータスを更新する", async () => {
            mockPrisma.store.findUnique.mockResolvedValue(
                TestDataFactory.existingStore({ status: "ACTIVE" })
            );
            mockPrisma.store.update.mockResolvedValue(
                TestDataFactory.existingStore({ status: "INACTIVE" })
            );

            const result = await updateStoreStatus(
                TEST_CONFIG.DEFAULT_STORE_ID,
                "INACTIVE" as never
            );

            expect(result).toBe("INACTIVE");
            expect(mockPrisma.store.update).toHaveBeenCalledWith({
                where: { id: TEST_CONFIG.DEFAULT_STORE_ID },
                data: { status: "INACTIVE" },
            });
        });

        it("PENDING → ACTIVE遷移時にユーザーのロールをSELLERに昇格する", async () => {
            mockPrisma.store.findUnique.mockResolvedValue(
                TestDataFactory.existingStore({ status: "PENDING" })
            );
            mockPrisma.store.update.mockResolvedValue(
                TestDataFactory.existingStore({
                    status: "ACTIVE",
                    userId: TEST_CONFIG.DEFAULT_USER_ID,
                })
            );
            mockPrisma.user.update.mockResolvedValue({});

            await updateStoreStatus(
                TEST_CONFIG.DEFAULT_STORE_ID,
                "ACTIVE" as never
            );

            expect(mockPrisma.user.update).toHaveBeenCalledWith({
                where: { id: TEST_CONFIG.DEFAULT_USER_ID },
                data: { role: "SELLER" },
            });
        });

        it("ACTIVE → INACTIVE遷移時にはロール昇格しない", async () => {
            mockPrisma.store.findUnique.mockResolvedValue(
                TestDataFactory.existingStore({ status: "ACTIVE" })
            );
            mockPrisma.store.update.mockResolvedValue(
                TestDataFactory.existingStore({ status: "INACTIVE" })
            );

            await updateStoreStatus(
                TEST_CONFIG.DEFAULT_STORE_ID,
                "INACTIVE" as never
            );

            expect(mockPrisma.user.update).not.toHaveBeenCalled();
        });
    });
});

// ==================================================
// deleteStore
// ==================================================
describe("deleteStore", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            TestHelpers.mockUnauthenticatedUser();

            await expect(deleteStore("store-001")).rejects.toThrow(
                "Unauthenticated."
            );
        });

        it("ADMINロール以外の場合エラーをスローする", async () => {
            TestHelpers.mockUserWithRole("SELLER");

            await expect(deleteStore("store-001")).rejects.toThrow(
                "Only admins can perform this action."
            );
        });
    });

    describe("バリデーション", () => {
        it("空のstoreIdの場合エラーをスローする", async () => {
            TestHelpers.mockUserWithRole("ADMIN");

            await expect(deleteStore("")).rejects.toThrow(
                "Please provide store ID."
            );
        });
    });

    describe("正常系", () => {
        it("ソフトデリート（isDeleted=true, deletedAt設定）を実行する", async () => {
            TestHelpers.mockUserWithRole("ADMIN");
            const deletedStore = TestDataFactory.existingStore({
                isDeleted: true,
                deletedAt: new Date(),
            });
            mockPrisma.store.update.mockResolvedValue(deletedStore);

            const result = await deleteStore("store-001");

            expect(result.isDeleted).toBe(true);
            expect(result.deletedAt).toBeDefined();
            expect(mockPrisma.store.update).toHaveBeenCalledWith({
                where: { id: "store-001" },
                data: {
                    isDeleted: true,
                    deletedAt: expect.any(Date),
                },
            });
        });
    });
});

// ==================================================
// getStorePageDetails
// ==================================================
describe("getStorePageDetails", () => {
    it("ACTIVEなストアの公開情報を返す", async () => {
        const storeDetails = {
            id: "store-001",
            name: "My Store",
            description: "A great store",
            logo: "logo.jpg",
            cover: "cover.jpg",
            averageRating: 4.5,
            numReviews: 100,
        };
        mockPrisma.store.findFirst.mockResolvedValue(storeDetails);

        const result = await getStorePageDetails("my-store");

        expect(result).toEqual(storeDetails);
        expect(mockPrisma.store.findFirst).toHaveBeenCalledWith({
            where: {
                url: "my-store",
                status: "ACTIVE",
            },
            select: {
                id: true,
                name: true,
                description: true,
                logo: true,
                cover: true,
                averageRating: true,
                numReviews: true,
            },
        });
    });

    it("存在しないストアの場合エラーをスローする", async () => {
        mockPrisma.store.findFirst.mockResolvedValue(null);

        await expect(
            getStorePageDetails("nonexistent")
        ).rejects.toThrow("Store with URL nonexistent not found.");
    });

    it("INACTIVEなストアはfindFirst条件で除外される", async () => {
        mockPrisma.store.findFirst.mockResolvedValue(null);

        await expect(
            getStorePageDetails("inactive-store")
        ).rejects.toThrow();

        expect(mockPrisma.store.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    status: "ACTIVE",
                }),
            })
        );
    });
});
