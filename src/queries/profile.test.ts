import {
    getUserOrders,
    getUserPayments,
    getUserReviews,
    getUserWishlist,
    getUserFollowedStores,
} from "./profile";
import { currentUser } from "@clerk/nextjs/server";
import { TEST_CONFIG } from "../config/test-config";

// ---- モック設定 ----
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
    db: {
        order: {
            findMany: jest.fn(),
            count: jest.fn(),
        },
        paymentDetails: {
            findMany: jest.fn(),
            count: jest.fn(),
        },
        review: {
            findMany: jest.fn(),
            count: jest.fn(),
        },
        wishlist: {
            findMany: jest.fn(),
            count: jest.fn(),
        },
        store: {
            findMany: jest.fn(),
            count: jest.fn(),
        },
    },
}));

const mockDb = require("@/lib/db").db;

beforeEach(() => {
    jest.clearAllMocks();
});

// ==================================================
// getUserOrders
// ==================================================
describe("getUserOrders", () => {
    describe("認証エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(getUserOrders()).rejects.toThrow("Unauthenticated.");
        });
    });

    describe("フィルタ", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            mockDb.order.findMany.mockResolvedValue([]);
            mockDb.order.count.mockResolvedValue(0);
        });

        it("フィルタなしの場合userIdのみでクエリする", async () => {
            await getUserOrders();

            expect(mockDb.order.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        AND: [{ userId: TEST_CONFIG.DEFAULT_USER_ID }],
                    },
                })
            );
        });

        it("unpaidフィルタでpaymentStatus: Pendingを追加する", async () => {
            await getUserOrders("unpaid");

            expect(mockDb.order.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        AND: expect.arrayContaining([
                            { paymentStatus: "Pending" },
                        ]),
                    },
                })
            );
        });

        it("toShipフィルタでorderStatus: Processingを追加する", async () => {
            await getUserOrders("toShip");

            expect(mockDb.order.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        AND: expect.arrayContaining([
                            { orderStatus: "Processing" },
                        ]),
                    },
                })
            );
        });

        it("shippedフィルタでorderStatus: Shippedを追加する", async () => {
            await getUserOrders("shipped");

            expect(mockDb.order.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        AND: expect.arrayContaining([
                            { orderStatus: "Shipped" },
                        ]),
                    },
                })
            );
        });

        it("deliveredフィルタでorderStatus: Deliveredを追加する", async () => {
            await getUserOrders("delivered");

            expect(mockDb.order.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        AND: expect.arrayContaining([
                            { orderStatus: "Delivered" },
                        ]),
                    },
                })
            );
        });
    });

    describe("期間フィルタ", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            mockDb.order.findMany.mockResolvedValue([]);
            mockDb.order.count.mockResolvedValue(0);
        });

        it("last-6-monthsで6ヶ月前以降のcreatedAtフィルタを追加する", async () => {
            await getUserOrders("", "last-6-months");

            expect(mockDb.order.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        AND: expect.arrayContaining([
                            {
                                createdAt: {
                                    gte: expect.any(Date),
                                },
                            },
                        ]),
                    },
                })
            );
        });
    });

    describe("検索", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            mockDb.order.findMany.mockResolvedValue([]);
            mockDb.order.count.mockResolvedValue(0);
        });

        it("検索文字列でOR条件（注文ID/店舗名/商品名）を追加する", async () => {
            await getUserOrders("", "", "test-search");

            expect(mockDb.order.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        AND: expect.arrayContaining([
                            expect.objectContaining({
                                OR: expect.arrayContaining([
                                    {
                                        id: {
                                            contains: "test-search",
                                            mode: "insensitive",
                                        },
                                    },
                                ]),
                            }),
                        ]),
                    },
                })
            );
        });

        it("空白のみの検索文字列では検索フィルタを追加しない", async () => {
            await getUserOrders("", "", "   ");

            const callArgs = mockDb.order.findMany.mock.calls[0][0];
            // userId条件のみ
            expect(callArgs.where.AND).toHaveLength(1);
        });
    });

    describe("ページネーション", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
        });

        it("ページ番号とサイズに基づいてskip/takeを設定する", async () => {
            mockDb.order.findMany.mockResolvedValue([]);
            mockDb.order.count.mockResolvedValue(25);

            const result = await getUserOrders("", "", "", 3, 5);

            expect(mockDb.order.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    take: 5,
                    skip: 10, // (3-1) * 5
                })
            );
            expect(result.totalPages).toBe(5); // ceil(25/5)
            expect(result.currentPage).toBe(3);
            expect(result.pageSize).toBe(5);
            expect(result.totalCount).toBe(25);
        });

        it("updatedAt降順でソートする", async () => {
            mockDb.order.findMany.mockResolvedValue([]);
            mockDb.order.count.mockResolvedValue(0);

            await getUserOrders();

            expect(mockDb.order.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    orderBy: { updatedAt: "desc" },
                })
            );
        });
    });
});

