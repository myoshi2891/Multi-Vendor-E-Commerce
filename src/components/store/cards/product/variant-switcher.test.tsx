/** @jest-environment jsdom */
import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import VariantSwitcher from "./variant-switcher";
import type { VariantSimplified } from "@/lib/types";

const variants: VariantSimplified[] = [
    { variantId: "ivory", variantName: "Ivory", variantSlug: "ivory", images: [], sizes: [] },
    { variantId: "forest", variantName: "Forest", variantSlug: "forest", images: [], sizes: [] },
];
function Fixture() {
    const [selectedVariant, setVariant] = useState(variants[0]);
    return <><output>{selectedVariant.variantName}</output><VariantSwitcher images={variants.map(v => ({ url: `/product/piece/${v.variantSlug}`, image: "/assets/brand/star.svg" }))} variants={variants} setVariant={setVariant} selectedVariant={selectedVariant} /></>;
}
it("keyboard focus previews the variant and keeps its product destination", () => {
    render(<Fixture />);
    const forest = screen.getByRole("link", { name: "Choose Forest" });
    fireEvent.focus(forest);
    expect(screen.getByRole("status")).toHaveTextContent("Forest");
    expect(forest).toHaveAttribute("href", "/product/piece/forest");
    expect(forest).toHaveAttribute("aria-current", "true");
});
it("pointer hover previews the variant without navigation", () => {
    render(<Fixture />);
    fireEvent.mouseEnter(screen.getByRole("link", { name: "Choose Forest" }));
    expect(screen.getByRole("status")).toHaveTextContent("Forest");
});
