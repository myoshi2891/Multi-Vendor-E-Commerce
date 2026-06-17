import { currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import {
    upsertCoupon,
    getStoreCoupons,
    getCoupon,
    deleteCoupon,
    applyCoupon,
    getAllCoupons,
    upsertCouponAsAdmin,
    deleteCouponAsAdmin,
    toggleCouponActive,
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
            update: jest.fn(),
            delete: jest.fn(),
        },
        cart: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            findFirstOrThrow: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn(),
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
            // 認可ガード (requireStoreOwner) は try の外で先に実行されるため、
            // 入力バリデーションに到達するには所有ストアの解決が必要
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
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

        it("ストアが見つからない / 所有者でない場合 Forbidden をスロー (auth-guards 経由で集約)", async () => {
            // 旧実装は url のみで store を検索していたため
            //   - 存在しない URL → "Store with URL ... not found"
            //   - 他人の URL    → 後段の userId 比較で別エラー
            // と区別されたが、requireStoreOwner は where: { url, userId } の
            // 複合検索で双方を 1 メッセージに統合する (IDOR 強化 / 列挙耐性)。
            const coupon = createMockCoupon();
            mockDb.store.findUnique.mockResolvedValue(null);

            await expect(
                upsertCoupon(coupon as never, "nonexistent-store")
            ).rejects.toThrow("Forbidden: store not owned by current user.");
        });

        it("同一ストア内でコード重複の場合エラーをスローする", async () => {
            const coupon = createMockCoupon({ id: "new-coupon" });
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
            mockDb.coupon.findFirst.mockResolvedValue(
                createMockCoupon({ id: "existing-coupon" })
            );

            await expect(
                upsertCoupon(coupon as never, TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("このクーポンコードは既に使用されています");
        });

        it("findFirstの事前チェックをすり抜けてもupsertがP2002をrejectした場合、coupon.ts upsertCouponは統一日本語メッセージをスローする", async () => {
            const coupon = createMockCoupon({ id: "new-coupon" });
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
            mockDb.coupon.findFirst.mockResolvedValue(null); // 事前チェックをすり抜ける
            const p2002Error = Object.assign(new Error("Unique constraint failed"), {
                code: "P2002",
            });
            mockDb.coupon.upsert.mockRejectedValue(p2002Error);

            await expect(
                upsertCoupon(coupon as never, TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("このクーポンコードは既に使用されています");
        });
    });

    describe("IDOR防止", () => {
        // upsertCoupon は requireStoreOwner 経由で url+userId の複合 where による
        // 所有権検証を行う。本テストは「(b) where 構造の検証」と
        // 「(c) ガード失敗時に下流の coupon.upsert / findFirst が呼ばれない」を担保する。
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });
        });

        it("クロステナント時に where: { url, userId } 構造で findUnique が呼ばれ、coupon.upsert は呼ばれない", async () => {
            // 他人の店舗 URL を指定 → 複合 where が null を返し、
            // requireStoreOwner が "Forbidden" をスローする。
            mockDb.store.findUnique.mockResolvedValue(null);
            const coupon = createMockCoupon();

            await expect(
                upsertCoupon(coupon as never, "other-store")
            ).rejects.toThrow("Forbidden: store not owned by current user.");

            // (b) 複合 where 構造のレグレッション検証
            expect(mockDb.store.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        url: "other-store",
                        userId: TEST_CONFIG.DEFAULT_USER_ID,
                    },
                })
            );
            // (c) 副作用なし: 後続の DB I/O が一切発生しない
            expect(mockDb.coupon.upsert).not.toHaveBeenCalled();
            expect(mockDb.coupon.findFirst).not.toHaveBeenCalled();
        });

        it("他店舗が所有する coupon.id を渡した場合、所有権検証で reject し upsert/findFirst を呼ばない (cross-store hijack 防御)", async () => {
            // 呼び出し元は自店舗 (store123) を所有しているが、
            // 渡した coupon.id は別店舗が所有する既存クーポンを指す。
            // upsert の where は id 単独のため、所有権を事前検証しないと
            // storeId を自店舗へ書き換えて乗っ取れてしまう。
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
            const coupon = createMockCoupon({ id: "victim-coupon" });
            mockDb.coupon.findUnique.mockResolvedValue(
                createMockCoupon({ id: "victim-coupon", storeId: "other-store-id" })
            );

            await expect(
                upsertCoupon(coupon as never, TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("Forbidden: coupon not owned by current store.");

            // (c) 副作用なし: 乗っ取り経路の書き込み・重複チェックに到達しない
            expect(mockDb.coupon.upsert).not.toHaveBeenCalled();
            expect(mockDb.coupon.findFirst).not.toHaveBeenCalled();
        });

        it("admin 所有の PLATFORM クーポン (storeId=null) の id を渡した場合も reject する (PLATFORM hijack 防御)", async () => {
            // 本 PR で追加された PLATFORM scope の悪用経路。
            // storeId=null は呼び出し元 store.id と一致しないため拒否される。
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
            const coupon = createMockCoupon({ id: "platform-coupon" });
            mockDb.coupon.findUnique.mockResolvedValue(
                createMockCoupon({ id: "platform-coupon", scope: "PLATFORM" })
            );

            await expect(
                upsertCoupon(coupon as never, TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("Forbidden: coupon not owned by current store.");

            expect(mockDb.coupon.upsert).not.toHaveBeenCalled();
            expect(mockDb.coupon.findFirst).not.toHaveBeenCalled();
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
            // 所有権事前検証: 既存行なし (= 新規作成) をデフォルトとする
            mockDb.coupon.findUnique.mockResolvedValue(null);
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
            // 既存行は自店舗所有 (storeId = store123 = store.id) → 所有権検証を通過
            mockDb.coupon.findUnique.mockResolvedValue(createMockCoupon());
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
            // 認可ガードは try の外なので、ラップ対象の DB エラーは try 内部
            // (coupon.findFirst) で発生させる
            mockDb.store.findUnique.mockResolvedValue(createMockStore());
            // 所有権検証は通過させ (自店舗の既存行)、ラップ対象の DB エラーは
            // try 内部 (coupon.findFirst) で発生させる
            mockDb.coupon.findUnique.mockResolvedValue(createMockCoupon());
            mockDb.coupon.findFirst.mockRejectedValue(
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

        it("他人のストアのクーポンを取得できない (requireStoreOwner で url+userId 複合検索)", async () => {
            // 旧実装は url のみで store を取得し、userId を後段で比較していた。
            // 新実装の requireStoreOwner は where: { url, userId } で findUnique
            // するため、他人の店舗 URL を指定すると DB レベルで null が返る。
            mockDb.store.findUnique.mockResolvedValue(null);

            await expect(
                getStoreCoupons(TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("Forbidden: store not owned by current user.");
            // url + userId の複合 where が組まれていることを構造検証
            expect(mockDb.store.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        url: TEST_CONFIG.TEST_STORE_URL,
                        userId: TEST_CONFIG.DEFAULT_USER_ID,
                    },
                })
            );
        });

        it("存在しないストアの場合 Forbidden をスロー (列挙耐性: 存在 / 非所有を区別しない)", async () => {
            mockDb.store.findUnique.mockResolvedValue(null);

            await expect(getStoreCoupons("nonexistent")).rejects.toThrow(
                "Forbidden: store not owned by current user."
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

        it("他人のストアのクーポンを削除できない (requireStoreOwner で url+userId 複合検索)", async () => {
            // 他人の店舗 URL を指定 → DB の where: { url, userId } が null を返す。
            mockDb.store.findUnique.mockResolvedValue(null);

            await expect(
                deleteCoupon("coupon-001", TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("Forbidden: store not owned by current user.");
            expect(mockDb.store.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        url: TEST_CONFIG.TEST_STORE_URL,
                        userId: TEST_CONFIG.DEFAULT_USER_ID,
                    },
                })
            );
            // クーポン削除は呼ばれていない
            expect(mockDb.coupon.delete).not.toHaveBeenCalled();
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
    beforeEach(() => {
        (currentUser as jest.Mock).mockResolvedValue({
            id: TEST_CONFIG.DEFAULT_USER_ID,
        });
    });

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

        it("isActive=false のクーポンの場合エラーをスローする", async () => {
            mockDb.coupon.findUnique.mockResolvedValue(
                createMockCoupon({
                    ...COUPON_SCENARIOS.active,
                    isActive: false,
                    store: createMockStore(),
                })
            );

            await expect(
                applyCoupon("SAVE10", "cart-001")
            ).rejects.toThrow("This coupon has been deactivated.");
        });

        it("カートが見つからない場合エラーをスローする", async () => {
            mockDb.coupon.findUnique.mockResolvedValue(
                createMockCoupon({
                    ...COUPON_SCENARIOS.active,
                    store: createMockStore(),
                })
            );
            mockDb.cart.findFirst.mockResolvedValue(null);

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
            mockDb.cart.findFirst.mockResolvedValue(
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

        it("並行リクエストの競合（updateMany count=0）でエラーをスローし、couponId=null を条件に含める", async () => {
            // Arrange: 初回チェックは通過するが、書き込み直前に別リクエストが先に適用したケース
            mockDb.coupon.findUnique.mockResolvedValue(
                createMockCoupon({
                    ...COUPON_SCENARIOS.active,
                    store: createMockStore(),
                })
            );
            mockDb.cart.findFirst.mockResolvedValue(
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
            // CAS が 0 件 = 競合で先を越された
            mockDb.cart.updateMany.mockResolvedValue({ count: 0 });

            // Act + Assert (a) スロー検証
            await expect(
                applyCoupon("SAVE10", "cart-001")
            ).rejects.toThrow("Coupon is already applied to this cart.");

            // Assert (b) where 構造検証: couponId=null の CAS 条件が含まれる
            expect(mockDb.cart.updateMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        id: "cart-001",
                        userId: TEST_CONFIG.DEFAULT_USER_ID,
                        couponId: null,
                    }),
                })
            );

            // Assert (c) 副作用なし検証: 競合時は最終フェッチを行わない
            expect(mockDb.cart.findFirstOrThrow).not.toHaveBeenCalled();
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
            mockDb.cart.findFirst.mockResolvedValue(
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
            mockDb.cart.findFirst.mockResolvedValue(
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
            mockDb.cart.updateMany.mockResolvedValue({ count: 1 });
            mockDb.cart.findFirstOrThrow.mockResolvedValue({
                ...updatedCart,
                cartItems: [],
                coupon: { store: createMockStore() },
            });

            const result = await applyCoupon("SAVE10", "cart-001");

            expect(result.message).toContain("Coupon applied successfully");
            const { data } = mockDb.cart.updateMany.mock.calls[0][0];
            expect(new Prisma.Decimal(data.total).toNumber()).toBe(99); // 110 - 11
        });

        it("50%割引が正しく計算される", async () => {
            // 商品 $200 x 1 + 配送料 $0 = $200, 50%割引 = -$100
            setupValidCouponScenario(50, 200, 200, 1, 0);
            mockDb.cart.updateMany.mockResolvedValue({ count: 1 });
            mockDb.cart.findFirstOrThrow.mockResolvedValue({
                ...createMockCart({ total: 100 }),
                cartItems: [],
                coupon: { store: createMockStore() },
            });

            const result = await applyCoupon("SAVE50", "cart-001");

            expect(result.message).toContain("Coupon applied successfully");
            const { data } = mockDb.cart.updateMany.mock.calls[0][0];
            expect(new Prisma.Decimal(data.total).toNumber()).toBe(100); // 200 - 100
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
            mockDb.cart.findFirst.mockResolvedValue(
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
            mockDb.cart.updateMany.mockResolvedValue({ count: 1 });
            mockDb.cart.findFirstOrThrow.mockResolvedValue({
                ...createMockCart({ total: 139.5 }),
                cartItems: [],
                coupon: { store: createMockStore() },
            });

            const result = await applyCoupon("SAVE10", "cart-001");

            expect(result.message).toContain("Coupon applied successfully");
            const { data } = mockDb.cart.updateMany.mock.calls[0][0];
            expect(new Prisma.Decimal(data.total).toNumber()).toBe(139.5); // 155 - 15.5
        });

        it("PLATFORMスコープの場合は店舗を問わず全カート商品が割引対象になる", async () => {
            mockDb.coupon.findUnique.mockResolvedValue(
                createMockCoupon({
                    ...COUPON_SCENARIOS.active,
                    discount: 10,
                    scope: "PLATFORM",
                    storeId: null,
                    store: undefined,
                })
            );
            mockDb.cart.findFirst.mockResolvedValue(
                createMockCart({
                    couponId: null,
                    total: 100,
                    cartItems: [
                        createMockCartItem({
                            storeId: TEST_CONFIG.DEFAULT_STORE_ID,
                            price: 50,
                            quantity: 1,
                            shippingFee: 0,
                        }),
                        createMockCartItem({
                            id: "cart-item-002",
                            storeId: "other-store",
                            price: 50,
                            quantity: 1,
                            shippingFee: 0,
                        }),
                    ],
                    coupon: null,
                })
            );
            mockDb.cart.updateMany.mockResolvedValue({ count: 1 });
            mockDb.cart.findFirstOrThrow.mockResolvedValue({
                ...createMockCart({ total: 90 }),
                cartItems: [],
                coupon: { store: null },
            });

            const result = await applyCoupon("PLATFORM10", "cart-001");

            expect(result.message).toContain("Coupon applied successfully");
            expect(result.message).toContain("全店舗");
            const { data } = mockDb.cart.updateMany.mock.calls[0][0];
            expect(new Prisma.Decimal(data.total).toNumber()).toBe(90); // 100 - 10
        });

        it("丸め境界値(1.005)でDecimal演算により正しく半数上げされる（Numberのfloat誤差バグ修正）", async () => {
            // 商品 $6.7 x 1 + 配送料 $0 = $6.7, 15%割引 = 1.005 → Decimalで1.01に半数上げ
            // (旧Number実装は (6.7*15/100).toFixed(2) === "1.00" になる既知のfloat誤差バグ)
            setupValidCouponScenario(15, 10, 6.7, 1, 0);
            mockDb.cart.updateMany.mockResolvedValue({ count: 1 });
            mockDb.cart.findFirstOrThrow.mockResolvedValue({
                ...createMockCart({ total: 8.995 }),
                cartItems: [],
                coupon: { store: createMockStore() },
            });

            const result = await applyCoupon("SAVE15", "cart-001");

            expect(result.message).toContain("-$1.01");
            const { data } = mockDb.cart.updateMany.mock.calls[0][0];
            expect(new Prisma.Decimal(data.total).toNumber()).toBe(8.995); // 10 - 1.005
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
            mockDb.cart.findFirst.mockResolvedValue(
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
            mockDb.cart.updateMany.mockResolvedValue({ count: 1 });
            mockDb.cart.findFirstOrThrow.mockResolvedValue(updatedCart);

            const result = await applyCoupon("SAVE10", "cart-001");

            expect(result.cart).toBeDefined();
            expect(mockDb.cart.updateMany).toHaveBeenCalledWith(
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
            mockDb.cart.findFirst.mockResolvedValue(
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
            mockDb.cart.updateMany.mockResolvedValue({ count: 1 });
            mockDb.cart.findFirstOrThrow.mockResolvedValue({
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

// ==================================================
// getAllCoupons (admin)
// ==================================================
describe("getAllCoupons", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(getAllCoupons()).rejects.toThrow("Unauthenticated.");
        });

        it("ADMINロール以外の場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });

            await expect(getAllCoupons()).rejects.toThrow(
                "Only admins can perform this action."
            );
        });
    });

    describe("正常系", () => {
        it("全ストアのクーポン一覧を返す", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            const couponWithStore = {
                ...createMockCoupon(),
                store: createMockStore(),
            };
            mockDb.coupon.findMany.mockResolvedValue([couponWithStore]);

            const result = await getAllCoupons();

            expect(result).toHaveLength(1);
            expect(mockDb.coupon.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    include: expect.objectContaining({ store: true }),
                })
            );
        });

        it("limit ≤ 100 のキャップが適用される", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            mockDb.coupon.findMany.mockResolvedValue([]);

            await getAllCoupons();

            expect(mockDb.coupon.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ take: 100 })
            );
        });
    });
});

// ==================================================
// upsertCouponAsAdmin (admin)
// ==================================================
describe("upsertCouponAsAdmin", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);
            const coupon = createMockCoupon();

            await expect(
                upsertCouponAsAdmin(coupon as never)
            ).rejects.toThrow("Unauthenticated.");
        });

        it("ADMINロール以外の場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "USER" },
            });
            const coupon = createMockCoupon();

            await expect(
                upsertCouponAsAdmin(coupon as never)
            ).rejects.toThrow("Only admins can perform this action.");
        });
    });

    describe("正常系", () => {
        it("クーポンを正常に upsert する", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            const coupon = createMockCoupon();
            mockDb.coupon.upsert.mockResolvedValue(coupon);

            const result = await upsertCouponAsAdmin(coupon as never);

            expect(result).toEqual(coupon);
            expect(mockDb.coupon.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: coupon.id },
                })
            );
        });
    });

    describe("コードグローバル重複エラー", () => {
        it("Prisma P2002 を日本語メッセージに変換する", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            const coupon = createMockCoupon();
            const p2002Error = Object.assign(new Error("Unique constraint"), {
                code: "P2002",
                name: "PrismaClientKnownRequestError",
            });
            mockDb.coupon.upsert.mockRejectedValue(p2002Error);

            await expect(
                upsertCouponAsAdmin(coupon as never)
            ).rejects.toThrow("このクーポンコードは既に使用されています");
        });
    });
});

