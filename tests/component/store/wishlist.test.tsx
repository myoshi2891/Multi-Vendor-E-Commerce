/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import WishlistContainer from "@/components/store/profile/wishlist/container";
import WishlistPage from "@/app/(store)/profile/wishlist/[page]/page";
import { getUserWishlist } from "@/queries/profile";
import WishlistLoading from "@/app/(store)/profile/wishlist/[page]/loading";
import { redirect } from "next/navigation";

jest.mock("@/queries/profile", () => ({ getUserWishlist: jest.fn() }));
jest.mock("next/navigation", () => ({
    redirect: jest.fn(),
    useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("@/components/store/shared/product-list", () => ({
    __esModule: true,
    default: ({
        products,
        variant,
    }: {
        products: { name: string }[];
        variant?: string;
    }) => (
        <div data-testid="wishlist-products" data-appearance={variant}>
            {products.map((p, i) => (
                <p key={i}>{p.name}</p>
            ))}
        </div>
    ),
}));
const query = jest.mocked(getUserWishlist);
const products = [{ id: "p1", name: "Saved piece" }] as Awaited<
    ReturnType<typeof getUserWishlist>
>["wishlist"];

beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ wishlist: products, totalPages: 3 });
});

it("uses editorial cards and links each pagination action to the wishlist route", () => {
    render(<WishlistContainer products={products} page={2} totalPages={3} />);
    expect(screen.getByTestId("wishlist-products")).toHaveAttribute(
        "data-appearance",
        "editorial"
    );
    const nav = screen.getByRole("navigation", { name: "Wishlist pagination" });
    expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute(
        "href",
        "/profile/wishlist/1"
    );
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
        "href",
        "/profile/wishlist/3"
    );
    expect(screen.getByRole("link", { name: "Page 2" })).toHaveAttribute(
        "aria-current",
        "page"
    );
});
it("reflects a new page prop without navigating back to the old page", () => {
    const { rerender } = render(
        <WishlistContainer products={products} page={1} totalPages={3} />
    );
    rerender(<WishlistContainer products={products} page={3} totalPages={3} />);
    expect(screen.getByRole("link", { name: "Page 3" })).toHaveAttribute(
        "aria-current",
        "page"
    );
    expect(
        screen.queryByRole("link", { name: "Next" })
    ).not.toBeInTheDocument();
});
it("disables the previous direction on the first page and bounds large page lists", () => {
    render(
        <WishlistContainer products={products} page={1} totalPages={1000} />
    );
    expect(
        screen.queryByRole("link", { name: "Previous" })
    ).not.toBeInTheDocument();
    expect(
        screen.getAllByRole("link", { name: /^Page / }).length
    ).toBeLessThanOrEqual(7);
    expect(screen.getByRole("link", { name: "Page 1000" })).toHaveAttribute(
        "href",
        "/profile/wishlist/1000"
    );
});
it("keeps the heading and a collection destination on an empty wishlist", async () => {
    query.mockResolvedValue({ wishlist: [], totalPages: 0 });
    render(await WishlistPage({ params: Promise.resolve({ page: "1" }) }));
    expect(
        screen.getByRole("heading", { name: "Your Wishlist", level: 1 })
    ).toBeVisible();
    expect(screen.getByText("Your wishlist is empty.")).toBeVisible();
    expect(
        screen.getByRole("link", { name: /Explore the collection/ })
    ).toHaveAttribute("href", "/browse");
    expect(
        screen.queryByRole("navigation", { name: "Wishlist pagination" })
    ).not.toBeInTheDocument();
});
it("shows generic lookup failure feedback with a real reload link", async () => {
    query.mockRejectedValue(new Error("private backend details"));
    render(await WishlistPage({ params: Promise.resolve({ page: "2" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent(
        "Your wishlist is unavailable"
    );
    expect(
        screen.queryByText("private backend details")
    ).not.toBeInTheDocument();
    expect(
        screen.getByRole("link", { name: "Reload wishlist" })
    ).toHaveAttribute("href", "/profile/wishlist/2");
});
it("normalizes page input and keeps the canonical redirect outside error handling", async () => {
    jest.mocked(redirect).mockImplementation(() => {
        throw new Error("NEXT_REDIRECT");
    });
    query.mockResolvedValue({ wishlist: products, totalPages: 2 });
    await expect(
        WishlistPage({ params: Promise.resolve({ page: "99" }) })
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/profile/wishlist/2");
    query.mockResolvedValue({ wishlist: [], totalPages: 0 });
    await WishlistPage({ params: Promise.resolve({ page: "invalid" }) });
    expect(query).toHaveBeenLastCalledWith(1);
});

it("announces loading and keeps decorative skeletons out of the accessibility tree", () => {
    render(<WishlistLoading />);
    expect(
        screen.getByRole("heading", { name: "Your Wishlist" })
    ).toBeVisible();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading your wishlist");
    expect(status.closest("[aria-busy='true']")).toBeNull();
    const skeletons = status.nextElementSibling;
    expect(skeletons).toHaveAttribute("aria-busy", "true");
    expect(skeletons).toHaveAttribute("aria-hidden", "true");
    expect(
        screen.getByRole("link", { name: /The collection/ })
    ).toHaveAttribute("href", "/browse");
});
