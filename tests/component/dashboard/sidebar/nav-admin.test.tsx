/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import SideBarNavAdmin from "@/components/dashboard/sidebar/nav-admin";

jest.mock("next/navigation", () => ({
    usePathname: () => "/dashboard/admin/stores",
}));

const menuLinks = [
    { label: "Dashboard", icon: "dashboard", link: "/dashboard/admin" },
    { label: "Stores", icon: "unknown-icon", link: "/dashboard/admin/stores" },
];

beforeAll(() => {
    // cmdk が jsdom に無い API を参照するため最小限のスタブを置く
    global.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    } as unknown as typeof ResizeObserver;
    Element.prototype.scrollIntoView = jest.fn();
});

describe("SideBarNavAdmin", () => {
    it("seller design: 現在のリンクだけに aria-current=page を付ける", () => {
        render(<SideBarNavAdmin menuLinks={menuLinks} design="seller" />);
        expect(
            screen.getByRole("navigation", { name: "Administration" })
        ).toBeVisible();
        expect(screen.getByRole("link", { name: "Stores" })).toHaveAttribute(
            "aria-current",
            "page"
        );
        expect(
            screen.getByRole("link", { name: "Dashboard" })
        ).not.toHaveAttribute("aria-current");
    });

    it("既定 design: コマンドリストで全リンクを描画する", () => {
        render(<SideBarNavAdmin menuLinks={menuLinks} />);
        expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
            "href",
            "/dashboard/admin"
        );
        expect(screen.getByRole("link", { name: "Stores" })).toHaveAttribute(
            "href",
            "/dashboard/admin/stores"
        );
    });
});
