/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import NewProductPage from "@/app/dashboard/seller/stores/[storeUrl]/products/new/page";
import NewVariantPage from "@/app/dashboard/seller/stores/[storeUrl]/products/[productId]/variants/new/page";
import { getProductMainInfo } from "@/queries/product";
import { upsertProduct } from "@/queries/product";
import { getEffectiveAttributeDefinitions } from "@/queries/attribute";
import { db } from "@/lib/db";

jest.mock("@/lib/db", () => ({
    db: { country: { findMany: jest.fn(async () => []) } },
}));
jest.mock("@/queries/product", () => ({
    upsertProduct: jest.fn(),
    getProductMainInfo: jest.fn(),
    getProductVariantForEdit: jest.fn(),
}));
jest.mock("@/queries/attribute", () => ({
    getEffectiveAttributeDefinitions: jest.fn(),
}));
jest.mock("@/queries/category", () => ({
    getAllCategories: jest.fn(async () => []),
}));
jest.mock("@/queries/offer-tag", () => ({
    getAllOfferTags: jest.fn(async () => []),
}));
jest.mock("next/navigation", () => ({
    notFound: jest.fn(() => {
        throw new Error("NEXT_NOT_FOUND");
    }),
}));
const form = jest.fn();
jest.mock("@/components/dashboard/forms/product-details", () => ({
    __esModule: true,
    default: (props: unknown) => {
        form(props);
        return <h2>Product information</h2>;
    },
}));

beforeEach(() => {
    jest.clearAllMocks();
});
it("labels variant creation and preserves inherited product data and the seller action boundary", async () => {
    const product = {
        productId: "p1",
        name: "Inherited product",
        productAttributes: { material: "gold" },
    };
    jest.mocked(getProductMainInfo).mockResolvedValueOnce(product as never);
    render(
        await NewVariantPage({
            params: Promise.resolve({ storeUrl: "example", productId: "p1" }),
        })
    );
    expect(
        screen.getByRole("region", { name: "Add variant" })
    ).toContainElement(
        screen.getByRole("heading", { level: 1, name: "Add variant" })
    );
    expect(
        screen.getByText("Add a new variant to Inherited product.")
    ).toBeInTheDocument();
    expect(form).toHaveBeenCalledWith(
        expect.objectContaining({
            design: "seller",
            data: product,
            storeUrl: "example",
            upsertProductAction: upsertProduct,
        })
    );
    expect(getProductMainInfo).toHaveBeenCalledWith("p1");
});
it("retains the new-variant route behavior for a missing product", async () => {
    jest.mocked(getProductMainInfo).mockResolvedValueOnce(null as never);
    expect(
        await NewVariantPage({
            params: Promise.resolve({
                storeUrl: "example",
                productId: "missing",
            }),
        })
    ).toBeNull();
    expect(form).not.toHaveBeenCalled();
});
it("renders the new product page with one labeled heading and the seller form/action boundary", async () => {
    render(
        await NewProductPage({
            params: Promise.resolve({ storeUrl: "example" }),
        })
    );
    expect(
        screen.getByRole("region", { name: "Create product" })
    ).toContainElement(
        screen.getByRole("heading", { level: 1, name: "Create product" })
    );
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(form).toHaveBeenCalledWith(
        expect.objectContaining({
            design: "seller",
            storeUrl: "example",
            upsertProductAction: upsertProduct,
            getAttributeDefinitionsAction: getEffectiveAttributeDefinitions,
        })
    );
    expect(db.country.findMany).toHaveBeenCalledWith({
        orderBy: { name: "asc" },
    });
});
