/** @jest-environment jsdom */
import React from "react";
import {
    render,
    screen,
    waitFor,
    fireEvent,
    act,
} from "@testing-library/react";
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

it("空状態からコレクションを開ける", () => {
    render(<CompareGrid fetchProductsAction={mockedGetProductsByIds} />);
    expect(
        screen.getByRole("link", { name: "Explore the collection" })
    ).toHaveAttribute("href", "/browse");
});

it("取得中は読み上げ可能な状態通知と選択件数を表示する", () => {
    useCompareStore.setState({ items: ["v1", "v2"] });
    mockedGetProductsByIds.mockReturnValue(new Promise(() => {}));
    render(<CompareGrid fetchProductsAction={mockedGetProductsByIds} />);
    expect(screen.getByRole("status")).toHaveTextContent(
        "Loading your selection"
    );
    expect(screen.getByText("2 of 4 selected")).toBeInTheDocument();
});

it("取得失敗を通知し再試行で商品を表示する", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    useCompareStore.setState({ items: ["v1"] });
    mockedGetProductsByIds
        .mockRejectedValueOnce(new Error("offline"))
        .mockResolvedValueOnce({
            products: [createProduct("v1", "Alpha Shirt")],
            totalPages: 1,
        });
    render(<CompareGrid fetchProductsAction={mockedGetProductsByIds} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
        "We couldn’t load your selection"
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Alpha Shirt")).toBeInTheDocument();
    expect(mockedGetProductsByIds).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
});

it("取得できる商品が無いときは選択を保持して案内する", async () => {
    useCompareStore.setState({ items: ["missing"] });
    mockedGetProductsByIds.mockResolvedValue({ products: [], totalPages: 0 });
    render(<CompareGrid fetchProductsAction={mockedGetProductsByIds} />);
    expect(
        await screen.findByText("Your selected pieces are no longer available.")
    ).toBeInTheDocument();
    expect(useCompareStore.getState().items).toEqual(["missing"]);
});

it("最後の商品を消した後に古い取得結果を表示しない", async () => {
    let resolve: (value: {
        products: ProductType[];
        totalPages: number;
    }) => void = () => {};
    useCompareStore.setState({ items: ["v1"] });
    mockedGetProductsByIds.mockReturnValue(
        new Promise((done) => {
            resolve = done;
        })
    );
    render(<CompareGrid fetchProductsAction={mockedGetProductsByIds} />);
    act(() => useCompareStore.getState().clearCompare());
    await act(async () =>
        resolve({
            products: [createProduct("v1", "Late product")],
            totalPages: 1,
        })
    );
    expect(screen.getByTestId("compare-empty")).toBeInTheDocument();
    expect(screen.queryByText("Late product")).not.toBeInTheDocument();
});

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
            {
                url: `/product/slug-${variantId}/variant-${variantId}`,
                image: "/img.jpg",
            },
        ],
    } as unknown as ProductType;
};

beforeEach(() => {
    useCompareStore.setState({ items: [] });
    jest.clearAllMocks();
});

it.each(["Remove from compare", "Clear all"])(
    "%s 後は残る選択見出しへフォーカスを戻す",
    async (name) => {
        useCompareStore.setState({ items: ["v1"] });
        mockedGetProductsByIds.mockResolvedValue({
            products: [createProduct("v1", "Alpha Shirt")],
            totalPages: 1,
        });
        render(<CompareGrid fetchProductsAction={mockedGetProductsByIds} />);
        await screen.findByText("Alpha Shirt");
        const button = screen.getByRole("button", { name });
        button.focus();
        fireEvent.click(button);
        expect(screen.getByTestId("compare-empty")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Your selection" })).toHaveFocus();
    }
);

// T-CMP5 / AC-CMP5
it("items が非空のとき getProductsByIds を呼び商品を描画する", async () => {
    useCompareStore.setState({ items: ["v1", "v2"] });
    mockedGetProductsByIds.mockResolvedValue({
        products: [
            createProduct("v1", "Alpha Shirt"),
            createProduct("v2", "Beta Shoes"),
        ],
        totalPages: 1,
    });

    render(<CompareGrid fetchProductsAction={mockedGetProductsByIds} />);

    await waitFor(() => {
        expect(screen.getByText("Alpha Shirt")).toBeInTheDocument();
    });
    expect(screen.getByText("Beta Shoes")).toBeInTheDocument();
    expect(mockedGetProductsByIds).toHaveBeenCalledWith(["v1", "v2"]);
});

// T-CMP6 / AC-CMP6
it("items が空のとき空状態を表示し getProductsByIds を呼ばない", () => {
    useCompareStore.setState({ items: [] });

    render(<CompareGrid fetchProductsAction={mockedGetProductsByIds} />);

    expect(screen.getByTestId("compare-empty")).toBeInTheDocument();
    expect(mockedGetProductsByIds).not.toHaveBeenCalled();
});

// loading 状態（取得未解決の間はスケルトンを表示）
it("取得完了前は items 件数ぶんのスケルトンを表示する", () => {
    useCompareStore.setState({ items: ["v1", "v2"] });
    // 解決しない Promise で loading=true を維持
    mockedGetProductsByIds.mockReturnValue(new Promise(() => {}));

    const { container } = render(
        <CompareGrid fetchProductsAction={mockedGetProductsByIds} />
    );

    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons).toHaveLength(2);
});

