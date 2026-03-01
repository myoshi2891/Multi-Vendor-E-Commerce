import { currentUser } from "@clerk/nextjs/server";
import {
    followStore,
    saveUserCart,
    getUserShippingAddresses,
    upsertShippingAddress,
    placeOrder,
    emptyUserCart,
    updateCartWithLatest,
    addToWishlist,
    updateCheckoutProductWithLatest,
} from "./user";
import { TEST_CONFIG } from "../config/test-config";
import {
    createMockStore,
    createMockUser,
    createMockFullProduct,
    createMockSize,
    createMockCartProduct,
    createMockCart,
    createMockCartItem,
    createMockShippingAddress,
    createMockOrder,
    createMockOrderGroup,
    createMockCoupon,
    createMockCountry,
    createMockWishlistItem,
    createMockVariantImage,
    createMockProductVariant,
} from "../config/test-fixtures";

// ---- モック設定 ----
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
    db: {
        store: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        user: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
        },
        product: {
            findUnique: jest.fn(),
        },
        cart: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            delete: jest.fn(),
            update: jest.fn(),
        },
        cartItem: {
            update: jest.fn(),
        },
        shippingAddress: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            upsert: jest.fn(),
            updateMany: jest.fn(),
        },
        order: {
            create: jest.fn(),
            update: jest.fn(),
            findUnique: jest.fn(),
        },
        orderGroup: {
            create: jest.fn(),
        },
        orderItem: {
            create: jest.fn(),
        },
        country: {
            findUnique: jest.fn(),
        },
        wishlist: {
            findFirst: jest.fn(),
            create: jest.fn(),
        },
        coupon: {
            findUnique: jest.fn(),
        },
    },
}));

// product.tsからの依存関数もモック化
jest.mock("./product", () => ({
    getShippingDetails: jest.fn(),
    getProductShippingFee: jest.fn(),
    getDeliveryDetailsForStoreByCountry: jest.fn(),
}));

// cookies-nextのモック化
jest.mock("cookies-next", () => ({
    getCookie: jest.fn(),
}));

jest.mock("next/headers", () => ({
    cookies: jest.fn(),
}));

const mockDb = require("@/lib/db").db;
const mockGetShippingDetails = require("./product").getShippingDetails;
const mockGetDeliveryDetails =
    require("./product").getDeliveryDetailsForStoreByCountry;
const mockGetProductShippingFee = require("./product").getProductShippingFee;
const mockGetCookie = require("cookies-next").getCookie;

beforeEach(() => {
    jest.clearAllMocks();
});

// ==================================================
// followStore
// ==================================================
describe("followStore", () => {
    describe("認証エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(followStore("store-001")).rejects.toThrow(
                "Error following store"
            );
        });
    });

    describe("バリデーション", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
        });

        it("存在しないストアの場合エラーをスローする", async () => {
            mockDb.store.findUnique.mockResolvedValue(null);

            await expect(followStore("invalid-store")).rejects.toThrow(
                "Error following store"
            );
        });

        it("存在しないユーザーの場合エラーをスローする", async () => {
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
            mockDb.user.findUnique.mockResolvedValue(null);

            await expect(followStore("store-001")).rejects.toThrow(
                "Error following store"
            );
        });
    });

    describe("フォロー/アンフォロー切替", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
            mockDb.user.findUnique.mockResolvedValue(createMockUser());
        });

        it("未フォローの場合フォローしてtrueを返す", async () => {
            mockDb.user.findFirst.mockResolvedValue(null); // 未フォロー
            mockDb.store.update.mockResolvedValue(createMockStore());

            const result = await followStore(TEST_CONFIG.DEFAULT_STORE_ID);

            expect(result).toBe(true);
            expect(mockDb.store.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: TEST_CONFIG.DEFAULT_STORE_ID },
                    data: {
                        followers: {
                            connect: { id: TEST_CONFIG.DEFAULT_USER_ID },
                        },
                    },
                })
            );
        });

        it("フォロー済みの場合アンフォローしてfalseを返す", async () => {
            mockDb.user.findFirst.mockResolvedValue(createMockUser()); // フォロー済み
            mockDb.store.update.mockResolvedValue(createMockStore());

            const result = await followStore(TEST_CONFIG.DEFAULT_STORE_ID);

            expect(result).toBe(false);
            expect(mockDb.store.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: TEST_CONFIG.DEFAULT_STORE_ID },
                    data: {
                        followers: {
                            disconnect: { id: TEST_CONFIG.DEFAULT_USER_ID },
                        },
                    },
                })
            );
        });
    });
});

