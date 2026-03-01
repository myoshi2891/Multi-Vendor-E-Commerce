import { currentUser } from "@clerk/nextjs/server";
import {
    upsertCoupon,
    getStoreCoupons,
    getCoupon,
    deleteCoupon,
    applyCoupon,
} from "./coupon";
import { TEST_CONFIG } from "../config/test-config";
import {
    createMockStore,
    createMockCoupon,
    createMockCart,
    createMockCartItem,
} from "../config/test-fixtures";
import { COUPON_SCENARIOS } from "../config/test-scenarios";

// ---- モック設定 ----
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
    db: {
        store: {
            findUnique: jest.fn(),
        },
        coupon: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
            upsert: jest.fn(),
            delete: jest.fn(),
        },
        cart: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    },
}));

const mockDb = require("@/lib/db").db;

beforeEach(() => {
    jest.clearAllMocks();
});

// ==================================================
// upsertCoupon
// ==================================================
describe("upsertCoupon", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);
            const coupon = createMockCoupon();

            await expect(
                upsertCoupon(coupon as never, TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("Unauthenticated.");
        });

        it("SELLERロール以外の場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "USER" },
            });
            const coupon = createMockCoupon();

            await expect(
                upsertCoupon(coupon as never, TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("Only sellers can perform this action.");
        });
    });

    describe("バリデーション", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
        });

        it("クーポンデータがnullの場合エラーをスローする", async () => {
            await expect(
                upsertCoupon(null as never, TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("Please provide coupon data.");
        });

        it("storeURLが空の場合エラーをスローする", async () => {
            const coupon = createMockCoupon();

            await expect(
                upsertCoupon(coupon as never, "")
            ).rejects.toThrow("Please provide store URL.");
        });

        it("存在しないストアURLの場合エラーをスローする", async () => {
            const coupon = createMockCoupon();
            mockDb.store.findUnique.mockResolvedValue(null);

            await expect(
                upsertCoupon(coupon as never, "nonexistent-store")
            ).rejects.toThrow('Store with URL "nonexistent-store" not found.');
        });

        it("同一ストア内でコード重複の場合エラーをスローする", async () => {
            const coupon = createMockCoupon({ id: "new-coupon" });
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
            mockDb.coupon.findFirst.mockResolvedValue(
                createMockCoupon({ id: "existing-coupon" })
            );

            await expect(
                upsertCoupon(coupon as never, TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow(
                `Coupon with the same code "${coupon.code}" already exists for this store.`
            );
        });
    });

    describe("正常系", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
            mockDb.coupon.findFirst.mockResolvedValue(null); // 重複なし
        });

        it("新規クーポンを正常に作成する", async () => {
            const coupon = createMockCoupon();
            mockDb.coupon.upsert.mockResolvedValue(coupon);

            const result = await upsertCoupon(
                coupon as never,
                TEST_CONFIG.TEST_STORE_URL
            );

            expect(result).toEqual(coupon);
            expect(mockDb.coupon.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: coupon.id },
                    create: expect.objectContaining({
                        storeId: TEST_CONFIG.DEFAULT_STORE_ID,
                    }),
                })
            );
        });

        it("既存クーポンを更新する", async () => {
            const coupon = createMockCoupon({ discount: 20 });
            mockDb.coupon.upsert.mockResolvedValue(coupon);

            const result = await upsertCoupon(
                coupon as never,
                TEST_CONFIG.TEST_STORE_URL
            );

            expect(result).toEqual(coupon);
            expect(mockDb.coupon.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    update: expect.objectContaining({
                        storeId: TEST_CONFIG.DEFAULT_STORE_ID,
                    }),
                })
            );
        });
    });

    describe("エラーハンドリング", () => {
        it("DBエラーをログ出力しラップしてスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
            const consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => undefined);
            mockDb.store.findUnique.mockRejectedValue(
                new Error("DB connection failed")
            );
            const coupon = createMockCoupon();

            await expect(
                upsertCoupon(coupon as never, TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("Error occurred while trying to upsert coupon");

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
});

// ==================================================
// getStoreCoupons
// ==================================================
describe("getStoreCoupons", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(
                getStoreCoupons(TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("Unauthenticated.");
        });

        it("SELLERロール以外の場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "USER" },
            });

            await expect(
                getStoreCoupons(TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("Only sellers can perform this action.");
        });
    });

    describe("IDOR防止", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
        });

        it("他人のストアのクーポンを取得できない", async () => {
            mockDb.store.findUnique.mockResolvedValue(
                createMockStore({ userId: "different-user" })
            );

            await expect(
                getStoreCoupons(TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow(
                "You do not have permission to access coupons for this store."
            );
        });

        it("存在しないストアの場合エラーをスローする", async () => {
            mockDb.store.findUnique.mockResolvedValue(null);

            await expect(
                getStoreCoupons("nonexistent")
            ).rejects.toThrow(
                "You do not have permission to access coupons for this store."
            );
        });
    });

    describe("正常系", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
        });

        it("ストアのクーポン一覧を返す", async () => {
            const coupons = [
                createMockCoupon(),
                createMockCoupon({ id: "coupon-002", code: "SAVE20" }),
            ];
            mockDb.coupon.findMany.mockResolvedValue(coupons);

            const result = await getStoreCoupons(TEST_CONFIG.TEST_STORE_URL);

            expect(result).toEqual(coupons);
            expect(mockDb.coupon.findMany).toHaveBeenCalledWith({
                where: { storeId: TEST_CONFIG.DEFAULT_STORE_ID },
            });
        });

        it("クーポンが0件の場合空配列を返す", async () => {
            mockDb.coupon.findMany.mockResolvedValue([]);

            const result = await getStoreCoupons(TEST_CONFIG.TEST_STORE_URL);

            expect(result).toEqual([]);
        });
    });
});

