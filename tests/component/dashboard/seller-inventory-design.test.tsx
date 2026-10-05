/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import Page from "@/app/dashboard/seller/stores/[storeUrl]/inventory/page";
import ModalProvider from "@/providers/modal-provider";
import { getStoreInventory } from "@/queries/inventory";
jest.mock("@/lib/auth-guards", () => ({
    requireStoreOwner: jest.fn(async () => ({
        store: { lowStockThreshold: 5 },
    })),
}));
jest.mock("@/queries/inventory", () => ({
    getStoreInventory: jest.fn(async () => []),
    updateSizeStock: jest.fn(),
    updateStoreLowStockThreshold: jest.fn(),
}));
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn() }),
}));
it("shows the inventory heading, summary, threshold and labeled table search", async () => {
    render(
        <ModalProvider>
            {await Page({ params: Promise.resolve({ storeUrl: "example" }) })}
        </ModalProvider>
    );
    expect(
        screen.getByRole("heading", { name: "Inventory" })
    ).toBeInTheDocument();
    expect(
        screen.getByRole("searchbox", { name: "Search product ..." })
    ).toBeInTheDocument();
    expect(
        screen.getByRole("spinbutton", { name: "過小在庫しきい値" })
    ).toHaveValue(5);
});
it("distinguishes a lookup failure from a zero-stock store", async () => {
    jest.mocked(getStoreInventory).mockRejectedValueOnce(
        new Error("private database failure")
    );
    render(
        <ModalProvider>
            {await Page({ params: Promise.resolve({ storeUrl: "example" }) })}
        </ModalProvider>
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Please try again");
    expect(screen.queryByText("No Results.")).not.toBeInTheDocument();
});
