/** @jest-environment jsdom */
import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import ReviewsContainer from "./reviews-container";
import { getUserReviews } from "@/queries/profile";

// Mock the query
jest.mock("@/queries/profile", () => ({
    getUserReviews: jest.fn(),
}));

// Mock ReviewCard
jest.mock("../../cards/review", () => {
    return function DummyReviewCard({ review }: { review: any }) {
        return (
            <div data-testid="review-card">
                <span>{review.review}</span>
                <span>Rating: {review.rating}</span>
            </div>
        );
    };
});

// Mock ReviewsHeader
jest.mock("./reviews-header", () => {
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
                <button data-testid="btn-filter" onClick={() => setFilter("1star")}>
                    Set Filter 1 Star
                </button>
                <button data-testid="btn-period" onClick={() => setPeriod("last-month")}>
                    Set Period Last Month
                </button>
                <button data-testid="btn-search" onClick={() => setSearch("good")}>
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

const mockReviews = [
    {
        id: "review-1",
        review: "Excellent product, highly recommended!",
        rating: 5,
        reviewImage: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { name: "John Doe", picture: "" },
    },
    {
        id: "review-2",
        review: "Average quality, could be better.",
        rating: 3,
        reviewImage: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        user: { name: "Jane Smith", picture: "" },
    },
];

describe("ReviewsContainer Component", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders reviews container and cards correctly", async () => {
        (getUserReviews as jest.Mock).mockResolvedValue({
            reviews: mockReviews,
            totalPages: 2,
        });

        await act(async () => {
            render(<ReviewsContainer reviews={mockReviews} totalPages={2} />);
        });

        expect(screen.getByText("Excellent product, highly recommended!")).toBeInTheDocument();
        expect(screen.getByText("Average quality, could be better.")).toBeInTheDocument();
        expect(screen.getByText("Rating: 5")).toBeInTheDocument();
        expect(screen.getByText("Rating: 3")).toBeInTheDocument();
    });

    it("resets page to 1 when filters or search change", async () => {
        (getUserReviews as jest.Mock).mockResolvedValue({
            reviews: [],
            totalPages: 1,
        });

        await act(async () => {
            render(<ReviewsContainer reviews={mockReviews} totalPages={5} />);
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

    it("does not update state when component is unmounted during fetch", async () => {
        let resolveRequest: (value: any) => void = () => {};
        const fetchPromise = new Promise((resolve) => {
            resolveRequest = resolve;
        });

        (getUserReviews as jest.Mock).mockImplementation(() => fetchPromise);

        let unmount: () => void;
        await act(async () => {
            const renderResult = render(<ReviewsContainer reviews={mockReviews} totalPages={2} />);
            unmount = renderResult.unmount;
        });

        // Trigger page change to fetch
        const nextBtn = screen.getByTestId("btn-next");
        await act(async () => {
            fireEvent.click(nextBtn);
        });

        // Unmount before query resolves
        unmount!();

        // Resolve request
        const freshReviews = [
            {
                id: "review-3",
                review: "Should not render this",
                rating: 1,
                reviewImage: [],
                createdAt: new Date(),
                updatedAt: new Date(),
                user: { name: "Bob", picture: "" },
            },
        ];

        await act(async () => {
            resolveRequest({
                reviews: freshReviews,
                totalPages: 1,
            });
        });

        // Query shouldn't crash or update state on unmounted component
        expect(screen.queryByText("Should not render this")).not.toBeInTheDocument();
    });

    it("logs console error when getUserReviews fails", async () => {
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        const error = new Error("Database query timeout");
        (getUserReviews as jest.Mock).mockRejectedValue(error);

        await act(async () => {
            render(<ReviewsContainer reviews={mockReviews} totalPages={2} />);
        });

        expect(consoleSpy).toHaveBeenCalledWith(
            "[ReviewsContainer:getData] Error fetching reviews:",
            error.message,
            error.stack
        );
        consoleSpy.mockRestore();
    });

    it("logs generic console error when non-Error object is thrown", async () => {
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        (getUserReviews as jest.Mock).mockRejectedValue("arbitrary string error");

        await act(async () => {
            render(<ReviewsContainer reviews={mockReviews} totalPages={2} />);
        });

        expect(consoleSpy).toHaveBeenCalledWith(
            "[ReviewsContainer:getData] Unknown error:",
            "arbitrary string error"
        );
        consoleSpy.mockRestore();
    });
});