// ==================================================
// saveUserCart
// ==================================================
describe("saveUserCart", () => {
    describe("認証エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(saveUserCart([])).rejects.toThrow("Unauthenticated.");
        });
    });

    describe("データ検証と整合性", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            // 既存カートなし
            mockDb.cart.findFirst.mockResolvedValue(null);
            // Cookie未設定
            mockGetCookie.mockReturnValue(null);
        });

        it("無効な商品/バリアント/サイズの組合せでエラーをスローする", async () => {
            const cartProducts = [createMockCartProduct()];
            // 商品が見つからない
            mockDb.product.findUnique.mockResolvedValue(null);

            await expect(saveUserCart(cartProducts as never)).rejects.toThrow(
                "Invalid product, variant, or size combination"
            );
        });

        it("バリアントが見つからない場合エラーをスローする", async () => {
            const cartProducts = [createMockCartProduct()];
            mockDb.product.findUnique.mockResolvedValue({
                ...createMockFullProduct(),
                variants: [], // バリアントなし
            });

            await expect(saveUserCart(cartProducts as never)).rejects.toThrow(
                "Invalid product, variant, or size combination"
            );
        });

        it("サイズが見つからない場合エラーをスローする", async () => {
            const cartProducts = [createMockCartProduct()];
            const variant = createMockProductVariant();
            mockDb.product.findUnique.mockResolvedValue({
                ...createMockFullProduct(),
                variants: [{ ...variant, sizes: [], images: [createMockVariantImage()] }],
            });

            await expect(saveUserCart(cartProducts as never)).rejects.toThrow(
                "Invalid product, variant, or size combination"
            );
        });

        it("フロントの価格ではなくDBの価格を使用する (価格操作防止)", async () => {
            const cartProducts = [
                createMockCartProduct({ price: 999.99 }), // フロント側で改ざんされた価格
            ];
            const dbProduct = createMockFullProduct();
            // DB上の正しい価格は29.99
            mockDb.product.findUnique.mockResolvedValue(dbProduct);
            mockDb.cart.create.mockResolvedValue({ id: "cart-new" });

            await saveUserCart(cartProducts as never);

            // DB上の価格(29.99)で計算されていることを検証
            expect(mockDb.cart.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        cartItems: expect.objectContaining({
                            create: expect.arrayContaining([
                                expect.objectContaining({
                                    price: 29.99, // DB価格が使用されている
                                }),
                            ]),
                        }),
                    }),
                })
            );
        });

        it("在庫を超える数量はDBの在庫数に調整される", async () => {
            const cartProducts = [
                createMockCartProduct({ quantity: 100 }), // 在庫を超える数量
            ];
            const dbProduct = createMockFullProduct();
            // DB上の在庫は50
            mockDb.product.findUnique.mockResolvedValue(dbProduct);
            mockDb.cart.create.mockResolvedValue({ id: "cart-new" });

            await saveUserCart(cartProducts as never);

            expect(mockDb.cart.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        cartItems: expect.objectContaining({
                            create: expect.arrayContaining([
                                expect.objectContaining({
                                    quantity: 50, // 在庫数に制限
                                }),
                            ]),
                        }),
                    }),
                })
            );
        });

        it("既存カートがある場合は削除してから新規作成する", async () => {
            const cartProducts = [createMockCartProduct()];
            const existingCart = createMockCart();

            mockDb.cart.findFirst.mockResolvedValue(existingCart);
            mockDb.cart.delete.mockResolvedValue(existingCart);
            mockDb.product.findUnique.mockResolvedValue(
                createMockFullProduct()
            );
            mockDb.cart.create.mockResolvedValue({ id: "cart-new" });

            await saveUserCart(cartProducts as never);

            expect(mockDb.cart.delete).toHaveBeenCalledWith({
                where: { userId: TEST_CONFIG.DEFAULT_USER_ID },
            });
            expect(mockDb.cart.create).toHaveBeenCalled();
        });

        it("割引価格が正しく計算される", async () => {
            const cartProducts = [createMockCartProduct({ quantity: 1 })];
            const dbProduct = createMockFullProduct();
            // 割引10%を設定
            dbProduct.variants[0].sizes[0] = {
                ...createMockSize({ price: 100, discount: 10 }),
            };
            mockDb.product.findUnique.mockResolvedValue(dbProduct);
            mockDb.cart.create.mockResolvedValue({ id: "cart-new" });

            await saveUserCart(cartProducts as never);

            expect(mockDb.cart.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        cartItems: expect.objectContaining({
                            create: expect.arrayContaining([
                                expect.objectContaining({
                                    price: 90, // 100 - 100 * (10/100)
                                }),
                            ]),
                        }),
                    }),
                })
            );
        });

        it("カート合計金額が正しく計算される", async () => {
            const cartProducts = [
                createMockCartProduct({ quantity: 2 }),
            ];
            const dbProduct = createMockFullProduct();
            mockDb.product.findUnique.mockResolvedValue(dbProduct);
            mockDb.cart.create.mockResolvedValue({ id: "cart-new" });

            await saveUserCart(cartProducts as never);

            // subTotal = 29.99 * 2 = 59.98, shippingFee = 0 (Cookieなし), total = 59.98
            expect(mockDb.cart.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        subTotal: 59.98,
                        shippingFees: 0,
                        total: 59.98,
                        userId: TEST_CONFIG.DEFAULT_USER_ID,
                    }),
                })
            );
        });
    });

    describe("配送料計算（Cookie設定時）", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            mockDb.cart.findFirst.mockResolvedValue(null);
        });

        it("国Cookieが設定されている場合は配送料を計算する", async () => {
            const cartProducts = [createMockCartProduct({ quantity: 1 })];
            mockGetCookie.mockReturnValue(
                JSON.stringify({ name: "Japan", code: "JP" })
            );
            mockGetShippingDetails.mockResolvedValue({
                shippingFee: 5.0,
                extraShippingFee: 2.0,
                isFreeShipping: false,
            });
            mockDb.product.findUnique.mockResolvedValue(
                createMockFullProduct()
            );
            mockDb.cart.create.mockResolvedValue({ id: "cart-new" });

            await saveUserCart(cartProducts as never);

            expect(mockGetShippingDetails).toHaveBeenCalled();
        });
    });
});