// ==================================================
// getUserPayments
// ==================================================
describe("getUserPayments", () => {
    describe("認証エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(getUserPayments()).rejects.toThrow("Unauthenticated.");
        });
    });

    describe("フィルタ", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            mockDb.paymentDetails.findMany.mockResolvedValue([]);
            mockDb.paymentDetails.count.mockResolvedValue(0);
        });

        it("paypalフィルタでpaymentMethod: PayPalを追加する", async () => {
            await getUserPayments("paypal");

            expect(mockDb.paymentDetails.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        AND: expect.arrayContaining([
                            { paymentMethod: "PayPal" },
                        ]),
                    },
                })
            );
        });

        it("credit-cardフィルタでpaymentMethod: Stripeを追加する", async () => {
            await getUserPayments("credit-card");

            expect(mockDb.paymentDetails.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        AND: expect.arrayContaining([
                            { paymentMethod: "Stripe" },
                        ]),
                    },
                })
            );
        });
    });

    describe("ページネーション", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
        });

        it("ページネーション結果を正しく返す", async () => {
            const payments = [{ id: "p1" }, { id: "p2" }];
            mockDb.paymentDetails.findMany.mockResolvedValue(payments);
            mockDb.paymentDetails.count.mockResolvedValue(20);

            const result = await getUserPayments("", "", "", 2, 10);

            expect(result).toEqual({
                payments,
                totalPages: 2,
                currentPage: 2,
                pageSize: 10,
                totalCount: 20,
            });
        });
    });

    describe("検索", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            mockDb.paymentDetails.findMany.mockResolvedValue([]);
            mockDb.paymentDetails.count.mockResolvedValue(0);
        });

        it("検索文字列でid/paymentIntentIdのOR条件を追加する（case-insensitive）", async () => {
            await getUserPayments("", "", "PI_abc123");

            expect(mockDb.paymentDetails.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        AND: expect.arrayContaining([
                            expect.objectContaining({
                                OR: expect.arrayContaining([
                                    {
                                        id: {
                                            contains: "PI_abc123",
                                            mode: "insensitive",
                                        },
                                    },
                                    {
                                        paymentIntentId: {
                                            contains: "PI_abc123",
                                            mode: "insensitive",
                                        },
                                    },
                                ]),
                            }),
                        ]),
                    },
                })
            );
        });
    });
});

