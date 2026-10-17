/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import SellerStoresPage from "@/app/dashboard/seller/stores/page";
import { getSellerStores } from "@/queries/seller-stores";
jest.mock("@/queries/seller-stores", () => ({ getSellerStores: jest.fn() }));
jest.mock("@/components/shared/theme-toggle", () => ({
    __esModule: true,
    default: () => <button>Toggle theme</button>,
}));
beforeEach(() => jest.clearAllMocks());
it("replaces the placeholder with an empty branded workspace and create link", async () => {
    jest.mocked(getSellerStores).mockResolvedValue({ ok: true, stores: [] });
    render(await SellerStoresPage());
    expect(
        screen.getByRole("heading", { level: 1, name: "Your stores" })
    ).toBeVisible();
    expect(screen.getByText("No stores yet")).toBeVisible();
    expect(screen.getByRole("link", { name: "Create store" })).toHaveAttribute(
        "href",
        "/dashboard/seller/stores/new"
    );
});
it("shows each supplied store with status, image and distinct management link", async () => {
    jest.mocked(getSellerStores).mockResolvedValue({
        ok: true,
        stores: [
            {
                id: "a",
                name: "Atelier",
                url: "atelier",
                logo: "/logo.png",
                status: "PENDING",
            },
        ],
    });
    render(await SellerStoresPage());
    expect(screen.getByRole("heading", { name: "Atelier" })).toBeVisible();
    expect(screen.getByText("Pending")).toBeVisible();
    expect(
        screen.getByRole("link", { name: "Manage Atelier" })
    ).toHaveAttribute("href", "/dashboard/seller/stores/atelier");
    expect(screen.getByRole("img", { name: "Atelier logo" })).toBeVisible();
});
it("distinguishes failure from empty and offers a reload link", async () => {
    jest.mocked(getSellerStores).mockResolvedValue({ ok: false });
    render(await SellerStoresPage());
    expect(screen.getByRole("alert")).toHaveTextContent(
        "Unable to load your stores"
    );
    expect(screen.queryByText("No stores yet")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
        "href",
        "/dashboard/seller/stores"
    );
});
it("does not disguise authorization failure as a load error", async () => {
    jest.mocked(getSellerStores).mockRejectedValue(
        new Error("Unauthenticated.")
    );
    await expect(SellerStoresPage()).rejects.toThrow("Unauthenticated.");
});
