/** @jest-environment jsdom */
import React from "react";
import {
    act,
    render,
    screen,
    fireEvent,
    waitFor,
} from "@testing-library/react";
import AttributesPage from "@/app/dashboard/admin/attributes/page";
import AttributeDetails from "@/components/dashboard/forms/attribute-details";
import {
    getAttributeDefinition,
    upsertAttributeOption,
    getAllAttributeDefinitions,
    upsertAttributeDefinition,
} from "@/queries/attribute";
import { getAttributeCategoryOptions } from "@/app/dashboard/admin/attributes/category-options";
jest.mock("@/queries/attribute", () => ({
    getAttributeDefinition: jest.fn(),
    upsertAttributeOption: jest.fn(),
    archiveAttributeOption: jest.fn(),
    restoreAttributeOption: jest.fn(),
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
    notFound: () => {
        throw Error("not found");
    },
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

it("new attribute has a creation heading and named form", async () => {
    const { default: NewAttributePage } = await import(
        "@/app/dashboard/admin/attributes/new/page"
    );
    render(await NewAttributePage());
    expect(
        screen.getByRole("heading", { level: 1, name: "Create attribute" })
    ).toBeVisible();
    expect(
        screen.getByRole("form", { name: "Attribute information" })
    ).toBeVisible();
});
it("new attribute category failure provides generic retry", async () => {
    jest.mocked(getAttributeCategoryOptions).mockRejectedValue(
        new Error("private data")
    );
    const { default: NewAttributePage } = await import(
        "@/app/dashboard/admin/attributes/new/page"
    );
    render(await NewAttributePage());
    expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not load categories"
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
});

it("options page has an ENUM heading, named form and empty table", async () => {
    jest.mocked(getAttributeDefinition).mockResolvedValue({
        id: "def",
        name: "Material",
        key: "material",
        type: "ENUM",
        category: { path: "art" },
        options: [],
        archivedAt: null,
    } as never);
    const { default: OptionsPage } = await import(
        "@/app/dashboard/admin/attributes/[id]/options/page"
    );
    render(await OptionsPage({ params: Promise.resolve({ id: "def" }) }));
    expect(
        screen.getByRole("region", { name: "Material options" })
    ).toBeVisible();
    expect(
        screen.getByRole("form", { name: "Attribute option information" })
    ).toBeVisible();
    expect(screen.getByRole("searchbox")).toBeVisible();
});
it("option form calls injected save and keeps a failed draft", async () => {
    const { default: OptionDetails } = await import(
        "@/components/dashboard/forms/attribute-option-details"
    );
    const saveAction = jest
        .fn()
        .mockRejectedValueOnce(new Error("failure"))
        .mockResolvedValue({ id: "opt" });
    render(<OptionDetails {...{ definitionId: "def", saveAction }} />);
    fireEvent.change(screen.getByLabelText("Value"), {
        target: { value: "linen" },
    });
    fireEvent.change(screen.getByLabelText("Label"), {
        target: { value: "Linen" },
    });
    const form = screen.getByRole("form", {
        name: "Attribute option information",
    });
    fireEvent.submit(form);
    await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
            "input has been kept"
        )
    );
    expect(screen.getByLabelText("Label")).toHaveValue("Linen");
    fireEvent.submit(form);
    await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent("Changes saved")
    );
    expect(saveAction).toHaveBeenCalledWith(
        "def",
        expect.objectContaining({ value: "linen", label: "Linen" })
    );
    expect(upsertAttributeOption).not.toHaveBeenCalled();
});

it.each([null, { type: "TEXT" }])(
    "options rejects missing or non-ENUM definitions: %p",
    async (definition) => {
        jest.mocked(getAttributeDefinition).mockResolvedValue(
            definition as never
        );
        const { default: OptionsPage } = await import(
            "@/app/dashboard/admin/attributes/[id]/options/page"
        );
        await expect(
            OptionsPage({ params: Promise.resolve({ id: "def" }) })
        ).rejects.toThrow("not found");
    }
);
it("archived definitions keep the option table and hide creation", async () => {
    jest.mocked(getAttributeDefinition).mockResolvedValue({
        id: "def",
        name: "Material",
        key: "material",
        type: "ENUM",
        category: { path: "art" },
        options: [],
        archivedAt: new Date(),
    } as never);
    const { default: OptionsPage } = await import(
        "@/app/dashboard/admin/attributes/[id]/options/page"
    );
    render(await OptionsPage({ params: Promise.resolve({ id: "def" }) }));
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("archived");
    expect(screen.getByText("No Results.")).toBeVisible();
});
it("option lookup failures provide generic retry", async () => {
    jest.mocked(getAttributeDefinition).mockRejectedValue(
        new Error("private data")
    );
    const { default: OptionsPage } = await import(
        "@/app/dashboard/admin/attributes/[id]/options/page"
    );
    render(await OptionsPage({ params: Promise.resolve({ id: "def" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not load attribute options"
    );
    expect(screen.queryByText(/private data/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
});

it.each(["definition", "option"])(
    "%s save blocks simultaneous submits and unlocks after completion",
    async (kind) => {
        let finish!: (value: { name: string }) => void;
        const saveAction = jest.fn(
            () =>
                new Promise<{ name: string }>((resolve) => {
                    finish = resolve;
                })
        );
        if (kind === "definition") {
            render(
                <AttributeDetails
                    categories={categories}
                    saveAction={saveAction as never}
                />
            );
            fireEvent.change(screen.getByLabelText("Category"), {
                target: { value: "cat" },
            });
            fireEvent.change(screen.getByLabelText("Key"), {
                target: { value: "material" },
            });
            fireEvent.change(screen.getByLabelText("Display name"), {
                target: { value: "Material" },
            });
        } else {
            const { default: OptionDetails } = await import(
                "@/components/dashboard/forms/attribute-option-details"
            );
            render(
                <OptionDetails
                    definitionId="def"
                    saveAction={saveAction as never}
                />
            );
            fireEvent.change(screen.getByLabelText("Value"), {
                target: { value: "linen" },
            });
            fireEvent.change(screen.getByLabelText("Label"), {
                target: { value: "Linen" },
            });
        }
        const form = screen.getByRole("form");
        fireEvent.submit(form);
        fireEvent.submit(form);
        await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1));
        expect(
            screen.getByLabelText(
                kind === "definition" ? "Display name" : "Label"
            )
        ).toBeDisabled();
        await act(async () => finish({ name: "Material" }));
        await waitFor(() =>
            expect(screen.getByRole("status")).toHaveTextContent(
                "Changes saved"
            )
        );
        expect(
            screen.getByLabelText(
                kind === "definition" ? "Display name" : "Label"
            )
        ).toBeEnabled();
    }
);
