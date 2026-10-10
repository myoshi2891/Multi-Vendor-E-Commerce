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

describe("SideBarNavAdmin", () => {
    it("現在のリンクだけに aria-current=page を付ける", () => {
        render(<SideBarNavAdmin menuLinks={menuLinks} />);
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

    // cmdk の CommandItem（role="option"）にリンクを入れると axe の nested-interactive になる。
    // 既定分岐は実画面で未使用だったため削除し、素のリンクの nav に一本化した
    it("リンクを option ロールの中に入れず、全リンクを描画する", () => {
        render(<SideBarNavAdmin menuLinks={menuLinks} />);
        expect(screen.queryByRole("option")).not.toBeInTheDocument();
        expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
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
