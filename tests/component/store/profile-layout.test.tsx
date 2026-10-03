/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { auth } from "@clerk/nextjs/server";
import ProfileLayout from "@/app/(store)/profile/layout";

jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("@/components/store/layout/profile-sidebar/sidebar", () => ({
    __esModule: true,
    default: () => <nav data-testid="profile-sidebar" />,
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

const mockAuth = jest.mocked(auth);
type AuthResult = Awaited<ReturnType<typeof auth>>;

/** redirectToSignIn は実際には never（Next.js の redirect エラーを throw）なので同じ振る舞いを模す */
const REDIRECT_ERROR = new Error("NEXT_REDIRECT:sign-in");

describe("ProfileLayout（リソース側の認証）", () => {
    let redirectToSignIn: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        redirectToSignIn = jest.fn(() => {
            throw REDIRECT_ERROR;
        });
    });

    it("未認証なら sign-in へリダイレクトし、children を描画しない", async () => {
        // Arrange
        mockAuth.mockResolvedValue({
            userId: null,
            redirectToSignIn,
        } as unknown as AuthResult);

        // Act / Assert
        await expect(ProfileLayout({ children: <p>secret</p> })).rejects.toBe(
            REDIRECT_ERROR
        );
        expect(redirectToSignIn).toHaveBeenCalledTimes(1);
    });

    it("認証済みなら children をアカウント枠内に描画する", async () => {
        // Arrange
        mockAuth.mockResolvedValue({
            userId: "user_123",
            redirectToSignIn,
        } as unknown as AuthResult);

        // Act
        render(await ProfileLayout({ children: <p>orders</p> }));

        // Assert
        expect(screen.getByText("orders")).toBeInTheDocument();
        expect(screen.getByTestId("profile-sidebar")).toBeInTheDocument();
        expect(redirectToSignIn).not.toHaveBeenCalled();
    });
});
