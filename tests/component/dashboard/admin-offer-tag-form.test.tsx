/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OfferTagForm from "@/components/dashboard/admin/offer-tag-form";
import { offerTags } from "../../fixtures/p3/data";
const mockRefresh = jest.fn(),
    mockPush = jest.fn();
jest.mock("uuid", () => ({ v4: () => "new-offer" }));
jest.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: mockRefresh, push: mockPush }),
}));
beforeEach(() => jest.clearAllMocks());
it("keeps edit identity, creation time and input across pending/failure/retry", async () => {
    let reject!: (error: Error) => void;
    const save = jest
        .fn()
        .mockImplementationOnce(
            () =>
                new Promise((_, fail) => {
                    reject = fail;
                })
        )
        .mockResolvedValueOnce(offerTags[0]);
    render(<OfferTagForm data={offerTags[0]} saveAction={save} />);
    fireEvent.change(screen.getByLabelText("Offer tag name"), {
        target: { value: "Edited offer" },
    });
    const form = screen.getByRole("form", { name: "Offer tag information" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Offer tag name")).toBeDisabled();
    reject(Error("secret"));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Offer tag name")).toHaveValue("Edited offer");
    fireEvent.submit(form);
    await screen.findByText("Changes saved.");
    expect(save).toHaveBeenLastCalledWith(
        expect.objectContaining({
            id: "tag-1",
            name: "Edited offer",
            createdAt: offerTags[0].createdAt,
        })
    );
    expect(mockRefresh).toHaveBeenCalledTimes(1);
});
it("invalid new input does not call the save action", async () => {
    const save = jest.fn();
    render(<OfferTagForm saveAction={save} />);
    fireEvent.submit(
        screen.getByRole("form", { name: "Offer tag information" })
    );
    await waitFor(() =>
        expect(screen.getByLabelText("Offer tag name")).toHaveAttribute(
            "aria-invalid",
            "true"
        )
    );
    expect(save).not.toHaveBeenCalled();
});
