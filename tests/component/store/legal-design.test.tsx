/** @jest-environment jsdom */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import Page, { metadata } from "@/app/(store)/legal/page";
import { LEGAL_SECTIONS } from "@/components/store/static/content/legal";
it("provides a labeled legal contents navigation and preserves existing anchors/body/metadata", () => {
    render(<Page />);
    const contents = screen.getByRole("navigation", { name: "Legal contents" });
    for (const [i, id] of [
        "terms-of-service",
        "privacy-policy",
        "commercial-transaction-act",
    ].entries()) {
        const section = LEGAL_SECTIONS[i];
        expect(
            within(contents).getByRole("link", { name: section.heading })
        ).toHaveAttribute("href", `#${id}`);
        expect(document.getElementById(id)).toContainElement(
            screen.getByRole("heading", { level: 2, name: section.heading })
        );
        expect(screen.getByText(section.body)).toBeVisible();
    }
    expect(metadata.title).toBe("Legal & Privacy | Marketplace");
});
it("adds a breadcrumb home link without replacing placeholder copy", () => {
    render(<Page />);
    expect(
        within(
            screen.getByRole("navigation", { name: "Breadcrumb" })
        ).getByRole("link", { name: "Home" })
    ).toHaveAttribute("href", "/");
    expect(screen.getAllByText(/（プレースホルダ）/)).toHaveLength(3);
});
