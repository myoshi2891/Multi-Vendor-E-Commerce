/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import Layout from "@/app/dashboard/admin/layout";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
jest.mock("@clerk/nextjs/server", () => ({ currentUser: jest.fn() }));
jest.mock("next/navigation", () => ({
    redirect: jest.fn(() => {
        throw Error("NEXT_REDIRECT");
    }),
}));
jest.mock("@/components/dashboard/sidebar/sidebar", () => ({
    __esModule: true,
    default: ({ isAdmin, design }: { isAdmin: boolean; design: string }) => (
        <nav aria-label="Administration" data-design={design}>
            {isAdmin ? "Admin links" : "Seller links"}
        </nav>
    ),
}));
jest.mock("@/components/dashboard/header/Header", () => ({
    __esModule: true,
    default: () => <button>Account</button>,
}));
beforeEach(() => jest.clearAllMocks());
it("renders admin children inside the shared responsive main/navigation", async () => {
    jest.mocked(currentUser).mockResolvedValue({
        privateMetadata: { role: "ADMIN" },
    } as never);
    render(await Layout({ children: <h1>Test admin page</h1> }));
    expect(screen.getByRole("main")).toContainElement(
        screen.getByRole("heading", { name: "Test admin page" })
    );
    expect(
        screen.getByRole("button", { name: "Administration navigation" })
    ).toHaveAttribute("aria-expanded", "false");
    expect(
        screen.getByRole("navigation", { name: "Administration", hidden: true })
    ).toHaveAttribute("data-design", "seller");
});
it.each([null, { privateMetadata: { role: "SELLER" } }])(
    "preserves existing denial/home redirect for %p",
    async (user) => {
        jest.mocked(currentUser).mockResolvedValue(user as never);
        await expect(Layout({ children: <p>Private</p> })).rejects.toThrow(
            "NEXT_REDIRECT"
        );
        expect(redirect).toHaveBeenCalledWith("/");
    }
);
