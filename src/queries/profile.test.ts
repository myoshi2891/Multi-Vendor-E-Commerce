import { getUserOrders, getUserPayments, getUserReviews } from "./profile";
import { currentUser } from "@clerk/nextjs/server";

// DB モック
const mockOrderFindMany = jest.fn();
const mockOrderCount = jest.fn();
const mockPaymentFindMany = jest.fn();
const mockPaymentCount = jest.fn();
const mockReviewFindMany = jest.fn();
const mockReviewCount = jest.fn();

jest.mock("@/lib/db", () => ({
    db: {
        order: {
            findMany: (...args: unknown[]) => mockOrderFindMany(...args),
            count: (...args: unknown[]) => mockOrderCount(...args),
        },
        paymentDetails: {
            findMany: (...args: unknown[]) => mockPaymentFindMany(...args),
            count: (...args: unknown[]) => mockPaymentCount(...args),
        },
        review: {
            findMany: (...args: unknown[]) => mockReviewFindMany(...args),
            count: (...args: unknown[]) => mockReviewCount(...args),
        },
    },
}));

jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

const mockUser = { id: "user_test_123" };

beforeEach(() => {
    jest.clearAllMocks();
    (currentUser as jest.Mock).mockResolvedValue(mockUser);
    mockOrderFindMany.mockResolvedValue([]);
    mockOrderCount.mockResolvedValue(0);
    mockPaymentFindMany.mockResolvedValue([]);
    mockPaymentCount.mockResolvedValue(0);
    mockReviewFindMany.mockResolvedValue([]);
    mockReviewCount.mockResolvedValue(0);
});

describe("getUserOrders - 検索フィルタの case-insensitive 対応", () => {
    it("注文IDの検索に mode: 'insensitive' が含まれる", async () => {
        await getUserOrders("", "", "ORDER-123");

        expect(mockOrderFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    AND: expect.arrayContaining([
                        expect.objectContaining({
                            OR: expect.arrayContaining([
                                { id: { contains: "ORDER-123", mode: "insensitive" } },
                            ]),
                        }),
                    ]),
                }),
            })
        );
    });

    it("店舗名の検索に mode: 'insensitive' が含まれる", async () => {
        await getUserOrders("", "", "Apple Store");

        expect(mockOrderFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    AND: expect.arrayContaining([
                        expect.objectContaining({
                            OR: expect.arrayContaining([
                                {
                                    groups: {
                                        some: {
                                            store: {
                                                name: { contains: "Apple Store", mode: "insensitive" },
                                            },
                                        },
                                    },
                                },
                            ]),
                        }),
                    ]),
                }),
            })
        );
    });

    it("商品名の検索に mode: 'insensitive' が含まれる", async () => {
        await getUserOrders("", "", "iPhone");

        expect(mockOrderFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    AND: expect.arrayContaining([
                        expect.objectContaining({
                            OR: expect.arrayContaining([
                                {
                                    groups: {
                                        some: {
                                            items: {
                                                some: {
                                                    name: { contains: "iPhone", mode: "insensitive" },
                                                },
                                            },
                                        },
                                    },
                                },
                            ]),
                        }),
                    ]),
                }),
            })
        );
    });
});

describe("getUserPayments - 検索フィルタの case-insensitive 対応", () => {
    it("決済IDの検索に mode: 'insensitive' が含まれる", async () => {
        await getUserPayments("", "", "PI_abc123");

        expect(mockPaymentFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    AND: expect.arrayContaining([
                        expect.objectContaining({
                            OR: expect.arrayContaining([
                                { id: { contains: "PI_abc123", mode: "insensitive" } },
                            ]),
                        }),
                    ]),
                }),
            })
        );
    });

    it("paymentIntentIdの検索に mode: 'insensitive' が含まれる", async () => {
        await getUserPayments("", "", "PI_abc123");

        expect(mockPaymentFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    AND: expect.arrayContaining([
                        expect.objectContaining({
                            OR: expect.arrayContaining([
                                { paymentIntentId: { contains: "PI_abc123", mode: "insensitive" } },
                            ]),
                        }),
                    ]),
                }),
            })
        );
    });
});

describe("getUserReviews - 検索フィルタの case-insensitive 対応", () => {
    it("レビューテキストの検索に mode: 'insensitive' が含まれる", async () => {
        await getUserReviews("", "", "Excellent Product");

        expect(mockReviewFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    AND: expect.arrayContaining([
                        { review: { contains: "Excellent Product", mode: "insensitive" } },
                    ]),
                }),
            })
        );
    });
});
