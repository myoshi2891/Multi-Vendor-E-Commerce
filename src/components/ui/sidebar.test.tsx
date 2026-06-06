/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SidebarMenuSkeleton } from "./sidebar";

// Mock the hook from use-mobile as it's imported at module load
jest.mock("@/hooks/use-mobile", () => ({
    useIsMobile: () => false,
}));

describe("SidebarMenuSkeleton Component", () => {
    it("renders skeleton with custom property --skeleton-width updated by useEffect", () => {
        const { container } = render(<SidebarMenuSkeleton showIcon={true} />);
        
        // Find the skeleton text element
        const textElement = container.querySelector("[data-sidebar='menu-skeleton-text']");
        expect(textElement).toBeInTheDocument();
        
        // Check that style custom property --skeleton-width is set
        const width = textElement?.getAttribute("style");
        expect(width).toContain("--skeleton-width:");
        
        // Since useEffect runs immediately in jsdom render, we can verify that the calculated width is a random number between 50% and 90%
        const match = width?.match(/--skeleton-width:\s*(\d+)%/);
        expect(match).not.toBeNull();
        const percent = parseInt(match![1], 10);
        expect(percent).toBeGreaterThanOrEqual(50);
        expect(percent).toBeLessThanOrEqual(90);
    });

    it("renders icon skeleton when showIcon is true", () => {
        const { container } = render(<SidebarMenuSkeleton showIcon={true} />);
        const iconElement = container.querySelector("[data-sidebar='menu-skeleton-icon']");
        expect(iconElement).toBeInTheDocument();
    });

    it("does not render icon skeleton when showIcon is false", () => {
        const { container } = render(<SidebarMenuSkeleton showIcon={false} />);
        const iconElement = container.querySelector("[data-sidebar='menu-skeleton-icon']");
        expect(iconElement).toBeNull();
    });
});
