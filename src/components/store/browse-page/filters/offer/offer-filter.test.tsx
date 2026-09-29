/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { OfferTag } from "@prisma/client";
import OfferFilter from "./offer-filter";

jest.mock("./offer-link", () => ({
    __esModule: true,
    default: ({ offer }: { offer: OfferTag }) => <span data-testid="offer-link">{offer.name}</span>,
}));

const offers: OfferTag[] = [
    { id: "o1", name: "Sale", url: "sale", createdAt: new Date(), updatedAt: new Date() },
    { id: "o2", name: "New", url: "new", createdAt: new Date(), updatedAt: new Date() },
];

describe("OfferFilter", () => {
    it("初期表示ではパネルを開き、見出しボタンがパネルを制御する", () => {
        // Arrange & Act
        render(<OfferFilter offers={offers} />);

        // Assert
        const toggle = screen.getByRole("button", { name: "Offer" });
        expect(toggle).toHaveAttribute("aria-expanded", "true");
        const panel = document.getElementById(toggle.getAttribute("aria-controls") ?? "");
        expect(panel).not.toHaveClass("hidden");
        expect(screen.getAllByTestId("offer-link")).toHaveLength(2);
    });

    it("見出しボタンでパネルを閉じ、再度押すと開く", () => {
        // Arrange
        render(<OfferFilter offers={offers} />);
        const toggle = screen.getByRole("button", { name: "Offer" });
        const panel = document.getElementById(toggle.getAttribute("aria-controls") ?? "");

        // Act & Assert
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        expect(panel).toHaveClass("hidden");

        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute("aria-expanded", "true");
        expect(panel).not.toHaveClass("hidden");
    });
});
