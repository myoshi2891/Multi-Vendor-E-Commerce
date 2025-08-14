import { currentUser } from "@clerk/nextjs/server";
import { getStoreDefaultShippingDetails, upsertStore } from "./store";

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

// テストファイルの先頭、他のimportの後に追加
beforeEach(() => {
    jest.clearAllMocks();
});

describe("upsertStore", () => {
    it("should throw an error when user is not authenticated", async () => {
        // Mock currentUser to return null (unauthenticated)
        (currentUser as jest.Mock).mockResolvedValue(null);

        const storeData = {
            name: "Test Store",
            email: "test@example.com",
            url: "test-store",
            phone: "1234567890",
        };

        await expect(upsertStore(storeData)).rejects.toThrow(
            "Unauthenticated."
        );
    });

    it("should throw an error when user role is not SELLER", async () => {
        // Mock currentUser to return a user with non-SELLER role
        (currentUser as jest.Mock).mockResolvedValue({
            id: "user123",
            privateMetadata: { role: "BUYER" },
        });

        const storeData = {
            name: "Test Store",
            email: "test@example.com",
            url: "test-store",
            phone: "1234567890",
        };

        await expect(upsertStore(storeData)).rejects.toThrow(
            "Only sellers can perform this action."
        );
    });

    it("should throw an error when store data is not provided", async () => {
        // Mock currentUser to return a valid seller user
        (currentUser as jest.Mock).mockResolvedValue({
            id: "user123",
            privateMetadata: { role: "SELLER" },
        });

        await expect(upsertStore(null as any)).rejects.toThrow(
            "Please provide store data."
        );
    });

    it("should throw an error when a store with the same name already exists", async () => {
        // Mock currentUser to return a valid seller user
        (currentUser as jest.Mock).mockResolvedValue({
            id: "user123",
            privateMetadata: { role: "SELLER" },
        });

        // Mock db.store.findFirst to return an existing store with the same name
        const mockExistingStore = {
            id: "existing-store-id",
            name: "Test Store",
            url: "different-url",
            email: "different@example.com",
            phone: "0987654321",
        };

        jest.spyOn(require("@/lib/db").db.store, "findFirst").mockResolvedValue(
            mockExistingStore
        );

        const storeData = {
            name: "Test Store",
            email: "test@example.com",
            url: "test-store",
            phone: "1234567890",
        };

        await expect(upsertStore(storeData)).rejects.toThrow(
            "A store with the same name already exists."
        );
    });

    it("should throw an error when a store with the same URL already exists", async () => {
        // Mock currentUser to return a valid seller user
        (currentUser as jest.Mock).mockResolvedValue({
            id: "user123",
            privateMetadata: { role: "SELLER" },
        });

        // Mock db.store.findFirst to return an existing store with the same URL
        const mockExistingStore = {
            id: "existing-store-id",
            name: "Different Store",
            url: "test-store",
            email: "different@example.com",
            phone: "0987654321",
        };

        jest.spyOn(require("@/lib/db").db.store, "findFirst").mockResolvedValue(
            mockExistingStore
        );

        const storeData = {
            name: "Test Store",
            email: "test@example.com",
            url: "test-store",
            phone: "1234567890",
        };

        await expect(upsertStore(storeData)).rejects.toThrow(
            "A store with the same URL already exists."
        );
    });

    it("should throw an error when a store with the same phone number already exists", async () => {
        // Mock currentUser to return a valid seller user
        (currentUser as jest.Mock).mockResolvedValue({
            id: "user123",
            privateMetadata: { role: "SELLER" },
        });

        // Mock db.store.findFirst to return an existing store with the same phone number
        const mockExistingStore = {
            id: "existing-store-id",
            name: "Different Store",
            url: "different-url",
            email: "different@example.com",
            phone: "1234567890",
        };

        jest.spyOn(require("@/lib/db").db.store, "findFirst").mockResolvedValue(
            mockExistingStore
        );

        const storeData = {
            name: "Test Store",
            email: "test@example.com",
            url: "test-store",
            phone: "1234567890",
        };

        await expect(upsertStore(storeData)).rejects.toThrow(
            "A store with the same phone number already exists."
        );
    });

    it("should successfully create a new store with all required fields", async () => {
        // Mock currentUser to return a valid seller user
        (currentUser as jest.Mock).mockResolvedValue({
            id: "user123",
            privateMetadata: { role: "SELLER" },
        });

        // Mock db.store.findFirst to return null (no existing store)
        jest.spyOn(require("@/lib/db").db.store, "findFirst").mockResolvedValue(
            null
        );

        // Mock db.store.create to return the created store
        const mockCreatedStore = {
            id: "store123",
            name: "Test Store",
            email: "test@example.com",
            url: "test-store",
            phone: "1234567890",
            description: "",
            logo: "",
            cover: "",
            featured: false,
            status: "PENDING",
            defaultShippingService: "International Delivery",
            returnPolicy: "Return in 30 days.",
            userId: "user123",
        };

        jest.spyOn(require("@/lib/db").db.store, "create").mockResolvedValue(
            mockCreatedStore
        );

        const storeData = {
            name: "Test Store",
            email: "test@example.com",
            url: "test-store",
            phone: "1234567890",
        };

        const result = await upsertStore(storeData);

        expect(result).toEqual(mockCreatedStore);
        expect(require("@/lib/db").db.store.create).toHaveBeenCalledWith({
            data: {
                name: "Test Store",
                email: "test@example.com",
                url: "test-store",
                phone: "1234567890",
                description: "",
                logo: "",
                cover: "",
                featured: false,
                status: "PENDING",
                defaultShippingService: "International Delivery",
                returnPolicy: "Return in 30 days.",
                userId: "user123",
            },
        });
    });

    it("should successfully update an existing store when store ID is provided", async () => {
        // Mock currentUser to return a valid seller user
        (currentUser as jest.Mock).mockResolvedValue({
            id: "user123",
            privateMetadata: { role: "SELLER" },
        });

        // Mock db.store.findFirst to handle multiple calls:
        // 1st call: Check if store exists and belongs to user (should return existing store)
        // 2nd call: Check for duplicates (should return null - no conflicts)
        const findFirstSpy = jest.spyOn(
            require("@/lib/db").db.store,
            "findFirst"
        );

        findFirstSpy
            .mockResolvedValueOnce({
                id: "store123",
                name: "Existing Store Name",
                email: "existing@example.com",
                url: "existing-store",
                phone: "1234567890",
                userId: "user123",
            })
            .mockResolvedValueOnce(null); // No conflicting stores found

        // Mock db.store.update to return the updated store
        const mockUpdatedStore = {
            id: "store123",
            name: "Updated Store Name",
            email: "updated@example.com",
            url: "updated-store",
            phone: "9876543210",
            description: "Updated description",
            logo: "updated-logo.png",
            cover: "updated-cover.png",
            featured: true,
            status: "ACTIVE",
            defaultShippingService: "Express Delivery",
            returnPolicy: "Return in 14 days.",
            userId: "user123",
        };

        jest.spyOn(require("@/lib/db").db.store, "update").mockResolvedValue(
            mockUpdatedStore
        );

        const storeData = {
            id: "store123",
            name: "Updated Store Name",
            email: "updated@example.com",
            url: "updated-store",
            phone: "9876543210",
            description: "Updated description",
            logo: "updated-logo.png",
            cover: "updated-cover.png",
            featured: true,
            status: "ACTIVE" as any,
            defaultShippingService: "Express Delivery",
            returnPolicy: "Return in 14 days.",
        };

        const result = await upsertStore(storeData);

        expect(result).toEqual(mockUpdatedStore);

        // Verify the first findFirst call (ownership check)
        expect(findFirstSpy).toHaveBeenNthCalledWith(1, {
            where: {
                id: "store123",
                userId: "user123",
            },
        });

        // Verify the second findFirst call (duplicate check)
        expect(findFirstSpy).toHaveBeenNthCalledWith(2, {
            where: {
                AND: [
                    {
                        OR: [
                            { name: "Updated Store Name" },
                            { url: "updated-store" },
                            { email: "updated@example.com" },
                            { phone: "9876543210" },
                        ],
                    },
                    {
                        NOT: {
                            id: "store123",
                        },
                    },
                ],
            },
        });

        // Verify update was called with correct parameters
        expect(require("@/lib/db").db.store.update).toHaveBeenCalledWith({
            where: {
                id: "store123",
            },
            data: {
                name: "Updated Store Name",
                email: "updated@example.com",
                url: "updated-store",
                phone: "9876543210",
                description: "Updated description",
                logo: "updated-logo.png",
                cover: "updated-cover.png",
                featured: true,
                status: "ACTIVE",
                defaultShippingService: "Express Delivery",
                returnPolicy: "Return in 14 days.",
            },
        });

        // Verify create was not called
        expect(require("@/lib/db").db.store.create).not.toHaveBeenCalled();

        // Verify findFirst was called exactly twice
        expect(findFirstSpy).toHaveBeenCalledTimes(2);
    });

    it("should create a new store with default values for optional fields when not provided", async () => {
        // Mock currentUser to return a valid seller user
        (currentUser as jest.Mock).mockResolvedValue({
            id: "user123",
            privateMetadata: { role: "SELLER" },
        });

        // Mock db.store.findFirst to return null (no existing store)
        jest.spyOn(require("@/lib/db").db.store, "findFirst").mockResolvedValue(
            null
        );

        // Mock db.store.create to return the created store with default values
        const mockCreatedStore = {
            id: "store123",
            name: "Test Store",
            email: "test@example.com",
            url: "test-store",
            phone: "",
            description: "",
            logo: "",
            cover: "",
            featured: false,
            status: "PENDING",
            defaultShippingService: "International Delivery",
            returnPolicy: "Return in 30 days.",
            userId: "user123",
        };

        jest.spyOn(require("@/lib/db").db.store, "create").mockResolvedValue(
            mockCreatedStore
        );

        const storeData = {
            name: "Test Store",
            email: "test@example.com",
            url: "test-store",
        };

        const result = await upsertStore(storeData);

        expect(result).toEqual(mockCreatedStore);
        expect(require("@/lib/db").db.store.create).toHaveBeenCalledWith({
            data: {
                name: "Test Store",
                email: "test@example.com",
                url: "test-store",
                description: "",
                phone: "",
                logo: "",
                cover: "",
                featured: false,
                status: "PENDING",
                defaultShippingService: "International Delivery",
                returnPolicy: "Return in 30 days.",
                userId: "user123",
            },
        });
    });
});

