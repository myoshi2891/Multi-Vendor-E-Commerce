/** @jest-environment jsdom */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import SellerReturns from "@/components/dashboard/seller/seller-returns";
import type {
    ReturnRequestSellerActions,
    ReturnRequestView,
} from "@/lib/returns-view";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh, push: jest.fn() }),
}));

const item = (id: string, name: string) => ({
    id,
    orderItemId: `oi-${id}`,
    quantity: 1,
    reasonCode: "DEFECTIVE" as const,
    condition: null,
    restockedQuantity: 0,
    name,
    image: "/img.png",
    size: "M",
    price: 50,
});

const request = (
    id: string,
    status: ReturnRequestView["status"],
    overrides: Partial<ReturnRequestView> = {}
): ReturnRequestView => ({
    id,
    orderGroupId: "group-1",
    orderId: "order-1",
    status,
    resolution: "REFUND",
    customerNote: "Seam opened",
    sellerNote: null,
    returnTrackingNumber: null,
    refundAmount: null,
    estimatedRefund: 100,
    createdAt: "2026-10-10T00:00:00.000Z",
    approvedAt: null,
    rejectedAt: null,
    receivedAt: null,
    resolvedAt: null,
    canceledAt: null,
    items: [item(`${id}-a`, "Silk scarf"), item(`${id}-b`, "Wool coat")],
    ...overrides,
});

const actions = (): jest.Mocked<ReturnRequestSellerActions> => ({
    approveAction: jest.fn().mockResolvedValue("APPROVED"),
    rejectAction: jest.fn().mockResolvedValue("REJECTED"),
    receiveAction: jest.fn().mockResolvedValue("RECEIVED"),
    resolveAction: jest.fn().mockResolvedValue("RESOLVED"),
});

const renderQueue = (
    requests: ReturnRequestView[],
    a: ReturnRequestSellerActions = actions()
) =>
    render(
        <SellerReturns storeUrl="my-store" requests={requests} actions={a} />
    );

beforeEach(() => jest.clearAllMocks());

