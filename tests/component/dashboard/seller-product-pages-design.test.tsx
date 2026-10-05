/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import NewProductPage from "@/app/dashboard/seller/stores/[storeUrl]/products/new/page";
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
