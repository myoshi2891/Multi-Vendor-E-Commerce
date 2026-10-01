/** @jest-environment jsdom */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import ProductSupportPage from "./page";
import { PRODUCT_SUPPORT_SECTIONS } from "@/components/store/static/content/product-support";

jest.mock("next/link", () => ({
    __esModule: true,
    default: ({
        children,
        href,
    }: React.PropsWithChildren<{ href: string }>) => (
        <a href={href}>{children}</a>
    ),
}));

test("existing support copy is preserved with unique matching anchors and support links", () => {
    render(<ProductSupportPage />);
    for (const section of PRODUCT_SUPPORT_SECTIONS) {
        expect(
            screen.getByRole("heading", { name: section.heading })
        ).toBeInTheDocument();
        expect(screen.getByText(section.body)).toBeInTheDocument();
    }
    const links = within(
        screen.getByRole("navigation", { name: "サポート内容一覧" })
    ).getAllByRole("link");
    expect(links).toHaveLength(3);
    const targets = links.map((link) => link.getAttribute("href"));
    expect(new Set(targets).size).toBe(3);
    for (const [index, target] of targets.entries()) {
        expect(target).toMatch(/^#.+/);
        const section = document.getElementById(target!.slice(1))!;
        expect(
            within(section).getByRole("heading", {
                name: PRODUCT_SUPPORT_SECTIONS[index].heading,
            })
        ).toBeInTheDocument();
    }
    const support = within(
        screen.getByRole("navigation", { name: "サポート窓口" })
    ).getAllByRole("link");
    expect(support.map((link) => link.getAttribute("href"))).toEqual([
        "/customer-service",
        "/contact",
        "/returns-exchange",
        "/track-order",
    ]);
});
