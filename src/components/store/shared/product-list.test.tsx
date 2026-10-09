/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProductList from "./product-list";
import { ProductType } from "@/lib/types";
import { createMockProduct } from "@/config/test-fixtures";

// Mock ProductCard to keep list testing focused
jest.mock("../cards/product/product-card", () => {
    return function DummyProductCard({ product }: { product: ProductType }) {
        return <div data-testid="dummy-product-card">{product.name}</div>;
    };
});

// Mock ChevronRight
jest.mock("lucide-react", () => ({
    ChevronRight: () => <span data-testid="chevron-right">Arrow</span>,
}));

const mockProducts: ProductType[] = [
    {
        ...createMockProduct({ id: "p1", name: "Product A" }),
        variants: [],
        variantImages: [],
    },
    {
        ...createMockProduct({ id: "p2", name: "Product B" }),
        variants: [],
        variantImages: [],
    },
];

describe("ProductList Component", () => {
    it("renders products when list is not empty", () => {
        render(<ProductList products={mockProducts} />);
        expect(screen.getByText("Product A")).toBeInTheDocument();
        expect(screen.getByText("Product B")).toBeInTheDocument();
        expect(screen.queryByText("No Products")).not.toBeInTheDocument();
    });

    it("renders fallback message when list is empty", () => {
        render(<ProductList products={[]} />);
        expect(screen.getByText("No Products")).toBeInTheDocument();
    });

    it("editorial 表示で商品がないときは案内と一覧へのリンクを表示する", () => {
        render(<ProductList products={[]} variant="editorial" />);
        expect(screen.getByText("No pieces found in this edit.")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Explore all pieces" })).toHaveAttribute("href", "/browse");
    });

    it("editorial 表示は常設の status 出力を保ち、絞り込みで 0 件になったときに文言を更新する", () => {
        // Arrange
        const { rerender } = render(<ProductList products={mockProducts} variant="editorial" />);
        const status = screen.getByRole("status");
        expect(status).toHaveClass("sr-only");
        expect(status).toBeEmptyDOMElement();

        // Act
        rerender(<ProductList products={[]} variant="editorial" />);

        // Assert: 新規マウントではなく同一ノードの文言更新で告知される
        expect(screen.getByRole("status")).toBe(status);
        expect(status).toHaveTextContent("No pieces match these filters.");
    });

    it("editorial 以外では status 出力を置かない", () => {
        render(<ProductList products={[]} />);
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("title が無い editorial グリッドには上余白を付けない", () => {
        const { container } = render(<ProductList products={mockProducts} variant="editorial" />);
        const grid = container.querySelector(".grid");
        expect(grid).not.toHaveClass("mt-2");
    });

    it("renders title with no link", () => {
        render(<ProductList products={mockProducts} title="Hot Deals" />);
        const heading = screen.getByRole("heading", { name: /Hot Deals/i });
        expect(heading).toBeInTheDocument();
        expect(heading.closest("a")).toBeNull();
    });

    it("renders title wrapped in a link when link prop is provided", () => {
        render(<ProductList products={mockProducts} title="Hot Deals" link="/deals" />);
        const heading = screen.getByRole("heading", { name: /Hot Deals/i });
        expect(heading).toBeInTheDocument();
        const link = heading.closest("a");
        expect(link).toHaveAttribute("href", "/deals");
    });

    it("renders arrow icon when arrow prop is true", () => {
        render(<ProductList products={mockProducts} title="Hot Deals" arrow={true} />);
        expect(screen.getByTestId("chevron-right")).toBeInTheDocument();
    });

    it("does not render arrow icon when arrow prop is false", () => {
        render(<ProductList products={mockProducts} title="Hot Deals" arrow={false} />);
        expect(screen.queryByTestId("chevron-right")).not.toBeInTheDocument();
    });

    it("link 付きタイトルでも arrow を表示する", () => {
        render(<ProductList products={mockProducts} title="Hot Deals" link="/deals" arrow />);
        expect(screen.getByRole("link")).toContainElement(screen.getByTestId("chevron-right"));
    });

    it("同一商品の別バリアント（閲覧履歴）を並べても key が重複しない", () => {
        // Arrange —— 閲覧履歴はバリアント単位なので、同じ商品 ID のカードが 2 枚になりうる
        const base = createMockProduct({ id: "p1", name: "Ring" });
        const variantOf = (variantId: string): ProductType => ({
            ...base,
            variants: [{ variantId, variantSlug: variantId, variantName: variantId, images: [], sizes: [] }],
            variantImages: [],
        });
        const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

        // Act
        render(<ProductList products={[variantOf("v-gold"), variantOf("v-silver")]} variant="editorial" />);

        // Assert
        expect(screen.getAllByTestId("dummy-product-card")).toHaveLength(2);
        const keyWarnings = consoleError.mock.calls.filter((args) =>
            args.some((arg) => typeof arg === "string" && arg.includes("same key"))
        );
        expect(keyWarnings).toHaveLength(0);
        consoleError.mockRestore();
    });
});
