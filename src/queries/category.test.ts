import { currentUser } from "@clerk/nextjs/server";
import {
    upsertCategory,
    getAllCategories,
    getAllSubCategoriesFotCategory,
    getCategory,
    deleteCategory,
} from "./category";
import { TEST_CONFIG } from "../config/test-config";
import {
    createMockCategory,
    createMockSubCategory,
    createMockStore,
} from "../config/test-fixtures";

// ---- モック設定 ----
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

jest.mock("@/lib/db", () => ({
    db: {
        category: {
            findFirst: jest.fn(),
            findUnique: jest.fn(),
            findMany: jest.fn(),
            upsert: jest.fn(),
            delete: jest.fn(),
        },
        subCategory: {
            findMany: jest.fn(),
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
// upsertCategory
// ==================================================
describe("upsertCategory", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(
                upsertCategory(createMockCategory() as never)
            ).rejects.toThrow("Unauthenticated.");
        });

        it("ADMINロール以外の場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });

            await expect(
                upsertCategory(createMockCategory() as never)
            ).rejects.toThrow(
                "Unauthorized Access: Admin Privileges Required for Entry."
            );
        });
    });

    describe("バリデーション", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
        });

        it("カテゴリデータがnullの場合エラーをスローする", async () => {
            await expect(
                upsertCategory(null as never)
            ).rejects.toThrow("Please provide category data.");
        });

        it("同名のカテゴリが存在する場合エラーをスローする", async () => {
            mockDb.category.findFirst.mockResolvedValue({
                id: "other-cat",
                name: "Electronics",
                url: "other-url",
            });

            await expect(
                upsertCategory(
                    createMockCategory({ name: "Electronics" }) as never
                )
            ).rejects.toThrow(
                "A category with the same name already exists"
            );
        });

        it("同URLのカテゴリが存在する場合エラーをスローする", async () => {
            mockDb.category.findFirst.mockResolvedValue({
                id: "other-cat",
                name: "Other Name",
                url: "electronics",
            });

            await expect(
                upsertCategory(
                    createMockCategory({ url: "electronics" }) as never
                )
            ).rejects.toThrow(
                "A category with the same URL already exists"
            );
        });

        it("重複チェックで自身のIDを除外する（更新時の自己参照防止）", async () => {
            mockDb.category.findFirst.mockResolvedValue(null);
            mockDb.category.upsert.mockResolvedValue(createMockCategory());

            const category = createMockCategory({ id: "cat-update" });
            await upsertCategory(category as never);

            expect(mockDb.category.findFirst).toHaveBeenCalledWith({
                where: {
                    AND: [
                        {
                            OR: [
                                { name: category.name },
                                { url: category.url },
                            ],
                        },
                        {
                            NOT: { id: "cat-update" },
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
            mockDb.category.findFirst.mockResolvedValue(null);
        });

        it("新規カテゴリを作成する", async () => {
            const category = createMockCategory();
            mockDb.category.upsert.mockResolvedValue(category);

            const result = await upsertCategory(category as never);

            expect(result).toEqual(category);
            expect(mockDb.category.upsert).toHaveBeenCalledWith({
                where: { id: category.id },
                update: category,
                create: category,
            });
        });

        it("既存カテゴリを更新する", async () => {
            const category = createMockCategory({ name: "Updated Name" });
            mockDb.category.upsert.mockResolvedValue(category);

            const result = await upsertCategory(category as never);

            expect(result.name).toBe("Updated Name");
        });
    });
});

// ==================================================
// getAllCategories
// ==================================================
describe("getAllCategories", () => {
    it("全カテゴリをサブカテゴリ付きでupdatedAt降順で取得する", async () => {
        const categories = [
            {
                ...createMockCategory(),
                subCategories: [createMockSubCategory()],
            },
        ];
        mockDb.category.findMany.mockResolvedValue(categories);

        const result = await getAllCategories();

        expect(result).toEqual(categories);
        expect(mockDb.category.findMany).toHaveBeenCalledWith({
            where: {},
            include: { subCategories: true },
            orderBy: { updatedAt: "desc" },
        });
    });

    it("storeUrlが指定された場合、そのストアの商品を持つカテゴリのみ取得する", async () => {
        mockDb.store.findUnique.mockResolvedValue(createMockStore());
        mockDb.category.findMany.mockResolvedValue([]);

        await getAllCategories(TEST_CONFIG.TEST_STORE_URL);

        expect(mockDb.category.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    products: {
                        some: {
                            storeId: TEST_CONFIG.DEFAULT_STORE_ID,
                        },
                    },
                },
            })
        );
    });

    it("存在しないストアURLの場合、空配列を返す", async () => {
        mockDb.store.findUnique.mockResolvedValue(null);

        const result = await getAllCategories("nonexistent-store");

        expect(result).toEqual([]);
        expect(mockDb.category.findMany).not.toHaveBeenCalled();
    });

    it("storeUrlなしの場合はストア検索を行わない", async () => {
        mockDb.category.findMany.mockResolvedValue([]);

        await getAllCategories();

        expect(mockDb.store.findUnique).not.toHaveBeenCalled();
    });
});

