/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { ProductType } from "@/lib/types";
import { useCompareStore } from "@/compare-store/useCompareStore";

// --- 依存のモック ---
// Clerk を巻き込まないよう server モジュールを空にする
jest.mock("@clerk/nextjs/server", () => ({}));

// wishlist サーバーアクション
jest.mock("@/queries/user", () => ({
    addToWishlist: jest.fn(),
}));

// react-hot-toast: default は callable（toast("...")）かつ success/error を持つ
jest.mock("react-hot-toast", () => {
    const toast = Object.assign(jest.fn(), {
        success: jest.fn(),
        error: jest.fn(),
    });
    return { __esModule: true, default: toast };
});

// 子コンポーネントは描画ノイズ・next/navigation 依存を避けて軽量スタブに置換
jest.mock("./swiper", () => ({
    __esModule: true,
    default: () => <div data-testid="swiper" />,
}));
jest.mock("./variant-switcher", () => ({
    __esModule: true,
    default: () => <div data-testid="variant-switcher" />,
}));
jest.mock("@/components/store/product-page/product-info/product-price", () => ({
    __esModule: true,
    default: () => <div data-testid="product-price" />,
}));
jest.mock("react-rating-stars-component", () => ({
    __esModule: true,
    default: ({ value }: { value: number }) => (
        <span data-testid="stars">{value}</span>
    ),
}));

import { addToWishlist } from "@/queries/user";
import toast from "react-hot-toast";
import ProductCard from "./product-card";

const mockedAddToWishlist = jest.mocked(addToWishlist);
const mockedToast = jest.mocked(toast);

/**
 * ProductCard が参照する最小フィールドを満たす ProductType モックを生成する。
 * Prisma 由来の完全な Size 型を列挙しないため unknown 経由でキャストする（any は使わない）。
 */
const createProduct = (
    variantId: string,
    overrides: Partial<{ rating: number; sales: number }> = {}
): ProductType => {
    return {
        id: `product-${variantId}`,
        slug: `slug-${variantId}`,
        name: "Alpha Shirt",
        rating: overrides.rating ?? 4.5,
        sales: overrides.sales ?? 12,
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

describe("ProductCard", () => {
    // 基本描画
    it("商品名とバリアント名を描画する", () => {
        // Arrange & Act
        render(<ProductCard product={createProduct("v1")} />);

        // Assert
        expect(screen.getByText(/Alpha Shirt/)).toBeInTheDocument();
        expect(screen.getByText(/Black/)).toBeInTheDocument();
    });

    // rating 条件: rating>0 && sales>0
    it("rating>0 かつ sales>0 のときレーティングを表示する", () => {
        render(<ProductCard product={createProduct("v1", { rating: 4.5, sales: 12 })} />);
        expect(screen.getByTestId("stars")).toBeInTheDocument();
        expect(screen.getByText(/12 sold/)).toBeInTheDocument();
    });

    it("sales が 0 のときレーティングを表示しない", () => {
        render(<ProductCard product={createProduct("v1", { rating: 4.5, sales: 0 })} />);
        expect(screen.queryByTestId("stars")).not.toBeInTheDocument();
    });

    // compare トグル: 未追加 → 追加
    it("未比較状態でボタン押下すると追加し success トーストを出す", () => {
        // Arrange
        render(<ProductCard product={createProduct("v1")} />);
        const btn = screen.getByRole("button", { name: "Add to compare" });
        expect(btn).toHaveAttribute("aria-pressed", "false");

        // Act
        fireEvent.click(btn);

        // Assert
        expect(useCompareStore.getState().items).toContain("v1");
        expect(mockedToast.success).toHaveBeenCalledWith("Added to compare");
    });

    // compare トグル: 追加済み → 削除
    it("比較済み状態でボタン押下すると削除し Removed トーストを出す", () => {
        // Arrange
        useCompareStore.setState({ items: ["v1"] });
        render(<ProductCard product={createProduct("v1")} />);
        const btn = screen.getByRole("button", { name: "Remove from compare" });
        expect(btn).toHaveAttribute("aria-pressed", "true");

        // Act
        fireEvent.click(btn);

        // Assert
        expect(useCompareStore.getState().items).not.toContain("v1");
        expect(mockedToast).toHaveBeenCalledWith("Removed from compare");
    });

    // compare トグル: 上限到達
    it("比較リストが上限(4)のとき追加せず error トーストを出す", () => {
        // Arrange: 別 ID で 4 件埋める
        useCompareStore.setState({ items: ["a", "b", "c", "d"] });
        render(<ProductCard product={createProduct("v1")} />);

        // Act
        fireEvent.click(screen.getByRole("button", { name: "Add to compare" }));

        // Assert
        expect(useCompareStore.getState().items).not.toContain("v1");
        expect(mockedToast.error).toHaveBeenCalledWith(
            "Compare list is full (max 4)"
        );
    });

    // wishlist 成功
    it("wishlist 追加に成功すると success トーストを出す", async () => {
        // Arrange
        mockedAddToWishlist.mockResolvedValue(
            true as unknown as Awaited<ReturnType<typeof addToWishlist>>
        );
        render(<ProductCard product={createProduct("v1")} />);

        // Act: Heart ボタンは aria-label/テキストを持たないため空アクセシブル名で特定
        fireEvent.click(getWishlistButton());

        // Assert
        await waitFor(() => {
            expect(mockedToast.success).toHaveBeenCalledWith(
                "Product successfully added to wishlist"
            );
        });
    });

    // wishlist 失敗（catch 分岐）
    it("wishlist 追加が失敗すると error トーストを出す", async () => {
        // Arrange
        mockedAddToWishlist.mockRejectedValue(new Error("nope"));
        render(<ProductCard product={createProduct("v1")} />);

        // Act
        fireEvent.click(getWishlistButton());

        // Assert
        await waitFor(() => {
            expect(mockedToast.error).toHaveBeenCalled();
        });
    });
});

/**
 * wishlist（Heart）ボタンを特定する。アクションボタンは「Add to cart」(テキスト)、
 * wishlist(無ラベル)、compare(aria-label) の3つ。wishlist のみ aria-label が無く
 * かつテキストを持たないため、その条件で一意に取得できる。
 */
function getWishlistButton(): HTMLElement {
    const buttons = screen.getAllByRole("button");
    const wishlistBtn = buttons.find(
        (b) => !b.getAttribute("aria-label") && !b.textContent?.trim()
    );
    if (!wishlistBtn) throw new Error("wishlist button not found");
    return wishlistBtn;
}
