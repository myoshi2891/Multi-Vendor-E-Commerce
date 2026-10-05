/** @jest-environment jsdom */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Page from "@/app/dashboard/seller/stores/[storeUrl]/products/page";
import ModalProvider from "@/providers/modal-provider";
import { getAllStoreProducts } from "@/queries/product";
jest.mock("@/queries/product", () => ({
    getAllStoreProducts: jest.fn(async () => []),
    deleteProduct: jest.fn(),
    upsertProduct: jest.fn(),
}));
jest.mock("@/queries/category", () => ({
    getAllCategories: jest.fn(async () => []),
}));
jest.mock("@/queries/offer-tag", () => ({
    getAllOfferTags: jest.fn(async () => []),
}));
jest.mock("@/queries/country", () => ({
    getAllCountries: jest.fn(async () => []),
}));
jest.mock("@/queries/attribute", () => ({
    getEffectiveAttributeDefinitions: jest.fn(async () => []),
}));
jest.mock("@/components/dashboard/forms/product-details", () => ({
    __esModule: true,
    default: () => <p>Product form</p>,
}));
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: jest.fn() }),
}));
it("shows Products with labeled search and an accessible creation dialog", async () => {
    const user = userEvent.setup();
    render(
        <ModalProvider>
            {await Page({ params: Promise.resolve({ storeUrl: "example" }) })}
        </ModalProvider>
    );
    expect(
        screen.getByRole("heading", { name: "Products" })
    ).toBeInTheDocument();
    expect(
        screen.getByRole("searchbox", { name: "Search product name..." })
    ).toBeInTheDocument();
    expect(
        within(
            screen.getByRole("link", { name: /Create in new page/ })
        ).queryByRole("button")
    ).not.toBeInTheDocument();
    await user.click(
        screen.getByRole("button", { name: /Create New Product/ })
    );
    expect(
        screen.getByRole("dialog", { name: "Create product" })
    ).toContainElement(screen.getByText("Product form"));
});
it("does not disguise a failed product lookup as an empty result", async () => {
    jest.mocked(getAllStoreProducts).mockRejectedValueOnce(
        new Error("private db error")
    );
    render(
        <ModalProvider>
            {await Page({ params: Promise.resolve({ storeUrl: "example" }) })}
        </ModalProvider>
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Please try again");
    expect(screen.queryByText("No Results.")).not.toBeInTheDocument();
    expect(screen.queryByText("private db error")).not.toBeInTheDocument();
});

// Post-implementation regressions for the display boundary and destructive operation.
import { ProductActions } from "@/app/dashboard/seller/stores/[storeUrl]/products/columns";
import { serializeStoreProducts } from "@/lib/seller-products";
import type { StoreProductType } from "@/lib/types";
import { Prisma } from "@prisma/client";
it("serializes variant prices as dollars without Decimal instances", () => {
    const rows = serializeStoreProducts([
        {
            id: "p",
            name: "Product",
            brand: "Brand",
            store: { url: "example" },
            category: { name: "Category" },
            subCategory: { name: "Subcategory" },
            offerTag: null,
            variants: [
                {
                    id: "v",
                    variantName: "Variant",
                    images: [],
                    colors: [],
                    sizes: [
                        {
                            id: "s",
                            size: "M",
                            quantity: 2,
                            price: new Prisma.Decimal("12.50"),
                        },
                    ],
                },
            ],
        },
    ] as unknown as StoreProductType[]);
    expect(rows[0].variants[0].sizes[0].price).toBe(12.5);
    expect(JSON.parse(JSON.stringify(rows))[0].variants[0].sizes[0].price).toBe(
        12.5
    );
});
it("keeps failed deletion in its confirmation dialog and allows retry", async () => {
    const user = userEvent.setup();
    const action = jest
        .fn()
        .mockRejectedValueOnce(new Error("private error"))
        .mockResolvedValueOnce({});
    render(
        <ProductActions
            productId="p"
            name="Example product"
            deleteProductAction={action}
        />
    );
    await user.click(
        screen.getByRole("button", { name: "Actions for Example product" })
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete product" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
        "Please try again"
    );
    expect(screen.queryByText("private error")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(action).toHaveBeenCalledTimes(2);
    expect(action).toHaveBeenLastCalledWith("p");
});

// Coverage for the column cells, null fallbacks and the successful delete path.
import { getProductColumns } from "@/app/dashboard/seller/stores/[storeUrl]/products/columns";
import DataTable from "@/components/ui/data-table";
it("logs a failed product lookup with structured context", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.mocked(getAllStoreProducts).mockRejectedValueOnce(
        new Error("private db error")
    );
    await Page({ params: Promise.resolve({ storeUrl: "example" }) });
    expect(spy).toHaveBeenCalledWith(
        "[SellerProductPage] Failed to load product data",
        expect.objectContaining({ error: "private db error" })
    );
    jest.mocked(getAllStoreProducts).mockRejectedValueOnce("raw failure");
    await Page({ params: Promise.resolve({ storeUrl: "example" }) });
    expect(spy).toHaveBeenCalledWith("[SellerProductPage] Unknown error", {
        error: "raw failure",
    });
    spy.mockRestore();
});
it("renders variant images, colors, sizes and dash fallbacks in product cells", () => {
    const rows = serializeStoreProducts([
        {
            id: "p1",
            name: "Full product",
            brand: "Brand",
            store: { url: "example" },
            category: { name: "Shoes" },
            subCategory: { name: "Sneakers" },
            offerTag: { name: "Sale" },
            variants: [
                {
                    id: "v1",
                    variantName: "Red pair",
                    images: [{ url: "https://res.cloudinary.com/x.png" }],
                    colors: [{ name: "red" }],
                    sizes: [
                        {
                            id: "s1",
                            size: "L",
                            quantity: 3,
                            price: new Prisma.Decimal("9.5"),
                        },
                    ],
                },
            ],
        },
        {
            id: "p2",
            name: "Bare product",
            brand: "Brand",
            store: { url: "example" },
            category: null,
            subCategory: null,
            offerTag: null,
            variants: [
                {
                    id: "v2",
                    variantName: "Plain",
                    images: [],
                    colors: [],
                    sizes: [],
                },
            ],
        },
    ] as unknown as StoreProductType[]);
    render(
        <ModalProvider>
            <DataTable
                columns={getProductColumns(jest.fn())}
                data={rows}
                filterValue="name"
                searchPlaceholder="Search"
            />
        </ModalProvider>
    );
    expect(screen.getByText("Full product")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Red pair" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "red" })).toBeInTheDocument();
    expect(screen.getByText(/L · 3 · \$\s*9\.50/)).toBeInTheDocument();
    expect(screen.getByText("Sale")).toBeInTheDocument();
    expect(screen.getByText("No image")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Edit Plain" })).toHaveAttribute(
        "href",
        "/dashboard/seller/stores/example/products/p2/variants/v2"
    );
    expect(
        screen.getAllByRole("link", { name: "New variant" })[0]
    ).toHaveAttribute(
        "href",
        "/dashboard/seller/stores/example/products/p1/variants/new"
    );
});
it("closes the confirmation dialog after a successful deletion", async () => {
    const user = userEvent.setup();
    const action = jest.fn().mockResolvedValue({});
    render(
        <ProductActions
            productId="p"
            name="Example product"
            deleteProductAction={action}
        />
    );
    await user.click(
        screen.getByRole("button", { name: "Actions for Example product" })
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete product" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(action).toHaveBeenCalledWith("p");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(
        screen.getByRole("button", { name: "Actions for Example product" })
    ).toHaveFocus();
    await user.click(
        screen.getByRole("button", { name: "Actions for Example product" })
    );
    await user.click(screen.getByRole("menuitem", { name: "Delete product" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});