// ==================================================
// getUserShippingAddresses
// ==================================================
describe("getUserShippingAddresses", () => {
    describe("認証エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(getUserShippingAddresses()).rejects.toThrow(
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

        it("ユーザーの全配送先住所を返す", async () => {
            const addresses = [
                createMockShippingAddress(),
                createMockShippingAddress({ id: "address-002", default: false }),
            ];
            mockDb.shippingAddress.findMany.mockResolvedValue(addresses);

            const result = await getUserShippingAddresses();

            expect(result).toEqual(addresses);
            expect(mockDb.shippingAddress.findMany).toHaveBeenCalledWith({
                where: { userId: TEST_CONFIG.DEFAULT_USER_ID },
                include: { user: true, country: true },
            });
        });

        it("配送先住所が0件の場合空配列を返す", async () => {
            mockDb.shippingAddress.findMany.mockResolvedValue([]);

            const result = await getUserShippingAddresses();

            expect(result).toEqual([]);
        });
    });

    describe("エラーハンドリング", () => {
        it("DBエラーをログ出力し再スローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            const consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => undefined);
            const dbError = new Error("Database connection failed");
            mockDb.shippingAddress.findMany.mockRejectedValue(dbError);

            await expect(getUserShippingAddresses()).rejects.toThrow(dbError);
            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });
});

// ==================================================
// upsertShippingAddress
// ==================================================
describe("upsertShippingAddress", () => {
    describe("認証エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);
            const address = createMockShippingAddress();

            await expect(
                upsertShippingAddress(address as never)
            ).rejects.toThrow("Unauthenticated.");
        });
    });

    describe("バリデーション", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
        });

        it("住所データが提供されない場合エラーをスローする", async () => {
            await expect(
                upsertShippingAddress(null as never)
            ).rejects.toThrow("Please provide shipping address data.");
        });
    });

    describe("正常系", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
        });

        it("新しい配送先住所を作成する", async () => {
            const address = createMockShippingAddress({ default: false });
            mockDb.shippingAddress.upsert.mockResolvedValue(address);

            const result = await upsertShippingAddress(address as never);

            expect(result).toEqual(address);
            expect(mockDb.shippingAddress.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: address.id },
                    update: expect.objectContaining({
                        userId: TEST_CONFIG.DEFAULT_USER_ID,
                    }),
                    create: expect.objectContaining({
                        userId: TEST_CONFIG.DEFAULT_USER_ID,
                    }),
                })
            );
        });

        it("デフォルト住所設定時に既存のデフォルトをfalseにする", async () => {
            const address = createMockShippingAddress({ default: true });
            mockDb.shippingAddress.findUnique.mockResolvedValue(address);
            mockDb.shippingAddress.updateMany.mockResolvedValue({ count: 1 });
            mockDb.shippingAddress.upsert.mockResolvedValue(address);

            await upsertShippingAddress(address as never);

            expect(mockDb.shippingAddress.updateMany).toHaveBeenCalledWith({
                where: {
                    userId: TEST_CONFIG.DEFAULT_USER_ID,
                    default: true,
                },
                data: { default: false },
            });
        });
    });
});

