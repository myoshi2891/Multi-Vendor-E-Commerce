/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StatusEditor from "@/components/dashboard/seller/status-editor";
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn() }),
}));
it("retains the proposed status after failure and retries the same value", async () => {
    const action = jest
        .fn()
        .mockRejectedValueOnce(new Error("private details"))
        .mockResolvedValue({});
    render(
        <StatusEditor
            label="Order status"
            initialStatus="Pending"
            options={["Pending", "Processing"]}
            saveAction={action}
        />
    );
    fireEvent.change(screen.getByLabelText("Order status"), {
        target: { value: "Processing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save status" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Order status")).toHaveValue("Processing");
    expect(screen.queryByText("private details")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByRole("status");
    expect(action.mock.calls).toEqual([["Processing"], ["Processing"]]);
});
it("prevents duplicate submissions while a status change is pending", async () => {
    let resolve!: (value: unknown) => void;
    const action = jest.fn(
        () =>
            new Promise((r) => {
                resolve = r;
            })
    );
    render(
        <StatusEditor
            label="Order status"
            initialStatus="Pending"
            options={["Pending", "Shipped"]}
            saveAction={action}
        />
    );
    fireEvent.change(screen.getByLabelText("Order status"), {
        target: { value: "Shipped" },
    });
    const save = screen.getByRole("button", { name: "Save status" });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(action).toHaveBeenCalledTimes(1);
    expect(save).toBeDisabled();
    resolve({});
    await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent("Status updated")
    );
});
