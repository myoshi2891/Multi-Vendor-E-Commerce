import { currentUser } from "@clerk/nextjs/server";
import {
    upsertOfferTag,
    getAllOfferTags,
    getOfferTag,
    deleteOfferTag,
} from "./offer-tag";
import { TEST_CONFIG } from "../config/test-config";
import {
    createMockOfferTag,
    createMockStore,
} from "../config/test-fixtures";

// ---- モック設定 ----
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
    db: {
        offerTag: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
            upsert: jest.fn(),
            delete: jest.fn(),
        },
        store: {
            findUnique: jest.fn(),
        },
    },
}));

const mockDb = require("@/lib/db").db;

beforeEach(() => {
    jest.clearAllMocks();
});

// ==================================================
// upsertOfferTag
// ==================================================
describe("upsertOfferTag", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(
                upsertOfferTag(createMockOfferTag() as never)
            ).rejects.toThrow("Error upserting OfferTag");
        });

        it("ADMIN以外のロールの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "USER" },
            });

            await expect(
                upsertOfferTag(createMockOfferTag() as never)
            ).rejects.toThrow("Error upserting OfferTag");
        });

        it("SELLERロールでも拒否される", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });

            await expect(
                upsertOfferTag(createMockOfferTag() as never)
            ).rejects.toThrow("Error upserting OfferTag");
        });
    });

    describe("重複チェック", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
        });

        it("同じ名前のOfferTagが存在する場合エラーをスローする", async () => {
            const offerTag = createMockOfferTag({ name: "Summer Sale" });
            mockDb.offerTag.findFirst.mockResolvedValue(
                createMockOfferTag({
                    id: "other-id",
                    name: "Summer Sale",
                    url: "different-url",
                })
            );

            await expect(
                upsertOfferTag(offerTag as never)
            ).rejects.toThrow("Error upserting OfferTag");
        });

        it("同じURLのOfferTagが存在する場合エラーをスローする", async () => {
            const offerTag = createMockOfferTag({
                name: "Unique Name",
                url: "summer-sale",
            });
            mockDb.offerTag.findFirst.mockResolvedValue(
                createMockOfferTag({
                    id: "other-id",
                    name: "Different Name",
                    url: "summer-sale",
                })
            );

            await expect(
                upsertOfferTag(offerTag as never)
            ).rejects.toThrow("Error upserting OfferTag");
        });

        it("大文字小文字を無視して名前の重複をチェックする", async () => {
            const offerTag = createMockOfferTag({ name: "summer sale" });
            // findFirstは大文字のSummer Saleで見つかる（DB側のfindFirst結果）
            mockDb.offerTag.findFirst.mockResolvedValue(
                createMockOfferTag({
                    id: "other-id",
                    name: "Summer Sale",
                })
            );

            // toLowerCase()比較で一致するためエラーになる
            await expect(
                upsertOfferTag(offerTag as never)
            ).rejects.toThrow("Error upserting OfferTag");
        });

        it("自身のIDは重複チェックから除外される（更新時）", async () => {
            const offerTag = createMockOfferTag();
            mockDb.offerTag.findFirst.mockResolvedValue(null);
            mockDb.offerTag.upsert.mockResolvedValue(offerTag);

            await upsertOfferTag(offerTag as never);

            expect(mockDb.offerTag.findFirst).toHaveBeenCalledWith({
                where: {
                    AND: [
                        {
                            OR: [
                                { name: offerTag.name },
                                { url: offerTag.url },
                            ],
                        },
                        {
                            NOT: { id: offerTag.id },
                        },
                    ],
                },
            });
        });
    });

    describe("正常系", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            mockDb.offerTag.findFirst.mockResolvedValue(null);
        });

        it("新規OfferTagをupsertで作成する", async () => {
            const offerTag = createMockOfferTag();
            mockDb.offerTag.upsert.mockResolvedValue(offerTag);

            const result = await upsertOfferTag(offerTag as never);

            expect(result).toEqual(offerTag);
            expect(mockDb.offerTag.upsert).toHaveBeenCalledWith({
                where: { id: offerTag.id },
                create: offerTag,
                update: offerTag,
            });
        });

        it("既存OfferTagを更新する", async () => {
            const offerTag = createMockOfferTag({ name: "Updated Sale" });
            mockDb.offerTag.upsert.mockResolvedValue(offerTag);

            const result = await upsertOfferTag(offerTag as never);

            expect(result).toEqual(offerTag);
        });
    });

    describe("エラーハンドリング", () => {
        it("元のエラーをラップした汎用メッセージをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            mockDb.offerTag.findFirst.mockRejectedValue(
                new Error("DB connection failed")
            );

            // 元のエラーメッセージではなく、ラップされたメッセージが返る
            await expect(
                upsertOfferTag(createMockOfferTag() as never)
            ).rejects.toThrow("Error upserting OfferTag");
        });
    });
});

