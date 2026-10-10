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

// Portaled descendants (e.g. the store switcher popover) bubble React events
// through the aside; only events inside the aside DOM may close the menu.
import { createPortal } from "react-dom";
import SellerShell from "@/components/dashboard/design/seller-shell";
it("ignores Escape and link clicks bubbled from portaled descendants", async () => {
    const user = userEvent.setup();
    render(
        <SellerShell
            header={null}
            sidebar={
                <>
                    <p>Sidebar text</p>
                    {createPortal(
                        <div>
                            <a href="/portal">Portal link</a>
                            <input aria-label="Portal search" />
                        </div>,
                        document.body
                    )}
                </>
            }
        >
            <h1>Content</h1>
        </SellerShell>
    );
    const trigger = screen.getByRole("button", { name: "Store navigation" });
    await user.click(trigger);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Portal search" }), {
        key: "Escape",
    });
    fireEvent.click(screen.getByRole("link", { name: "Portal link" }));
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByText("Sidebar text"));
    fireEvent.keyDown(screen.getByText("Sidebar text"), { key: "Enter" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(screen.getByText("Sidebar text"), { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
});

// Sidebar は Client Component（StoreSwitcher）へ店舗を渡すため、Decimal 列を含む Store 全体ではなく
// 表示に使う name / url だけを取得する（RSC は Decimal を直列化できない）
import { db } from "@/lib/db";
it("loads only serializable store fields for the sidebar", async () => {
    render(await Layout({ children: <h1>Overview</h1> }));
    expect(db.store.findMany).toHaveBeenCalledWith({
        where: { userId: "seller" },
        select: { name: true, url: true },
    });
});
