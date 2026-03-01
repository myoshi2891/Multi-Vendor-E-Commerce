import { currentUser } from "@clerk/nextjs/server";
import {
    upsertSubCategory,
    getAllSubCategories,
    getSubCategory,
    deleteSubCategory,
    getSubcategories,
} from "./subCategory";
import { TEST_CONFIG } from "../config/test-config";
import { createMockSubCategory } from "../config/test-fixtures";

// ---- モック設定 ----
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

const mockFindFirst = jest.fn();
const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();
const mockUpsert = jest.fn();
const mockDelete = jest.fn();
const mockQueryRaw = jest.fn();

jest.mock("@/lib/db", () => ({
    db: {
        subCategory: {
            findFirst: (...args: unknown[]) => mockFindFirst(...args),
            findUnique: (...args: unknown[]) => mockFindUnique(...args),
            findMany: (...args: unknown[]) => mockFindMany(...args),
            upsert: (...args: unknown[]) => mockUpsert(...args),
            delete: (...args: unknown[]) => mockDelete(...args),
        },
        $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    },
}));

beforeEach(() => {
    jest.clearAllMocks();
});

// ==================================================
// upsertSubCategory
// ==================================================
describe("upsertSubCategory", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(
                upsertSubCategory(createMockSubCategory() as never)
            ).rejects.toThrow("Unauthenticated.");
        });

        it("ADMIN以外のロールの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "USER" },
            });

            await expect(
                upsertSubCategory(createMockSubCategory() as never)
            ).rejects.toThrow(
                "Unauthorized Access: Admin Privileges Required for Entry."
            );
        });

        it("SELLERロールでも拒否される", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "SELLER" },
            });

            await expect(
                upsertSubCategory(createMockSubCategory() as never)
            ).rejects.toThrow(
                "Unauthorized Access: Admin Privileges Required for Entry."
            );
        });
    });

    describe("重複チェック", () => {
        beforeEach(() => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });
        });

        it("同じ名前のサブカテゴリが存在する場合エラーをスローする", async () => {
            const subCategory = createMockSubCategory({ name: "Existing" });
            mockFindFirst.mockResolvedValue(
                createMockSubCategory({ id: "other-id", name: "Existing" })
            );

            await expect(
                upsertSubCategory(subCategory as never)
            ).rejects.toThrow(
                "A subCategory with the same name already exists"
            );
        });

        it("同じURLのサブカテゴリが存在する場合エラーをスローする", async () => {
            const subCategory = createMockSubCategory({
                name: "Unique Name",
                url: "existing-url",
            });
            mockFindFirst.mockResolvedValue(
                createMockSubCategory({
                    id: "other-id",
                    name: "Different Name",
                    url: "existing-url",
                })
            );

            await expect(
                upsertSubCategory(subCategory as never)
            ).rejects.toThrow(
                "A subCategory with the same URL already exists"
            );
        });

        it("自身のIDは重複チェックから除外される（更新時）", async () => {
            const subCategory = createMockSubCategory();
            mockFindFirst.mockResolvedValue(null);
            mockUpsert.mockResolvedValue(subCategory);

            await upsertSubCategory(subCategory as never);

            expect(mockFindFirst).toHaveBeenCalledWith({
                where: {
                    AND: [
                        {
                            OR: [
                                { name: subCategory.name },
                                { url: subCategory.url },
                            ],
                        },
                        {
                            NOT: { id: subCategory.id },
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
            mockFindFirst.mockResolvedValue(null);
        });

        it("新規サブカテゴリをupsertで作成する", async () => {
            const subCategory = createMockSubCategory();
            mockUpsert.mockResolvedValue(subCategory);

            const result = await upsertSubCategory(subCategory as never);

            expect(result).toEqual(subCategory);
            expect(mockUpsert).toHaveBeenCalledWith({
                where: { id: subCategory.id },
                update: subCategory,
                create: subCategory,
            });
        });

        it("既存サブカテゴリを更新する", async () => {
            const subCategory = createMockSubCategory({ name: "Updated Name" });
            const updatedSubCategory = { ...subCategory };
            mockUpsert.mockResolvedValue(updatedSubCategory);

            const result = await upsertSubCategory(subCategory as never);

            expect(result).toEqual(updatedSubCategory);
        });
    });
});

// ==================================================
// getAllSubCategories
// ==================================================
describe("getAllSubCategories", () => {
    it("全サブカテゴリをupdatedAt降順で取得する", async () => {
        const subCategories = [
            createMockSubCategory({ id: "sc-1", name: "Sub A" }),
            createMockSubCategory({ id: "sc-2", name: "Sub B" }),
        ];
        mockFindMany.mockResolvedValue(subCategories);

        const result = await getAllSubCategories();

        expect(result).toEqual(subCategories);
        expect(mockFindMany).toHaveBeenCalledWith({
            include: { category: true },
            orderBy: { updatedAt: "desc" },
        });
    });

    it("categoryをincludeして取得する", async () => {
        mockFindMany.mockResolvedValue([]);

        await getAllSubCategories();

        expect(mockFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                include: { category: true },
            })
        );
    });

    it("データベースエラー時にエラーを再スローする", async () => {
        const consoleErrorSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});
        mockFindMany.mockRejectedValue(new Error("DB error"));

        await expect(getAllSubCategories()).rejects.toThrow("DB error");
        expect(consoleErrorSpy).toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
    });
});

