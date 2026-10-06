/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProductReviews from "@/components/store/product-page/reviews/product-reviews";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof ProductReviews>;
type Review = Props["reviews"][number];

const mockGetProductFilteredReviews = jest.fn();

jest.mock("@/queries/product", () => ({
    getProductFilteredReviews: (...args: unknown[]) =>
        mockGetProductFilteredReviews(...args),
}));
jest.mock("@/components/store/cards/product-rating", () => () => null);
jest.mock("@/components/store/cards/rating-statistics", () => () => null);
jest.mock(
    "@/components/store/cards/review",
    () =>
        function ReviewCardMock({ review }: { review: { id: string } }) {
            return <article data-testid="review">{review.id}</article>;
        }
);
jest.mock("@/components/store/product-page/reviews/filters", () => () => null);
jest.mock("@/components/store/product-page/reviews/sort", () => () => null);
jest.mock("@/components/store/forms/review-details", () => () => null);

const makeReviews = (ids: string[]): Review[] =>
    ids.map((id) => ({ id }) as unknown as Review);

const statistics = {
    totalReviews: 10,
    ratingStatistics: [],
} as unknown as Props["statistics"];

describe("ProductReviews pagination", () => {
    beforeEach(() => {
        mockGetProductFilteredReviews.mockReset();
    });

    it("rounds up the page count and keeps pagination on a short final page", async () => {
        // Arrange: 10 件 / 1 ページ 4 件 → 3 ページ（最終ページは 2 件）
        const firstPage = makeReviews(["r1", "r2", "r3", "r4"]);
        mockGetProductFilteredReviews.mockImplementation(
            async (_id: string, _f: unknown, _s: unknown, page: number) =>
                page === 3 ? makeReviews(["r9", "r10"]) : firstPage
        );
        render(
            <ProductReviews
                productId="p1"
                rating={4}
                statistics={statistics}
                reviews={firstPage}
                variantsInfo={[]}
            />
        );
        const nav = screen.getByRole("navigation", { name: "Review pages" });
        expect(nav).toHaveTextContent("3");

        // Act
        fireEvent.click(screen.getByRole("button", { name: "3" }));

        // Assert
        await waitFor(() =>
            expect(screen.getAllByTestId("review")).toHaveLength(2)
        );
        expect(
            screen.getByRole("navigation", { name: "Review pages" })
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "3" })).toHaveAttribute(
            "aria-current",
            "page"
        );
        expect(screen.getByRole("button", { name: /Previous/ })).toBeEnabled();
        expect(screen.getByRole("button", { name: /Next/ })).toBeDisabled();
    });

    it("hides pagination when all reviews fit on one page", () => {
        // Arrange
        mockGetProductFilteredReviews.mockResolvedValue(
            makeReviews(["r1", "r2", "r3"])
        );

        // Act
        render(
            <ProductReviews
                productId="p1"
                rating={4}
                statistics={
                    {
                        totalReviews: 3,
                        ratingStatistics: [],
                    } as unknown as Props["statistics"]
                }
                reviews={makeReviews(["r1", "r2", "r3"])}
                variantsInfo={[]}
            />
        );

        // Assert
        expect(
            screen.queryByRole("navigation", { name: "Review pages" })
        ).not.toBeInTheDocument();
    });
});
