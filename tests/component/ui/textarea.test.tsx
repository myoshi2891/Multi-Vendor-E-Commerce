/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Textarea } from "@/components/ui/textarea";

describe("Textarea (snapshot)", () => {
    it("renders default textarea", () => {
        const { container } = render(<Textarea placeholder="Type here" />);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders disabled textarea", () => {
        const { container } = render(
            <Textarea disabled placeholder="Disabled" />
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders aria-invalid textarea", () => {
        const { container } = render(
            <Textarea aria-invalid="true" placeholder="Invalid" />
        );
        expect(container.firstChild).toMatchSnapshot();
    });

    it("merges className", () => {
        const { container } = render(<Textarea className="mt-4" />);
        expect(container.firstChild).toMatchSnapshot();
    });
});
