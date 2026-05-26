/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Switch } from "@/components/ui/switch";

describe("Switch (snapshot)", () => {
    it("renders unchecked state (default)", () => {
        const { container } = render(<Switch />);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders checked state via defaultChecked", () => {
        const { container } = render(<Switch defaultChecked />);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders disabled state", () => {
        const { container } = render(<Switch disabled />);
        expect(container.firstChild).toMatchSnapshot();
    });
});
