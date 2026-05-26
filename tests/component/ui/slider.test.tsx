/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Slider } from "@/components/ui/slider";

describe("Slider (snapshot)", () => {
    it("renders default (no value)", () => {
        const { container } = render(<Slider />);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders with defaultValue=[50]", () => {
        const { container } = render(<Slider defaultValue={[50]} />);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders disabled state", () => {
        const { container } = render(<Slider disabled defaultValue={[25]} />);
        expect(container.firstChild).toMatchSnapshot();
    });
});
