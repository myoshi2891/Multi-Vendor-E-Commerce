/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { CellContext } from "@tanstack/react-table";
import { columns } from "@/app/dashboard/seller/stores/[storeUrl]/orders/columns";
import type { StoreOrderType } from "@/lib/types";

// 重い子コンポーネント・外部依存はスタブ化し、列定義のレンダリングロジックに集中する
const mockSetOpen = jest.fn();
jest.mock("@/components/dashboard/shared/order-table-cells", () => ({
    __esModule: true,
    ProductImagesCell: ({ images }: { images: string[] }) => (
        <div data-testid="product-images">{images.join(",")}</div>
    ),
    ViewOrderButton: ({ children }: { children: React.ReactNode }) => (
        <button onClick={() => mockSetOpen(children)}>View</button>
    ),
}));
jest.mock("@/components/shared/payment-status", () => ({
    __esModule: true,
    default: ({ status }: { status: string }) => (
        <span data-testid="payment-status">{status}</span>
    ),
}));
jest.mock("@/components/dashboard/forms/order-status-select", () => ({
    __esModule: true,
    default: ({
        mode,
        groupId,
        status,
    }: {
        mode: string;
        groupId: string;
        status: string;
    }) => (
        <span data-testid="status-select">{`${mode}:${groupId}:${status}`}</span>
    ),
}));
jest.mock("@/components/dashboard/shared/store-order-summary", () => ({
    __esModule: true,
    default: ({ group }: { group: { id: string } }) => (
        <div data-testid="order-summary">{group.id}</div>
    ),
}));

const sampleStoreOrder = {
    id: "group-1",
    storeId: "store-1",
    status: "Pending",
    total: 19.9,
    items: [{ image: "https://img/a.png" }, { image: "https://img/b.png" }],
    order: { paymentStatus: "Paid" },
} as unknown as StoreOrderType;

/** 指定列の cell レンダラを最小 CellContext で描画する */
function renderCell(index: number, order: StoreOrderType) {
    const cell = columns[index].cell;
    if (typeof cell !== "function") throw new Error("cell is not a function");
    const ctx = { row: { original: order } } as CellContext<
        StoreOrderType,
        unknown
    >;
    return render(<>{cell(ctx)}</>);
}

describe("seller/orders columns", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("declares the expected accessor keys in order", () => {
        const keys = columns.map((c) =>
            "accessorKey" in c ? c.accessorKey : c.id
        );
        expect(keys).toEqual([
            "id",
            "products",
            "paymentStatus",
            "status",
            "total",
            "open",
        ]);
    });

    it("renders the order id cell", () => {
        renderCell(0, sampleStoreOrder);
        expect(screen.getByText("group-1")).toBeInTheDocument();
    });

    it("maps item images to the products cell", () => {
        renderCell(1, sampleStoreOrder);
        expect(screen.getByTestId("product-images")).toHaveTextContent(
            "https://img/a.png,https://img/b.png"
        );
    });

    it("reads the payment status from the parent order", () => {
        renderCell(2, sampleStoreOrder);
        expect(screen.getByTestId("payment-status")).toHaveTextContent("Paid");
    });

    it("renders a seller status select for the group", () => {
        renderCell(3, sampleStoreOrder);
        expect(screen.getByTestId("status-select")).toHaveTextContent(
            "seller:group-1:Pending"
        );
    });

    it("formats the total to two decimals", () => {
        renderCell(4, sampleStoreOrder);
        expect(screen.getByText("$19.90")).toBeInTheDocument();
    });

    it("opens the order summary via the view button", () => {
        renderCell(5, sampleStoreOrder);
        fireEvent.click(screen.getByText("View"));
        expect(mockSetOpen).toHaveBeenCalledTimes(1);
    });
});
