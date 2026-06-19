/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { StoreTopProducts } from "@/components/dashboard/seller/store-top-products";
import type { getStoreTopProducts } from "@/queries/store-dashboard";

type StoreTopProduct = Awaited<
    ReturnType<typeof getStoreTopProducts>
>[number];

// F1 販売上位商品: Product 行から商品名と販売数を描画し、空配列ではゼロ件文言を
// 出すことを検証する（AC-F1-5）。コンポーネントは id/name/sales のみ参照するため、
// 最小限のフィールドを持つ行を unknown 経由でキャストする（any 禁止）。
describe("StoreTopProducts", () => {
    function makeProduct(
        id: string,
        name: string,
        sales: number
    ): StoreTopProduct {
        return { id, name, sales } as unknown as StoreTopProduct;
    }

    it("renders product name and sales count", () => {
        // Arrange
        const products = [
            makeProduct("p1", "Luxury Watch", 1234),
            makeProduct("p2", "Silk Scarf", 56),
        ];

        // Act
        render(<StoreTopProducts products={products} />);

        // Assert
        expect(screen.getByText("Luxury Watch")).toBeInTheDocument();
        expect(screen.getByText("1,234 件販売")).toBeInTheDocument();
        expect(screen.getByText("Silk Scarf")).toBeInTheDocument();
    });

    it("renders an empty-state message when there are no products (AC-F1-5)", () => {
        // Arrange / Act
        render(<StoreTopProducts products={[]} />);

        // Assert
        expect(screen.getByText("商品がありません。")).toBeInTheDocument();
    });
});