// ==================================================
// deleteCouponAsAdmin (admin)
// ==================================================
describe("deleteCouponAsAdmin", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(
                deleteCouponAsAdmin("coupon-001")
            ).rejects.toThrow("Unauthenticated.");
        });

        it("ADMINロール以外の場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });

            await expect(
                deleteCouponAsAdmin("coupon-001")
            ).rejects.toThrow("Only admins can perform this action.");
        });
    });

    describe("バリデーション", () => {
        it("couponId が空の場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });

            await expect(
                deleteCouponAsAdmin("")
            ).rejects.toThrow("Please provide coupon ID.");
        });
    });

    describe("正常系", () => {
        it("クーポンを正常に削除して true を返す", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            mockDb.coupon.delete.mockResolvedValue({ id: "coupon-001" });

            const result = await deleteCouponAsAdmin("coupon-001");

            expect(result).toBe(true);
            expect(mockDb.coupon.delete).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "coupon-001" },
                })
            );
        });
    });
});

// ==================================================
// toggleCouponActive (admin)
// ==================================================
describe("toggleCouponActive", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(
                toggleCouponActive("coupon-001")
            ).rejects.toThrow("Unauthenticated.");
        });

        it("ADMINロール以外の場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "USER" },
            });

            await expect(
                toggleCouponActive("coupon-001")
            ).rejects.toThrow("Only admins can perform this action.");
        });
    });

    describe("バリデーション", () => {
        it("couponId が空の場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });

            await expect(
                toggleCouponActive("")
            ).rejects.toThrow("Please provide coupon ID.");
        });
    });

    describe("正常系", () => {
        it("isActive=true のクーポンを false にトグルする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            const coupon = createMockCoupon({ isActive: true });
            mockDb.coupon.findUnique.mockResolvedValue(coupon);
            mockDb.coupon.update.mockResolvedValue({
                ...coupon,
                isActive: false,
            });

            const result = await toggleCouponActive("coupon-001");

            expect(result.isActive).toBe(false);
            expect(mockDb.coupon.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "coupon-001" },
                    data: { isActive: false },
                })
            );
        });

        it("isActive=false のクーポンを true にトグルする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            const coupon = createMockCoupon({ isActive: false });
            mockDb.coupon.findUnique.mockResolvedValue(coupon);
            mockDb.coupon.update.mockResolvedValue({
                ...coupon,
                isActive: true,
            });

            const result = await toggleCouponActive("coupon-001");

            expect(result.isActive).toBe(true);
        });

        it("クーポンが存在しない場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            mockDb.coupon.findUnique.mockResolvedValue(null);

            await expect(
                toggleCouponActive("coupon-001")
            ).rejects.toThrow("Coupon not found.");
        });
    });

    describe("エラーハンドリング", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
        });

        it("エラーハンドリング: DBエラーをログ出力しラップしてスローする", async () => {
            // Arrange
            const consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => undefined);
            const coupon = createMockCoupon({ isActive: true });
            mockDb.coupon.findUnique.mockResolvedValue(coupon);
            mockDb.coupon.update.mockRejectedValue(new Error("DB update failed"));

            // Act & Assert
            await expect(
                toggleCouponActive("coupon-001")
            ).rejects.toThrow(
                "Error occurred while toggling coupon active state"
            );
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        it("エッジケース: ガードエラーに類似したDB例外はそのままリスローされる", async () => {
            // isGuardError(error) = true 分岐のカバレッジ
            // Arrange
            const coupon = createMockCoupon({ isActive: true });
            mockDb.coupon.findUnique.mockResolvedValue(coupon);
            mockDb.coupon.update.mockRejectedValue(new Error("Unauthenticated."));

            // Act & Assert
            await expect(
                toggleCouponActive("coupon-001")
            ).rejects.toThrow("Unauthenticated.");
        });
    });
});