// remove: 個別削除ボタンで該当商品が比較リストから外れる
it("Remove ボタン押下で該当バリアントを比較リストから除去する", async () => {
    useCompareStore.setState({ items: ["v1", "v2"] });
    mockedGetProductsByIds.mockResolvedValue({
        products: [
            createProduct("v1", "Alpha Shirt"),
            createProduct("v2", "Beta Shoes"),
        ],
        totalPages: 1,
    });

    render(<CompareGrid fetchProductsAction={mockedGetProductsByIds} />);
    await waitFor(() => {
        expect(screen.getByText("Alpha Shirt")).toBeInTheDocument();
    });

    // 先頭(v1)の Remove を押下
    fireEvent.click(
        screen.getAllByRole("button", { name: "Remove from compare" })[0]
    );

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

    render(<CompareGrid fetchProductsAction={mockedGetProductsByIds} />);
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
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    useCompareStore.setState({ items: ["v1"] });
    mockedGetProductsByIds.mockRejectedValue(new Error("boom"));

    render(<CompareGrid fetchProductsAction={mockedGetProductsByIds} />);

    await waitFor(() => {
        expect(errorSpy).toHaveBeenCalled();
    });
    expect(screen.queryByText("Alpha Shirt")).not.toBeInTheDocument();

    errorSpy.mockRestore();
});

// error パス（非 Error 値）: instanceof Error でない reject でも Unknown error 分岐でログする
it("getProductsByIds が非 Error を throw したとき Unknown error をログし描画しない", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    useCompareStore.setState({ items: ["v1"] });
    mockedGetProductsByIds.mockRejectedValue("boom"); // 文字列 throw（非 Error）

    render(<CompareGrid fetchProductsAction={mockedGetProductsByIds} />);

    await waitFor(() => {
        expect(errorSpy).toHaveBeenCalledWith("[Compare:fetch] Unknown error", {
            error: "boom",
        });
    });
    expect(screen.queryByText("Alpha Shirt")).not.toBeInTheDocument();

    errorSpy.mockRestore();
});

// 回帰: 画像オブジェクトはあるが画像 URL が空のとき、空 src で Image を描画せず代替表示にする
it("画像 URL が空のとき Image unavailable を表示しリンクは variantImages の url を使う", async () => {
    useCompareStore.setState({ items: ["v1"] });
    const product = createProduct("v1", "Alpha Shirt");
    mockedGetProductsByIds.mockResolvedValue({
        products: [
            { ...product, variantImages: [{ url: "/product/custom", image: "" }] },
        ],
        totalPages: 1,
    });

    render(<CompareGrid fetchProductsAction={mockedGetProductsByIds} />);

    expect(await screen.findByText("Image unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
        screen.getByRole("link", { name: "View Alpha Shirt" })
    ).toHaveAttribute("href", "/product/custom");
});

it("画像が無いときは代替表示とバリアント URL へのリンクを使う", async () => {
    useCompareStore.setState({ items: ["v1"] });
    const product = createProduct("v1", "Alpha Shirt");
    mockedGetProductsByIds.mockResolvedValue({
        products: [{ ...product, variantImages: [] }],
        totalPages: 1,
    });

    render(<CompareGrid fetchProductsAction={mockedGetProductsByIds} />);

    expect(await screen.findByText("Image unavailable")).toBeInTheDocument();
    expect(
        screen.getByRole("link", { name: "View Alpha Shirt" })
    ).toHaveAttribute("href", "/product/slug-v1/variant-v1");
});

it("バリアントが無い商品はカードを描画しない", async () => {
    useCompareStore.setState({ items: ["v1", "v2"] });
    const broken = createProduct("v1", "Alpha Shirt");
    mockedGetProductsByIds.mockResolvedValue({
        products: [{ ...broken, variants: [] }, createProduct("v2", "Beta Shoes")],
        totalPages: 1,
    });

    render(<CompareGrid fetchProductsAction={mockedGetProductsByIds} />);

    expect(await screen.findByText("Beta Shoes")).toBeInTheDocument();
    expect(screen.queryByText("Alpha Shirt")).not.toBeInTheDocument();
});
