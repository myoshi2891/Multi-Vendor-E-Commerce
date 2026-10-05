/** @jest-environment jsdom */
import React from "react";
import { act, render, screen } from "@testing-library/react";
import HistoryContainer, {
    type HistoryAction,
} from "@/components/store/profile/history/container";
import FollowingPage from "@/app/(store)/profile/following/[page]/page";
import FollowingAlias from "@/app/(store)/profile/following/page";
import HistoryAlias from "@/app/(store)/profile/history/page";
import { getUserFollowedStores } from "@/queries/profile";
import { redirect } from "next/navigation";
import type { ProductType } from "@/lib/types";
const router = { replace: jest.fn() };
jest.mock("next/navigation", () => ({
    useRouter: () => router,
    redirect: jest.fn(() => {
        throw new Error("redirect");
    }),
}));
jest.mock("@/queries/profile", () => ({ getUserFollowedStores: jest.fn() }));
jest.mock("@/queries/user", () => ({ followStore: jest.fn() }));
jest.mock("@/components/store/shared/product-list", () => ({
    __esModule: true,
    default: ({ products }: { products: ProductType[] }) => (
        <div>
            {products.map((p) => (
                <p key={p.id}>{p.name}</p>
            ))}
        </div>
    ),
}));
beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
});
it.each([
    ["following", FollowingAlias],
    ["history", HistoryAlias],
] as const)("%s alias retains the page-one redirect", (name, alias) => {
    expect(() => alias()).toThrow("redirect");
    expect(redirect).toHaveBeenCalledWith(`/profile/${name}/1`);
});
it("following redirects out-of-range results outside its lookup error handler", async () => {
    jest.mocked(getUserFollowedStores).mockResolvedValueOnce({
        stores: [],
        totalPages: 3,
    });
    await expect(
        FollowingPage({ params: Promise.resolve({ page: "99" }) })
    ).rejects.toThrow("redirect");
    expect(redirect).toHaveBeenCalledWith("/profile/following/3");
});
it.each(["42", "{}", "[1]", "[]"])(
    "invalid/empty history %s does not invoke its query",
    async (value) => {
        localStorage.setItem("productHistory", value);
        const fetch = jest.fn();
        render(<HistoryContainer page={1} fetchHistoryAction={fetch} />);
        expect(
            await screen.findByRole("heading", {
                name: "No recently viewed pieces.",
            })
        ).toBeInTheDocument();
        expect(fetch).not.toHaveBeenCalled();
    }
);
it("changing history pages discards a slower previous-page response", async () => {
    localStorage.setItem("productHistory", '["v1"]');
    const resolves: ((value: Awaited<ReturnType<HistoryAction>>) => void)[] =
        [];
    const fetch: HistoryAction = () =>
        new Promise((done) => {
            resolves.push(done);
        });
    const { rerender } = render(
        <HistoryContainer page={1} fetchHistoryAction={fetch} />
    );
    rerender(<HistoryContainer page={2} fetchHistoryAction={fetch} />);
    const result = (name: string) => ({
        products: [{ id: name, name }] as ProductType[],
        totalPages: 3,
    });
    await act(async () => resolves[1](result("New page")));
    expect(screen.getByText("New page")).toBeInTheDocument();
    await act(async () => resolves[0](result("Stale page")));
    expect(screen.queryByText("Stale page")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Page 2" })).toHaveAttribute(
        "aria-current",
        "page"
    );
});
