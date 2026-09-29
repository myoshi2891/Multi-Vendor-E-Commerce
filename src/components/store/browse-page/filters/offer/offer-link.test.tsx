/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import OfferLink from "./offer-link";

const replace = jest.fn();
jest.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams("category=jewelry"),
    usePathname: () => "/browse",
    useRouter: () => ({ replace }),
}));

describe("OfferLink", () => {
    it("キーボードで操作できるボタンから既存条件を保持して絞り込む", () => {
        render(<OfferLink offer={{ id: "offer-1", name: "Special offer", url: "special" } as never} />);
        const button = screen.getByRole("button", { name: "Special offer" });
        fireEvent.click(button);
        expect(replace).toHaveBeenCalledWith("/browse?category=jewelry&offer=special");
    });
});
