/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NewOfferTagPage from "@/app/dashboard/admin/offer-tags/new/page";
import OfferTagsPage from "@/app/dashboard/admin/offer-tags/page";
import { getAllOfferTags, upsertOfferTag } from "@/queries/offer-tag";
import NewCouponPage from "@/app/dashboard/admin/coupons/new/page";
import CouponsPage from "@/app/dashboard/admin/coupons/page";
import { getAllCoupons, upsertCouponAsAdmin } from "@/queries/coupon";
import { coupons } from "../../fixtures/p3/data";
import NewCategoryPage from "@/app/dashboard/admin/categories/new/page";
import CategoriesPage from "@/app/dashboard/admin/categories/page";
import { getAllCategories, upsertCategory } from "@/queries/category";

jest.mock("@/queries/category", () => ({
    getAllCategories: jest.fn(),
    getCategory: jest.fn(),
    upsertCategory: jest.fn(),
    deleteCategory: jest.fn(),
}));
jest.mock("@/queries/coupon", () => ({
    getAllCoupons: jest.fn(),
    getCouponAsAdmin: jest.fn(),
    upsertCouponAsAdmin: jest.fn(),
    deleteCouponAsAdmin: jest.fn(),
    toggleCouponActive: jest.fn(),
}));
jest.mock("react-datetime-picker", () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock("@/queries/offer-tag", () => ({
    getAllOfferTags: jest.fn(),
    getOfferTag: jest.fn(),
    upsertOfferTag: jest.fn(),
    deleteOfferTag: jest.fn(),
}));
jest.mock("uuid", () => ({ v4: () => "new-id" }));
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }),
}));
jest.mock("next-cloudinary", () => ({ CldUploadWidget: () => null }));
jest.mock("@/providers/modal-provider", () => ({
    useModal: () => ({ setOpen: jest.fn(), setClose: jest.fn() }),
}));
beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getAllCategories).mockResolvedValue([]);
});
it("categories provides a labeled heading and searchable empty table", async () => {
    render(await CategoriesPage());
    expect(screen.getByRole("region", { name: "Categories" })).toContainElement(
        screen.getByRole("heading", { level: 1, name: "Categories" })
    );
    expect(screen.getByRole("searchbox")).toBeVisible();
    expect(screen.getByText("No Results.")).toBeVisible();
});
it("categories lookup failure provides generic feedback rather than crashing", async () => {
    jest.mocked(getAllCategories).mockRejectedValue(
        new Error("private database details")
    );
    render(await CategoriesPage());
    expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not load categories"
    );
    expect(screen.queryByText(/private database/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
});

it("new category provides a creation heading and injects save with root identity", async () => {
    jest.mocked(upsertCategory).mockResolvedValue({ name: "Shoes" } as never);
    render(await NewCategoryPage());
    expect(
        screen.getByRole("heading", { level: 1, name: "Create category" })
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Category name"), {
        target: { value: "Shoes" },
    });
    fireEvent.change(screen.getByLabelText("Category url"), {
        target: { value: "shoes" },
    });
    fireEvent.change(screen.getByTestId("n-mock-input-profile"), {
        target: { value: "https://example.test/shoes.png" },
    });
    fireEvent.submit(
        screen.getByRole("form", { name: "Category information" })
    );
    await waitFor(() =>
        expect(upsertCategory).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "new-id",
                name: "Shoes",
                parentId: null,
                sortOrder: 0,
                createdAt: expect.any(Date),
            })
        )
    );
});

it("admin coupons exposes a labeled searchable empty list", async () => {
    jest.mocked(getAllCoupons).mockResolvedValue([]);
    render(await CouponsPage());
    expect(screen.getByRole("region", { name: "Coupons" })).toContainElement(
        screen.getByRole("heading", { level: 1, name: "Coupons" })
    );
    expect(screen.getByRole("searchbox")).toBeVisible();
});
it("admin coupons exposes generic load failure and retry", async () => {
    jest.mocked(getAllCoupons).mockRejectedValue(Error("private"));
    render(await CouponsPage());
    expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not load coupons"
    );
});
it("projects the coupon store to plain display data before the client boundary", async () => {
    jest.mocked(getAllCoupons).mockResolvedValue([{
        ...coupons[0], store: { name: "Store", defaultShippingFeePerItem: { toNumber: () => 12.5 } },
    }] as never);
    const page = await CouponsPage();
    expect(page.props.coupons[0].store).toEqual({ name: "Store" });
    expect(page.props.coupons[0].id).toBe("coupon-1");
});

it("new admin coupon injects creation action and normalizes PLATFORM storeId", async () => {
    jest.mocked(upsertCouponAsAdmin).mockResolvedValue({
        code: "NEWCODE",
    } as never);
    render(<NewCouponPage />);
    expect(
        screen.getByRole("heading", { level: 1, name: "Create coupon" })
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Coupon code"), {
        target: { value: "NEWCODE" },
    });
    fireEvent.change(screen.getByLabelText("Coupon discount"), {
        target: { value: "10" },
    });
    fireEvent.change(screen.getByLabelText("Scope"), {
        target: { value: "PLATFORM" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Coupon information" }));
    await waitFor(() =>
        expect(upsertCouponAsAdmin).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "new-id",
                code: "NEWCODE",
                scope: "PLATFORM",
                storeId: null,
                discount: 10,
            })
        )
    );
});

it("offer tags exposes a labeled searchable list and a standalone create link", async () => {
    jest.mocked(getAllOfferTags).mockResolvedValue([]);
    render(await OfferTagsPage());
    expect(
        screen.getByRole("heading", { level: 1, name: "Offer tags" })
    ).toBeVisible();
    expect(screen.getByRole("searchbox")).toBeVisible();
    expect(
        screen.getByRole("link", { name: "Create in new page" })
    ).toHaveAttribute("href", "/dashboard/admin/offer-tags/new");
});
it("offer tags lookup failure provides generic retry feedback", async () => {
    jest.mocked(getAllOfferTags).mockRejectedValue(Error("private"));
    render(await OfferTagsPage());
    expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not load offer tags"
    );
});

it("new offer tag injects creation action and provides labeled fields", async () => {
    jest.mocked(upsertOfferTag).mockResolvedValue({
        name: "New offer",
    } as never);
    render(<NewOfferTagPage />);
    expect(
        screen.getByRole("heading", { level: 1, name: "Create offer tag" })
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText("Offer tag name"), {
        target: { value: "New offer" },
    });
    fireEvent.change(screen.getByLabelText("Offer tag url"), {
        target: { value: "new-offer" },
    });
    fireEvent.submit(
        screen.getByRole("form", { name: "Offer tag information" })
    );
    await waitFor(() =>
        expect(upsertOfferTag).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "new-id",
                name: "New offer",
                url: "new-offer",
                createdAt: expect.any(Date),
            })
        )
    );
});
