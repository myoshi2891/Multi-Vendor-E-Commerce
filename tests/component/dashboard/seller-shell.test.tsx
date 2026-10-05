/** @jest-environment jsdom */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Layout from "@/app/dashboard/seller/stores/[storeUrl]/layout";
jest.mock("@clerk/nextjs/server", () => ({
    currentUser: jest.fn(async () => ({
        id: "seller",
        privateMetadata: { role: "SELLER" },
    })),
}));
jest.mock("@/lib/db", () => ({
    db: { store: { findMany: jest.fn(async () => []) } },
}));
jest.mock("next/navigation", () => ({ redirect: jest.fn() }));
jest.mock("@/components/dashboard/header/Header", () => ({
    __esModule: true,
    default: () => <div>Theme controls</div>,
}));
jest.mock("@/components/dashboard/sidebar/sidebar", () => ({
    __esModule: true,
    default: () => (
        <nav aria-label="Store navigation">
            <a href="/products">Products</a>
        </nav>
    ),
}));
it("opens mobile navigation and returns focus on Escape", async () => {
    const user = userEvent.setup();
    render(await Layout({ children: <h1>Products</h1> }));
    const trigger = screen.getByRole("button", { name: "Store navigation" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    screen.getByRole("link", { name: "Products" }).focus();
    fireEvent.keyDown(screen.getByRole("navigation"), { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
    expect(screen.getByRole("main")).toContainElement(
        screen.getByRole("heading", { name: "Products" })
    );
});
it("closes mobile navigation when choosing a destination", async () => {
    const user = userEvent.setup();
    render(await Layout({ children: <h1>Overview</h1> }));
    const trigger = screen.getByRole("button", { name: "Store navigation" });
    await user.click(trigger);
    fireEvent.click(screen.getByRole("link", { name: "Products" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
});