// ==================================================
// getAllSubCategoriesFotCategory
// ==================================================
describe("getAllSubCategoriesFotCategory", () => {
    it("カテゴリIDで絞り込みupdatedAt降順で取得する", async () => {
        const subCategories = [
            createMockSubCategory(),
            createMockSubCategory({ id: "sub-2", name: "Tablets" }),
        ];
        mockDb.subCategory.findMany.mockResolvedValue(subCategories);

        const result = await getAllSubCategoriesFotCategory("category-001");

        expect(result).toHaveLength(2);
        expect(mockDb.subCategory.findMany).toHaveBeenCalledWith({
            where: { categoryId: "category-001" },
            orderBy: { updatedAt: "desc" },
        });
    });

    it("サブカテゴリがない場合、空配列を返す", async () => {
        mockDb.subCategory.findMany.mockResolvedValue([]);

        const result = await getAllSubCategoriesFotCategory("empty-cat");

        expect(result).toEqual([]);
    });
});

// ==================================================
// getCategory
// ==================================================
describe("getCategory", () => {
    it("空のcategoryIdの場合エラーをスローする", async () => {
        await expect(getCategory("")).rejects.toThrow(
            "Please provide a category ID."
        );
    });

    it("存在するカテゴリを正常に取得する", async () => {
        const category = createMockCategory();
        mockDb.category.findUnique.mockResolvedValue(category);

        const result = await getCategory("category-001");

        expect(result).toEqual(category);
        expect(mockDb.category.findUnique).toHaveBeenCalledWith({
            where: { id: "category-001" },
        });
    });

    it("存在しないカテゴリの場合nullを返す", async () => {
        mockDb.category.findUnique.mockResolvedValue(null);

        const result = await getCategory("nonexistent");

        expect(result).toBeNull();
    });
});

// ==================================================
// deleteCategory
// ==================================================
describe("deleteCategory", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(deleteCategory("category-001")).rejects.toThrow(
                "Unauthenticated."
            );
        });

        it("ADMINロール以外の場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });

            await expect(deleteCategory("category-001")).rejects.toThrow(
                "Unauthorized Access: Admin Privileges Required for Entry."
            );
        });
    });

    describe("バリデーション", () => {
        it("空のcategoryIdの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });

            await expect(deleteCategory("")).rejects.toThrow(
                "Please provide a category ID."
            );
        });
    });

    describe("正常系", () => {
        it("カテゴリを正常に削除する", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
            const category = createMockCategory();
            mockDb.category.delete.mockResolvedValue(category);

            const result = await deleteCategory("category-001");

            expect(result).toEqual(category);
            expect(mockDb.category.delete).toHaveBeenCalledWith({
                where: { id: "category-001" },
            });
        });
    });
});
