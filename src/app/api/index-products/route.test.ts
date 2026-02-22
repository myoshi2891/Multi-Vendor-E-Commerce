import { POST, GET } from "./route";

// DB モック
const mockProductFindMany = jest.fn();
const mockProductCount = jest.fn();

jest.mock("@/lib/db", () => ({
    db: {
        product: {
            findMany: (...args: unknown[]) => mockProductFindMany(...args),
            count: (...args: unknown[]) => mockProductCount(...args),
        },
    },
}));

beforeEach(() => {
    jest.clearAllMocks();
});

// ヘルパー: Request オブジェクト生成
const createPostRequest = (body: Record<string, unknown>) =>
    new Request("http://localhost:3000/api/index-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

const createGetRequest = (query: string) =>
    new Request(`http://localhost:3000/api/index-products?search=${encodeURIComponent(query)}`);

describe("POST /api/index-products - フォールバック contains 検索", () => {
    it("fulltext検索失敗時のフォールバックで mode: 'insensitive' が含まれる", async () => {
        // 1回目: fulltext 検索が失敗
        mockProductFindMany
            .mockRejectedValueOnce(new Error("Fulltext search failed"))
            // 2回目: contains フォールバック
            .mockResolvedValueOnce([]);

        // consoleの警告を抑制
        const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

        await POST(createPostRequest({ query: "iPhone" }));

        consoleWarnSpy.mockRestore();

        // フォールバック呼び出し（2回目）の引数を検証
        expect(mockProductFindMany).toHaveBeenCalledTimes(2);
        const fallbackCall = mockProductFindMany.mock.calls[1][0];
        const orClauses = fallbackCall.where.OR;

        // 商品名・ブランド・説明に mode: "insensitive" が含まれる
        expect(orClauses).toEqual(
            expect.arrayContaining([
                { name: { contains: "iPhone", mode: "insensitive" } },
                { brand: { contains: "iPhone", mode: "insensitive" } },
                { description: { contains: "iPhone", mode: "insensitive" } },
            ])
        );

        // バリアント名・キーワードに mode: "insensitive" が含まれる
        expect(orClauses).toEqual(
            expect.arrayContaining([
                {
                    variants: {
                        some: {
                            OR: [
                                { variantName: { contains: "iPhone", mode: "insensitive" } },
                                { keywords: { contains: "iPhone", mode: "insensitive" } },
                            ],
                        },
                    },
                },
            ])
        );
    });
});

describe("GET /api/index-products - フォールバック contains 検索", () => {
    it("fulltext検索失敗時のフォールバックで mode: 'insensitive' が含まれる", async () => {
        // 1回目: fulltext 検索が失敗（findMany と count の両方）
        mockProductFindMany
            .mockRejectedValueOnce(new Error("Fulltext search failed"))
            // 2回目: contains フォールバック
            .mockResolvedValueOnce([]);
        mockProductCount
            .mockRejectedValueOnce(new Error("Fulltext count failed"))
            .mockResolvedValueOnce(0);

        const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

        await GET(createGetRequest("Laptop"));

        consoleWarnSpy.mockRestore();

        // フォールバック呼び出しの引数を検証
        // Promise.all が失敗するため、フォールバックブロックで再度 findMany が呼ばれる
        const fallbackFindManyCall = mockProductFindMany.mock.calls.find(
            (call: unknown[]) => {
                const arg = call[0] as Record<string, unknown>;
                const where = arg?.where as Record<string, unknown>;
                const or = where?.OR as Array<Record<string, unknown>>;
                return or?.some((clause) =>
                    "name" in clause && typeof clause.name === "object" && clause.name !== null && "mode" in (clause.name as Record<string, unknown>)
                );
            }
        );

        expect(fallbackFindManyCall).toBeDefined();

        const orClauses = (fallbackFindManyCall![0] as Record<string, Record<string, Array<Record<string, unknown>>>>).where.OR;

        expect(orClauses).toEqual(
            expect.arrayContaining([
                { name: { contains: "Laptop", mode: "insensitive" } },
                { brand: { contains: "Laptop", mode: "insensitive" } },
                { description: { contains: "Laptop", mode: "insensitive" } },
            ])
        );
    });
});
