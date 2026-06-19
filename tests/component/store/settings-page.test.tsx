/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProfileSettingsPage from "@/app/(store)/profile/settings/page";

// Clerk <UserProfile /> はクライアント依存が重いためプレースホルダにモックする。
jest.mock("@clerk/nextjs", () => ({
    UserProfile: () => <div data-testid="clerk-user-profile" />,
}));

describe("ProfileSettingsPage", () => {
    it("renders the heading and the Clerk UserProfile", () => {
        // Arrange / Act
        render(<ProfileSettingsPage />);

        // Assert
        expect(
            screen.getByRole("heading", { name: "Account settings" })
        ).toBeInTheDocument();
        expect(screen.getByTestId("clerk-user-profile")).toBeInTheDocument();
    });
});
