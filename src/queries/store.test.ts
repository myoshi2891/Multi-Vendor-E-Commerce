import { currentUser } from "@clerk/nextjs/server";
import {
    getStoreDefaultShippingDetails,
    upsertStore,
    updateStoreDefaultShippingDetails,
} from "./store";
import { TEST_CONFIG } from "../config/test-config";

// Mock the database
jest.mock("@/lib/db", () => ({
    db: {
        store: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
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
        storeData: any,
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
    static mockCurrentUser(user: any) {
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

    static mockConsoleLog() {
        return jest.spyOn(console, "log").mockImplementation(() => {});
    }

    static async expectThrowError(
        promise: Promise<any>,
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
        let consoleLogSpy: jest.SpyInstance;

        beforeEach(() => {
            TestHelpers.mockAuthenticatedSeller();
            consoleLogSpy = TestHelpers.mockConsoleLog();
        });

        afterEach(() => {
            consoleLogSpy.mockRestore();
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

            expect(consoleLogSpy).toHaveBeenCalledWith(mockError);
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

            expect(consoleLogSpy).toHaveBeenCalledWith(mockError);
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
        let consoleLogSpy: jest.SpyInstance;

        beforeEach(() => {
            consoleLogSpy = TestHelpers.mockConsoleLog();
        });

        afterEach(() => {
            consoleLogSpy.mockRestore();
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

            expect(consoleLogSpy).toHaveBeenCalledWith(mockError);
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

            expect(consoleLogSpy).toHaveBeenCalledWith(validationError);
        });
    });
});
