/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import ColorPalette from "@/components/dashboard/shared/color-palette";

describe("ColorPalette", () => {
    it("renders one selectable block per extracted color", () => {
        // Arrange & Act
        render(
            <ColorPalette
                extractedColors={["#fff", "#000"]}
                colors={[]}
                setColors={jest.fn()}
            />,
        );

        // Assert
        expect(screen.getByLabelText("Select color #fff")).toBeInTheDocument();
        expect(screen.getByLabelText("Select color #000")).toBeInTheDocument();
    });

    it("adds a clicked color to the current selection", () => {
        // Arrange
        const setColors = jest.fn();
        render(
            <ColorPalette
                extractedColors={["#fff"]}
                colors={[]}
                setColors={setColors}
            />,
        );

        // Act
        fireEvent.click(screen.getByLabelText("Select color #fff"));

        // Assert
        expect(setColors).toHaveBeenCalledWith([{ color: "#fff" }]);
    });

    it("ignores a color that is already selected (dedup)", () => {
        // Arrange
        const setColors = jest.fn();
        render(
            <ColorPalette
                extractedColors={["#fff"]}
                colors={[{ color: "#fff" }]}
                setColors={setColors}
            />,
        );

        // Act
        fireEvent.click(screen.getByLabelText("Select color #fff"));

        // Assert
        expect(setColors).not.toHaveBeenCalled();
    });

    it("drops empty-string placeholders before appending", () => {
        // Arrange: 既存に空文字エントリ → 追加時に除去される
        const setColors = jest.fn();
        render(
            <ColorPalette
                extractedColors={["#000"]}
                colors={[{ color: "" }]}
                setColors={setColors}
            />,
        );

        // Act
        fireEvent.click(screen.getByLabelText("Select color #000"));

        // Assert
        expect(setColors).toHaveBeenCalledWith([{ color: "#000" }]);
    });

    it("adds the color via keyboard (Enter)", () => {
        // Arrange
        const setColors = jest.fn();
        render(
            <ColorPalette
                extractedColors={["#abc"]}
                colors={[]}
                setColors={setColors}
            />,
        );

        // Act
        fireEvent.keyDown(screen.getByLabelText("Select color #abc"), {
            key: "Enter",
        });

        // Assert
        expect(setColors).toHaveBeenCalledWith([{ color: "#abc" }]);
    });
});
