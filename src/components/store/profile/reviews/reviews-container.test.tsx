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
import ReviewsContainer from "./reviews-container";
import { getUserReviews } from "@/queries/profile";

jest.mock("@/queries/profile", () => ({
    getUserReviews: jest.fn(),
    getUserReviewsForDisplay: jest.fn(),
}));
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn() }),
}));
jest.mock("../../cards/review", () => ({
    __esModule: true,
    default: ({ review }: { review: { review: string } }) => (
        <p>{review.review}</p>
    ),
}));
jest.mock("next/image", () => ({
    __esModule: true,
    default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
        <img {...props} />
    ),
}));
const review = {
    id: "review-one",
    rating: 4.5,
    review: "A lovely discovery.",
    variant: "Silk scarf",
    color: "Gold, Green",
    size: "One size",
    quantity: "2",
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    createdAt: new Date(),
    likes: 0,
    userId: "user-one",
    productId: "product-one",
    user: { name: "Mina Mori", picture: "" },
    images: [
        {
            id: "photo",
            url: "/assets/images/to-de-reviewed.webp",
            alt: "Scarf detail",
        },
    ],
};
const result = { reviews: [review], totalPages: 3 };
function setup(extra = {}) {
    const fetchReviewsAction = jest.fn().mockResolvedValue(result);
    const props = { ...result, fetchReviewsAction, ...extra };
    render(<ReviewsContainer {...props} />);
    return { user: userEvent.setup(), fetchReviewsAction };
}
beforeEach(() => {
    jest.clearAllMocks();
    (getUserReviews as jest.Mock).mockResolvedValue(result);
});
describe("Profile review design system", () => {
    it("renders branded heading, review details and labeled controls", () => {
        setup();
        expect(
            screen.getByRole("heading", { name: "My reviews", level: 1 })
        ).toBeVisible();
        expect(screen.getByText("A lovely discovery.")).toBeVisible();
        expect(screen.getByText("4.5 out of 5 stars")).toBeVisible();
        expect(screen.getByText("Gold, Green")).toBeVisible();
        expect(screen.getByText("One size")).toBeVisible();
        expect(screen.getByRole("img", { name: "Scarf detail" })).toBeVisible();
        expect(
            screen.getByRole("button", { name: "View all" })
        ).toHaveAttribute("aria-pressed", "true");
        expect(
            screen.getByRole("combobox", { name: "Review period" })
        ).toHaveValue("");
        expect(
            screen.getByRole("searchbox", { name: "Search reviews" })
        ).toBeVisible();
    });
    it("shows empty and condition-specific empty states", async () => {
        const fetchReviewsAction = jest
            .fn()
            .mockResolvedValue({ reviews: [], totalPages: 0 });
        const { user } = setup({
            reviews: [],
            totalPages: 0,
            fetchReviewsAction,
        });
        expect(
            screen.getByRole("heading", { name: "No reviews yet" })
        ).toBeVisible();
        expect(
            screen.getByRole("link", { name: "Explore the collection" })
        ).toHaveAttribute("href", "/browse");
        await user.click(screen.getByRole("button", { name: "5 stars" }));
        expect(
            await screen.findByRole("heading", { name: "No matching reviews" })
        ).toBeVisible();
    });
    it("preserves conditions during paging and resets all conditions", async () => {
        const { user, fetchReviewsAction } = setup();
        await user.click(screen.getByRole("button", { name: "Next page" }));
        expect(fetchReviewsAction).toHaveBeenLastCalledWith("", "", "", 2);
        await user.click(screen.getByRole("button", { name: "4 stars" }));
        expect(fetchReviewsAction).toHaveBeenLastCalledWith("4", "", "", 1);
        await user.selectOptions(
            screen.getByRole("combobox", { name: "Review period" }),
            "last-1-year"
        );
        await user.type(
            screen.getByRole("searchbox", { name: "Search reviews" }),
            "lovely{Enter}"
        );
        expect(fetchReviewsAction).toHaveBeenLastCalledWith(
            "4",
            "last-1-year",
            "lovely",
            1
        );
        await user.click(screen.getByRole("button", { name: "Next page" }));
        expect(fetchReviewsAction).toHaveBeenLastCalledWith(
            "4",
            "last-1-year",
            "lovely",
            2
        );
        await user.click(
            screen.getByRole("button", { name: "Remove all filters" })
        );
        expect(fetchReviewsAction).toHaveBeenLastCalledWith("", "", "", 1);
        expect(screen.getByRole("searchbox")).toHaveValue("");
        expect(screen.getByRole("combobox")).toHaveValue("");
    });
    it("uses explicit search and allows empty search to clear it", async () => {
        const { user, fetchReviewsAction } = setup();
        await user.type(
            screen.getByRole("searchbox", { name: "Search reviews" }),
            "a"
        );
        expect(fetchReviewsAction).not.toHaveBeenCalled();
        await user.click(screen.getByRole("button", { name: "Search" }));
        expect(fetchReviewsAction).toHaveBeenLastCalledWith("", "", "a", 1);
        await user.clear(screen.getByRole("searchbox"));
        await user.click(screen.getByRole("button", { name: "Search" }));
        expect(fetchReviewsAction).toHaveBeenLastCalledWith("", "", "", 1);
    });
    it("locks pending lookups, hides stale data and retries a generic failure", async () => {
        let reject!: (reason: Error) => void;
        const fetchReviewsAction = jest
            .fn()
            .mockImplementationOnce(
                () =>
                    new Promise((_, fail) => {
                        reject = fail;
                    })
            )
            .mockResolvedValue(result);
        const { user } = setup({ fetchReviewsAction });
        await user.click(screen.getByRole("button", { name: "5 stars" }));
        expect(screen.getByRole("status")).toHaveTextContent("Loading reviews");
        expect(
            screen.queryByText("A lovely discovery.")
        ).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "4 stars" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "4 stars" }));
        expect(fetchReviewsAction).toHaveBeenCalledTimes(1);
        await act(async () => reject(new Error("private DB details")));
        expect(screen.getByRole("alert")).toHaveTextContent(
            "We couldn’t load your reviews"
        );
        expect(
            screen.queryByText("private DB details")
        ).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Try again" }));
        await waitFor(() =>
            expect(screen.getByText("A lovely discovery.")).toBeVisible()
        );
        expect(fetchReviewsAction).toHaveBeenLastCalledWith("5", "", "", 1);
    });
    it("offers retry after an initial failure", async () => {
        const { user, fetchReviewsAction } = setup({ initialError: true });
        expect(screen.getByRole("alert")).toBeVisible();
        await user.click(screen.getByRole("button", { name: "Try again" }));
        expect(fetchReviewsAction).toHaveBeenLastCalledWith("", "", "", 1);
    });
    it("does not refetch initial data and respects pager boundaries", () => {
        const { fetchReviewsAction } = setup({ totalPages: 1 });
        expect(fetchReviewsAction).not.toHaveBeenCalled();
        expect(
            screen.queryByRole("navigation", { name: "Reviews pagination" })
        ).not.toBeInTheDocument();
    });
});

