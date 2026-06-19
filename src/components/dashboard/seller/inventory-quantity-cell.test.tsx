/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// ---- モジュールモック（hoisting のため変数参照禁止）----
jest.mock("next/navigation", () => ({
    useRouter: jest.fn(),
}));

jest.mock("@/hooks/use-toast", () => ({
    useToast: jest.fn(),
}));

jest.mock("@/queries/inventory", () => ({
    updateSizeStock: jest.fn(),
}));

import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { updateSizeStock } from "@/queries/inventory";
import InventoryQuantityCell from "./inventory-quantity-cell";

const mockRefresh = jest.fn();
const mockToast = jest.fn();

beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ refresh: mockRefresh });
    (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
});

const renderCell = (initialQuantity = 3) =>
    render(
        <InventoryQuantityCell
            sizeId="size-1"
            initialQuantity={initialQuantity}
            storeUrl="my-store"
        />
    );

describe("InventoryQuantityCell", () => {
    // 異常系: 空文字は Number("") === 0 で整数・非負チェックを誤通過するため、
    // サーバーアクションを呼ばず元値へ戻すこと（在庫を 0 に誤更新しない）を検証する。
    it("空文字入力では updateSizeStock を呼ばず元の在庫数へ戻す", async () => {
        renderCell(3);
        const input = screen.getByLabelText("在庫数") as HTMLInputElement;

        fireEvent.change(input, { target: { value: "" } });
        fireEvent.click(screen.getByRole("button", { name: "保存" }));

        expect(updateSizeStock).not.toHaveBeenCalled();
        expect(input.value).toBe("3");
    });

    // 正常系（過剰ブロックの防止）: 有効な値はサーバーアクションへ渡る。
    it("有効な数値入力では updateSizeStock を呼ぶ", async () => {
        (updateSizeStock as jest.Mock).mockResolvedValue({
            sizeId: "size-1",
            quantity: 10,
        });
        renderCell(3);
        const input = screen.getByLabelText("在庫数");

        fireEvent.change(input, { target: { value: "10" } });
        fireEvent.click(screen.getByRole("button", { name: "保存" }));

        await waitFor(() =>
            expect(updateSizeStock).toHaveBeenCalledWith("size-1", 10, "my-store")
        );
    });
});
