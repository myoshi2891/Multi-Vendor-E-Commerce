/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import FollowingContainer from "@/components/store/profile/following/container";
import { followStore } from "@/queries/user";
import { getUserFollowedStores } from "@/queries/profile";
import ProfileFollowingPage from "@/app/(store)/profile/following/[page]/page";

jest.mock("@/queries/user", () => ({ followStore: jest.fn() }));
jest.mock("@/queries/profile", () => ({ getUserFollowedStores: jest.fn() }));
jest.mock("@clerk/nextjs", () => ({ useUser: () => ({ isLoaded: true, isSignedIn: true }) }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }), redirect: jest.fn() }));
jest.mock("react-hot-toast", () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));
const store = { id: "store-1", name: "A lovely boutique", url: "boutique", logo: "/assets/brand/star.svg", followersCount: 12, isUserFollowingStore: true };
const fetchStores = jest.mocked(getUserFollowedStores);
beforeEach(() => jest.clearAllMocks());

it("empty followed stores provide a collection destination", () => {
    render(<FollowingContainer stores={[]} page={1} totalPages={0} />);
    expect(screen.getByRole("heading", { name: "No followed stores yet." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore the collection" })).toHaveAttribute("href", "/browse");
});

it("pagination uses URL links and a single current page", () => {
    render(<FollowingContainer stores={[store]} page={2} totalPages={20} />);
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/profile/following/3");
    expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute("href", "/profile/following/1");
    expect(screen.getByRole("link", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link", { name: /^Page/ }).length).toBeLessThanOrEqual(7);
});

it("follow locks repeated operations, preserves state after failure and retries through the supplied action", async () => {
    let reject!: (error: Error) => void;
    const followAction = jest.fn(() => new Promise<boolean>((_, fail) => { reject = fail; }));
    const props = { stores: [store], page: 1, totalPages: 1, followAction };
    render(<FollowingContainer {...props} />);
    const button = screen.getByRole("button", { name: "Following" });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(followAction).toHaveBeenCalledTimes(1);
    await act(async () => reject(new Error("private error")));
    expect(screen.getByRole("alert")).toHaveTextContent("Could not update this store.");
    expect(button).toHaveAttribute("aria-pressed", "true");
    followAction.mockResolvedValueOnce(false);
    fireEvent.click(button);
    await waitFor(() => expect(button).toHaveAttribute("aria-pressed", "false"));
    expect(screen.getByText("11 followers")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("You unfollowed A lovely boutique.");
});

it("server lookup failure provides a generic alert and reload", async () => {
    fetchStores.mockRejectedValueOnce(new Error("private database"));
    render(await ProfileFollowingPage({ params: Promise.resolve({ page: "2" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("Followed stores could not be loaded.");
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/profile/following/2");
});