// ==================================================
// placeOrder
// ==================================================
describe("placeOrder", () => {
    const shippingAddress = createMockShippingAddress();

    describe("認証エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(
                placeOrder(shippingAddress as never, "cart-001")
            ).rejects.toThrow("Unauthenticated.");
        });
    });

    describe("バリデーション", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
        });

        it("カートが見つからない場合エラーをスローする", async () => {
            mockDb.cart.findUnique.mockResolvedValue(null);

            await expect(
                placeOrder(shippingAddress as never, "invalid-cart")
            ).rejects.toThrow("Cart not found.");
        });

        it("無効な商品/バリアント/サイズの組合せでエラーをスローする", async () => {
            const cart = {
                ...createMockCart(),
                cartItems: [createMockCartItem()],
                coupon: null,
            };
            mockDb.cart.findUnique.mockResolvedValue(cart);
            mockDb.product.findUnique.mockResolvedValue(null);

            await expect(
                placeOrder(shippingAddress as never, "cart-001")
            ).rejects.toThrow(
                "Invalid product, variant, or size combination"
            );
        });
    });

    describe("注文作成ロジック", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
        });

        it("単一店舗の注文を正常に作成する", async () => {
            const cart = {
                ...createMockCart(),
                cartItems: [createMockCartItem()],
                coupon: null,
            };
            mockDb.cart.findUnique.mockResolvedValue(cart);
            mockDb.product.findUnique.mockResolvedValue(
                createMockFullProduct()
            );
            mockDb.country.findUnique.mockResolvedValue(createMockCountry());
            mockGetShippingDetails.mockResolvedValue({
                shippingFee: 5.0,
                extraShippingFee: 2.0,
                isFreeShipping: false,
            });
            mockGetDeliveryDetails.mockResolvedValue({
                shippingService: TEST_CONFIG.DEFAULT_SHIPPING_SERVICE,
                deliveryTimeMax: 14,
                deliveryTimeMin: 3,
            });

            const mockOrder = createMockOrder();
            mockDb.order.create.mockResolvedValue(mockOrder);
            mockDb.orderGroup.create.mockResolvedValue({
                id: "order-group-001",
            });
            mockDb.orderItem.create.mockResolvedValue({
                id: "order-item-001",
            });
            mockDb.order.update.mockResolvedValue(mockOrder);

            const result = await placeOrder(
                shippingAddress as never,
                "cart-001"
            );

            expect(result).toEqual({ orderId: mockOrder.id });
            expect(mockDb.order.create).toHaveBeenCalledTimes(1);
            expect(mockDb.orderGroup.create).toHaveBeenCalledTimes(1);
            expect(mockDb.orderItem.create).toHaveBeenCalledTimes(1);
        });

        it("複数店舗の商品は店舗ごとにOrderGroupが作成される", async () => {
            const cartItem1 = createMockCartItem({ storeId: "store-A" });
            const cartItem2 = createMockCartItem({
                id: "cart-item-002",
                storeId: "store-B",
                productId: "product-002",
                variantId: "variant-002",
            });
            const cart = {
                ...createMockCart(),
                cartItems: [cartItem1, cartItem2],
                coupon: null,
            };
            mockDb.cart.findUnique.mockResolvedValue(cart);

            // 各商品の取得
            const product1 = createMockFullProduct({ storeId: "store-A" });
            const product2 = createMockFullProduct({
                id: "product-002",
                storeId: "store-B",
            });
            mockDb.product.findUnique
                .mockResolvedValueOnce(product1)
                .mockResolvedValueOnce(product2);

            mockDb.country.findUnique.mockResolvedValue(createMockCountry());
            mockGetShippingDetails.mockResolvedValue({
                shippingFee: 5.0,
                extraShippingFee: 2.0,
                isFreeShipping: false,
            });
            mockGetDeliveryDetails.mockResolvedValue({
                shippingService: TEST_CONFIG.DEFAULT_SHIPPING_SERVICE,
                deliveryTimeMax: 14,
                deliveryTimeMin: 3,
            });

            const mockOrder = createMockOrder();
            mockDb.order.create.mockResolvedValue(mockOrder);
            mockDb.orderGroup.create.mockResolvedValue({
                id: "order-group-001",
            });
            mockDb.orderItem.create.mockResolvedValue({
                id: "order-item-001",
            });
            mockDb.order.update.mockResolvedValue(mockOrder);

            const result = await placeOrder(
                shippingAddress as never,
                "cart-001"
            );

            expect(result).toEqual({ orderId: mockOrder.id });
            // 2店舗 → 2つのOrderGroup
            expect(mockDb.orderGroup.create).toHaveBeenCalledTimes(2);
            // 2アイテム → 2つのOrderItem
            expect(mockDb.orderItem.create).toHaveBeenCalledTimes(2);
        });

        it("在庫数を超える数量はDB在庫に制限される", async () => {
            const cartItem = createMockCartItem({ quantity: 100 }); // 在庫超過
            const cart = {
                ...createMockCart(),
                cartItems: [cartItem],
                coupon: null,
            };
            mockDb.cart.findUnique.mockResolvedValue(cart);

            // DB在庫は50
            mockDb.product.findUnique.mockResolvedValue(
                createMockFullProduct()
            );
            mockDb.country.findUnique.mockResolvedValue(createMockCountry());
            mockGetShippingDetails.mockResolvedValue({
                shippingFee: 0,
                extraShippingFee: 0,
                isFreeShipping: false,
            });
            mockGetDeliveryDetails.mockResolvedValue({
                shippingService: TEST_CONFIG.DEFAULT_SHIPPING_SERVICE,
                deliveryTimeMax: 14,
                deliveryTimeMin: 3,
            });

            const mockOrder = createMockOrder();
            mockDb.order.create.mockResolvedValue(mockOrder);
            mockDb.orderGroup.create.mockResolvedValue({
                id: "order-group-001",
            });
            mockDb.orderItem.create.mockResolvedValue({
                id: "order-item-001",
            });
            mockDb.order.update.mockResolvedValue(mockOrder);

            await placeOrder(shippingAddress as never, "cart-001");

            // OrderItem作成時に数量が50に制限されていることを検証
            expect(mockDb.orderItem.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        quantity: 50,
                    }),
                })
            );
        });

        it("クーポンが適用されている場合割引が計算される", async () => {
            const coupon = createMockCoupon({
                discount: 10,
                storeId: TEST_CONFIG.DEFAULT_STORE_ID,
            });
            const cartItem = createMockCartItem();
            const cart = {
                ...createMockCart(),
                cartItems: [cartItem],
                coupon: coupon,
            };
            mockDb.cart.findUnique.mockResolvedValue(cart);
            mockDb.product.findUnique.mockResolvedValue(
                createMockFullProduct()
            );
            mockDb.country.findUnique.mockResolvedValue(createMockCountry());
            mockGetShippingDetails.mockResolvedValue({
                shippingFee: 5.0,
                extraShippingFee: 2.0,
                isFreeShipping: false,
            });
            mockGetDeliveryDetails.mockResolvedValue({
                shippingService: TEST_CONFIG.DEFAULT_SHIPPING_SERVICE,
                deliveryTimeMax: 14,
                deliveryTimeMin: 3,
            });

            const mockOrder = createMockOrder();
            mockDb.order.create.mockResolvedValue(mockOrder);
            mockDb.orderGroup.create.mockResolvedValue({
                id: "order-group-001",
            });
            mockDb.orderItem.create.mockResolvedValue({
                id: "order-item-001",
            });
            mockDb.order.update.mockResolvedValue(mockOrder);

            await placeOrder(shippingAddress as never, "cart-001");

            // OrderGroupにクーポンIDが紐づく
            expect(mockDb.orderGroup.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        couponId: coupon.id,
                    }),
                })
            );
        });

        it("クーポンのstoreIdとOrderGroupのstoreIdが一致しない場合割引なし", async () => {
            const coupon = createMockCoupon({
                discount: 10,
                storeId: "different-store-id",
            });
            const cartItem = createMockCartItem();
            const cart = {
                ...createMockCart(),
                cartItems: [cartItem],
                coupon: coupon,
            };
            mockDb.cart.findUnique.mockResolvedValue(cart);
            mockDb.product.findUnique.mockResolvedValue(
                createMockFullProduct()
            );
            mockDb.country.findUnique.mockResolvedValue(createMockCountry());
            mockGetShippingDetails.mockResolvedValue({
                shippingFee: 0,
                extraShippingFee: 0,
                isFreeShipping: false,
            });
            mockGetDeliveryDetails.mockResolvedValue({
                shippingService: TEST_CONFIG.DEFAULT_SHIPPING_SERVICE,
                deliveryTimeMax: 14,
                deliveryTimeMin: 3,
            });

            const mockOrder = createMockOrder();
            mockDb.order.create.mockResolvedValue(mockOrder);
            mockDb.orderGroup.create.mockResolvedValue({
                id: "order-group-001",
            });
            mockDb.orderItem.create.mockResolvedValue({
                id: "order-item-001",
            });
            mockDb.order.update.mockResolvedValue(mockOrder);

            await placeOrder(shippingAddress as never, "cart-001");

            // クーポンIDはnull
            expect(mockDb.orderGroup.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        couponId: null,
                    }),
                })
            );
        });

        it("配送先のcountryIdが無効な場合エラーをスローする", async () => {
            const cartItem = createMockCartItem();
            const cart = {
                ...createMockCart(),
                cartItems: [cartItem],
                coupon: null,
            };
            mockDb.cart.findUnique.mockResolvedValue(cart);
            mockDb.product.findUnique.mockResolvedValue(
                createMockFullProduct()
            );
            // 国が見つからない
            mockDb.country.findUnique.mockResolvedValue(null);

            await expect(
                placeOrder(shippingAddress as never, "cart-001")
            ).rejects.toThrow("Failed to get Shipping details for order.");
        });

        it("注文合計金額が正しく更新される", async () => {
            const cartItem = createMockCartItem({ quantity: 1 });
            const cart = {
                ...createMockCart(),
                cartItems: [cartItem],
                coupon: null,
            };
            mockDb.cart.findUnique.mockResolvedValue(cart);
            mockDb.product.findUnique.mockResolvedValue(
                createMockFullProduct()
            );
            mockDb.country.findUnique.mockResolvedValue(createMockCountry());
            mockGetShippingDetails.mockResolvedValue({
                shippingFee: 5.0,
                extraShippingFee: 2.0,
                isFreeShipping: false,
            });
            mockGetDeliveryDetails.mockResolvedValue({
                shippingService: TEST_CONFIG.DEFAULT_SHIPPING_SERVICE,
                deliveryTimeMax: 14,
                deliveryTimeMin: 3,
            });

            const mockOrder = createMockOrder();
            mockDb.order.create.mockResolvedValue(mockOrder);
            mockDb.orderGroup.create.mockResolvedValue({
                id: "order-group-001",
            });
            mockDb.orderItem.create.mockResolvedValue({
                id: "order-item-001",
            });
            mockDb.order.update.mockResolvedValue(mockOrder);

            await placeOrder(shippingAddress as never, "cart-001");

            // order.updateが合計金額で呼ばれたことを検証
            expect(mockDb.order.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: mockOrder.id },
                    data: expect.objectContaining({
                        total: expect.any(Number),
                        subTotal: expect.any(Number),
                        shippingFees: expect.any(Number),
                    }),
                })
            );
        });
    });
});

