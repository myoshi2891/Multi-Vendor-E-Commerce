/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import RatingStatisticsCard from "@/components/store/cards/rating-statistics";
import type { StatisticsCardType } from "@/lib/types";

// react-rating-stars-component は数値 value を出すだけの軽量モックに置換
jest.mock("react-rating-stars-component", () => ({
    __esModule: true,
    default: ({ value }: { value: number }) => (
        <span data-testid="stars">{value}</span>
    ),
}));

const stats: StatisticsCardType = [
    { rating: 1, numReviews: 2, percentage: 10 },
    { rating: 2, numReviews: 4, percentage: 20 },
    { rating: 5, numReviews: 30, percentage: 70 },
];

describe("RatingStatisticsCard", () => {
    it("renders one row per rating bucket", () => {
        // Arrange & Act
        render(<RatingStatisticsCard statistics={stats} />);

        // Assert
        expect(screen.getAllByTestId("stars")).toHaveLength(3);
    });

    it("renders buckets in descending rating order (reversed)", () => {
        // Arrange & Act
        render(<RatingStatisticsCard statistics={stats} />);

        // Assert: slice().reverse() で 5 → 2 → 1 の順に並ぶ
        const rows = screen.getAllByTestId("stars").map((n) => n.textContent);
        expect(rows).toEqual(["5", "2", "1"]);
    });

    it("sets each bar width from the percentage", () => {
        // Arrange & Act
        const { container } = render(
            <RatingStatisticsCard statistics={stats} />,
        );

        // Assert: percentage が style.width に反映される (先頭は rating=5 の 70%)
        const bars = container.querySelectorAll<HTMLElement>(
            "div[style*='width']",
        );
        expect(bars[0]).toHaveStyle({ width: "70%" });
    });

    it("shows the review count per bucket", () => {
        // Arrange & Act
        render(<RatingStatisticsCard statistics={stats} />);

        // Assert
        expect(screen.getByText("30")).toBeInTheDocument();
        expect(screen.getByText("4")).toBeInTheDocument();
    });
});
