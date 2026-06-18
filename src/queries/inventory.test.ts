import { currentUser } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { getStoreInventory, updateSizeStock } from "./inventory";
import { TEST_CONFIG } from "../config/test-config";

// Mock the database
jest.mock("@/lib/db", () => ({
    db: {
        store: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        product: {
            findMany: jest.fn(),
        },
        size: {
            findFirst: jest.fn(),
            update: jest.fn(),
        },
    },
}));

// Mock Clerk
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

const mockDb = require("@/lib/db").db as {
    store: { findUnique: jest.Mock; update: jest.Mock };
    product: { findMany: jest.Mock };
    size: { findFirst: jest.Mock; update: jest.Mock };
};

/** requireStoreOwner / 認可ガード関連の共通エラーメッセージ */
const ERRORS = {
    UNAUTHENTICATED: "Unauthenticated.",
    NOT_SELLER: "Only sellers can perform this action.",
    NOT_OWNER: "Forbidden: store not owned by current user.",
    SIZE_NOT_OWNED: "Forbidden: size not owned by current store.",
} as const;

/** テストデータファクトリー */
const TestData = {
    seller: (role = "SELLER") => ({
        id: TEST_CONFIG.DEFAULT_USER_ID,
        privateMetadata: { role },
    }),
    ownedStore: () => ({
        id: TEST_CONFIG.DEFAULT_STORE_ID,
        url: TEST_CONFIG.TEST_STORE_URL,
        userId: TEST_CONFIG.DEFAULT_USER_ID,
    }),
};

