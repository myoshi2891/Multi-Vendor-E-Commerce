/** @jest-environment jsdom */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImageUpload from "@/components/dashboard/shared/image-upload";

// Cloudinary ウィジェットは外部スクリプトを読むため、open と onSuccess だけを再現する
const open = jest.fn();
let lastOnSuccess: ((result: unknown) => void) | undefined;
jest.mock("next-cloudinary", () => ({
    CldUploadWidget: ({
        children,
        onSuccess,
    }: {
        children: (api: { open: () => void }) => React.ReactNode;
        onSuccess: (result: unknown) => void;
    }) => {
        lastOnSuccess = onSuccess;
        return <>{children({ open })}</>;
    },
}));

beforeEach(() => {
    open.mockClear();
    lastOnSuccess = undefined;
});

const baseProps = { onChange: jest.fn(), onRemove: jest.fn() };

describe("ImageUpload", () => {
    it("opens the widget and forwards only results with a secure_url", async () => {
        // Arrange
        const user = userEvent.setup();
        const onChange = jest.fn();
        render(
            <ImageUpload
                {...baseProps}
                onChange={onChange}
                type="standard"
                value={[]}
            />
        );

        // Act
        await user.click(
            screen.getByRole("button", { name: "Upload standard image" })
        );
        act(() => {
            lastOnSuccess?.({ info: "string-info" });
            lastOnSuccess?.({ info: undefined });
            lastOnSuccess?.({ info: { secure_url: "" } });
            lastOnSuccess?.({ info: { secure_url: "https://img/x.png" } });
        });

        // Assert
        expect(open).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith("https://img/x.png");
    });

    it("renders removable previews and hides them with dontShowPreview", async () => {
        const user = userEvent.setup();
        const onRemove = jest.fn();
        const { rerender } = render(
            <ImageUpload
                {...baseProps}
                onRemove={onRemove}
                type="standard"
                value={["https://img/a.png"]}
            />
        );
        expect(screen.getByAltText("image for product")).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Remove image" }));
        expect(onRemove).toHaveBeenCalledWith("https://img/a.png");

        rerender(
            <ImageUpload
                {...baseProps}
                onRemove={onRemove}
                type="standard"
                value={["https://img/a.png"]}
                dontShowPreview
            />
        );
        expect(
            screen.queryByAltText("image for product")
        ).not.toBeInTheDocument();
    });

    it("forwards the hidden test input value for each layout", () => {
        const onChange = jest.fn();
        const { rerender } = render(
            <ImageUpload
                {...baseProps}
                onChange={onChange}
                type="profile"
                value={[]}
            />
        );
        fireEvent.change(screen.getByTestId("n-mock-input-profile"), {
            target: { value: "p.png" },
        });
        rerender(
            <ImageUpload
                {...baseProps}
                onChange={onChange}
                type="cover"
                value={[]}
            />
        );
        fireEvent.change(screen.getByTestId("n-mock-input-cover"), {
            target: { value: "c.png" },
        });
        expect(onChange).toHaveBeenNthCalledWith(1, "p.png");
        expect(onChange).toHaveBeenNthCalledWith(2, "c.png");
    });

    it("shows the profile image and opens the widget", async () => {
        const user = userEvent.setup();
        render(
            <ImageUpload
                {...baseProps}
                type="profile"
                value={["https://img/p.png"]}
            />
        );
        expect(
            screen.getByAltText("image for profile picture")
        ).toBeInTheDocument();
        await user.click(
            screen.getByRole("button", { name: "Upload profile image" })
        );
        expect(open).toHaveBeenCalledTimes(1);
    });

    it("switches the cover label depending on whether an image exists", async () => {
        const user = userEvent.setup();
        const { rerender } = render(
            <ImageUpload {...baseProps} type="cover" value={[]} />
        );
        expect(screen.getByText("Upload a cover")).toBeInTheDocument();
        rerender(
            <ImageUpload
                {...baseProps}
                type="cover"
                value={["https://img/c.png"]}
            />
        );
        expect(screen.getByText("Change cover")).toBeInTheDocument();
        expect(
            screen.getByAltText("image for cover picture")
        ).toBeInTheDocument();
        await user.click(
            screen.getByRole("button", { name: "Upload cover image" })
        );
        expect(open).toHaveBeenCalledTimes(1);
    });

    it("bounces on error and stops after 1.5 seconds", () => {
        jest.useFakeTimers();
        try {
            const { container, rerender } = render(
                <ImageUpload {...baseProps} type="cover" value={[]} error />
            );
            expect(container.firstChild).toHaveClass("animate-bounce");
            act(() => {
                jest.advanceTimersByTime(1500);
            });
            expect(container.firstChild).not.toHaveClass("animate-bounce");

            rerender(
                <ImageUpload {...baseProps} type="profile" value={[]} error />
            );
            expect(container.firstChild).toHaveClass("bg-red-100");
        } finally {
            jest.useRealTimers();
        }
    });

    it("disables the upload button when disabled", () => {
        render(
            <ImageUpload {...baseProps} type="standard" value={[]} disabled />
        );
        expect(
            screen.getByRole("button", { name: "Upload standard image" })
        ).toBeDisabled();
    });
});