describe("SellerReturns", () => {
    it("RMA が無ければ空の案内を出す", () => {
        renderQueue([]);
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
            "Returns"
        );
        expect(screen.getByText("No return requests yet.")).toBeInTheDocument();
    });

    it("状態で絞り込め、選択肢に件数を出す", async () => {
        // Arrange
        const user = userEvent.setup();
        renderQueue([
            request("r1", "REQUESTED"),
            request("r2", "REQUESTED"),
            request("r3", "RESOLVED"),
        ]);
        const filter = screen.getByLabelText("Filter by status");

        // Act
        await user.selectOptions(filter, "RESOLVED");

        // Assert
        expect(
            within(filter).getByRole("option", { name: "Requested (2)" })
        ).toBeInTheDocument();
        expect(screen.getAllByRole("article")).toHaveLength(1);
        expect(
            screen.getByRole("article", { name: "Return r3" })
        ).toBeVisible();
    });

    it("REQUESTED は承認でき、(storeUrl, id) で呼ぶ", async () => {
        // Arrange
        const user = userEvent.setup();
        const a = actions();
        renderQueue([request("r1", "REQUESTED")], a);
        const card = screen.getByRole("article", { name: "Return r1" });

        // Act
        await user.click(within(card).getByRole("button", { name: "Approve" }));

        // Assert
        expect(a.approveAction).toHaveBeenCalledWith("my-store", "r1");
        expect(await within(card).findByRole("status")).toHaveTextContent(
            "Return updated."
        );
        expect(refresh).toHaveBeenCalled();
    });

    it("却下は理由が必須で、入力後に理由とともに呼ぶ", async () => {
        // Arrange
        const user = userEvent.setup();
        const a = actions();
        renderQueue([request("r1", "REQUESTED")], a);
        const card = screen.getByRole("article", { name: "Return r1" });
        await user.click(within(card).getByRole("button", { name: "Reject" }));

        // Act 1 —— 理由なし
        await user.click(
            within(card).getByRole("button", { name: "Confirm rejection" })
        );

        // Assert 1
        expect(within(card).getByRole("alert")).toHaveTextContent(
            "Enter a reason to reject this return."
        );
        expect(a.rejectAction).not.toHaveBeenCalled();

        // Act 2
        await user.type(
            within(card).getByLabelText("Reason for rejection"),
            "Outside policy"
        );
        await user.click(
            within(card).getByRole("button", { name: "Confirm rejection" })
        );

        // Assert 2
        expect(a.rejectAction).toHaveBeenCalledWith(
            "my-store",
            "r1",
            "Outside policy"
        );
    });

    it("受け取りは全明細の状態がそろうまで送らず、明細ごとに渡す", async () => {
        // Arrange
        const user = userEvent.setup();
        const a = actions();
        renderQueue(
            [request("r1", "APPROVED", { returnTrackingNumber: "TRK-9" })],
            a
        );
        const card = screen.getByRole("article", { name: "Return r1" });
        const receive = within(card).getByRole("button", {
            name: "Mark as received",
        });
        await user.selectOptions(
            within(card).getByLabelText("Condition: Silk scarf (M)"),
            "RESELLABLE"
        );

        // Act 1
        await user.click(receive);

        // Assert 1
        expect(within(card).getByText(/TRK-9/)).toBeInTheDocument();
        expect(within(card).getByRole("alert")).toHaveTextContent(
            "Select a condition for every item."
        );
        expect(a.receiveAction).not.toHaveBeenCalled();

        // Act 2
        await user.selectOptions(
            within(card).getByLabelText("Condition: Wool coat (M)"),
            "DAMAGED"
        );
        await user.click(receive);

        // Assert 2
        expect(a.receiveAction).toHaveBeenCalledWith("my-store", "r1", [
            { returnRequestItemId: "r1-a", condition: "RESELLABLE" },
            { returnRequestItemId: "r1-b", condition: "DAMAGED" },
        ]);
    });

    it("RECEIVED は返金額の目安と手動返金の注記を出して解決できる", async () => {
        // Arrange
        const user = userEvent.setup();
        const a = actions();
        renderQueue([request("r1", "RECEIVED", { estimatedRefund: 123.4 })], a);
        const card = screen.getByRole("article", { name: "Return r1" });

        // Act
        await user.click(
            within(card).getByRole("button", { name: "Resolve return" })
        );

        // Assert
        expect(within(card).getByText(/\$123\.40/)).toBeInTheDocument();
        expect(
            within(card).getByText(/Issue the refund manually/)
        ).toBeInTheDocument();
        expect(a.resolveAction).toHaveBeenCalledWith("my-store", "r1");
    });

    it("失敗したら理由を alert に出し、ボタンを戻す", async () => {
        // Arrange
        const user = userEvent.setup();
        const a = actions();
        a.approveAction.mockRejectedValue(
            new Error("Return request is not in a valid state for this action.")
        );
        renderQueue([request("r1", "REQUESTED")], a);
        const card = screen.getByRole("article", { name: "Return r1" });

        // Act
        await user.click(within(card).getByRole("button", { name: "Approve" }));

        // Assert
        expect(await within(card).findByRole("alert")).toHaveTextContent(
            "Return request is not in a valid state for this action."
        );
        expect(
            within(card).getByRole("button", { name: "Approve" })
        ).toBeEnabled();
        expect(refresh).not.toHaveBeenCalled();
    });

    it("却下理由の見出しは REJECTED のときだけ出す", () => {
        renderQueue([
            request("r1", "REJECTED", { sellerNote: "Worn item" }),
            request("r2", "CANCELED", { sellerNote: "Leftover note" }),
        ]);
        expect(
            within(
                screen.getByRole("article", { name: "Return r1" })
            ).getByText("Rejection reason: Worn item")
        ).toBeInTheDocument();
        expect(
            within(
                screen.getByRole("article", { name: "Return r2" })
            ).queryByText(/Rejection reason/)
        ).not.toBeInTheDocument();
    });

    it("終端の RMA には操作を出さない", () => {
        renderQueue([request("r1", "CANCELED")]);
        const card = screen.getByRole("article", { name: "Return r1" });
        expect(within(card).queryByRole("button")).not.toBeInTheDocument();
    });
});