// ==================================================
// upsertCouponAsAdmin — バリデーション・エラーハンドリング追加
// ==================================================
describe("upsertCouponAsAdmin (バリデーション・エラーハンドリング追加)", () => {
    beforeEach(() => {
        (currentUser as jest.Mock).mockResolvedValue({
            id: TEST_CONFIG.DEFAULT_USER_ID,
            privateMetadata: { role: "ADMIN" },
        });
    });

    it("異常系: couponがnullの場合エラーをスローする", async () => {
        // Arrange / Act / Assert
        await expect(
            upsertCouponAsAdmin(null as never)
        ).rejects.toThrow("Please provide coupon data.");
    });

    it("異常系: storeIdが空の場合エラーをスローする", async () => {
        // Arrange
        const coupon = createMockCoupon({ storeId: "" });

        // Act & Assert
        await expect(
            upsertCouponAsAdmin(coupon as never)
        ).rejects.toThrow("Please provide a valid store ID.");
    });

    it("エラーハンドリング: 非P2002 DBエラーをログ出力しラップしてスローする", async () => {
        // Arrange
        const consoleSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        const coupon = createMockCoupon();
        mockDb.coupon.upsert.mockRejectedValue(new Error("DB connection failed"));

        // Act & Assert
        await expect(
            upsertCouponAsAdmin(coupon as never)
        ).rejects.toThrow("Error occurred while upserting coupon");
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it("正常系: scope=PLATFORMの場合storeIdが空でもstoreId:nullでupsertされる", async () => {
        // Arrange
        const coupon = createMockCoupon({ scope: "PLATFORM", storeId: null });
        mockDb.coupon.upsert.mockResolvedValue(coupon);

        // Act
        const result = await upsertCouponAsAdmin(coupon as never);

        // Assert
        expect(result).toEqual(coupon);
        expect(mockDb.coupon.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                create: expect.objectContaining({ storeId: null }),
                update: expect.objectContaining({ storeId: null }),
            })
        );
    });
});

