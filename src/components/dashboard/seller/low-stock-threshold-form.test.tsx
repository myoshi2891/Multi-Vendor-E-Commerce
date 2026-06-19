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
    updateStoreLowStockThreshold: jest.fn(),
}));

import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { updateStoreLowStockThreshold } from "@/queries/inventory";
import LowStockThresholdForm from "./low-stock-threshold-form";

const mockRefresh = jest.fn();
const mockToast = jest.fn();

beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ refresh: mockRefresh });
    (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
});

const renderForm = (initialThreshold = 5) =>
    render(
        <LowStockThresholdForm
            storeUrl="my-store"
            initialThreshold={initialThreshold}
        />
    );

describe("LowStockThresholdForm", () => {
    // 異常系: 空文字は Number("") === 0 で整数・非負チェックを誤通過するため、
    // サーバーアクションを呼ばず元値へ戻すこと（しきい値を 0 に誤更新しない）を検証する。
    it("空文字入力では updateStoreLowStockThreshold を呼ばず元のしきい値へ戻す", () => {
        renderForm(5);
        const input = screen.getByLabelText("過小在庫しきい値") as HTMLInputElement;

        fireEvent.change(input, { target: { value: "" } });
        fireEvent.click(screen.getByRole("button", { name: "保存" }));

        expect(updateStoreLowStockThreshold).not.toHaveBeenCalled();
        expect(input.value).toBe("5");
    });

    // 正常系（過剰ブロックの防止）: 有効な値はサーバーアクションへ渡る。
    it("有効な数値入力では updateStoreLowStockThreshold を呼ぶ", async () => {
        (updateStoreLowStockThreshold as jest.Mock).mockResolvedValue({
            lowStockThreshold: 10,
        });
        renderForm(5);
        const input = screen.getByLabelText("過小在庫しきい値");

        fireEvent.change(input, { target: { value: "10" } });
        fireEvent.click(screen.getByRole("button", { name: "保存" }));

        await waitFor(() =>
            expect(updateStoreLowStockThreshold).toHaveBeenCalledWith(
                "my-store",
                10
            )
        );
    });
});
