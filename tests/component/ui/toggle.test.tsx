/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Toggle } from "@/components/ui/toggle";

describe("Toggle (snapshot)", () => {
    it("renders off state (default)", () => {
        const { container } = render(<Toggle>Bold</Toggle>);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders on state via defaultPressed", () => {
        const { container } = render(<Toggle defaultPressed>Bold</Toggle>);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders variant=outline", () => {
        const { container } = render(<Toggle variant="outline">Bold</Toggle>);
        expect(container.firstChild).toMatchSnapshot();
    });
});
