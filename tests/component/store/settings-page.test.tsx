/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { UserProfile } from "@clerk/nextjs";
import ProfileSettingsPage from "@/app/(store)/profile/settings/page";

// Clerk <UserProfile /> はクライアント依存が重いためプレースホルダにモックする。
jest.mock("@clerk/nextjs", () => ({
    UserProfile: jest.fn(() => <div data-testid="clerk-user-profile" />),
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

it("provides a labeled settings section and preserves hash routing with brand appearance", () => {
    render(<ProfileSettingsPage />);
    expect(
        screen.getByRole("region", { name: "Account settings" })
    ).toContainElement(screen.getByTestId("clerk-user-profile"));
    expect(
        screen.getByText(/Manage your profile and account security/)
    ).toBeInTheDocument();
    expect(jest.mocked(UserProfile).mock.calls.at(-1)?.[0]).toEqual(
        expect.objectContaining({
            routing: "hash",
            appearance: expect.objectContaining({
                variables: expect.objectContaining({
                    colorPrimary: "var(--purchase-link)",
                    colorDanger: "var(--purchase-danger)",
                }),
            }),
        })
    );
});
