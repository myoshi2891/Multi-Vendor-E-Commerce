/** @jest-environment jsdom */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import ReturnRequestPanel from "@/components/store/order-page/return-request-panel";
import type {
    GroupReturnOptions,
    ReturnRequestCustomerActions,
    ReturnRequestView,
} from "@/lib/returns-view";

const refresh = jest.fn();
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh, push: jest.fn() }),
}));

const request = (
    overrides: Partial<ReturnRequestView> = {}
): ReturnRequestView => ({
    id: "rma-1",
    orderGroupId: "group-1",
    orderId: null,
    status: "REQUESTED",
    resolution: "REFUND",
    customerNote: null,
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
    items: [
        {
            id: "rmi-1",
            orderItemId: "item-1",
            quantity: 1,
            reasonCode: "SIZE_FIT",
            condition: null,
            restockedQuantity: 0,
            name: "Silk scarf",
            image: "/scarf.png",
            size: "M",
            price: 100,
        },
    ],
    ...overrides,
});

const options = (
    overrides: Partial<GroupReturnOptions> = {}
): GroupReturnOptions => ({
    groupId: "group-1",
    deadline: "2026-11-01T00:00:00.000Z",
    items: [
        {
            id: "item-1",
            name: "Silk scarf",
            image: "/scarf.png",
            size: "M",
            maxQuantity: 2,
        },
        {
            id: "item-2",
            name: "Wool coat",
            image: "/coat.png",
            size: "L",
            maxQuantity: 1,
        },
    ],
    requests: [],
    ...overrides,
});

const actions = (): jest.Mocked<ReturnRequestCustomerActions> => ({
    createAction: jest
        .fn()
        .mockResolvedValue({ id: "rma-9", status: "REQUESTED" }),
    cancelAction: jest.fn().mockResolvedValue("CANCELED"),
    trackingAction: jest.fn().mockResolvedValue("APPROVED"),
});

const keys = (): (() => string) => {
    let n = 0;
    return jest.fn(() => `key-${++n}`);
};

beforeEach(() => jest.clearAllMocks());

describe("ReturnRequestPanel — 申請", () => {
    it("適格な item も RMA も無ければ何も描かない", () => {
        // Act
        const { container } = render(
            <ReturnRequestPanel
                options={options({ items: [] })}
                actions={actions()}
            />
        );

        // Assert
        expect(container).toBeEmptyDOMElement();
    });

    it("フォームを開いたときだけ冪等キーを作り、選んだ明細とキーで申請する", async () => {
        // Arrange
        const user = userEvent.setup();
        const a = actions();
        const createKey = keys();
        render(
            <ReturnRequestPanel
                options={options()}
                actions={a}
                createIdempotencyKey={createKey}
            />
        );
        expect(createKey).not.toHaveBeenCalled();
        const toggle = screen.getByRole("button", { name: "Request a return" });
        expect(toggle).toHaveAttribute("aria-expanded", "false");

        // Act
        await user.click(toggle);
        expect(toggle).toHaveAttribute("aria-expanded", "true");
        await user.selectOptions(
            screen.getByLabelText("Quantity to return: Silk scarf (M)"),
            "2"
        );
        await user.selectOptions(
            screen.getByLabelText("Reason: Silk scarf (M)"),
            "DEFECTIVE"
        );
        await user.type(
            screen.getByLabelText("Note for the store (optional)"),
            "Stitching came loose"
        );
        await user.click(
            screen.getByRole("button", { name: "Submit return request" })
        );

        // Assert —— 成功したらフォームを閉じる
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        expect(createKey).toHaveBeenCalledTimes(1);
        expect(a.createAction).toHaveBeenCalledWith({
            orderGroupId: "group-1",
            idempotencyKey: "key-1",
            resolution: "REFUND",
            customerNote: "Stitching came loose",
            items: [
                { orderItemId: "item-1", quantity: 2, reasonCode: "DEFECTIVE" },
            ],
        });
        expect(await screen.findByRole("status")).toHaveTextContent(
            "Return request submitted."
        );
        expect(refresh).toHaveBeenCalled();
    });

    it("数量を選ばずに送ると alert を出し、action を呼ばない", async () => {
        // Arrange
        const user = userEvent.setup();
        const a = actions();
        render(<ReturnRequestPanel options={options()} actions={a} />);
        await user.click(
            screen.getByRole("button", { name: "Request a return" })
        );

        // Act
        await user.click(
            screen.getByRole("button", { name: "Submit return request" })
        );

        // Assert
        expect(screen.getByRole("alert")).toHaveTextContent(
            "Select at least one item to return."
        );
        expect(a.createAction).not.toHaveBeenCalled();
    });

    it("数量の選択肢は残り数量までに限る", async () => {
        // Arrange
        const user = userEvent.setup();
        render(<ReturnRequestPanel options={options()} actions={actions()} />);

        // Act
        await user.click(
            screen.getByRole("button", { name: "Request a return" })
        );

        // Assert
        const select = screen.getByLabelText(
            "Quantity to return: Wool coat (L)"
        );
        expect(
            within(select)
                .getAllByRole("option")
                .map((o) => o.textContent)
        ).toEqual(["0", "1"]);
    });

    it("送信中は入力をロックし、二重送信しても action は 1 回だけ", async () => {
        // Arrange
        const user = userEvent.setup();
        const a = actions();
        let release!: () => void;
        a.createAction.mockReturnValue(
            new Promise((resolve) => {
                release = () => resolve({ id: "rma-9", status: "REQUESTED" });
            })
        );
        render(<ReturnRequestPanel options={options()} actions={a} />);
        await user.click(
            screen.getByRole("button", { name: "Request a return" })
        );
        await user.selectOptions(
            screen.getByLabelText("Quantity to return: Wool coat (L)"),
            "1"
        );
        const submit = screen.getByRole("button", {
            name: "Submit return request",
        });

        // Act
        await user.click(submit);

        // Assert
        expect(
            screen.getByRole("button", { name: "Submitting…" })
        ).toBeDisabled();
        expect(
            screen.getByLabelText("Quantity to return: Wool coat (L)")
        ).toBeDisabled();
        await user.click(screen.getByRole("button", { name: "Submitting…" }));
        expect(a.createAction).toHaveBeenCalledTimes(1);
        release();
        expect(await screen.findByRole("status")).toBeInTheDocument();
    });

    it("失敗したら理由を alert に出し、再送では同じ冪等キーを使う", async () => {
        // Arrange
        const user = userEvent.setup();
        const a = actions();
        a.createAction
            .mockRejectedValueOnce(
                new Error("Return quantity exceeds purchased quantity.")
            )
            .mockResolvedValueOnce({ id: "rma-9", status: "REQUESTED" });
        const createKey = keys();
        render(
            <ReturnRequestPanel
                options={options()}
                actions={a}
                createIdempotencyKey={createKey}
            />
        );
        await user.click(
            screen.getByRole("button", { name: "Request a return" })
        );
        await user.selectOptions(
            screen.getByLabelText("Quantity to return: Wool coat (L)"),
            "1"
        );
        const submit = screen.getByRole("button", {
            name: "Submit return request",
        });

        // Act
        await user.click(submit);
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Return quantity exceeds purchased quantity."
        );
        await user.click(submit);

        // Assert
        expect(a.createAction).toHaveBeenCalledTimes(2);
        const usedKeys = a.createAction.mock.calls.map(
            ([input]) => input.idempotencyKey
        );
        expect(usedKeys).toEqual(["key-1", "key-1"]);
        expect(createKey).toHaveBeenCalledTimes(1);
    });
});

