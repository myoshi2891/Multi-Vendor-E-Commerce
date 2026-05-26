/** @jest-environment jsdom */
import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Separator } from "@/components/ui/separator";

describe("Separator (snapshot)", () => {
    it("renders horizontal orientation (default)", () => {
        const { container } = render(<Separator />);
        expect(container.firstChild).toMatchSnapshot();
    });

    it("renders vertical orientation", () => {
        const { container } = render(<Separator orientation="vertical" />);
        expect(container.firstChild).toMatchSnapshot();
    });
});
