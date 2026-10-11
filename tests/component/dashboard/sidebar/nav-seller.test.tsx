/** @jest-environment jsdom */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import SideBarNavSeller from "@/components/dashboard/sidebar/nav-seller";

jest.mock("next/navigation", () => ({
    usePathname: () => "/dashboard/seller/stores/shop/products",
}));

// "products" は実際の ProductsIcon（入れ子 SVG）を使い、アイコンの支援技術向け露出も検証する
const menuLinks = [
    { label: "Dashboard", icon: "dashboard", link: "" },
    { label: "Products", icon: "products", link: "products" },
    { label: "Orders", icon: "box-list", link: "orders" },
];

beforeAll(() => {
    // 既定 design は cmdk を使うため jsdom に無い API を補う
    global.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    } as unknown as typeof ResizeObserver;
    Element.prototype.scrollIntoView = jest.fn();
});

describe("SideBarNavSeller", () => {
    it("seller design: 選択肢（option）の中にリンクを入れず、名前付き nav の素のリンクで描画する", () => {
        // Arrange & Act
        const { container } = render(
            <SideBarNavSeller menuLinks={menuLinks} design="seller" />
        );

        // Assert
        const nav = screen.getByRole("navigation", { name: "Store pages" });
        expect(within(nav).getAllByRole("link")).toHaveLength(3);
        expect(screen.queryByRole("option")).not.toBeInTheDocument();
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
            "href",
            "/dashboard/seller/stores/shop"
        );
        expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute(
            "href",
            "/dashboard/seller/stores/shop/products"
        );
        // 名前の無い role="img" を支援技術へ露出しない（アイコンは装飾）
        expect(container.querySelector('svg[role="img"]')).toBeNull();
    });

    it("seller design: 現在のページだけに aria-current=page を付ける", () => {
        render(<SideBarNavSeller menuLinks={menuLinks} design="seller" />);

        expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute(
            "aria-current",
            "page"
        );
        expect(
            screen.getByRole("link", { name: "Dashboard" })
        ).not.toHaveAttribute("aria-current");
        expect(
            screen.getByRole("link", { name: "Orders" })
        ).not.toHaveAttribute("aria-current");
    });

    it("既定 design: 従来どおり全リンクを描画する", () => {
        render(<SideBarNavSeller menuLinks={menuLinks} />);

        expect(screen.getByRole("link", { name: "Orders" })).toHaveAttribute(
            "href",
            "/dashboard/seller/stores/shop/orders"
        );
    });
});
