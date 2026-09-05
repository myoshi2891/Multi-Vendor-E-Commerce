/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { permanentRedirect, redirect } from "next/navigation";
import { resolveCategoryNode } from "@/lib/category-tree";
import { FiltersQueryType } from "@/lib/types";
import { MAX_PAGE } from "@/lib/utils";
import { getProducts } from "@/queries/product";
import BrowsePage from "./page";

jest.mock("@/queries/product", () => ({
    getProducts: jest.fn(),
}));

// 本物の redirect() は NEXT_REDIRECT を throw して以降の描画を止める。
// 制御フローを production と揃えるため、モックも throw する。
jest.mock("next/navigation", () => ({
    redirect: jest.fn((url: string) => {
        throw new Error(`NEXT_REDIRECT:${url}`);
    }),
    // 308（恒久）。307 の redirect とは別関数なので、取り違えを検出できるよう
    // モックも別に置く。
    permanentRedirect: jest.fn((url: string) => {
        throw new Error(`NEXT_PERMANENT_REDIRECT:${url}`);
    }),
}));

jest.mock("@/lib/category-tree", () => ({
    resolveCategoryNode: jest.fn(),
    // 境界判定は本物を使う（モックすると「親子でないなら畳まない」の検証が
    // モックの都合で緑になり、実装の誤りを見逃す）。
    isWithinSubtree: jest.requireActual("@/lib/category-tree").isWithinSubtree,
}));

// 子コンポーネントはページ側のロジック検証に不要（useSearchParams 等の client 依存を切る）
jest.mock("@/components/store/browse-page/browse-pagination", () => ({
    __esModule: true,
    default: ({ page, totalPages }: { page: number; totalPages: number }) => (
        <div data-testid="pagination">{`${page}/${totalPages}`}</div>
    ),
}));
jest.mock("@/components/store/browse-page/filters", () => ({
    __esModule: true,
    default: () => <div data-testid="filters" />,
}));
jest.mock("@/components/store/browse-page/sort", () => ({
    __esModule: true,
    default: () => <div data-testid="sort" />,
}));
jest.mock("@/components/store/shared/product-list", () => ({
    __esModule: true,
    default: ({ products }: { products: unknown[] }) => (
        <div data-testid="product-list">{products.length}</div>
    ),
}));

const mockGetProducts = getProducts as jest.Mock;
const mockRedirect = redirect as unknown as jest.Mock;
const mockPermanentRedirect = permanentRedirect as unknown as jest.Mock;
const mockResolveCategoryNode = resolveCategoryNode as jest.Mock;

/**
 * searchParams のスタブ。Next.js は URL に無いキーを渡さないが、
 * FiltersQueryType は全フィールドを必須として宣言しているため、
 * 実行時の形（部分オブジェクト）に合わせてここでキャストする。
 */
const makeQuery = (overrides: Partial<FiltersQueryType>): FiltersQueryType =>
    overrides as FiltersQueryType;

/** getProducts の戻り値スタブ（ページ側は products / totalPages しか読まない）。 */
const mockProductsResult = (totalPages: number, productCount = 0) => {
    mockGetProducts.mockResolvedValueOnce({
        products: Array.from({ length: productCount }, (_, i) => ({
            id: `p${i}`,
        })),
        totalPages,
        currentPage: 1,
        pageSize: 10,
        totalCount: productCount,
    });
};

/** redirect に渡された URL のクエリを順序非依存で検証するためにパースする。 */
const parseRedirectUrl = (): URLSearchParams => {
    const url = mockRedirect.mock.calls[0][0] as string;
    expect(url.startsWith("/browse?")).toBe(true);
    return new URLSearchParams(url.slice("/browse?".length));
};