describe("ReturnRequestPanel — 失敗後に内容を変えた再送", () => {
    it("明細の選択を変えたら新しい冪等キーで送り、メモだけの変更では同じキーを使う", async () => {
        // Arrange
        const user = userEvent.setup();
        const a = actions();
        a.createAction
            .mockRejectedValueOnce(
                new Error("Failed to create return request.")
            )
            .mockRejectedValueOnce(
                new Error("Failed to create return request.")
            )
            .mockResolvedValueOnce({ id: "rma-9", status: "REQUESTED" });
        render(
            <ReturnRequestPanel
                options={options()}
                actions={a}
                createIdempotencyKey={keys()}
            />
        );
        await user.click(
            screen.getByRole("button", { name: "Request a return" })
        );
        const quantity = screen.getByLabelText(
            "Quantity to return: Silk scarf (M)"
        );
        const submit = screen.getByRole("button", {
            name: "Submit return request",
        });
        await user.selectOptions(quantity, "1");
        await user.click(submit);
        await screen.findByRole("alert");

        // Act 1 —— メモだけ変える（customerNote は requestHash に含めない・design §2.3）
        await user.type(
            screen.getByLabelText("Note for the store (optional)"),
            "x"
        );
        await user.click(submit);
        await screen.findByRole("alert");

        // Act 2 —— 明細を変える
        await user.selectOptions(quantity, "2");
        await user.click(submit);

        // Assert
        expect(
            a.createAction.mock.calls.map(([input]) => input.idempotencyKey)
        ).toEqual(["key-1", "key-1", "key-2"]);
    });
});

describe("ReturnRequestPanel — 既存の RMA", () => {
    it("状態と明細を出し、REQUESTED は取り下げられる", async () => {
        // Arrange
        const user = userEvent.setup();
        const a = actions();
        render(
            <ReturnRequestPanel
                options={options({ items: [], requests: [request()] })}
                actions={a}
            />
        );
        const card = screen.getByRole("article", { name: /Return request/ });

        // Act
        await user.click(
            within(card).getByRole("button", { name: "Cancel return" })
        );

        // Assert
        expect(within(card).getByText("Requested")).toBeInTheDocument();
        expect(
            within(card).getByText(/Silk scarf \(M\) × 1/)
        ).toBeInTheDocument();
        expect(a.cancelAction).toHaveBeenCalledWith("rma-1");
        expect(refresh).toHaveBeenCalled();
    });

    it("APPROVED は追跡番号を保存できる", async () => {
        // Arrange
        const user = userEvent.setup();
        const a = actions();
        render(
            <ReturnRequestPanel
                options={options({
                    items: [],
                    requests: [request({ status: "APPROVED" })],
                })}
                actions={a}
            />
        );

        // Act
        await user.type(
            screen.getByLabelText("Return tracking number"),
            "TRK-42"
        );
        await user.click(
            screen.getByRole("button", { name: "Save tracking number" })
        );

        // Assert
        expect(a.trackingAction).toHaveBeenCalledWith("rma-1", "TRK-42");
        expect(await screen.findByRole("status")).toHaveTextContent(
            "Tracking number saved."
        );
    });

    it("却下は店舗の理由を、解決は返金額の目安を出し、操作は出さない", () => {
        // Act
        render(
            <ReturnRequestPanel
                options={options({
                    items: [],
                    requests: [
                        request({
                            id: "rma-a",
                            status: "REJECTED",
                            sellerNote: "Item shows wear",
                        }),
                        request({
                            id: "rma-b",
                            status: "RESOLVED",
                            refundAmount: 200.2,
                        }),
                    ],
                })}
                actions={actions()}
            />
        );

        // Assert
        expect(screen.getByText(/Item shows wear/)).toBeInTheDocument();
        expect(screen.getByText(/\$200\.20/)).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Cancel return" })
        ).not.toBeInTheDocument();
    });
});
