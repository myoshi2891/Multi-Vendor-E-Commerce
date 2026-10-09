/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AttributesPage from "@/app/dashboard/admin/attributes/page";
import AttributeDetails from "@/components/dashboard/forms/attribute-details";
import {
    getAllAttributeDefinitions,
    upsertAttributeDefinition,
} from "@/queries/attribute";
import { getAttributeCategoryOptions } from "@/app/dashboard/admin/attributes/category-options";
jest.mock("@/queries/attribute", () => ({
    getAllAttributeDefinitions: jest.fn(),
    upsertAttributeDefinition: jest.fn(),
    archiveAttributeDefinition: jest.fn(),
    restoreAttributeDefinition: jest.fn(),
    changeAttributeTypeToNumber: jest.fn(),
}));
jest.mock("@/app/dashboard/admin/attributes/category-options", () => ({
    getAttributeCategoryOptions: jest.fn(),
}));
jest.mock("next/navigation", () => ({
    useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("@/providers/modal-provider", () => ({
    useModal: () => ({ setOpen: jest.fn(), setClose: jest.fn() }),
}));
jest.mock("@/hooks/use-toast", () => ({
    useToast: () => ({ toast: jest.fn() }),
}));
const categories = [{ id: "cat", name: "Art", path: "art", depth: 0 }];
beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getAllAttributeDefinitions).mockResolvedValue([]);
    jest.mocked(getAttributeCategoryOptions).mockResolvedValue(categories);
});
it("attribute list has an accessible heading and searchable empty table", async () => {
    render(await AttributesPage());
    expect(screen.getByRole("region", { name: "Attributes" })).toContainElement(
        screen.getByRole("heading", { level: 1, name: "Attributes" })
    );
    expect(screen.getByRole("searchbox")).toBeVisible();
    expect(screen.getByText("No Results.")).toBeVisible();
});
it("attribute list fetch failure keeps a branded heading with generic retry", async () => {
    jest.mocked(getAllAttributeDefinitions).mockRejectedValue(
        new Error("private details")
    );
    render(await AttributesPage());
    expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not load attributes"
    );
    expect(screen.queryByText(/private details/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
});
it("attribute form injects save, locks inputs, retains a failed draft and retries once", async () => {
    const saveAction = jest
        .fn()
        .mockRejectedValueOnce(new Error("failure"))
        .mockResolvedValue({ name: "Material" });
    render(<AttributeDetails {...{ categories, saveAction }} />);
    fireEvent.change(screen.getByLabelText("Category"), {
        target: { value: "cat" },
    });
    fireEvent.change(screen.getByLabelText("Key"), {
        target: { value: "material" },
    });
    fireEvent.change(screen.getByLabelText("Display name"), {
        target: { value: "Material" },
    });
    const form = screen.getByRole("form", { name: "Attribute information" });
    fireEvent.submit(form);
    await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
            "input has been kept"
        )
    );
    expect(screen.getByLabelText("Display name")).toHaveValue("Material");
    fireEvent.submit(form);
    await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent("Changes saved")
    );
    expect(saveAction).toHaveBeenCalledTimes(2);
    expect(upsertAttributeDefinition).not.toHaveBeenCalled();
});