describe("getStoreDefaultShippingDetails", () => {
    it("should throw an error when storeUrl parameter is null", async () => {
        await expect(
            getStoreDefaultShippingDetails(null as any)
        ).rejects.toThrow("Please provide store URL.");

        // Verify that db.store.findUnique was not called
        expect(require("@/lib/db").db.store.findUnique).not.toHaveBeenCalled();
    });

    it("should throw an error when storeUrl parameter is undefined", async () => {
        await expect(
            getStoreDefaultShippingDetails(undefined as any)
        ).rejects.toThrow("Please provide store URL.");

        // Verify that db.store.findUnique was not called
        expect(require("@/lib/db").db.store.findUnique).not.toHaveBeenCalled();
    });

    it("should throw an error when storeUrl parameter is an empty string", async () => {
        await expect(getStoreDefaultShippingDetails("")).rejects.toThrow(
            "Please provide store URL."
        );

        // Verify that db.store.findUnique was not called
        expect(require("@/lib/db").db.store.findUnique).not.toHaveBeenCalled();
    });

    it("should throw an error when storeUrl parameter contains only whitespace", async () => {
        await expect(getStoreDefaultShippingDetails("   ")).rejects.toThrow(
            "Please provide store URL."
        );

        // Verify that db.store.findUnique was not called
        expect(require("@/lib/db").db.store.findUnique).not.toHaveBeenCalled();
    });

    it("should throw an error when store with given URL does not exist in database", async () => {
        // Mock db.store.findUnique to return null (store not found)
        jest.spyOn(
            require("@/lib/db").db.store,
            "findUnique"
        ).mockResolvedValue(null);

        const storeUrl = "non-existent-store";

        await expect(getStoreDefaultShippingDetails(storeUrl)).rejects.toThrow(
            `Store with URL "${storeUrl}" not found.`
        );

        // Verify that db.store.findUnique was called with correct parameters
        expect(require("@/lib/db").db.store.findUnique).toHaveBeenCalledWith({
            where: { url: storeUrl },
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
    });

    it("should successfully return store shipping details when store exists with all fields populated", async () => {
        const mockStore = {
            defaultShippingService: "Express Delivery",
            defaultShippingFeePerItem: 10.5,
            defaultShippingFeeForAdditionalItem: 5.25,
            defaultShippingFeePerKg: 2.75,
            defaultShippingFeeFixed: 15.0,
            defaultDeliveryTimeMin: 3,
            defaultDeliveryTimeMax: 7,
            returnPolicy: "Return within 14 days with receipt.",
        };

        // Mock db.store.findUnique to return store with all shipping details
        jest.spyOn(
            require("@/lib/db").db.store,
            "findUnique"
        ).mockResolvedValue(mockStore);

        const storeUrl = "test-store";

        const result = await getStoreDefaultShippingDetails(storeUrl);

        // Verify store lookup was called with correct parameters
        expect(require("@/lib/db").db.store.findUnique).toHaveBeenCalledWith({
            where: { url: storeUrl },
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

        // Verify result contains all shipping details
        expect(result).toEqual(mockStore);
        expect(result.defaultShippingService).toBe("Express Delivery");
        expect(result.defaultShippingFeePerItem).toBe(10.5);
        expect(result.defaultShippingFeeForAdditionalItem).toBe(5.25);
        expect(result.defaultShippingFeePerKg).toBe(2.75);
        expect(result.defaultShippingFeeFixed).toBe(15.0);
        expect(result.defaultDeliveryTimeMin).toBe(3);
        expect(result.defaultDeliveryTimeMax).toBe(7);
        expect(result.returnPolicy).toBe("Return within 14 days with receipt.");
    });

    it("should successfully return store shipping details when store exists with some fields as null", async () => {
        const mockStore = {
            defaultShippingService: "Standard Delivery",
            defaultShippingFeePerItem: null,
            defaultShippingFeeForAdditionalItem: 3.5,
            defaultShippingFeePerKg: null,
            defaultShippingFeeFixed: 12.0,
            defaultDeliveryTimeMin: null,
            defaultDeliveryTimeMax: 10,
            returnPolicy: null,
        };

        // Mock db.store.findUnique to return store with some null fields
        jest.spyOn(
            require("@/lib/db").db.store,
            "findUnique"
        ).mockResolvedValue(mockStore);

        const storeUrl = "test-store-with-nulls";

        const result = await getStoreDefaultShippingDetails(storeUrl);

        // Verify store lookup was called with correct parameters
        expect(require("@/lib/db").db.store.findUnique).toHaveBeenCalledWith({
            where: { url: storeUrl },
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

        // Verify result contains shipping details with null values preserved
        expect(result).toEqual(mockStore);
        expect(result.defaultShippingService).toBe("Standard Delivery");
        expect(result.defaultShippingFeePerItem).toBeNull();
        expect(result.defaultShippingFeeForAdditionalItem).toBe(3.5);
        expect(result.defaultShippingFeePerKg).toBeNull();
        expect(result.defaultShippingFeeFixed).toBe(12.0);
        expect(result.defaultDeliveryTimeMin).toBeNull();
        expect(result.defaultDeliveryTimeMax).toBe(10);
        expect(result.returnPolicy).toBeNull();
    });

    it("should handle database connection errors gracefully and re-throw the error", async () => {
        const mockError = new Error("Database connection failed");

        // Mock db.store.findUnique to throw a database error
        jest.spyOn(
            require("@/lib/db").db.store,
            "findUnique"
        ).mockRejectedValue(mockError);

        const storeUrl = "test-store";

        await expect(getStoreDefaultShippingDetails(storeUrl)).rejects.toThrow(
            "Database connection failed"
        );

        // Verify that db.store.findUnique was called with correct parameters
        expect(require("@/lib/db").db.store.findUnique).toHaveBeenCalledWith({
            where: { url: storeUrl },
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
    });

    it("should log errors to console when any error occurs during execution", async () => {
        const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
        const mockError = new Error("Test error for logging");

        // Mock db.store.findUnique to throw an error
        jest.spyOn(
            require("@/lib/db").db.store,
            "findUnique"
        ).mockRejectedValue(mockError);

        const storeUrl = "test-store";

        await expect(getStoreDefaultShippingDetails(storeUrl)).rejects.toThrow(
            "Test error for logging"
        );

        // Verify that console.log was called with the error
        expect(consoleLogSpy).toHaveBeenCalledWith(mockError);

        consoleLogSpy.mockRestore();
    });

    it("should return only the selected shipping-related fields and exclude other store properties", async () => {
        const mockStore = {
            defaultShippingService: "Express Delivery",
            defaultShippingFeePerItem: 10.5,
            defaultShippingFeeForAdditionalItem: 5.25,
            defaultShippingFeePerKg: 2.75,
            defaultShippingFeeFixed: 15.0,
            defaultDeliveryTimeMin: 3,
            defaultDeliveryTimeMax: 7,
            returnPolicy: "Return within 14 days with receipt.",
        };

        // Mock db.store.findUnique to return only shipping-related fields
        jest.spyOn(
            require("@/lib/db").db.store,
            "findUnique"
        ).mockResolvedValue(mockStore);

        const storeUrl = "test-store";

        const result = await getStoreDefaultShippingDetails(storeUrl);

        // Verify store lookup was called with correct select clause
        expect(require("@/lib/db").db.store.findUnique).toHaveBeenCalledWith({
            where: { url: storeUrl },
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

        // Verify result contains only shipping-related fields
        expect(result).toEqual(mockStore);
        expect(Object.keys(result)).toEqual([
            "defaultShippingService",
            "defaultShippingFeePerItem",
            "defaultShippingFeeForAdditionalItem",
            "defaultShippingFeePerKg",
            "defaultShippingFeeFixed",
            "defaultDeliveryTimeMin",
            "defaultDeliveryTimeMax",
            "returnPolicy",
        ]);

        // Verify no other store properties are included
        expect(result).not.toHaveProperty("id");
        expect(result).not.toHaveProperty("name");
        expect(result).not.toHaveProperty("email");
        expect(result).not.toHaveProperty("url");
        expect(result).not.toHaveProperty("phone");
        expect(result).not.toHaveProperty("description");
        expect(result).not.toHaveProperty("logo");
        expect(result).not.toHaveProperty("cover");
        expect(result).not.toHaveProperty("featured");
        expect(result).not.toHaveProperty("status");
        expect(result).not.toHaveProperty("userId");
        expect(result).not.toHaveProperty("createdAt");
        expect(result).not.toHaveProperty("updatedAt");
    });
});
