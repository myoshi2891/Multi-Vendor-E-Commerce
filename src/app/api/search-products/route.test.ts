import { GET } from "./route";

// Prisma.sql テンプレートリテラルのモック
const mockQueryRaw = jest.fn();
const mockFindMany = jest.fn();
jest.mock("@/lib/db", () => ({
    db: {
        $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
        product: {
            findMany: (...args: unknown[]) => mockFindMany(...args),
        },
    },
}));

// NextResponse.json のモック不要（実際の NextResponse を使用）

beforeEach(() => {
    jest.clearAllMocks();
});

// ヘルパー: Request オブジェクトを生成
const createRequest = (query: string) =>
    new Request(`http://localhost:3000/api/search-products?q=${encodeURIComponent(query)}`);

describe("GET /api/search-products", () => {
    describe("検索クエリのバリデーション", () => {
        it("空の検索クエリの場合は空配列を返す", async () => {
            const response = await GET(createRequest(""));
            const data = await response.json();

            expect(data).toEqual([]);
            expect(mockQueryRaw).not.toHaveBeenCalled();
        });

        it("空白のみの検索クエリの場合は空配列を返す", async () => {
            const response = await GET(createRequest("   "));
            const data = await response.json();

            expect(data).toEqual([]);
            expect(mockQueryRaw).not.toHaveBeenCalled();
        });

        it("クエリパラメータが未指定の場合は空配列を返す", async () => {
            const request = new Request("http://localhost:3000/api/search-products");
            const response = await GET(request);
            const data = await response.json();

            expect(data).toEqual([]);
            expect(mockQueryRaw).not.toHaveBeenCalled();
        });
    });

    describe("PostgreSQL 全文検索（tsvector）", () => {
        it("順位付けクエリの順に hydrate し、SearchResult 形で返す", async () => {
            // Arrange — findMany は順序を保証しないので、わざと逆順で返す
            mockQueryRaw.mockResolvedValue([{ id: "uuid-1" }, { id: "uuid-2" }]);
            mockFindMany.mockResolvedValue([
                { id: "uuid-2", name: "iPhone 14", slug: "iphone-14", variants: [{ slug: "iphone-14-black", variantImage: "https://img/14.png" }] },
                { id: "uuid-1", name: "iPhone 15", slug: "iphone-15", variants: [{ slug: "iphone-15-blue", variantImage: "https://img/15.png" }] },
            ]);

            // Act
            const response = await GET(createRequest("iPhone"));
            const data = await response.json();

            // Assert
            expect(data).toEqual([
                { id: "uuid-1", name: "iPhone 15", link: "/product/iphone-15/iphone-15-blue", image: "https://img/15.png" },
                { id: "uuid-2", name: "iPhone 14", link: "/product/iphone-14/iphone-14-black", image: "https://img/14.png" },
            ]);
            expect(mockQueryRaw).toHaveBeenCalledTimes(1);
            expect(mockFindMany).toHaveBeenCalledTimes(1);
        });

        it("2 クエリの間にバリアントが消えた商品は飛ばす", async () => {
            // Arrange
            mockQueryRaw.mockResolvedValue([{ id: "uuid-1" }, { id: "uuid-2" }]);
            mockFindMany.mockResolvedValue([
                { id: "uuid-1", name: "A", slug: "a", variants: [] },
                { id: "uuid-2", name: "B", slug: "b", variants: [{ slug: "b-1", variantImage: "https://img/b.png" }] },
            ]);

            // Act
            const data = await (await GET(createRequest("x"))).json();

            // Assert
            expect(data).toEqual([{ id: "uuid-2", name: "B", link: "/product/b/b-1", image: "https://img/b.png" }]);
        });

        it("順位付けが 0 件なら hydrate しない", async () => {
            mockQueryRaw.mockResolvedValue([]);

            const data = await (await GET(createRequest("none"))).json();

            expect(data).toEqual([]);
            expect(mockFindMany).not.toHaveBeenCalled();
        });

        it("互換のため search パラメータも受け付ける", async () => {
            mockQueryRaw.mockResolvedValue([]);

            await GET(new Request("http://localhost:3000/api/search-products?search=iPhone"));

            expect(mockQueryRaw).toHaveBeenCalledTimes(1);
        });

        it("PostgreSQL tsvector/plainto_tsquery 構文を使用する", async () => {
            mockQueryRaw.mockResolvedValue([]);

            await GET(createRequest("test"));

            expect(mockQueryRaw).toHaveBeenCalledTimes(1);

            // Prisma.sql テンプレートリテラルの第1引数は TemplateStringsArray
            const callArgs = mockQueryRaw.mock.calls[0];
            const sqlStrings = callArgs[0]?.strings ?? callArgs[0];
            const joinedSql = Array.isArray(sqlStrings) ? sqlStrings.join("?") : String(sqlStrings);

            // PostgreSQL 全文検索の構文が含まれることを検証
            expect(joinedSql).toContain('"searchVector"');
            expect(joinedSql).toContain("to_tsquery");
            // 入力は前方一致の tsquery 文字列に変換してからパラメータとして渡す
            expect(callArgs[0]?.values).toContain("test:*");
            expect(joinedSql).toContain("ts_rank");
            // 同点の並びを決定的にする tie-breaker と、LIMIT 前のバリアント存在条件
            expect(joinedSql).toContain("p.id ASC");
            expect(joinedSql).toContain('"ProductVariant"');
            // MySQL の MATCH...AGAINST が含まれないことを検証
            expect(joinedSql).not.toContain("MATCH");
            expect(joinedSql).not.toContain("AGAINST");
        });

        it("テーブル名が引用符付きの PostgreSQL 形式であること", async () => {
            mockQueryRaw.mockResolvedValue([]);

            await GET(createRequest("test"));

            const callArgs = mockQueryRaw.mock.calls[0];
            const sqlStrings = callArgs[0]?.strings ?? callArgs[0];
            const joinedSql = Array.isArray(sqlStrings) ? sqlStrings.join("?") : String(sqlStrings);

            // PostgreSQL では PascalCase テーブル名に引用符が必要
            expect(joinedSql).toContain('"Product"');
        });
    });

    describe("エラーハンドリング", () => {
        it("DBエラー時に500エラーを返す", async () => {
            const consoleErrorSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});
            mockQueryRaw.mockRejectedValue(new Error("DB connection failed"));

            const response = await GET(createRequest("test"));
            const data = await response.json();

            expect(response.status).toBe(500);
            expect(data).toEqual({ error: "Internal Server Error" });
            consoleErrorSpy.mockRestore();
        });

        it("結果が0件の場合空配列を返す（200）", async () => {
            mockQueryRaw.mockResolvedValue([]);

            const response = await GET(createRequest("nonexistent-product"));
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data).toEqual([]);
        });
    });
});