// ==================================================
// getAllCoupons — エラーハンドリング追加
// ==================================================
describe("getAllCoupons (エラーハンドリング追加)", () => {
    it("エラーハンドリング: DBエラーをログ出力しラップしてスローする", async () => {
        // Arrange
        (currentUser as jest.Mock).mockResolvedValue({
            id: TEST_CONFIG.DEFAULT_USER_ID,
            privateMetadata: { role: "ADMIN" },
        });
        const consoleSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        mockDb.coupon.findMany.mockRejectedValue(new Error("DB connection failed"));

        // Act & Assert
        await expect(getAllCoupons()).rejects.toThrow(
            "Error occurred while fetching all coupons."
        );
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});

// ==================================================
// deleteCouponAsAdmin — エラーハンドリング追加
// ==================================================
describe("deleteCouponAsAdmin (エラーハンドリング追加)", () => {
    beforeEach(() => {
        (currentUser as jest.Mock).mockResolvedValue({
            id: TEST_CONFIG.DEFAULT_USER_ID,
            privateMetadata: { role: "ADMIN" },
        });
    });

    it("エラーハンドリング: DBエラーをログ出力しラップしてスローする", async () => {
        // Arrange
        const consoleSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        mockDb.coupon.delete.mockRejectedValue(new Error("DB connection failed"));

        // Act & Assert
        await expect(
            deleteCouponAsAdmin("coupon-001")
        ).rejects.toThrow("Error occurred while deleting coupon");
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it("エッジケース: ガードエラーに類似したDB例外はそのままリスローされる", async () => {
        // isGuardError(error) = true 分岐のカバレッジ
        // Arrange
        mockDb.coupon.delete.mockRejectedValue(new Error("Unauthenticated."));

        // Act & Assert
        await expect(
            deleteCouponAsAdmin("coupon-001")
        ).rejects.toThrow("Unauthenticated.");
    });
});

// ==================================================
// deleteCoupon — エッジケース追加
// ==================================================
describe("deleteCoupon (エッジケース追加)", () => {
    it("境界値: delete が P2025 を throw した場合エラーをスローする", async () => {
        // Arrange
        (currentUser as jest.Mock).mockResolvedValue({
            id: TEST_CONFIG.DEFAULT_USER_ID,
            privateMetadata: { role: "SELLER" },
        });
        mockDb.store.findUnique.mockResolvedValue(createMockStore());
        const p2025Error = Object.assign(
            new Error("Record to delete does not exist."),
            { code: "P2025", name: "PrismaClientKnownRequestError" }
        );
        mockDb.coupon.delete.mockRejectedValue(p2025Error);

        // Act & Assert
        await expect(
            deleteCoupon("coupon-001", TEST_CONFIG.TEST_STORE_URL)
        ).rejects.toThrow("Error occurred while trying to delete coupon:");
    });
});