describe("BrowsePage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ==================================================
    // 範囲内（リダイレクトしない）
    // ==================================================
    it("範囲内のページは通常どおり描画し、リダイレクトしない", async () => {
        // Arrange
        mockProductsResult(3, 10);

        // Act
        render(
            await BrowsePage({
                searchParams: Promise.resolve(makeQuery({ page: "2" })),
            })
        );

        // Assert
        expect(mockRedirect).not.toHaveBeenCalled();
        expect(mockGetProducts).toHaveBeenCalledWith(
            expect.any(Object),
            undefined,
            2
        );
        expect(screen.getByTestId("pagination")).toHaveTextContent("2/3");
    });

    it("page 未指定は 1 ページ目として扱い、リダイレクトしない", async () => {
        // Arrange
        mockProductsResult(1, 5);

        // Act
        render(
            await BrowsePage({ searchParams: Promise.resolve(makeQuery({})) })
        );

        // Assert
        expect(mockRedirect).not.toHaveBeenCalled();
        expect(mockGetProducts).toHaveBeenCalledWith(
            expect.any(Object),
            undefined,
            1
        );
    });

    // ==================================================
    // 範囲外（正準 URL へリダイレクト）
    // ==================================================
    it("範囲外のページは最終ページへリダイレクトする", async () => {
        // Arrange
        mockProductsResult(3, 0);

        // Act / Assert — redirect() は throw するため rejects で受ける
        await expect(
            BrowsePage({
                searchParams: Promise.resolve(makeQuery({ page: "999" })),
            })
        ).rejects.toThrow("NEXT_REDIRECT");

        expect(parseRedirectUrl().get("page")).toBe("3");
    });

    it("リダイレクト時も既存のフィルタ・ソートを保持する", async () => {
        // Arrange — category / sort を落とすと検証が空振りするため必ず確認する
        mockProductsResult(2, 0);

        // Act
        await expect(
            BrowsePage({
                searchParams: Promise.resolve(
                    makeQuery({
                        page: "50",
                        category: "shoes",
                        sort: "most-popular",
                        minPrice: "10",
                    })
                ),
            })
        ).rejects.toThrow("NEXT_REDIRECT");

        // Assert
        const params = parseRedirectUrl();
        expect(params.get("page")).toBe("2");
        expect(params.get("category")).toBe("shoes");
        expect(params.get("sort")).toBe("most-popular");
        expect(params.get("minPrice")).toBe("10");
    });

    it("配列パラメータ（color）はすべての要素を保持する", async () => {
        // Arrange
        mockProductsResult(1, 0);

        // Act
        await expect(
            BrowsePage({
                searchParams: Promise.resolve(
                    makeQuery({ page: "9", color: ["red", "blue"] })
                ),
            })
        ).rejects.toThrow("NEXT_REDIRECT");

        // Assert
        expect(parseRedirectUrl().getAll("color")).toEqual(["red", "blue"]);
    });

    it("page が配列（?page=2&page=999）なら先頭要素を採り、リダイレクトしない", async () => {
        // Arrange — 2 ページ目が範囲内になるだけの結果を返す。
        // ここで totalPages < 2 にすると redirect が走り、
        // 「先頭要素を採ったか」が範囲外クランプに隠れてしまう。
        mockProductsResult(3, 1);

        // Act
        render(
            await BrowsePage({
                searchParams: Promise.resolve(
                    makeQuery({ page: ["2", "999"] })
                ),
            })
        );

        // Assert — 2 件目の 999 ではなく先頭の 2 で問い合わせる
        expect(mockGetProducts).toHaveBeenCalledWith(
            expect.any(Object),
            undefined,
            2
        );
        expect(mockRedirect).not.toHaveBeenCalled();
        expect(screen.getByTestId("pagination")).toHaveTextContent("2/3");
    });

    it("該当 0 件（totalPages=0）で page>1 なら 1 ページ目へリダイレクトする", async () => {
        // Arrange
        mockProductsResult(0, 0);

        // Act
        await expect(
            BrowsePage({
                searchParams: Promise.resolve(makeQuery({ page: "5" })),
            })
        ).rejects.toThrow("NEXT_REDIRECT");

        // Assert
        expect(parseRedirectUrl().get("page")).toBe("1");
    });

    it("該当 0 件でも page=1 ならリダイレクトしない（ループ防止）", async () => {
        // Arrange
        mockProductsResult(0, 0);

        // Act
        render(
            await BrowsePage({
                searchParams: Promise.resolve(makeQuery({ page: "1" })),
            })
        );

        // Assert
        expect(mockRedirect).not.toHaveBeenCalled();
    });

    // ==================================================
    // 上限クランプ（skip 暴走の防止）
    // ==================================================
    it("巨大な page は MAX_PAGE でクランプしてから getProducts に渡す", async () => {
        // Arrange — 修正前は 1e21 がそのまま skip 計算へ到達していた
        mockProductsResult(3, 0);

        // Act
        await expect(
            BrowsePage({
                searchParams: Promise.resolve(makeQuery({ page: "1e21" })),
            })
        ).rejects.toThrow("NEXT_REDIRECT");

        // Assert — クランプ後の MAX_PAGE で問い合わせ、表示は最終ページへ寄せる
        expect(mockGetProducts).toHaveBeenCalledWith(
            expect.any(Object),
            undefined,
            MAX_PAGE
        );
        expect(parseRedirectUrl().get("page")).toBe("3");
    });

    it("maxPrice=0 は「上限 0」として getProducts へ渡す（未指定に化けない）", async () => {
        // Arrange — 修正前は `Number(maxPrice) || Number.MAX_SAFE_INTEGER` により
        // 0 が falsy で fallback に落ち、「上限 0 の空レンジ」が「上限なし」へ反転して
        // 全件が通っていた。getProducts 側は既に 0 を正しい境界として扱える。
        mockProductsResult(1, 0);

        // Act
        await BrowsePage({
            searchParams: Promise.resolve(makeQuery({ maxPrice: "0" })),
        });

        // Assert
        expect(mockGetProducts).toHaveBeenCalledWith(
            expect.objectContaining({ minPrice: 0, maxPrice: 0 }),
            undefined,
            1
        );
    });

    it("空白のみの maxPrice は上限なしへフォールバックする（0 に化けない）", async () => {
        // Arrange — `Number("   ") === 0` なので、trim を挟まないと空白のみの入力が
        // 「上限 0 の空レンジ」として通り、検索結果が常に空になる。
        mockProductsResult(1, 0);

        // Act
        await BrowsePage({
            searchParams: Promise.resolve(makeQuery({ maxPrice: "   " })),
        });

        // Assert
        expect(mockGetProducts).toHaveBeenCalledWith(
            expect.objectContaining({ maxPrice: Number.MAX_SAFE_INTEGER }),
            undefined,
            1
        );
    });

    it("maxPrice が未指定・非数値なら上限なし（MAX_SAFE_INTEGER）へフォールバックする", async () => {
        // Arrange
        mockProductsResult(1, 0);

        // Act
        await BrowsePage({
            searchParams: Promise.resolve(makeQuery({ maxPrice: "abc" })),
        });

        // Assert
        expect(mockGetProducts).toHaveBeenCalledWith(
            expect.objectContaining({ maxPrice: Number.MAX_SAFE_INTEGER }),
            undefined,
            1
        );
    });
});

