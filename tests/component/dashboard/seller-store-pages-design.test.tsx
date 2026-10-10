/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Page from "@/app/dashboard/seller/stores/[storeUrl]/settings/page";
import StoreDetails from "@/components/dashboard/forms/store-details";
import { db } from "@/lib/db";
import { upsertStore } from "@/queries/store";

const mockRefresh = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
    useRouter: () => ({
        refresh: mockRefresh,
        push: mockPush,
        replace: mockReplace,
    }),
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
    jest.mocked(upsertStore).mockResolvedValueOnce({
        ok: true,
        id: store.id,
        url: store.url,
    });
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
    expect(mockReplace).not.toHaveBeenCalled();
});
it("moves to the renamed settings URL instead of refreshing the stale one", async () => {
    jest.mocked(upsertStore).mockResolvedValueOnce({
        ok: true,
        id: store.id,
        url: "renamed",
    });
    render(
        <StoreDetails
            data={store as never}
            upsertStoreAction={upsertStore}
            design="seller"
        />
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Store url" }), {
        target: { value: "renamed" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Store information" }));
    await waitFor(() =>
        expect(mockReplace).toHaveBeenCalledWith(
            "/dashboard/seller/stores/renamed/settings"
        )
    );
    expect(mockRefresh).not.toHaveBeenCalled();
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
        .mockResolvedValueOnce({ ok: true, id: store.id, url: store.url });
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

it("shows the duplicate reason returned by the action and clears it on a successful retry", async () => {
    const action = jest
        .fn()
        .mockResolvedValueOnce({
            ok: false,
            reason: "A store with the same name already exists.",
        })
        .mockResolvedValueOnce({ ok: true, id: store.id, url: store.url });
    render(
        <StoreDetails
            data={store as never}
            {...{ upsertStoreAction: action, design: "seller" as const }}
        />
    );
    const form = screen.getByRole("form", { name: "Store information" });
    fireEvent.change(screen.getByRole("textbox", { name: "Store name" }), {
        target: { value: "Taken store" },
    });
    fireEvent.submit(form);
    expect(await screen.findByRole("alert")).toHaveTextContent(
        "A store with the same name already exists."
    );
    expect(screen.getByRole("textbox", { name: "Store name" })).toHaveValue(
        "Taken store"
    );
    expect(mockRefresh).not.toHaveBeenCalled();
    fireEvent.submit(form);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("status")).toHaveTextContent(
        "Store information saved"
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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

import NewStorePage from "@/app/dashboard/seller/stores/new/page";
jest.mock("@/components/shared/theme-toggle", () => ({
    __esModule: true,
    default: () => <button>Toggle theme</button>,
}));
it("gives store creation its own main landmark, heading and theme control outside the store shell", () => {
    render(<NewStorePage />);
    expect(screen.getByRole("main")).toContainElement(
        screen.getByRole("heading", { level: 1, name: "Create store" })
    );
    expect(
        screen.getByRole("region", { name: "Create store" })
    ).toBeInTheDocument();
    expect(
        screen.getByRole("button", { name: "Toggle theme" })
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Store name" })).toHaveValue("");
});
it("creates through the existing no-id API branch and uses the returned store URL", async () => {
    jest.mocked(upsertStore).mockResolvedValueOnce({
        ok: true,
        id: "created-id",
        url: "created-store",
    });
    render(<NewStorePage />);
    for (const [label, value] of [
        ["Store name", "Created store"],
        ["Store email", "new@example.test"],
        ["Store phone number", "1234567890"],
        ["Store url", "created-store"],
        [
            "Store description",
            "A new store description longer than thirty characters.",
        ],
    ])
        fireEvent.change(screen.getByRole("textbox", { name: label }), {
            target: { value },
        });
    fireEvent.click(
        screen.getByRole("button", { name: "Upload profile image" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Upload cover image" }));
    fireEvent.submit(screen.getByRole("form", { name: "Store information" }));
    await waitFor(() => expect(upsertStore).toHaveBeenCalledTimes(1));
    expect(jest.mocked(upsertStore).mock.calls[0][0]).not.toHaveProperty("id");
    expect(upsertStore).toHaveBeenCalledWith(
        expect.objectContaining({
            name: "Created store",
            featured: false,
            url: "created-store",
            logo: "https://example.test/profile.jpg",
            cover: "https://example.test/cover.jpg",
        })
    );
    expect(mockPush).toHaveBeenCalledWith(
        "/dashboard/seller/stores/created-store"
    );
    expect(mockRefresh).not.toHaveBeenCalled();
});
