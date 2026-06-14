/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import OrderStatusSelect from "@/components/dashboard/forms/order-status-select";
import { OrderStatus } from "@/lib/types";
import {
    updateOrderGroupStatus,
    updateOrderGroupStatusAsAdmin,
} from "@/queries/order";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

// Mock dependencies
jest.mock("@/queries/order", () => ({
    updateOrderGroupStatus: jest.fn(),
    updateOrderGroupStatusAsAdmin: jest.fn(),
}));
jest.mock("@/hooks/use-toast");
jest.mock("next/navigation", () => ({
    useRouter: jest.fn(),
}));

describe("OrderStatusSelect", () => {
    const mockToast = jest.fn();
    const mockRefresh = jest.fn();
    const storeId = "store-1";
    const groupId = "group-1";

    beforeEach(() => {
        jest.clearAllMocks();
        (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
        (useRouter as jest.Mock).mockReturnValue({ refresh: mockRefresh });
    });

    it("renders current status and toggles dropdown", () => {
        render(
            <OrderStatusSelect
                mode="seller"
                storeId={storeId}
                groupId={groupId}
                status={OrderStatus.Pending}
            />
        );

        // Current status (OrderStatusTag renders label)
        expect(screen.getByText("Pending")).toBeInTheDocument();

        // Dropdown should be closed initially
        expect(screen.queryByRole("button")).not.toBeInTheDocument();

        // Toggle dropdown
        fireEvent.click(screen.getByText("Pending"));

        // Other statuses should be visible (e.g. Shipped)
        expect(screen.getByText("Shipped")).toBeInTheDocument();
    });

    it("successfully updates order status", async () => {
        (updateOrderGroupStatus as jest.Mock).mockResolvedValue(
            OrderStatus.Shipped
        );

        render(
            <OrderStatusSelect
                mode="seller"
                storeId={storeId}
                groupId={groupId}
                status={OrderStatus.Pending}
            />
        );

        fireEvent.click(screen.getByText("Pending"));
        fireEvent.click(screen.getByText("Shipped"));

        await waitFor(() => {
            expect(updateOrderGroupStatus).toHaveBeenCalledWith(
                storeId,
                groupId,
                OrderStatus.Shipped
            );
            expect(screen.getByText("Shipped")).toBeInTheDocument();
            expect(screen.queryByText("Pending")).not.toBeInTheDocument();
        });
    });

    it("uses the admin action when mode is admin", async () => {
        (updateOrderGroupStatusAsAdmin as jest.Mock).mockResolvedValue(
            OrderStatus.Shipped
        );

        render(
            <OrderStatusSelect
                mode="admin"
                groupId={groupId}
                status={OrderStatus.Pending}
            />
        );

        fireEvent.click(screen.getByText("Pending"));
        fireEvent.click(screen.getByText("Shipped"));

        await waitFor(() => {
            // admin 分岐: storeId を伴わない admin 専用 action が呼ばれる
            expect(updateOrderGroupStatusAsAdmin).toHaveBeenCalledWith(
                groupId,
                OrderStatus.Shipped
            );
            expect(updateOrderGroupStatus).not.toHaveBeenCalled();
            expect(screen.getByText("Shipped")).toBeInTheDocument();
        });
    });

    it("keeps the dropdown open when the response is falsy", async () => {
        (updateOrderGroupStatus as jest.Mock).mockResolvedValue(null);

        render(
            <OrderStatusSelect
                mode="seller"
                storeId={storeId}
                groupId={groupId}
                status={OrderStatus.Pending}
            />
        );

        fireEvent.click(screen.getByText("Pending"));
        fireEvent.click(screen.getByText("Shipped"));

        await waitFor(() => {
            expect(updateOrderGroupStatus).toHaveBeenCalledWith(
                storeId,
                groupId,
                OrderStatus.Shipped
            );
        });
        // falsy レスポンス時は状態を更新せず dropdown も閉じない
        expect(screen.getByText("Pending")).toBeInTheDocument();
        expect(screen.getByText("Shipped")).toBeInTheDocument();
    });

    it("handles error during update", async () => {
        const errorMessage = "Unauthorized";
        (updateOrderGroupStatus as jest.Mock).mockRejectedValue(
            new Error(errorMessage)
        );

        render(
            <OrderStatusSelect
                mode="seller"
                storeId={storeId}
                groupId={groupId}
                status={OrderStatus.Pending}
            />
        );

        fireEvent.click(screen.getByText("Pending"));
        fireEvent.click(screen.getByText("Shipped"));

        await waitFor(() => {
            expect(mockToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    variant: "destructive",
                    title: "Failed to update order status",
                    description: expect.stringContaining(errorMessage),
                })
            );
        });
    });
});