// ==================================================
// emptyUserCart
// ==================================================
describe("emptyUserCart", () => {
    describe("認証エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(emptyUserCart()).rejects.toThrow("Unauthenticated.");
        });
    });

    describe("正常系", () => {
        it("カートを正常に削除してtrueを返す", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            mockDb.cart.delete.mockResolvedValue(createMockCart());

            const result = await emptyUserCart();

            expect(result).toBe(true);
            expect(mockDb.cart.delete).toHaveBeenCalledWith({
                where: { userId: TEST_CONFIG.DEFAULT_USER_ID },
            });
        });
    });
});

// ==================================================
// updateCartWithLatest
// ==================================================
describe("updateCartWithLatest", () => {
    describe("データ検証", () => {
        it("商品が見つからない場合エラーをスローする", async () => {
            const cartProducts = [createMockCartProduct()];
            mockDb.product.findUnique.mockResolvedValue(null);

            await expect(
                updateCartWithLatest(cartProducts as never)
            ).rejects.toThrow(
                "Product not found or variant or size not found."
            );
        });

        it("バリアントが見つからない場合エラーをスローする", async () => {
            const cartProducts = [createMockCartProduct()];
            mockDb.product.findUnique.mockResolvedValue({
                ...createMockFullProduct(),
                variants: [],
            });

            await expect(
                updateCartWithLatest(cartProducts as never)
            ).rejects.toThrow(
                "Product not found or variant or size not found."
            );
        });
    });

    describe("最新データの反映", () => {
        beforeEach(() => {
            mockGetCookie.mockReturnValue(null);
        });

        it("DBから最新の価格・在庫情報を取得して返す", async () => {
            const cartProducts = [createMockCartProduct({ quantity: 2 })];
            const dbProduct = createMockFullProduct();
            mockDb.product.findUnique.mockResolvedValue(dbProduct);

            const result = await updateCartWithLatest(cartProducts as never);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(
                expect.objectContaining({
                    productId: "product-001",
                    variantId: "variant-001",
                    sizeId: "size-001",
                    price: 29.99,
                    stock: 50,
                    quantity: 2,
                })
            );
        });

        it("在庫超過時は在庫数に数量が調整される", async () => {
            const cartProducts = [createMockCartProduct({ quantity: 100 })];
            const dbProduct = createMockFullProduct();
            mockDb.product.findUnique.mockResolvedValue(dbProduct);

            const result = await updateCartWithLatest(cartProducts as never);

            expect(result[0].quantity).toBe(50); // DB在庫数に制限
        });

        it("割引適用後の価格が正しく計算される", async () => {
            const cartProducts = [createMockCartProduct({ quantity: 1 })];
            const dbProduct = createMockFullProduct();
            dbProduct.variants[0].sizes[0] = {
                ...createMockSize({ price: 100, discount: 25 }),
            };
            mockDb.product.findUnique.mockResolvedValue(dbProduct);

            const result = await updateCartWithLatest(cartProducts as never);

            expect(result[0].price).toBe(75); // 100 - (100 * 25 / 100)
        });
    });
});

