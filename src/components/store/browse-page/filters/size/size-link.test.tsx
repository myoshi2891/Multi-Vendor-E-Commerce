/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import SizeLink from "./size-link";

const replace = jest.fn();
jest.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams("category=jewelry"),
    usePathname: () => "/browse",
    useRouter: () => ({ replace }),
}));

describe("SizeLink", () => {
    it("サイズをボタンで選び、元のカテゴリ条件を保持する", () => {
        render(<SizeLink size="M" />);
        const button = screen.getByRole("button", { name: "M" });
        expect(button).toHaveAttribute("aria-pressed", "false");
        fireEvent.click(button);
        expect(replace).toHaveBeenCalledWith("/browse?category=jewelry&size=M", { scroll: false });
    });
});
