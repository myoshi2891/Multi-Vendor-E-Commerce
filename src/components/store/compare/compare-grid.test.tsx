/** @jest-environment jsdom */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { ProductType } from "@/lib/types";
import { useCompareStore } from "@/compare-store/useCompareStore";

// getProductsByIds をモック化（Clerk 等のロードを避けつつ呼び出しを検証）
jest.mock("@/queries/product", () => ({
    getProductsByIds: jest.fn(),
}));

import { getProductsByIds } from "@/queries/product";
import CompareGrid from "./compare-grid";

const mockedGetProductsByIds = getProductsByIds as jest.MockedFunction<
    typeof getProductsByIds
>;

/**
 * 比較グリッドが描画する最小限のフィールドを満たす ProductType モックを生成する。
 * Prisma 由来の完全な Size 型を列挙しないため unknown 経由でキャストする（any は使わない）。
 */
const createProduct = (variantId: string, name: string): ProductType => {
    return {
        id: `product-${variantId}`,
        slug: `slug-${variantId}`,
        name,
        rating: 4.5,
        sales: 12,
        numReviews: 3,
        variants: [
            {
                variantId,
                variantSlug: `variant-${variantId}`,
                variantName: "Black",
                images: [{ url: "img.jpg" }],
                sizes: [
                    {
                        id: `size-${variantId}`,
                        size: "M",
                        quantity: 10,
                        price: 29.99,
                        discount: 0,
                    },
                ],
            },
        ],
        variantImages: [
            { url: `/product/slug-${variantId}/variant-${variantId}`, image: "img.jpg" },
        ],
    } as unknown as ProductType;
};

beforeEach(() => {
    useCompareStore.setState({ items: [] });
    jest.clearAllMocks();
});

// T-CMP5 / AC-CMP5
it("items が非空のとき getProductsByIds を呼び商品を描画する", async () => {
    useCompareStore.setState({ items: ["v1", "v2"] });
    mockedGetProductsByIds.mockResolvedValue({
        products: [createProduct("v1", "Alpha Shirt"), createProduct("v2", "Beta Shoes")],
        totalPages: 1,
    });

    render(<CompareGrid />);

    await waitFor(() => {
        expect(screen.getByText("Alpha Shirt")).toBeInTheDocument();
    });
    expect(screen.getByText("Beta Shoes")).toBeInTheDocument();
    expect(mockedGetProductsByIds).toHaveBeenCalledWith(["v1", "v2"]);
});

// T-CMP6 / AC-CMP6
it("items が空のとき空状態を表示し getProductsByIds を呼ばない", () => {
    useCompareStore.setState({ items: [] });

    render(<CompareGrid />);

    expect(screen.getByTestId("compare-empty")).toBeInTheDocument();
    expect(mockedGetProductsByIds).not.toHaveBeenCalled();
});
