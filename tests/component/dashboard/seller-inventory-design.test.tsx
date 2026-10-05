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

// router.refresh() delivers the saved quantity/threshold as new props; editors
// must not remount (which would clear the success status).
import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SellerInventory from "@/components/dashboard/seller/seller-inventory";
import type { StoreInventoryRow } from "@/lib/types";
it("keeps success statuses when refreshed props carry the saved values", async () => {
    // Arrange
    const user = userEvent.setup();
    const row = {
        sizeId: "s1",
        productName: "Shoe",
        variantName: "Red",
        size: "M",
        quantity: 3,
        price: 10,
    } as unknown as StoreInventoryRow;
    const props = {
        storeUrl: "example",
        updateStockAction: jest.fn().mockResolvedValue({}),
        updateThresholdAction: jest.fn().mockResolvedValue({}),
    };
    const { rerender } = render(
        <ModalProvider>
            <SellerInventory {...props} rows={[row]} threshold={5} />
        </ModalProvider>
    );

    // Act
    const stock = screen.getByRole("group", { name: "在庫数の編集" });
    await user.clear(within(stock).getByRole("spinbutton"));
    await user.type(within(stock).getByRole("spinbutton"), "7");
    await user.click(within(stock).getByRole("button", { name: "保存" }));
    rerender(
        <ModalProvider>
            <SellerInventory
                {...props}
                updateStockAction={jest.fn().mockResolvedValue({})}
                rows={[{ ...row, quantity: 7 }]}
                threshold={5}
            />
        </ModalProvider>
    );

    // Assert
    expect(props.updateStockAction).toHaveBeenCalledWith("s1", 7, "example");
    expect(screen.getByText("在庫数を更新しました")).toBeInTheDocument();
});
it("keeps the threshold form status when the saved threshold is refreshed", async () => {
    const user = userEvent.setup();
    const props = {
        rows: [],
        storeUrl: "example",
        updateStockAction: jest.fn(),
        updateThresholdAction: jest.fn().mockResolvedValue({}),
    };
    const { rerender } = render(
        <ModalProvider>
            <SellerInventory {...props} threshold={5} />
        </ModalProvider>
    );
    const field = screen.getAllByRole("spinbutton")[0];
    await user.clear(field);
    await user.type(field, "9");
    await user.click(screen.getAllByRole("button", { name: "保存" })[0]);
    rerender(
        <ModalProvider>
            <SellerInventory {...props} threshold={9} />
        </ModalProvider>
    );
    expect(props.updateThresholdAction).toHaveBeenCalled();
    expect(screen.getByRole("status")).toBeInTheDocument();
});
