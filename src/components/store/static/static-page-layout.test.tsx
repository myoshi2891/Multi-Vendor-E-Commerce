/** @jest-environment jsdom */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import StaticPageLayout, { type StaticSection } from "./static-page-layout";

describe("StaticPageLayout", () => {
    const sections: StaticSection[] = [
        { heading: "First heading", body: "Para one.\n\nPara two." },
        { heading: "Second heading", body: "Single paragraph." },
    ];

    it("title を <h1> に描画する（AC-SP1）", () => {
        // Arrange / Act
        render(<StaticPageLayout title="About" sections={sections} />);

        // Assert
        expect(
            screen.getByRole("heading", { level: 1, name: "About" })
        ).toBeInTheDocument();
    });

    it("各 section の heading を <h2> に描画する（T-SP1）", () => {
        render(<StaticPageLayout title="About" sections={sections} />);

        expect(
            screen.getByRole("heading", { level: 2, name: "First heading" })
        ).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { level: 2, name: "Second heading" })
        ).toBeInTheDocument();
    });

    it("body を \\n\\n 区切りで段落（<p>）に分割描画する（T-SP1）", () => {
        render(<StaticPageLayout title="About" sections={sections} />);

        // "Para one." と "Para two." が別々の段落として描画される
        expect(screen.getByText("Para one.")).toBeInTheDocument();
        expect(screen.getByText("Para two.")).toBeInTheDocument();
        expect(screen.getByText("Single paragraph.")).toBeInTheDocument();
    });

    it("lead を渡すとリード文を描画する", () => {
        render(
            <StaticPageLayout
                title="About"
                lead="Lead text."
                sections={sections}
            />
        );

        expect(screen.getByText("Lead text.")).toBeInTheDocument();
    });

    it("withToc=true で各 heading のアンカー目次を描画する", () => {
        render(
            <StaticPageLayout title="Legal" sections={sections} withToc />
        );

        // 目次リンクが heading のスラッグ化アンカーを指す
        const tocLink = screen.getByRole("link", { name: "First heading" });
        expect(tocLink).toHaveAttribute("href", "#first-heading");
    });
});
