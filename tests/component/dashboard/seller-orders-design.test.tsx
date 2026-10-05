/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import Page from "@/app/dashboard/seller/stores/[storeUrl]/orders/page";
import ModalProvider from "@/providers/modal-provider";
import { getStoreOrders } from "@/queries/store";
jest.mock("@/queries/store", () => ({
    getStoreOrders: jest.fn(async () => []),
}));
jest.mock("@/queries/order", () => ({
    updateOrderGroupStatus: jest.fn(),
    updateOrderItemStatus: jest.fn(),
}));
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn() }),
}));
it("labels the orders workspace and searchable empty table", async () => {
    render(
        <ModalProvider>
            {await Page({ params: Promise.resolve({ storeUrl: "example" }) })}
        </ModalProvider>
    );
    expect(screen.getByRole("heading", { name: "Orders" })).toBeInTheDocument();
    expect(
        screen.getByRole("searchbox", { name: "Search order by id ..." })
    ).toBeInTheDocument();
    expect(screen.getByText(/Showing up to the latest/)).toBeInTheDocument();
});
it("reports lookup failures instead of an empty order history", async () => {
    jest.mocked(getStoreOrders).mockRejectedValueOnce(
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
it("keeps the Orders heading when the lookup fails", async () => {
    jest.mocked(getStoreOrders).mockRejectedValueOnce(new Error("db down"));
    render(
        <ModalProvider>
            {await Page({ params: Promise.resolve({ storeUrl: "example" }) })}
        </ModalProvider>
    );
    expect(screen.getByRole("heading", { name: "Orders" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Please try again");
});

// Row cells, the details modal and both status editors with injected actions.
import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SellerOrders from "@/components/dashboard/seller/seller-orders";
import type { SellerOrderRow } from "@/lib/seller-orders";
const order: SellerOrderRow = {
    id: "g1",
    storeId: "s1",
    status: "Pending",
    total: 25,
    shippingService: "Standard",
    deliveryRange: "Oct 8 - Oct 10",
    paymentStatus: "Paid",
    paymentMethod: "Stripe",
    paymentReference: "pi_1",
    address: "Street, Tokyo",
    customer: "A Buyer, 123",
    items: [
        {
            id: "i1",
            name: "Pictured item",
            image: "https://res.cloudinary.com/i.png",
            sku: "SKU1",
            size: "M",
            quantity: 1,
            status: "Pending",
            price: 10,
            shippingFee: 2,
            totalPrice: 12,
        },
        {
            id: "i2",
            name: "Plain item",
            image: "",
            sku: "SKU2",
            size: "L",
            quantity: 1,
            status: "Pending",
            price: 11,
            shippingFee: 2,
            totalPrice: 13,
        },
    ],
} as SellerOrderRow;
it("updates group and item statuses from the table and the details modal", async () => {
    // Arrange
    const user = userEvent.setup();
    const actions = {
        updateGroupAction: jest.fn().mockResolvedValue({}),
        updateItemAction: jest.fn().mockResolvedValue({}),
    };
    render(
        <ModalProvider>
            <SellerOrders orders={[order]} actions={actions} />
        </ModalProvider>
    );
    expect(screen.getByText("$25.00")).toBeInTheDocument();
    expect(screen.getAllByText("Pictured item").length).toBeGreaterThan(0);

    // Act: table status editor
    const tableEditor = screen.getByRole("group", {
        name: "Order status g1 editor",
    });
    await user.selectOptions(
        within(tableEditor).getByRole("combobox"),
        "Shipped"
    );
    await user.click(
        within(tableEditor).getByRole("button", { name: "Save status" })
    );

    // Act: details modal
    await user.click(screen.getByRole("button", { name: "View order g1" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("No image")).toBeInTheDocument();
    expect(
        within(dialog).getByRole("img", { name: "Pictured item" })
    ).toBeInTheDocument();
    expect(within(dialog).getByText("pi_1")).toBeInTheDocument();
    const modalGroup = within(dialog).getByRole("group", {
        name: "Order status g1 editor",
    });
    await user.selectOptions(
        within(modalGroup).getByRole("combobox"),
        "Delivered"
    );
    await user.click(
        within(modalGroup).getByRole("button", { name: "Save status" })
    );
    const itemEditor = within(dialog).getByRole("group", {
        name: "Item status i2 editor",
    });
    await user.selectOptions(
        within(itemEditor).getByRole("combobox"),
        "Shipped"
    );
    await user.click(
        within(itemEditor).getByRole("button", { name: "Save status" })
    );

    // Assert
    expect(actions.updateGroupAction).toHaveBeenNthCalledWith(
        1,
        "s1",
        "g1",
        "Shipped"
    );
    expect(actions.updateGroupAction).toHaveBeenNthCalledWith(
        2,
        "s1",
        "g1",
        "Delivered"
    );
    expect(actions.updateItemAction).toHaveBeenCalledWith(
        "s1",
        "i2",
        "Shipped"
    );
});