// ==================================================
// getUserReviews
// ==================================================
describe("getUserReviews", () => {
    describe("認証エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(getUserReviews()).rejects.toThrow("Unauthenticated.");
        });
    });

    describe("フィルタ", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            mockDb.review.findMany.mockResolvedValue([]);
            mockDb.review.count.mockResolvedValue(0);
        });

        it("評価フィルタでratingを追加する（parseFloatで変換）", async () => {
            await getUserReviews("5");

            expect(mockDb.review.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        AND: expect.arrayContaining([{ rating: 5 }]),
                    },
                })
            );
        });

        it("フィルタなしの場合rating条件を追加しない", async () => {
            await getUserReviews("");

            const callArgs = mockDb.review.findMany.mock.calls[0][0];
            expect(callArgs.where.AND).toHaveLength(1); // userIdのみ
        });
    });

    describe("検索", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            mockDb.review.findMany.mockResolvedValue([]);
            mockDb.review.count.mockResolvedValue(0);
        });

        it("レビューテキストの検索にmode: insensitiveが含まれる", async () => {
            await getUserReviews("", "", "Excellent Product");

            expect(mockDb.review.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        AND: expect.arrayContaining([
                            {
                                review: {
                                    contains: "Excellent Product",
                                    mode: "insensitive",
                                },
                            },
                        ]),
                    },
                })
            );
        });
    });

    describe("ページネーション", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
        });

        it("images/userをincludeして取得する", async () => {
            mockDb.review.findMany.mockResolvedValue([]);
            mockDb.review.count.mockResolvedValue(0);

            await getUserReviews();

            expect(mockDb.review.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    include: {
                        images: true,
                        user: true,
                    },
                })
            );
        });

        it("ページネーション結果を正しく返す", async () => {
            const reviews = [{ id: "r1" }];
            mockDb.review.findMany.mockResolvedValue(reviews);
            mockDb.review.count.mockResolvedValue(15);

            const result = await getUserReviews("", "", "", 2, 10);

            expect(result).toEqual({
                reviews,
                totalPages: 2,
                currentPage: 2,
                pageSize: 10,
                totalCount: 15,
            });
        });
    });
});

// ==================================================
// getUserWishlist
// ==================================================
describe("getUserWishlist", () => {
    describe("認証エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(getUserWishlist()).rejects.toThrow("Unauthenticated.");
        });
    });

    describe("正常系", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
        });

        it("ウィッシュリストをフォーマットして返す", async () => {
            const wishlistItems = [
                {
                    product: {
                        id: "product-001",
                        slug: "product-slug",
                        name: "Test Product",
                        rating: 4.5,
                        sales: 100,
                        variants: [
                            {
                                id: "variant-001",
                                slug: "variant-slug",
                                variantName: "Black",
                                images: [{ url: "https://example.com/img.jpg" }],
                                sizes: [{ size: "M", price: 29.99 }],
                            },
                        ],
                    },
                },
            ];
            mockDb.wishlist.findMany.mockResolvedValue(wishlistItems);
            mockDb.wishlist.count.mockResolvedValue(1);

            const result = await getUserWishlist();

            expect(result.wishlist).toEqual([
                {
                    id: "product-001",
                    slug: "product-slug",
                    name: "Test Product",
                    rating: 4.5,
                    sales: 100,
                    variants: [
                        {
                            variantId: "variant-001",
                            variantSlug: "variant-slug",
                            variantName: "Black",
                            images: [{ url: "https://example.com/img.jpg" }],
                            sizes: [{ size: "M", price: 29.99 }],
                        },
                    ],
                    variantImages: [],
                },
            ]);
        });

        it("userIdでフィルタして取得する（IDOR防止）", async () => {
            mockDb.wishlist.findMany.mockResolvedValue([]);
            mockDb.wishlist.count.mockResolvedValue(0);

            await getUserWishlist();

            expect(mockDb.wishlist.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: TEST_CONFIG.DEFAULT_USER_ID },
                })
            );
        });

        it("ページネーション結果を正しく返す", async () => {
            mockDb.wishlist.findMany.mockResolvedValue([]);
            mockDb.wishlist.count.mockResolvedValue(25);

            const result = await getUserWishlist(3, 5);

            expect(mockDb.wishlist.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    take: 5,
                    skip: 10, // (3-1) * 5
                })
            );
            expect(result.totalPages).toBe(5);
        });

        it("空のウィッシュリストの場合空配列を返す", async () => {
            mockDb.wishlist.findMany.mockResolvedValue([]);
            mockDb.wishlist.count.mockResolvedValue(0);

            const result = await getUserWishlist();

            expect(result.wishlist).toEqual([]);
            expect(result.totalPages).toBe(0);
        });

        it("バリアントが空の商品はフィルタリングされる", async () => {
            const wishlistItemWithEmptyVariants = {
                productId: "product-001",
                product: {
                    id: "product-001",
                    slug: "test-product",
                    name: "Test Product",
                    rating: 4.5,
                    sales: 100,
                    variants: [],
                },
            };
            mockDb.wishlist.findMany.mockResolvedValue([
                wishlistItemWithEmptyVariants,
            ]);
            mockDb.wishlist.count.mockResolvedValue(1);

            const result = await getUserWishlist();

            expect(result.wishlist).toEqual([]);
        });
    });
});