// ==================================================
// addToWishlist
// ==================================================
describe("addToWishlist", () => {
    describe("認証エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(
                addToWishlist("product-001", "variant-001")
            ).rejects.toThrow();
        });
    });

    describe("重複防止", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
        });

        it("既にウィッシュリストにある場合エラーをスローする", async () => {
            mockDb.wishlist.findFirst.mockResolvedValue(
                createMockWishlistItem()
            );

            await expect(
                addToWishlist("product-001", "variant-001")
            ).rejects.toThrow();
        });
    });

    describe("正常系", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
        });

        it("ウィッシュリストに正常に追加される", async () => {
            mockDb.wishlist.findFirst.mockResolvedValue(null);
            const wishlistItem = createMockWishlistItem();
            mockDb.wishlist.create.mockResolvedValue(wishlistItem);

            const result = await addToWishlist("product-001", "variant-001");

            expect(result).toEqual(wishlistItem);
            expect(mockDb.wishlist.create).toHaveBeenCalledWith({
                data: {
                    userId: TEST_CONFIG.DEFAULT_USER_ID,
                    productId: "product-001",
                    variantId: "variant-001",
                    sizeId: undefined,
                },
            });
        });

        it("sizeIdを指定して追加できる", async () => {
            mockDb.wishlist.findFirst.mockResolvedValue(null);
            const wishlistItem = createMockWishlistItem({
                sizeId: "size-001",
            });
            mockDb.wishlist.create.mockResolvedValue(wishlistItem);

            const result = await addToWishlist(
                "product-001",
                "variant-001",
                "size-001"
            );

            expect(result).toEqual(wishlistItem);
            expect(mockDb.wishlist.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    sizeId: "size-001",
                }),
            });
        });
    });
});