// ==================================================
// ?subCategory= の正準化（カテゴリツリー Phase B / plan 067）
// ==================================================
describe("BrowsePage — 旧 ?subCategory= の 308 正準化", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockResolveCategoryNode.mockResolvedValue(null);
    });

    it("?subCategory= を ?category=<正準slug> へ 308 で寄せる", async () => {
        // Arrange —— リネーム済み slug が別名経由で正準ノードへ解決される
        mockResolveCategoryNode.mockImplementation(async (slug: string) =>
            slug === "camera"
                ? {
                      id: "n1",
                      path: "electronics/camera",
                      url: "electronics-camera",
                  }
                : null
        );

        // Act / Assert —— 307 の redirect ではなく 308 の permanentRedirect を使う
        await expect(
            BrowsePage({
                searchParams: Promise.resolve(
                    makeQuery({ subCategory: "camera" })
                ),
            })
        ).rejects.toThrow(
            "NEXT_PERMANENT_REDIRECT:/browse?category=electronics-camera"
        );
        expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("他のクエリパラメータを保ったまま寄せる", async () => {
        // Arrange
        mockResolveCategoryNode.mockImplementation(async (slug: string) =>
            slug === "camera"
                ? { id: "n1", path: "e/camera", url: "camera" }
                : null
        );

        // Act / Assert
        await expect(
            BrowsePage({
                searchParams: Promise.resolve(
                    makeQuery({ subCategory: "camera", sort: "most-popular" })
                ),
            })
        ).rejects.toThrow(
            "NEXT_PERMANENT_REDIRECT:/browse?sort=most-popular&category=camera"
        );
    });

    it("category と subCategory が親子でない場合は寄せない（絞り込みを緩めない）", async () => {
        // Arrange —— 2 つのサブツリーの積は「0 件」。畳むと sub の結果へ化ける。
        mockResolveCategoryNode.mockImplementation(async (slug: string) =>
            slug === "camera"
                ? { id: "n1", path: "electronics/camera", url: "camera" }
                : { id: "n2", path: "toys", url: "toys" }
        );
        mockProductsResult(1);

        // Act
        const page = await BrowsePage({
            searchParams: Promise.resolve(
                makeQuery({ category: "toys", subCategory: "camera" })
            ),
        });
        render(page);

        // Assert
        expect(mockPermanentRedirect).not.toHaveBeenCalled();
        expect(mockGetProducts).toHaveBeenCalledWith(
            expect.objectContaining({
                category: "toys",
                subCategory: "camera",
            }),
            undefined,
            1
        );
        expect(screen.getByTestId("product-list")).toBeInTheDocument();
    });

    it("subCategory が親子関係にあるときは畳む（従来 UI が生成した組み合わせ）", async () => {
        // Arrange
        mockResolveCategoryNode.mockImplementation(async (slug: string) =>
            slug === "camera"
                ? { id: "n1", path: "electronics/camera", url: "camera" }
                : { id: "n2", path: "electronics", url: "electronics" }
        );

        // Act / Assert
        await expect(
            BrowsePage({
                searchParams: Promise.resolve(
                    makeQuery({
                        category: "electronics",
                        subCategory: "camera",
                    })
                ),
            })
        ).rejects.toThrow("NEXT_PERMANENT_REDIRECT:/browse?category=camera");
    });

    it("解決できない category では寄せない（fail-closed の 0 件を sub の結果へ化けさせない）", async () => {
        // Arrange —— category は明示されているが解決できない。これを「未指定」に
        // 丸めて畳むと、getProducts が返すはずの 0 件が sub の結果へ化ける。
        mockResolveCategoryNode.mockImplementation(async (slug: string) =>
            slug === "camera"
                ? { id: "n1", path: "electronics/camera", url: "camera" }
                : null
        );
        mockProductsResult(0);

        // Act
        const page = await BrowsePage({
            searchParams: Promise.resolve(
                makeQuery({ category: "renamed-away", subCategory: "camera" })
            ),
        });
        render(page);

        // Assert
        expect(mockPermanentRedirect).not.toHaveBeenCalled();
        expect(mockGetProducts).toHaveBeenCalledWith(
            expect.objectContaining({
                category: "renamed-away",
                subCategory: "camera",
            }),
            undefined,
            1
        );
    });

    it("category が配列なら寄せない（getProducts と同じ fail-closed 境界）", async () => {
        // Arrange —— `?category=a&category=b` は解決できない指定として扱う。
        mockResolveCategoryNode.mockImplementation(async (slug: string) =>
            slug === "camera"
                ? { id: "n1", path: "electronics/camera", url: "camera" }
                : null
        );
        mockProductsResult(0);

        // Act
        const page = await BrowsePage({
            searchParams: Promise.resolve(
                makeQuery({
                    // Next.js は `?category=a&category=b` で string[] を渡すが、
                    // FiltersQueryType は string 表現。実際の runtime 形を再現する。
                    category: ["toys", "electronics"] as unknown as string,
                    subCategory: "camera",
                })
            ),
        });
        render(page);

        // Assert
        expect(mockPermanentRedirect).not.toHaveBeenCalled();
        expect(mockGetProducts).toHaveBeenCalledWith(
            expect.objectContaining({
                category: ["toys", "electronics"],
                subCategory: "camera",
            }),
            undefined,
            1
        );
    });

    it("解決できない subCategory では寄せず、getProducts の fail-closed に委ねる", async () => {
        // Arrange
        mockResolveCategoryNode.mockResolvedValue(null);
        mockProductsResult(0);

        // Act
        const page = await BrowsePage({
            searchParams: Promise.resolve(
                makeQuery({ subCategory: "missing" })
            ),
        });
        render(page);

        // Assert
        expect(mockPermanentRedirect).not.toHaveBeenCalled();
        expect(mockGetProducts).toHaveBeenCalled();
    });
});