// ==================================================
// getSubCategory
// ==================================================
describe("getSubCategory", () => {
    it("IDでサブカテゴリを取得する", async () => {
        const subCategory = createMockSubCategory();
        mockFindUnique.mockResolvedValue(subCategory);

        const result = await getSubCategory("subcategory-001");

        expect(result).toEqual(subCategory);
        expect(mockFindUnique).toHaveBeenCalledWith({
            where: { id: "subcategory-001" },
        });
    });

    it("存在しないIDの場合nullを返す", async () => {
        mockFindUnique.mockResolvedValue(null);

        const result = await getSubCategory("nonexistent");

        expect(result).toBeNull();
    });

    it("IDが空の場合エラーをスローする", async () => {
        await expect(getSubCategory("")).rejects.toThrow(
            "Please provide a subCategory ID."
        );
    });

    it("データベースエラー時にエラーを再スローする", async () => {
        const consoleErrorSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});
        mockFindUnique.mockRejectedValue(new Error("DB error"));

        await expect(getSubCategory("subcategory-001")).rejects.toThrow(
            "DB error"
        );

        consoleErrorSpy.mockRestore();
    });
});

// ==================================================
// deleteSubCategory
// ==================================================
describe("deleteSubCategory", () => {
    describe("認証・権限エラー", () => {
        it("未認証ユーザーの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue(null);

            await expect(deleteSubCategory("subcategory-001")).rejects.toThrow(
                "Unauthenticated."
            );
        });

        it("ADMIN以外のロールの場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "USER" },
            });

            await expect(deleteSubCategory("subcategory-001")).rejects.toThrow(
                "Unauthorized Access: Admin Privileges Required for Entry."
            );
        });
    });

    describe("バリデーション", () => {
        it("IDが空の場合エラーをスローする", async () => {
            (currentUser as jest.Mock).mockResolvedValue({
                id: TEST_CONFIG.DEFAULT_USER_ID,
                privateMetadata: { role: "ADMIN" },
            });

            await expect(deleteSubCategory("")).rejects.toThrow(
                "Please provide a subCategory ID."
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

        it("サブカテゴリを正常に削除する", async () => {
            const deletedSubCategory = createMockSubCategory();
            mockDelete.mockResolvedValue(deletedSubCategory);

            const result = await deleteSubCategory("subcategory-001");

            expect(result).toEqual(deletedSubCategory);
            expect(mockDelete).toHaveBeenCalledWith({
                where: { id: "subcategory-001" },
            });
        });
    });
});

// $queryRaw のモック呼び出しからSQL文字列を再構成するヘルパー
const reconstructSqlFromCall = (mockCall: unknown[]): string => {
    const sqlStrings =
        (mockCall[0] as Record<string, unknown>)?.strings ?? mockCall[0];
    return Array.isArray(sqlStrings)
        ? sqlStrings.join("?")
        : String(sqlStrings);
};

// ==================================================
// getSubcategories
// ==================================================
describe("getSubcategories", () => {
    describe("通常の取得（random = false）", () => {
        it("limitなしで全サブカテゴリを取得する", async () => {
            const mockSubCategories = [
                { id: "1", name: "Smartphones", url: "smartphones" },
                { id: "2", name: "Laptops", url: "laptops" },
            ];
            mockFindMany.mockResolvedValue(mockSubCategories);

            const result = await getSubcategories();

            expect(result).toEqual(mockSubCategories);
            expect(mockFindMany).toHaveBeenCalledTimes(1);
            expect(mockQueryRaw).not.toHaveBeenCalled();
        });

        it("limitを指定してサブカテゴリを取得する", async () => {
            const mockSubCategories = [
                { id: "1", name: "Smartphones", url: "smartphones" },
            ];
            mockFindMany.mockResolvedValue(mockSubCategories);

            const result = await getSubcategories(5, false);

            expect(result).toEqual(mockSubCategories);
            expect(mockFindMany).toHaveBeenCalledWith(
                expect.objectContaining({ take: 5 })
            );
        });
    });

    describe("ランダム取得（random = true）", () => {
        it("PostgreSQL の RANDOM() を使用してサブカテゴリを取得する", async () => {
            const mockSubCategories = [
                { id: "3", name: "Headphones", url: "headphones" },
                { id: "1", name: "Smartphones", url: "smartphones" },
            ];
            mockQueryRaw.mockResolvedValue(mockSubCategories);

            const result = await getSubcategories(10, true);

            expect(result).toEqual(mockSubCategories);
            expect(mockQueryRaw).toHaveBeenCalledTimes(1);
            expect(mockFindMany).not.toHaveBeenCalled();
        });

        it("PostgreSQL RANDOM() 構文を使用し、RAND() を使用しない", async () => {
            mockQueryRaw.mockResolvedValue([]);

            await getSubcategories(5, true);

            const joinedSql = reconstructSqlFromCall(
                mockQueryRaw.mock.calls[0]
            );

            // PostgreSQL の RANDOM() が使われること
            expect(joinedSql).toContain("RANDOM()");
            // MySQL の RAND() が使われないこと
            expect(joinedSql).not.toMatch(/RAND\(\)/);
        });

        it("テーブル名が引用符付きの PostgreSQL 形式であること", async () => {
            mockQueryRaw.mockResolvedValue([]);

            await getSubcategories(5, true);

            const joinedSql = reconstructSqlFromCall(
                mockQueryRaw.mock.calls[0]
            );

            // PostgreSQL では PascalCase テーブル名に引用符が必要
            expect(joinedSql).toContain('"SubCategory"');
        });

        it("limitが未指定の場合はデフォルト10件で取得する", async () => {
            mockQueryRaw.mockResolvedValue([]);

            await getSubcategories(null, true);

            // $queryRaw が呼ばれたことを確認（LIMIT のデフォルト値は実装側で処理）
            expect(mockQueryRaw).toHaveBeenCalledTimes(1);
        });
    });

    describe("エラーハンドリング", () => {
        let consoleErrorSpy: jest.SpyInstance;

        beforeEach(() => {
            consoleErrorSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});
        });

        afterEach(() => {
            consoleErrorSpy.mockRestore();
        });

        it("データベースエラーが発生した場合はログ出力してエラーを再スローする", async () => {
            const mockError = new Error("Database connection failed");
            mockFindMany.mockRejectedValue(mockError);

            await expect(getSubcategories(null, false)).rejects.toThrow(
                "Database connection failed"
            );

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                "Error fetching subcategories",
                mockError
            );
        });
    });
});
