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
    // appearance.elements.avatarBox を data 属性へ露出し、Clerk の公式 API で
    // アバターサイズを指定していること（構造依存 CSS 不使用）を検証できるようにする
    UserButton: ({
        appearance,
    }: {
        appearance?: { elements?: { avatarBox?: string } };
    }) => (
        <div
            data-testid="user-button"
            data-avatar-box={appearance?.elements?.avatarBox}
        />
    ),
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

// 未読件数（plan 086）。既定は 0 件
jest.mock("@/queries/notification", () => ({
    getUnreadNotificationCount: jest.fn().mockResolvedValue(0),
}));

const mockCurrentUser = currentUser as jest.Mock;
const mockUnreadCount = jest.requireMock("@/queries/notification")
    .getUnreadNotificationCount as jest.Mock;

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

    it('renders the Return & Refund Policy extra link pointing to "/returns-exchange" (regression: not "/")', async () => {
        // Arrange / Act — async Server Component は await して描画する
        render(await UserMenu());

        // Assert — 旧 "/" を弾き /returns-exchange を指すこと（AC-SF7）
        const link = screen.getByRole("link", {
            name: "Return & Refund Policy",
        });
        expect(link).toHaveAttribute("href", "/returns-exchange");
    });

    it('renders the Order Dispute Resolution extra link pointing to "/dispute" (regression: not "")', async () => {
        // Arrange / Act
        render(await UserMenu());

        // Assert — 旧 "" を弾き /dispute を指すこと（AC-SF7）
        const link = screen.getByRole("link", {
            name: "Order Dispute Resolution",
        });
        expect(link).toHaveAttribute("href", "/dispute");
    });

    it('renders the Report a Problem extra link pointing to "/report-problem" (regression: not "")', async () => {
        // Arrange / Act
        render(await UserMenu());

        // Assert — 旧 "" を弾き /report-problem を指すこと（AC-SF7）
        const link = screen.getByRole("link", { name: "Report a Problem" });
        expect(link).toHaveAttribute("href", "/report-problem");
    });

    it("未認証時はサインイン/登録リンクを描画する（user=null 経路）", async () => {
        mockCurrentUser.mockResolvedValueOnce(null);

        render(await UserMenu());

        expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
            "href",
            "/sign-in"
        );
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
        expect(avatar).toHaveAttribute("src", "https://cdn.example/avatar.png");
        expect(screen.getByTestId("user-button")).toBeInTheDocument();
        expect(screen.getByTestId("sign-out-button")).toBeInTheDocument();
        // 認証済み時はサインインリンクを描画しない
        expect(
            screen.queryByRole("link", { name: "Sign in" })
        ).not.toBeInTheDocument();
    });

    it("認証済み時は UserButton のアバターサイズを appearance.elements で指定する（.cl-avatarBox 直接指定を使わない）", async () => {
        // Arrange
        mockCurrentUser.mockResolvedValueOnce({
            imageUrl: "https://cdn.example/avatar.png",
            fullName: "Jane Doe",
        });

        // Act
        render(await UserMenu());

        // Assert
        expect(screen.getByTestId("user-button")).toHaveAttribute(
            "data-avatar-box",
            "size-[70px]"
        );
    });

    it("認証済みで fullName が無い場合は alt に 'Your account' をフォールバックする", async () => {
        mockCurrentUser.mockResolvedValueOnce({
            imageUrl: "https://cdn.example/avatar.png",
            fullName: null,
        });

        render(await UserMenu());

        expect(
            screen.getByRole("img", { name: "Your account" })
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
        expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
            "href",
            "/sign-in"
        );
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
        expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
            "href",
            "/sign-in"
        );
        consoleSpy.mockRestore();
    });

    describe("通知（plan 086）", () => {
        const signedIn = {
            imageUrl: "https://cdn.example/avatar.png",
            fullName: "Jane Doe",
        };

        it("未読があると、件数付きの通知リンクと開閉ボタンの読み上げを出す", async () => {
            // Arrange
            mockCurrentUser.mockResolvedValueOnce(signedIn);
            mockUnreadCount.mockResolvedValueOnce(3);

            // Act
            render(await UserMenu());

            // Assert
            expect(
                // jsdom は要素の境目に空白を入れるので、カンマ前後の空白を許容する
                screen.getByRole("link", {
                    name: /^Notifications\s*,\s*3 unread$/,
                })
            ).toHaveAttribute("href", "/profile/notifications");
            expect(
                screen.getByLabelText("Account menu, 3 unread notifications")
            ).toBeInTheDocument();
        });

        it("未読が 0 件なら件数を出さず、通知リンクだけを出す", async () => {
            // Arrange
            mockCurrentUser.mockResolvedValueOnce(signedIn);

            // Act
            render(await UserMenu());

            // Assert
            expect(
                screen.getByRole("link", { name: "Notifications" })
            ).toHaveAttribute("href", "/profile/notifications");
            expect(screen.getByLabelText("Account menu")).toBeInTheDocument();
        });

        it("未読件数の取得に失敗してもメニューは描画し、件数を出さない", async () => {
            // Arrange
            const consoleSpy = jest
                .spyOn(console, "error")
                .mockImplementation(() => {});
            mockCurrentUser.mockResolvedValueOnce(signedIn);
            mockUnreadCount.mockRejectedValueOnce(new Error("db down"));

            // Act
            render(await UserMenu());

            // Assert
            expect(
                screen.getByRole("link", { name: "Notifications" })
            ).toBeInTheDocument();
            expect(consoleSpy).toHaveBeenCalledWith(
                "[UserMenu] Failed to fetch unread notification count",
                expect.objectContaining({ error: "db down" })
            );
            consoleSpy.mockRestore();
        });

        it("未認証では未読件数を取得せず、通知リンクも出さない", async () => {
            // Act
            render(await UserMenu());

            // Assert
            expect(mockUnreadCount).not.toHaveBeenCalled();
            expect(
                screen.queryByRole("link", { name: /Notifications/ })
            ).not.toBeInTheDocument();
        });
    });
});
