/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Checkbox } from "@/components/ui/checkbox";

describe("Checkbox (snapshot)", () => {
    it("renders unchecked state (default)", () => {
        const { container } = render(<Checkbox />);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders checked state via defaultChecked", () => {
        const { container } = render(<Checkbox defaultChecked />);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders disabled state", () => {
        const { container } = render(<Checkbox disabled />);
        expect(container.firstChild).toMatchSnapshot();
    });
});
