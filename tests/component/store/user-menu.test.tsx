/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { currentUser } from "@clerk/nextjs/server";
import UserMenu from "@/components/store/layout/header/user-menu/user-menu";

// Clerk: server side currentUser とクライアントボタンをモック。
// 既定は null（未認証）。認証済み/エラー経路は各テストで mock*Once で上書きする。
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn().mockResolvedValue(null),
}));
jest.mock("@clerk/nextjs", () => ({
    UserButton: () => <div data-testid="user-button" />,
    SignOutButton: () => <div data-testid="sign-out-button" />,
}));
// next/image を素の img に差し替え（jsdom で next 最適化を回避）
jest.mock("next/image", () => ({
    __esModule: true,
    default: (props: { src: string; alt: string }) => (
        <img src={props.src} alt={props.alt} />
    ),
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

const mockCurrentUser = currentUser as jest.Mock;

describe("UserMenu", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCurrentUser.mockResolvedValue(null);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('renders the Settings extra link pointing to "/profile/settings" (regression: not "/")', async () => {
        // Arrange / Act — async Server Component は await して描画する
        render(await UserMenu());

        // Assert
        const settingsLink = screen.getByRole("link", { name: "Settings" });
        expect(settingsLink).toHaveAttribute("href", "/profile/settings");
    });

    it('renders the Discounts & Offers extra link pointing to "/offers" (regression: not "")', async () => {
        // Arrange / Act — async Server Component は await して描画する
        render(await UserMenu());

        // Assert — 旧 "" を弾き /offers を指すこと（AC-OF3）
        const offersLink = screen.getByRole("link", {
            name: "Discounts & Offers",
        });
        expect(offersLink).toHaveAttribute("href", "/offers");
    });

    it('renders the Help Center extra link pointing to "/customer-service" (regression: not "")', async () => {
        // Arrange / Act — async Server Component は await して描画する
        render(await UserMenu());

        // Assert — 旧 "" を弾き /customer-service を指すこと（AC-SP4）
        const helpLink = screen.getByRole("link", { name: "Help Center" });
        expect(helpLink).toHaveAttribute("href", "/customer-service");
    });

    it('renders the Legal & Privacy extra link pointing to "/legal" (regression: not "")', async () => {
        // Arrange / Act — async Server Component は await して描画する
        render(await UserMenu());

        // Assert — 旧 "" を弾き /legal を指すこと（AC-SP5）
        const legalLink = screen.getByRole("link", { name: "Legal & Privacy" });
        expect(legalLink).toHaveAttribute("href", "/legal");
    });

    it("未認証時はサインイン/登録ボタンを描画する（user=null 経路）", async () => {
        mockCurrentUser.mockResolvedValueOnce(null);

        render(await UserMenu());

        expect(
            screen.getByRole("button", { name: "Sign in" })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "Register" })
        ).toBeInTheDocument();
        // 未認証時はアバター（ユーザー名 alt の画像）も UserButton も描画されない
        // ※ メニューのリンクアイコンは role="img" の SVG なので、汎用 img ではなく
        //   UserButton（認証済み専用）の非存在で判定する
        expect(screen.queryByTestId("user-button")).not.toBeInTheDocument();
    });

    it("認証済み時はアバター画像と UserButton/SignOutButton を描画する", async () => {
        mockCurrentUser.mockResolvedValueOnce({
            imageUrl: "https://cdn.example/avatar.png",
            fullName: "Jane Doe",
        });

        render(await UserMenu());

        const avatar = screen.getByRole("img", { name: "Jane Doe" });
        expect(avatar).toHaveAttribute(
            "src",
            "https://cdn.example/avatar.png"
        );
        expect(screen.getByTestId("user-button")).toBeInTheDocument();
        expect(screen.getByTestId("sign-out-button")).toBeInTheDocument();
        // 認証済み時はサインインボタンを描画しない
        expect(
            screen.queryByRole("button", { name: "Sign in" })
        ).not.toBeInTheDocument();
    });

    it("認証済みで fullName が無い場合は alt に 'user name' をフォールバックする", async () => {
        mockCurrentUser.mockResolvedValueOnce({
            imageUrl: "https://cdn.example/avatar.png",
            fullName: null,
        });

        render(await UserMenu());

        expect(
            screen.getByRole("img", { name: "user name" })
        ).toBeInTheDocument();
    });

    it("currentUser が Error で reject すると catch でログし user=null に縮退する", async () => {
        const consoleSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});
        const error = new Error("clerk down");
        mockCurrentUser.mockRejectedValueOnce(error);

        render(await UserMenu());

        expect(consoleSpy).toHaveBeenCalledWith(
            "[UserMenu] Failed to fetch current user",
            { error: error.message, stack: error.stack }
        );
        // 失敗時はサインイン経路へ安全に縮退する
        expect(
            screen.getByRole("button", { name: "Sign in" })
        ).toBeInTheDocument();
        consoleSpy.mockRestore();
    });

    it("currentUser が非 Error で reject すると unknown ブランチでログする", async () => {
        const consoleSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});
        mockCurrentUser.mockRejectedValueOnce("clerk boom");

        render(await UserMenu());

        expect(consoleSpy).toHaveBeenCalledWith(
            "[UserMenu] Failed to fetch current user (unknown)",
            { error: "clerk boom" }
        );
        expect(
            screen.getByRole("button", { name: "Sign in" })
        ).toBeInTheDocument();
        consoleSpy.mockRestore();
    });
});
