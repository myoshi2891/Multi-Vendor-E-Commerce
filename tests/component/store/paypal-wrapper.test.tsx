/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import PaypalWrapper from "@/components/store/cards/payment/paypal/paypal-wrapper";
import { usePayPalScriptReducer } from "@paypal/react-paypal-js";
jest.mock("@paypal/react-paypal-js", () => ({
    PayPalScriptProvider: ({ children }: { children: React.ReactNode }) =>
        children,
    usePayPalScriptReducer: jest.fn(),
    DISPATCH_ACTION: { RESET_OPTIONS: "resetOptions" },
}));
test("PayPal script loading is announced without exposing payment buttons", () => {
    jest.mocked(usePayPalScriptReducer).mockReturnValue([
        {
            isPending: true,
            isRejected: false,
            isInitial: false,
            isResolved: false,
            options: { clientId: "fixture" },
        },
        jest.fn(),
    ]);
    render(
        <PaypalWrapper>
            <button>PayPal checkout</button>
        </PaypalWrapper>
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading PayPal");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
test("PayPal script failure exposes retry using the existing options", () => {
    const dispatch = jest.fn();
    const options = { clientId: "fixture", currency: "USD" };
    jest.mocked(usePayPalScriptReducer).mockReturnValue([
        {
            isPending: false,
            isRejected: true,
            isInitial: false,
            isResolved: false,
            options,
        },
        dispatch,
    ]);
    render(
        <PaypalWrapper>
            <button>PayPal checkout</button>
        </PaypalWrapper>
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
        "PayPal could not be loaded"
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry PayPal" }));
    expect(dispatch).toHaveBeenCalledWith({
        type: "resetOptions",
        value: options,
    });
});