// ==================================================
// getUserFollowedStores
// ==================================================
describe("getUserFollowedStores", () => {
    describe("認証エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(getUserFollowedStores()).rejects.toThrow(
                "Unauthenticated."
            );
        });
    });

    describe("正常系", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
        });

        it("フォロー中のストアをフォーマットして返す", async () => {
            const followedStores = [
                {
                    id: "store-001",
                    url: "test-store",
                    name: "Test Store",
                    logo: "https://example.com/logo.jpg",
                    followers: [
                        { id: "user-1" },
                        { id: "user-2" },
                        { id: TEST_CONFIG.DEFAULT_USER_ID },
                    ],
                },
            ];
            mockDb.store.findMany.mockResolvedValue(followedStores);
            mockDb.store.count.mockResolvedValue(1);

            const result = await getUserFollowedStores();

            expect(result.stores).toEqual([
                {
                    id: "store-001",
                    url: "test-store",
                    name: "Test Store",
                    logo: "https://example.com/logo.jpg",
                    followersCount: 3,
                    isUserFollowingStore: true,
                },
            ]);
        });

        it("followers.some条件でユーザーIDフィルタする", async () => {
            mockDb.store.findMany.mockResolvedValue([]);
            mockDb.store.count.mockResolvedValue(0);

            await getUserFollowedStores();

            expect(mockDb.store.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        followers: {
                            some: { id: TEST_CONFIG.DEFAULT_USER_ID },
                        },
                    },
                })
            );
        });

        it("ページネーション結果を正しく返す", async () => {
            mockDb.store.findMany.mockResolvedValue([]);
            mockDb.store.count.mockResolvedValue(30);

            const result = await getUserFollowedStores(2, 10);

            expect(mockDb.store.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    take: 10,
                    skip: 10, // (2-1) * 10
                })
            );
            expect(result.totalPages).toBe(3);
        });

        it("isUserFollowingStoreが常にtrueである", async () => {
            const followedStores = [
                {
                    id: "store-001",
                    url: "s1",
                    name: "Store 1",
                    logo: "logo1.jpg",
                    followers: [{ id: TEST_CONFIG.DEFAULT_USER_ID }],
                },
                {
                    id: "store-002",
                    url: "s2",
                    name: "Store 2",
                    logo: "logo2.jpg",
                    followers: [{ id: TEST_CONFIG.DEFAULT_USER_ID }],
                },
            ];
            mockDb.store.findMany.mockResolvedValue(followedStores);
            mockDb.store.count.mockResolvedValue(2);

            const result = await getUserFollowedStores();

            result.stores.forEach((store) => {
                expect(store.isUserFollowingStore).toBe(true);
            });
        });

        it("フォロー中ストアが0件の場合空配列を返す", async () => {
            mockDb.store.findMany.mockResolvedValue([]);
            mockDb.store.count.mockResolvedValue(0);

            const result = await getUserFollowedStores();

            expect(result.stores).toEqual([]);
            expect(result.totalPages).toBe(0);
        });
    });
});
