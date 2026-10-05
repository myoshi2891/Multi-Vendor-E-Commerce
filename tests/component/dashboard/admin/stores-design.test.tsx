/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import Page from "@/app/dashboard/admin/stores/page";
import { getAllStores } from "@/queries/store";
import ModalProvider from "@/providers/modal-provider";
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn() }),
}));
jest.mock("@/queries/store", () => ({
    getAllStores: jest.fn(),
    deleteStore: jest.fn(),
    updateStoreStatus: jest.fn(),
}));
jest.mock("@/queries/order", () => ({}));
jest.mock("@/hooks/use-toast", () => ({
    useToast: () => ({ toast: jest.fn() }),
}));
beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getAllStores).mockResolvedValue([]);
});
it("labels the stores region and searchable table", async () => {
    render(<ModalProvider>{await Page()}</ModalProvider>);
    expect(screen.getByRole("region", { name: "Stores" })).toBeVisible();
    expect(
        screen.getByRole("searchbox", { name: "Search store name ..." })
    ).toBeVisible();
});
it("distinguishes store fetch failure from empty results", async () => {
    jest.mocked(getAllStores).mockRejectedValueOnce(
        new Error("private detail")
    );
    render(<ModalProvider>{await Page()}</ModalProvider>);
    expect(screen.getByRole("alert")).toContainHTML("Could not load stores");
    expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
});
it("logs the store fetch failure before rendering the retry state", async () => {
    const consoleError = jest
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
    jest.mocked(getAllStores).mockRejectedValueOnce(new Error("db down"));
    render(<ModalProvider>{await Page()}</ModalProvider>);
    expect(consoleError).toHaveBeenCalledWith(
        "[AdminStoresPage] Failed to load stores",
        expect.objectContaining({ error: "db down" })
    );
    consoleError.mockRestore();
});
