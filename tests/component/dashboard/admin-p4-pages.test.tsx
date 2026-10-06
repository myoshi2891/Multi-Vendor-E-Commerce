/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import CategoriesPage from "@/app/dashboard/admin/categories/page";
import { getAllCategories } from "@/queries/category";

jest.mock("@/queries/category", () => ({
    getAllCategories: jest.fn(),
    getCategory: jest.fn(),
    upsertCategory: jest.fn(),
    deleteCategory: jest.fn(),
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
