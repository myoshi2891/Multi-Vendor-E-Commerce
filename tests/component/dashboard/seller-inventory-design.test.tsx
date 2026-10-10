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
it("logs a failed inventory lookup with structured context", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.mocked(getStoreInventory).mockRejectedValueOnce(
        new Error("private db error")
    );
    await Page({ params: Promise.resolve({ storeUrl: "example" }) });
    expect(spy).toHaveBeenCalledWith(
        "[SellerInventoryPage] Failed to load inventory",
        expect.objectContaining({ error: "private db error" })
    );
    jest.mocked(getStoreInventory).mockRejectedValueOnce("raw failure");
    await Page({ params: Promise.resolve({ storeUrl: "example" }) });
    expect(spy).toHaveBeenCalledWith("[SellerInventoryPage] Unknown error", {
        error: "raw failure",
    });
    spy.mockRestore();
});
// しきい値は列定義の依存に含めない。含めると保存後の refresh で列定義が作り直され、
// 在庫数エディターが remount されて直前の成功表示が消える（実ルートで再現）
it("keeps the stock editor mounted when the refreshed threshold changes", () => {
    // Arrange
    const row = {
        sizeId: "s1",
        productName: "Shoe",
        variantName: "Red",
        size: "M",
        quantity: 3,
        price: 10,
    } as unknown as StoreInventoryRow;
    const props = () => ({
        rows: [row],
        storeUrl: "example",
        updateStockAction: jest.fn(),
        updateThresholdAction: jest.fn(),
    });
    const { rerender } = render(
        <ModalProvider>
            <SellerInventory {...props()} threshold={5} />
        </ModalProvider>
    );
    const before = screen.getByRole("group", { name: "在庫数の編集" });

    // Act: しきい値保存後の router.refresh() 相当
    rerender(
        <ModalProvider>
            <SellerInventory {...props()} threshold={2} />
        </ModalProvider>
    );

    // Assert: 同一要素のまま、ステータスは新しいしきい値で再判定される
    expect(screen.getByRole("group", { name: "在庫数の編集" })).toBe(before);
    expect(before).toBeInTheDocument();
    expect(screen.getByRole("table")).toHaveTextContent("在庫あり");
});
