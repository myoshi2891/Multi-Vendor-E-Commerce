/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Selector from "@/components/store/layout/header/country-lang-curr-selector";
const refresh = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
jest.mock("next/image", () => ({
    __esModule: true,
    default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
        <img {...props} />
    ),
}));
const fetchMock = jest.fn();
beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock;
});
async function selectCountry() {
    render(
        <Selector
            userCountry={{ name: "Japan", code: "JP", city: "", region: "" }}
        />
    );
    fireEvent.click(screen.getByLabelText(/Country, language and currency/));
    fireEvent.click(screen.getByRole("button", { name: "Ship to: Japan" }));
    await act(async () =>
        fireEvent.click(
            screen.getByRole("option", { name: "United States" })
        )
    );
}
it("announces failure, retains the country, and retries the same payload", async () => {
    fetchMock
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true });
    await selectCountry();
    expect(screen.getByRole("alert")).toHaveTextContent(
        "previous selection is unchanged"
    );
    expect(
        screen.getByRole("button", { name: "Ship to: Japan" })
    ).toBeInTheDocument();
    await act(async () =>
        fireEvent.click(screen.getByRole("button", { name: "Retry" }))
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(
        screen.getByRole("button", { name: "Ship to: United States" })
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][1].body).toBe(
        fetchMock.mock.calls[1][1].body
    );
});
it("locks the picker while saving and announces success", async () => {
    let resolve!: (value: unknown) => void;
    fetchMock.mockReturnValue(
        new Promise((r) => {
            resolve = r;
        })
    );
    await selectCountry();
    expect(
        screen.getByRole("button", { name: "Ship to: Japan" })
    ).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Saving");
    await act(async () => resolve({ ok: true }));
    expect(screen.getByRole("status")).toHaveTextContent(
        "Shipping country saved: United States"
    );
});
it("presents language and currency as fixed information", () => {
    render(
        <Selector
            userCountry={{ name: "Japan", code: "JP", city: "", region: "" }}
        />
    );
    fireEvent.click(screen.getByLabelText(/Country, language and currency/));
    expect(screen.getByText("English").tagName).toBe("DD");
    expect(screen.getByText("USD (US Dollar)").tagName).toBe("DD");
});
