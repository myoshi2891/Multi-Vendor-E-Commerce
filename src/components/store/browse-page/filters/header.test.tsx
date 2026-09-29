/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import FiltersHeader from "./header";
import { FiltersQueryType } from "@/lib/types";

jest.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/browse",
    useRouter: () => ({ replace: jest.fn() }),
}));

describe("FiltersHeader", () => {
    it("未指定のクエリをアクティブなフィルタとして数えない", () => {
        render(<FiltersHeader queries={{ category: undefined, offer: undefined, size: undefined, sort: "most-popular" } as unknown as FiltersQueryType} />);
        expect(screen.getByText("Filter (0)")).toBeInTheDocument();
        expect(screen.queryByText("Clear All")).not.toBeInTheDocument();
    });

    it("長いカテゴリの削除チップをフィルタ幅の中に収める", () => {
        const category = "e2e-pagination-subcategory-webkit-w0";
        render(<FiltersHeader queries={{ category } as unknown as FiltersQueryType} />);
        const chip = screen.getByRole("button", { name: `Remove category ${category}` });
        expect(chip).toHaveClass("max-w-full");
        expect(chip.querySelector("span")).toHaveClass("break-all");
    });
});
