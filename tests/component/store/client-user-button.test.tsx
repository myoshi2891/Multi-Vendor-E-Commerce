/** @jest-environment jsdom */
import React, { act } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import "@testing-library/jest-dom";
import ClientUserButton from "@/components/store/layout/header/user-menu/client-user-button";

// Clerk の UserButton は clerk-js ロード済みならクライアントで DOM を出す。
// モックは常に描画させ、「SSR では出さず hydration 後に出す」責務をラッパー側で検証する。
jest.mock("@clerk/nextjs", () => ({
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
}));

describe("ClientUserButton", () => {
    it("SSR では UserButton を出力しない（Clerk ロード状態に依存させない）", () => {
        // Arrange / Act
        const html = renderToString(<ClientUserButton />);

        // Assert
        expect(html).not.toContain("user-button");
    });

    it("SSR HTML を hydrate しても不一致を起こさず、hydration 後に UserButton を描画する", async () => {
        // Arrange — サーバー HTML をコンテナへ流し込む
        const container = document.createElement("div");
        container.innerHTML = renderToString(<ClientUserButton />);
        document.body.appendChild(container);
        const onRecoverableError = jest.fn();

        // Act
        await act(async () => {
            hydrateRoot(container, <ClientUserButton />, {
                onRecoverableError,
            });
        });

        // Assert
        expect(onRecoverableError).not.toHaveBeenCalled();
        const button = container.querySelector('[data-testid="user-button"]');
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute("data-avatar-box", "size-[70px]");
        container.remove();
    });
});
