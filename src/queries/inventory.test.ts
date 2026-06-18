import { currentUser } from "@clerk/nextjs/server";
import { updateSizeStock } from "./inventory";
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
});
