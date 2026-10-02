/** @jest-environment jsdom */
import React from "react";
import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import PaymentsTable, { type PaymentHistoryEntry } from "./payments-table";
import ProfilePaymentPage from "@/app/(store)/profile/payment/page";
import PaymentLoading from "@/app/(store)/profile/payment/loading";
import { getUserPaymentsForDisplay } from "@/queries/profile";

jest.mock("@/queries/profile", () => ({
    getUserPaymentsForDisplay: jest.fn(),
}));
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn() }),
}));

const payment = (
    amount: number | string,
    method = "Stripe"
): PaymentHistoryEntry =>
    ({
        id: "payment-one",
        paymentIntentId: "pi_one",
        paymentMethod: method,
        amount,
        status: "Completed",
        orderId: "order-one",
        updatedAt: new Date("2026-10-01T00:00:00Z"),
    }) as unknown as PaymentHistoryEntry;
const result = { payments: [payment(42.5)], totalPages: 2 };
function setup(extra = {}) {
    const fetchPaymentsAction = jest.fn().mockResolvedValue(result);
    const props = { ...result, fetchPaymentsAction, ...extra };
    render(<PaymentsTable {...props} />);
    return { user: userEvent.setup(), fetchPaymentsAction };
}
describe("branded payment history", () => {
    it.each(["Stripe", "PayPal"])(
        "preserves serialized dollar amounts for %s without dividing by 100",
        (method) => {
            setup({ payments: [payment("42.50", method)], totalPages: 1 });
            expect(screen.getByText("$42.50")).toBeVisible();
            expect(screen.queryByText("$0.43")).not.toBeInTheDocument();
            expect(screen.getByText("pi_one")).toBeVisible();
            expect(screen.getByText("#payment-one")).toBeVisible();
        }
    );
    it("provides branded heading, empty collection link and named controls", () => {
        setup({ payments: [], totalPages: 0 });
        expect(
            screen.getByRole("heading", { name: "My payments", level: 1 })
        ).toBeVisible();
        expect(
            screen.getByRole("heading", { name: "No payments yet" })
        ).toBeVisible();
        expect(
            screen.getByRole("link", { name: "Explore the collection" })
        ).toHaveAttribute("href", "/browse");
        expect(
            screen.getByRole("button", { name: "View all" })
        ).toHaveAttribute("aria-pressed", "true");
        expect(
            screen.getByRole("combobox", { name: "Payment period" })
        ).toBeVisible();
        expect(
            screen.queryByRole("navigation", { name: "Payments pagination" })
        ).not.toBeInTheDocument();
    });
    it("submits search and empty-search reset at page one", async () => {
        const { user, fetchPaymentsAction } = setup();
        await user.click(screen.getByRole("button", { name: "Next page" }));
        await waitFor(() =>
            expect(fetchPaymentsAction).toHaveBeenLastCalledWith("", "", "", 2)
        );
        await user.type(
            screen.getByRole("searchbox", { name: "Search payments" }),
            "pi_one"
        );
        await user.click(screen.getByRole("button", { name: "Search" }));
        await waitFor(() =>
            expect(fetchPaymentsAction).toHaveBeenLastCalledWith(
                "",
                "",
                "pi_one",
                1
            )
        );
        await user.clear(
            screen.getByRole("searchbox", { name: "Search payments" })
        );
        await user.keyboard("{Enter}");
        await waitFor(() =>
            expect(fetchPaymentsAction).toHaveBeenLastCalledWith("", "", "", 1)
        );
    });
    it("preserves method/period on paging and clears every condition", async () => {
        const { user, fetchPaymentsAction } = setup();
        await user.click(screen.getByRole("button", { name: "PayPal" }));
        await user.selectOptions(
            screen.getByRole("combobox", { name: "Payment period" }),
            "last-1-year"
        );
        await waitFor(() =>
            expect(fetchPaymentsAction).toHaveBeenLastCalledWith(
                "paypal",
                "last-1-year",
                "",
                1
            )
        );
        await user.click(screen.getByRole("button", { name: "Next page" }));
        await waitFor(() =>
            expect(fetchPaymentsAction).toHaveBeenLastCalledWith(
                "paypal",
                "last-1-year",
                "",
                2
            )
        );
        expect(
            screen.getByRole("button", { name: "Next page" })
        ).toBeDisabled();
        await user.click(
            screen.getByRole("button", { name: "Remove all filters" })
        );
        await waitFor(() =>
            expect(fetchPaymentsAction).toHaveBeenLastCalledWith("", "", "", 1)
        );
        expect(
            screen.getByRole("combobox", { name: "Payment period" })
        ).toHaveValue("");
        expect(
            screen.getByRole("button", { name: "Previous page" })
        ).toBeDisabled();
    });
    it("locks pending controls, prevents duplicate requests, hides stale results and retries", async () => {
        let reject!: (error: Error) => void;
        const pending = new Promise<never>((_, fail) => {
            reject = fail;
        });
        const fetchPaymentsAction = jest
            .fn()
            .mockReturnValueOnce(pending)
            .mockResolvedValue(result);
        const { user } = setup({ fetchPaymentsAction });
        await user.click(screen.getByRole("button", { name: "Credit card" }));
        expect(screen.getByRole("status")).toHaveTextContent(
            "Loading payments"
        );
        expect(screen.getByRole("button", { name: "Search" })).toBeDisabled();
        expect(screen.queryByText("$42.50")).not.toBeInTheDocument();
        fireEvent.submit(screen.getByRole("search"));
        expect(fetchPaymentsAction).toHaveBeenCalledTimes(1);
        await act(async () => reject(new Error("private database details")));
        expect(screen.getByRole("alert")).toHaveTextContent(
            "We couldn’t load your payments"
        );
        expect(
            screen.queryByText("private database details")
        ).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Try again" }));
        await waitFor(() => expect(screen.getByText("$42.50")).toBeVisible());
        expect(fetchPaymentsAction).toHaveBeenLastCalledWith(
            "credit-card",
            "",
            "",
            1
        );
    });
    it("distinguishes filtered empty results and initial errors with retry/detail links", async () => {
        const fetchPaymentsAction = jest
            .fn()
            .mockResolvedValueOnce({ payments: [], totalPages: 0 })
            .mockResolvedValue(result);
        const { user } = setup({ initialError: true, fetchPaymentsAction });
        expect(screen.getByRole("alert")).toBeVisible();
        await user.click(screen.getByRole("button", { name: "Try again" }));
        await waitFor(() =>
            expect(
                screen.getByRole("heading", { name: "No payments yet" })
            ).toBeVisible()
        );
        fetchPaymentsAction.mockResolvedValueOnce({
            payments: [],
            totalPages: 0,
        });
        await user.click(screen.getByRole("button", { name: "PayPal" }));
        await waitFor(() =>
            expect(
                screen.getByRole("heading", { name: "No matching payments" })
            ).toBeVisible()
        );
        await user.click(screen.getByRole("button", { name: "View all" }));
        await waitFor(() =>
            expect(
                screen.getByRole("link", {
                    name: "View order for payment payment-one",
                })
            ).toHaveAttribute("href", "/order/order-one")
        );
    });
});

