/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CategoryForm from "@/components/dashboard/admin/category-form";
import { createMockCategory } from "@/config/test-fixtures";
const mockRefresh = jest.fn(),
    mockPush = jest.fn();
jest.mock("uuid", () => ({ v4: () => "new-id" }));
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: mockRefresh, push: mockPush }),
}));
jest.mock("next-cloudinary", () => ({ CldUploadWidget: () => null }));
const category = createMockCategory({
    id: "cat-1",
    name: "Shoes",
    url: "SHOES",
    path: "shoes",
    image: "https://example.test/shoes.png",
});
it("keeps edit identity, canonical slug and values across pending failure/retry", async () => {
    let reject!: (error: Error) => void;
    const saveAction = jest
        .fn()
        .mockImplementationOnce(
            () =>
                new Promise((_, fail) => {
                    reject = fail;
                })
        )
        .mockResolvedValue(category);
    render(
        <CategoryForm
            data={category}
            categories={[category]}
            saveAction={saveAction}
        />
    );
    expect(screen.getByLabelText("Category url")).toHaveValue("shoes");
    fireEvent.change(screen.getByLabelText("Category name"), {
        target: { value: "New Shoes" },
    });
    const form = screen.getByRole("form", { name: "Category information" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Category name")).toBeDisabled();
    reject(new Error("secret"));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Category name")).toHaveValue("New Shoes");
    fireEvent.submit(form);
    await screen.findByText("Changes saved.");
    expect(saveAction).toHaveBeenLastCalledWith(
        expect.objectContaining({
            id: "cat-1",
            name: "New Shoes",
            url: "shoes",
        })
    );
    expect(saveAction.mock.calls[0][0]).not.toHaveProperty("createdAt");
    expect(mockRefresh).toHaveBeenCalledTimes(1);
});
