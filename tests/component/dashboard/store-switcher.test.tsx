/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StoreSwitcher from "@/components/dashboard/sidebar/store-switcher";

const push = jest.fn();
jest.mock("next/navigation", () => ({
    useParams: () => ({ storeUrl: "beta" }),
    useRouter: () => ({ push }),
}));

// cmdk は選択中アイテムを scrollIntoView するが jsdom は未実装
beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn();
});
beforeEach(() => push.mockClear());

const stores = [
    { name: "Alpha Store", url: "alpha" },
    { name: "Beta Store", url: "beta" },
];

describe("StoreSwitcher", () => {
    it("shows the active store and navigates to the selected store", async () => {
        // Arrange
        const user = userEvent.setup();
        render(<StoreSwitcher stores={stores} design="seller" />);
        const trigger = screen.getByRole("combobox", {
            name: "Select a store",
        });
        expect(trigger).toHaveTextContent("Beta Store");

        // Act
        await user.click(trigger);
        await user.click(screen.getByRole("option", { name: "Alpha Store" }));

        // Assert
        expect(push).toHaveBeenCalledWith("/dashboard/seller/stores/alpha");
        expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    it("navigates to store creation from the popover", async () => {
        const user = userEvent.setup();
        render(<StoreSwitcher stores={stores} />);
        await user.click(
            screen.getByRole("combobox", { name: "Select a store" })
        );
        await user.click(screen.getByRole("option", { name: /Create Store/ }));
        expect(push).toHaveBeenCalledWith("/dashboard/seller/stores/new");
    });
});
