/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import Page from "@/app/dashboard/admin/orders/page";
import { getAllOrders } from "@/queries/order";
import ModalProvider from "@/providers/modal-provider";
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn() }),
}));
jest.mock("@/queries/order", () => ({
    getAllOrders: jest.fn(),
    updateOrderGroupStatus: jest.fn(),
    updateOrderGroupStatusAsAdmin: jest.fn(),
    updateOrderItemStatus: jest.fn(),
    updateOrderItemStatusAsAdmin: jest.fn(),
}));
jest.mock("@/hooks/use-toast", () => ({
    useToast: () => ({ toast: jest.fn() }),
}));
beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getAllOrders).mockResolvedValue({
        orders: [],
        page: 2,
        limit: 100,
        total: 0,
    });
});
it("labels admin orders and keeps normalized query filters", async () => {
    render(
        <ModalProvider>
            {await Page({
                searchParams: Promise.resolve({
                    page: "2",
                    limit: "500",
                    search: "order",
                    paymentStatus: "Paid",
                    orderStatus: "Shipped",
                }),
            })}
        </ModalProvider>
    );
    expect(getAllOrders).toHaveBeenCalledWith({
        page: 2,
        limit: 100,
        search: "order",
        paymentStatus: "Paid",
        orderStatus: "Shipped",
    });
    expect(screen.getByRole("region", { name: "Orders" })).toBeVisible();
    expect(
        screen.getByRole("searchbox", { name: "Search order by id ..." })
    ).toBeVisible();
});
it("shows retry rather than empty results on failed fetch", async () => {
    jest.mocked(getAllOrders).mockRejectedValueOnce(
        new Error("fixture failure")
    );
    jest.spyOn(console, "error").mockImplementation(() => {});
    render(
        <ModalProvider>
            {await Page({ searchParams: Promise.resolve({}) })}
        </ModalProvider>
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not load orders"
    );
    expect(screen.queryByText("No Results.")).not.toBeInTheDocument();
    jest.restoreAllMocks();
});
