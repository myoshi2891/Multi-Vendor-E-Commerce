import { getProducts } from "./product";

// DB モック
const mockProductFindMany = jest.fn();
const mockProductCount = jest.fn();
const mockStoreFindUnique = jest.fn();
const mockCategoryFindUnique = jest.fn();
const mockSubCategoryFindUnique = jest.fn();
const mockOfferTagFindUnique = jest.fn();

jest.mock("@/lib/db", () => ({
    db: {
        product: {
            findMany: (...args: unknown[]) => mockProductFindMany(...args),
            count: (...args: unknown[]) => mockProductCount(...args),
        },
        store: {
            findUnique: (...args: unknown[]) => mockStoreFindUnique(...args),
        },
        category: {
            findUnique: (...args: unknown[]) => mockCategoryFindUnique(...args),
        },
        subCategory: {
            findUnique: (...args: unknown[]) => mockSubCategoryFindUnique(...args),
        },
        offerTag: {
            findUnique: (...args: unknown[]) => mockOfferTagFindUnique(...args),
        },
    },
}));

beforeEach(() => {
    jest.clearAllMocks();
    mockProductFindMany.mockResolvedValue([]);
    mockProductCount.mockResolvedValue(0);
});

describe("getProducts - 検索フィルタの case-insensitive 対応", () => {
    it("商品名・説明の検索に mode: 'insensitive' が含まれる", async () => {
        await getProducts({ search: "iphone" });

        expect(mockProductFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    AND: expect.arrayContaining([
                        expect.objectContaining({
                            OR: expect.arrayContaining([
                                { name: { contains: "iphone", mode: "insensitive" } },
                                { description: { contains: "iphone", mode: "insensitive" } },
                            ]),
                        }),
                    ]),
                }),
            })
        );
    });

    it("バリアント名・バリアント説明の検索に mode: 'insensitive' が含まれる", async () => {
        await getProducts({ search: "Pro Max" });

        expect(mockProductFindMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    AND: expect.arrayContaining([
                        expect.objectContaining({
                            OR: expect.arrayContaining([
                                {
                                    variants: {
                                        some: {
                                            variantName: { contains: "Pro Max", mode: "insensitive" },
                                            variantDescription: { contains: "Pro Max", mode: "insensitive" },
                                        },
                                    },
                                },
                            ]),
                        }),
                    ]),
                }),
            })
        );
    });

    it("検索フィルタなしの場合は contains が呼ばれない", async () => {
        await getProducts({});

        const callArgs = mockProductFindMany.mock.calls[0][0];
        const whereAnd = callArgs.where.AND;
        const hasContains = whereAnd.some(
            (clause: Record<string, unknown>) =>
                JSON.stringify(clause).includes("contains")
        );

        expect(hasContains).toBe(false);
    });
});
