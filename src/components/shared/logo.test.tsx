/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import Logo from "@/components/shared/logo";

// next/image はテスト環境では素の <img> に置き換える
jest.mock("next/image", () => ({
    __esModule: true,
    default: ({
        priority,
        ...props
    }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => (
        <img {...props} />
    ),
}));

describe("Logo", () => {
    it("renders the brand image with alt text", () => {
        // Arrange & Act
        render(<Logo width="100px" height="50px" />);

        // Assert
        const img = screen.getByAltText("GoShop");
        expect(img).toBeInTheDocument();
    });

    it("applies the given width/height to the wrapper", () => {
        // Arrange & Act
        const { container } = render(<Logo width="120px" height="40px" />);

        // Assert: ラッパー div に style として反映される
        const wrapper = container.firstChild as HTMLElement;
        expect(wrapper).toHaveStyle({ width: "120px", height: "40px" });
    });
});
