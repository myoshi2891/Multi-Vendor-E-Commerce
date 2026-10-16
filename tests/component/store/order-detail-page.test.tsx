/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import OrderPage from "@/app/(fullscreen)/order/[orderId]/page";
import { getOrder } from "@/queries/order";
import { getReturnRequestsForOrder } from "@/queries/returns";
import { serializeOrderInvoice } from "@/lib/order-invoice";
import type { OrderFullType } from "@/lib/types";
import {
    createMockOrder,
    createMockOrderGroup,
    createMockOrderItem,
    createMockShippingAddress,
    createMockCountry,
    createMockUser,
    createMockStore,
} from "@/config/test-fixtures";

jest.mock("@/queries/order", () => ({ getOrder: jest.fn() }));
jest.mock("@/queries/returns", () => ({
    getReturnRequestsForOrder: jest.fn().mockResolvedValue([]),
    createReturnRequest: jest.fn(),
    cancelReturnRequest: jest.fn(),
    setReturnTrackingNumber: jest.fn(),
}));
jest.mock("@/queries/stripe", () => ({
    createStripePaymentIntent: jest.fn(),
    createStripePayment: jest.fn(),
}));
jest.mock("@/queries/paypal", () => ({
    createPayPalPayment: jest.fn(),
    capturePayPalPayment: jest.fn(),
}));
jest.mock("next/navigation", () => ({
    redirect: jest.fn((path: string) => {
        throw new Error(`redirect:${path}`);
    }),
    useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
}));
jest.mock("@/components/store/layout/header/header", () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock("@/components/store/order-page/header", () => ({
    __esModule: true,
    default: ({ order }: { order: { id: string } }) => (
        <h1>Order {order.id}</h1>
    ),
}));
jest.mock("@/components/store/order-page/payment", () => ({
    __esModule: true,
    default: () => <section data-testid="order-payment">Payment</section>,
}));

function order(paymentStatus = "Paid", orderStatus = "Pending") {
    return {
        ...createMockOrder(),
        paymentStatus,
        orderStatus,
        paymentDetails: null,
        shippingAddress: {
            ...createMockShippingAddress(),
            country: createMockCountry(),
            user: createMockUser(),
        },
        groups: [
            {
                ...createMockOrderGroup(),
                store: createMockStore(),
                coupon: null,
                _count: { items: 1 },
                items: [createMockOrderItem()],
            },
        ],
    } as NonNullable<OrderFullType>;
}

test.each([
    ["Paid", "Pending", false],
    ["Pending", "Pending", true],
    ["Paid", "Failed", true],
    ["Failed", "Pending", false],
])(
    "payment %s / order %s preserves payment visibility with one summary",
    async (payment, status, visible) => {
        jest.mocked(getOrder).mockResolvedValue(order(payment, status));
        render(
            await OrderPage({
                params: Promise.resolve({ orderId: "order-id" }),
            })
        );
        expect(getOrder).toHaveBeenLastCalledWith("order-id");
        expect(screen.getAllByTestId("order-total")).toHaveLength(1);
        expect(screen.queryAllByTestId("order-payment")).toHaveLength(
            visible ? 1 : 0
        );
    }
);
test("invoice boundary sends plain values and preserves printable amounts", () => {
    const input = order();
    const invoice = serializeOrderInvoice(input);
    expect(JSON.parse(JSON.stringify(invoice))).toEqual(invoice);
    expect(invoice.total).toBe(input.total.toNumber());
    expect(invoice.groups[0].items[0].price).toBe(
        input.groups[0].items[0].price.toNumber()
    );
    expect(invoice.shippingAddress).not.toHaveProperty("user");
    expect(invoice.createdAt).toBe(input.createdAt.toISOString());
});
test("missing order preserves home redirect", async () => {
    jest.mocked(getOrder).mockResolvedValue(null);
    await expect(
        OrderPage({ params: Promise.resolve({ orderId: "missing" }) })
    ).rejects.toThrow("redirect:/");
});

/** 直近に作られ、item が配達済みの注文（返品の期限内） */
function deliveredOrder() {
    const input = order();
    input.createdAt = new Date();
    input.groups[0].items[0].status = "Delivered";
    return input;
}

test("returns: only groups with eligible items get the request entry", async () => {
    const delivered = deliveredOrder();
    jest.mocked(getOrder).mockResolvedValue(delivered);
    render(
        await OrderPage({ params: Promise.resolve({ orderId: "order-id" }) })
    );
    // 返品は取得できた（所有者確認済みの）注文の ID で引く
    expect(getReturnRequestsForOrder).toHaveBeenLastCalledWith(delivered.id);
    expect(
        screen.getByRole("button", { name: "Request a return" })
    ).toBeInTheDocument();

    jest.mocked(getOrder).mockResolvedValue(order());
    render(
        await OrderPage({ params: Promise.resolve({ orderId: "order-id" }) })
    );
    expect(
        screen.getAllByRole("button", { name: "Request a return" })
    ).toHaveLength(1);
});

test("returns: a failed return lookup keeps the order page and explains it", async () => {
    jest.mocked(getOrder).mockResolvedValue(deliveredOrder());
    jest.mocked(getReturnRequestsForOrder).mockRejectedValueOnce(
        new Error("Failed to get return requests.")
    );
    jest.spyOn(console, "error").mockImplementation(() => {});
    render(
        await OrderPage({ params: Promise.resolve({ orderId: "order-id" }) })
    );
    expect(screen.getAllByTestId("order-total")).toHaveLength(1);
    expect(
        screen.getByText(
            "Return requests could not be loaded. Reload the page to try again."
        )
    ).toBeInTheDocument();
    expect(
        screen.queryByRole("button", { name: "Request a return" })
    ).not.toBeInTheDocument();
});

test("returns: an invalid return window setting keeps the order page and explains it", async () => {
    // Arrange: 店舗の上書きが無く、既定の返品日数の設定が不正（組み立て時に throw する）
    const previous = process.env.RETURN_WINDOW_DAYS_DEFAULT;
    process.env.RETURN_WINDOW_DAYS_DEFAULT = "abc";
    jest.mocked(getOrder).mockResolvedValue(deliveredOrder());
    jest.spyOn(console, "error").mockImplementation(() => {});
    try {
        // Act
        render(
            await OrderPage({
                params: Promise.resolve({ orderId: "order-id" }),
            })
        );
    } finally {
        if (previous === undefined) {
            delete process.env.RETURN_WINDOW_DAYS_DEFAULT;
        } else {
            process.env.RETURN_WINDOW_DAYS_DEFAULT = previous;
        }
    }
    // Assert
    expect(screen.getAllByTestId("order-total")).toHaveLength(1);
    expect(
        screen.getByText(
            "Return requests could not be loaded. Reload the page to try again."
        )
    ).toBeInTheDocument();
    expect(
        screen.queryByRole("button", { name: "Request a return" })
    ).not.toBeInTheDocument();
});