const mockCurrentUser = (user: Record<string, unknown> | null) => {
    (currentUser as jest.Mock).mockResolvedValue(user);
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

// ==================================================
// updateSizeStock — 認可・IDOR
// ==================================================
describe("updateSizeStock", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            mockCurrentUser(null);

            await expect(
                updateSizeStock("size-1", 10, TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow(ERRORS.UNAUTHENTICATED);
        });

        it("SELLER ロール以外の場合エラーをスローする", async () => {
            mockCurrentUser(TestData.seller("USER"));

            await expect(
                updateSizeStock("size-1", 10, TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow(ERRORS.NOT_SELLER);
        });

        it("店舗を所有していない場合 Forbidden をスローする", async () => {
            mockCurrentUser(TestData.seller());
            // requireStoreOwner の複合 where { url, userId } により非所有は null
            mockDb.store.findUnique.mockResolvedValue(null);

            await expect(
                updateSizeStock("size-1", 10, TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow(ERRORS.NOT_OWNER);
        });
    });

    describe("IDOR 防止（所有権チェーン）", () => {
        beforeEach(() => {
            mockCurrentUser(TestData.seller());
            mockDb.store.findUnique.mockResolvedValue(TestData.ownedStore());
        });

        it("(a) 他店舗の sizeId を指定した場合 Forbidden をスローする", async () => {
            // size → variant → product.storeId が当該店舗に属さない → findFirst は null
            mockDb.size.findFirst.mockResolvedValue(null);

            await expect(
                updateSizeStock("foreign-size", 10, TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow(ERRORS.SIZE_NOT_OWNED);
        });

        it("(b) 所有権チェーンを productVariant.product.storeId の where 構造で検証する", async () => {
            mockDb.size.findFirst.mockResolvedValue(null);

            await expect(
                updateSizeStock("foreign-size", 10, TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow(ERRORS.SIZE_NOT_OWNED);

            expect(mockDb.size.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        id: "foreign-size",
                        productVariant: {
                            product: { storeId: TEST_CONFIG.DEFAULT_STORE_ID },
                        },
                    },
                })
            );
        });

        it("(c) 所有権チェーン失敗時に db.size.update を呼ばない（副作用なし）", async () => {
            mockDb.size.findFirst.mockResolvedValue(null);

            await expect(
                updateSizeStock("foreign-size", 10, TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow(ERRORS.SIZE_NOT_OWNED);

            expect(mockDb.size.update).not.toHaveBeenCalled();
        });
    });

    describe("入力バリデーション", () => {
        beforeEach(() => {
            mockCurrentUser(TestData.seller());
            mockDb.store.findUnique.mockResolvedValue(TestData.ownedStore());
        });

        it("quantity=-1 は Zod で弾き、所有権チェック・update を呼ばない（AC-F2-3）", async () => {
            await expect(
                updateSizeStock("size-1", -1, TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("在庫数は 0 以上の整数で指定してください。");

            expect(mockDb.size.findFirst).not.toHaveBeenCalled();
            expect(mockDb.size.update).not.toHaveBeenCalled();
        });

        it("小数 quantity も Zod で弾く", async () => {
            await expect(
                updateSizeStock("size-1", 1.5, TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("在庫数は 0 以上の整数で指定してください。");

            expect(mockDb.size.update).not.toHaveBeenCalled();
        });
    });

    describe("正常系", () => {
        beforeEach(() => {
            mockCurrentUser(TestData.seller());
            mockDb.store.findUnique.mockResolvedValue(TestData.ownedStore());
        });

        it("自店舗の Size を更新し { sizeId, quantity } を返す", async () => {
            mockDb.size.findFirst.mockResolvedValue({ id: "size-1" });
            mockDb.size.update.mockResolvedValue({ id: "size-1", quantity: 7 });

            const result = await updateSizeStock(
                "size-1",
                7,
                TEST_CONFIG.TEST_STORE_URL
            );

            expect(result).toEqual({ sizeId: "size-1", quantity: 7 });
            expect(mockDb.size.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: "size-1" },
                    data: { quantity: 7 },
                })
            );
        });

        it("quantity=0（在庫切れ）への更新も許可する", async () => {
            mockDb.size.findFirst.mockResolvedValue({ id: "size-1" });
            mockDb.size.update.mockResolvedValue({ id: "size-1", quantity: 0 });

            const result = await updateSizeStock(
                "size-1",
                0,
                TEST_CONFIG.TEST_STORE_URL
            );

            expect(result).toEqual({ sizeId: "size-1", quantity: 0 });
        });
    });
});

// ==================================================
// getStoreInventory — 認可・正常系
// ==================================================
describe("getStoreInventory", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            mockCurrentUser(null);

            await expect(
                getStoreInventory(TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow(ERRORS.UNAUTHENTICATED);
        });

        it("SELLER ロール以外の場合エラーをスローする", async () => {
            mockCurrentUser(TestData.seller("USER"));

            await expect(
                getStoreInventory(TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow(ERRORS.NOT_SELLER);
        });

        it("店舗を所有していない場合 Forbidden をスローする", async () => {
            mockCurrentUser(TestData.seller());
            mockDb.store.findUnique.mockResolvedValue(null);

            await expect(
                getStoreInventory(TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow(ERRORS.NOT_OWNER);
        });
    });

    describe("正常系", () => {
        beforeEach(() => {
            mockCurrentUser(TestData.seller());
            mockDb.store.findUnique.mockResolvedValue(TestData.ownedStore());
        });

        it("storeId スコープで product.findMany を呼ぶ", async () => {
            mockDb.product.findMany.mockResolvedValue([]);

            await getStoreInventory(TEST_CONFIG.TEST_STORE_URL);

            expect(mockDb.product.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { storeId: TEST_CONFIG.DEFAULT_STORE_ID },
                })
            );
        });

        it("商品→バリアント→サイズ をフラット化し Decimal を number 化する", async () => {
            mockDb.product.findMany.mockResolvedValue([
                {
                    name: "T-Shirt",
                    slug: "t-shirt",
                    variants: [
                        {
                            id: "var-1",
                            variantName: "Red",
                            sku: "SKU-RED",
                            sizes: [
                                {
                                    id: "size-s",
                                    size: "S",
                                    quantity: 3,
                                    price: new Prisma.Decimal("19.99"),
                                },
                                {
                                    id: "size-m",
                                    size: "M",
                                    quantity: 0,
                                    price: new Prisma.Decimal("21.50"),
                                },
                            ],
                        },
                    ],
                },
            ]);

            const rows = await getStoreInventory(TEST_CONFIG.TEST_STORE_URL);

            expect(rows).toHaveLength(2);
            expect(rows[0]).toEqual({
                sizeId: "size-s",
                productName: "T-Shirt",
                variantName: "Red",
                size: "S",
                quantity: 3,
                price: 19.99,
                sku: "SKU-RED",
                productSlug: "t-shirt",
                variantId: "var-1",
            });
            expect(typeof rows[0].price).toBe("number");
            expect(rows[1].sizeId).toBe("size-m");
            expect(rows[1].price).toBe(21.5);
        });

        it("商品が無い場合は空配列を返す", async () => {
            mockDb.product.findMany.mockResolvedValue([]);

            const rows = await getStoreInventory(TEST_CONFIG.TEST_STORE_URL);

            expect(rows).toEqual([]);
        });

        it("DB エラー時は汎用メッセージにラップしてスローする", async () => {
            mockDb.product.findMany.mockRejectedValue(new Error("db down"));

            await expect(
                getStoreInventory(TEST_CONFIG.TEST_STORE_URL)
            ).rejects.toThrow("Failed to fetch store inventory.");
        });
    });
});
