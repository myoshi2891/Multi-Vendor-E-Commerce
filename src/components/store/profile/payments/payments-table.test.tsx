/** @jest-environment jsdom */
import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import PaymentsTable from "./payments-table";
import { getUserPayments } from "@/queries/profile";
import { UserPaymentType } from "@/lib/types";

// Mock the query
jest.mock("@/queries/profile", () => ({
    getUserPayments: jest.fn(),
}));

// Mock PaymentTableHeader to isolate table search/filters
jest.mock("./payment-table-header", () => {
    return function DummyHeader({
        setFilter,
        setPeriod,
        setSearch,
    }: {
        setFilter: (v: any) => void;
        setPeriod: (v: any) => void;
        setSearch: (v: any) => void;
    }) {
        return (
            <div data-testid="dummy-header">
                <button data-testid="btn-filter" onClick={() => setFilter("PAID")}>
                    Set Filter Paid
                </button>
                <button data-testid="btn-period" onClick={() => setPeriod("last-month")}>
                    Set Period Last Month
                </button>
                <button data-testid="btn-search" onClick={() => setSearch("test-search")}>
                    Set Search Text
                </button>
            </div>
        );
    };
});

// Mock Pagination
jest.mock("../../shared/pagination", () => {
    return function DummyPagination({ page, setPage }: { page: number; setPage: (p: number) => void }) {
        return (
            <div data-testid="dummy-pagination">
                <span data-testid="current-page">{page}</span>
                <button data-testid="btn-next" onClick={() => setPage(page + 1)}>
                    Next
                </button>
            </div>
        );
    };
});

const mockPayments = [
    {
        id: "payment-1",
        paymentIntentId: "intent-1",
        paymentMethod: "Stripe",
        amount: { toNumber: () => 1000 },
        status: "COMPLETED",
        orderId: "order-1",
        updatedAt: new Date("2026-06-06T00:00:00Z"),
    },
    {
        id: "payment-2",
        paymentIntentId: "intent-2",
        paymentMethod: "PayPal",
        amount: { toNumber: () => 50 },
        status: "PENDING",
        orderId: "order-2",
        updatedAt: new Date("2026-06-06T00:00:00Z"),
    },
] as unknown as UserPaymentType[];

describe("PaymentsTable Component", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders table headers and records correctly", async () => {
        (getUserPayments as jest.Mock).mockResolvedValue({
            payments: mockPayments,
            totalPages: 2,
        });

        await act(async () => {
            render(<PaymentsTable payments={mockPayments} totalPages={2} />);
        });

        expect(screen.getByText("#payment-1")).toBeInTheDocument();
        expect(screen.getByText("#payment-2")).toBeInTheDocument();
        expect(screen.getByText("intent-1")).toBeInTheDocument();
        expect(screen.getByText("intent-2")).toBeInTheDocument();
        // Stripe uses cents: 1000 / 100 = 10.00
        expect(screen.getByText("$10.00")).toBeInTheDocument();
        // PayPal is dollar-denominated in rendering
        expect(screen.getByText("$50.00")).toBeInTheDocument();
    });

    it("resets page to 1 when filters or search change", async () => {
        (getUserPayments as jest.Mock).mockResolvedValue({
            payments: [],
            totalPages: 1,
        });

        let renderResult: any;
        await act(async () => {
            renderResult = render(<PaymentsTable payments={mockPayments} totalPages={5} />);
        });

        // 1. Move to page 2 via pagination
        const nextBtn = screen.getByTestId("btn-next");
        await act(async () => {
            fireEvent.click(nextBtn);
        });
        expect(screen.getByTestId("current-page")).toHaveTextContent("2");

        // 2. Change filter
        const filterBtn = screen.getByTestId("btn-filter");
        await act(async () => {
            fireEvent.click(filterBtn);
        });
        // page resets to 1 in render phase
        expect(screen.getByTestId("current-page")).toHaveTextContent("1");
    });

    it("protects against race conditions by discarding obsolete requests", async () => {
        let resolveRequest1: (value: any) => void = () => {};
        let resolveRequest2: (value: any) => void = () => {};

        const promise1 = new Promise((resolve) => {
            resolveRequest1 = resolve;
        });
        const promise2 = new Promise((resolve) => {
            resolveRequest2 = resolve;
        });

        // First call will return promise1, second call will return promise2
        (getUserPayments as jest.Mock)
            .mockImplementationOnce(() => promise1)
            .mockImplementationOnce(() => promise2);

        await act(async () => {
            render(<PaymentsTable payments={mockPayments} totalPages={2} />);
        });

        // Trigger request 2 by changing next page
        const nextBtn = screen.getByTestId("btn-next");
        await act(async () => {
            fireEvent.click(nextBtn); // Counter goes to 2
        });

        // Resolve request 2 first
        const secondPayments = [
            {
                id: "payment-latest",
                paymentIntentId: "intent-latest",
                paymentMethod: "Stripe",
                amount: { toNumber: () => 3000 },
                status: "COMPLETED",
                orderId: "order-latest",
                updatedAt: new Date(),
            },
        ] as unknown as UserPaymentType[];

        await act(async () => {
            resolveRequest2({
                payments: secondPayments,
                totalPages: 1,
            });
        });

        // Resolve request 1 later (simulating late arrival)
        const oldPayments = [
            {
                id: "payment-stale",
                paymentIntentId: "intent-stale",
                paymentMethod: "Stripe",
                amount: { toNumber: () => 500 },
                status: "COMPLETED",
                orderId: "order-stale",
                updatedAt: new Date(),
            },
        ] as unknown as UserPaymentType[];

        await act(async () => {
            resolveRequest1({
                payments: oldPayments,
                totalPages: 1,
            });
        });

        // Stale result should NOT be rendered
        expect(screen.queryByText("#payment-stale")).not.toBeInTheDocument();
        // Latest result should be rendered
        expect(screen.getByText("#payment-latest")).toBeInTheDocument();
    });

    it("logs console error when getUserPayments fails", async () => {
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        const error = new Error("Database network failure");
        (getUserPayments as jest.Mock).mockRejectedValue(error);

        await act(async () => {
            render(<PaymentsTable payments={mockPayments} totalPages={2} />);
        });

        expect(consoleSpy).toHaveBeenCalledWith(
            "[PaymentsTable:getData] Error fetching payments:",
            error.message,
            error.stack
        );
        consoleSpy.mockRestore();
    });

    it("logs generic console error when non-Error object is thrown", async () => {
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        (getUserPayments as jest.Mock).mockRejectedValue("string error");

        await act(async () => {
            render(<PaymentsTable payments={mockPayments} totalPages={2} />);
        });

        expect(consoleSpy).toHaveBeenCalledWith(
            "[PaymentsTable:getData] Unknown error:",
            "string error"
        );
        consoleSpy.mockRestore();
    });
});
