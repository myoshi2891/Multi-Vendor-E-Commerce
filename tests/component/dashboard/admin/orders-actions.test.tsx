/** @jest-environment jsdom */
import React from "react";
import {
    render,
    screen,
    fireEvent,
    waitFor,
    within,
} from "@testing-library/react";
import Page from "@/app/dashboard/admin/orders/page";
import {
    getAllOrders,
    updateOrderGroupStatusAsAdmin,
    updateOrderItemStatusAsAdmin,
} from "@/queries/order";
import ModalProvider from "@/providers/modal-provider";
import { orders } from "../../../fixtures/p3/data";
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn() }),
}));
jest.mock("@/queries/order", () => ({
    getAllOrders: jest.fn(),
    updateOrderGroupStatusAsAdmin: jest.fn(),
    updateOrderItemStatusAsAdmin: jest.fn(),
}));
it("uses admin group and item actions with identity preserved in details", async () => {
    jest.mocked(getAllOrders).mockResolvedValue({
        orders,
        page: 1,
        total: 1,
        limit: 50,
    } as never);
    render(
        <ModalProvider>
            {await Page({ searchParams: Promise.resolve({}) })}
        </ModalProvider>
    );
    const group = screen.getByRole("group", {
        name: "Order status group-1 editor",
    });
    fireEvent.change(within(group).getByRole("combobox"), {
        target: { value: "Shipped" },
    });
    fireEvent.click(within(group).getByRole("button"));
    await waitFor(() =>
        expect(updateOrderGroupStatusAsAdmin).toHaveBeenCalledWith(
            "group-1",
            "Shipped"
        )
    );
    fireEvent.click(screen.getByRole("button", { name: "View order order-1" }));
    const item = within(screen.getByRole("dialog")).getByRole("group", {
        name: "Item status item-1 editor",
    });
    fireEvent.change(within(item).getByRole("combobox"), {
        target: { value: "Delivered" },
    });
    fireEvent.click(within(item).getByRole("button"));
    await waitFor(() =>
        expect(updateOrderItemStatusAsAdmin).toHaveBeenCalledWith(
            "item-1",
            "Delivered"
        )
    );
    expect(
        within(screen.getByRole("dialog")).getByText("Total: $12.50", { exact: true })
    ).toBeVisible();
});
