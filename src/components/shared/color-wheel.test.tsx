/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import ColorWheel from "@/components/shared/color-wheel";

describe("ColorWheel", () => {
    it("renders one <path> slice per color", () => {
        // Arrange
        const colors = [{ name: "red" }, { name: "green" }, { name: "blue" }];

        // Act
        const { container } = render(<ColorWheel colors={colors} size={100} />);

        // Assert
        const paths = container.querySelectorAll("path");
        expect(paths).toHaveLength(3);
        expect(paths[0]).toHaveAttribute("fill", "red");
        expect(paths[2]).toHaveAttribute("fill", "blue");
    });

    it("sizes the svg viewBox from the size prop", () => {
        // Arrange & Act
        const { container } = render(
            <ColorWheel colors={[{ name: "black" }]} size={64} />,
        );

        // Assert
        const svg = container.querySelector("svg");
        expect(svg).toHaveAttribute("width", "64");
        expect(svg).toHaveAttribute("height", "64");
        expect(svg).toHaveAttribute("viewBox", "0 0 64 64");
    });

    it("uses the large-arc flag when a single color spans the full wheel", () => {
        // Arrange: 1 色 → sliceAngle 360 > 180 なので largeArcFlag=1
        // Act
        const { container } = render(
            <ColorWheel colors={[{ name: "purple" }]} size={50} />,
        );

        // Assert: パスデータの円弧フラグが 1
        const d = container.querySelector("path")?.getAttribute("d") ?? "";
        expect(d).toMatch(/A 25,25 0 1 1/);
    });
});
