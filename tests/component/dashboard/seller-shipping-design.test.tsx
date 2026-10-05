/** @jest-environment jsdom */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Prisma } from "@prisma/client";
import Defaults from "@/components/dashboard/forms/store-default-shipping-details";
import Rate from "@/components/dashboard/forms/shippingRate-details";
import Page from "@/app/dashboard/seller/stores/[storeUrl]/shipping/page";
import ModalProvider from "@/providers/modal-provider";
import {
    getStoreDefaultShippingDetails,
    getStoreShippingRates,
} from "@/queries/store";

jest.mock("@/queries/store", () => ({
    getStoreDefaultShippingDetails: jest.fn(),
    getStoreShippingRates: jest.fn(),
    updateStoreDefaultShippingDetails: jest.fn(),
    upsertShippingRate: jest.fn(),
}));
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn() }),
    useParams: () => ({ storeUrl: "example" }),
    redirect: jest.fn(),
}));
jest.mock("@/hooks/use-toast", () => ({
    useToast: () => ({ toast: jest.fn() }),
}));
jest.mock("uuid", () => ({ v4: () => "rate-new" }));
const decimal = (n: number) => new Prisma.Decimal(n);
const defaults = {
    defaultShippingService: "Standard",
    defaultShippingFeePerItem: decimal(12.5),
    defaultShippingFeeForAdditionalItem: decimal(2.5),
    defaultShippingFeePerKg: decimal(1),
    defaultShippingFeeFixed: decimal(0),
    defaultDeliveryTimeMin: 1,
    defaultDeliveryTimeMax: 5,
    returnPolicy: "Existing return policy",
};
const row = {
    countryId: "33333333-3333-4333-8333-333333333333",
    countryName: "Japan",
    shippingRate: {
        id: "rate-1",
        shippingService: "Standard",
        shippingFeePerItem: decimal(12.5),
        shippingFeeForAdditionalItem: decimal(2.5),
        shippingFeePerKg: decimal(1),
        shippingFeeFixed: decimal(0),
        deliveryTimeMin: 1,
        deliveryTimeMax: 5,
        returnPolicy: "Existing return policy",
    },
};
beforeEach(() => {
    jest.clearAllMocks();
});
it("labels shipping settings and keeps country search, Decimal dollar amounts and default/free display", async () => {
    jest.mocked(getStoreDefaultShippingDetails).mockResolvedValueOnce(
        defaults as never
    );
    jest.mocked(getStoreShippingRates).mockResolvedValueOnce([
        row,
        { countryId: "other", countryName: "Other", shippingRate: null },
    ] as never);
    const user = userEvent.setup();
    render(
        <ModalProvider>
            {await Page({ params: Promise.resolve({ storeUrl: "example" }) })}
        </ModalProvider>
    );
    expect(
        screen.getByRole("heading", { level: 1, name: "Shipping settings" })
    ).toBeInTheDocument();
    expect(screen.getByText("$12.50")).toBeInTheDocument();
    expect(screen.getAllByText("Free")).not.toHaveLength(0);
    await user.type(
        screen.getByRole("searchbox", { name: "Search by country name..." }),
        "Japan"
    );
    expect(screen.queryByText("Other")).not.toBeInTheDocument();
    expect(
        screen.getByRole("button", { name: "Actions for Japan" })
    ).toBeInTheDocument();
});
it("locks defaults during an injected save and retains values after failure for retry", async () => {
    let reject!: (error: Error) => void;
    const action = jest
        .fn()
        .mockImplementationOnce(
            () =>
                new Promise((_, r) => {
                    reject = r;
                })
        )
        .mockResolvedValueOnce({ id: "store-1" });
    const props = { updateDefaultsAction: action, design: "seller" as const };
    render(<Defaults data={defaults as never} storeUrl="example" {...props} />);
    const form = screen.getByRole("form", { name: "Default shipping details" });
    expect(
        screen.getByRole("spinbutton", { name: "Shipping fee per item" })
    ).toHaveValue(12.5);
    fireEvent.submit(form);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(
        screen.getByRole("textbox", { name: "Shipping service" })
    ).toBeDisabled();
    fireEvent.submit(form);
    expect(action).toHaveBeenCalledTimes(1);
    reject(new Error("Private DB failure"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
        "Please try again"
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(
        "Private DB failure"
    );
    expect(
        screen.getByRole("textbox", { name: "Shipping service" })
    ).toHaveValue("Standard");
    fireEvent.submit(form);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(action).toHaveBeenLastCalledWith(
        "example",
        expect.objectContaining({
            defaultShippingFeePerItem: 12.5,
            defaultShippingFeeFixed: 0,
            returnPolicy: "Existing return policy",
        })
    );
    expect(screen.getByRole("status")).toHaveTextContent(
        "Shipping details saved"
    );
});
it("keeps the delivery range validation before defaults save", async () => {
    const action = jest.fn();
    render(
        <Defaults
            data={defaults as never}
            storeUrl="example"
            {...{ updateDefaultsAction: action }}
        />
    );
    fireEvent.change(
        screen.getByRole("spinbutton", { name: "Delivery time max" }),
        { target: { value: "0" } }
    );
    fireEvent.submit(
        screen.getByRole("form", { name: "Default shipping details" })
    );
    await screen.findByText(/Maximum delivery time/);
    expect(action).not.toHaveBeenCalled();
});
it("sends country-rate identity and unchanged dollar amounts through the injected action", async () => {
    const action = jest.fn().mockResolvedValue({ id: "rate-1" });
    render(
        <Rate
            data={row as never}
            storeUrl="example"
            {...{ upsertShippingRateAction: action, design: "seller" as const }}
        />
    );
    expect(
        screen.getByRole("heading", { level: 2, name: "Shipping rate" })
    ).toBeInTheDocument();
    fireEvent.submit(
        screen.getByRole("form", { name: "Shipping rate for Japan" })
    );
    await waitFor(() =>
        expect(action).toHaveBeenCalledWith(
            "example",
            expect.objectContaining({
                id: "rate-1",
                countryId: "33333333-3333-4333-8333-333333333333",
                shippingFeePerItem: 12.5,
                shippingFeeFixed: 0,
            })
        )
    );
    expect(screen.getByRole("status")).toHaveTextContent("Shipping rate saved");
});

import {
    serializeShippingDefaults,
    serializeShippingCountries,
} from "@/lib/seller-shipping";
it("serializes shipping display as plain dollar amounts and preserves absent country overrides", () => {
    const plainDefaults = JSON.parse(
        JSON.stringify(serializeShippingDefaults(defaults as never))
    );
    const plainRows = JSON.parse(
        JSON.stringify(
            serializeShippingCountries([
                row,
                {
                    countryId: "other",
                    countryName: "Other",
                    shippingRate: null,
                },
            ] as never)
        )
    );
    expect(plainDefaults.defaultShippingFeePerItem).toBe(12.5);
    expect(plainRows[0].shippingRate.shippingFeePerItem).toBe(12.5);
    expect(plainRows[0].shippingRate.shippingFeeFixed).toBe(0);
    expect(plainRows[1].shippingRate).toBeNull();
});
it("keeps an empty country list distinct from missing shipping data", async () => {
    jest.mocked(getStoreDefaultShippingDetails).mockResolvedValueOnce(
        defaults as never
    );
    jest.mocked(getStoreShippingRates).mockResolvedValueOnce([]);
    render(
        <ModalProvider>
            {await Page({ params: Promise.resolve({ storeUrl: "example" }) })}
        </ModalProvider>
    );
    expect(
        screen.getByRole("heading", { name: "Shipping settings" })
    ).toBeInTheDocument();
    expect(screen.getByText("No Results.")).toBeInTheDocument();
});
