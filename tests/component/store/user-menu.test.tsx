/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import UserMenu from "@/components/store/layout/header/user-menu/user-menu";

// Clerk: server side currentUser とクライアントボタンをモック。
// currentUser を null にすると Image 経路を回避でき、extraLinks（Settings 含む）は
// user の有無に関わらず常に描画される（user-menu.tsx の Link セクションは無条件）。
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn().mockResolvedValue(null),
}));
jest.mock("@clerk/nextjs", () => ({
    UserButton: () => <div data-testid="user-button" />,
    SignOutButton: () => <div data-testid="sign-out-button" />,
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

describe("UserMenu", () => {
    it('renders the Settings extra link pointing to "/profile/settings" (regression: not "/")', async () => {
        // Arrange / Act — async Server Component は await して描画する
        render(await UserMenu());

        // Assert
        const settingsLink = screen.getByRole("link", { name: "Settings" });
        expect(settingsLink).toHaveAttribute("href", "/profile/settings");
    });
});
