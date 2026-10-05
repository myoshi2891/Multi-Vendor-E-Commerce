/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Apply from "@/components/store/forms/apply-seller/apply-seller";
jest.mock("@clerk/nextjs", () => ({
    useUser: () => ({
        isSignedIn: true,
        user: {
            firstName: "Test",
            lastName: "Seller",
            imageUrl: "/avatar.png",
        },
    }),
    UserButton: () => <button>Update profile</button>,
}));
jest.mock("next/image", () => ({
    __esModule: true,
    default: () => <span>Avatar</span>,
}));
jest.mock("@/queries/store", () => ({ applySeller: jest.fn() }));
jest.mock("@/components/dashboard/shared/image-upload", () => ({
    __esModule: true,
    default: ({
        onChange,
        type,
    }: {
        onChange: (url: string) => void;
        type: string;
    }) => (
        <button
            type="button"
            onClick={() => onChange("https://example.com/image.jpg")}
        >
            Upload {type}
        </button>
    ),
}));
it("announces application progress and gives the page a heading", () => {
    render(<Apply applySellerAction={jest.fn()} />);
    expect(
        screen.getByRole("heading", { name: "Become a seller" })
    ).toBeInTheDocument();
    expect(
        screen.getByRole("progressbar", { name: "Application progress" })
    ).toHaveAttribute("aria-valuenow", "1");
});
it("advances to labeled store inputs and preserves edits when returning", async () => {
    const user = userEvent.setup();
    render(<Apply applySellerAction={jest.fn()} />);
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("progressbar")).toHaveAttribute(
        "aria-valuenow",
        "2"
    );
    await user.type(
        screen.getByRole("textbox", { name: "Store name" }),
        "Example Store"
    );
    await user.click(screen.getByRole("button", { name: "Previous" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("textbox", { name: "Store name" })).toHaveValue(
        "Example Store"
    );
});

// Existing implementation regression: rejected submissions retain values and unlock retry.
import Step3 from "@/components/store/forms/apply-seller/steps/step-3/step-3";
it("locks a pending application, retains data on rejection and retries", async () => {
    const user = userEvent.setup();
    let reject: (reason: Error) => void = () => {};
    const action = jest
        .fn()
        .mockImplementationOnce(
            () =>
                new Promise((_, r) => {
                    reject = r;
                })
        )
        .mockResolvedValueOnce({ id: "store" });
    const setStep = jest.fn();
    render(
        <Step3
            step={3}
            setStep={setStep}
            setFormData={jest.fn()}
            applySellerAction={action}
            formData={{
                name: "Example Store",
                description: "Our example store description",
                email: "test@example.com",
                phone: "1234",
                url: "example",
                logo: "image",
                cover: "image",
                defaultShippingService: "Delivery",
                defaultShippingFeePerItem: 0,
                defaultShippingFeeForAdditionalItem: 0,
                defaultShippingFeePerKg: 0,
                defaultShippingFeeFixed: 0,
                defaultDeliveryTimeMin: 7,
                defaultDeliveryTimeMax: 10,
                returnPolicy: "Return within 30 days",
            }}
        />
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(screen.getByRole("button", { name: "Submitting…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    reject(new Error("private failure"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
        "Please try again"
    );
    expect(screen.getByRole("textbox", { name: "Return policy" })).toHaveValue(
        "Return within 30 days"
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(action).toHaveBeenCalledTimes(2);
    expect(setStep).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenLastCalledWith(
        expect.objectContaining({
            url: "example",
            returnPolicy: "Return within 30 days",
        })
    );
});
