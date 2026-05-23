/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Input } from "@/components/ui/input";

describe("Input (snapshot)", () => {
    it("renders default text input", () => {
        const { container } = render(<Input placeholder="Type here" />);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders disabled input", () => {
        const { container } = render(<Input disabled placeholder="Disabled" />);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders aria-invalid input", () => {
        const { container } = render(
            <Input aria-invalid="true" placeholder="Invalid" />
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders type=password", () => {
        const { container } = render(<Input type="password" />);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("merges className", () => {
        const { container } = render(<Input className="mt-4" />);
        expect(container.firstChild).toMatchSnapshot();
    });
});