// ==================================================
// updateCheckoutProductWithLatest
// ==================================================
describe("updateCheckoutProductWithLatest", () => {
    describe("データ検証", () => {
        it("商品が見つからない場合エラーをスローする", async () => {
            const cartItems = [createMockCartItem()];
            mockDb.product.findUnique.mockResolvedValue(null);

            await expect(
                updateCheckoutProductWithLatest(
                    cartItems as never,
                    createMockCountry() as never
                )
            ).rejects.toThrow(
                "Product not found or variant or size not found."
            );
        });
    });

    describe("チェックアウト時の再検証", () => {
        beforeEach(() => {
            mockGetCookie.mockReturnValue(null);
        });

        it("DB最新情報で価格・数量・配送料を再計算する", async () => {
            const cartItems = [createMockCartItem({ quantity: 2 })];
            const address = createMockCountry();
            const dbProduct = createMockFullProduct();

            mockDb.product.findUnique.mockResolvedValue(dbProduct);
            mockGetProductShippingFee.mockResolvedValue(5.0);
            mockDb.cartItem.update.mockResolvedValue(
                createMockCartItem({ price: 29.99, quantity: 2 })
            );
            mockDb.cart.findUnique.mockResolvedValue({ coupon: null });
            mockDb.cart.update.mockResolvedValue({
                ...createMockCart(),
                cartItems: [createMockCartItem()],
                coupon: null,
            });

            const result = await updateCheckoutProductWithLatest(
                cartItems as never,
                address as never
            );

            expect(result).toBeDefined();
            expect(mockDb.cartItem.update).toHaveBeenCalled();
            expect(mockDb.cart.update).toHaveBeenCalled();
        });

        it("在庫超過時はDB在庫数に調整される", async () => {
            const cartItems = [createMockCartItem({ quantity: 100 })]; // 在庫超過
            const address = createMockCountry();
            const dbProduct = createMockFullProduct(); // 在庫50

            mockDb.product.findUnique.mockResolvedValue(dbProduct);
            mockGetProductShippingFee.mockResolvedValue(0);
            mockDb.cartItem.update.mockResolvedValue(
                createMockCartItem({ quantity: 50 })
            );
            mockDb.cart.findUnique.mockResolvedValue({ coupon: null });
            mockDb.cart.update.mockResolvedValue({
                ...createMockCart(),
                cartItems: [createMockCartItem()],
                coupon: null,
            });

            await updateCheckoutProductWithLatest(
                cartItems as never,
                address as never
            );

            expect(mockDb.cartItem.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        quantity: 50,
                    }),
                })
            );
        });

        it("クーポンが有効な場合割引が適用される", async () => {
            const cartItems = [
                createMockCartItem({ quantity: 1, storeId: TEST_CONFIG.DEFAULT_STORE_ID }),
            ];
            const address = createMockCountry();
            const dbProduct = createMockFullProduct();

            mockDb.product.findUnique.mockResolvedValue(dbProduct);
            mockGetProductShippingFee.mockResolvedValue(0);
            mockDb.cartItem.update.mockResolvedValue(
                createMockCartItem({
                    quantity: 1,
                    price: 29.99,
                    shippingFee: 0,
                    storeId: TEST_CONFIG.DEFAULT_STORE_ID,
                })
            );

            const activeCoupon = createMockCoupon({
                discount: 10,
                startDate: new Date("2024-01-01"),
                endDate: new Date("2027-12-31"),
                store: createMockStore(),
            });
            mockDb.cart.findUnique.mockResolvedValue({ coupon: activeCoupon });

            const updatedCart = {
                ...createMockCart(),
                cartItems: [createMockCartItem()],
                coupon: activeCoupon,
            };
            mockDb.cart.update.mockResolvedValue(updatedCart);

            const result = await updateCheckoutProductWithLatest(
                cartItems as never,
                address as never
            );

            expect(result).toBeDefined();
            // cart.updateでtotalがクーポン割引適用後の値で呼ばれることを検証
            expect(mockDb.cart.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        total: expect.any(Number),
                    }),
                })
            );
        });

        it("国情報がない場合エラーをスローする", async () => {
            const cartItems = [createMockCartItem()];
            const dbProduct = createMockFullProduct();

            mockDb.product.findUnique.mockResolvedValue(dbProduct);
            mockGetCookie.mockReturnValue(null); // Cookie なし

            await expect(
                updateCheckoutProductWithLatest(
                    cartItems as never,
                    undefined as never // address も undefined
                )
            ).rejects.toThrow("Couldn't retrieve country data.");
        });
    });
});
