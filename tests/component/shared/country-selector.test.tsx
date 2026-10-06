/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import CountrySelector from "@/components/shared/country-selector";
import { SelectMenuOption } from "@/lib/types";

// Mock dependencies
jest.mock("framer-motion", () => ({
    motion: {
        ul: ({
            children,
            ...props
        }: React.HTMLAttributes<HTMLUListElement>) => (
            <ul {...props}>{children}</ul>
        ),
    },
    AnimatePresence: ({
        children,
    }: React.PropsWithChildren<Record<string, unknown>>) => <>{children}</>,
}));
jest.mock("next/image", () => ({
    __esModule: true,
    default: ({
        priority,
        ...props
    }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => (
        <img {...props} />
    ),
}));

describe("CountrySelector", () => {
    const mockOnToggle = jest.fn();
    const mockOnChange = jest.fn();
    const selectedValue = {
        id: "c1",
        name: "Japan",
        code: "JP",
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("renders selected value", () => {
        render(
            <CountrySelector
                id="test-selector"
                open={false}
                onToggle={mockOnToggle}
                onChange={mockOnChange}
                selectedValue={selectedValue}
            />
        );

        expect(screen.getByRole("button")).toHaveTextContent("Japan");
        expect(screen.getByAltText("Japan")).toHaveAttribute(
            "src",
            "https://purecatamphetamine.github.io/country-flag-icons/3x2/JP.svg"
        );
    });

    it("calls onToggle when button is clicked", () => {
        render(
            <CountrySelector
                id="test-selector"
                open={false}
                onToggle={mockOnToggle}
                onChange={mockOnChange}
                selectedValue={selectedValue}
            />
        );

        fireEvent.click(screen.getByRole("button"));
        expect(mockOnToggle).toHaveBeenCalled();
    });

    it("renders country list when open is true", () => {
        render(
            <CountrySelector
                id="test-selector"
                open={true}
                onToggle={mockOnToggle}
                onChange={mockOnChange}
                selectedValue={selectedValue}
            />
        );

        // It should render countries from COUNTRIES data
        // For example United States
        expect(screen.getByText("United States")).toBeInTheDocument();
        expect(
            screen.getByPlaceholderText("Search a country")
        ).toBeInTheDocument();
    });

    it("filters country list based on search query", () => {
        render(
            <CountrySelector
                id="test-selector"
                open={true}
                onToggle={mockOnToggle}
                onChange={mockOnChange}
                selectedValue={selectedValue}
            />
        );

        const searchInput = screen.getByPlaceholderText("Search a country");
        fireEvent.change(searchInput, { target: { value: "United" } });

        expect(screen.getByText("United States")).toBeInTheDocument();

        // Use queryAllByRole('option') to check dropdown items
        const options = screen.queryAllByRole("option");
        const optionNames = options.map((opt) => opt.textContent);
        expect(optionNames).toContain("United States");
        expect(optionNames).not.toContain("Japan");
    });

    it('shows "No countries found" when no match', () => {
        render(
            <CountrySelector
                id="test-selector"
                open={true}
                onToggle={mockOnToggle}
                onChange={mockOnChange}
                selectedValue={selectedValue}
            />
        );

        const searchInput = screen.getByPlaceholderText("Search a country");
        fireEvent.change(searchInput, {
            target: { value: "NonExistentCountry" },
        });

        expect(screen.getByText("No countries found")).toBeInTheDocument();
    });

    it("calls onChange and onToggle when a country is selected", () => {
        render(
            <CountrySelector
                id="test-selector"
                open={true}
                onToggle={mockOnToggle}
                onChange={mockOnChange}
                selectedValue={selectedValue}
            />
        );

        fireEvent.click(screen.getByText("United States"));

        expect(mockOnChange).toHaveBeenCalledWith("United States");
        expect(mockOnToggle).toHaveBeenCalled();
    });

    it("disables button when disabled prop is true", () => {
        render(
            <CountrySelector
                id="test-selector"
                open={false}
                disabled={true}
                onToggle={mockOnToggle}
                onChange={mockOnChange}
                selectedValue={selectedValue}
            />
        );

        expect(screen.getByRole("button")).toBeDisabled();
    });
    it("exposes the actual expanded state and an accessible name", () => {
        render(
            <CountrySelector
                id="delivery"
                open={false}
                onToggle={mockOnToggle}
                onChange={mockOnChange}
                selectedValue={selectedValue}
            />
        );
        expect(screen.getByRole("button", { name: /Japan/ })).toHaveAttribute(
            "aria-expanded",
            "false"
        );
    });
    it("uses unique option IDs and marks the selected country", () => {
        render(
            <CountrySelector
                id="delivery"
                open
                onToggle={mockOnToggle}
                onChange={mockOnChange}
                selectedValue={selectedValue}
            />
        );
        const options = screen.getAllByRole("option");
        expect(new Set(options.map((option) => option.id)).size).toBe(
            options.length
        );
        expect(screen.getByRole("option", { name: "Japan" })).toHaveAttribute(
            "aria-selected",
            "true"
        );
        expect(
            screen.getByRole("searchbox", { name: "Search a country" })
        ).toBeInTheDocument();
    });
    it("selects a filtered country with ArrowDown and Enter", () => {
        render(
            <CountrySelector
                id="delivery"
                open
                onToggle={mockOnToggle}
                onChange={mockOnChange}
                selectedValue={selectedValue}
            />
        );
        const search = screen.getByRole("searchbox");
        fireEvent.change(search, { target: { value: "United States" } });
        fireEvent.keyDown(search, { key: "ArrowDown" });
        const option = screen.getByRole("option", { name: "United States" });
        expect(option).toHaveFocus();
        fireEvent.keyDown(option, { key: "Enter" });
        expect(mockOnChange).toHaveBeenCalledWith("United States");
    });
    it("does not select a country when Enter is pressed in the search input", () => {
        render(
            <CountrySelector
                id="delivery"
                open
                onToggle={mockOnToggle}
                onChange={mockOnChange}
                selectedValue={selectedValue}
            />
        );
        const search = screen.getByRole("searchbox");
        fireEvent.change(search, { target: { value: "United States" } });
        fireEvent.keyDown(search, { key: "ArrowDown" });
        fireEvent.keyDown(search, { key: "Enter" });
        expect(mockOnChange).not.toHaveBeenCalled();
    });
    it("Escape closes only the country picker and returns focus", () => {
        render(
            <CountrySelector
                id="delivery"
                open
                onToggle={mockOnToggle}
                onChange={mockOnChange}
                selectedValue={selectedValue}
            />
        );
        fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
        expect(mockOnToggle).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("button")).toHaveFocus();
    });
});
