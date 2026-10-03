/** @jest-environment jsdom */
import React from "react";
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import AddressContainer from "@/components/store/profile/addresses/container";
import type { UserShippingAddressType } from "@/lib/types";
import type { Country } from "@prisma/client";

jest.mock("uuid", () => ({ v4: () => "11111111-1111-4111-8111-111111111111" }));
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn() }),
}));
jest.mock("@/queries/user", () => ({
    getProfileShippingAddresses: jest.fn(),
    saveProfileShippingAddress: jest.fn(),
    makeProfileShippingAddressDefault: jest.fn(),
}));
const country = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Japan",
    code: "JP",
} as Country;
const address = {
    id: "11111111-1111-4111-8111-111111111111",
    firstName: "Mina",
    lastName: "Mori",
    phone: "+819012345678",
    address1: "12 Garden Street",
    address2: "Apartment 2",
    city: "Tokyo",
    state: "Tokyo",
    zip_code: "1000001",
    countryId: country.id,
    default: false,
    country,
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: "fixture-user",
    user: {},
} as UserShippingAddressType;
const values = {
    firstName: address.firstName,
    lastName: address.lastName,
    phone: address.phone,
    address1: address.address1,
    address2: address.address2,
    city: address.city,
    state: address.state,
    zip_code: address.zip_code,
    countryId: address.countryId,
    default: false,
};
function setup(extra = {}) {
    const loadAddressesAction = jest
        .fn()
        .mockResolvedValue({ addresses: [address], countries: [country] });
    const saveAddressAction = jest.fn().mockResolvedValue(address);
    const makeDefaultAction = jest.fn().mockResolvedValue({ id: address.id });
    const props = {
        addresses: [address],
        countries: [country],
        loadAddressesAction,
        saveAddressAction,
        makeDefaultAction,
        ...extra,
    };
    render(<AddressContainer {...props} />);
    return {
        user: userEvent.setup(),
        loadAddressesAction,
        saveAddressAction,
        makeDefaultAction,
    };
}
async function fillAddress(user: ReturnType<typeof userEvent.setup>) {
    for (const [label, value] of [
        ["First name", "Mina"],
        ["Last name", "Mori"],
        ["Phone number", "+819012345678"],
        ["Address line 1", "12 Garden Street"],
        ["City", "Tokyo"],
        ["State / Province", "Tokyo"],
        ["Postal code", "1000001"],
    ])
        await user.type(screen.getByLabelText(label, { exact: true }), value);
    await user.selectOptions(
        screen.getByRole("combobox", { name: "Country" }),
        country.id
    );
}
describe("branded profile address management", () => {
    it("shows branded heading, address details, default badge and native actions", () => {
        setup({ addresses: [{ ...address, default: true }] });
        expect(
            screen.getByRole("heading", {
                name: "My shipping addresses",
                level: 1,
            })
        ).toBeVisible();
        expect(screen.getByText("Mina Mori")).toBeVisible();
        expect(
            screen.getByText("Default address", { exact: true })
        ).toBeVisible();
        expect(
            screen.getByRole("button", { name: "Edit address for Mina Mori" })
        ).toBeVisible();
        expect(
            screen.queryByRole("button", {
                name: "Make default address for Mina Mori",
            })
        ).not.toBeInTheDocument();
    });
    it("offers an empty-state add action and accessible labeled validation", async () => {
        const { user, saveAddressAction } = setup({ addresses: [] });
        expect(
            screen.getByRole("heading", { name: "No addresses yet" })
        ).toBeVisible();
        await user.click(
            screen.getByRole("button", { name: "Add new address" })
        );
        const dialog = screen.getByRole("dialog", {
            name: "Add shipping address",
        });
        expect(
            within(dialog).getByRole("combobox", { name: "Country" })
        ).toHaveValue("");
        await user.click(screen.getByRole("button", { name: "Save address" }));
        await waitFor(() =>
            expect(
                screen.getByLabelText("First name", { exact: true })
            ).toHaveAttribute("aria-invalid", "true")
        );
        expect(saveAddressAction).not.toHaveBeenCalled();
    });
    it("restores edit values, submits the same id and shows saved changes", async () => {
        const { user, saveAddressAction } = setup();
        await user.click(
            screen.getByRole("button", { name: "Edit address for Mina Mori" })
        );
        expect(screen.getByLabelText(/^Address line 2/)).toHaveValue(
            "Apartment 2"
        );
        expect(screen.getByRole("combobox", { name: "Country" })).toHaveValue(
            country.id
        );
        await user.click(screen.getByRole("button", { name: "Save address" }));
        await waitFor(() =>
            expect(saveAddressAction).toHaveBeenCalledWith({
                ...values,
                id: address.id,
            })
        );
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("Address saved");
    });
    it("closes the editor and reloads when the saved country is not listed", async () => {
        const saveAddressAction = jest.fn().mockResolvedValue({
            ...address,
            countryId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        });
        const { user, loadAddressesAction } = setup({ saveAddressAction });
        await user.click(
            screen.getByRole("button", { name: "Edit address for Mina Mori" })
        );
        await user.click(screen.getByRole("button", { name: "Save address" }));
        await waitFor(() =>
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
        );
        await waitFor(() =>
            expect(loadAddressesAction).toHaveBeenCalledTimes(1)
        );
        expect(screen.getAllByRole("status")[0]).toHaveTextContent(
            "Address saved"
        );
        expect(
            await screen.findByRole("button", { name: "Refresh addresses" })
        ).toBeEnabled();
    });
    it("locks pending save, retains values after failure and retries without duplicates", async () => {
        let reject!: (error: Error) => void;
        const pending = new Promise<never>((_, fail) => {
            reject = fail;
        });
        const saveAddressAction = jest
            .fn()
            .mockReturnValueOnce(pending)
            .mockResolvedValue(address);
        const { user } = setup({ addresses: [], saveAddressAction });
        await user.click(
            screen.getByRole("button", { name: "Add new address" })
        );
        await fillAddress(user);
        await user.click(screen.getByRole("button", { name: "Save address" }));
        expect(
            screen.getByRole("button", { name: "Saving address…" })
        ).toBeDisabled();
        expect(screen.getByRole("dialog")).toHaveAttribute("tabindex", "0");
        expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
        expect(
            screen.getByRole("button", { name: "Close address form" })
        ).toBeDisabled();
        await act(async () =>
            fireEvent.submit(
                screen.getByRole("form", { name: "Shipping address form" })
            )
        );
        expect(saveAddressAction).toHaveBeenCalledTimes(1);
        await act(async () => reject(new Error("private database details")));
        expect(screen.getByRole("alert")).toHaveTextContent(
            "We couldn’t save this address"
        );
        expect(
            screen.getByLabelText("First name", { exact: true })
        ).toHaveValue("Mina");
        expect(
            screen.queryByText("private database details")
        ).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Save address" }));
        await waitFor(() =>
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
        );
        expect(screen.getByText("Mina Mori")).toBeVisible();
        expect(saveAddressAction).toHaveBeenCalledTimes(2);
    });
    it("updates just one default and preserves the list after a failed default change", async () => {
        const other = {
            ...address,
            id: "22222222-2222-4222-8222-222222222222",
            firstName: "Yuki",
            default: true,
        };
        const makeDefaultAction = jest
            .fn()
            .mockRejectedValueOnce(new Error("private"))
            .mockResolvedValue({ id: address.id });
        const { user } = setup({
            addresses: [address, other],
            makeDefaultAction,
        });
        await user.click(
            screen.getByRole("button", {
                name: "Make default address for Mina Mori",
            })
        );
        await waitFor(() =>
            expect(screen.getByRole("alert")).toHaveTextContent(
                "We couldn’t update the default address"
            )
        );
        expect(
            screen.getAllByText("Default address", { exact: true })
        ).toHaveLength(1);
        await user.click(
            screen.getByRole("button", {
                name: "Make default address for Mina Mori",
            })
        );
        await waitFor(() =>
            expect(screen.getByRole("status")).toHaveTextContent(
                "Default address updated"
            )
        );
        expect(
            screen.getAllByText("Default address", { exact: true })
        ).toHaveLength(1);
        expect(makeDefaultAction).toHaveBeenLastCalledWith(address.id);
    });
    it("provides initial load failure with retry and pending feedback", async () => {
        let resolve!: (value: {
            addresses: UserShippingAddressType[];
            countries: Country[];
        }) => void;
        const loadAddressesAction = jest.fn().mockImplementation(
            () =>
                new Promise((done) => {
                    resolve = done;
                })
        );
        const { user } = setup({ initialError: true, loadAddressesAction });
        expect(screen.getByRole("alert")).toHaveTextContent(
            "We couldn’t load your addresses"
        );
        await user.click(screen.getByRole("button", { name: "Try again" }));
        expect(screen.getByRole("status")).toHaveTextContent(
            "Loading addresses"
        );
        await act(async () =>
            resolve({ addresses: [address], countries: [country] })
        );
        expect(screen.getByText("Mina Mori")).toBeVisible();
    });
});

