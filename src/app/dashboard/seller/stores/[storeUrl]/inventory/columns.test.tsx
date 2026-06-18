/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { CellContext } from "@tanstack/react-table";
import { getInventoryColumns } from "@/app/dashboard/seller/stores/[storeUrl]/inventory/columns";
import type { StoreInventoryRow } from "@/lib/types";

// 子コンポーネント（client・query 依存）はスタブ化し、列定義の描画ロジックに集中する
jest.mock("@/components/dashboard/seller/inventory-quantity-cell", () => ({
    __esModule: true,
    default: ({
        sizeId,
        initialQuantity,
        storeUrl,
    }: {
        sizeId: string;
        initialQuantity: number;
        storeUrl: string;
    }) => (
        <div data-testid="qty-cell">{`${sizeId}:${initialQuantity}:${storeUrl}`}</div>
    ),
}));
jest.mock("@/components/dashboard/seller/stock-status-badge", () => ({
    __esModule: true,
    default: ({ quantity, threshold }: { quantity: number; threshold: number }) => (
        <div data-testid="status-badge">{`${quantity}/${threshold}`}</div>
    ),
}));

const THRESHOLD = 5;
const STORE_URL = "my-store";

const sampleRow: StoreInventoryRow = {
    sizeId: "size-1",
    productName: "T-Shirt",
    variantName: "Red",
    size: "M",
    quantity: 3,
    price: 19.9,
    sku: "SKU-1",
    productSlug: "t-shirt",
    variantId: "variant-1",
};

/** 指定列の cell レンダラを最小 CellContext で描画する */
function renderCell(index: number, row: StoreInventoryRow) {
    const columns = getInventoryColumns(THRESHOLD, STORE_URL);
    const cell = columns[index].cell;
    if (typeof cell !== "function") throw new Error("cell is not a function");
    const ctx = { row: { original: row } } as CellContext<
        StoreInventoryRow,
        unknown
    >;
    return render(<>{cell(ctx)}</>);
}

describe("seller/inventory columns", () => {
    it("declares the expected accessor keys in order", () => {
        const columns = getInventoryColumns(THRESHOLD, STORE_URL);
        const keys = columns.map((c) =>
            "accessorKey" in c ? c.accessorKey : c.id
        );
        expect(keys).toEqual([
            "productName",
            "variantName",
            "size",
            "quantity",
            "price",
            "status",
        ]);
    });

    it("renders the product name cell", () => {
        renderCell(0, sampleRow);
        expect(screen.getByText("T-Shirt")).toBeInTheDocument();
    });

    it("passes sizeId/quantity/storeUrl to the inline-edit quantity cell", () => {
        renderCell(3, sampleRow);
        expect(screen.getByTestId("qty-cell")).toHaveTextContent(
            "size-1:3:my-store"
        );
    });

    it("formats the price to two decimals", () => {
        renderCell(4, sampleRow);
        expect(screen.getByText("$19.90")).toBeInTheDocument();
    });

    it("passes quantity and threshold to the status badge", () => {
        renderCell(5, sampleRow);
        expect(screen.getByTestId("status-badge")).toHaveTextContent("3/5");
    });
});
