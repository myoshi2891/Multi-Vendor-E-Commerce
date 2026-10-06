/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import type { User } from "@clerk/nextjs/server";
import UserInfo from "@/components/dashboard/sidebar/user-info";

const user = {
    firstName: "Ada",
    lastName: "Lovelace",
    imageUrl: "",
    privateMetadata: { role: "ADMIN" },
    emailAddresses: [{ emailAddress: "ada@example.com" }],
} as unknown as User;

describe("UserInfo", () => {
    it("seller design: 氏名・メール・ロールを表示する", () => {
        render(<UserInfo user={user} design="seller" />);
        expect(screen.getByText("Ada Lovelace")).toBeVisible();
        expect(screen.getByText("ada@example.com")).toBeVisible();
        expect(screen.getByText("admin Dashboard")).toBeVisible();
        expect(screen.getByText("AL")).toBeInTheDocument();
    });

    it("seller design: ユーザー未取得・メール無しでも USER ロールで描画する", () => {
        const noEmail = {
            ...user,
            privateMetadata: {},
            emailAddresses: [],
        } as unknown as User;
        const { rerender } = render(
            <UserInfo user={noEmail} design="seller" />
        );
        expect(screen.getByText("user Dashboard")).toBeVisible();
        rerender(<UserInfo user={null} design="seller" />);
        expect(screen.getByText("user Dashboard")).toBeVisible();
    });

    it("既定 design: 既存のボタン型表示を維持する", () => {
        render(<UserInfo user={user} />);
        expect(screen.getByRole("button")).toHaveTextContent("ada@example.com");
        expect(screen.getByText("admin Dashboard")).toBeVisible();
    });
});
