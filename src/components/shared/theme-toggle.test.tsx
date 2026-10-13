/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import ThemeToggle from "@/components/shared/theme-toggle";

// next-themes の useTheme をモックし、setTheme 呼び出しを検証する
const setThemeMock = jest.fn();
jest.mock("next-themes", () => ({
    useTheme: () => ({ setTheme: setThemeMock }),
}));

describe("ThemeToggle", () => {
    beforeEach(() => {
        setThemeMock.mockClear();
    });

    it("renders the toggle trigger with accessible label", () => {
        // Arrange & Act
        render(<ThemeToggle />);

        // Assert: sr-only ラベルでトグルが識別できる
        expect(screen.getByText("Toggle theme")).toBeInTheDocument();
    });

    it("renders the trigger button as an icon button", () => {
        // Arrange & Act
        render(<ThemeToggle />);

        // Assert: トリガーは Radix DropdownMenuTrigger 経由の単一ボタン
        const trigger = screen.getByRole("button");
        expect(trigger).toHaveAttribute("aria-haspopup", "menu");
        expect(trigger).toHaveAttribute("data-state", "closed");
    });

    it("does not change theme until an option is chosen", () => {
        // Arrange & Act: マウント時点では副作用なし
        render(<ThemeToggle />);

        // Assert: useTheme は購読のみで、初期描画で setTheme は呼ばれない
        // (オプション選択時の呼び出しは下の it.each で検証する)
        expect(setThemeMock).not.toHaveBeenCalled();
    });

    it.each([
        ["Light", "light"],
        ["Dark", "dark"],
        ["System", "system"],
    ])("selecting %s from the opened menu calls setTheme(%s)", async (label, theme) => {
        // Arrange
        const user = userEvent.setup();
        render(<ThemeToggle />);

        // Act
        await user.click(screen.getByRole("button"));
        await user.click(screen.getByRole("menuitem", { name: label }));

        // Assert
        expect(setThemeMock).toHaveBeenCalledWith(theme);
    });

    it("opens the seller-styled menu and applies the selected theme", async () => {
        // Arrange
        const user = userEvent.setup();
        render(<ThemeToggle design="seller" />);

        // Act: design === "seller" の DropdownMenuContent は開いた時点で描画される
        await user.click(screen.getByRole("button"));
        await user.click(screen.getByRole("menuitem", { name: "Dark" }));

        // Assert
        expect(setThemeMock).toHaveBeenCalledWith("dark");
    });
});
