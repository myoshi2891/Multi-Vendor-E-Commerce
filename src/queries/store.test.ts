import { currentUser } from "@clerk/nextjs/server";
import { upsertStore } from "./store";

// テストファイルの先頭、他のimportの後に追加
beforeEach(() => {
    jest.clearAllMocks();
});

// 1. Clerk をモック化
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

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
    const findFirstSpy = jest.spyOn(require("@/lib/db").db.store, "findFirst");

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
