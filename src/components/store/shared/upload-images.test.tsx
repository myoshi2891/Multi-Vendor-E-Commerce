/** @jest-environment jsdom */
import React from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

let mockIsMounted = true;
let triggerSuccess: (result: unknown) => void = () => {};
// 実 SDK の isLoading はスクリプト読込（onLoad）まで true
let mockIsLoading = false;

// Mock react to control useSyncExternalStore state
jest.mock("react", () => {
    const original = jest.requireActual("react");
    return {
        ...original,
        useSyncExternalStore: <T,>(
            subscribe: (onStoreChange: () => void) => () => void,
            getSnapshot: () => T,
            getServerSnapshot?: () => T
        ): T => {
            return mockIsMounted ? getSnapshot() : (getServerSnapshot?.() ?? getSnapshot());
        }
    };
});

interface CldUploadWidgetProps {
    onSuccess: (result: unknown) => void;
    children: (args: { open: () => void; isLoading?: boolean }) => React.ReactNode;
}

// Mock next-cloudinary
jest.mock("next-cloudinary", () => ({
    CldUploadWidget: ({ onSuccess, children }: CldUploadWidgetProps) => {
        triggerSuccess = onSuccess;
        return children({
            open: () => onSuccess({ info: { secure_url: "https://example.com/mock.jpg" } }),
            isLoading: mockIsLoading,
        });
    }
}));

// Mock next/image to avoid layout execution in JSDOM
jest.mock("next/image", () => {
    return function DummyImage({ src, alt }: { src?: string; alt?: string }) {
        return <img src={src} alt={alt} data-testid="mock-img" />;
    };
});

import ImageUploadStore from "./upload-images";

describe("ImageUploadStore Component", () => {
    const mockOnChange = jest.fn();
    const mockOnRemove = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        mockIsMounted = true;
    });

    it("returns null when not mounted (SSR phase)", () => {
        mockIsMounted = false;
        const { container } = render(
            <ImageUploadStore
                onChange={mockOnChange}
                onRemove={mockOnRemove}
                value={[]}
                maxImages={3}
            />
        );
        expect(container.firstChild).toBeNull();
    });

    it("renders image slots when mounted", () => {
        render(
            <ImageUploadStore
                onChange={mockOnChange}
                onRemove={mockOnRemove}
                value={["https://example.com/one.jpg"]}
                maxImages={3}
            />
        );
        // Should show one image and two empty slots
        const images = screen.getAllByTestId("mock-img");
        expect(images).toHaveLength(1);
        expect(images[0]).toHaveAttribute("src", "https://example.com/one.jpg");
    });

    it("triggers onChange when a valid Cloudinary result is uploaded", () => {
        const { container } = render(
            <ImageUploadStore
                onChange={mockOnChange}
                onRemove={mockOnRemove}
                value={[]}
                maxImages={3}
            />
        );

        // Simulated upload callback triggering (triggered when widget opens)
        triggerSuccess({ info: { secure_url: "https://example.com/success.jpg" } });
        expect(mockOnChange).toHaveBeenCalledWith("https://example.com/success.jpg");
    });

    describe("onUpload Type Guards", () => {
        it("does not call onChange if result is not an object", () => {
            render(
                <ImageUploadStore
                    onChange={mockOnChange}
                    onRemove={mockOnRemove}
                    value={[]}
                    maxImages={3}
                />
            );

            // Null input
            triggerSuccess(null);
            expect(mockOnChange).not.toHaveBeenCalled();

            // String input
            triggerSuccess("some-string");
            expect(mockOnChange).not.toHaveBeenCalled();
        });

        it("does not call onChange if result.info is not an object", () => {
            render(
                <ImageUploadStore
                    onChange={mockOnChange}
                    onRemove={mockOnRemove}
                    value={[]}
                    maxImages={3}
                />
            );

            // result.info missing
            triggerSuccess({ wrong: "field" });
            expect(mockOnChange).not.toHaveBeenCalled();

            // result.info is string
            triggerSuccess({ info: "not-an-object" });
            expect(mockOnChange).not.toHaveBeenCalled();
        });

        it("does not call onChange if result.info.secure_url is not a string", () => {
            render(
                <ImageUploadStore
                    onChange={mockOnChange}
                    onRemove={mockOnRemove}
                    value={[]}
                    maxImages={3}
                />
            );

            // secure_url missing
            triggerSuccess({ info: {} });
            expect(mockOnChange).not.toHaveBeenCalled();

            // secure_url is number
            triggerSuccess({ info: { secure_url: 12345 } });
            expect(mockOnChange).not.toHaveBeenCalled();
        });
    });
});

describe("ImageUploadStore while the Cloudinary script is loading", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockIsMounted = true;
        mockIsLoading = false;
    });

    const clickEmptySlot = (container: HTMLElement) => {
        const slot = container.querySelector(".cursor-pointer");
        if (!(slot instanceof HTMLElement)) throw new Error("empty slot not found");
        fireEvent.click(slot);
    };

    it("does not open the widget before the script is ready", () => {
        // Arrange
        mockIsLoading = true;
        const onChange = jest.fn();
        const { container } = render(
            <ImageUploadStore onChange={onChange} onRemove={jest.fn()} value={[]} maxImages={1} />
        );

        // Act
        clickEmptySlot(container);

        // Assert（open を呼ぶと mock が onSuccess→onChange を発火する）
        expect(onChange).not.toHaveBeenCalled();
    });

    it("opens the widget once the script is ready", () => {
        // Arrange
        const onChange = jest.fn();
        const { container } = render(
            <ImageUploadStore onChange={onChange} onRemove={jest.fn()} value={[]} maxImages={1} />
        );

        // Act
        clickEmptySlot(container);

        // Assert
        expect(onChange).toHaveBeenCalledWith("https://example.com/mock.jpg");
    });
});