// ==================================================
// getAllOfferTags
// ==================================================
describe("getAllOfferTags", () => {
    describe("storeUrlなし（全件取得）", () => {
        it("全OfferTagsを商品数降順で取得する", async () => {
            const offerTags = [
                { ...createMockOfferTag({ id: "ot-1" }), products: [{ id: "p-1" }] },
                { ...createMockOfferTag({ id: "ot-2" }), products: [] },
            ];
            mockDb.offerTag.findMany.mockResolvedValue(offerTags);

            const result = await getAllOfferTags();

            expect(result).toEqual(offerTags);
            expect(mockDb.offerTag.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {},
                    orderBy: {
                        products: { _count: "desc" },
                    },
                })
            );
        });

        it("OfferTagsが0件の場合空配列を返す", async () => {
            mockDb.offerTag.findMany.mockResolvedValue([]);

            const result = await getAllOfferTags();

            expect(result).toEqual([]);
        });

        it("productsのidをselectしてincludeする", async () => {
            mockDb.offerTag.findMany.mockResolvedValue([]);

            await getAllOfferTags();

            expect(mockDb.offerTag.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    include: {
                        products: {
                            select: { id: true },
                        },
                    },
                })
            );
        });
    });

    describe("storeUrlあり（フィルタ取得）", () => {
        it("storeUrlに対応するストアの商品でフィルタする", async () => {
            const store = createMockStore();
            mockDb.store.findUnique.mockResolvedValue(store);
            const offerTags = [
                { ...createMockOfferTag(), products: [{ id: "p-1" }] },
            ];
            mockDb.offerTag.findMany.mockResolvedValue(offerTags);

            const result = await getAllOfferTags("test-store");

            expect(result).toEqual(offerTags);
            expect(mockDb.store.findUnique).toHaveBeenCalledWith({
                where: { url: "test-store" },
            });
            expect(mockDb.offerTag.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        products: {
                            some: { storeId: store.id },
                        },
                    },
                })
            );
        });

        it("存在しないストアURLの場合空配列を返す", async () => {
            mockDb.store.findUnique.mockResolvedValue(null);

            const result = await getAllOfferTags("nonexistent-store");

            expect(result).toEqual([]);
            // offerTag.findManyは呼ばれない
            expect(mockDb.offerTag.findMany).not.toHaveBeenCalled();
        });
    });

    describe("エラーハンドリング", () => {
        it("DBエラー時にラップされたメッセージをスローする", async () => {
            mockDb.offerTag.findMany.mockRejectedValue(
                new Error("DB error")
            );

            await expect(getAllOfferTags()).rejects.toThrow(
                "Error retrieving OfferTags"
            );
        });
    });
});

// ==================================================
// getOfferTag
// ==================================================
describe("getOfferTag", () => {
    it("IDでOfferTagを取得する", async () => {
        const offerTag = createMockOfferTag();
        mockDb.offerTag.findUnique.mockResolvedValue(offerTag);

        const result = await getOfferTag("offer-tag-001");

        expect(result).toEqual(offerTag);
        expect(mockDb.offerTag.findUnique).toHaveBeenCalledWith({
            where: { id: "offer-tag-001" },
        });
    });

    it("存在しないIDの場合nullを返す", async () => {
        mockDb.offerTag.findUnique.mockResolvedValue(null);

        const result = await getOfferTag("nonexistent");

        expect(result).toBeNull();
    });

    it("IDが空の場合エラーをスローする（try/catch外なので直接スロー）", async () => {
        // getOfferTagのID検証はtry/catchの外にある
        await expect(getOfferTag("")).rejects.toThrow(
            "Please provide OfferTag ID."
        );
    });

    it("DBエラー時にラップされたメッセージをスローする", async () => {
        mockDb.offerTag.findUnique.mockRejectedValue(new Error("DB error"));

        await expect(getOfferTag("offer-tag-001")).rejects.toThrow(
            "Error retrieving OfferTag"
        );
    });
});

// ==================================================
// deleteOfferTag
// ==================================================
describe("deleteOfferTag", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(deleteOfferTag("offer-tag-001")).rejects.toThrow(
                "Error deleting OfferTag"
            );
        });

        it("ADMIN以外のロールの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });

            await expect(deleteOfferTag("offer-tag-001")).rejects.toThrow(
                "Error deleting OfferTag"
            );
        });
    });

    describe("バリデーション", () => {
        it("IDが空の場合エラーをスローする（try/catch外なので直接スロー）", async () => {
            // deleteOfferTagのID検証はtry/catchの外にある
            await expect(deleteOfferTag("")).rejects.toThrow(
                "Please provide OfferTag ID."
            );
        });
    });

    describe("正常系", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
        });

        it("OfferTagを正常に削除する", async () => {
            const deletedOfferTag = createMockOfferTag();
            mockDb.offerTag.delete.mockResolvedValue(deletedOfferTag);

            const result = await deleteOfferTag("offer-tag-001");

            expect(result).toEqual(deletedOfferTag);
            expect(mockDb.offerTag.delete).toHaveBeenCalledWith({
                where: { id: "offer-tag-001" },
            });
        });

        it("DBエラー時にラップされたメッセージをスローする", async () => {
            mockDb.offerTag.delete.mockRejectedValue(new Error("DB error"));

            await expect(deleteOfferTag("offer-tag-001")).rejects.toThrow(
                "Error deleting OfferTag"
            );
        });
    });
});
