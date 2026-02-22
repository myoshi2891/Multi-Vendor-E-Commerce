import { getSubcategories } from "./subCategory";

// DB モック
const mockQueryRaw = jest.fn();
const mockFindMany = jest.fn();
jest.mock("@/lib/db", () => ({
    db: {
        subCategory: {
            findMany: (...args: unknown[]) => mockFindMany(...args),
        },
        $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    },
}));

// Clerk モック
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(),
}));

beforeEach(() => {
    jest.clearAllMocks();
});

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
            const mockSubCategories = [{ id: "1", name: "Smartphones", url: "smartphones" }];
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

            const callArgs = mockQueryRaw.mock.calls[0];
            const sqlStrings = callArgs[0]?.strings ?? callArgs[0];
            const joinedSql = Array.isArray(sqlStrings) ? sqlStrings.join("?") : String(sqlStrings);

            // PostgreSQL の RANDOM() が使われること
            expect(joinedSql).toContain("RANDOM()");
            // MySQL の RAND() が使われないこと
            expect(joinedSql).not.toMatch(/RAND\(\)/);
        });

        it("テーブル名が引用符付きの PostgreSQL 形式であること", async () => {
            mockQueryRaw.mockResolvedValue([]);

            await getSubcategories(5, true);

            const callArgs = mockQueryRaw.mock.calls[0];
            const sqlStrings = callArgs[0]?.strings ?? callArgs[0];
            const joinedSql = Array.isArray(sqlStrings) ? sqlStrings.join("?") : String(sqlStrings);

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
        let consoleLogSpy: jest.SpyInstance;

        beforeEach(() => {
            consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
        });

        afterEach(() => {
            consoleLogSpy.mockRestore();
        });

        it("データベースエラーが発生した場合はログ出力してエラーを再スローする", async () => {
            const mockError = new Error("Database connection failed");
            mockFindMany.mockRejectedValue(mockError);

            await expect(getSubcategories(null, false)).rejects.toThrow("Database connection failed");

            expect(consoleLogSpy).toHaveBeenCalledWith("Error fetching subcategories", mockError);
        });
    });
});
