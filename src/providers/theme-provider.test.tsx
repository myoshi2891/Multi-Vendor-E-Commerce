/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ThemeProvider } from "./theme-provider";
import { useTheme } from "next-themes";

// テスト用のヘルパーコンポーネント
const ThemeConsumer = () => {
	const { theme } = useTheme();
	return <div data-testid="theme-value">{theme}</div>;
};

describe("ThemeProvider Component", () => {
	it("renders children and provides theme context", () => {
		render(
			<ThemeProvider defaultTheme="dark">
				<ThemeConsumer />
			</ThemeProvider>
		);

		// デフォルトテーマが 'dark' になっているか検証
		expect(screen.getByTestId("theme-value")).toHaveTextContent("dark");
	});
});
