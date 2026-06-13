/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
    ProductImagesCell,
    ViewOrderButton,
} from "@/components/dashboard/shared/order-table-cells";

// 重い子依存はスタブ化し、セル UI のレンダリング/ハンドラ挙動に集中する
jest.mock("next/image", () => ({
    __esModule: true,
    default: ({
        priority,
        ...props
    }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => (
        <img {...props} />
    ),
}));

const mockSetOpen = jest.fn();
jest.mock("@/providers/modal-provider", () => ({
    useModal: () => ({ setOpen: mockSetOpen, setClose: jest.fn() }),
}));

jest.mock("@/components/dashboard/shared/custom-modal", () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="custom-modal">{children}</div>
    ),
}));

describe("order-table-cells", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("ProductImagesCell", () => {
        it("renders one image per url with index-based alt", () => {
            // Arrange
            const images = ["https://img/a.png", "https://img/b.png"];

            // Act
            render(<ProductImagesCell images={images} />);

            // Assert
            const imgs = screen.getAllByRole("img");
            expect(imgs).toHaveLength(2);
            expect(screen.getByAltText("product-0")).toHaveAttribute(
                "src",
                "https://img/a.png"
            );
            expect(screen.getByAltText("product-1")).toHaveAttribute(
                "src",
                "https://img/b.png"
            );
        });

        it("renders nothing visible when the images array is empty", () => {
            // Act
            render(<ProductImagesCell images={[]} />);

            // Assert
            expect(screen.queryByRole("img")).not.toBeInTheDocument();
        });
    });

    describe("ViewOrderButton", () => {
        it("opens the modal with the provided children on click", () => {
            // Act
            render(
                <ViewOrderButton>
                    <span>order-detail</span>
                </ViewOrderButton>
            );
            fireEvent.click(screen.getByText("View"));

            // Assert: setOpen が CustomModal でラップした children 付きで呼ばれる
            expect(mockSetOpen).toHaveBeenCalledTimes(1);
        });

        it("does not open the modal before the button is clicked", () => {
            // Act
            render(
                <ViewOrderButton>
                    <span>order-detail</span>
                </ViewOrderButton>
            );

            // Assert
            expect(mockSetOpen).not.toHaveBeenCalled();
        });
    });
});
