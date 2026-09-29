/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import FiltersHeader from "./header";
import { FiltersQueryType } from "@/lib/types";

const replace = jest.fn();
let mockSearch = "";
jest.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(mockSearch),
    usePathname: () => "/browse",
    useRouter: () => ({ replace }),
}));

describe("FiltersHeader", () => {
    beforeEach(() => {
        replace.mockClear();
        mockSearch = "";
    });

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

    it("null・空文字・空配列のクエリを数えず、配列は要素数で数える", () => {
        render(<FiltersHeader queries={{ category: null, search: "", size: [], offer: ["sale", "new"] } as unknown as FiltersQueryType} />);
        expect(screen.getByText("Filter (2)")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Remove category/ })).not.toBeInTheDocument();
    });

    it("配列クエリのチップは該当値だけを取り除く", () => {
        // Arrange
        mockSearch = "offer=sale&offer=new&category=rings";
        render(<FiltersHeader queries={{ offer: ["sale", "new"], category: "rings" } as unknown as FiltersQueryType} />);

        // Act
        fireEvent.click(screen.getByRole("button", { name: "Remove offer sale" }));

        // Assert
        expect(replace).toHaveBeenCalledWith("/browse?category=rings&offer=new");
    });

    it("単一値クエリのチップはクエリごと取り除く", () => {
        mockSearch = "category=rings&sort=most-popular";
        render(<FiltersHeader queries={{ category: "rings", sort: "most-popular" } as unknown as FiltersQueryType} />);

        fireEvent.click(screen.getByRole("button", { name: "Remove category rings" }));

        expect(replace).toHaveBeenCalledWith("/browse?sort=most-popular");
    });

    it("Clear All ですべてのクエリを外す", () => {
        mockSearch = "category=rings&offer=sale";
        render(<FiltersHeader queries={{ category: "rings", offer: ["sale"] } as unknown as FiltersQueryType} />);

        fireEvent.click(screen.getByRole("button", { name: "Clear All" }));

        expect(replace).toHaveBeenCalledWith("/browse");
    });
});
