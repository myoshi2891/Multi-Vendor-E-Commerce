/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProductFilters from "@/components/store/browse-page/filters";
import { FiltersQueryType } from "@/lib/types";
import { getAllCategories } from "@/queries/category";
import { getAllOfferTags } from "@/queries/offer-tag";

/**
 * /browse のフィルタ列（`src/components/store/browse-page/filters.tsx`）。
 *
 * カテゴリツリー Phase B（plan 067）で、カテゴリ取得が「カテゴリ + サブカテゴリの
 * 2 段取得」から `getAllCategories(storeUrl)` の**ツリー 1 本**へ変わった。
 * `storeUrl` の受け渡しが落ちると「店舗ページなのに全店舗のカテゴリが出る」という
 * 静かな絞り込み漏れになるため、配線を特性化して固定する。
 *
 * 子フィルタは各々の責務を持つ別コンポーネントなので、ここでは受け取った props
 * だけを可視化するスタブに差し替える。
 */

jest.mock("@/queries/category", () => ({ getAllCategories: jest.fn() }));
jest.mock("@/queries/offer-tag", () => ({ getAllOfferTags: jest.fn() }));

jest.mock(
    "@/components/store/browse-page/filters/category/category-filter",
    () => ({
        __esModule: true,
        default: ({ categories }: { categories: { id: string }[] }) => (
            <div data-testid="category-filter">
                {categories.map((c) => c.id).join(",")}
            </div>
        ),
    })
);
jest.mock("@/components/store/browse-page/filters/offer/offer-filter", () => ({
    __esModule: true,
    default: ({ offers }: { offers: { id: string }[] }) => (
        <div data-testid="offer-filter">
            {offers.map((o) => o.id).join(",")}
        </div>
    ),
}));
jest.mock("@/components/store/browse-page/filters/size/size-filter", () => ({
    __esModule: true,
    default: ({ storeUrl }: { storeUrl?: string }) => (
        <div data-testid="size-filter">{storeUrl ?? "no-store"}</div>
    ),
}));
jest.mock("@/components/store/browse-page/filters/header", () => ({
    __esModule: true,
    default: ({ queries }: { queries: FiltersQueryType }) => (
        <div data-testid="filters-header">{queries.category}</div>
    ),
}));

const mockGetAllCategories = getAllCategories as jest.MockedFunction<
    typeof getAllCategories
>;
const mockGetAllOfferTags = getAllOfferTags as jest.MockedFunction<
    typeof getAllOfferTags
>;

const queries = (overrides: Partial<FiltersQueryType> = {}): FiltersQueryType =>
    ({
        search: "",
        category: "electronics",
        subCategory: "",
        offer: "",
        size: "",
        sort: "",
        minPrice: "",
        maxPrice: "",
        color: "",
        ...overrides,
    }) as FiltersQueryType;

describe("ProductFilters — フィルタ列の配線", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetAllCategories.mockResolvedValue([
            { id: "cat-1" },
        ] as unknown as Awaited<ReturnType<typeof getAllCategories>>);
        mockGetAllOfferTags.mockResolvedValue([
            { id: "offer-1" },
        ] as unknown as Awaited<ReturnType<typeof getAllOfferTags>>);
    });

    it("正常系: カテゴリツリーとオファータグを各フィルタへ渡す", async () => {
        // Arrange / Act
        render(await ProductFilters({ queries: queries() }));

        // Assert
        expect(screen.getByTestId("category-filter")).toHaveTextContent(
            "cat-1"
        );
        expect(screen.getByTestId("offer-filter")).toHaveTextContent("offer-1");
        expect(screen.getByTestId("filters-header")).toHaveTextContent(
            "electronics"
        );
    });

    it("正常系: storeUrl を両クエリと SizeFilter へ伝播する", async () => {
        // Arrange / Act
        render(
            await ProductFilters({ queries: queries(), storeUrl: "my-store" })
        );

        // Assert —— 店舗ページでは店舗スコープの絞り込みが必須
        expect(mockGetAllCategories).toHaveBeenCalledWith("my-store");
        expect(mockGetAllOfferTags).toHaveBeenCalledWith("my-store");
        expect(screen.getByTestId("size-filter")).toHaveTextContent("my-store");
    });

    it("エッジケース: storeUrl 未指定なら undefined のまま渡す（全店舗スコープ）", async () => {
        // Arrange / Act
        render(await ProductFilters({ queries: queries() }));

        // Assert
        expect(mockGetAllCategories).toHaveBeenCalledWith(undefined);
        expect(mockGetAllOfferTags).toHaveBeenCalledWith(undefined);
        expect(screen.getByTestId("size-filter")).toHaveTextContent("no-store");
    });
});
