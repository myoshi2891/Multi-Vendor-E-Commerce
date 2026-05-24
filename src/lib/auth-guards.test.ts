/**
 * src/lib/auth-guards.test.ts
 * 共通認可ヘルパーの単体テスト (AAA pattern)
 *
 * 対応関数:
 *   - requireUser
 *   - requireAdmin
 *   - requireSeller
 *   - requireStoreOwner(storeUrl)
 *
 * エラーメッセージ仕様:
 *   - 未認証: "Unauthenticated."
 *   - ロール不一致 (ADMIN): "Only admins can perform this action."
 *   - ロール不一致 (SELLER): "Only sellers can perform this action."
 *   - store URL 未指定: "Please provide store URL."
 *   - 店舗が存在しない / 所有者でない: "Forbidden: store not owned by current user."
 *
 * Related: src/config/test-helpers.ts の AuthTestHelpers / AssertionHelpers と整合
 */

import { currentUser } from "@clerk/nextjs/server";
import {
    requireUser,
    requireAdmin,
    requireSeller,
    requireStoreOwner,
} from "./auth-guards";
import { TEST_CONFIG } from "../config/test-config";

jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
    db: {
        store: {
            findUnique: jest.fn(),
        },
    },
}));

const mockDb = require("@/lib/db").db;

const makeUser = (role: "USER" | "SELLER" | "ADMIN", id = TEST_CONFIG.DEFAULT_USER_ID) => ({
    id,
    privateMetadata: { role },
});

beforeEach(() => {
    jest.clearAllMocks();
});

// ==================================================
// requireUser
// ==================================================
describe("requireUser", () => {
    it("認証済みユーザーがいれば user を返す", async () => {
        // Arrange
        (currentUser as jest.Mock).mockResolvedValue(makeUser("USER"));

        // Act
        const user = await requireUser();

        // Assert
        expect(user.id).toBe(TEST_CONFIG.DEFAULT_USER_ID);
    });

    it("未認証なら 'Unauthenticated.' をスロー", async () => {
        // Arrange
        (currentUser as jest.Mock).mockResolvedValue(null);

        // Act & Assert
        await expect(requireUser()).rejects.toThrow("Unauthenticated.");
    });
});

// ==================================================
// requireAdmin
// ==================================================
describe("requireAdmin", () => {
    it("ADMIN ロールなら user を返す", async () => {
        (currentUser as jest.Mock).mockResolvedValue(makeUser("ADMIN"));
        const user = await requireAdmin();
        expect(user.privateMetadata.role).toBe("ADMIN");
    });

    it("未認証なら 'Unauthenticated.' をスロー", async () => {
        (currentUser as jest.Mock).mockResolvedValue(null);
        await expect(requireAdmin()).rejects.toThrow("Unauthenticated.");
    });

    it("USER ロールなら 'Only admins can perform this action.' をスロー", async () => {
        (currentUser as jest.Mock).mockResolvedValue(makeUser("USER"));
        await expect(requireAdmin()).rejects.toThrow(
            "Only admins can perform this action."
        );
    });

    it("SELLER ロールでも ADMIN ガードは通さない", async () => {
        (currentUser as jest.Mock).mockResolvedValue(makeUser("SELLER"));
        await expect(requireAdmin()).rejects.toThrow(
            "Only admins can perform this action."
        );
    });
});

// ==================================================
// requireSeller
// ==================================================
describe("requireSeller", () => {
    it("SELLER ロールなら user を返す", async () => {
        (currentUser as jest.Mock).mockResolvedValue(makeUser("SELLER"));
        const user = await requireSeller();
        expect(user.privateMetadata.role).toBe("SELLER");
    });

    it("未認証なら 'Unauthenticated.' をスロー", async () => {
        (currentUser as jest.Mock).mockResolvedValue(null);
        await expect(requireSeller()).rejects.toThrow("Unauthenticated.");
    });

    it("ADMIN ロールでも SELLER ガードは通さない（権限混同を検知）", async () => {
        (currentUser as jest.Mock).mockResolvedValue(makeUser("ADMIN"));
        await expect(requireSeller()).rejects.toThrow(
            "Only sellers can perform this action."
        );
    });

    it("USER ロールなら 'Only sellers can perform this action.' をスロー", async () => {
        (currentUser as jest.Mock).mockResolvedValue(makeUser("USER"));
        await expect(requireSeller()).rejects.toThrow(
            "Only sellers can perform this action."
        );
    });
});

// ==================================================
// requireStoreOwner
// ==================================================
describe("requireStoreOwner", () => {
    const SELLER_A_ID = "seller-A";
    const STORE_URL = "store-A";

    it("SELLER が自分の店舗 URL を指定すれば { user, store } を返す", async () => {
        // Arrange
        (currentUser as jest.Mock).mockResolvedValue(
            makeUser("SELLER", SELLER_A_ID)
        );
        const storeRecord = { id: "store-id-1", url: STORE_URL, userId: SELLER_A_ID };
        mockDb.store.findUnique.mockResolvedValue(storeRecord);

        // Act
        const result = await requireStoreOwner(STORE_URL);

        // Assert
        expect(result.user.id).toBe(SELLER_A_ID);
        expect(result.store).toEqual(storeRecord);
        // findUnique は url + userId の複合 where を使ったことを確認
        expect(mockDb.store.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { url: STORE_URL, userId: SELLER_A_ID },
            })
        );
    });

    it("未認証なら 'Unauthenticated.' をスロー（store 検索は呼ばれない）", async () => {
        (currentUser as jest.Mock).mockResolvedValue(null);
        await expect(requireStoreOwner(STORE_URL)).rejects.toThrow(
            "Unauthenticated."
        );
        expect(mockDb.store.findUnique).not.toHaveBeenCalled();
    });

    it("SELLER 以外なら 'Only sellers can perform this action.' をスロー", async () => {
        (currentUser as jest.Mock).mockResolvedValue(makeUser("USER", SELLER_A_ID));
        await expect(requireStoreOwner(STORE_URL)).rejects.toThrow(
            "Only sellers can perform this action."
        );
        expect(mockDb.store.findUnique).not.toHaveBeenCalled();
    });

    it("storeUrl が空文字なら 'Please provide store URL.' をスロー", async () => {
        (currentUser as jest.Mock).mockResolvedValue(
            makeUser("SELLER", SELLER_A_ID)
        );
        await expect(requireStoreOwner("")).rejects.toThrow(
            "Please provide store URL."
        );
        expect(mockDb.store.findUnique).not.toHaveBeenCalled();
    });

    it("他人の店舗 URL を指定すると 'Forbidden: store not owned by current user.' をスロー (cross-tenant 侵入試行)", async () => {
        // Arrange: SELLER-A が SELLER-B の店舗 URL を指定
        (currentUser as jest.Mock).mockResolvedValue(
            makeUser("SELLER", SELLER_A_ID)
        );
        // DB は url + userId フィルタで検索 → SELLER-A の店舗ではないので null
        mockDb.store.findUnique.mockResolvedValue(null);

        // Act & Assert
        await expect(requireStoreOwner("store-belongs-to-B")).rejects.toThrow(
            "Forbidden: store not owned by current user."
        );
        // url + userId の where が組まれていることを確認 (IDOR 防御の構造検証)
        expect(mockDb.store.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { url: "store-belongs-to-B", userId: SELLER_A_ID },
            })
        );
    });
});
