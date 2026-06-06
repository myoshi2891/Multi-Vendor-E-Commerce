/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProductList from "./product-list";
import { ProductType } from "@/lib/types";

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

const mockProducts = [
    { id: "p1", name: "Product A" },
    { id: "p2", name: "Product B" },
] as unknown as ProductType[];

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
});
