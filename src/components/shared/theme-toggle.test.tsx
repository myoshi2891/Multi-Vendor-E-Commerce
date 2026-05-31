/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
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
        // (オプション選択は Radix ポータルの open を要するため E2E/integration で担保)
        expect(setThemeMock).not.toHaveBeenCalled();
    });
});
