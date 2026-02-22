import { GET } from "./route";

// Prisma.sql テンプレートリテラルのモック
const mockQueryRaw = jest.fn();
jest.mock("@/lib/db", () => ({
    db: {
        $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
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
        it("有効な検索クエリで $queryRaw を呼び出し、結果を返す", async () => {
            const mockResults = [
                { id: "uuid-1", name: "iPhone 15", description: "Latest Apple smartphone", relevance: 0.95 },
                { id: "uuid-2", name: "iPhone 14", description: "Previous generation", relevance: 0.75 },
            ];
            mockQueryRaw.mockResolvedValue(mockResults);

            const response = await GET(createRequest("iPhone"));
            const data = await response.json();

            expect(data).toEqual(mockResults);
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
            expect(joinedSql).toContain("to_tsvector");
            expect(joinedSql).toContain("plainto_tsquery");
            expect(joinedSql).toContain("ts_rank");
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
});