describe("server and loading boundary regression", () => {
    beforeEach(() => jest.clearAllMocks());
    it("renders initial lookup failure with generic retry", async () => {
        (getUserPaymentsForDisplay as jest.Mock).mockRejectedValueOnce(
            new Error("private provider details")
        );
        render(await ProfilePaymentPage());
        expect(screen.getByRole("alert")).toHaveTextContent(
            "We couldn’t load your payments"
        );
        expect(
            screen.queryByText("private provider details")
        ).not.toBeInTheDocument();
    });
    it("does not refetch successful initial data during hydration", async () => {
        (getUserPaymentsForDisplay as jest.Mock).mockResolvedValueOnce(result);
        render(await ProfilePaymentPage());
        expect(getUserPaymentsForDisplay).toHaveBeenCalledTimes(1);
        expect(screen.getByText("$42.50")).toBeVisible();
    });
    it("announces route loading with the shared heading", () => {
        render(<PaymentLoading />);
        expect(
            screen.getByRole("heading", { name: "My payments", level: 1 })
        ).toBeVisible();
        expect(screen.getByRole("status")).toHaveTextContent(
            "Loading payments"
        );
        expect(
            screen.getByRole("region", { name: "Payment history" })
        ).toHaveAttribute("aria-busy", "true");
    });
});
