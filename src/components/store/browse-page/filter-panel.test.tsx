/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import FilterPanel from "./filter-panel";

describe("FilterPanel", () => {
    it("開閉ボタンとフィルタ領域を関連付ける", () => {
        render(<FilterPanel><div>Category controls</div></FilterPanel>);
        const button = screen.getByRole("button", { name: "Show filters" });
        expect(button).toHaveAttribute("aria-expanded", "false");
        expect(screen.getByText("Category controls")).toBeInTheDocument();

        fireEvent.click(button);
        expect(screen.getByRole("button", { name: "Hide filters" })).toHaveAttribute("aria-expanded", "true");
    });
});
