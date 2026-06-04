/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import ImagesPreviewGrid from "@/components/dashboard/shared/images-preview-grid";

// next/image を素の img に置換
jest.mock("next/image", () => ({
    __esModule: true,
    default: ({
        priority,
        ...props
    }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => (
        <img {...props} />
    ),
}));

// canvas 依存の getDominantColors はスタブ化。cn / getGridClassName は実物を使う
jest.mock("@/lib/utils", () => ({
    ...jest.requireActual("@/lib/utils"),
    getDominantColors: jest.fn().mockResolvedValue([]),
}));

describe("ImagesPreviewGrid", () => {
    it("shows a placeholder when there are no images", () => {
        // Arrange & Act
        render(
            <ImagesPreviewGrid
                images={[]}
                onRemove={jest.fn()}
                setColors={jest.fn()}
            />,
        );

        // Assert
        expect(
            screen.getByAltText("No images available"),
        ).toBeInTheDocument();
    });

    it("renders one image tile per provided image", async () => {
        // Arrange
        const images = [{ url: "https://x/a.png" }, { url: "https://x/b.png" }];

        // Act
        render(
            <ImagesPreviewGrid
                images={images}
                onRemove={jest.fn()}
                setColors={jest.fn()}
            />,
        );

        // Assert: alt は url+index で一意 (findBy で非同期エフェクト確定を待つ)
        expect(
            await screen.findByAltText("https://x/a.png0"),
        ).toBeInTheDocument();
        expect(
            screen.getByAltText("https://x/b.png1"),
        ).toBeInTheDocument();
    });

    it("calls onRemove with the image url when delete is clicked", async () => {
        // Arrange
        const onRemove = jest.fn();
        render(
            <ImagesPreviewGrid
                images={[{ url: "https://x/a.png" }]}
                onRemove={onRemove}
                setColors={jest.fn()}
            />,
        );

        // Act: 非同期エフェクト確定を待ってから操作
        fireEvent.click(await screen.findByText("Delete"));

        // Assert
        expect(onRemove).toHaveBeenCalledWith("https://x/a.png");
    });
});
