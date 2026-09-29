/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import CategoryFilter from "./category-filter";

jest.mock("./category-link", () => ({
    __esModule: true,
    default: () => <div>Category choices</div>,
}));

describe("CategoryFilter", () => {
    it("見出しボタンでカテゴリ一覧を開閉する", () => {
        render(<CategoryFilter categories={[{ id: "cat-1" } as never]} />);
        const button = screen.getByRole("button", { name: "Category" });
        expect(button).toHaveAttribute("aria-expanded", "true");
        fireEvent.click(button);
        expect(button).toHaveAttribute("aria-expanded", "false");
        expect(screen.getByText("Category choices").parentElement).toHaveClass("hidden");
    });
});
