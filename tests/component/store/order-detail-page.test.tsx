/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import OrderPage from "@/app/(fullscreen)/order/[orderId]/page";
import { getOrder } from "@/queries/order";
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
