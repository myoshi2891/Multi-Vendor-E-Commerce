/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Page from "@/app/dashboard/seller/stores/[storeUrl]/settings/page";
import StoreDetails from "@/components/dashboard/forms/store-details";
import { db } from "@/lib/db";
import { upsertStore } from "@/queries/store";

const mockRefresh = jest.fn();
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: mockRefresh, push: mockPush }),
    redirect: jest.fn(() => {
        throw new Error("NEXT_REDIRECT");
    }),
}));
jest.mock("@/lib/db", () => ({ db: { store: { findUnique: jest.fn() } } }));
jest.mock("@/queries/store", () => ({ upsertStore: jest.fn() }));
jest.mock("@/hooks/use-toast", () => ({
    useToast: () => ({ toast: jest.fn() }),
}));
jest.mock("uuid", () => ({ v4: () => "new-store-id" }));
jest.mock("@/components/dashboard/shared/image-upload", () => ({
    __esModule: true,
    default: ({
        type,
        onChange,
        onRemove,
        value,
    }: {
        type: string;
        onChange: (url: string) => void;
        onRemove: (url: string) => void;
        value: string[];
    }) => (
        <div>
            <button
                type="button"
                onClick={() => onChange(`https://example.test/${type}.jpg`)}
            >
                Upload {type} image
            </button>
            <button type="button" onClick={() => onRemove(value[0])}>
                Remove {type} image
            </button>
        </div>
    ),
}));
const store = {
    id: "store-1",
    name: "Example store",
    description:
        "An existing store description that contains more than thirty characters.",
    email: "seller@example.test",
    phone: "1234567890",
    url: "example",
    logo: "https://example.test/logo.jpg",
    cover: "https://example.test/cover.jpg",
    featured: false,
    status: "ACTIVE",
};
beforeEach(() => {
    jest.clearAllMocks();
});
it("renders labeled store settings with existing values and server-injected save", async () => {
    jest.mocked(db.store.findUnique).mockResolvedValueOnce(store as never);
    jest.mocked(upsertStore).mockResolvedValueOnce(store as never);
    render(await Page({ params: Promise.resolve({ storeUrl: "example" }) }));
    expect(
        screen.getByRole("region", { name: "Store settings" })
    ).toContainElement(
        screen.getByRole("heading", { level: 1, name: "Store settings" })
    );
    expect(screen.getByRole("textbox", { name: "Store name" })).toHaveValue(
        "Example store"
    );
    fireEvent.submit(screen.getByRole("form", { name: "Store information" }));
    await waitFor(() =>
        expect(upsertStore).toHaveBeenCalledWith(
            expect.objectContaining({
                id: "store-1",
                url: "example",
                logo: store.logo,
                cover: store.cover,
                featured: false,
            })
        )
    );
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
});
it("locks store fields, blocks duplicates and retains the failed draft for an injected retry", async () => {
    let reject!: (error: Error) => void;
    const action = jest
        .fn()
        .mockImplementationOnce(
            () =>
                new Promise((_, r) => {
                    reject = r;
                })
        )
        .mockResolvedValueOnce(store);
    render(
        <StoreDetails
            data={store as never}
            {...{ upsertStoreAction: action, design: "seller" as const }}
        />
    );
    const form = screen.getByRole("form", { name: "Store information" });
    fireEvent.change(screen.getByRole("textbox", { name: "Store name" }), {
        target: { value: "Updated store" },
    });
    fireEvent.submit(form);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("textbox", { name: "Store name" })).toBeDisabled();
    fireEvent.submit(form);
    expect(action).toHaveBeenCalledTimes(1);
    reject(new Error("Private database error"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
        "Please try again"
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(
        "Private database error"
    );
    expect(screen.getByRole("textbox", { name: "Store name" })).toHaveValue(
        "Updated store"
    );
    fireEvent.submit(form);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("status")).toHaveTextContent(
        "Store information saved"
    );
});

it("projects only store form fields and preserves missing-store redirection", async () => {
    jest.mocked(db.store.findUnique).mockResolvedValueOnce(null);
    await expect(
        Page({ params: Promise.resolve({ storeUrl: "missing" }) })
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(db.store.findUnique).toHaveBeenCalledWith({
        where: { url: "missing" },
        select: {
            id: true,
            name: true,
            description: true,
            email: true,
            phone: true,
            logo: true,
            cover: true,
            url: true,
            featured: true,
            status: true,
        },
    });
});
it("propagates store lookup failure to the existing error boundary", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
        jest.mocked(db.store.findUnique).mockRejectedValueOnce(
            new Error("DB unavailable")
        );
        await expect(
            Page({ params: Promise.resolve({ storeUrl: "example" }) })
        ).rejects.toThrow("DB unavailable");
        expect(upsertStore).not.toHaveBeenCalled();
    } finally {
        log.mockRestore();
    }
});