// ==================================================
// getCoupon
// ==================================================
describe("getCoupon", () => {
    describe("バリデーション", () => {
        it("couponIdが空の場合エラーをスローする", async () => {
            await expect(getCoupon("")).rejects.toThrow(
                "Please provide coupon ID."
            );
        });
    });

    describe("正常系", () => {
        it("クーポンを正常に取得する", async () => {
            const coupon = createMockCoupon();
            mockDb.coupon.findUnique.mockResolvedValue(coupon);

            const result = await getCoupon("coupon-001");

            expect(result).toEqual(coupon);
            expect(mockDb.coupon.findUnique).toHaveBeenCalledWith({
                where: { id: "coupon-001" },
            });
        });

        it("存在しないクーポンの場合nullを返す", async () => {
            mockDb.coupon.findUnique.mockResolvedValue(null);

            const result = await getCoupon("nonexistent");

            expect(result).toBeNull();
        });
    });
});

// ==================================================
// deleteCoupon
// ==================================================
describe("deleteCoupon", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(
                deleteCoupon("coupon-001", TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("Unauthenticated.");
        });

        it("SELLERロール以外の場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "USER" },
            });

            await expect(
                deleteCoupon("coupon-001", TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("Only sellers can perform this action.");
        });
    });

    describe("バリデーション", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
        });

        it("couponIdが空の場合エラーをスローする", async () => {
            await expect(
                deleteCoupon("", TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("Please provide coupon ID.");
        });

        it("storeURLが空の場合エラーをスローする", async () => {
            await expect(deleteCoupon("coupon-001", "")).rejects.toThrow(
                "Please provide store URL."
            );
        });
    });

    describe("IDOR防止", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
        });

        it("他人のストアのクーポンを削除できない", async () => {
            mockDb.store.findUnique.mockResolvedValue(
                createMockStore({ userId: "different-user" })
            );

            await expect(
                deleteCoupon("coupon-001", TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow(
                "You do not have permission to access coupons for this store."
            );
        });
    });

    describe("正常系", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
        });

        it("クーポンを正常に削除してtrueを返す", async () => {
            mockDb.coupon.delete.mockResolvedValue(createMockCoupon());

            const result = await deleteCoupon(
                "coupon-001",
                TEST_CONFIG.TEST_STORE_URL
            );

            expect(result).toBe(true);
            expect(mockDb.coupon.delete).toHaveBeenCalledWith({
                where: {
                    id: "coupon-001",
                    storeId: TEST_CONFIG.DEFAULT_STORE_ID,
                },
            });
        });
    });
});