// Implementation regression checks, added after the feature Green.
describe("address server boundary and initial states", () => {
    it("uses server data without a duplicate mount request", () => {
        const { loadAddressesAction } = setup();
        expect(loadAddressesAction).not.toHaveBeenCalled();
    });
    it("disables adding an address when no supported countries exist", () => {
        setup({ countries: [] });
        expect(
            screen.getByRole("button", { name: "Add new address" })
        ).toBeDisabled();
    });
    it("renders the route loading status with the same heading", async () => {
        const { default: Loading } = await import(
            "@/app/(store)/profile/addresses/loading"
        );
        render(<Loading />);
        expect(
            screen.getByRole("heading", {
                name: "My shipping addresses",
                level: 1,
            })
        ).toBeVisible();
        expect(
            screen.getByRole("region", { name: "Shipping address management" })
        ).toHaveAttribute("aria-busy", "true");
    });
    it("turns initial server query failure into retry feedback", async () => {
        const queries = await import("@/queries/user");
        (
            queries.getProfileShippingAddresses as jest.Mock
        ).mockRejectedValueOnce(new Error("private DB details"));
        const { default: Page } = await import(
            "@/app/(store)/profile/addresses/page"
        );
        render(await Page());
        expect(screen.getByRole("alert")).toHaveTextContent(
            "We couldn’t load your addresses"
        );
        expect(
            screen.queryByText("private DB details")
        ).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    });
});
