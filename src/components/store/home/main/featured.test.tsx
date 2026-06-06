/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { renderToString } from "react-dom/server";
import Featured from "@/components/store/home/main/featured";

// Swiper などの子コンポーネントをモック化
jest.mock("../../shared/swiper", () => {
	return function MockSwiper() {
		return <div data-testid="mock-swiper" />;
	};
});

describe("Featured Component (Client-Side)", () => {
	it("should render successfully on client-side (window is defined)", () => {
		render(<Featured products={[]} />);
		expect(screen.getByText("Welcome New Comers")).toBeInTheDocument();
	});
});
