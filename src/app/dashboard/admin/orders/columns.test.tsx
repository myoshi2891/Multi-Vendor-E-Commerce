/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { CellContext } from "@tanstack/react-table";
import { columns } from "@/app/dashboard/admin/orders/columns";
import type { AdminOrderType } from "@/lib/types";

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
    default: ({ groupId, status }: { groupId: string; status: string }) => (
        <span data-testid="status-select">{`${groupId}:${status}`}</span>
    ),
}));
jest.mock("@/components/dashboard/shared/store-order-summary", () => ({
    __esModule: true,
    default: ({ group }: { group: { id: string } }) => (
        <div data-testid="order-summary">{group.id}</div>
    ),
}));

const sampleAdminOrder = {
    id: "order-1",
    total: 42.5,
    paymentStatus: "Paid",
    groups: [
        {
            id: "g1",
            status: "Pending",
            store: { name: "Store A" },
            items: [{ image: "https://img/a.png" }],
        },
        {
            id: "g2",
            status: "Shipped",
            store: { name: "Store B" },
            items: [{ image: "https://img/b.png" }],
        },
    ],
} as unknown as AdminOrderType;

/** 指定列の cell レンダラを最小 CellContext で描画する */
function renderCell(index: number, order: AdminOrderType) {
    const cell = columns[index].cell;
    if (typeof cell !== "function") throw new Error("cell is not a function");
    const ctx = { row: { original: order } } as CellContext<
        AdminOrderType,
        unknown
    >;
    return render(<>{cell(ctx)}</>);
}

describe("admin/orders columns", () => {
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
            "store",
            "paymentStatus",
            "status",
            "total",
            "open",
        ]);
    });

    it("renders the order id cell", () => {
        renderCell(0, sampleAdminOrder);
        expect(screen.getByText("order-1")).toBeInTheDocument();
    });

    it("flattens product images across all groups", () => {
        renderCell(1, sampleAdminOrder);
        expect(screen.getByTestId("product-images")).toHaveTextContent(
            "https://img/a.png,https://img/b.png"
        );
    });

    it("renders one store name per group", () => {
        renderCell(2, sampleAdminOrder);
        expect(screen.getByText("Store A")).toBeInTheDocument();
        expect(screen.getByText("Store B")).toBeInTheDocument();
    });

    it("renders the payment status tag", () => {
        renderCell(3, sampleAdminOrder);
        expect(screen.getByTestId("payment-status")).toHaveTextContent("Paid");
    });

    it("renders an admin status select per group", () => {
        renderCell(4, sampleAdminOrder);
        const selects = screen.getAllByTestId("status-select");
        expect(selects).toHaveLength(2);
        expect(selects[0]).toHaveTextContent("g1:Pending");
        expect(selects[1]).toHaveTextContent("g2:Shipped");
    });

    it("formats the total to two decimals", () => {
        renderCell(5, sampleAdminOrder);
        expect(screen.getByText("$42.50")).toBeInTheDocument();
    });

    it("opens an order summary per group via the view button", () => {
        renderCell(6, sampleAdminOrder);
        fireEvent.click(screen.getByText("View"));
        expect(mockSetOpen).toHaveBeenCalledTimes(1);
    });
});
