/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import ShippingAddresses from "@/components/store/shared/shipping-addresses/shipping-addresses";
import OrderTotal from "@/components/store/cards/order/total";
import {
    createMockShippingAddress,
    createMockCountry,
    createMockUser,
} from "@/config/test-fixtures";

jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn() }),
}));
jest.mock("@/queries/user", () => ({ upsertShippingAddress: jest.fn() }));
jest.mock("uuid", () => ({ v4: () => "address-id" }));
const country = createMockCountry();
const address = {
    ...createMockShippingAddress({ default: true }),
    country,
    user: createMockUser(),
};
const Addresses = ShippingAddresses as unknown as React.ComponentType<
    Record<string, unknown>
>;
const props = () => ({
    addresses: [address],
    countries: [country],
    selectedAddress: address,
    setSelectedAddress: jest.fn(),
    disabled: false,
    actions: {
        loadAddressesAction: jest.fn().mockResolvedValue([address]),
        saveAddressAction: jest.fn(),
        makeDefaultAction: jest.fn(),
    },
    onBusyChange: jest.fn(),
});

test("shipping selection exposes a named radio and preserves its selection", () => {
    const input = props();
    input.selectedAddress = null as unknown as typeof address;
    render(<Addresses {...input} />);
    const radio = screen.getByRole("radio", {
        name: new RegExp(address.firstName),
    });
    expect(radio).not.toBeChecked();
    fireEvent.click(radio);
    expect(input.setSelectedAddress).toHaveBeenCalledWith(address);
});

test("address dialog has labels, Escape closes and restores focus", async () => {
    render(<Addresses {...props()} />);
    const trigger = screen.getByRole("button", { name: "Add new address" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(
        screen.getByRole("dialog", { name: "Add new address" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    expect(trigger).toHaveFocus();
});

test("address dialog reports invalid fields without saving", async () => {
    const input = props();
    render(<Addresses {...input} />);
    fireEvent.click(screen.getByRole("button", { name: "Add new address" }));
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Please check");
    expect(input.actions.saveAddressAction).not.toHaveBeenCalled();
});

test("order summary has a section heading and a single total", () => {
    render(
        <OrderTotal details={{ subTotal: 20, shippingFees: 5, total: 25 }} />
    );
    expect(
        screen.getByRole("heading", { name: "Order summary", level: 2 })
    ).toBeInTheDocument();
    expect(screen.getByTestId("order-total")).toHaveTextContent("$25.00");
});

test("failed address reload does not replay a previous save after invalid input", async () => {
    const country = createMockCountry({
        id: "8fa7d3a0-e04f-4eec-ab77-afc9c08b475e",
    });
    const address = {
        ...createMockShippingAddress({ countryId: country.id }),
        country,
        user: createMockUser(),
    };
    const input = {
        ...props(),
        addresses: [address],
        countries: [country],
        selectedAddress: address,
    };
    input.actions.saveAddressAction.mockResolvedValue(address);
    input.actions.loadAddressesAction.mockRejectedValue(
        new Error("load failed")
    );
    render(<Addresses {...input} />);
    fireEvent.click(
        screen.getByRole("button", { name: "Edit address for Test User" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));
    await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    );
    await screen.findByRole("button", { name: "Retry addresses" });
    expect(input.actions.loadAddressesAction).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Add new address" }));
    fireEvent.click(screen.getByRole("button", { name: "Save address" }));
    expect(
        await screen.findByText("Please check the highlighted fields.")
    ).toBeInTheDocument();
    await waitFor(() =>
        expect(
            screen.getByRole("button", { name: "Save address" })
        ).toBeEnabled()
    );
    expect(input.actions.loadAddressesAction).toHaveBeenCalledTimes(1);
});
