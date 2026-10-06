/** @jest-environment jsdom */
import React from "react";
import {
    render,
    screen,
    fireEvent,
    waitFor,
    within,
} from "@testing-library/react";
import Page from "@/app/dashboard/admin/stores/page";
import { getAllStores, updateStoreStatus, deleteStore } from "@/queries/store";
import ModalProvider from "@/providers/modal-provider";
import { stores } from "../../../fixtures/p3/data";
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn() }),
}));
jest.mock("@/queries/store", () => ({
    getAllStores: jest.fn(),
    deleteStore: jest.fn(),
    updateStoreStatus: jest.fn(),
}));
it("keeps store identity for update/deletion and locks pending deletion", async () => {
    jest.mocked(getAllStores).mockResolvedValue(stores as never);
    render(<ModalProvider>{await Page()}</ModalProvider>);
    const state = screen.getByRole("group", {
        name: "Store status Example store editor",
    });
    fireEvent.change(within(state).getByRole("combobox"), {
        target: { value: "ACTIVE" },
    });
    fireEvent.click(within(state).getByRole("button"));
    await waitFor(() =>
        expect(updateStoreStatus).toHaveBeenCalledWith("store-1", "ACTIVE")
    );
    let finish!: () => void;
    jest.mocked(deleteStore).mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finish = () => resolve(undefined as never);
            })
    );
    fireEvent.click(
        screen.getByRole("button", {
            name: "Delete store Example store",
        })
    );
    const confirm = screen.getByRole("button", { name: "Confirm delete" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(deleteStore).toHaveBeenCalledTimes(1));
    expect(deleteStore).toHaveBeenCalledWith("store-1");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeVisible();
    finish();
    await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(screen.getByText("Deleted store Example store.")).toBeVisible();
});
