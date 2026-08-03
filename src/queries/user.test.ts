import { currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
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
            deleteMany: jest.fn(),
            update: jest.fn(),
        },
        cartItem: {
            update: jest.fn(),
        },
        shippingAddress: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
            findUnique: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
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
        size: {
            updateMany: jest.fn(),
            update: jest.fn(),
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
        $queryRaw: jest.fn(),
        $transaction: jest.fn(),
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
    beforeEach(() => {
        // saveUserCart の transaction callback を同じ DB モックで実行する。
        mockDb.$transaction.mockImplementation(
            async (callback: (tx: typeof mockDb) => Promise<unknown>) =>
                callback(mockDb)
        );
    });

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
                variants: [
                    {
                        ...variant,
                        sizes: [],
                        images: [createMockVariantImage()],
                    },
                ],
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
                                    price: new Prisma.Decimal("29.99"), // DB価格が使用されている
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
            mockDb.cart.deleteMany.mockResolvedValue({ count: 1 });
            mockDb.product.findUnique.mockResolvedValue(
                createMockFullProduct()
            );
            mockDb.cart.create.mockResolvedValue({ id: "cart-new" });

            await saveUserCart(cartProducts as never);

            expect(mockDb.cart.deleteMany).toHaveBeenCalledWith({
                where: { userId: TEST_CONFIG.DEFAULT_USER_ID },
            });
            expect(mockDb.cart.create).toHaveBeenCalled();
        });

        // Cart.userId は @unique。findFirst(検証前の読み取り) と transaction の間には
        // TOCTOU があり、同一ユーザーの並行保存で delete の P2025 /
        // create の P2002 が起きうる。Serializable で DB 側の直列化に委ねる。
        it("カート保存をユーザー単位で直列化する", async () => {
            const cartProducts = [createMockCartProduct()];
            mockDb.cart.findFirst.mockResolvedValue(null);
            mockDb.product.findUnique.mockResolvedValue(
                createMockFullProduct()
            );
            mockDb.cart.create.mockResolvedValue({ id: "cart-new" });

            await saveUserCart(cartProducts as never);

            expect(mockDb.$transaction).toHaveBeenCalledWith(
                expect.any(Function),
                expect.objectContaining({ isolationLevel: "Serializable" })
            );
        });

        it("既存カートの削除は冪等に行う（並行削除で失敗させない）", async () => {
            // findFirst で既存カートを観測した後に他リクエストが先に削除しても、
            // deleteMany なら count:0 を返すだけで P2025 にならない。
            const cartProducts = [createMockCartProduct()];
            mockDb.cart.findFirst.mockResolvedValue(createMockCart());
            mockDb.cart.deleteMany.mockResolvedValue({ count: 0 });
            mockDb.product.findUnique.mockResolvedValue(
                createMockFullProduct()
            );
            mockDb.cart.create.mockResolvedValue({ id: "cart-new" });

            await expect(saveUserCart(cartProducts as never)).resolves.toBe(
                true
            );

            expect(mockDb.cart.delete).not.toHaveBeenCalled();
        });

        // Serializable は競合を「壊れたデータ」ではなく「やり直せるエラー(P2034)」へ
        // 変換する。再試行がなければ P2002/P2025 を P2034 に置き換えただけになり、
        // 正当なリクエストが落ちる問題は解決しない。
        it("直列化異常(P2034)で失敗したtransactionを再試行する", async () => {
            const cartProducts = [createMockCartProduct()];
            mockDb.cart.findFirst.mockResolvedValue(null);
            mockDb.product.findUnique.mockResolvedValue(
                createMockFullProduct()
            );
            mockDb.cart.create.mockResolvedValue({ id: "cart-new" });

            const serializationFailure =
                new Prisma.PrismaClientKnownRequestError(
                    "could not serialize access",
                    { code: "P2034", clientVersion: "test" }
                );
            mockDb.$transaction
                .mockRejectedValueOnce(serializationFailure)
                .mockImplementation(
                    async (callback: (tx: typeof mockDb) => Promise<unknown>) =>
                        callback(mockDb)
                );

            await expect(saveUserCart(cartProducts as never)).resolves.toBe(
                true
            );

            expect(mockDb.$transaction).toHaveBeenCalledTimes(2);
        });

        it("直列化異常以外のtransaction失敗は再試行せず伝播する", async () => {
            const cartProducts = [createMockCartProduct()];
            mockDb.cart.findFirst.mockResolvedValue(null);
            mockDb.product.findUnique.mockResolvedValue(
                createMockFullProduct()
            );

            const uniqueViolation = new Prisma.PrismaClientKnownRequestError(
                "unique constraint failed",
                { code: "P2002", clientVersion: "test" }
            );
            mockDb.$transaction.mockRejectedValue(uniqueViolation);

            await expect(
                saveUserCart(cartProducts as never)
            ).rejects.toMatchObject({ code: "P2002" });

            expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
        });

        it("削除・作成を単一transactionへ配線し、コールバック内の失敗を伝播する", async () => {
            const cartProducts = [createMockCartProduct()];
            const transactionCart = {
                deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
                create: jest
                    .fn()
                    .mockRejectedValue(new Error("Cart creation failed")),
            };

            mockDb.cart.findFirst.mockResolvedValue(createMockCart());
            mockDb.product.findUnique.mockResolvedValue(
                createMockFullProduct()
            );
            mockDb.$transaction.mockImplementation(
                async (callback: (tx: unknown) => Promise<unknown>) =>
                    callback({ cart: transactionCart })
            );

            await expect(saveUserCart(cartProducts as never)).rejects.toThrow(
                "Cart creation failed"
            );

            expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
            expect(transactionCart.deleteMany).toHaveBeenCalledWith({
                where: { userId: TEST_CONFIG.DEFAULT_USER_ID },
            });
            expect(transactionCart.create).toHaveBeenCalledTimes(1);
            expect(mockDb.cart.delete).not.toHaveBeenCalled();
            expect(mockDb.cart.create).not.toHaveBeenCalled();
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
                                    price: new Prisma.Decimal("90"), // 100 * (100-10) / 100
                                }),
                            ]),
                        }),
                    }),
                })
            );
        });

        it("カート合計金額が正しく計算される", async () => {
            const cartProducts = [createMockCartProduct({ quantity: 2 })];
            const dbProduct = createMockFullProduct();
            mockDb.product.findUnique.mockResolvedValue(dbProduct);
            mockDb.cart.create.mockResolvedValue({ id: "cart-new" });

            await saveUserCart(cartProducts as never);

            // subTotal = 29.99 * 2 = 59.98, shippingFee = 0 (Cookieなし), total = 59.98
            expect(mockDb.cart.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        subTotal: new Prisma.Decimal("59.98"),
                        shippingFees: new Prisma.Decimal("0"),
                        total: new Prisma.Decimal("59.98"),
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

        it("在庫0で validQuantity が0になっても ITEM 方式の配送料が負にならない", async () => {
            // Arrange: ITEM 方式・在庫 0。追加個数は max(0, 0-1) = 0 個として扱われ、
            // 基本配送料のみが残るべき。追加配送料を「マイナス 1 個分」引いてはならない。
            const cartProducts = [createMockCartProduct({ quantity: 1 })];
            mockGetCookie.mockReturnValue(
                JSON.stringify({ name: "Japan", code: "JP" })
            );
            mockGetShippingDetails.mockResolvedValue({
                shippingFee: 10,
                extraShippingFee: 3,
                isFreeShipping: false,
            });
            const outOfStockProduct = createMockFullProduct({
                variants: [
                    {
                        ...createMockProductVariant(),
                        sizes: [createMockSize({ quantity: 0 })],
                        images: [createMockVariantImage()],
                    },
                ],
            });
            mockDb.product.findUnique.mockResolvedValue(outOfStockProduct);
            mockDb.cart.create.mockResolvedValue({ id: "cart-new" });

            // Act
            await saveUserCart(cartProducts as never);

            // Assert: 10 + 3 * 0 = 10（10 - 3 = 7 になってはいけない）
            expect(mockDb.cart.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        cartItems: expect.objectContaining({
                            create: expect.arrayContaining([
                                expect.objectContaining({
                                    shippingFee: new Prisma.Decimal("10"),
                                }),
                            ]),
                        }),
                    }),
                })
            );
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
                createMockShippingAddress({
                    id: "address-002",
                    default: false,
                }),
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
            await expect(upsertShippingAddress(null as never)).rejects.toThrow(
                "Please provide shipping address data."
            );
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
            mockDb.shippingAddress.findFirst.mockResolvedValue(null);
            mockDb.shippingAddress.create.mockResolvedValue(address);

            const result = await upsertShippingAddress(address as never);

            expect(result).toEqual(address);
            expect(mockDb.shippingAddress.findFirst).toHaveBeenCalledWith({
                where: { id: address.id, userId: TEST_CONFIG.DEFAULT_USER_ID },
            });
            expect(mockDb.shippingAddress.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId: TEST_CONFIG.DEFAULT_USER_ID,
                }),
            });
        });

        it("デフォルト住所設定時に既存のデフォルトをfalseにする", async () => {
            const address = createMockShippingAddress({ default: true });
            // findUnique: default=true 時の既存アドレス確認
            mockDb.shippingAddress.findUnique.mockResolvedValue(address);
            mockDb.shippingAddress.updateMany.mockResolvedValue({ count: 1 });
            // findFirst: 所有権検証 → update
            mockDb.shippingAddress.findFirst.mockResolvedValue(address);
            mockDb.shippingAddress.update.mockResolvedValue(address);

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
            mockDb.shippingAddress.findFirst.mockResolvedValue(shippingAddress);
        });

        it("カートが見つからない場合エラーをスローする", async () => {
            mockDb.cart.findUnique.mockResolvedValue(null);

            await expect(
                placeOrder(shippingAddress as never, "invalid-cart")
            ).rejects.toThrow("Cart not found.");
        });

        it("認証ユーザーが所有しない配送先住所を拒否し、注文トランザクションを開始しない", async () => {
            mockDb.cart.findUnique.mockResolvedValue({
                ...createMockCart(),
                cartItems: [],
                coupon: null,
            });
            mockDb.shippingAddress.findFirst.mockResolvedValue(null);

            await expect(
                placeOrder(shippingAddress as never, "cart-001")
            ).rejects.toThrow("Shipping address not found.");

            expect(mockDb.shippingAddress.findFirst).toHaveBeenCalledWith({
                where: {
                    id: shippingAddress.id,
                    userId: TEST_CONFIG.DEFAULT_USER_ID,
                },
            });
            expect(mockDb.$transaction).not.toHaveBeenCalled();
            expect(mockDb.order.create).not.toHaveBeenCalled();
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
            ).rejects.toThrow("Invalid product, variant, or size combination");
        });
    });

    describe("注文作成ロジック", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            mockDb.shippingAddress.findFirst.mockResolvedValue(shippingAddress);
            // $transaction モック: コールバックに mockDb を渡して実行
            mockDb.$transaction.mockImplementation(
                async (callback: (tx: typeof mockDb) => Promise<unknown>) =>
                    callback(mockDb)
            );
            // F3: 在庫減算は既定で「在庫十分（1 行更新）」として既存成功系を壊さない
            mockDb.size.updateMany.mockResolvedValue({ count: 1 });
            // 冪等性ゲート: カート消費は既定で成功（1 行削除）とする
            mockDb.cart.deleteMany.mockResolvedValue({ count: 1 });
            // tx 内の住所ロック（SELECT … FOR UPDATE）は既定で「所有のまま 1 行返る」
            mockDb.$queryRaw.mockResolvedValue([{ id: shippingAddress.id }]);
        });

        it("注文トランザクション内でカートを消費し、二重注文を防ぐ", async () => {
            // カート行を単一使用トークンとして扱う。クライアントの多重送信ガードは
            // Server Action を直接叩けば迂回できるため、サーバー側で直列化する。
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
            mockDb.order.create.mockResolvedValue(createMockOrder());
            mockDb.orderGroup.create.mockResolvedValue({
                id: "order-group-001",
            });
            mockDb.orderItem.create.mockResolvedValue({
                id: "order-item-001",
            });
            mockDb.order.update.mockResolvedValue(createMockOrder());

            await placeOrder(shippingAddress as never, "cart-001");

            // 所有権込みの条件付き削除であること（他人のカートを消費させない）
            expect(mockDb.cart.deleteMany).toHaveBeenCalledWith({
                where: { id: "cart-001", userId: TEST_CONFIG.DEFAULT_USER_ID },
            });
            // 注文作成より前に消費すること（ゲートとして機能する順序）
            expect(
                mockDb.cart.deleteMany.mock.invocationCallOrder[0]
            ).toBeLessThan(mockDb.order.create.mock.invocationCallOrder[0]);
        });

        it("在庫0のサイズは注文を拒否し、数量0の明細を作らない", async () => {
            // Arrange: `validQuantity = Math.min(quantity, size.quantity)` は 0 を通すため、
            // 在庫 0 のサイズが **quantity: 0 の OrderItem** として確定していた。
            //
            // 直後のアトミック減算は `where: { quantity: { gte: 0 } }` /
            // `decrement: 0` になるので必ず 1 行にマッチし、`count === 0` の
            // 在庫不足検知を**素通り**する。さらに ITEM 方式では
            // `Math.max(0, 0 - 1) = 0` で基本配送料だけが残るため、
            // **数量 0 の行に送料が課金される**。
            //
            // 正しい振る舞いは、アトミック減算が在庫不足で throw するのと同じ
            // `"在庫が不足しています"` で、$transaction を開く前に拒否すること。
            const cart = {
                ...createMockCart(),
                cartItems: [createMockCartItem()],
                coupon: null,
            };
            mockDb.cart.findUnique.mockResolvedValue(cart);
            mockDb.product.findUnique.mockResolvedValue(
                createMockFullProduct({
                    variants: [
                        {
                            ...createMockProductVariant(),
                            sizes: [createMockSize({ quantity: 0 })],
                            images: [createMockVariantImage()],
                        },
                    ],
                })
            );
            mockDb.country.findUnique.mockResolvedValue(createMockCountry());
            mockGetShippingDetails.mockResolvedValue({
                shippingFee: 10,
                extraShippingFee: 3,
                isFreeShipping: false,
            });
            mockGetDeliveryDetails.mockResolvedValue({
                shippingService: TEST_CONFIG.DEFAULT_SHIPPING_SERVICE,
                deliveryTimeMax: 14,
                deliveryTimeMin: 3,
            });
            mockDb.order.create.mockResolvedValue(createMockOrder());
            mockDb.orderGroup.create.mockResolvedValue({
                id: "order-group-001",
            });
            mockDb.orderItem.create.mockResolvedValue({
                id: "order-item-001",
            });
            mockDb.order.update.mockResolvedValue(createMockOrder());

            // Act & Assert: アトミック減算と同じ文言で拒否される
            await expect(
                placeOrder(shippingAddress as never, "cart-001")
            ).rejects.toThrow(/^在庫が不足しています$/);

            // 検証は $transaction の外（:757 より前）にあるため、注文リソースは
            // 1 つも作られない。数量 0 の明細が残らないことが本テストの主眼。
            // トランザクション自体が開かれていないことも固定する（create 群が
            // 未呼び出しでも、トランザクションを開いてから中で落ちる実装なら
            // 接続とロックを無駄に取る — 「外で弾く」設計はここでしか守れない）。
            expect(mockDb.$transaction).not.toHaveBeenCalled();
            expect(mockDb.order.create).not.toHaveBeenCalled();
            expect(mockDb.orderGroup.create).not.toHaveBeenCalled();
            expect(mockDb.orderItem.create).not.toHaveBeenCalled();
        });

        it("カートが既に消費済みなら注文を作成せず Cart not found. を投げる", async () => {
            // 並行 2 リクエストのうち削除に成功するのは 1 つだけ。もう一方は
            // count === 0 となり、$transaction ごとロールバックされる。
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
            mockDb.cart.deleteMany.mockResolvedValue({ count: 0 });

            await expect(
                placeOrder(shippingAddress as never, "cart-001")
            ).rejects.toThrow("Cart not found.");

            expect(mockDb.order.create).not.toHaveBeenCalled();
            expect(mockDb.size.updateMany).not.toHaveBeenCalled();
        });

        it("tx 内の住所ロックが空なら注文を作成せず Shipping address not found. を投げる（TOCTOU）", async () => {
            // tx 外の所有権チェック（findFirst）は通るが、商品検証や配送料計算の間に
            // 住所が別ユーザーへ付け替えられるケース。tx 内で読み直さないと他人の住所を
            // 注文に付けられてしまう。
            //
            // 素の SELECT（findFirst）では窓が縮むだけで閉じない —— 行ロックを取らない
            // ため、再読と order.create の間に付け替えが commit されうる。FK が取る
            // FOR KEY SHARE は DELETE とは競合するが、userId の付け替えは参照キー列を
            // 触らないので FOR NO KEY UPDATE となり競合しない。よって明示的な
            // SELECT … FOR UPDATE が要る。
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
            // tx 外の所有権チェックは通る
            mockDb.shippingAddress.findFirst
                .mockReset()
                .mockResolvedValue(shippingAddress);
            // tx 内のロック取得後、述語の再評価で行が脱落（= 付け替え済み）
            mockDb.$queryRaw.mockResolvedValue([]);

            await expect(
                placeOrder(shippingAddress as never, "cart-001")
            ).rejects.toThrow("Shipping address not found.");

            // ロックは FOR UPDATE で、id と userId の両方にスコープされていること。
            // タグ付きテンプレートなので呼び出しは (strings, ...values) の形になる。
            const [sqlParts, ...values] = mockDb.$queryRaw.mock.calls[0];
            expect(sqlParts.join("?")).toMatch(/FOR UPDATE/);
            expect(sqlParts.join("?")).toMatch(/"ShippingAddress"/);
            expect(values).toEqual([
                shippingAddress.id,
                TEST_CONFIG.DEFAULT_USER_ID,
            ]);
            // 再検証は order.create より前に走り、注文は作成されない
            expect(mockDb.order.create).not.toHaveBeenCalled();
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

        it("クライアントが countryId を偽装しても所有住所(ownedAddress)のサーバー値を使う", async () => {
            // 攻撃者は自分の住所 id を渡しつつ countryId だけ別国に改ざんできる。
            // 所有権検証後は ownedAddress のサーバー値で配送/税判定すべき（クライアント値は無視）。
            const forgedAddress = createMockShippingAddress({
                countryId: "country-FORGED",
            });
            const ownedAddress = createMockShippingAddress({
                countryId: "country-001", // サーバー DB 上の真の国
            });
            mockDb.shippingAddress.findFirst.mockResolvedValue(ownedAddress);

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
            mockDb.orderItem.create.mockResolvedValue({ id: "order-item-001" });
            mockDb.order.update.mockResolvedValue(mockOrder);

            await placeOrder(forgedAddress as never, "cart-001");

            // 国判定はサーバー値 country-001 を使い、偽装 country-FORGED は使われない
            expect(mockDb.country.findUnique).toHaveBeenCalledWith({
                where: { id: "country-001" },
            });
            expect(mockGetDeliveryDetails).toHaveBeenCalledWith(
                expect.any(String),
                "country-001"
            );
            expect(mockDb.country.findUnique).not.toHaveBeenCalledWith({
                where: { id: "country-FORGED" },
            });
            // 注文に紐づく住所も ownedAddress.id（サーバー値）
            expect(mockDb.order.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        shippingAddressId: ownedAddress.id,
                    }),
                })
            );
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

        it("isActive=false のクーポンが適用されている場合は割引が適用されない", async () => {
            const coupon = createMockCoupon({
                discount: 10,
                storeId: TEST_CONFIG.DEFAULT_STORE_ID,
                isActive: false,
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

            // isActive=false のため割引なし: couponId は null
            expect(mockDb.orderGroup.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        couponId: null,
                    }),
                })
            );
        });

        it("PLATFORMスコープのクーポンは複数店舗の全OrderGroupに割引・couponIdを紐付け、端数は最終グループで吸収する", async () => {
            const coupon = createMockCoupon({
                discount: 15,
                scope: "PLATFORM",
                storeId: null,
            });
            const cartItemA = createMockCartItem({
                storeId: "store-A",
                quantity: 1,
            });
            const cartItemB = createMockCartItem({
                id: "cart-item-002",
                storeId: "store-B",
                productId: "product-002",
                variantId: "variant-002",
                quantity: 1,
            });
            const cart = {
                ...createMockCart(),
                cartItems: [cartItemA, cartItemB],
                coupon,
            };
            mockDb.cart.findUnique.mockResolvedValue(cart);

            const productA = createMockFullProduct({
                storeId: "store-A",
                variants: [
                    {
                        ...createMockProductVariant(),
                        sizes: [createMockSize({ price: 10 })],
                        images: [createMockVariantImage()],
                    },
                ],
            });
            const productB = createMockFullProduct({
                id: "product-002",
                storeId: "store-B",
                variants: [
                    {
                        ...createMockProductVariant({ id: "variant-002" }),
                        sizes: [createMockSize({ price: 20 })],
                        images: [createMockVariantImage()],
                    },
                ],
            });
            mockDb.product.findUnique
                .mockResolvedValueOnce(productA)
                .mockResolvedValueOnce(productB);

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

            // 2店舗 → 両方のOrderGroupにcouponIdが紐付く
            const calls = mockDb.orderGroup.create.mock.calls;
            expect(calls).toHaveLength(2);
            for (const call of calls) {
                expect(call[0].data.couponId).toBe(coupon.id);
            }

            // storeA: 10 - (10*0.15=1.50) = 8.50 / storeB(最終グループ): 20 - (4.50-1.50=3.00) = 17.00
            const totals = calls.map((call: (typeof calls)[number]) =>
                call[0].data.total.toString()
            );
            expect(totals).toEqual(["8.5", "17"]);

            // 端数吸収後の合計はカート全体の割引(30*0.15=4.50)と一致する
            expect(
                mockDb.order.update.mock.calls[0][0].data.total.toString()
            ).toBe("25.5");
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
                        total: expect.any(Prisma.Decimal),
                        subTotal: expect.any(Prisma.Decimal),
                        shippingFees: expect.any(Prisma.Decimal),
                    }),
                })
            );
        });
    });

    // ------------------------------------------------------------------
    // F3: 在庫のアトミック減算（placeOrder）
    // ------------------------------------------------------------------
    describe("在庫減算（F3）", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            mockDb.$transaction.mockImplementation(
                async (callback: (tx: typeof mockDb) => Promise<unknown>) =>
                    callback(mockDb)
            );

            const cart = {
                ...createMockCart(),
                cartItems: [createMockCartItem({ quantity: 3 })],
                coupon: null,
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
        });

        // AC-F3-2: 在庫不足 → throw + 注文全体ロールバック（最終 order.update 未到達）
        it("在庫不足（updateMany が count:0）の場合、注文をロールバックする", async () => {
            mockDb.size.updateMany.mockResolvedValue({ count: 0 });

            await expect(
                placeOrder(shippingAddress as never, "cart-001")
            ).rejects.toThrow("在庫が不足しています");

            // 合計確定の最終 update に到達しない＝$transaction はロールバックされる
            expect(mockDb.order.update).not.toHaveBeenCalled();
        });

        // AC-F3-1: 在庫十分 → 減算が注文数分行われる
        it("在庫十分の場合、Size.quantity を注文数分 decrement する", async () => {
            mockDb.size.updateMany.mockResolvedValue({ count: 1 });

            await placeOrder(shippingAddress as never, "cart-001");

            expect(mockDb.size.updateMany).toHaveBeenCalledTimes(1);
            expect(mockDb.order.update).toHaveBeenCalledTimes(1);
        });

        // AC-F3-3: レース回避の構造検証（条件付き updateMany）
        it("updateMany は quantity:{ gte } 条件付きで decrement する（レース回避）", async () => {
            mockDb.size.updateMany.mockResolvedValue({ count: 1 });

            await placeOrder(shippingAddress as never, "cart-001");

            expect(mockDb.size.updateMany).toHaveBeenCalledWith({
                where: { id: "size-001", quantity: { gte: 3 } },
                data: { quantity: { decrement: 3 } },
            });
        });
    });

    describe("トランザクションの実行時間上限", () => {
        it("注文トランザクションは明示的な timeout / maxWait を宣言する", async () => {
            // Prisma の interactive transaction は既定 maxWait 2s / timeout 5s。
            // placeOrder はカート消費 → 住所の FOR UPDATE ロック → 商品取得 →
            // 店舗ごとの OrderGroup / OrderItem 作成 → 在庫 CAS → 合計確定 と
            // 書き込みが多く、注文点数に比例して伸びる。既定 5s を超えると
            // P2028 でロールバックされるが、**その 5s はコードのどこにも書かれて
            // いない** —— 上限を読むには Prisma の既定値を知っている必要がある。
            //
            // 上限そのものより「上限が明示されていること」を固定する。ロック
            // （SELECT … FOR UPDATE）を保持する時間の上限は、並行リクエストの
            // 待ち時間の上限でもあるため、暗黙の既定値に委ねてよい値ではない。
            mockDb.size.updateMany.mockResolvedValue({ count: 1 });

            await placeOrder(shippingAddress as never, "cart-001");

            expect(mockDb.$transaction).toHaveBeenCalledWith(
                expect.any(Function),
                expect.objectContaining({
                    timeout: expect.any(Number),
                    maxWait: expect.any(Number),
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
            mockDb.cart.deleteMany.mockResolvedValue({ count: 1 });

            const result = await emptyUserCart();

            expect(result).toBe(true);
            expect(mockDb.cart.deleteMany).toHaveBeenCalledWith({
                where: { userId: TEST_CONFIG.DEFAULT_USER_ID },
            });
        });

        it("カートが既に存在しない場合もエラーにせず true を返す（冪等）", async () => {
            // placeOrder が注文トランザクション内でカートを消費した後、
            // クライアントの後片付け呼び出しが偽のエラーログを出さないこと。
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
            });
            mockDb.cart.deleteMany.mockResolvedValue({ count: 0 });

            await expect(emptyUserCart()).resolves.toBe(true);
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
            ).rejects.toThrow("Unauthenticated.");
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
            ).rejects.toThrow("Product is already in the wishlist.");
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
    beforeEach(() => {
        (currentUser as jest.Mock).mockResolvedValue({
            id: TEST_CONFIG.DEFAULT_USER_ID,
        });
        // 所有権チェックは cartItems.id の集合で行うため、デフォルト item を含める
        mockDb.cart.findFirst.mockResolvedValue({
            ...createMockCart(),
            cartItems: [{ id: "cart-item-001" }],
        });
    });

    describe("IDOR 防御", () => {
        it("他カートの cartItem.id が混入している場合は拒否し update を呼ばない", async () => {
            // Arrange: 所有カートには cart-item-001 のみ存在する
            mockDb.cart.findFirst.mockResolvedValue({
                ...createMockCart(),
                cartItems: [{ id: "cart-item-001" }],
            });
            const cartItems = [
                createMockCartItem({ id: "cart-item-001" }),
                createMockCartItem({ id: "cart-item-OTHER" }), // 他ユーザーのカートアイテム
            ];

            // Act & Assert: 不正アイテム混入で拒否される
            await expect(
                updateCheckoutProductWithLatest(
                    cartItems as never,
                    createMockCountry() as never
                )
            ).rejects.toThrow(
                "Unauthorized: cart item does not belong to current user."
            );

            // 副作用なし: いかなる cartItem も更新されない
            expect(mockDb.cartItem.update).not.toHaveBeenCalled();
        });
    });

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
            mockGetProductShippingFee.mockResolvedValue(
                new Prisma.Decimal("5.0")
            );
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
            mockGetProductShippingFee.mockResolvedValue(
                new Prisma.Decimal("0")
            );
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
                createMockCartItem({
                    quantity: 1,
                    storeId: TEST_CONFIG.DEFAULT_STORE_ID,
                }),
            ];
            const address = createMockCountry();
            const dbProduct = createMockFullProduct();

            mockDb.product.findUnique.mockResolvedValue(dbProduct);
            mockGetProductShippingFee.mockResolvedValue(
                new Prisma.Decimal("0")
            );
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
                        total: expect.any(Prisma.Decimal),
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

        it("PLATFORMスコープでcoupon.store=nullでもTypeErrorにならず全item割引対象になる", async () => {
            const cartItems = [
                createMockCartItem({ quantity: 1, storeId: "store-A" }),
            ];
            const address = createMockCountry();
            const dbProduct = createMockFullProduct({ storeId: "store-A" });

            mockDb.product.findUnique.mockResolvedValue(dbProduct);
            mockGetProductShippingFee.mockResolvedValue(
                new Prisma.Decimal("0")
            );
            mockDb.cartItem.update.mockResolvedValue(
                createMockCartItem({
                    quantity: 1,
                    price: 29.99,
                    shippingFee: 0,
                    storeId: "store-A",
                })
            );

            const platformCoupon = createMockCoupon({
                discount: 10,
                scope: "PLATFORM",
                storeId: null,
                startDate: new Date("2024-01-01"),
                endDate: new Date("2027-12-31"),
                store: undefined,
            });
            mockDb.cart.findUnique.mockResolvedValue({
                coupon: platformCoupon,
            });

            const updatedCart = {
                ...createMockCart(),
                cartItems: [createMockCartItem()],
                coupon: { ...platformCoupon, store: null },
            };
            mockDb.cart.update.mockResolvedValue(updatedCart);

            const result = await updateCheckoutProductWithLatest(
                cartItems as never,
                address as never
            );

            expect(result).toBeDefined();
            expect(result.coupon?.store).toBeNull();
            // storeId に関わらず割引が適用される（PLATFORM スコープ）
            expect(mockDb.cart.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        total: expect.any(Prisma.Decimal),
                    }),
                })
            );
            const calledTotal = mockDb.cart.update.mock.calls[0][0].data
                .total as Prisma.Decimal;
            // 29.99 - (29.99 * 10 / 100) = 26.991
            expect(calledTotal.toString()).toBe("26.991");
        });
    });
});
