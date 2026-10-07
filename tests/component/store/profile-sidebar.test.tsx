/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProfileSidebar from "@/components/store/layout/profile-sidebar/sidebar";

let mockPathname = "/profile";

// "use client" コンポーネント。usePathname を固定値でモックする。
jest.mock("next/navigation", () => ({
    usePathname: () => mockPathname,
}));

describe("ProfileSidebar", () => {
    beforeEach(() => {
        mockPathname = "/profile";
    });
    it('renders a Settings menu entry pointing to "/profile/settings"', () => {
        // Arrange / Act
        render(<ProfileSidebar />);

        // Assert
        const settingsLink = screen.getByRole("link", { name: "Settings" });
        expect(settingsLink).toHaveAttribute("href", "/profile/settings");
    });
});

describe("ProfileSidebar notifications (plan 086)", () => {
    it('renders a Notifications entry pointing to "/profile/notifications"', () => {
        // Arrange
        mockPathname = "/profile/notifications";

        // Act
        render(<ProfileSidebar />);

        // Assert
        const link = screen.getByRole("link", { name: "Notifications" });
        expect(link).toHaveAttribute("href", "/profile/notifications");
        expect(link).toHaveAttribute("aria-current", "page");
    });
});

describe("Profile account navigation", () => {
    it.each([
        "/profile",
        "/profile/orders/shipped",
        "/profile/settings",
        "/profile/wishlist/3",
    ])("indicates exactly one current link for %s", (path) => {
        mockPathname = path;
        render(<ProfileSidebar />);
        const nav = screen.getByRole("navigation", {
            name: "Account navigation",
        });
        const current = nav.querySelectorAll('[aria-current="page"]');
        expect(current).toHaveLength(1);
        const expected = path.includes("/orders")
            ? "/profile/orders"
            : path.includes("/wishlist")
              ? "/profile/wishlist/1"
              : path;
        expect(current[0]).toHaveAttribute("href", expected);
    });
    it("preserves all ten existing account destinations plus Notifications (plan 086)", () => {
        mockPathname = "/profile";
        render(<ProfileSidebar />);
        expect(
            screen
                .getByRole("navigation", { name: "Account navigation" })
                .querySelectorAll("a")
        ).toHaveLength(11);
    });
});
