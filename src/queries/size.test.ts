import { getFilteredSizes } from "./size"; // Add this import

// テストファイルの先頭、他のimportの後に追加
beforeEach(() => {
    jest.clearAllMocks();
});

// 1. Clerk をモック化
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

describe("getFilteredSizes", () => {
    it("should return filtered sizes with count when all filters are provided", async () => {
        const mockStore = {
            id: "store123",
            url: "test-store",
        };

        const mockSizes = [
            { size: "M" },
            { size: "L" },
            { size: "XS" },
            { size: "L" }, // duplicate
            { size: "XL" },
        ];

        const mockCount = 5;

        // Mock db.store.findUnique to return the store
        jest.spyOn(require("@/lib/db").db.store, "findUnique").mockResolvedValue(mockStore);

        // Mock db.size.findMany to return sizes
        jest.spyOn(require("@/lib/db").db.size, "findMany").mockResolvedValue(mockSizes);

        // Mock db.size.count to return count
        jest.spyOn(require("@/lib/db").db.size, "count").mockResolvedValue(mockCount);

        const filters = {
            category: "electronics",
            subCategory: "smartphones",
            offer: "summer-sale",
            storeUrl: "test-store",
        };

        const result = await getFilteredSizes(filters, 10);

        // Verify store lookup
        expect(require("@/lib/db").db.store.findUnique).toHaveBeenCalledWith({
            where: { url: "test-store" },
        });

        // Verify size query with all filters
        expect(require("@/lib/db").db.size.findMany).toHaveBeenCalledWith({
            where: {
                productVariant: {
                    product: {
                        AND: [
                            { category: { url: "electronics" } },
                            { subCategory: { url: "smartphones" } },
                            { offerTag: { url: "summer-sale" } },
                        ],
                    },
                },
            },
            select: {
                size: true,
            },
            take: 10,
        });

        // Verify count query with all filters including storeId
        expect(require("@/lib/db").db.size.count).toHaveBeenCalledWith({
            where: {
                productVariant: {
                    product: {
                        AND: [
                            { category: { url: "electronics" } },
                            { category: { url: "smartphones" } },
                            { offerTag: { url: "summer-sale" } },
                            { store: { id: "store123" } },
                        ],
                    },
                },
            },
        });

        // Verify result has unique sizes in correct order and count
        expect(result).toEqual({
            sizes: [
                { size: "XS" },
                { size: "M" },
                { size: "L" },
                { size: "XL" },
            ],
            count: 5,
        });
    });

    it("should return empty array and count 0 when storeUrl does not exist in database", async () => {
        // Mock db.store.findUnique to return null (store not found)
        jest.spyOn(require("@/lib/db").db.store, "findUnique").mockResolvedValue(null);

        const filters = {
            category: "electronics",
            subCategory: "smartphones",
            offer: "summer-sale",
            storeUrl: "non-existent-store",
        };

        const result = await getFilteredSizes(filters, 10);

        // Verify store lookup was called
        expect(require("@/lib/db").db.store.findUnique).toHaveBeenCalledWith({
            where: { url: "non-existent-store" },
        });

        // Verify that size queries are not called when store doesn't exist
        expect(require("@/lib/db").db.size.findMany).not.toHaveBeenCalled();
        expect(require("@/lib/db").db.size.count).not.toHaveBeenCalled();

        // Verify result returns empty array and count 0
        expect(result).toEqual({
            sizes: [],
            count: 0,
        });
    });

    // it("should return sizes without store filter when storeUrl is not provided", async () => {
    //     const mockSizes = [
    //         { size: "S" },
    //         { size: "M" },
    //         { size: "L" },
    //         { size: "M" }, // duplicate
    //         { size: "XL" },
    //     ];

    //     const mockCount = 5;

    //     // Mock db.size.findMany to return sizes
    //     jest.spyOn(require("@/lib/db").db.size, "findMany").mockResolvedValue(mockSizes);

    //     // Mock db.size.count to return count
    //     jest.spyOn(require("@/lib/db").db.size, "count").mockResolvedValue(mockCount);

    //     const filters = {
    //         category: "electronics",
    //         subCategory: "smartphones",
    //         offer: "summer-sale",
    //         // storeUrl is intentionally not provided
    //     };

    //     const result = await getFilteredSizes(filters, 10);

    //     // Verify store lookup was not called
    //     expect(require("@/lib/db").db.store.findUnique).not.toHaveBeenCalled();

    //     // Verify size query without store filter
    //     expect(require("@/lib/db").db.size.findMany).toHaveBeenCalledWith({
    //         where: {
    //             productVariant: {
    //                 product: {
    //                     AND: [
    //                         { category: { url: "electronics" } },
    //                         { subCategory: { url: "smartphones" } },
    //                         { offerTag: { url: "summer-sale" } },
    //                     ],
    //                 },
    //             },
    //         },
    //         select: {
    //             size: true,
    //         },
    //         take: 10,
    //     });

    //     // Verify count query without store filter
    //     expect(require("@/lib/db").db.size.count).toHaveBeenCalledWith({
    //         where: {
    //             productVariant: {
    //                 product: {
    //                     AND: [
    //                         { category: { url: "electronics" } },
    //                         { subCategory: { url: "smartphones" } },
    //                         { offerTag: { url: "summer-sale" } },
    //                     ],
    //                 },
    //             },
    //         },
    //     });

    //     // Verify result has unique sizes in correct order and count
    //     expect(result).toEqual({
    //         sizes: [
    //             { size: "S" },
    //             { size: "M" },
    //             { size: "L" },
    //             { size: "XL" },
    //         ],
    //         count: 5,
    //     });
    // });

    it("should handle category filter correctly and return matching sizes", async () => {
        const mockSizes = [
            { size: "S" },
            { size: "M" },
            { size: "L" },
            { size: "M" }, // duplicate
        ];

        const mockCount = 4;

        // Mock db.size.findMany to return sizes for category filter
        jest.spyOn(require("@/lib/db").db.size, "findMany").mockResolvedValue(mockSizes);

        // Mock db.size.count to return count
        jest.spyOn(require("@/lib/db").db.size, "count").mockResolvedValue(mockCount);

        const filters = {
            category: "clothing",
        };

        const result = await getFilteredSizes(filters, 10);

        // Verify size query with category filter only
        expect(require("@/lib/db").db.size.findMany).toHaveBeenCalledWith({
            where: {
                productVariant: {
                    product: {
                        AND: [
                            { category: { url: "clothing" } },
                            {},
                            {},
                        ],
                    },
                },
            },
            select: {
                size: true,
            },
            take: 10,
        });

        // Verify count query with category filter only
        expect(require("@/lib/db").db.size.count).toHaveBeenCalledWith({
            where: {
                productVariant: {
                    product: {
                        AND: [
                            { category: { url: "clothing" } },
                            {},
                            {},
                            {},
                        ],
                    },
                },
            },
        });

        // Verify result has unique sizes in correct order and count
        expect(result).toEqual({
            sizes: [
                { size: "S" },
                { size: "M" },
                { size: "L" },
            ],
            count: 4,
        });

        // Verify store lookup was not called since no storeUrl provided
        expect(require("@/lib/db").db.store.findUnique).not.toHaveBeenCalled();
    });

    it("should handle subCategory filter correctly and return matching sizes", async () => {
        const mockSizes = [
            { size: "M" },
            { size: "L" },
            { size: "S" },
            { size: "XL" },
            { size: "M" }, // duplicate
        ];

        const mockCount = 5;

        // Mock db.size.findMany to return sizes
        jest.spyOn(require("@/lib/db").db.size, "findMany").mockResolvedValue(mockSizes);

        // Mock db.size.count to return count
        jest.spyOn(require("@/lib/db").db.size, "count").mockResolvedValue(mockCount);

        const filters = {
            subCategory: "smartphones",
        };

        const result = await getFilteredSizes(filters, 10);

        // Verify store lookup was not called
        expect(require("@/lib/db").db.store.findUnique).not.toHaveBeenCalled();

        // Verify size query with only subCategory filter
        expect(require("@/lib/db").db.size.findMany).toHaveBeenCalledWith({
            where: {
                productVariant: {
                    product: {
                        AND: [
                            {},
                            { subCategory: { url: "smartphones" } },
                            {},
                        ],
                    },
                },
            },
            select: {
                size: true,
            },
            take: 10,
        });

        // Verify count query with only subCategory filter
        expect(require("@/lib/db").db.size.count).toHaveBeenCalledWith({
            where: {
                productVariant: {
                    product: {
                        AND: [
                            {},
                            { category: { url: "smartphones" } },
                            {},
                            {},
                        ],
                    },
                },
            },
        });

        // Verify result has unique sizes in correct order and count
        expect(result).toEqual({
            sizes: [
                { size: "S" },
                { size: "M" },
                { size: "L" },
                { size: "XL" },
            ],
            count: 5,
        });
    });

    it("should handle offer filter correctly and return matching sizes", async () => {
        const mockSizes = [
            { size: "S" },
            { size: "L" },
            { size: "XL" },
            { size: "S" }, // duplicate
            { size: "M" },
        ];

        const mockCount = 5;

        // Mock db.size.findMany to return sizes for offer filter
        jest.spyOn(require("@/lib/db").db.size, "findMany").mockResolvedValue(mockSizes);

        // Mock db.size.count to return count
        jest.spyOn(require("@/lib/db").db.size, "count").mockResolvedValue(mockCount);

        const filters = {
            offer: "black-friday",
        };

        const result = await getFilteredSizes(filters, 10);

        // Verify size query with offer filter only
        expect(require("@/lib/db").db.size.findMany).toHaveBeenCalledWith({
            where: {
                productVariant: {
                    product: {
                        AND: [
                            {},
                            {},
                            { offerTag: { url: "black-friday" } },
                        ],
                    },
                },
            },
            select: {
                size: true,
            },
            take: 10,
        });

        // Verify count query with offer filter only
        expect(require("@/lib/db").db.size.count).toHaveBeenCalledWith({
            where: {
                productVariant: {
                    product: {
                        AND: [
                            {},
                            {},
                            { offerTag: { url: "black-friday" } },
                            {},
                        ],
                    },
                },
            },
        });

        // Verify result has unique sizes in correct order and count
        expect(result).toEqual({
            sizes: [
                { size: "S" },
                { size: "M" },
                { size: "L" },
                { size: "XL" },
            ],
            count: 5,
        });

        // Verify store lookup was not called since no storeUrl provided
        expect(require("@/lib/db").db.store.findUnique).not.toHaveBeenCalled();
    });

    it("should return limited results based on take parameter", async () => {
        const mockSizes = [
            { size: "XS" },
            { size: "S" },
            { size: "M" },
            { size: "L" },
            { size: "XL" },
            { size: "2XL" },
            { size: "3XL" },
            { size: "4XL" },
            { size: "5XL" },
            { size: "Custom" },
        ];

        const mockCount = 10;

        // Mock db.size.findMany to return sizes
        jest.spyOn(require("@/lib/db").db.size, "findMany").mockResolvedValue(mockSizes.slice(0, 5));

        // Mock db.size.count to return total count
        jest.spyOn(require("@/lib/db").db.size, "count").mockResolvedValue(mockCount);

        const filters = {
            category: "clothing",
        };

        const result = await getFilteredSizes(filters, 5);

        // Verify size query was called with take parameter
        expect(require("@/lib/db").db.size.findMany).toHaveBeenCalledWith({
            where: {
                productVariant: {
                    product: {
                        AND: [
                            { category: { url: "clothing" } },
                            {},
                            {},
                        ],
                    },
                },
            },
            select: {
                size: true,
            },
            take: 5,
        });

        // Verify count query was called
        expect(require("@/lib/db").db.size.count).toHaveBeenCalledWith({
            where: {
                productVariant: {
                    product: {
                        AND: [
                            { category: { url: "clothing" } },
                            {},
                            {},
                            {},
                        ],
                    },
                },
            },
        });

        // Verify result returns limited sizes and total count
        expect(result).toEqual({
            sizes: [
                { size: "XS" },
                { size: "S" },
                { size: "M" },
                { size: "L" },
                { size: "XL" },
            ],
            count: 10,
        });

        // Verify store lookup was not called since no storeUrl provided
        expect(require("@/lib/db").db.store.findUnique).not.toHaveBeenCalled();
    });

    it("should sort sizes according to predefined order with custom sizes falling back to alphabetical", async () => {
        const mockSizes = [
            { size: "Custom-Z" },
            { size: "XL" },
            { size: "Custom-A" },
            { size: "S" },
            { size: "Custom-M" },
            { size: "2XL" },
            { size: "XS" },
            { size: "Custom-B" },
            { size: "L" },
            { size: "5XL" },
            { size: "M" },
            { size: "4XL" },
            { size: "3XL" },
        ];

        const mockCount = 13;

        // Mock db.size.findMany to return sizes in random order
        jest.spyOn(require("@/lib/db").db.size, "findMany").mockResolvedValue(mockSizes);

        // Mock db.size.count to return count
        jest.spyOn(require("@/lib/db").db.size, "count").mockResolvedValue(mockCount);

        const filters = {
            category: "clothing",
        };

        const result = await getFilteredSizes(filters, 15);

        // Verify size query was called
        expect(require("@/lib/db").db.size.findMany).toHaveBeenCalledWith({
            where: {
                productVariant: {
                    product: {
                        AND: [
                            { category: { url: "clothing" } },
                            {},
                            {},
                        ],
                    },
                },
            },
            select: {
                size: true,
            },
            take: 15,
        });

        // Verify count query was called
        expect(require("@/lib/db").db.size.count).toHaveBeenCalledWith({
            where: {
                productVariant: {
                    product: {
                        AND: [
                            { category: { url: "clothing" } },
                            {},
                            {},
                            {},
                        ],
                    },
                },
            },
        });

        // Verify result has sizes sorted in predefined order with custom sizes alphabetically
        expect(result).toEqual({
            sizes: [
                { size: "XS" },
                { size: "S" },
                { size: "M" },
                { size: "L" },
                { size: "XL" },
                { size: "2XL" },
                { size: "3XL" },
                { size: "4XL" },
                { size: "5XL" },
                { size: "Custom-A" },
                { size: "Custom-B" },
                { size: "Custom-M" },
                { size: "Custom-Z" },
            ],
            count: 13,
        });

        // Verify store lookup was not called since no storeUrl provided
        expect(require("@/lib/db").db.store.findUnique).not.toHaveBeenCalled();
    });

    it("should remove duplicate sizes from the result set", async () => {
        const mockSizes = [
            { size: "M" },
            { size: "L" },
            { size: "S" },
            { size: "M" }, // duplicate
            { size: "L" }, // duplicate
            { size: "XL" },
            { size: "S" }, // duplicate
        ];

        const mockCount = 7; // Total count including duplicates

        // Mock db.size.findMany to return sizes with duplicates
        jest.spyOn(require("@/lib/db").db.size, "findMany").mockResolvedValue(mockSizes);

        // Mock db.size.count to return count
        jest.spyOn(require("@/lib/db").db.size, "count").mockResolvedValue(mockCount);

        const filters = {
            category: "clothing",
        };

        const result = await getFilteredSizes(filters, 10);

        // Verify that duplicates are removed and sizes are sorted correctly
        expect(result).toEqual({
            sizes: [
                { size: "S" },
                { size: "M" },
                { size: "L" },
                { size: "XL" },
            ],
            count: 7,
        });

        // Verify that the original query returned duplicates but result doesn't contain them
        expect(mockSizes.filter(s => s.size === "M")).toHaveLength(2);
        expect(mockSizes.filter(s => s.size === "L")).toHaveLength(2);
        expect(mockSizes.filter(s => s.size === "S")).toHaveLength(2);
        expect(result.sizes.filter(s => s.size === "M")).toHaveLength(1);
        expect(result.sizes.filter(s => s.size === "L")).toHaveLength(1);
        expect(result.sizes.filter(s => s.size === "S")).toHaveLength(1);
    });
})