/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProfileSidebar from "@/components/store/layout/profile-sidebar/sidebar";

// "use client" コンポーネント。usePathname を固定値でモックする。
jest.mock("next/navigation", () => ({
    usePathname: () => "/profile",
}));
jest.mock("next/link", () => ({
    __esModule: true,
    default: ({
        children,
        href,
    }: React.PropsWithChildren<{ href: string }>) => (
        <a href={href}>{children}</a>
    ),
}));

describe("ProfileSidebar", () => {
    it('renders a Settings menu entry pointing to "/profile/settings"', () => {
        // Arrange / Act
        render(<ProfileSidebar />);

        // Assert
        const settingsLink = screen.getByRole("link", { name: "Settings" });
        expect(settingsLink).toHaveAttribute("href", "/profile/settings");
    });
});