// Post-implementation regression checks: server boundary and unapplied search draft.
describe("Review server and loading states", () => {
    it("passes initial server data and the approved action", async () => {
        const { getUserReviewsForDisplay } = await import("@/queries/profile");
        (getUserReviewsForDisplay as jest.Mock).mockResolvedValueOnce(result);
        const { default: Page } = await import(
            "@/app/(store)/profile/reviews/page"
        );
        const element = await Page();
        expect(element.props.fetchReviewsAction).toBe(getUserReviewsForDisplay);
        render(element);
        expect(screen.getByText("A lovely discovery.")).toBeVisible();
        expect(getUserReviewsForDisplay).toHaveBeenCalledTimes(1);
    });
    it("provides a generic initial server failure with retry", async () => {
        const { getUserReviewsForDisplay } = await import("@/queries/profile");
        (getUserReviewsForDisplay as jest.Mock).mockRejectedValueOnce(
            new Error("private details")
        );
        const { default: Page } = await import(
            "@/app/(store)/profile/reviews/page"
        );
        render(await Page());
        expect(screen.getByRole("alert")).toHaveTextContent(
            "We couldn’t load your reviews"
        );
        expect(screen.queryByText("private details")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    });
    it("keeps the route loading heading and busy status", async () => {
        const { default: Loading } = await import(
            "@/app/(store)/profile/reviews/loading"
        );
        render(<Loading />);
        expect(
            screen.getByRole("heading", { name: "My reviews", level: 1 })
        ).toBeVisible();
        expect(
            screen.getByRole("region", { name: "Review history" })
        ).toHaveAttribute("aria-busy", "true");
        expect(screen.getByRole("status")).toHaveTextContent("Loading reviews");
    });
    it("does not apply an unsubmitted search when rating or period changes", async () => {
        const { user, fetchReviewsAction } = setup();
        await user.type(screen.getByRole("searchbox"), "draft");
        await user.click(screen.getByRole("button", { name: "3 stars" }));
        expect(fetchReviewsAction).toHaveBeenLastCalledWith("3", "", "", 1);
        await user.selectOptions(screen.getByRole("combobox"), "last-6-months");
        expect(fetchReviewsAction).toHaveBeenLastCalledWith(
            "3",
            "last-6-months",
            "",
            1
        );
    });
});
