/** @jest-environment jsdom */
import React, { Suspense } from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import HistoryPage from "@/app/(store)/profile/history/[page]/page";
import { getProductsByIds } from "@/queries/product";
import type { ProductType } from "@/lib/types";
jest.mock("@/queries/product", () => ({ getProductsByIds: jest.fn() }));
const replace = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
jest.mock("@/components/store/shared/product-list", () => ({ __esModule: true, default: ({ products, variant }: { products: ProductType[]; variant?: string }) => <div data-testid="history-products" data-appearance={variant}>{products.map(p => <p key={p.id}>{p.name}</p>)}</div> }));
const query = jest.mocked(getProductsByIds);
const products = [{ id: "p1", name: "A rediscovered piece" }] as ProductType[];
// Accept both the original client route and the planned server wrapper without mocking React hooks.
async function view(page = "1") {
    const props = { params: Promise.resolve({ page }) };
    await act(async () => {
        if (HistoryPage.constructor.name === "AsyncFunction") render(await HistoryPage(props));
        else render(<Suspense fallback={<p>Route pending</p>}><HistoryPage {...props} /></Suspense>);
    });
}
beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); query.mockResolvedValue({ products, totalPages: 3 }); });

it("empty and malformed history offer the collection without fetching", async () => {
    localStorage.setItem("productHistory", "{broken");
    await view();
    expect(screen.getByRole("heading", { name: "No recently viewed pieces." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore the collection" })).toHaveAttribute("href", "/browse");
    expect(query).not.toHaveBeenCalled();
});
it("loading is announced while stored variants are fetched", async () => {
    localStorage.setItem("productHistory", '["v2","v1"]');
    let resolve!: (v: Awaited<ReturnType<typeof getProductsByIds>>) => void;
    query.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    await view();
    expect(screen.getByRole("status")).toHaveTextContent("Loading recently viewed pieces…");
    await act(async () => resolve({ products, totalPages: 3 }));
    expect(query).toHaveBeenCalledWith(["v2", "v1"], 1);
});
it("history uses editorial products and URL page links", async () => {
    localStorage.setItem("productHistory", '["v1"]');
    await view("2");
    expect(await screen.findByText("A rediscovered piece")).toBeInTheDocument();
    expect(screen.getByTestId("history-products")).toHaveAttribute("data-appearance", "editorial");
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/profile/history/3");
    expect(screen.getByRole("link", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
});
it("lookup failure is announced and retries without losing stored IDs", async () => {
    localStorage.setItem("productHistory", '["v1"]');
    query.mockRejectedValueOnce(new Error("private database error"));
    await view();
    expect(screen.getByRole("alert")).toHaveTextContent("Recently viewed pieces could not be loaded.");
    expect(screen.queryByText(/private database/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("A rediscovered piece")).toBeInTheDocument();
    expect(query).toHaveBeenLastCalledWith(["v1"], 1);
});
it("out of range fetches the last page and replaces the URL", async () => {
    localStorage.setItem("productHistory", '["v1"]');
    await view("99");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/profile/history/3"));
    expect(query.mock.calls.map(call => call[1])).toEqual([99, 3]);
});
it("unavailable local storage is a retryable error", async () => {
    const storage = jest.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => { throw new Error("storage blocked"); });
    try {
        await view();
        expect(screen.getByRole("alert")).toHaveTextContent("Recently viewed pieces could not be loaded.");
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(await screen.findByRole("heading", { name: "No recently viewed pieces." })).toBeInTheDocument();
    } finally { storage.mockRestore(); }
});
