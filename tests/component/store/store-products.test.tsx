/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { FiltersQueryType, ProductType } from "@/lib/types";

jest.mock("@/queries/product", () => ({
    getProducts: jest.fn(),
}));
jest.mock("@/components/store/shared/product-list", () => ({
    __esModule: true,
    default: ({ products }: { products: ProductType[] }) => (
        <ul data-testid="product-list">{products.length}</ul>
    ),
}));
jest.mock("@/components/store/browse-page/sort", () => ({
    __esModule: true,
    default: () => <div data-testid="product-sort" />,
}));

import { getProducts } from "@/queries/product";
import StoreProducts from "@/components/store/store-page/store-products";

const mockedGetProducts = jest.mocked(getProducts);

const createProducts = (count: number): ProductType[] =>
    Array.from({ length: count }, (_, index) => ({ id: `p${index}` }) as unknown as ProductType);

// 実行時の searchParams は一部キーのみ・size が配列の場合があるため、部分オブジェクトを unknown 経由で渡す
const renderStoreProducts = async (searchParams: Record<string, string | string[]>) => {
    render(await StoreProducts({ searchParams: searchParams as unknown as FiltersQueryType, store: "acme" }));
};

beforeEach(() => {
    jest.clearAllMocks();
});

it("単一の size を配列に正規化し店舗で絞り込んで取得する", async () => {
    // Arrange
    mockedGetProducts.mockResolvedValue({ products: createProducts(1) } as Awaited<ReturnType<typeof getProducts>>);

    // Act
    await renderStoreProducts({ size: "M", sort: "newest" });

    // Assert
    expect(mockedGetProducts).toHaveBeenCalledWith(
        expect.objectContaining({ size: ["M"], store: "acme" }),
        "newest",
        1,
        100
    );
    expect(screen.getByText("/ 1 PIECE")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 piece found.");
    expect(screen.getByTestId("product-list")).toBeInTheDocument();
});

it("配列の size はそのまま渡し、複数件は PIECES と読み上げる", async () => {
    mockedGetProducts.mockResolvedValue({ products: createProducts(3) } as Awaited<ReturnType<typeof getProducts>>);

    await renderStoreProducts({ size: ["S", "L"] });

    expect(mockedGetProducts).toHaveBeenCalledWith(
        expect.objectContaining({ size: ["S", "L"] }),
        undefined,
        1,
        100
    );
    expect(screen.getByText("/ 3 PIECES")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("3 pieces found.");
});

it("0 件のときは常設 status の文言を更新し、空状態から絞り込みを解除できる", async () => {
    mockedGetProducts.mockResolvedValue({ products: [] } as unknown as Awaited<ReturnType<typeof getProducts>>);

    await renderStoreProducts({});

    expect(mockedGetProducts).toHaveBeenCalledWith(
        expect.objectContaining({ size: undefined }),
        undefined,
        1,
        100
    );
    // status は 1 つだけ（空状態の段落は status を持たない）
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("No pieces match these filters.");
    expect(screen.queryByTestId("product-list")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Clear filters/ })).toHaveAttribute("href", "/store/acme#collection");
});
