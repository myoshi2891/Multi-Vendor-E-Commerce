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
    expect(
        screen.getByRole("heading", { name: "Orders" })
    ).toBeInTheDocument();
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
