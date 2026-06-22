/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import AboutPage from "./page";

describe("AboutPage", () => {
    it("<h1>About を描画する（AC-SP1）", () => {
        // Arrange / Act
        render(<AboutPage />);

        // Assert
        expect(
            screen.getByRole("heading", { level: 1, name: "About" })
        ).toBeInTheDocument();
    });
});
