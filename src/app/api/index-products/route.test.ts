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
    // clearAllMocks は呼び出し履歴しか消さないため、mockResolvedValue /
    // mockRejectedValue で設定した「既定の実装」は次のテストへ持ち越される。
    // DB モックは実装ごと落として、テスト間の独立性を保証する。
    mockProductFindMany.mockReset();
    mockProductCount.mockReset();
});

// console の spy はアサーション失敗時にも必ず復元する。テスト本体末尾の
// mockRestore() は失敗時に到達せず、後続テストへ spy が漏れて出力を汚す。
afterEach(() => {
    jest.restoreAllMocks();
});

// ヘルパー: Request オブジェクト生成
const createPostRequest = (body: Record<string, unknown>) =>
    new Request("http://localhost:3000/api/index-products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

const createGetRequest = (params: URLSearchParams) =>
    new Request(
        `http://localhost:3000/api/index-products?${params.toString()}`
    );

describe("POST /api/index-products - フォールバック contains 検索", () => {
    it("fulltext検索失敗時のフォールバックで mode: 'insensitive' が含まれる", async () => {
        // 1回目: fulltext 検索が失敗
        mockProductFindMany
            .mockRejectedValueOnce(new Error("Fulltext search failed"))
            // 2回目: contains フォールバック
            .mockResolvedValueOnce([]);

        // consoleの警告を抑制
        jest.spyOn(console, "warn").mockImplementation(() => {});

        await POST(createPostRequest({ query: "iPhone" }));

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
                                {
                                    variantName: {
                                        contains: "iPhone",
                                        mode: "insensitive",
                                    },
                                },
                                {
                                    keywords: {
                                        contains: "iPhone",
                                        mode: "insensitive",
                                    },
                                },
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

        jest.spyOn(console, "warn").mockImplementation(() => {});

        await GET(createGetRequest(new URLSearchParams({ search: "Laptop" })));

        // フォールバック呼び出しの引数を検証
        // Promise.all が失敗するため、フォールバックブロックで再度 findMany が呼ばれる
        const fallbackFindManyCall = mockProductFindMany.mock.calls.find(
            (call: unknown[]) => {
                const arg = call[0] as Record<string, unknown>;
                const where = arg?.where as Record<string, unknown>;
                const or = where?.OR as Array<Record<string, unknown>>;
                return or?.some(
                    (clause) =>
                        "name" in clause &&
                        typeof clause.name === "object" &&
                        clause.name !== null &&
                        "mode" in (clause.name as Record<string, unknown>)
                );
            }
        );

        expect(fallbackFindManyCall).toBeDefined();

        const orClauses = (
            fallbackFindManyCall![0] as Record<
                string,
                Record<string, Array<Record<string, unknown>>>
            >
        ).where.OR;

        expect(orClauses).toEqual(
            expect.arrayContaining([
                { name: { contains: "Laptop", mode: "insensitive" } },
                { brand: { contains: "Laptop", mode: "insensitive" } },
                { description: { contains: "Laptop", mode: "insensitive" } },
            ])
        );
    });
});

describe("GET /api/index-products - ページネーション正規化", () => {
    const mockSuccessfulSearch = () => {
        mockProductFindMany.mockResolvedValueOnce([]);
        mockProductCount.mockResolvedValueOnce(100);
    };

    const getFindManyPagination = () => {
        const [args] = mockProductFindMany.mock.calls;
        const options = args[0] as { skip: number; take: number };
        return { skip: options.skip, take: options.take };
    };

    it("有効な page と limit を Prisma とレスポンスに反映する", async () => {
        mockSuccessfulSearch();

        const response = await GET(
            createGetRequest(
                new URLSearchParams({ search: "foo", page: "2", limit: "10" })
            )
        );
        const body = await response.json();

        expect(getFindManyPagination()).toEqual({ skip: 10, take: 10 });
        expect(body).toMatchObject({ page: 2, limit: 10 });
    });

    it("過大な limit を 50 にクランプする", async () => {
        mockSuccessfulSearch();

        const response = await GET(
            createGetRequest(
                new URLSearchParams({ search: "foo", limit: "99999999" })
            )
        );
        const body = await response.json();

        expect(getFindManyPagination()).toEqual({ skip: 0, take: 50 });
        expect(body).toMatchObject({ page: 1, limit: 50 });
    });

    it("負の page を 1 に正規化する", async () => {
        mockSuccessfulSearch();

        const response = await GET(
            createGetRequest(new URLSearchParams({ search: "foo", page: "-1" }))
        );
        const body = await response.json();

        expect(getFindManyPagination()).toEqual({ skip: 0, take: 20 });
        expect(body).toMatchObject({ page: 1, limit: 20 });
    });

    it("非数値の page と limit をデフォルト値に正規化する", async () => {
        mockSuccessfulSearch();

        const response = await GET(
            createGetRequest(
                new URLSearchParams({
                    search: "foo",
                    page: "abc",
                    limit: "xyz",
                })
            )
        );
        const body = await response.json();

        expect(getFindManyPagination()).toEqual({ skip: 0, take: 20 });
        expect(body).toMatchObject({ page: 1, limit: 20 });
    });

    it("過大な page を上限にクランプする", async () => {
        mockSuccessfulSearch();

        const response = await GET(
            createGetRequest(
                new URLSearchParams({
                    search: "foo",
                    page: "999999999",
                    limit: "10",
                })
            )
        );
        const body = await response.json();

        expect(getFindManyPagination()).toEqual({
            skip: (10_000 - 1) * 10,
            take: 10,
        });
        expect(body).toMatchObject({ page: 10_000, limit: 10 });
    });
});

describe("index-products - 500 レスポンスの情報漏洩防止", () => {
    // DB ドライバのメッセージを模した「クライアントへ漏れてはいけない」文字列
    const LEAKY_MESSAGE = "connect ECONNREFUSED 10.0.0.5:5432";

    // fulltext とフォールバックの両方を失敗させると外側の catch へ伝播する
    // （フォールバック側の findMany は try で包まれていないため）
    //
    // 回数指定の `mockRejectedValueOnce` を積み上げず、常に reject する
    // `mockRejectedValue` を使う。本スイートの主張は「DB が落ちたとき内部メッセージを
    // 漏らさない」であって呼び出し回数ではない。回数を数えて並べると、実装が
    // fulltext/フォールバックの呼び出し回数を変えた瞬間に reject が尽きて成功が返り、
    // 500 にならずテストが本来の意図と無関係な理由で落ちる（逆に通る）。

    it("POST は内部エラーメッセージを含まない汎用 500 を返す", async () => {
        mockProductFindMany.mockRejectedValue(new Error(LEAKY_MESSAGE));

        jest.spyOn(console, "warn").mockImplementation(() => {});
        const consoleErrorSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});

        const response = await POST(createPostRequest({ query: "iPhone" }));
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({ error: "Internal Server Error" });
        expect(JSON.stringify(body)).not.toContain(LEAKY_MESSAGE);
        // サーバー側では完全なエラーを保持していること（デバッグ性の担保）
        expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("GET は内部エラーメッセージを含まない汎用 500 を返す", async () => {
        // GET は Promise.all([findMany, count]) なので count も落とす
        mockProductFindMany.mockRejectedValue(new Error(LEAKY_MESSAGE));
        mockProductCount.mockRejectedValue(new Error(LEAKY_MESSAGE));

        jest.spyOn(console, "warn").mockImplementation(() => {});
        const consoleErrorSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});

        const response = await GET(
            createGetRequest(new URLSearchParams({ search: "Laptop" }))
        );
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toEqual({ error: "Internal Server Error" });
        expect(JSON.stringify(body)).not.toContain(LEAKY_MESSAGE);
        expect(consoleErrorSpy).toHaveBeenCalled();
    });
});
