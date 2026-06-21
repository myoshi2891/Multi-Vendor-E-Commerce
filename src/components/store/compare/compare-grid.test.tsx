/** @jest-environment jsdom */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { ProductType } from "@/lib/types";
import { useCompareStore } from "@/compare-store/useCompareStore";

// getProductsByIds をモック化（Clerk 等のロードを避けつつ呼び出しを検証）
jest.mock("@/queries/product", () => ({
    getProductsByIds: jest.fn(),
}));

import { getProductsByIds } from "@/queries/product";
import CompareGrid from "./compare-grid";

const mockedGetProductsByIds = jest.mocked(getProductsByIds);

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
                images: [{ url: "/img.jpg" }],
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
            { url: `/product/slug-${variantId}/variant-${variantId}`, image: "/img.jpg" },
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

// loading 状態（取得未解決の間はスケルトンを表示）
it("取得完了前は items 件数ぶんのスケルトンを表示する", () => {
    useCompareStore.setState({ items: ["v1", "v2"] });
    // 解決しない Promise で loading=true を維持
    mockedGetProductsByIds.mockReturnValue(new Promise(() => {}));

    const { container } = render(<CompareGrid />);

    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons).toHaveLength(2);
});

// remove: 個別削除ボタンで該当商品が比較リストから外れる
it("Remove ボタン押下で該当バリアントを比較リストから除去する", async () => {
    useCompareStore.setState({ items: ["v1", "v2"] });
    mockedGetProductsByIds.mockResolvedValue({
        products: [createProduct("v1", "Alpha Shirt"), createProduct("v2", "Beta Shoes")],
        totalPages: 1,
    });

    render(<CompareGrid />);
    await waitFor(() => {
        expect(screen.getByText("Alpha Shirt")).toBeInTheDocument();
    });

    // 先頭(v1)の Remove を押下
    fireEvent.click(screen.getAllByRole("button", { name: "Remove from compare" })[0]);

    await waitFor(() => {
        expect(useCompareStore.getState().items).toEqual(["v2"]);
    });
});

// clear all: 全削除で空状態に戻る
it("Clear all 押下で比較リストを空にし空状態を表示する", async () => {
    useCompareStore.setState({ items: ["v1"] });
    mockedGetProductsByIds.mockResolvedValue({
        products: [createProduct("v1", "Alpha Shirt")],
        totalPages: 1,
    });

    render(<CompareGrid />);
    await waitFor(() => {
        expect(screen.getByText("Alpha Shirt")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));

    await waitFor(() => {
        expect(useCompareStore.getState().items).toEqual([]);
        expect(screen.getByTestId("compare-empty")).toBeInTheDocument();
    });
});

// error パス: getProductsByIds が reject したとき商品を描画しない（catch 分岐）
it("getProductsByIds が失敗したとき商品を描画しない", async () => {
    const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
    useCompareStore.setState({ items: ["v1"] });
    mockedGetProductsByIds.mockRejectedValue(new Error("boom"));

    render(<CompareGrid />);

    await waitFor(() => {
        expect(errorSpy).toHaveBeenCalled();
    });
    expect(screen.queryByText("Alpha Shirt")).not.toBeInTheDocument();

    errorSpy.mockRestore();
});

// error パス（非 Error 値）: instanceof Error でない reject でも Unknown error 分岐でログする
it("getProductsByIds が非 Error を throw したとき Unknown error をログし描画しない", async () => {
    const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
    useCompareStore.setState({ items: ["v1"] });
    mockedGetProductsByIds.mockRejectedValue("boom"); // 文字列 throw（非 Error）

    render(<CompareGrid />);

    await waitFor(() => {
        expect(errorSpy).toHaveBeenCalledWith("[Compare:fetch] Unknown error", {
            error: "boom",
        });
    });
    expect(screen.queryByText("Alpha Shirt")).not.toBeInTheDocument();

    errorSpy.mockRestore();
});
