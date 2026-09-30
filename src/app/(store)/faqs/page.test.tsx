/** @jest-environment jsdom */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import FaqsPage from "./page";
import { FAQ_SECTIONS } from "@/components/store/static/content/faqs";

describe("FAQs design", () => {
    it("keeps all existing questions and plain-text answers visible", () => {
        render(<FaqsPage />);
        expect(screen.getByRole("heading", { level: 1, name: "FAQs" })).toBeVisible();
        for (const section of FAQ_SECTIONS) {
            expect(screen.getByRole("heading", { level: 2, name: section.heading })).toBeVisible();
            expect(screen.getByText(section.body)).toBeVisible();
        }
    });
    it("provides unique question anchors with a labelled navigation", () => {
        render(<FaqsPage />);
        const nav = screen.getByRole("navigation", { name: "質問一覧" });
        const targets = FAQ_SECTIONS.map((section) => {
            const link = within(nav).getByRole("link", { name: section.heading });
            const href = link.getAttribute("href")!;
            expect(href).toMatch(/^#.+/);
            const target = document.getElementById(href.slice(1));
            expect(target).toContainElement(screen.getByRole("heading", { name: section.heading }));
            return href;
        });
        expect(new Set(targets).size).toBe(FAQ_SECTIONS.length);
    });
    it("connects the breadcrumb and support destinations", () => {
        render(<FaqsPage />);
        expect(within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
        const nav = screen.getByRole("navigation", { name: "サポートページ" });
        for (const [name, href] of [["Contact us", "/contact"], ["Track your order", "/track-order"], ["Returns & Exchange", "/returns-exchange"], ["Customer service", "/customer-service"]]) {
            expect(within(nav).getByRole("link", { name: new RegExp(name) })).toHaveAttribute("href", href);
        }
    });
});