// ==================================================
// applyCoupon
// ==================================================
describe("applyCoupon", () => {
    describe("バリデーション", () => {
        it("存在しないクーポンコードの場合エラーをスローする", async () => {
            mockDb.coupon.findUnique.mockResolvedValue(null);

            await expect(
                applyCoupon("INVALID", "cart-001")
            ).rejects.toThrow("Coupon not found.");
        });

        it("期限切れクーポンの場合エラーをスローする", async () => {
            mockDb.coupon.findUnique.mockResolvedValue(
                createMockCoupon({
                    ...COUPON_SCENARIOS.expired,
                    store: createMockStore(),
                })
            );

            await expect(
                applyCoupon("SAVE10", "cart-001")
            ).rejects.toThrow("Coupon is not valid for this date.");
        });

        it("開始前のクーポンの場合エラーをスローする", async () => {
            mockDb.coupon.findUnique.mockResolvedValue(
                createMockCoupon({
                    ...COUPON_SCENARIOS.notStarted,
                    store: createMockStore(),
                })
            );

            await expect(
                applyCoupon("SAVE10", "cart-001")
            ).rejects.toThrow("Coupon is not valid for this date.");
        });

        it("カートが見つからない場合エラーをスローする", async () => {
            mockDb.coupon.findUnique.mockResolvedValue(
                createMockCoupon({
                    ...COUPON_SCENARIOS.active,
                    store: createMockStore(),
                })
            );
            mockDb.cart.findUnique.mockResolvedValue(null);

            await expect(
                applyCoupon("SAVE10", "invalid-cart")
            ).rejects.toThrow("Cart not found");
        });

        it("既にクーポンが適用されている場合エラーをスローする", async () => {
            mockDb.coupon.findUnique.mockResolvedValue(
                createMockCoupon({
                    ...COUPON_SCENARIOS.active,
                    store: createMockStore(),
                })
            );
            mockDb.cart.findUnique.mockResolvedValue(
                createMockCart({
                    couponId: "existing-coupon",
                    cartItems: [],
                    coupon: createMockCoupon(),
                })
            );

            await expect(
                applyCoupon("SAVE10", "cart-001")
            ).rejects.toThrow("Coupon is already applied to this cart.");
        });

        it("クーポンのストアの商品がカートにない場合エラーをスローする", async () => {
            mockDb.coupon.findUnique.mockResolvedValue(
                createMockCoupon({
                    ...COUPON_SCENARIOS.active,
                    storeId: "different-store",
                    store: createMockStore({ id: "different-store" }),
                })
            );
            // カート内の商品は別の店舗のもの
            mockDb.cart.findUnique.mockResolvedValue(
                createMockCart({
                    couponId: null,
                    cartItems: [
                        createMockCartItem({
                            storeId: TEST_CONFIG.DEFAULT_STORE_ID,
                        }),
                    ],
                    coupon: null,
                })
            );

            await expect(
                applyCoupon("SAVE10", "cart-001")
            ).rejects.toThrow(
                "No items in the cart belong to the store associated with this coupon."
            );
        });
    });

    describe("割引計算", () => {
        const setupValidCouponScenario = (
            discount: number,
            cartTotal: number,
            itemPrice: number,
            itemQuantity: number,
            shippingFee: number
        ) => {
            mockDb.coupon.findUnique.mockResolvedValue(
                createMockCoupon({
                    ...COUPON_SCENARIOS.active,
                    discount,
                    store: createMockStore(),
                })
            );
            mockDb.cart.findUnique.mockResolvedValue(
                createMockCart({
                    couponId: null,
                    total: cartTotal,
                    cartItems: [
                        createMockCartItem({
                            storeId: TEST_CONFIG.DEFAULT_STORE_ID,
                            price: itemPrice,
                            quantity: itemQuantity,
                            shippingFee,
                        }),
                    ],
                    coupon: null,
                })
            );
        };

        it("パーセント割引が正しく計算される", async () => {
            // 商品 $100 x 1 + 配送料 $10 = $110, 10%割引 = -$11
            setupValidCouponScenario(10, 110, 100, 1, 10);
            const updatedCart = createMockCart({ total: 99 });
            mockDb.cart.update.mockResolvedValue({
                ...updatedCart,
                cartItems: [],
                coupon: { store: createMockStore() },
            });

            const result = await applyCoupon("SAVE10", "cart-001");

            expect(result.message).toContain("Coupon applied successfully");
            expect(mockDb.cart.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        total: 99, // 110 - 11
                    }),
                })
            );
        });

        it("50%割引が正しく計算される", async () => {
            // 商品 $200 x 1 + 配送料 $0 = $200, 50%割引 = -$100
            setupValidCouponScenario(50, 200, 200, 1, 0);
            mockDb.cart.update.mockResolvedValue({
                ...createMockCart({ total: 100 }),
                cartItems: [],
                coupon: { store: createMockStore() },
            });

            const result = await applyCoupon("SAVE50", "cart-001");

            expect(result.message).toContain("Coupon applied successfully");
            expect(mockDb.cart.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        total: 100, // 200 - 100
                    }),
                })
            );
        });

        it("複数商品の合計に対して割引が適用される", async () => {
            // 商品 $50 x 3 = $150 + 配送料 $5 = $155, 10%割引 = -$15.5
            mockDb.coupon.findUnique.mockResolvedValue(
                createMockCoupon({
                    ...COUPON_SCENARIOS.active,
                    discount: 10,
                    store: createMockStore(),
                })
            );
            mockDb.cart.findUnique.mockResolvedValue(
                createMockCart({
                    couponId: null,
                    total: 155,
                    cartItems: [
                        createMockCartItem({
                            storeId: TEST_CONFIG.DEFAULT_STORE_ID,
                            price: 50,
                            quantity: 3,
                            shippingFee: 5,
                        }),
                    ],
                    coupon: null,
                })
            );
            mockDb.cart.update.mockResolvedValue({
                ...createMockCart({ total: 139.5 }),
                cartItems: [],
                coupon: { store: createMockStore() },
            });

            const result = await applyCoupon("SAVE10", "cart-001");

            expect(result.message).toContain("Coupon applied successfully");
            expect(mockDb.cart.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        total: 139.5, // 155 - 15.5
                    }),
                })
            );
        });
    });

    describe("正常系", () => {
        it("クーポンIDがカートに正しく紐付けられる", async () => {
            mockDb.coupon.findUnique.mockResolvedValue(
                createMockCoupon({
                    ...COUPON_SCENARIOS.active,
                    store: createMockStore(),
                })
            );
            mockDb.cart.findUnique.mockResolvedValue(
                createMockCart({
                    couponId: null,
                    total: 100,
                    cartItems: [
                        createMockCartItem({
                            storeId: TEST_CONFIG.DEFAULT_STORE_ID,
                            price: 100,
                            quantity: 1,
                            shippingFee: 0,
                        }),
                    ],
                    coupon: null,
                })
            );
            const updatedCart = {
                ...createMockCart(),
                cartItems: [],
                coupon: { ...createMockCoupon(), store: createMockStore() },
            };
            mockDb.cart.update.mockResolvedValue(updatedCart);

            const result = await applyCoupon("SAVE10", "cart-001");

            expect(result.cart).toBeDefined();
            expect(mockDb.cart.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        couponId: "coupon-001",
                    }),
                })
            );
        });

        it("レスポンスメッセージにストア名と割引額が含まれる", async () => {
            mockDb.coupon.findUnique.mockResolvedValue(
                createMockCoupon({
                    ...COUPON_SCENARIOS.active,
                    discount: 10,
                    store: createMockStore({ name: "My Shop" }),
                })
            );
            mockDb.cart.findUnique.mockResolvedValue(
                createMockCart({
                    couponId: null,
                    total: 100,
                    cartItems: [
                        createMockCartItem({
                            storeId: TEST_CONFIG.DEFAULT_STORE_ID,
                            price: 100,
                            quantity: 1,
                            shippingFee: 0,
                        }),
                    ],
                    coupon: null,
                })
            );
            mockDb.cart.update.mockResolvedValue({
                ...createMockCart(),
                cartItems: [],
                coupon: {
                    ...createMockCoupon(),
                    store: createMockStore({ name: "My Shop" }),
                },
            });

            const result = await applyCoupon("SAVE10", "cart-001");

            expect(result.message).toContain("My Shop");
            expect(result.message).toContain("$10.00");
        });
    });

    describe("エラーハンドリング", () => {
        it("DBエラーをログ出力しラップしてスローする", async () => {
            const consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => undefined);
            mockDb.coupon.findUnique.mockRejectedValue(
                new Error("DB connection failed")
            );

            await expect(
                applyCoupon("SAVE10", "cart-001")
            ).rejects.toThrow("Error occurred while applying coupon");

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
});
